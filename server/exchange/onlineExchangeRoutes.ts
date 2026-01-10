import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  onlineExchanges,
  onlineExchangeItems,
  OnlineExchange,
  InsertOnlineExchange,
  OnlineExchangeItem,
  InsertOnlineExchangeItem,
  onlineExchangeStatusEnum,
} from "@shared/schema";
import { onlineExchangeStorage, type OnlineExchangeWithDetails } from "./onlineExchangeStorage";
import { createAuthMiddleware } from "../authMiddleware";
import { eq } from "drizzle-orm";
import { db } from "../db";

export const onlineExchangeRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);
  const authUser = createAuthMiddleware(["user"]);

  // User: Get all online exchanges for the logged-in user
  app.get("/api/user/online-exchanges", authUser, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const exchanges = await onlineExchangeStorage.getUserOnlineExchanges(userId);
      res.json(exchanges);
    } catch (error) {
      console.error("Error fetching online exchanges:", error);
      res.status(500).json({ error: "Failed to fetch online exchanges" });
    }
  });

  // User: Get specific online exchange
  app.get("/api/user/online-exchanges/:id", authUser, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const exchange = await onlineExchangeStorage.getOnlineExchange(id);
      
      if (!exchange) {
        return res.status(404).json({ error: "Online exchange not found" });
      }

      // Ensure user can only access their own exchanges
      if (exchange.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(exchange);
    } catch (error) {
      console.error("Error fetching online exchange:", error);
      res.status(500).json({ error: "Failed to fetch online exchange" });
    }
  });

  // User: Create new online exchange
  app.post("/api/user/online-exchanges", authUser, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const createExchangeSchema = z.object({
        orderId: z.string().min(1, "Order ID is required"),
        reason: z.enum(["defective", "wrong_item", "not_as_described", "size_issue", "color_mismatch", "damaged_in_shipping", "changed_mind", "quality_issue", "other"]),
        reasonDetails: z.string().optional(),
        pickupAddress: z.string().optional(),
        items: z.array(z.object({
          orderItemId: z.string().min(1, "Order item ID is required"),
          quantity: z.number().min(1, "Quantity must be at least 1"),
          exchangeproductId: z.string().optional(),
          condition: z.string().optional(),
          isRestockable: z.boolean().default(true),
        })).min(1, "At least one item is required"),
      });

      const validation = createExchangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.errors 
        });
      }

      const validatedData = validation.data;

      const exchangeData: InsertOnlineExchange = {
        orderId: validatedData.orderId,
        userId,
        status: "exchange_requested",
        reason: validatedData.reason,
        reasonDetails: validatedData.reasonDetails,
        pickupAddress: validatedData.pickupAddress,
      };

      const exchangeItems: Omit<InsertOnlineExchangeItem, 'exchangeId'>[] = validatedData.items.map((item: any) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        exchangeproductId: item.exchangeproductId,
        condition: item.condition,
        isRestockable: item.isRestockable,
      }));

      const newExchange = await onlineExchangeStorage.createOnlineExchange(exchangeData, exchangeItems);

      res.status(201).json(newExchange);
    } catch (error) {
      console.error("Error creating online exchange:", error);
      res.status(500).json({ error: "Failed to create online exchange" });
    }
  });

  app.patch("/api/user/online-exchanges/:id", authUser, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const updateExchangeSchema = z.object({
        reasonDetails: z.string().optional(),
        pickupAddress: z.string().optional(),
      });

      const validation = updateExchangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.errors 
        });
      }

      const existingExchange = await onlineExchangeStorage.getOnlineExchange(id);
      if (!existingExchange) {
        return res.status(404).json({ error: "Online exchange not found" });
      }

      if (existingExchange.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (existingExchange.status !== "exchange_requested") {
        return res.status(400).json({ error: "Cannot update exchange after it's been processed" });
      }

      const updatedExchange = await onlineExchangeStorage.updateOnlineExchange(id, validation.data);

      if (!updatedExchange) {
        return res.status(404).json({ error: "Online exchange not found" });
      }

      const { id: exchangeId, ...exchangeWithoutId } = updatedExchange;
      res.json(exchangeWithoutId);
    } catch (error) {
      console.error("Error updating online exchange:", error);
      res.status(500).json({ error: "Failed to update online exchange" });
    }
  });

  app.get("/api/user/online-exchanges/eligibility/:orderId", authUser, async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const eligibility = await onlineExchangeStorage.checkOrderOnlineExchangeEligibility(orderId);
      res.json(eligibility);
    } catch (error) {
      console.error("Error checking order eligibility:", error);
      res.status(500).json({ error: "Failed to check order eligibility" });
    }
  });

  app.get("/api/inventory/online-exchanges", authInventory, async (req: Request, res: Response) => {
    try {
      const { status, userId, page, pageSize, search, dateFrom, dateTo } = req.query;

      const filters: any = {};
      if (typeof status === "string" && status.length > 0) filters.status = status;
      if (typeof userId === "string" && userId.length > 0) filters.userId = userId;
      if (page && pageSize) {
        filters.page = parseInt(page as string);
        filters.pageSize = parseInt(pageSize as string);
      }
      if (typeof search === "string" && search.length > 0) filters.search = search;
      if (typeof dateFrom === "string" && dateFrom.length > 0) filters.dateFrom = dateFrom;
      if (typeof dateTo === "string" && dateTo.length > 0) filters.dateTo = dateTo;

      const result = await onlineExchangeStorage.getOnlineExchanges(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching admin online exchanges:", error);
      res.status(500).json({ error: "Failed to fetch online exchanges" });
    }
  });


  app.get("/api/inventory/online-exchanges/:id", authInventory, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const exchange = await onlineExchangeStorage.getOnlineExchange(id);
      
      if (!exchange) {
        return res.status(404).json({ error: "Online exchange not found" });
      }

      res.json(exchange);
    } catch (error) {
      console.error("Error fetching admin online exchange:", error);
      res.status(500).json({ error: "Failed to fetch online exchange" });
    }
  });

  app.patch("/api/inventory/exchanges/:id/status", authInventory, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const processedBy = req.user?.id;

      if (!processedBy) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validate request body
      const updateStatusSchema = z.object({
        status: z.enum(["exchange_requested", "exchange_approved", "exchange_processing", "exchange_pickup_scheduled", "exchange_picked_up", "exchange_in_transit", "exchange_received", "exchange_inspected", "exchange_shipped", "exchange_delivered", "exchange_completed", "exchange_cancelled"]),
        inspectionNotes: z.string().optional(),
        exchangeOrderId: z.string().optional(),
      });

      const validation = updateStatusSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.errors 
        });
      }

      const updatedExchange = await onlineExchangeStorage.updateOnlineExchangeStatus(
        id,
        validation.data.status,
        processedBy,
        validation.data.inspectionNotes,
        validation.data.exchangeOrderId
      );

      if (!updatedExchange) {
        return res.status(404).json({ error: "Online exchange not found" });
      }

      // Return exchange without ID as per our design
      const { id: exchangeId, ...exchangeWithoutId } = updatedExchange;
      res.json(exchangeWithoutId);
    } catch (error) {
      console.error("Error updating online exchange status:", error);
      res.status(500).json({ error: "Failed to update online exchange status" });
    }
  });

  // Add exchange statistics endpoint
  app.get("/api/inventory/exchanges/stats", authInventory, async (req: Request, res: Response) => {
    try {
      const allExchanges = await onlineExchangeStorage.getOnlineExchanges();
      
      // Handle both array and paginated response types
      const exchangesArray = Array.isArray(allExchanges) ? allExchanges : allExchanges.data || [];

      const stats = {
        total: exchangesArray.length,
        ...onlineExchangeStatusEnum.enumValues.reduce((acc, status) => {
          acc[status] = exchangesArray.filter((r: any) => r.status === status).length;
          return acc;
        }, {} as Record<string, number>),
        byReason: exchangesArray.reduce((acc: any, r: any) => {
          acc[r.reason] = (acc[r.reason] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching exchange stats:", error);
      res.status(500).json({ message: "Failed to fetch exchange statistics" });
    }
  });
};
