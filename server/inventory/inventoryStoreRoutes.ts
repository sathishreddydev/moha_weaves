import {
  storeExchanges,
  storeSales,
} from "@shared/schema";
import { gte, sql } from "drizzle-orm";
import type { Express } from "express";
import { allStoreOrdersService } from "server/store/allStoreOrders";
import { storeService } from "server/store/storeStorage";
import { createAuthMiddleware } from "../authMiddleware";
import { db } from "../db";
import { parsePaginationParams } from "../paginationHelper";
import { handleInventoryError } from "./errorHandling";

export const inventoryStoreRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);

  // Store sales (paginated)
  app.post("/api/inventory/store-sales", authInventory, async (req, res) => {
    try {
      const { page, pageSize } = req.query;
      const { search, dateFrom, dateTo, storeId } = req.body;

      if (page && pageSize) {
        const params = parsePaginationParams(req.query);
        const result = await allStoreOrdersService.getStoreSalesPaginatedInventory({
          page: params.page,
          pageSize: params.pageSize,
          search: search as string,
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
          storeId: storeId as string,
        });
        return res.json(result);
      }

      const storeSales = await storeService.getAllStoreSales();
      res.json(storeSales);
    } catch {
      res.status(500).json({ message: "Failed to fetch store sales" });
    }
  });

  // Store exchanges (paginated)
  app.post("/api/inventory/store-exchanges", authInventory, async (req, res) => {
    try {
      const { page, pageSize } = req.params;
      const { search, dateFrom, dateTo, storeId, exchangeType, reason, sort } = req.body;

      const pageNum = page ? parseInt(page as string, 10) : 1;
      const pageSizeNum = pageSize ? parseInt(pageSize as string, 10) : 10;

      const result = await allStoreOrdersService.getAllStoreExchangesPaginated({
        page: pageNum,
        pageSize: pageSizeNum,
        search: search as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        storeId: storeId as string,
        exchangeType: exchangeType as string,
        reason: reason as string,
        sort: sort as string,
      });

      res.json(result);
    } catch (error) {
      const errorResponse = handleInventoryError(error, process.env.NODE_ENV === "development");
      res.status(errorResponse.statusCode).json({
        message: errorResponse.message,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details }),
      });
    }
  });

  // Store sales stats (today + this week counts)
  app.get("/api/inventory/store-sales-stats", authInventory, async (req, res) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

      const [totalResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeSales);

      const [todayResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeSales)
        .where(gte(storeSales.createdAt, startOfToday));

      const [weekResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeSales)
        .where(gte(storeSales.createdAt, startOfWeek));

      res.json({
        total: totalResult?.count ?? 0,
        today: todayResult?.count ?? 0,
        thisWeek: weekResult?.count ?? 0,
      });
    } catch (error: any) {
      console.error("Error fetching store sales stats:", error);
      res.status(500).json({ message: "Failed to fetch store sales stats" });
    }
  });

  // Store exchanges stats (today + this week counts)
  app.get("/api/inventory/store-exchanges-stats", authInventory, async (req, res) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

      const [totalResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeExchanges);

      const [todayResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeExchanges)
        .where(gte(storeExchanges.createdAt, startOfToday));

      const [weekResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeExchanges)
        .where(gte(storeExchanges.createdAt, startOfWeek));

      res.json({
        total: totalResult?.count ?? 0,
        today: todayResult?.count ?? 0,
        thisWeek: weekResult?.count ?? 0,
      });
    } catch (error: any) {
      console.error("Error fetching store exchanges stats:", error);
      res.status(500).json({ message: "Failed to fetch store exchanges stats" });
    }
  });
};
