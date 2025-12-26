import { Request, Response } from "express";
import crypto from "crypto";
import { refundService } from "./refundService";
import { db } from "../db";
import { refunds } from "@shared/schema";
import { eq } from "drizzle-orm";

export class RefundWebhookService {
  // Verify Razorpay webhook signature
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

  // Handle Razorpay webhook events
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

      if (!signature) {
        res.status(400).json({ error: "Missing signature" });
        return;
      }

      const body = JSON.stringify(req.body);
      
      if (!this.verifyWebhookSignature(body, signature, webhookSecret)) {
        console.error("Invalid webhook signature");
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const event = req.body;
      console.log("Webhook event received:", event.event);

      // Handle different webhook events
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

  // Handle refund processed event
  private static async handleRefundProcessed(refundEntity: any): Promise<void> {
    try {
      // Find refund by Razorpay refund ID
      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.razorpayRefundId, refundEntity.id));

      if (!refund) {
        console.log(`Refund not found for Razorpay ID: ${refundEntity.id}`);
        return;
      }

      // Update refund status to completed
      await refundService.processRefundManually(refund.id, "completed");
      
      console.log(`Refund ${refund.id} marked as completed via webhook`);
    } catch (error) {
      console.error("Error handling refund processed webhook:", error);
    }
  }

  // Handle refund failed event
  private static async handleRefundFailed(refundEntity: any): Promise<void> {
    try {
      // Find refund by Razorpay refund ID
      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.razorpayRefundId, refundEntity.id));

      if (!refund) {
        console.log(`Refund not found for Razorpay ID: ${refundEntity.id}`);
        return;
      }

      // Update refund status to failed with reason
      await db
        .update(refunds)
        .set({
          status: "failed",
          failureReason: refundEntity.error_description || "Refund failed via webhook",
        })
        .where(eq(refunds.id, refund.id));

      console.log(`Refund ${refund.id} marked as failed via webhook`);
    } catch (error) {
      console.error("Error handling refund failed webhook:", error);
    }
  }

  // Handle refund created event
  private static async handleRefundCreated(refundEntity: any): Promise<void> {
    try {
      // Find refund by Razorpay refund ID
      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.razorpayRefundId, refundEntity.id));

      if (!refund) {
        console.log(`Refund not found for Razorpay ID: ${refundEntity.id}`);
        return;
      }

      // Update refund with Razorpay details if not already set
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

  // Manual webhook status check (for debugging)
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
