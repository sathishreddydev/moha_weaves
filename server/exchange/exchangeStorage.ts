import {
  returnRequests,
  returnItems,
  orderItems,
  sarees,
  categories,
  colors,
  fabrics,
  orders,
  users,
  InsertReturnRequest,
  InsertReturnItem,
  ReturnRequest,
  returnStatusEnum,
  returnReasonEnum,
  returnResolutionEnum
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { orderService } from "../order/orderStorage";
import { userService } from "../auth/authStorage";

export type ExchangeRequestWithDetails = ReturnRequest & {
  order: any;
  user: any;
  items: (any & {
    orderItem: {
      saree: any;
    };
  })[];
};

export interface IExchangeStorage {
  getExchangeRequests(filters?: {
    userId?: string;
    status?: string;
    resolution?: string;
  }): Promise<ExchangeRequestWithDetails[]>;
  getExchangeRequest(id: string): Promise<ExchangeRequestWithDetails | undefined>;
  createExchangeRequest(
    request: InsertReturnRequest,
    items: Omit<InsertReturnItem, 'returnRequestId'>[]
  ): Promise<ReturnRequest>;
  updateExchangeRequestStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string,
    exchangeOrderId?: string
  ): Promise<ReturnRequest | undefined>;
  updateExchangeRequest(
    id: string,
    data: Partial<InsertReturnRequest>
  ): Promise<ReturnRequest | undefined>;
  getUserExchangeRequests(userId: string): Promise<ExchangeRequestWithDetails[]>;
  checkOrderExchangeEligibility(
    orderId: string
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number }>;
  getOrder(orderId: string): Promise<any>;
  getStoreExchanges(filters?: {
    status?: string;
    storeId?: string;
  }): Promise<any[]>;
  getStoreExchange(id: string): Promise<any | undefined>;
  createStoreExchange(
    exchangeData: any,
    returnItems: any[],
    newItems: any[]
  ): Promise<any>;
  updateStoreExchangeStatus(id: string, status: string): Promise<any | undefined>;
}

export class ExchangeStorage implements IExchangeStorage {
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

