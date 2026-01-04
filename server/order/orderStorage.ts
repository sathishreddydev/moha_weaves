import { storage } from "server/storage";
import { eq, sql, and, desc } from "drizzle-orm";
import { db } from "server/db";
import {
  categories,
  colors,
  fabrics,
  InsertOrder,
  InsertOrderItem,
  Order,
  orderItems,
  orders,
  OrderWithItems,
  sarees,
  stockMovements,
  itemStatusHistory,
  itemStatusEnum,
} from "@shared/schema";
import { IdGenerator } from "server/utils/idGenerator";

export interface OrderStorage {
  createOrder(
    order: InsertOrder,
    items: Omit<InsertOrderItem, "orderId">[]
  ): Promise<Order>;
  getOrders(userId: string): Promise<OrderWithItems[]>;
  getOrder(id: string): Promise<OrderWithItems | undefined>;
  updateItemStatus(
    orderItemId: string,
    status: string,
    updatedBy?: string,
    note?: string
  ): Promise<any | undefined>;
  updateOrderStatus(
    orderId: string,
    status: string,
    updatedBy?: string,
    note?: string
  ): Promise<any | undefined>;
}

export class OrderRepository implements OrderStorage {
  async createOrder(
    order: InsertOrder,
    items: Omit<InsertOrderItem, "orderId">[]
  ): Promise<Order> {
    // Generate order ID
    const orderId = await IdGenerator.generateOrderId();
    
    const [newOrder] = await db.insert(orders).values({
      ...order,
      id: orderId,
    }).returning();

    let itemIndex = 1;
    for (const item of items) {
      const itemId = IdGenerator.generateItemIdFromOrder(orderId, itemIndex - 1);
      
      const [newOrderItem] = await db.insert(orderItems).values({
        ...item,
        id: itemId,
        orderId: newOrder.id,
        status: "pending"
      }).returning();

      // Create initial item status history
      await storage.itemHistory(
        newOrderItem.id,
        "pending",
        "pending",
        "Order created"
      );

      // Deduct from online stock and total stock
      await db
        .update(sarees)
        .set({
          onlineStock: sql`${sarees.onlineStock} - ${item.quantity}`,
          totalStock: sql`${sarees.totalStock} - ${item.quantity}`,
        })
        .where(eq(sarees.id, item.sareeId));

      // Record stock movement (negative for deduction)
      await db.insert(stockMovements).values({
        sareeId: item.sareeId,
        quantity: -item.quantity,
        movementType: "sale",
        source: "online",
        orderRefId: newOrder.id,
        storeId: null,
      });

      // Check for low stock and create alert
      await storage.checkAndCreateStockAlert(item.sareeId);
      
      itemIndex++;
    }

    return newOrder;
  }
  async getOrders(userId: string): Promise<OrderWithItems[]> {
    const orderList = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    const result: OrderWithItems[] = [];

    for (const order of orderList) {
      const items = await db
        .select()
        .from(orderItems)
        .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(orderItems.orderId, order.id));

      result.push({
        ...order,
        items: items.map((row) => ({
          ...row.order_items,
          saree: {
            ...row.sarees,
            category: row.categories,
            color: row.colors,
            fabric: row.fabrics,
          },
        })),
      });
    }

    return result;
  }

  async getOrder(id: string): Promise<OrderWithItems | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const itemsRows = await db
      .select()
      .from(orderItems)
      .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(orderItems.orderId, order.id));
    const itemStatuses = await Promise.all(
      itemsRows.map(async (itemRow) => {
        const [latestStatus] = await db
          .select({ newStatus: itemStatusHistory.newStatus })
          .from(itemStatusHistory)
          .where(eq(itemStatusHistory.orderItemId, itemRow.order_items.id))
          .orderBy(desc(itemStatusHistory.createdAt))
          .limit(1);

        return {
          orderItemId: itemRow.order_items.id,
          currentStatus: latestStatus?.newStatus ?? itemRow.order_items.status,
        };
      })
    );
    return {
      ...order,
      items: itemsRows.map((row) => {
        const statusObj = itemStatuses.find((s) => s.orderItemId === row.order_items.id);
        return {
          ...row.order_items,
          status: row.order_items.status,
          currentStatus: statusObj?.currentStatus || row.order_items.status,
          saree: {
            ...row.sarees,
            category: row.categories,
            color: row.colors,
            fabric: row.fabrics,
          },
        };
      }),
    };
  }

  async updateItemStatus(
    orderItemId: string,
    status: string,
    updatedBy?: string,
    note?: string
  ): Promise<any | undefined> {
    return await db.transaction(async (tx) => {
      // Get current item status
      const [currentItem] = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, orderItemId));

      if (!currentItem) return undefined;

      // Update item status
      const [updatedItem] = await tx
        .update(orderItems)
        .set({
          status: status as any,
          updatedAt: new Date(),
          ...(status === "shipped" && { shippedAt: new Date() }),
          ...(status === "delivered" && { deliveredAt: new Date() }),
        })
        .where(eq(orderItems.id, orderItemId))
        .returning();

      // Create status history record
      await storage.itemHistory(
        orderItemId,
        currentItem.status,
        status,
        note || `Status updated to ${status}`,
        updatedBy
      );

      // Create notification for user if this is a significant status change
      let notificationMessage = "";
      switch (status) {
        case "confirmed":
          notificationMessage = "An item in your order has been confirmed and is being processed.";
          break;
        case "processing":
          notificationMessage = "An item in your order is being prepared for shipment.";
          break;
        case "shipped":
          notificationMessage = "An item in your order has been shipped!";
          break;
        case "delivered":
          notificationMessage = "An item in your order has been delivered.";
          break;
        case "cancelled":
          notificationMessage = "An item in your order has been cancelled.";
          break;
      }

      if (notificationMessage) {
        // Get order to find userId for notification
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, currentItem.orderId));

        if (order) {
          await storage.createNotification({
            userId: order.userId,
            type: "order",
            title: `Item ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: notificationMessage,
            relatedId: currentItem.orderId,
            relatedType: "order",
          });
        }
      }

      return updatedItem;
    });
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
    updatedBy?: string,
    note?: string
  ): Promise<any | undefined> {
    return await db.transaction(async (tx) => {
      // Get current order status
      const [currentOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId));

      if (!currentOrder) return undefined;

      // Update order status
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: status as any,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      return updatedOrder;
    });
  }
}

export const orderService = new OrderRepository();
