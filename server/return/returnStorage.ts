import {
  returnRequests,
  returnItems,
  orderItems,
  sarees,
  categories,
  colors,
  fabrics,
  refunds,
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

export type ReturnRequestWithDetails = ReturnRequest & {
  order: any;
  user: any;
  items: (any & {
    orderItem: {
      saree: any;
    };
  })[];
  refund?: any;
};

export interface IReturnStorage {
  getReturnRequests(filters?: {
    userId?: string;
    status?: string;
    reason?: string;
    resolution?: string;
  }): Promise<ReturnRequestWithDetails[]>;
  getReturnRequest(id: string): Promise<ReturnRequestWithDetails | undefined>;
  createReturnRequest(
    request: InsertReturnRequest,
    items: Omit<InsertReturnItem, 'returnRequestId'>[]
  ): Promise<ReturnRequest>;
  updateReturnRequestStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string
  ): Promise<ReturnRequest | undefined>;
  updateReturnRequest(
    id: string,
    data: Partial<InsertReturnRequest>
  ): Promise<ReturnRequest | undefined>;
  getUserReturnRequests(userId: string): Promise<ReturnRequestWithDetails[]>;
  checkOrderReturnEligibility(
    orderId: string
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number }>;
  getOrder(orderId: string): Promise<any>;
}

export class ReturnStorage implements IReturnStorage {
  private readonly activeReturnStatuses = [
    "requested",
    "approved",
    "pickup_scheduled",
    "picked_up",
    "in_transit",
    "received",
    "inspected",
    "completed",
  ] as const;

  private async getReturnedQuantitiesByOrderItem(
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
          inArray(returnRequests.status, [...this.activeReturnStatuses])
        )
      )
      .groupBy(returnItems.orderItemId);

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[String(row.orderItemId)] = Number(row.qty || 0);
    }
    return map;
  }

  async getReturnRequests(filters?: {
    userId?: string;
    status?: string;
    reason?: string;
    resolution?: string;
  }): Promise<ReturnRequestWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.userId)
      conditions.push(eq(returnRequests.userId, filters.userId));
    if (filters?.status)
      conditions.push(eq(returnRequests.status, filters.status as any));
    if (filters?.reason)
      conditions.push(eq(returnRequests.reason, filters.reason as any));
    if (filters?.resolution)
      conditions.push(eq(returnRequests.resolution, filters.resolution as any));

    const requests = await db
      .select()
      .from(returnRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(returnRequests.createdAt));

    const result: ReturnRequestWithDetails[] = [];
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

      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.returnRequestId, request.id));

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
          refund: refund || undefined,
        });
      }
    }
    return result;
  }

  async getReturnRequest(
    id: string
  ): Promise<ReturnRequestWithDetails | undefined> {
    const [request] = await db
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.id, id));
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

    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.returnRequestId, request.id));

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
      refund: refund || undefined,
    };
  }

  async createReturnRequest(
    request: InsertReturnRequest,
    items: Omit<InsertReturnItem, 'returnRequestId'>[]
  ): Promise<ReturnRequest> {
    return await db.transaction(async (tx) => {
      const [newRequest] = await tx
        .insert(returnRequests)
        .values(request)
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

  async updateReturnRequestStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string
  ): Promise<ReturnRequest | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (processedBy) updateData.processedBy = processedBy;
    if (inspectionNotes) updateData.inspectionNotes = inspectionNotes;

    const [result] = await db
      .update(returnRequests)
      .set(updateData)
      .where(eq(returnRequests.id, id))
      .returning();
    return result || undefined;
  }

  async updateReturnRequest(
    id: string,
    data: Partial<InsertReturnRequest>
  ): Promise<ReturnRequest | undefined> {
    const [result] = await db
      .update(returnRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(returnRequests.id, id))
      .returning();
    return result || undefined;
  }

  async getUserReturnRequests(
    userId: string
  ): Promise<ReturnRequestWithDetails[]> {
    return this.getReturnRequests({ userId });
  }

  async checkOrderReturnEligibility(
    orderId: string
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number }> {
    const order = await orderService.getOrder(orderId);
    if (!order) return { eligible: false, reason: "Order not found" };
    if (order.status !== "delivered")
      return {
        eligible: false,
        reason: "Order must be delivered to initiate return",
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
          reason: "Return window not set - order delivery date missing",
        };
      }
    } else {
      eligibleUntil = new Date(order.returnEligibleUntil);
    }

    const now = new Date();
    if (now > eligibleUntil) {
      return { eligible: false, reason: "Return window has expired" };
    }

    // Compute remaining days (floor to whole days)
    const remainingMs = eligibleUntil.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));

    // Eligible if at least one order item still has remaining quantity not already covered by active returns
    const returnedByItem = await this.getReturnedQuantitiesByOrderItem(orderId);
    const hasRemaining = order.items.some((item: any) => {
      const purchasedQty = Number(item.quantity || 0);
      const returnedQty = Number(returnedByItem[String(item.id)] || 0);
      return purchasedQty > returnedQty;
    });
    if (!hasRemaining) {
      return { eligible: false, reason: "All items in this order have already been returned or exchanged", remainingDays };
    }

    return { eligible: true, remainingDays };
  }

  async getOrder(orderId: string): Promise<any> {
    return await orderService.getOrder(orderId);
  }
}

export const returnStorage = new ReturnStorage();
