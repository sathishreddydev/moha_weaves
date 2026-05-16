import {
  categories,
  colors,
  fabrics,
  InsertOnlineExchange,
  InsertOnlineExchangeItem,
  notifications,
  OnlineExchange,
  onlineExchangeItems,
  onlineExchanges,
  orderItems,
  orders,
  products,
  productVariants,
  stockMovements
} from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { userService } from "../auth/authStorage";
import { db } from "../db";
import { orderService } from "../order/orderStorage";
import { storage } from "../storage";

export type OnlineExchangeWithDetails = OnlineExchange & {
  order: any;
  user: any;
  items: (any & {
    orderItem: {
      product: any;
    };
  })[];

};

export interface IOnlineExchangeStorage {
  getOnlineExchanges(filters?: {
    userId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<OnlineExchangeWithDetails[] | {
    data: OnlineExchangeWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
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

// Fix 6: Status transition guard
const EXCHANGE_TRANSITIONS: Record<string, string[]> = {
  exchange_requested:        ["exchange_approved", "exchange_cancelled"],
  exchange_approved:         ["exchange_processing", "exchange_cancelled"],
  exchange_processing:       ["exchange_pickup_scheduled", "exchange_cancelled"],
  exchange_pickup_scheduled: ["exchange_picked_up", "exchange_cancelled"],
  exchange_picked_up:        ["exchange_in_transit", "exchange_cancelled"],
  exchange_in_transit:       ["exchange_received", "exchange_cancelled"],
  exchange_received:         ["exchange_inspected", "exchange_cancelled"],
  exchange_inspected:        ["exchange_shipped", "exchange_cancelled"],
  exchange_shipped:          ["exchange_delivered"],
  exchange_delivered:        ["exchange_completed"],
  exchange_completed:        [],
  exchange_cancelled:        [],
};

export { EXCHANGE_TRANSITIONS };

export class OnlineExchangeStorage implements IOnlineExchangeStorage {
  // Fix 1: Use correct DB enum values (with "exchange_" prefix)
  // Fix 9: Exclude exchange_cancelled from active statuses
  private readonly activeExchangeStatuses = [
    "exchange_requested",
    "exchange_approved",
    "exchange_processing",
    "exchange_pickup_scheduled",
    "exchange_picked_up",
    "exchange_in_transit",
    "exchange_received",
    "exchange_inspected",
    "exchange_shipped",
    "exchange_delivered",
    "exchange_completed",
  ] as const;

  async getOnlineExchanges(filters?: {
    userId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<OnlineExchangeWithDetails[] | {
    data: OnlineExchangeWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
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
      const orderWithItems = await orderService.getOrder(exchange.orderId, "admin");
      const user = await userService.getUser(exchange.userId);
      const items = await db
        .select()
        .from(onlineExchangeItems)
        .innerJoin(orderItems, eq(onlineExchangeItems.orderItemId, orderItems.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
        .where(eq(onlineExchangeItems.exchangeId, exchange.id));

      if (orderWithItems && user) {
        result.push({
          ...exchange,
          order: orderWithItems,
          user,
          items: items.map((item) => {
            const { ...itemWithoutId } = item.online_exchange_items;
            return {
              ...itemWithoutId,
              orderItem: {
                ...item.order_items,
                product: {
                  ...item.products,
                  category: item.categories,
                  color: item.colors,
                  fabric: item.fabrics,
                  variants: item.product_variants ? [item.product_variants] : undefined,
                },
              },
            };
          }),
        });
      }
    }

    // Apply search filter if provided
    let filteredExchanges = result;
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredExchanges = result.filter(exchange => 
        exchange.id.toLowerCase().includes(searchTerm) ||
        exchange.orderId.toLowerCase().includes(searchTerm) ||
        (exchange.user?.name && exchange.user.name.toLowerCase().includes(searchTerm)) ||
        (exchange.user?.email && exchange.user.email.toLowerCase().includes(searchTerm))
      );
    }

    // Apply date filters if provided
    if (filters?.dateFrom || filters?.dateTo) {
      filteredExchanges = filteredExchanges.filter(exchange => {
        const createdAt = new Date(exchange.createdAt);
        if (filters?.dateFrom && createdAt < new Date(filters.dateFrom)) return false;
        if (filters?.dateTo && createdAt > new Date(filters.dateTo)) return false;
        return true;
      });
    }

    // Return paginated response if page and pageSize are provided
    if (filters?.page && filters?.pageSize) {
      const offset = (filters.page - 1) * filters.pageSize;
      const paginatedExchanges = filteredExchanges.slice(offset, offset + filters.pageSize);
      
      return {
        data: paginatedExchanges,
        total: filteredExchanges.length,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(filteredExchanges.length / filters.pageSize)
      };
    }

    return filteredExchanges;
  }

  // Fix 5: Add productVariants join and include variants in mapped result
  async getOnlineExchange(
    id: string
  ): Promise<OnlineExchangeWithDetails | undefined> {
    const [exchange] = await db
      .select()
      .from(onlineExchanges)
      .where(eq(onlineExchanges.id, id));
    if (!exchange) return undefined;

    const orderWithItems = await orderService.getOrder(exchange.orderId, "admin");
    const user = await userService.getUser(exchange.userId);
    if (!orderWithItems || !user) return undefined;

    const items = await db
      .select()
      .from(onlineExchangeItems)
      .innerJoin(orderItems, eq(onlineExchangeItems.orderItemId, orderItems.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(eq(onlineExchangeItems.exchangeId, exchange.id));

    return {
      ...exchange,
      order: orderWithItems,
      user,
      items: items.map((item) => {
        const { ...itemWithoutId } = item.online_exchange_items;
        return {
          ...itemWithoutId,
          orderItem: {
            ...item.order_items,
            product: {
              ...item.products,
              category: item.categories,
              color: item.colors,
              fabric: item.fabrics,
              variants: item.product_variants ? [item.product_variants] : undefined,
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
        // Fix 4: Read the actual current status before updating (fetch current item status)
        const [currentItem] = await tx
          .select({ status: orderItems.status })
          .from(orderItems)
          .where(eq(orderItems.id, item.orderItemId));

        const previousStatus = currentItem?.status ?? "delivered";

        await tx
          .update(orderItems)
          .set({
            status: "exchange_requested",
            updatedAt: new Date(),
          })
          .where(eq(orderItems.id, item.orderItemId));

        // Create item status history
        await storage.itemHistory(
          item.orderItemId,
          previousStatus, // Fix 4: use actual previous status
          "exchange_requested",
          "Online exchange created",
          exchange.userId
        );
      }

      return newExchange;
    });
  }

  async updateOnlineExchangeStatus(
    id: string,
    status: any,
    processedBy?: string,
    inspectionNotes?: string,
    exchangeOrderId?: string
  ): Promise<OnlineExchange | undefined> {
    return await db.transaction(async (tx) => {
      // Fix 6: Enforce status transition guard
      const [current] = await tx
        .select({ status: onlineExchanges.status })
        .from(onlineExchanges)
        .where(eq(onlineExchanges.id, id));

      if (!current) return undefined;

      const allowed = EXCHANGE_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(status)) {
        throw new Error(
          `Invalid status transition: cannot move from "${current.status}" to "${status}"`
        );
      }

      const updateData: any = { status, updatedAt: new Date() };
      if (processedBy) updateData.processedBy = processedBy;
      // Fix 3: Save inspectionNotes even when empty string
      if (inspectionNotes !== undefined) updateData.inspectionNotes = inspectionNotes;
      if (exchangeOrderId) updateData.exchangeOrderId = exchangeOrderId;

      const [result] = await tx
        .update(onlineExchanges)
        .set(updateData)
        .where(eq(onlineExchanges.id, id))
        .returning();

      if (!result) return undefined;

      const onlineExchange = await this.getOnlineExchange(id);
      if (!onlineExchange) return result;

      // Map exchange status to order item status
      const statusMap: Record<string, string> = {
        exchange_requested: "exchange_requested",
        exchange_approved: "exchange_approved",
        exchange_processing: "exchange_processing",
        exchange_pickup_scheduled: "exchange_pickup_scheduled",
        exchange_picked_up: "exchange_picked_up",
        exchange_in_transit: "exchange_in_transit",
        exchange_received: "exchange_received",
        exchange_inspected: "exchange_inspected",
        exchange_shipped: "exchange_shipped",
        exchange_delivered: "exchange_delivered",
        exchange_completed: "exchange_completed",
        exchange_cancelled: "exchange_cancelled",
      };

      for (const item of onlineExchange.items) {
        const newItemStatus = statusMap[status] || "exchange_requested";
        await tx.update(orderItems).set({
          status: newItemStatus as any,
          updatedAt: new Date(),
        }).where(eq(orderItems.id, item.orderItemId));

        await storage.itemHistory(
          item.orderItemId,
          item.orderItem.status,
          newItemStatus,
          `Exchange request ${status}`,
          processedBy
        );
      }

      // Fix 8: Send notification once, outside the item loop
      await tx.insert(notifications).values({
        userId: onlineExchange.userId,
        type: "order",
        title: "Online Exchange Update",
        message: `Your online exchange request for order #${String(onlineExchange.orderId)} has been updated to "${String(status)}".`,
        relatedId: onlineExchange.orderId,
        createdAt: new Date(),
      });

      // Only fire stock movements when status === "exchange_completed"
      if (status === "exchange_completed") {
        for (const item of onlineExchange.items) {
          // ── Returned item: restore stock columns + record movement ──────────
          if (item.isRestockable) {
            // Update actual product stock columns (same as return path)
            await storage.restoreStockFromReturn(
              item.orderItem.product.id,
              item.quantity,
              onlineExchange.orderId,
            );
          }

          // ── Replacement item: deduct stock columns + record movement ────────
          if (item.exchangeproductId) {
            // Deduct online_stock and total_stock on the replacement product
            await tx
              .update(products)
              .set({
                onlineStock: sql`${products.onlineStock} - ${item.quantity}`,
                totalStock: sql`${products.totalStock} - ${item.quantity}`,
              })
              .where(eq(products.id, item.exchangeproductId));

            // Record the outbound stock movement for the replacement
            await tx.insert(stockMovements).values({
              productId: item.exchangeproductId,
              quantity: -item.quantity,
              movementType: "sale",
              source: "online",
              orderRefId: onlineExchange.orderId,
              createdAt: new Date(),
            });

            // Alert if replacement product stock is now low
            await storage.checkAndCreateStockAlert(item.exchangeproductId);
          }
        }
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
    const result = await this.getOnlineExchanges({ userId });
    return Array.isArray(result) ? result : result.data || [];
  }

  async checkOrderOnlineExchangeEligibility(
    orderId: string,
    orderItemIds?: string[]
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number; eligibleItems?: string[] }> {
    const order = await orderService.getOrder(orderId, "admin");
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
          return { eligible: false, reason: `Item ${orderItem.product.name} must be delivered to initiate exchange` };
        }

        // Check if this item has already been exchanged
        const existingExchange = await this.getExchangedQuantityByOrderItem(orderItemId);
        const purchasedQty = Number(orderItem.quantity || 0);
        const exchangedQty = Number(existingExchange || 0);

        if (purchasedQty <= exchangedQty) {
          return { eligible: false, reason: `Item ${orderItem.product.name} has already been fully exchanged` };
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

  // Fix 1 & 9: Use correct DB enum values; exclude exchange_cancelled
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
          inArray(onlineExchanges.status, [
            "exchange_requested",
            "exchange_approved",
            "exchange_processing",
            "exchange_pickup_scheduled",
            "exchange_picked_up",
            "exchange_in_transit",
            "exchange_received",
            "exchange_inspected",
            "exchange_shipped",
            "exchange_delivered",
            "exchange_completed",
            // exchange_cancelled intentionally excluded (fix 9)
          ])
        )
      );

    return Number(result[0]?.qty || 0);
  }
}

export const onlineExchangeStorage = new OnlineExchangeStorage();
