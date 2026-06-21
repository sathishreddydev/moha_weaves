import { insertProductDamageSchema } from "@shared/schema";
import type { Express } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { parsePaginationParams } from "../paginationHelper";
import { productDamageService } from "./productDamageService";

export const inventoryDamageRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);

  // Report product damage
  app.post("/api/inventory/damages", authInventory, async (req, res) => {
    try {
      const validatedData = insertProductDamageSchema.parse(req.body);

      const damageData = {
        productId: validatedData.productId,
        variantId: validatedData.variantId,
        source: validatedData.source,
        stockReductions: validatedData.stockReductions,
        damageCategory: validatedData.damageCategory,
        damageSeverity: validatedData.damageSeverity,
        reason: validatedData.reason,
        reportedBy: req.user!.id,
        costValue: validatedData.costValue,
        recoveryValue: validatedData.recoveryValue,
        disposalMethod: validatedData.disposalMethod,
        notes: validatedData.notes,
        allocationType: validatedData.allocationType,
      };

      const damage = await productDamageService.reportDamage(damageData);
      res.status(201).json(damage);
    } catch (error) {
      console.error("Failed to report damage:", error);

      if (error instanceof Error) {
        if (error.message.includes("validation")) {
          return res.status(400).json({ message: "Validation failed", error: error.message });
        }
        if (error.message.includes("permission") || error.message.includes("Insufficient permissions")) {
          return res.status(403).json({ message: "Permission denied", error: error.message });
        }
        if (error.message.includes("stock") || error.message.includes("Insufficient")) {
          return res.status(409).json({ message: "Stock validation failed", error: error.message });
        }
        if (error.message.includes("consistency") || error.message.includes("not found")) {
          return res.status(400).json({ message: "Data validation failed", error: error.message });
        }
      }

      res.status(500).json({
        message: "Failed to report damage",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : "Unknown error") : undefined,
      });
    }
  });

  // Get all damages (paginated)
  app.post("/api/inventory/getDamages", authInventory, async (req, res) => {
    try {
      const { productId, source, status, category, severity, dateFrom, dateTo, search, page = 1, pageSize = 10 } = req.body;
      const params = parsePaginationParams({ page, pageSize });

      const result = await productDamageService.getDamages({
        productId: productId as string,
        source: source as "store" | "online_return" | "warehouse" | "shipping" | "manufacturing",
        status: status as string,
        category: category as "manufacturing_defect" | "shipping_damage" | "storage_damage" | "handling_damage" | "customer_damage" | "expired" | "theft_loss" | "other" | undefined,
        severity: severity as "minor" | "major" | "total_loss" | undefined,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        search: search as string,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      });

      return res.json({
        data: result.data,
        total: result.total,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: Math.ceil(result.total / params.pageSize),
      });
    } catch (error) {
      console.error("Failed to fetch damages:", error);

      if (error instanceof Error && (error.message.includes("validation") || error.message.includes("Invalid"))) {
        return res.status(400).json({ message: "Invalid request parameters", error: error.message });
      }

      res.status(500).json({
        message: "Failed to fetch damages",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : "Unknown error") : undefined,
      });
    }
  });

  // Damage analytics
  app.get("/api/inventory/damage-analytics", authInventory, async (req, res) => {
    try {
      const { productId, source, dateFrom, dateTo } = req.query;

      const analytics = await productDamageService.getDamageAnalytics({
        productId: productId as string,
        source: source as "store" | "online_return" | "warehouse" | "shipping" | "manufacturing",
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      });

      res.json(analytics);
    } catch (error) {
      console.error("Failed to fetch damage analytics:", error);

      if (error instanceof Error && (error.message.includes("validation") || error.message.includes("Invalid"))) {
        return res.status(400).json({ message: "Invalid request parameters", error: error.message });
      }

      res.status(500).json({
        message: "Failed to fetch damage analytics",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : "Unknown error") : undefined,
      });
    }
  });

  // Get damage by ID
  app.get("/api/inventory/damages/:id", authInventory, async (req, res) => {
    try {
      const damage = await productDamageService.getDamageById(req.params.id);

      if (!damage) {
        return res.status(404).json({ message: "Damage not found" });
      }

      res.json(damage);
    } catch (error) {
      console.error("Failed to fetch damage:", error);

      if (error instanceof Error && (error.message.includes("validation") || error.message.includes("Invalid"))) {
        return res.status(400).json({ message: "Invalid request parameters", error: error.message });
      }

      res.status(500).json({
        message: "Failed to fetch damage",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : "Unknown error") : undefined,
      });
    }
  });

  // Update damage status
  app.patch("/api/inventory/damages/:id/status", authInventory, async (req, res) => {
    try {
      const { status, notes } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const damage = await productDamageService.updateDamageStatus(req.params.id, status, req.user!.id, notes);
      res.json(damage);
    } catch (error) {
      console.error("Failed to update damage status:", error);

      if (error instanceof Error) {
        if (error.message.includes("validation") || error.message.includes("Invalid")) {
          return res.status(400).json({ message: "Invalid request parameters", error: error.message });
        }
        if (error.message.includes("permission") || error.message.includes("Insufficient permissions")) {
          return res.status(403).json({ message: "Permission denied", error: error.message });
        }
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: "Damage record not found", error: error.message });
        }
      }

      res.status(500).json({
        message: "Failed to update damage status",
        error: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : "Unknown error") : undefined,
      });
    }
  });
};
