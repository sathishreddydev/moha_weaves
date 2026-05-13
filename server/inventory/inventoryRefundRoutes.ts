import type { Express } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { refundService } from "../refund/refundService";
import { storage } from "../storage";

export const inventoryRefundRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);

  // Get all refunds
  app.get("/api/inventory/refunds", authInventory, async (req, res) => {
    try {
      const { status } = req.query;
      const refunds = await storage.getRefunds({ status: status as string | undefined });
      res.json(refunds);
    } catch {
      res.status(500).json({ message: "Failed to fetch refunds" });
    }
  });

  // Process refund (manual or retry)
  app.patch("/api/inventory/refunds/:id/process", authInventory, async (req, res) => {
    try {
      const { status } = req.body;

      const refund = await storage.getRefund(req.params.id);
      if (!refund) {
        return res.status(404).json({ message: "Refund not found" });
      }

      let updated;
      if (status === "retry") {
        await refundService.retryFailedRefund(req.params.id);
        updated = await storage.getRefund(req.params.id);
      } else {
        updated = await refundService.processRefundManually(req.params.id, status);
      }

      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to process refund" });
    }
  });

  // Check refund status from Razorpay
  app.post("/api/inventory/refunds/:id/check-status", authInventory, async (req, res) => {
    try {
      await refundService.checkRefundStatus(req.params.id);
      const updated = await storage.getRefund(req.params.id);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to check refund status" });
    }
  });
};
