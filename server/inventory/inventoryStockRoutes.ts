import { products, stockMovements } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { roleBasedProductService } from "server/product/roleBasedProductService";
import { createAuthMiddleware } from "../authMiddleware";
import { db } from "../db";
import { parsePaginationParams } from "../paginationHelper";
import { storage } from "../storage";
import { stockValidationService } from "./stockValidationService";

export const inventoryStockRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);

  // Low stock items
  app.get("/api/inventory/low-stock", authInventory, async (req, res) => {
    try {
      const items = await roleBasedProductService.getProductsByRole({ limit: 10 }, "inventory");
      res.json(items.filter((item) => item.totalStock <= 10));
    } catch {
      res.status(500).json({ message: "Failed to fetch low stock items" });
    }
  });

  // Inventory overview
  app.get("/api/inventory/overview", authInventory, async (req, res) => {
    try {
      const overview = await storage.getInventoryOverview();
      res.json(overview);
    } catch {
      res.status(500).json({ message: "Failed to fetch inventory overview" });
    }
  });

  // Stock movements (paginated POST)
  app.post("/api/inventory/stock-movements", authInventory, async (req, res) => {
    try {
      const page = req.body.page || req.query.page;
      const pageSize = req.body.pageSize || req.query.pageSize;
      const { search, source, movementType } = req.body;

      const movements = await storage.getStockMovements({
        page: page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : 20,
        search: search as string,
        source: source as string,
        movementType: movementType as string,
      });

      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch stock movements",
        error: process.env.NODE_ENV === "development" ? message : undefined,
      });
    }
  });

  // Validate stock for a specific product
  app.get("/api/inventory/validate-stock/:productId", authInventory, async (req, res) => {
    try {
      const validation = await stockValidationService.validateProductStock(req.params.productId);
      res.json(validation);
    } catch (error: any) {
      console.error("Error validating product stock:", error);
      res.status(500).json({
        message: "Failed to validate product stock",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Validate stock for all products
  app.get("/api/inventory/validate-all-stock", authInventory, async (req, res) => {
    try {
      const validation = await stockValidationService.validateAllStock();
      res.json(validation);
    } catch (error: any) {
      console.error("Error validating all stock:", error);
      res.status(500).json({
        message: "Failed to validate all stock",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Stock reconciliation data
  app.get("/api/inventory/stock-reconciliation", authInventory, async (req, res) => {
    try {
      const reconciliationData = await stockValidationService.getStockReconciliationData();
      res.json(reconciliationData);
    } catch (error: any) {
      console.error("Error getting stock reconciliation data:", error);
      res.status(500).json({
        message: "Failed to get stock reconciliation data",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Fix stock discrepancies
  app.post("/api/inventory/fix-stock-discrepancies", authInventory, async (req, res) => {
    try {
      const { productIds } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "productIds must be a non-empty array" });
      }

      const result = await stockValidationService.fixStockDiscrepancies(productIds);

      console.log(`Stock discrepancy fix attempted by user ${(req as any).user.id}:`, result);

      res.json({
        message: "Stock discrepancy fix completed",
        fixed: result.fixed,
        failed: result.failed,
        totalProcessed: productIds.length,
      });
    } catch (error: any) {
      console.error("Error fixing stock discrepancies:", error);
      res.status(500).json({
        message: "Failed to fix stock discrepancies",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Batch stock update
  app.post("/api/inventory/batch-stock-update", authInventory, async (req, res) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "updates must be a non-empty array" });
      }

      for (const update of updates) {
        if (
          !update.productId ||
          typeof update.totalStock !== "number" ||
          typeof update.onlineStock !== "number"
        ) {
          return res.status(400).json({
            message: "Invalid update format. Each update must have productId, totalStock, and onlineStock",
          });
        }
      }

      const results = await db.transaction(async (tx) => {
        const processed = [];

        for (const update of updates) {
          try {
            const [currentProduct] = await tx
              .select()
              .from(products)
              .where(eq(products.id, update.productId))
              .for("update");

            if (!currentProduct) {
              processed.push({ productId: update.productId, success: false, error: "Product not found" });
              continue;
            }

            if (update.totalStock < 0 || update.onlineStock < 0) {
              processed.push({ productId: update.productId, success: false, error: "Stock values cannot be negative" });
              continue;
            }

            if (update.onlineStock > update.totalStock) {
              processed.push({ productId: update.productId, success: false, error: "Online stock cannot exceed total stock" });
              continue;
            }

            const [updatedProduct] = await tx
              .update(products)
              .set({ totalStock: update.totalStock, onlineStock: update.onlineStock, updatedAt: new Date() })
              .where(eq(products.id, update.productId))
              .returning();

            const totalChange = update.totalStock - currentProduct.totalStock;

            if (totalChange !== 0) {
              await tx.insert(stockMovements).values({
                productId: update.productId,
                quantity: totalChange,
                movementType: "adjustment",
                source: "online",
                orderRefId: "",
                notes: `Batch stock update: Total ${currentProduct.totalStock} → ${update.totalStock}, Online ${currentProduct.onlineStock} → ${update.onlineStock}`,
                createdAt: new Date(),
              });
            }

            processed.push({
              productId: update.productId,
              success: true,
              previousStock: { total: currentProduct.totalStock, online: currentProduct.onlineStock },
              newStock: { total: updatedProduct.totalStock, online: updatedProduct.onlineStock },
            });
          } catch (error: any) {
            processed.push({ productId: update.productId, success: false, error: error.message });
          }
        }

        return processed;
      });

      console.log(`Batch stock update performed by user ${(req as any).user.id}:`, {
        totalUpdates: updates.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      });

      res.json({
        message: "Batch stock update completed",
        results,
        summary: {
          total: updates.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      });
    } catch (error: any) {
      console.error("Error in batch stock update:", error);
      res.status(500).json({
        message: "Failed to perform batch stock update",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // Inventory valuation
  app.get("/api/inventory/valuation", authInventory, async (req, res) => {
    try {
      const allProducts = await roleBasedProductService.getProductsByRole({}, "inventory");

      let totalValue = 0;
      let totalStock = 0;
      let totalCostValue = 0;
      const categoryBreakdown: Record<string, { value: number; stock: number; costValue: number; count: number }> = {};

      allProducts.forEach((product) => {
        const stockValue = (parseFloat(product.price) || 0) * (product.totalStock || 0);
        const costValue = (parseFloat(product.actualPrice || product.price || "0") || 0) * (product.totalStock || 0);

        totalValue += stockValue;
        totalCostValue += costValue;
        totalStock += product.totalStock || 0;

        const categoryName = product.category?.name || "Uncategorized";
        if (!categoryBreakdown[categoryName]) {
          categoryBreakdown[categoryName] = { value: 0, stock: 0, costValue: 0, count: 0 };
        }
        categoryBreakdown[categoryName].value += stockValue;
        categoryBreakdown[categoryName].costValue += costValue;
        categoryBreakdown[categoryName].stock += product.totalStock || 0;
        categoryBreakdown[categoryName].count += 1;
      });

      const profitPotential = totalValue - totalCostValue;
      const profitMargin = totalValue > 0 ? (profitPotential / totalValue) * 100 : 0;

      const sortedCategories = Object.entries(categoryBreakdown)
        .sort(([, a], [, b]) => b.value - a.value)
        .map(([name, data]) => ({
          category: name,
          value: data.value,
          costValue: data.costValue,
          stock: data.stock,
          count: data.count,
          avgPricePerUnit: data.stock > 0 ? data.value / data.stock : 0,
          profitPotential: data.value - data.costValue,
        }));

      const lowStockItems = allProducts.filter((p) => (p.totalStock || 0) <= 10);
      const lowStockValue = lowStockItems.reduce(
        (sum, item) => sum + (parseFloat(item.price) || 0) * (item.totalStock || 0),
        0,
      );
      const deadStockCount = allProducts.filter((p) => (p.totalStock || 0) === 0).length;

      res.json({
        summary: {
          totalValue,
          totalCostValue,
          profitPotential,
          profitMargin,
          totalStock,
          totalProducts: allProducts.length,
          lowStockValue,
          lowStockCount: lowStockItems.length,
          deadStockCount,
          avgValuePerProduct: allProducts.length > 0 ? totalValue / allProducts.length : 0,
        },
        categoryBreakdown: sortedCategories,
        topValuedProducts: [...allProducts]
          .sort(
            (a, b) =>
              (parseFloat(b.price) || 0) * (b.totalStock || 0) -
              (parseFloat(a.price) || 0) * (a.totalStock || 0),
          )
          .slice(0, 10)
          .map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: parseFloat(product.price) || 0,
            totalStock: product.totalStock || 0,
            totalValue: (parseFloat(product.price) || 0) * (product.totalStock || 0),
            categoryName: product.category?.name || "Uncategorized",
          })),
        lowStockItems: lowStockItems.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: parseFloat(product.price) || 0,
          totalStock: product.totalStock || 0,
          totalValue: (parseFloat(product.price) || 0) * (product.totalStock || 0),
          categoryName: product.category?.name || "Uncategorized",
        })),
        lastCalculated: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error fetching inventory valuation:", error);
      res.status(500).json({
        message: "Failed to fetch inventory valuation",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });
};
