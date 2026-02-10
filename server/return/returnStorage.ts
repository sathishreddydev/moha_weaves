import {
  returnRequests,
  returnItems,
  orderItems,
  products,
  categories,
  colors,
  fabrics,
  productVariants,
  refunds,
  orders,
  itemStatusHistory,
  stockMovements,
  InsertReturnRequest,
  InsertReturnItem,
  ReturnRequest,
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { orderService } from "../order/orderStorage";
import { userService } from "../auth/authStorage";
import { storage } from "server/storage";
import { refundService } from "../refund/refundService";

export type ReturnRequestWithDetails = ReturnRequest & {
  order: any;
  user: any;
  items: (any & {
    orderItem: {
      product: any;
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
    page?: number;
    pageSize?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ReturnRequestWithDetails[] | {
    data: ReturnRequestWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
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
  ): Promise<{
    itemId: string;
    eligible: boolean;
    reason?: string;
    remainingDays?: number;
  }[]>;
  getOrder(orderId: string): Promise<any>;
}

export class ReturnStorage implements IReturnStorage {
  private readonly activeReturnStatuses = [
    "return_requested",
    "return_approved",
    "return_rejected",
    "return_pickup_scheduled",
    "return_picked_up",
    "return_in_transit",
    "return_received",
    "return_inspected",
    "return_completed",
    "return_cancelled",
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
    page?: number;
    pageSize?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ReturnRequestWithDetails[] | {
    data: ReturnRequestWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
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
        .innerJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
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
              product: {
                ...item.products,
                category: item.categories,
                color: item.colors,
                fabric: item.fabrics,
                variants: item.product_variants ? [item.product_variants] : undefined,
              },
            },
          })),
          refund: refund || undefined,
        });
      }
    }

    let filteredReturns = result;
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredReturns = result.filter(returnRequest => 
        returnRequest.id.toLowerCase().includes(searchTerm) ||
        returnRequest.orderId.toLowerCase().includes(searchTerm) ||
        (returnRequest.user?.name && returnRequest.user.name.toLowerCase().includes(searchTerm)) ||
        (returnRequest.user?.email && returnRequest.user.email.toLowerCase().includes(searchTerm))
      );
    }

    if (filters?.dateFrom || filters?.dateTo) {
      filteredReturns = filteredReturns.filter(returnRequest => {
        const createdAt = new Date(returnRequest.createdAt);
        if (filters.dateFrom && createdAt < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && createdAt > new Date(filters.dateTo)) return false;
        return true;
      });
    }

    if (filters?.page && filters?.pageSize) {
      const offset = (filters.page - 1) * filters.pageSize;
      const paginatedReturns = filteredReturns.slice(offset, offset + filters.pageSize);
      
      return {
        data: paginatedReturns,
        total: filteredReturns.length,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(filteredReturns.length / filters.pageSize)
      };
    }

    return filteredReturns;
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
      .innerJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
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
          product: {
            ...item.products,
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
      let calculatedRefundAmount = request.refundAmount;
      if (!calculatedRefundAmount && request.resolution === "refund") {
        const orderItemsWithProducts = await tx
          .select({
            orderItemId: orderItems.id,
            price: orderItems.price,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, request.orderId));

        const totalRefund = items.reduce((total, item) => {
          const orderItem = orderItemsWithProducts.find(oi => oi.orderItemId === item.orderItemId);
          if (orderItem) {
            return total + (parseFloat(orderItem.price.toString()) * item.quantity);
          }
          return total;
        }, 0);

        calculatedRefundAmount = totalRefund.toString();
      }

      const [newRequest] = await tx
        .insert(returnRequests)
        .values({
          ...request,
          refundAmount: calculatedRefundAmount,
        })
        .returning();

      for (const item of items) {
        await tx.insert(returnItems).values({
          ...item,
          returnRequestId: newRequest.id,
        });

        await tx.update(orderItems).set({
          status: "return_requested",
          updatedAt: new Date(),
        }).where(eq(orderItems.id, item.orderItemId));

        await storage.itemHistory(
          item.orderItemId,
          "delivered",
          "return_requested",
          "Return request created",
          request.userId
        );
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
    return await db.transaction(async (tx) => {
      const updateData: any = { status, updatedAt: new Date() };
      if (processedBy) updateData.processedBy = processedBy;
      if (inspectionNotes) updateData.inspectionNotes = inspectionNotes;

      const [result] = await tx
        .update(returnRequests)
        .set(updateData)
        .where(eq(returnRequests.id, id))
        .returning();

      if (!result) return undefined;

      const returnRequest = await this.getReturnRequest(id);
      if (!returnRequest) return result;

      // Map return request status to order item status
      const statusMap: Record<string, string> = {
        return_requested: "return_requested",
        return_approved: "return_approved",
        return_pickup_scheduled: "return_pickup_scheduled",
        return_picked_up: "return_picked_up",
        return_in_transit: "return_in_transit",
        return_received: "return_received",
        return_inspected: "return_inspected",
        return_completed: "return_completed",
        return_cancelled: "return_cancelled",
      };

      for (const item of returnRequest.items) {
        const newItemStatus = statusMap[status] || "return_requested";

        await tx.update(orderItems).set({
          status: newItemStatus as any,
          updatedAt: new Date(),
        }).where(eq(orderItems.id, item.orderItemId));

        await storage.itemHistory(
          item.orderItemId,
          item.orderItem.status,
          newItemStatus,
          `Return request ${status}${status === "return_completed" ? " - refund initiated" : ""}`,
          processedBy
        );

        if (status === "return_completed" && item.isRestockable) {
          await tx.insert(stockMovements).values({
            productId: item.orderItem.product.id,
            quantity: item.quantity,
            movementType: "return",
            source: "online",
            orderRefId: returnRequest.orderId,
            createdAt: new Date(),
          });
        }
      }

      if (status === "return_completed" && returnRequest.resolution === "refund") {
        try {
          const refundAmount = returnRequest.refundAmount || 
            returnRequest.items.reduce((total, item) => {
              return total + (item.orderItem.price * item.quantity);
            }, 0).toString();

          await refundService.createAndProcessRefund({
            returnRequestId: id,
            orderId: returnRequest.orderId,
            userId: returnRequest.userId,
            amount: refundAmount,
            reason: `return_completed - ${returnRequest.reason}`,
            processedBy: processedBy,
          });

          console.log(`Auto-refund initiated for return request: ${id}, amount: ₹${refundAmount}`);
        } catch (error) {
          console.error("Failed to initiate auto-refund for return:", id, error);
        }
      }
      

      return result;
    });
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
    const result = await this.getReturnRequests({ userId });
    return Array.isArray(result) ? result : result.data || [];
  }

   async checkOrderReturnEligibility(
    orderId: string
  ): Promise<
    { itemId: string; eligible: boolean; reason?: string; remainingDays?: number }[]
  > {
    const order = await orderService.getBasicOrder(orderId);

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

  async getOrder(orderId: string): Promise<any> {
    return await orderService.getOrder(orderId);
  }
}

export const returnStorage = new ReturnStorage();
