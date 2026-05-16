import {
  categories,
  colors,
  coupons,
  fabrics,
  InsertReturnItem,
  InsertReturnRequest,
  onlineExchanges,
  onlineExchangeItems,
  orderItems,
  products,
  productVariants,
  refunds,
  returnItems,
  ReturnRequest,
  returnRequests,
  stockMovements
} from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { storage } from "server/storage";
import { userService } from "../auth/authStorage";
import { db } from "../db";
import { orderService } from "../order/orderStorage";
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
      const orderWithItems = await orderService.getOrder(request.orderId, "admin");
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

    const orderWithItems = await orderService.getOrder(request.orderId, "admin");
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
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
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
            variants: item.product_variants ? [item.product_variants] : undefined,
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

        // Fetch the actual current status rather than hardcoding "delivered"
        const [currentItem] = await tx
          .select({ status: orderItems.status })
          .from(orderItems)
          .where(eq(orderItems.id, item.orderItemId));

        await storage.itemHistory(
          item.orderItemId,
          currentItem?.status ?? "delivered",
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
      if (inspectionNotes !== undefined) updateData.inspectionNotes = inspectionNotes;

      // Stamp timestamp fields based on status
      if (status === "return_picked_up") updateData.pickedUpAt = new Date();
      if (status === "return_received") updateData.receivedAt = new Date();

      const [result] = await tx
        .update(returnRequests)
        .set(updateData)
        .where(eq(returnRequests.id, id))
        .returning();

      if (!result) return undefined;

      const returnRequest = await this.getReturnRequest(id);
      if (!returnRequest) return result;

      // Map return request status → order item status (1:1 — all return sub-statuses
      // are stored via `as any` so the DB enum constraint doesn't block them).
      const statusMap: Record<string, string> = {
        return_requested:        "return_requested",
        return_approved:         "return_approved",
        return_pickup_scheduled: "return_pickup_scheduled",
        return_picked_up:        "return_picked_up",
        return_in_transit:       "return_in_transit",
        return_received:         "return_received",
        return_inspected:        "return_inspected",
        return_completed:        "return_completed",
        return_rejected:         "return_rejected",
        return_cancelled:        "return_cancelled",
      };

      for (const item of returnRequest.items) {
        const newItemStatus = statusMap[status];
        if (!newItemStatus) continue; // unknown status — skip rather than corrupt

        await tx.update(orderItems).set({
          status: newItemStatus as any,
          updatedAt: new Date(),
        }).where(eq(orderItems.id, item.orderItemId));

        await storage.itemHistory(
          item.orderItemId,
          item.orderItem.status,
          newItemStatus,
          `Return ${status.replace(/_/g, " ")}${
            status === "return_completed"
              ? returnRequest.resolution === "refund"
                ? " — refund initiated"
                : returnRequest.resolution === "exchange"
                ? " — exchange created"
                : " — store credit issued"
              : ""
          }`,
          processedBy
        );

        if (status === "return_completed" && item.isRestockable) {
          await tx.insert(stockMovements).values({
            productId: item.orderItem.product.id,
            variantId: item.orderItem.variantId ?? null,
            quantity: item.quantity,
            movementType: "return",
            source: "online",
            orderRefId: returnRequest.orderId,
            createdAt: new Date(),
          });
          // Restore actual product stock counts
          await storage.restoreStockFromReturn(item.orderItem.product.id, item.quantity, returnRequest.orderId);
        }
      }

      // Customer notifications for key status changes
      const customerMessages: Partial<Record<string, { title: string; message: string }>> = {
        return_approved: {
          title: "Return Approved",
          message: "Your return request has been approved. We will schedule a pickup shortly.",
        },
        return_pickup_scheduled: {
          title: "Pickup Scheduled",
          message: "Your return pickup has been scheduled. Please keep the item ready.",
        },
        return_completed: {
          title: "Return Completed",
          message: returnRequest.resolution === "refund"
            ? `Your return is complete. A refund of ₹${returnRequest.refundAmount || "0"} has been initiated.`
            : returnRequest.resolution === "exchange"
            ? "Your return is complete. An exchange request has been created — our team will be in touch shortly."
            : `Your return is complete. A store credit coupon has been issued to your account.`,
        },
        return_rejected: {
          title: "Return Rejected",
          message: `Your return request has been rejected.${inspectionNotes ? ` Reason: ${inspectionNotes}` : ""}`,
        },
        return_cancelled: {
          title: "Return Cancelled",
          message: "Your return request has been cancelled.",
        },
      };

      const notif = customerMessages[status];
      if (notif) {
        try {
          await storage.createNotification({
            userId: returnRequest.userId,
            type: "return",
            title: notif.title,
            message: notif.message,
            relatedId: id,
            relatedType: "return",
          });
        } catch (err) {
          console.error("Failed to send return notification:", err);
        }
      }

      if (status === "return_completed" && returnRequest.resolution === "refund") {
        // Idempotency guard — don't create a second refund if one already exists
        const [existingRefund] = await db
          .select({ id: refunds.id })
          .from(refunds)
          .where(eq(refunds.returnRequestId, id))
          .limit(1);

        if (!existingRefund) {
          try {
          const refundAmount = returnRequest.refundAmount
            ? String(returnRequest.refundAmount)
            : returnRequest.items.reduce((total, item) => {
                return total + parseFloat(String(item.orderItem.price || "0")) * Number(item.quantity);
              }, 0).toFixed(2);

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
            // Log but don't swallow — surface the failure so the caller knows
            console.error("Failed to initiate auto-refund for return:", id, error);
            // Notify inventory team via a system notification
            try {
              await storage.createNotification({
                userId: processedBy || returnRequest.userId,
                type: "system",
                title: "Refund Initiation Failed",
                message: `Auto-refund for return ${id} failed: ${error instanceof Error ? error.message : "Unknown error"}. Please retry from the Refunds page.`,
                relatedId: id,
                relatedType: "return",
              });
            } catch { /* best-effort */ }
          }
        }
      }

      // ── Exchange resolution ──────────────────────────────────────────────────
      // When the return is completed with resolution=exchange, auto-create an
      // onlineExchange so the admin can process the replacement shipment through
      // the normal exchange workflow.
      if (status === "return_completed" && returnRequest.resolution === "exchange") {
        // Idempotency guard — skip if an exchange was already created for this return
        const alreadyLinked = returnRequest.exchangeOrderId;
        if (!alreadyLinked) {
          try {
            const [newExchange] = await db
              .insert(onlineExchanges)
              .values({
                orderId: returnRequest.orderId,
                userId: returnRequest.userId,
                status: "exchange_requested",
                reason: returnRequest.reason,
                reasonDetails: returnRequest.reasonDetails ?? undefined,
                pickupAddress: returnRequest.pickupAddress ?? undefined,
                processedBy: processedBy ?? undefined,
              })
              .returning();

            // Mirror each return item as an exchange item
            for (const item of returnRequest.items) {
              await db.insert(onlineExchangeItems).values({
                exchangeId: newExchange.id,
                orderItemId: item.orderItemId,
                quantity: item.quantity,
                condition: item.condition ?? undefined,
                isRestockable: item.isRestockable ?? true,
                // exchangeproductId left null — admin will set the replacement product
              });
            }

            // Store the exchange ID back on the return request for traceability
            await db
              .update(returnRequests)
              .set({ exchangeOrderId: newExchange.id, updatedAt: new Date() })
              .where(eq(returnRequests.id, id));

            // Update the notification message now that we have the exchange ID
            await storage.createNotification({
              userId: returnRequest.userId,
              type: "return",
              title: "Exchange Request Created",
              message: `Your return is complete. An exchange request (#${newExchange.id}) has been created. Our team will contact you to arrange the replacement.`,
              relatedId: newExchange.id,
              relatedType: "return",
            });

            console.log(`Auto-exchange created for return ${id}: exchange ${newExchange.id}`);
          } catch (error) {
            console.error("Failed to create auto-exchange for return:", id, error);
            try {
              await storage.createNotification({
                userId: processedBy || returnRequest.userId,
                type: "system",
                title: "Exchange Creation Failed",
                message: `Auto-exchange for return ${id} failed: ${error instanceof Error ? error.message : "Unknown error"}. Please create the exchange manually.`,
                relatedId: id,
                relatedType: "return",
              });
            } catch { /* best-effort */ }
          }
        }
      }

      // ── Store credit resolution ──────────────────────────────────────────────
      // No wallet table exists, so store credit is issued as a single-use fixed
      // coupon valid for 1 year. The coupon code is sent to the customer.
      if (status === "return_completed" && returnRequest.resolution === "store_credit") {
        try {
          const creditAmount = returnRequest.refundAmount
            ? parseFloat(String(returnRequest.refundAmount))
            : returnRequest.items.reduce((total, item) => {
                return total + parseFloat(String(item.orderItem.price || "0")) * Number(item.quantity);
              }, 0);

          // Generate a unique, human-readable coupon code
          const couponCode = `CREDIT-${returnRequest.userId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

          const validUntil = new Date();
          validUntil.setFullYear(validUntil.getFullYear() + 1);

          await db.insert(coupons).values({
            code: couponCode,
            name: `Store Credit — Return #${id}`,
            description: `Store credit issued for return request #${id}. Reason: ${returnRequest.reason}.`,
            type: "fixed",
            value: creditAmount.toFixed(2),
            usageLimit: 1,
            perUserLimit: 1,
            validFrom: new Date(),
            validUntil,
            isActive: true,
          });

          await storage.createNotification({
            userId: returnRequest.userId,
            type: "return",
            title: "Store Credit Issued",
            message: `Your return is complete. A store credit of ₹${creditAmount.toFixed(2)} has been issued. Use coupon code ${couponCode} at checkout. Valid for 1 year.`,
            relatedId: id,
            relatedType: "return",
          });

          console.log(`Store credit coupon ${couponCode} issued for return ${id}, amount: ₹${creditAmount.toFixed(2)}`);
        } catch (error) {
          console.error("Failed to issue store credit for return:", id, error);
          try {
            await storage.createNotification({
              userId: processedBy || returnRequest.userId,
              type: "system",
              title: "Store Credit Issuance Failed",
              message: `Store credit for return ${id} failed: ${error instanceof Error ? error.message : "Unknown error"}. Please issue the credit manually.`,
              relatedId: id,
              relatedType: "return",
            });
          } catch { /* best-effort */ }
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
    return await orderService.getOrder(orderId, "admin");
  }
}

export const returnStorage = new ReturnStorage();
