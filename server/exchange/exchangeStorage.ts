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
  stockMovements,
  notifications,
  itemStatusHistory,
  itemStatusEnum,
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
  createExchangeStatusNotification(
    userId: string,
    orderId: string,
    status: "exchange_processing" | "exchange_shipped" | "exchange_delivered"
  ): Promise<void>;
  updateExchangeItemStatus(
    exchangeRequestId: string,
    status: "exchange_processing" | "exchange_shipped" | "exchange_delivered",
    processedBy?: string
  ): Promise<any | undefined>;
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
          note: "Exchange request created",
          updatedBy: request.userId,
          createdAt: new Date(),
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
    return await db.transaction(async (tx) => {
      const updateData: any = { status, updatedAt: new Date() };
      if (processedBy) updateData.processedBy = processedBy;
      if (inspectionNotes) updateData.inspectionNotes = inspectionNotes;
      if (exchangeOrderId) updateData.exchangeOrderId = exchangeOrderId;

      const [result] = await tx
        .update(returnRequests)
        .set(updateData)
        .where(and(eq(returnRequests.id, id), eq(returnRequests.resolution, "exchange")))
        .returning();

      if (!result) return undefined;

      // Handle exchange completion logic
      if (status === "completed") {
        const exchangeRequest = await this.getExchangeRequest(id);
        if (!exchangeRequest) return result;

        // Update item-level status for exchanged items
        for (const item of exchangeRequest.items) {
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
            note: "Exchange completed",
            updatedBy: processedBy,
            createdAt: new Date(),
          });
        }

        // Handle inventory management for returned items
        for (const item of exchangeRequest.items) {
          // item is already the return item, no need to find it again
          if (item.isRestockable) {
            // Add returned item back to stock
            await tx.insert(stockMovements).values({
              sareeId: item.orderItem.saree.id,
              quantity: item.quantity, // Positive quantity for stock addition
              movementType: "return",
              source: "online",
              orderRefId: exchangeRequest.orderId,
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
              orderRefId: exchangeRequest.orderId,
              createdAt: new Date(),
            });
          }
        }

        // Create customer notification
        await tx.insert(notifications).values({
          userId: exchangeRequest.userId,
          type: "order",
          title: "Exchange Completed",
          message: `Your exchange request for order #${exchangeRequest.orderId} has been completed. Your exchanged items will be shipped soon.`,
          relatedId: exchangeRequest.orderId,
          createdAt: new Date(),
        });
      }

      return result;
    });
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
    
    // Check if at least one item is delivered
    const hasDeliveredItem = order.items.some((item: any) => 
      item.status === "delivered" || 
      item.status === "exchange_completed" ||
      item.status === "return_completed"
    );
    
    if (!hasDeliveredItem) {
      return {
        eligible: false,
        reason: "At least one item must be delivered to initiate exchange",
      };
    }

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

  async createExchangeStatusNotification(
    userId: string,
    orderId: string,
    status: "exchange_processing" | "exchange_shipped" | "exchange_delivered"
  ): Promise<void> {
    const statusMessages = {
      exchange_processing: "Your exchange is being processed",
      exchange_shipped: "Your exchange has been shipped",
      exchange_delivered: "Your exchange has been delivered"
    };

    await db.insert(notifications).values({
      userId,
      type: "order",
      title: `Exchange Status Update`,
      message: `${statusMessages[status as keyof typeof statusMessages]} for order #${orderId}`,
      relatedId: orderId,
      createdAt: new Date(),
    });
  }

  async updateExchangeItemStatus(
    exchangeRequestId: string,
    status: "exchange_processing" | "exchange_shipped" | "exchange_delivered",
    processedBy?: string
  ): Promise<any | undefined> {
    return await db.transaction(async (tx) => {
      const updateData: any = { status, updatedAt: new Date() };
      if (processedBy) updateData.processedBy = processedBy;

      const [result] = await tx
        .update(returnRequests)
        .set(updateData)
        .where(and(eq(returnRequests.id, exchangeRequestId), eq(returnRequests.resolution, "exchange")))
        .returning();

      if (!result) return undefined;

      // Get exchange request details to update item statuses
      const exchangeRequest = await this.getExchangeRequest(exchangeRequestId);
      if (!exchangeRequest) return result;

      // Update item-level status for exchanged items based on exchange status
      let itemStatus: string;
      switch (status) {
        case "exchange_processing":
          itemStatus = "exchange_processing";
          break;
        case "exchange_shipped":
          itemStatus = "exchange_shipped";
          break;
        case "exchange_delivered":
          itemStatus = "exchange_delivered";
          break;
      }

      for (const item of exchangeRequest.items) {
        await tx
          .update(orderItems)
          .set({ 
            status: itemStatus as "exchange_processing" | "exchange_shipped" | "exchange_delivered",
            updatedAt: new Date(),
            ...(status === "exchange_shipped" && { shippedAt: new Date() }),
            ...(status === "exchange_delivered" && { deliveredAt: new Date() }),
          })
          .where(eq(orderItems.id, item.orderItemId));

        // Create item status history
        await tx.insert(itemStatusHistory).values({
          orderItemId: item.orderItemId,
          status: "exchange_requested", 
          newStatus: itemStatus as "exchange_processing" | "exchange_shipped" | "exchange_delivered",
          note: `Exchange ${status.replace(/_/g, " ")}`,
          updatedBy: processedBy,
          createdAt: new Date(),
        });

        // Create customer notification for item-level status update
        const statusMessages = {
          exchange_processing: "Your exchange is being processed",
          exchange_shipped: "Your exchange has been shipped", 
          exchange_delivered: "Your exchange has been delivered"
        };

        await tx.insert(notifications).values({
          userId: exchangeRequest.userId,
          type: "order",
          title: `Exchange Status Update`,
          message: `${statusMessages[status as keyof typeof statusMessages]} for order #${exchangeRequest.orderId}`,
          relatedId: exchangeRequest.orderId,
          createdAt: new Date(),
        });
      }

      return result || undefined;
    });
  }
}

export const exchangeStorage = new ExchangeStorage();