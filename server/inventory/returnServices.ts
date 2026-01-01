import {
  ReturnRequestWithDetails,
  returnRequests,
  returnItems,
  orderItems,
  sarees,
  categories,
  colors,
  fabrics,
  refunds,
  InsertReturnRequest,
  InsertReturnItem,
  ReturnRequest,
  orders,
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { userService } from "server/auth/authStorage";
import { db } from "server/db";
import { orderService } from "server/order/orderStorage";
import { storage } from "server/storage";

interface IStorage {
  // Return Requests
  getReturnRequests(filters?: {
    userId?: string;
    status?: string;
  }): Promise<ReturnRequestWithDetails[]>;
  getReturnRequest(id: string): Promise<ReturnRequestWithDetails | undefined>;
  createReturnRequest(
    request: InsertReturnRequest,
    items: InsertReturnItem[]
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
  ): Promise<{
    itemId: string;
    eligible: boolean;
    reason?: string;
    remainingDays?: number;
  }[]>;


}

export class ReturnRepo implements IStorage {
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

  // Return Requests
  async getReturnRequests(filters?: {
    userId?: string;
    status?: string;
  }): Promise<ReturnRequestWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.userId)
      conditions.push(eq(returnRequests.userId, filters.userId));
    if (filters?.status)
      conditions.push(eq(returnRequests.status, filters.status as any));

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
    items: InsertReturnItem[]
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
  ): Promise<
    { itemId: string; eligible: boolean; reason?: string; remainingDays?: number }[]
  > {
    const order = await orderService.getOrder(orderId);

    if (!order) {
      return [
        {
          itemId: "",
          eligible: false,
          reason: "Order not found",
        },
      ];
    }

    const returnedByItem = await this.getReturnedQuantitiesByOrderItem(orderId);

    const windowDays = await storage.getSetting("return_window_days");
    const days = windowDays ? parseInt(windowDays) : 7;

    const now = new Date();

    return order.items.map((item: any) => {
      if (!item.deliveredAt) {
        return {
          itemId: item.id,
          eligible: false,
          reason: "Item delivery date missing",
        };
      }

      const deliveredAt = new Date(item.deliveredAt);
      const eligibleUntil = new Date(deliveredAt);
      eligibleUntil.setDate(eligibleUntil.getDate() + days);

      if (now > eligibleUntil) {
        return {
          itemId: item.id,
          eligible: false,
          reason: "Return window has expired",
        };
      }

      const purchasedQty = Number(item.quantity || 0);
      const returnedQty = Number(returnedByItem[String(item.id)] || 0);
      const hasRemaining = purchasedQty > returnedQty;

      return {
        itemId: item.id,
        eligible: hasRemaining,
        reason: !hasRemaining
          ? "All items in this order have already been returned or exchanged"
          : undefined,
        remainingDays: hasRemaining
          ? Math.max(
            0,
            Math.floor((eligibleUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          )
          : 0,
      };
    });
  }


}

export const returnService = new ReturnRepo();