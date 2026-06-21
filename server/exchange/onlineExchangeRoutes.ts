import {
  onlineExchangeStatusEnum
} from "@shared/schema";
import type { Express, Request, Response } from "express";
import { publishRealtimeEvent } from "realtime/events";
import { z } from "zod";
import { createAuthMiddleware } from "../authMiddleware";
import { EXCHANGE_TRANSITIONS, onlineExchangeStorage } from "./onlineExchangeStorage";

export const onlineExchangeRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);

  app.post("/api/inventory/online-exchanges", authInventory, async (req: Request, res: Response) => {
    try {
      const {  page, pageSize } = req.query;
      const { userId,status, search, dateFrom, dateTo } = req.body;
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

  // Fix 10: Correct URL — was /api/inventory/exchanges/:id/status, must be /api/inventory/online-exchanges/:id/status
  app.patch("/api/inventory/online-exchanges/:id/status", authInventory, async (req: Request, res: Response) => {
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

      // Fix 11: Enforce transition guard before calling storage
      const existing = await onlineExchangeStorage.getOnlineExchange(id);
      if (!existing) {
        return res.status(404).json({ error: "Online exchange not found" });
      }
      const allowed = EXCHANGE_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(validation.data.status)) {
        return res.status(400).json({
          error: `Invalid status transition: cannot move from "${existing.status}" to "${validation.data.status}"`,
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
      const { ...exchangeWithoutId } = updatedExchange;
      res.json(exchangeWithoutId);

      // Emit realtime event after response so the client gets the response first
      await publishRealtimeEvent("exchange_status_updated", {
        exchangeId: id,
        userId: existing.userId,
        status: validation.data.status,
      });
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
