import type { Express, Request, Response } from "express";
import { returnStorage } from "./returnStorage";
import { createAuthMiddleware } from "../authMiddleware";
import {
  InsertReturnRequest,
  InsertReturnItem,
  returnStatusEnum,
  returnReasonEnum,
  returnResolutionEnum
} from "@shared/schema";

export const returnRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);
  const authUser = createAuthMiddleware(["user"]);

  // ======================
  // Admin Routes
  // ======================

  // Get all return requests with filtering
  app.get("/api/inventory/returns", authInventory, async (req: Request, res: Response) => {
    try {
      const { status, userId, reason, resolution } = req.query;

      const filters: any = {};
      if (typeof status === "string" && status.length > 0) filters.status = status;
      if (typeof userId === "string" && userId.length > 0) filters.userId = userId;
      if (typeof reason === "string" && reason.length > 0) filters.reason = reason;
      if (typeof resolution === "string" && resolution.length > 0) filters.resolution = resolution;

      const returns = await returnStorage.getReturnRequests(filters);
      res.json(returns);
    } catch (error) {
      console.error("Error fetching return requests:", error);
      res.status(500).json({ message: "Failed to fetch return requests" });
    }
  });

  // Get specific return request details
  app.get("/api/inventory/returns/:id", authInventory, async (req: Request, res: Response) => {
    try {
      const returnRequest = await returnStorage.getReturnRequest(req.params.id);
      if (!returnRequest) return res.status(404).json({ message: "Return request not found" });
      res.json(returnRequest);
    } catch (error) {
      console.error("Error fetching return request:", error);
      res.status(500).json({ message: "Failed to fetch return request" });
    }
  });

  // Update return request status
  app.patch("/api/inventory/returns/:id/status", authInventory, async (req: Request, res: Response) => {
    try {
      const { status, inspectionNotes } = req.body;
      const user = (req as any).user;

      if (!Object.values(returnStatusEnum.enumValues).includes(status)) {
        return res.status(400).json({ message: "Invalid return status" });
      }

      const updated = await returnStorage.updateReturnRequestStatus(
        req.params.id,
        status,
        user?.id,
        inspectionNotes
      );

      if (!updated) return res.status(404).json({ message: "Return request not found" });

      res.json(updated);
    } catch (error) {
      console.error("Error updating return status:", error);
      res.status(500).json({ message: "Failed to update return status" });
    }
  });

  // Update return request details
  app.patch("/api/inventory/returns/:id", authInventory, async (req: Request, res: Response) => {
    try {
      const { pickupAddress, pickupScheduledAt, refundAmount, exchangeOrderId } = req.body;

      const updateData: any = {};
      if (pickupAddress !== undefined) updateData.pickupAddress = pickupAddress;
      if (pickupScheduledAt !== undefined) updateData.pickupScheduledAt = new Date(pickupScheduledAt);
      if (refundAmount !== undefined) updateData.refundAmount = refundAmount;
      if (exchangeOrderId !== undefined) updateData.exchangeOrderId = exchangeOrderId;

      const updated = await returnStorage.updateReturnRequest(req.params.id, updateData);

      if (!updated) return res.status(404).json({ message: "Return request not found" });

      res.json(updated);
    } catch (error) {
      console.error("Error updating return request:", error);
      res.status(500).json({ message: "Failed to update return request" });
    }
  });

  // Return statistics
  app.get("/api/inventory/returns/stats", authInventory, async (req: Request, res: Response) => {
    try {
      const allReturns = await returnStorage.getReturnRequests();

      const stats = {
        total: allReturns.length,
        ...returnStatusEnum.enumValues.reduce((acc, status) => {
          acc[status] = allReturns.filter(r => r.status === status).length;
          return acc;
        }, {} as Record<string, number>),
        byReason: allReturns.reduce((acc, r) => {
          acc[r.reason] = (acc[r.reason] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byResolution: allReturns.reduce((acc, r) => {
          acc[r.resolution] = (acc[r.resolution] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching return stats:", error);
      res.status(500).json({ message: "Failed to fetch return statistics" });
    }
  });

  // ======================
  // User Routes
  // ======================

  // Get all returns for user
  app.get("/api/user/returns", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const returns = await returnStorage.getUserReturnRequests(userId);
      res.json(returns);
    } catch (error) {
      console.error("Error fetching user returns:", error);
      res.status(500).json({ message: "Failed to fetch return requests" });
    }
  });

  // Create a new return request
  app.post("/api/user/returns", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { orderId, reason, reasonDetails, resolution, items } = req.body;

      if (!orderId || !reason || !resolution || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!Object.values(returnReasonEnum.enumValues).includes(reason)) {
        return res.status(400).json({ message: "Invalid return reason" });
      }

      if (!Object.values(returnResolutionEnum.enumValues).includes(resolution)) {
        return res.status(400).json({ message: "Invalid return resolution" });
      }

      const returnData: InsertReturnRequest = {
        orderId,
        userId,
        status: "return_requested",
        reason,
        reasonDetails,
        resolution,
      };

      const returnItemsData: Omit<InsertReturnItem, 'returnRequestId'>[] = items.map((item: any) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        exchangeSareeId: item.exchangeSareeId,
        condition: item.condition,
        isRestockable: item.isRestockable,
      }));

      const newReturn = await returnStorage.createReturnRequest(returnData, returnItemsData);
      const returnWithDetails = await returnStorage.getReturnRequest(newReturn.id);

      res.status(201).json(returnWithDetails);
    } catch (error) {
      console.error("Error creating return request:", error);
      res.status(500).json({ message: "Failed to create return request" });
    }
  });

  // Get a specific return request for user
  app.get("/api/user/returns/:id", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const returnRequest = await returnStorage.getReturnRequest(req.params.id);

      if (!returnRequest || returnRequest.userId !== userId) {
        return res.status(404).json({ message: "Return request not found" });
      }

      res.json(returnRequest);
    } catch (error) {
      console.error("Error fetching return request:", error);
      res.status(500).json({ message: "Failed to fetch return request" });
    }
  });

  // Check return eligibility for an order
  app.get("/api/user/orders/:orderId/return-eligibility", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { orderId } = req.params;

      const order = await returnStorage.getOrder(orderId);
      if (!order || order.userId !== userId) {
        return res.status(404).json({ message: "Order not found" });
      }

      const eligibility = await returnStorage.checkOrderReturnEligibility(orderId);
      res.json(eligibility);
    } catch (error) {
      console.error("Error checking return eligibility:", error);
      res.status(500).json({ message: "Failed to check return eligibility" });
    }
  });

  // Cancel return request (only if requested)
  app.patch("/api/user/returns/:id/cancel", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const returnRequest = await returnStorage.getReturnRequest(req.params.id);

      if (!returnRequest || returnRequest.userId !== userId) {
        return res.status(404).json({ message: "Return request not found" });
      }

      if (returnRequest.status !== "return_requested") {
        return res.status(400).json({ message: "Cannot cancel return request in current status" });
      }

      const updated = await returnStorage.updateReturnRequestStatus(req.params.id, "cancelled");
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling return request:", error);
      res.status(500).json({ message: "Failed to cancel return request" });
    }
  });
};
