import { orders, Refund, refunds } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { createRefund, getRefundStatus } from "../razorpayClient";
import { storage } from "../storage";
import { publishRealtimeEvent } from "../../realtime/events";

export interface RefundProcessingOptions {
  returnRequestId: string;
  orderId: string;
  userId: string;
  amount: string;
  reason?: string;
  processedBy?: string;
}

export class RefundService {
  async createAndProcessRefund(options: RefundProcessingOptions): Promise<Refund> {
    const { refund, razorpayPaymentId } = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, options.orderId));

      if (!order || !order.razorpayPaymentId) {
        throw new Error("Order or payment ID not found");
      }

      const [refund] = await tx
        .insert(refunds)
        .values({
          returnRequestId: options.returnRequestId,
          orderId: options.orderId,
          userId: options.userId,
          amount: options.amount,
          status: "pending",
          refundMethod: "razorpay",
          razorpayPaymentId: order.razorpayPaymentId,
          reason: options.reason || "return_completed",
          processedBy: options.processedBy,
        })
        .returning();

      return { refund, razorpayPaymentId: order.razorpayPaymentId };
    });

    await this.initiateRefund(refund.id, razorpayPaymentId);

    return refund;
  }

  private async initiateRefund(refundId: string, paymentId: string): Promise<void> {
    try {
      const refund = await this.getRefund(refundId);
      if (!refund) {
        throw new Error("Refund not found");
      }

      await this.updateRefundStatus(refundId, "initiated", undefined, undefined);

      const amountInPaise = Math.round(parseFloat(refund.amount) * 100);
      const razorpayRefund = await createRefund({
        paymentId,
        amount: amountInPaise,
        notes: {
          refundId: refundId,
          orderId: refund.orderId,
          returnRequestId: refund.returnRequestId,
          reason: refund.reason,
        },
      });

      await this.updateRefundStatus(
        refundId,
        "processing",
        razorpayRefund.id,
        undefined
      );

      console.log(`Razorpay refund initiated: ${razorpayRefund.id} for refund: ${refundId}`);
    } catch (error) {
      console.error("Failed to initiate Razorpay refund:", error);
      await this.updateRefundStatus(
        refundId,
        "failed",
        undefined,
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  async checkRefundStatus(refundId: string): Promise<void> {
    try {
      const refund = await this.getRefund(refundId);
      if (!refund || !refund.razorpayRefundId) {
        return;
      }

      const razorpayRefund = await getRefundStatus(refund.razorpayRefundId);
      
      if (razorpayRefund.status === "processed") {
        await this.updateRefundStatus(
          refundId,
          "completed",
          undefined,
          undefined,
          new Date()
        );
        
        await storage.createNotification({
          userId: refund.userId,
          type: "refund",
          title: "Refund Completed",
          message: `Your refund of ₹${refund.amount} has been processed successfully.`,
          relatedId: refund.id,
          relatedType: "refund",
        });

        // Push realtime update to the customer's browser
        await publishRealtimeEvent("refund_status_updated", {
          refundId: refund.id,
          userId: refund.userId,
          orderId: refund.orderId,
          status: "completed",
          amount: refund.amount,
          completedAt: new Date().toISOString(),
        });
      } else if (razorpayRefund.status === "failed") {
        const failureReason = (razorpayRefund as any).error_description || "Refund failed";
        await this.updateRefundStatus(
          refundId,
          "failed",
          undefined,
          failureReason
        );

        // Push realtime update to the customer's browser
        await publishRealtimeEvent("refund_status_updated", {
          refundId: refund.id,
          userId: refund.userId,
          orderId: refund.orderId,
          status: "failed",
          amount: refund.amount,
          failureReason,
        });
      }
    } catch (error) {
      console.error("Failed to check refund status:", error);
    }
  }

  async retryFailedRefund(refundId: string): Promise<void> {
    const refund = await this.getRefund(refundId);
    if (!refund || refund.status !== "failed") {
      throw new Error("Only failed refunds can be retried");
    }

    if ((refund.retryCount || 0) >= 3) {
      throw new Error("Maximum retry attempts exceeded");
    }

    try {
      await db
        .update(refunds)
        .set({ retryCount: (refund.retryCount || 0) + 1 })
        .where(eq(refunds.id, refundId));

      if (refund.razorpayPaymentId) {
        await this.initiateRefund(refundId, refund.razorpayPaymentId);
      }
    } catch (error) {
      console.error("Failed to retry refund:", error);
      throw error;
    }
  }

  async getRefund(id: string): Promise<Refund | undefined> {
    const [result] = await db.select().from(refunds).where(eq(refunds.id, id));
    return result || undefined;
  }

  private async updateRefundStatus(
    id: string,
    status: "pending" | "initiated" | "processing" | "completed" | "failed" | "cancelled",
    razorpayRefundId?: string,
    failureReason?: string,
    completedAt?: Date
  ): Promise<void> {
    const updateData: any = { status };
    
    if (razorpayRefundId) updateData.razorpayRefundId = razorpayRefundId;
    if (failureReason) updateData.failureReason = failureReason;
    if (completedAt) updateData.completedAt = completedAt;
    if (status === "initiated") updateData.initiatedAt = new Date();

    await db
      .update(refunds)
      .set(updateData)
      .where(eq(refunds.id, id));
  }

  async getRefunds(filters?: {
    userId?: string;
    status?: "pending" | "initiated" | "processing" | "completed" | "failed" | "cancelled";
  }): Promise<Refund[]> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(refunds.userId, filters.userId));
    if (filters?.status) conditions.push(eq(refunds.status, filters.status as any));

    const query = db.select().from(refunds);
    const queryWithWhere =
      conditions.length > 0 ? query.where(and(...conditions)) : query;

    return await queryWithWhere.orderBy(refunds.createdAt);
  }

  async processRefundManually(
    refundId: string,
    status: "pending" | "initiated" | "processing" | "completed" | "failed" | "cancelled",
  ): Promise<Refund | undefined> {
    const [result] = await db
      .update(refunds)
      .set({
        status,
        completedAt: status === "completed" ? new Date() : undefined,
        failureReason: status === "failed" ? "Manual processing failed" : undefined,
      })
      .where(eq(refunds.id, refundId))
      .returning();

    if (result && status === "completed") {
      // Create notification
      await storage.createNotification({
        userId: result.userId,
        type: "refund",
        title: "Refund Processed",
        message: `Your refund of ₹${result.amount} has been processed manually.`,
        relatedId: result.id,
        relatedType: "refund",
      });

      // Push realtime update to the customer's browser
      await publishRealtimeEvent("refund_status_updated", {
        refundId: result.id,
        userId: result.userId,
        orderId: result.orderId,
        status: "completed",
        amount: result.amount,
        completedAt: new Date().toISOString(),
      });
    }

    return result || undefined;
  }
}

export const refundService = new RefundService();
