import type { Express, Request, Response } from "express";
import { refundService } from "./refundService";
import { RefundWebhookService } from "./refundWebhook";
import { createAuthMiddleware } from "../authMiddleware";
import { storage } from "../storage";

export const refundRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);
  const authUser = createAuthMiddleware(["user"]);

  // Webhook endpoint for Razorpay refund events
  app.post("/api/webhooks/razorpay/refund", async (req: Request, res: Response) => {
    await RefundWebhookService.handleWebhook(req, res);
  });

  // Admin: Get all refunds with enhanced filtering
  app.get("/api/inventory/refunds", authInventory, async (req, res) => {
                console.log(req.query)

    try {
      const { status, userId } = req.query;

      const filters: { status?: any; userId?: string } = {};
      if (typeof status === "string" && status.length > 0) filters.status = status as any;
      if (typeof userId === "string" && userId.length > 0) filters.userId = userId;

      const refunds = await refundService.getRefunds(filters);
      console.log(refunds)
      res.json(refunds);
    } catch (error) {
      console.error("Error fetching refunds:", error);
      res.status(500).json({ message: "Failed to fetch refunds" });
    }
  });

  // Admin: Get specific refund details
  app.get("/api/inventory/refunds/:id", authInventory, async (req, res) => {
    try {
      const refund = await refundService.getRefund(req.params.id);
      if (!refund) {
        return res.status(404).json({ message: "Refund not found" });
      }
      res.json(refund);
    } catch (error) {
      console.error("Error fetching refund:", error);
      res.status(500).json({ message: "Failed to fetch refund" });
    }
  });

  // Admin: Manual refund processing
  app.patch("/api/inventory/refunds/:id/process", authInventory, async (req, res) => {
    try {
      const { status, transactionId } = req.body;
      const user = (req as any).user;

      const refund = await storage.getRefund(req.params.id);
      if (!refund) {
        return res.status(404).json({ message: "Refund not found" });
      }

      let updated;
      if (status === "retry") {
        // Retry failed refund
        await refundService.retryFailedRefund(req.params.id);
        updated = await storage.getRefund(req.params.id);
      } else {
        // Manual processing
        updated = await refundService.processRefundManually(
          req.params.id,
          status,
          transactionId
        );
      }

      res.json(updated);
    } catch (error) {
      console.error("Error processing refund:", error);
      res.status(500).json({ message: "Failed to process refund" });
    }
  });

  // Admin: Check refund status from Razorpay
  app.post("/api/inventory/refunds/:id/check-status", authInventory, async (req, res) => {
    try {
      await refundService.checkRefundStatus(req.params.id);
      const updated = await storage.getRefund(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error checking refund status:", error);
      res.status(500).json({ message: "Failed to check refund status" });
    }
  });

  // Admin: Get refund statistics
  app.get("/api/inventory/refunds/stats", authInventory, async (req, res) => {
    try {
      const allRefunds = await refundService.getRefunds();
      
      const stats = {
        total: allRefunds.length,
        pending: allRefunds.filter(r => r.status === "pending").length,
        initiated: allRefunds.filter(r => r.status === "initiated").length,
        processing: allRefunds.filter(r => r.status === "processing").length,
        completed: allRefunds.filter(r => r.status === "completed").length,
        failed: allRefunds.filter(r => r.status === "failed").length,
        totalAmount: allRefunds.reduce((sum, r) => sum + parseFloat(r.amount), 0),
        completedAmount: allRefunds
          .filter(r => r.status === "completed")
          .reduce((sum, r) => sum + parseFloat(r.amount), 0),
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching refund stats:", error);
      res.status(500).json({ message: "Failed to fetch refund statistics" });
    }
  });

  // User: Get their refunds
  app.get("/api/user/refunds", authUser, async (req, res) => {
    try {
      const userId = (req as any).user?.id;

      const refunds = await refundService.getRefunds({ userId });
      res.json(refunds);
    } catch (error) {
      console.error("Error fetching user refunds:", error);
      res.status(500).json({ message: "Failed to fetch refunds" });
    }
  });

  // Debug endpoint: Check all pending refunds (should be called by cron job)
  app.post("/api/admin/check-pending-refunds", authInventory, async (req, res) => {
    try {
      await RefundWebhookService.checkPendingRefunds();
      res.json({ message: "Pending refunds checked successfully" });
    } catch (error) {
      console.error("Error checking pending refunds:", error);
      res.status(500).json({ message: "Failed to check pending refunds" });
    }
  });
};
