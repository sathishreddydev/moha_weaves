import { Request, Response } from "express";
import crypto from "crypto";
import { refundService } from "./refundService";
import { db } from "../db";
import { refunds } from "@shared/schema";
import { eq } from "drizzle-orm";
import { publishRealtimeEvent } from "../../realtime/events";

export class RefundWebhookService {
  static verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return false;
    }
  }

  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signatureHeader = req.headers["x-razorpay-signature"];
      const signature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : (signatureHeader as string | undefined);
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

      if (!signature) {
        res.status(400).json({ error: "Missing signature" });
        return;
      }

      const rawBodyBuffer = (req as any).rawBody as Buffer | undefined;
      const body = rawBodyBuffer ? rawBodyBuffer.toString("utf8") : JSON.stringify(req.body);
      
      if (!this.verifyWebhookSignature(body, signature, webhookSecret)) {
        console.error("Invalid webhook signature");
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const event = req.body;
      console.log("Webhook event received:", event.event);

      switch (event.event) {
        case "refund.processed":
          await this.handleRefundProcessed(event.payload.refund.entity);
          break;
        
        case "refund.failed":
          await this.handleRefundFailed(event.payload.refund.entity);
          break;
        
        case "refund.created":
          await this.handleRefundCreated(event.payload.refund.entity);
          break;
        
        default:
          console.log(`Unhandled webhook event: ${event.event}`);
      }

      res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  private static async handleRefundProcessed(refundEntity: any): Promise<void> {
    try {
      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.razorpayRefundId, refundEntity.id));

      if (!refund) {
        console.log(`Refund not found for Razorpay ID: ${refundEntity.id}`);
        return;
      }

      await refundService.processRefundManually(refund.id, "completed");
      
      console.log(`Refund ${refund.id} marked as completed via webhook`);
    } catch (error) {
      console.error("Error handling refund processed webhook:", error);
    }
  }

  private static async handleRefundFailed(refundEntity: any): Promise<void> {
    try {
      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.razorpayRefundId, refundEntity.id));

      if (!refund) {
        console.log(`Refund not found for Razorpay ID: ${refundEntity.id}`);
        return;
      }

      const failureReason = refundEntity.error_description || "Refund failed via webhook";

      await db
        .update(refunds)
        .set({
          status: "failed",
          failureReason,
        })
        .where(eq(refunds.id, refund.id));

      // Push realtime update to the customer's browser
      await publishRealtimeEvent("refund_status_updated", {
        refundId: refund.id,
        userId: refund.userId,
        orderId: refund.orderId,
        status: "failed",
        amount: refund.amount,
        failureReason,
      });

      console.log(`Refund ${refund.id} marked as failed via webhook`);
    } catch (error) {
      console.error("Error handling refund failed webhook:", error);
    }
  }

  private static async handleRefundCreated(refundEntity: any): Promise<void> {
    try {
      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.razorpayRefundId, refundEntity.id));

      if (!refund) {
        console.log(`Refund not found for Razorpay ID: ${refundEntity.id}`);
        return;
      }

      await db
        .update(refunds)
        .set({
          status: "processing",
          razorpayRefundId: refundEntity.id,
          initiatedAt: new Date(),
        })
        .where(eq(refunds.id, refund.id));

      console.log(`Refund ${refund.id} updated with Razorpay details via webhook`);
    } catch (error) {
      console.error("Error handling refund created webhook:", error);
    }
  }

  static async checkPendingRefunds(): Promise<void> {
    try {
      const pendingRefunds = await db
        .select()
        .from(refunds)
        .where(eq(refunds.status, "processing"));

      console.log(`Checking ${pendingRefunds.length} pending refunds...`);

      for (const refund of pendingRefunds) {
        if (refund.razorpayRefundId) {
          await refundService.checkRefundStatus(refund.id);
        }
      }
    } catch (error) {
      console.error("Error checking pending refunds:", error);
    }
  }
}
