import {
  onlineExchanges,
  onlineExchangeItems,
  orderItems,
  sarees,
  categories,
  colors,
  fabrics,
  orders,
  users,
  stockMovements,
  notifications,
  itemStatusHistory,
  OnlineExchange,
  InsertOnlineExchange,
  OnlineExchangeItem,
  InsertOnlineExchangeItem,
  onlineExchangeStatusEnum,
  returnReasonEnum
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { orderService } from "../order/orderStorage";
import { userService } from "../auth/authStorage";

export type OnlineExchangeWithDetails = OnlineExchange & {
  order: any;
  user: any;
  items: (Omit<OnlineExchangeItem, 'id'> & {
    orderItem: {
      saree: any;
    };
  })[];
};

export interface IOnlineExchangeStorage {
  getOnlineExchanges(filters?: {
    userId?: string;
    status?: string;
  }): Promise<OnlineExchangeWithDetails[]>;
  getOnlineExchange(id: string): Promise<OnlineExchangeWithDetails | undefined>;
  createOnlineExchange(
    exchange: InsertOnlineExchange,
    items: Omit<InsertOnlineExchangeItem, 'exchangeId'>[]
  ): Promise<OnlineExchange>;
  updateOnlineExchangeStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string,
    exchangeOrderId?: string
  ): Promise<OnlineExchange | undefined>;
  updateOnlineExchange(
    id: string,
    data: Partial<InsertOnlineExchange>
  ): Promise<OnlineExchange | undefined>;
  getUserOnlineExchanges(userId: string): Promise<OnlineExchangeWithDetails[]>;
  checkOrderOnlineExchangeEligibility(
    orderId: string,
    orderItemIds?: string[]
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number; eligibleItems?: string[] }>;
}

export class OnlineExchangeStorage implements IOnlineExchangeStorage {
  private readonly activeExchangeStatuses = [
    "requested",
    "approved", 
    "pickup_scheduled",
    "picked_up",
    "in_transit",
    "received",
    "inspected",
    "completed",
  ] as const;

