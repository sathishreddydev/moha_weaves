import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { createAuthMiddleware } from "../authMiddleware";
import { parsePaginationParams, createPaginatedResponse, getOffset } from "../paginationHelper";
import { storeService } from "./storeStorage";
import { stores } from "@shared/schema";

export const storeRoutes = (app: Express) => {
  const authStore = createAuthMiddleware(["store"]);

  app.get("/api/store/stats", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const stats = await storage.getStoreStats(user.storeId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/store/inventory", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const inventory = await storeService.getStoreInventory(user.storeId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  app.get("/api/store/products", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const products = await storeService.getShopAvailableProducts(user.storeId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });


  app.get("/api/store/sales/paginated", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      
      const params = parsePaginationParams(req.query);
      const offset = getOffset(params.page, params.pageSize);
      
      const result = await storeService.getStoreSalesPaginated(
        user.storeId,
        {
          limit: params.pageSize,
          offset,
          search: params.search,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }
      );
      
      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize
      );
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching paginated sales:", error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.get("/api/store/products/paginated", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      
      const params = parsePaginationParams(req.query);
      const offset = getOffset(params.page, params.pageSize);
      
      
      const result = await storage.getShopProductsPaginated(
        user.storeId,
        {
          limit: params.pageSize,
          offset,
          search: params.search,
          categoryId: req.query.categoryId as string,
          colorId: req.query.colorId as string,
          fabricId: req.query.fabricId as string,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }
      );
      
      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize
      );
      
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching paginated products:", error);
      res.status(500).json({ message: "Failed to fetch products", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/store/requests", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const requests = await storage.getStockRequests({
        storeId: user.storeId,
      });
      res.json(requests);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.post("/api/store/requests", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const { sareeId, quantity, notes } = req.body;
      const request = await storage.createStockRequest({
        storeId: user.storeId,
        requestedBy: user.id,
        sareeId,
        quantity,
        notes,
      });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to create request" });
    }
  });

  app.patch("/api/store/requests/:id/received", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const request = await storage.updateStockRequestStatus(
        req.params.id,
        "received",
        user.id
      );
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error marking request as received:", error);
      res.status(500).json({ message: "Failed to update request" });
    }
  });


  app.get("/api/store/sales/:id", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const sale = await storeService.getStoreSaleForExchange(req.params.id);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      if (sale.storeId !== user.storeId) {
        return res.status(403).json({ message: "Sale belongs to different store" });
      }
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });

  app.get("/api/store/store-exchanges", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const { limit } = req.query;
      const exchanges = await storeService.getStoreExchanges(
        user.storeId,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(exchanges);
    } catch (error) {
      console.error("Error fetching exchanges:", error);
      res.status(500).json({ message: "Failed to fetch exchanges" });
    }
  });

  app.post("/api/store/store-exchanges", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }

      const {
        originalSaleId,
        returnItems,
        newItems,
        reason,
        notes,
        customerName,
        customerPhone,
      } = req.body;

      const exchange = await storeService.createStoreExchangeWithValidation(
        user.storeId,
        user.id,
        {
          originalSaleId,
          returnItems,
          newItems,
          reason,
          notes,
          customerName,
          customerPhone,
        }
      );

      res.status(201).json(exchange);
    } catch (error) {
      console.error("Error creating store exchange:", error);
      const message = error instanceof Error ? error.message : "Failed to create exchange";
      res.status(400).json({ message });
    }
  });
};
