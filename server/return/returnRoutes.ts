import {
  InsertReturnItem,
  InsertReturnRequest,
  returnReasonEnum,
  returnResolutionEnum,
  returnStatusEnum
} from "@shared/schema";
import type { Express, Request, Response } from "express";
import { publishRealtimeEvent } from "realtime/events";
import { createAuthMiddleware } from "../authMiddleware";
import { returnStorage } from "./returnStorage";

// Valid status transitions — mirrors the frontend flow map
const RETURN_TRANSITIONS: Record<string, string[]> = {
  return_requested:       ["return_approved", "return_rejected", "return_cancelled"],
  return_approved:        ["return_pickup_scheduled", "return_cancelled"],
  return_pickup_scheduled:["return_picked_up", "return_cancelled"],
  return_picked_up:       ["return_in_transit", "return_cancelled"],
  return_in_transit:      ["return_received", "return_cancelled"],
  return_received:        ["return_inspected", "return_cancelled"],
  return_inspected:       ["return_completed", "return_cancelled"],
  return_completed:       [],
  return_rejected:        [],
  return_cancelled:       [],
};

export const returnRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);
  const authUser = createAuthMiddleware(["user"]);

  // ======================
  // Admin Routes
  // ======================

  // Get all return requests with filtering
  app.post("/api/inventory/returnRequests", authInventory, async (req: Request, res: Response) => {
    
    try {
      const { page, pageSize } = req.query;
      const { status, userId, reason, resolution, search, dateFrom, dateTo}=req.body
      const filters: any = {};
      if (typeof status === "string" && status.length > 0) filters.status = status;
      if (typeof userId === "string" && userId.length > 0) filters.userId = userId;
      if (typeof reason === "string" && reason.length > 0) filters.reason = reason;
      if (typeof resolution === "string" && resolution.length > 0) filters.resolution = resolution;
      if (page && pageSize) {
        filters.page = parseInt(page as string);
        filters.pageSize = parseInt(pageSize as string);
      }
      if (typeof search === "string" && search.length > 0) filters.search = search;
      if (typeof dateFrom === "string" && dateFrom.length > 0) filters.dateFrom = dateFrom;
      if (typeof dateTo === "string" && dateTo.length > 0) filters.dateTo = dateTo;

      const result = await returnStorage.getReturnRequests(filters);
      res.json(result);
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

      // Enforce transition guard
      const current = await returnStorage.getReturnRequest(req.params.id);
      if (!current) return res.status(404).json({ message: "Return request not found" });

      const allowed = RETURN_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: `Cannot transition from "${current.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
        });
      }

      const updated = await returnStorage.updateReturnRequestStatus(
        req.params.id,
        status,
        user?.id,
        inspectionNotes
      );

      if (!updated) return res.status(404).json({ message: "Return request not found" });

      res.json(updated);

      // Emit realtime event so inventory list and customer UI refresh automatically
      await publishRealtimeEvent("return_status_updated", {
        returnId: req.params.id,
        userId: current.userId,
        status,
      });
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
      
      // Handle both array and paginated response types
      const returnsArray = Array.isArray(allReturns) ? allReturns : allReturns.data || [];

      const stats = {
        total: returnsArray.length,
        ...returnStatusEnum.enumValues.reduce((acc, status) => {
          acc[status] = returnsArray.filter((r: any) => r.status === status).length;
          return acc;
        }, {} as Record<string, number>),
        byReason: returnsArray.reduce((acc: any, r: any) => {
          acc[r.reason] = (acc[r.reason] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byResolution: returnsArray.reduce((acc: any, r: any) => {
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
        exchangeproductId: item.exchangeproductId,
        condition: item.condition,
        isRestockable: item.isRestockable,
      }));

      const newReturn = await returnStorage.createReturnRequest(returnData, returnItemsData);
      const returnWithDetails = await returnStorage.getReturnRequest(newReturn.id);

      res.status(201).json(returnWithDetails);

      // Notify inventory team of new return in real time
      await publishRealtimeEvent("product_returned", {
        returnId: newReturn.id,
        userId,
        orderId,
      });
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

      const updated = await returnStorage.updateReturnRequestStatus(req.params.id, "return_cancelled");
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling return request:", error);
      res.status(500).json({ message: "Failed to cancel return request" });
    }
  });
};