  async getOnlineExchanges(filters?: {
    userId?: string;
    status?: string;
  }): Promise<OnlineExchangeWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.userId)
      conditions.push(eq(onlineExchanges.userId, filters.userId));
    if (filters?.status)
      conditions.push(eq(onlineExchanges.status, filters.status as any));

    const exchanges = await db
      .select()
      .from(onlineExchanges)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(onlineExchanges.createdAt));

    const result: OnlineExchangeWithDetails[] = [];
    for (const exchange of exchanges) {
      const orderWithItems = await orderService.getOrder(exchange.orderId);
      const user = await userService.getUser(exchange.userId);
      const items = await db
        .select()
        .from(onlineExchangeItems)
        .innerJoin(orderItems, eq(onlineExchangeItems.orderItemId, orderItems.id))
        .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(onlineExchangeItems.exchangeId, exchange.id));

      if (orderWithItems && user) {
        result.push({
          ...exchange,
          order: orderWithItems,
          user,
          items: items.map((item) => {
            const { id: itemId, ...itemWithoutId } = item.online_exchange_items;
            return {
              ...itemWithoutId,
              orderItem: {
                ...item.order_items,
                saree: {
                  ...item.sarees,
                  category: item.categories,
                  color: item.colors,
                  fabric: item.fabrics,
                },
              },
            };
          }),
        });
      }
    }
    return result;
  }

  async getOnlineExchange(
    id: string
  ): Promise<OnlineExchangeWithDetails | undefined> {
    const [exchange] = await db
      .select()
      .from(onlineExchanges)
      .where(eq(onlineExchanges.id, id));
    if (!exchange) return undefined;

    const orderWithItems = await orderService.getOrder(exchange.orderId);
    const user = await userService.getUser(exchange.userId);
    if (!orderWithItems || !user) return undefined;

    const items = await db
      .select()
      .from(onlineExchangeItems)
      .innerJoin(orderItems, eq(onlineExchangeItems.orderItemId, orderItems.id))
      .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(onlineExchangeItems.exchangeId, exchange.id));

    return {
      ...exchange,
      order: orderWithItems,
      user,
      items: items.map((item) => {
        const { id: itemId, ...itemWithoutId } = item.online_exchange_items;
        return {
          ...itemWithoutId,
          orderItem: {
            ...item.order_items,
            saree: {
              ...item.sarees,
              category: item.categories,
              color: item.colors,
              fabric: item.fabrics,
            },
          },
        };
      }),
    };
  }

  async createOnlineExchange(
    exchange: InsertOnlineExchange,
    items: Omit<InsertOnlineExchangeItem, 'exchangeId'>[]
  ): Promise<OnlineExchange> {
    return await db.transaction(async (tx) => {
      const [newExchange] = await tx
        .insert(onlineExchanges)
        .values(exchange)
        .returning();

      for (const item of items) {
        await tx.insert(onlineExchangeItems).values({
          ...item,
          exchangeId: newExchange.id,
        });

        // Update item status to "exchange_requested"
        await tx
          .update(orderItems)
          .set({
            status: "exchange_requested",
            updatedAt: new Date(),
          })
          .where(eq(orderItems.id, item.orderItemId));

        // Create item status history
        await tx.insert(itemStatusHistory).values({
          orderItemId: item.orderItemId,
          status: "delivered", // Previous status
          newStatus: "exchange_requested",
          note: "Online exchange created",
          updatedBy: exchange.userId,
          createdAt: new Date(),
        });
      }

      return newExchange;
    });
  }

  async updateOnlineExchangeStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string,
    exchangeOrderId?: string
  ): Promise<OnlineExchange | undefined> {
    return await db.transaction(async (tx) => {
      const updateData: any = { status, updatedAt: new Date() };
      if (processedBy) updateData.processedBy = processedBy;
      if (inspectionNotes) updateData.inspectionNotes = inspectionNotes;
      if (exchangeOrderId) updateData.exchangeOrderId = exchangeOrderId;

      const [result] = await tx
        .update(onlineExchanges)
        .set(updateData)
        .where(eq(onlineExchanges.id, id))
        .returning();

      if (!result) return undefined;

      // Handle exchange completion logic
      if (status === "completed") {
        const onlineExchange = await this.getOnlineExchange(id);
        if (!onlineExchange) return result;

        // Update item-level status for exchanged items
        for (const item of onlineExchange.items) {
          await tx
            .update(orderItems)
            .set({
              status: "exchange_completed",
              updatedAt: new Date(),
            })
            .where(eq(orderItems.id, item.orderItemId));

          // Create item status history
          await tx.insert(itemStatusHistory).values({
            orderItemId: item.orderItemId,
            status: "delivered", // Previous status
            newStatus: "exchange_completed",
            note: "Online exchange completed",
            updatedBy: processedBy,
            createdAt: new Date(),
          });
        }

        // Handle inventory management for returned items
        for (const item of onlineExchange.items) {
          if (item.isRestockable) {
            // Add returned item back to stock
            await tx.insert(stockMovements).values({
              sareeId: item.orderItem.saree.id,
              quantity: item.quantity, // Positive quantity for stock addition
              movementType: "return",
              source: "online",
              orderRefId: onlineExchange.orderId,
              createdAt: new Date(),
            });
          }

          // Record stock movement for exchanged item (deduction)
          if (item.exchangeSareeId) {
            await tx.insert(stockMovements).values({
              sareeId: item.exchangeSareeId,
              quantity: -item.quantity, // Negative quantity for stock deduction
              movementType: "sale",
              source: "online",
              orderRefId: onlineExchange.orderId,
              createdAt: new Date(),
            });
          }
        }

        // Create customer notification
        await tx.insert(notifications).values({
          userId: onlineExchange.userId,
          type: "order",
          title: "Online Exchange Completed",
          message: `Your online exchange request for order #${onlineExchange.orderId} has been completed. Your exchanged items will be shipped soon.`,
          relatedId: onlineExchange.orderId,
          createdAt: new Date(),
        });
      }

      return result;
    });
  }

  async updateOnlineExchange(
    id: string,
    data: Partial<InsertOnlineExchange>
  ): Promise<OnlineExchange | undefined> {
    const [result] = await db
      .update(onlineExchanges)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onlineExchanges.id, id))
      .returning();
    return result || undefined;
  }

  async getUserOnlineExchanges(
    userId: string
  ): Promise<OnlineExchangeWithDetails[]> {
    return this.getOnlineExchanges({ userId });
  }

  async checkOrderOnlineExchangeEligibility(
    orderId: string,
    orderItemIds?: string[]
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number; eligibleItems?: string[] }> {
    const order = await orderService.getOrder(orderId);
    if (!order) return { eligible: false, reason: "Order not found" };

    // If specific order item IDs provided, check only those items
    if (orderItemIds && orderItemIds.length > 0) {
      const eligibleItems: string[] = [];
      
      for (const orderItemId of orderItemIds) {
        const orderItem = order.items.find((item: any) => item.id === orderItemId);
        if (!orderItem) {
          return { eligible: false, reason: `Order item ${orderItemId} not found` };
        }

        // Check if this specific item is delivered
        const isDelivered = orderItem.status === "delivered" ||
          orderItem.status === "exchange_completed" ||
          orderItem.status === "return_completed";

        if (!isDelivered) {
          return { eligible: false, reason: `Item ${orderItem.saree.name} must be delivered to initiate exchange` };
        }

        // Check if this item has already been exchanged
        const existingExchange = await this.getExchangedQuantityByOrderItem(orderItemId);
        const purchasedQty = Number(orderItem.quantity || 0);
        const exchangedQty = Number(existingExchange || 0);
        
        if (purchasedQty <= exchangedQty) {
          return { eligible: false, reason: `Item ${orderItem.saree.name} has already been fully exchanged` };
        }

        eligibleItems.push(orderItemId);
      }

      // Check overall order exchange window
      let eligibleUntil: Date;
      if (!order.returnEligibleUntil) {
        if (order.deliveredAt) {
          const windowDays = 7; // Default value, could be from settings
          eligibleUntil = new Date(order.deliveredAt);
          eligibleUntil.setDate(eligibleUntil.getDate() + windowDays);

          await db
            .update(orders)
            .set({ returnEligibleUntil: eligibleUntil })
            .where(eq(orders.id, orderId));
        } else {
          return {
            eligible: false,
            reason: "Online exchange window not set - order delivery date missing",
          };
        }
      } else {
        eligibleUntil = new Date(order.returnEligibleUntil);
      }

      const now = new Date();
      if (now > eligibleUntil) {
        return { eligible: false, reason: "Online exchange window has expired" };
      }

      const remainingMs = eligibleUntil.getTime() - now.getTime();
      const remainingDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));

      return { eligible: true, remainingDays, eligibleItems };
    }

    // Original logic for checking entire order (backward compatibility)
    const hasDeliveredItem = order.items.some((item: any) =>
      item.status === "delivered" ||
      item.status === "exchange_completed" ||
      item.status === "return_completed"
    );

    if (!hasDeliveredItem) {
      return {
        eligible: false,
        reason: "At least one item must be delivered to initiate online exchange",
      };
    }

    let eligibleUntil: Date;
    if (!order.returnEligibleUntil) {
      if (order.deliveredAt) {
        const windowDays = 7;
        eligibleUntil = new Date(order.deliveredAt);
        eligibleUntil.setDate(eligibleUntil.getDate() + windowDays);

        await db
          .update(orders)
          .set({ returnEligibleUntil: eligibleUntil })
          .where(eq(orders.id, orderId));
      } else {
        return {
          eligible: false,
          reason: "Online exchange window not set - order delivery date missing",
        };
      }
    } else {
      eligibleUntil = new Date(order.returnEligibleUntil);
    }

    const now = new Date();
    if (now > eligibleUntil) {
      return { eligible: false, reason: "Online exchange window has expired" };
    }

    const remainingMs = eligibleUntil.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));

    return { eligible: true, remainingDays };
  }

  // Helper method to get exchanged quantity for a specific order item
  private async getExchangedQuantityByOrderItem(
    orderItemId: string
  ): Promise<number> {
    const result = await db
      .select({
        qty: sql<number>`sum(${onlineExchangeItems.quantity})::int`,
      })
      .from(onlineExchangeItems)
      .innerJoin(
        onlineExchanges,
        eq(onlineExchangeItems.exchangeId, onlineExchanges.id)
      )
      .where(
        and(
          eq(onlineExchangeItems.orderItemId, orderItemId),
          inArray(onlineExchanges.status, ["requested", "approved", "pickup_scheduled", "picked_up", "in_transit", "received", "inspected"])
        )
      );

    return Number(result[0]?.qty || 0);
  }
}

export const onlineExchangeStorage = new OnlineExchangeStorage();