  private async getExchangedQuantitiesByOrderItem(
    orderId: string
  ): Promise<Record<string, number>> {
    const rows = await db
      .select({
        orderItemId: returnItems.orderItemId,
        qty: sql<number>`sum(${returnItems.quantity})::int`,
      })
      .from(returnItems)
      .innerJoin(
        returnRequests,
        eq(returnItems.returnRequestId, returnRequests.id)
      )
      .where(
        and(
          eq(returnRequests.orderId, orderId),
          eq(returnRequests.resolution, "exchange"),
          inArray(returnRequests.status, [...this.activeExchangeStatuses])
        )
      )
      .groupBy(returnItems.orderItemId);

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[String(row.orderItemId)] = Number(row.qty || 0);
    }
    return map;
  }

  async getExchangeRequests(filters?: {
    userId?: string;
    status?: string;
    resolution?: string;
  }): Promise<ExchangeRequestWithDetails[]> {
    const conditions: any[] = [
      eq(returnRequests.resolution, "exchange")
    ];
    if (filters?.userId)
      conditions.push(eq(returnRequests.userId, filters.userId));
    if (filters?.status)
      conditions.push(eq(returnRequests.status, filters.status as any));
    if (filters?.resolution)
      conditions.push(eq(returnRequests.resolution, filters.resolution as any));

    const requests = await db
      .select()
      .from(returnRequests)
      .where(and(...conditions))
      .orderBy(desc(returnRequests.createdAt));

    const result: ExchangeRequestWithDetails[] = [];
    for (const request of requests) {
      const orderWithItems = await orderService.getOrder(request.orderId);
      const user = await userService.getUser(request.userId);
      const items = await db
        .select()
        .from(returnItems)
        .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
        .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(returnItems.returnRequestId, request.id));

      if (orderWithItems && user) {
        result.push({
          ...request,
          order: orderWithItems,
          user,
          items: items.map((item) => ({
            ...item.return_items,
            orderItem: {
              ...item.order_items,
              saree: {
                ...item.sarees,
                category: item.categories,
                color: item.colors,
                fabric: item.fabrics,
              },
            },
          })),
        });
      }
    }
    return result;
  }

  async getExchangeRequest(
    id: string
  ): Promise<ExchangeRequestWithDetails | undefined> {
    const [request] = await db
      .select()
      .from(returnRequests)
      .where(and(eq(returnRequests.id, id), eq(returnRequests.resolution, "exchange")));
    if (!request) return undefined;

    const orderWithItems = await orderService.getOrder(request.orderId);
    const user = await userService.getUser(request.userId);
    if (!orderWithItems || !user) return undefined;

    const items = await db
      .select()
      .from(returnItems)
      .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
      .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(returnItems.returnRequestId, request.id));

    return {
      ...request,
      order: orderWithItems,
      user,
      items: items.map((item) => ({
        ...item.return_items,
        orderItem: {
          ...item.order_items,
          saree: {
            ...item.sarees,
            category: item.categories,
            color: item.colors,
            fabric: item.fabrics,
          },
        },
      })),
    };
  }

  async createExchangeRequest(
    request: InsertReturnRequest,
    items: Omit<InsertReturnItem, 'returnRequestId'>[]
  ): Promise<ReturnRequest> {
    return await db.transaction(async (tx) => {
      const [newRequest] = await tx
        .insert(returnRequests)
        .values({ ...request, resolution: "exchange" })
        .returning();

      for (const item of items) {
        await tx.insert(returnItems).values({
          ...item,
          returnRequestId: newRequest.id,
        });
      }

      return newRequest;
    });
  }

  async updateExchangeRequestStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string,
    exchangeOrderId?: string
  ): Promise<ReturnRequest | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (processedBy) updateData.processedBy = processedBy;
    if (inspectionNotes) updateData.inspectionNotes = inspectionNotes;
    if (exchangeOrderId) updateData.exchangeOrderId = exchangeOrderId;

    const [result] = await db
      .update(returnRequests)
      .set(updateData)
      .where(and(eq(returnRequests.id, id), eq(returnRequests.resolution, "exchange")))
      .returning();
    return result || undefined;
  }

  async updateExchangeRequest(
    id: string,
    data: Partial<InsertReturnRequest>
  ): Promise<ReturnRequest | undefined> {
    const [result] = await db
      .update(returnRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(returnRequests.id, id), eq(returnRequests.resolution, "exchange")))
      .returning();
    return result || undefined;
  }

  async getUserExchangeRequests(
    userId: string
  ): Promise<ExchangeRequestWithDetails[]> {
    return this.getExchangeRequests({ userId });
  }

  async checkOrderExchangeEligibility(
    orderId: string
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number }> {
    const order = await orderService.getOrder(orderId);
    if (!order) return { eligible: false, reason: "Order not found" };
    if (order.status !== "delivered")
      return {
        eligible: false,
        reason: "Order must be delivered to initiate exchange",
      };

    let eligibleUntil: Date;
    // Handle missing return window - calculate from deliveredAt if available
    if (!order.returnEligibleUntil) {
      if (order.deliveredAt) {
        // Get return window setting, default to 7 days
        const windowDays = 7; // Default value, could be from settings
        eligibleUntil = new Date(order.deliveredAt);
        eligibleUntil.setDate(eligibleUntil.getDate() + windowDays);

        // Update the order with the calculated return window
        await db
          .update(orders)
          .set({ returnEligibleUntil: eligibleUntil })
          .where(eq(orders.id, orderId));
      } else {
        return {
          eligible: false,
          reason: "Exchange window not set - order delivery date missing",
        };
      }
    } else {
      eligibleUntil = new Date(order.returnEligibleUntil);
    }

    const now = new Date();
    if (now > eligibleUntil) {
      return { eligible: false, reason: "Exchange window has expired" };
    }

    // Compute remaining days (floor to whole days)
    const remainingMs = eligibleUntil.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));

    // Eligible if at least one order item still has remaining quantity not already covered by active exchanges
    const exchangedByItem = await this.getExchangedQuantitiesByOrderItem(orderId);
    const hasRemaining = order.items.some((item: any) => {
      const purchasedQty = Number(item.quantity || 0);
      const exchangedQty = Number(exchangedByItem[String(item.id)] || 0);
      return purchasedQty > exchangedQty;
    });
    if (!hasRemaining) {
      return { eligible: false, reason: "All items in this order have already been exchanged or returned", remainingDays };
    }

    return { eligible: true, remainingDays };
  }

  async getOrder(orderId: string): Promise<any> {
    return await orderService.getOrder(orderId);
  }

  // Store exchange methods
  async getStoreExchanges(filters?: {
    status?: string;
    storeId?: string;
  }): Promise<any[]> {
    // This would be implemented when store exchange tables are properly set up
    // For now, return empty array
    return [];
  }

  async getStoreExchange(id: string): Promise<any | undefined> {
    // This would be implemented when store exchange tables are properly set up
    return undefined;
  }

  async createStoreExchange(
    exchangeData: any,
    returnItems: any[],
    newItems: any[]
  ): Promise<any> {
    // This would be implemented when store exchange tables are properly set up
    throw new Error("Store exchange functionality not yet implemented");
  }

  async updateStoreExchangeStatus(id: string, status: string): Promise<any | undefined> {
    // This would be implemented when store exchange tables are properly set up
    return undefined;
  }
}

export const exchangeStorage = new ExchangeStorage();