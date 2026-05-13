import type { Express } from "express";
import { inventoryAnalyticsRoutes } from "./inventoryAnalyticsRoutes";
import { inventoryDamageRoutes } from "./inventoryDamageRoutes";
import { inventoryOrderRoutes } from "./inventoryOrderRoutes";
import { inventoryRefundRoutes } from "./inventoryRefundRoutes";
import { inventoryStockRoutes } from "./inventoryStockRoutes";
import { inventoryStoreRoutes } from "./inventoryStoreRoutes";
import { inventoryProductRoutes } from "./inventoryProductRoutes";

export const inventoryRoutes = (app: Express) => {
  inventoryProductRoutes(app)
  inventoryRefundRoutes(app);   // /api/inventory/refunds/*
  inventoryOrderRoutes(app);    // /api/inventory/orders/:id/status, items/:itemId/status
  inventoryStockRoutes(app);    // /api/inventory/low-stock, overview, stock-movements, valuation, validate-*, batch-*
  inventoryAnalyticsRoutes(app); // /api/inventory/analytics/*
  inventoryStoreRoutes(app);    // /api/inventory/store-sales, store-exchanges
  inventoryDamageRoutes(app);   // /api/inventory/damages*, damage-analytics
};
