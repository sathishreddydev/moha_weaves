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
} from "@shared/schema";

export interface OrderStorage {
  createOrder(
    order: InsertOrder,
    items: Omit<InsertOrderItem, "orderId">[]
  ): Promise<Order>;
  getOrders(userId: string): Promise<OrderWithItems[]>;
  getOrder(id: string): Promise<OrderWithItems | undefined>;
}

export class OrderRepository implements OrderStorage {
  async createOrder(
    order: InsertOrder,
    items: Omit<InsertOrderItem, "orderId">[]
  ): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();

    for (const item of items) {
      await db.insert(orderItems).values({ ...item, orderId: newOrder.id });

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

    const items = await db
      .select()
      .from(orderItems)
      .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(orderItems.orderId, order.id));

    return {
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
    };
  }
}

export const orderService = new OrderRepository();
