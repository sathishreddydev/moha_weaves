import type { Express, Request, Response } from "express";
import { exchangeStorage } from "./exchangeStorage";
import { createAuthMiddleware } from "../authMiddleware";
import { 
  returnStatusEnum,
  returnReasonEnum,
  returnResolutionEnum,
  InsertReturnRequest,
  InsertReturnItem
} from "@shared/schema";
import type { ExchangeRequestWithDetails } from "./exchangeStorage";

export const exchangeRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);
  const authUser = createAuthMiddleware(["user"]);

  // Admin: Get all exchange requests with filtering
  app.get("/api/inventory/exchanges", authInventory, async (req: Request, res: Response) => {
    try {
      const { status, userId, resolution } = req.query;

      const filters: any = {};
      if (typeof status === "string" && status.length > 0) filters.status = status;
      if (typeof userId === "string" && userId.length > 0) filters.userId = userId;
      if (typeof resolution === "string" && resolution.length > 0) filters.resolution = resolution;

      const exchanges = await exchangeStorage.getExchangeRequests(filters);
      res.json(exchanges);
    } catch (error) {
      console.error("Error fetching exchange requests:", error);
      res.status(500).json({ message: "Failed to fetch exchange requests" });
    }
  });

  // Admin: Get specific exchange request details
  app.get("/api/inventory/exchanges/:id", authInventory, async (req: Request, res: Response) => {
    try {
      const exchangeRequest = await exchangeStorage.getExchangeRequest(req.params.id);
      if (!exchangeRequest) {
        return res.status(404).json({ message: "Exchange request not found" });
      }
      res.json(exchangeRequest);
    } catch (error) {
      console.error("Error fetching exchange request:", error);
      res.status(500).json({ message: "Failed to fetch exchange request" });
    }
  });

  // Admin: Update exchange request status
  app.patch("/api/inventory/exchanges/:id/status", authInventory, async (req: Request, res: Response) => {
    try {
      const { status, inspectionNotes, exchangeOrderId } = req.body;
      const user = (req as any).user;

      if (!Object.values(returnStatusEnum.enumValues).includes(status)) {
        return res.status(400).json({ message: "Invalid exchange status" });
      }

      const updated = await exchangeStorage.updateExchangeRequestStatus(
        req.params.id,
        status,
        user?.id,
        inspectionNotes,
        exchangeOrderId
      );

      if (!updated) {
        return res.status(404).json({ message: "Exchange request not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating exchange status:", error);
      res.status(500).json({ message: "Failed to update exchange status" });
    }
  });

  // Admin: Update exchange request details
  app.patch("/api/inventory/exchanges/:id", authInventory, async (req: Request, res: Response) => {
    try {
      const { pickupAddress, pickupScheduledAt, exchangeOrderId } = req.body;

      const updateData: any = {};
      if (pickupAddress !== undefined) updateData.pickupAddress = pickupAddress;
      if (pickupScheduledAt !== undefined) updateData.pickupScheduledAt = new Date(pickupScheduledAt);
      if (exchangeOrderId !== undefined) updateData.exchangeOrderId = exchangeOrderId;

      const updated = await exchangeStorage.updateExchangeRequest(req.params.id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Exchange request not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating exchange request:", error);
      res.status(500).json({ message: "Failed to update exchange request" });
    }
  });

  // Admin: Get exchange statistics
  app.get("/api/inventory/exchanges/stats", authInventory, async (req: Request, res: Response) => {
    try {
      const allExchanges = await exchangeStorage.getExchangeRequests();

      const stats = {
        total: allExchanges.length,
        requested: allExchanges.filter((e) => e.status === "requested").length,
        approved: allExchanges.filter((e) => e.status === "approved").length,
        rejected: allExchanges.filter((e) => e.status === "rejected").length,
        pickup_scheduled: allExchanges.filter((e) => e.status === "pickup_scheduled").length,
        picked_up: allExchanges.filter((e) => e.status === "picked_up").length,
        in_transit: allExchanges.filter((e) => e.status === "in_transit").length,
        received: allExchanges.filter((e) => e.status === "received").length,
        inspected: allExchanges.filter((e) => e.status === "inspected").length,
        completed: allExchanges.filter((e) => e.status === "completed").length,
        cancelled: allExchanges.filter((e) => e.status === "cancelled").length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching exchange stats:", error);
      res.status(500).json({ message: "Failed to fetch exchange statistics" });
    }
  });

  // User: Get their exchange requests
  app.get("/api/user/exchanges", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      const exchanges = await exchangeStorage.getUserExchangeRequests(userId);
      res.json(exchanges);
    } catch (error) {
      console.error("Error fetching user exchanges:", error);
      res.status(500).json({ message: "Failed to fetch exchange requests" });
    }
  });

  // User: Create new exchange request
  app.post("/api/user/exchanges", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { orderId, reason, reasonDetails, items } = req.body;

      // Validate input
      if (!orderId || !reason || !items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!Object.values(returnReasonEnum.enumValues).includes(reason)) {
        return res.status(400).json({ message: "Invalid exchange reason" });
      }

      // Check order exchange eligibility
      const eligibility = await exchangeStorage.checkOrderExchangeEligibility(orderId);
      if (!eligibility.eligible) {
        return res.status(400).json({ 
          message: "Order not eligible for exchange", 
          reason: eligibility.reason 
        });
      }

      // Create exchange request
      const exchangeData: InsertReturnRequest = {
        orderId,
        userId,
        status: "requested",
        reason,
        reasonDetails,
        resolution: "exchange",
      };

      const exchangeItemsData: Omit<InsertReturnItem, 'returnRequestId'>[] = items.map((item: any) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        exchangeSareeId: item.exchangeSareeId,
        condition: item.condition,
        isRestockable: item.isRestockable,
      }));

      const newExchange = await exchangeStorage.createExchangeRequest(exchangeData, exchangeItemsData);
      
      // Get the complete exchange request with details
      const exchangeWithDetails = await exchangeStorage.getExchangeRequest(newExchange.id);
      
      res.status(201).json(exchangeWithDetails);
    } catch (error) {
      console.error("Error creating exchange request:", error);
      res.status(500).json({ message: "Failed to create exchange request" });
    }
  });

  // User: Get specific exchange request
  app.get("/api/user/exchanges/:id", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const exchangeRequest = await exchangeStorage.getExchangeRequest(req.params.id);

      if (!exchangeRequest || exchangeRequest.userId !== userId) {
        return res.status(404).json({ message: "Exchange request not found" });
      }

      res.json(exchangeRequest);
    } catch (error) {
      console.error("Error fetching exchange request:", error);
      res.status(500).json({ message: "Failed to fetch exchange request" });
    }
  });

  // User: Check order exchange eligibility
  app.get("/api/user/orders/:orderId/exchange-eligibility", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { orderId } = req.params;

      // Verify user owns the order
      const order = await exchangeStorage.getOrder(orderId);
      if (!order || order.userId !== userId) {
        return res.status(404).json({ message: "Order not found" });
      }

      const eligibility = await exchangeStorage.checkOrderExchangeEligibility(orderId);
      res.json(eligibility);
    } catch (error) {
      console.error("Error checking exchange eligibility:", error);
      res.status(500).json({ message: "Failed to check exchange eligibility" });
    }
  });

  // User: Cancel exchange request (only if in requested status)
  app.patch("/api/user/exchanges/:id/cancel", authUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const exchangeRequest = await exchangeStorage.getExchangeRequest(req.params.id);

      if (!exchangeRequest || exchangeRequest.userId !== userId) {
        return res.status(404).json({ message: "Exchange request not found" });
      }

      if (exchangeRequest.status !== "requested") {
        return res.status(400).json({ message: "Cannot cancel exchange request in current status" });
      }

      const updated = await exchangeStorage.updateExchangeRequestStatus(req.params.id, "cancelled");
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling exchange request:", error);
      res.status(500).json({ message: "Failed to cancel exchange request" });
    }
  });

  // Store exchange routes (for in-store exchanges)

  // Admin: Get all store exchanges
  app.get("/api/inventory/store-exchanges", authInventory, async (req: Request, res: Response) => {
    try {
      const { status, storeId } = req.query;

      const filters: any = {};
      if (typeof status === "string" && status.length > 0) filters.status = status;
      if (typeof storeId === "string" && storeId.length > 0) filters.storeId = storeId;

      const storeExchanges = await exchangeStorage.getStoreExchanges(filters);
      res.json(storeExchanges);
    } catch (error) {
      console.error("Error fetching store exchanges:", error);
      res.status(500).json({ message: "Failed to fetch store exchanges" });
    }
  });

  // Admin: Get specific store exchange details
  app.get("/api/inventory/store-exchanges/:id", authInventory, async (req: Request, res: Response) => {
    try {
      const storeExchange = await exchangeStorage.getStoreExchange(req.params.id);
      if (!storeExchange) {
        return res.status(404).json({ message: "Store exchange not found" });
      }
      res.json(storeExchange);
    } catch (error) {
      console.error("Error fetching store exchange:", error);
      res.status(500).json({ message: "Failed to fetch store exchange" });
    }
  });

  // Store: Create new store exchange
  app.post("/api/store/exchanges", authInventory, async (req: Request, res: Response) => {
    try {
      const { storeId, originalSaleId, customerName, customerPhone, reason, notes, returnItems, newItems } = req.body;

      // Validate input
      if (!storeId || !originalSaleId || !returnItems || !Array.isArray(returnItems) || !newItems || !Array.isArray(newItems)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const storeExchangeData = {
        storeId,
        originalSaleId,
        processedBy: (req as any).user?.id,
        customerName,
        customerPhone,
        reason,
        notes,
        status: "completed", // Store exchanges are typically completed immediately
      };

      const newStoreExchange = await exchangeStorage.createStoreExchange(storeExchangeData, returnItems, newItems);

      // Get the complete store exchange with details
      const storeExchangeWithDetails = await exchangeStorage.getStoreExchange(newStoreExchange.id);

      res.status(201).json(storeExchangeWithDetails);
    } catch (error) {
      console.error("Error creating store exchange:", error);
      res.status(500).json({ message: "Failed to create store exchange" });
    }
  });

  // Store: Update store exchange status
  app.patch("/api/store/exchanges/:id/status", authInventory, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;

      const updated = await exchangeStorage.updateStoreExchangeStatus(req.params.id, status);

      if (!updated) {
        return res.status(404).json({ message: "Store exchange not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating store exchange status:", error);
      res.status(500).json({ message: "Failed to update store exchange status" });
    }
  });

  // Admin: Update exchange order status (exchange_processing -> exchange_shipped -> exchange_delivered)
  app.patch("/api/inventory/exchanges/:id/order-status", authInventory, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const user = (req as any).user;

      const validStatuses = ["exchange_processing", "exchange_shipped", "exchange_delivered"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid exchange order status" });
      }

      const exchangeRequest = await exchangeStorage.getExchangeRequest(req.params.id);
      if (!exchangeRequest) {
        return res.status(404).json({ message: "Exchange request not found" });
      }

      // Update the original order status
      const updated = await exchangeStorage.updateExchangeOrderStatus(
        exchangeRequest.orderId,
        status,
        user?.id
      );

      if (!updated) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Create notification for customer
      await exchangeStorage.createExchangeStatusNotification(
        exchangeRequest.userId,
        exchangeRequest.orderId,
        status
      );

      res.json({ message: "Exchange order status updated successfully", order: updated });
    } catch (error) {
      console.error("Error updating exchange order status:", error);
      res.status(500).json({ message: "Failed to update exchange order status" });
    }
  });

  // Admin: Update exchange item status (item-level tracking)
  app.patch("/api/inventory/exchanges/:id/item-status", authInventory, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const user = (req as any).user;

      const validStatuses = ["exchange_processing", "exchange_shipped", "exchange_delivered"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid exchange item status" });
      }

      const exchangeRequest = await exchangeStorage.getExchangeRequest(req.params.id);
      if (!exchangeRequest) {
        return res.status(404).json({ message: "Exchange request not found" });
      }

      // Update the exchange request status (item-level)
      const updated = await exchangeStorage.updateExchangeItemStatus(
        req.params.id,
        status,
        user?.id
      );

      if (!updated) {
        return res.status(404).json({ message: "Exchange request not found" });
      }

      res.json({ message: "Exchange item status updated successfully", exchangeRequest: updated });
    } catch (error) {
      console.error("Error updating exchange item status:", error);
      res.status(500).json({ message: "Failed to update exchange item status" });
    }
  });
};
