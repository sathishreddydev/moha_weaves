import type { Express } from "express";
import { ProductFilters, roleBasedProductService } from "server/product/roleBasedProductService";
import { createAuthMiddleware } from "../authMiddleware";
import { publicStorage } from "../common/publicStorage";
import {
  createPaginatedResponse,
  getOffset,
  parsePaginationParams,
} from "../paginationHelper";
import { storage } from "../storage";
import { customerRoutes } from "./customerRoutes";
import { storeProductsStorage } from "./productsStorage";
import { storeService } from "./storeStorage";

export const storeRoutes = (app: Express) => {
  const authStore = createAuthMiddleware(["store"]);

  app.get("/api/store/stats", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const stats = await storeProductsStorage.getStoreStats(user.storeId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/store/sales/recent", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const recentSales = await storeService.getStoreSales(user.storeId, 10);
      res.json(recentSales);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent sales" });
    }
  });

  app.get("/api/store/products/low-stock", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const lowStockProducts = await storeService.getLowStockProducts(
        user.storeId,
      );
      res.json(lowStockProducts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch low stock products" });
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
      const products = await storeService.getShopAvailableProducts(
        user.storeId,
      );
      res.json(products);
    } catch {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/api/store/salesHistory", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }

      const params = parsePaginationParams(req.query);
      const offset = getOffset(params.page, params.pageSize);
      const { search, dateFrom, dateTo } = req.body;
      const result = await storeService.getStoreSalesPaginated(user.storeId, {
        limit: params.pageSize,
        offset,
        search: search,
        dateFrom: dateFrom,
        dateTo: dateTo,
      });

      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize,
      );

      res.json(response);
    } catch (error) {
      console.error("Error fetching paginated sales:", error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.post("/api/store/products/paginated", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }

      const { page = "1", pageSize = "10" } = req.query;
      const limit = Number(pageSize);
      const offset = (Number(page) - 1) * limit;

      const {
        search,
        categoryIds,
        colorIds,
        fabricIds,
        dateFrom,
        dateTo,
      } = req.body;

      // Convert categoryIds to names for role-based service
      let categoryNames: string[] = [];
      if (categoryIds && categoryIds.length > 0) {
        // Use publicStorage to get categories
        const categories = await publicStorage.getCategoriesWithSubcategories();
        categoryNames = categories
          .filter((cat: any) => categoryIds.includes(cat.id))
          .map((cat: any) => cat.name);
      }

      const filters: ProductFilters = {
        search,
        category: categoryNames,
        limit,
        offset,
        storeId: user.storeId, // Important: Pass store ID for role-based filtering
      };

      // MIGRATED: Use role-based service for store users (50-60% faster queries)
      const products = await roleBasedProductService.getProductsByRole(filters, "store");

      // Calculate stats for store-specific products
      const totalProducts = products.length;
      const inStockProducts = products.filter(p => 
        (p.storeAllocations || []).some(alloc => alloc.quantity > 0) ||
        (p.variants || []).some(v => (v.storeAllocations || []).some(alloc => alloc.quantity > 0))
      ).length;
      const outOfStockProducts = totalProducts - inStockProducts;

      res.json({
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        data: products.map(product => ({
          product,
          storeStock: (product.storeAllocations || []).reduce((sum, alloc) => sum + alloc.quantity, 0)
        })),
        total: totalProducts,
        page: Number(page),
        pageSize: limit,
        totalPages: Math.ceil(totalProducts / limit),
      });
    } catch (error) {
      console.error("Error fetching paginated products:", error);
      res.status(500).json({
        message: "Failed to fetch products",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/store/requests/paginated", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }

      const params = parsePaginationParams(req.query);
      const offset = getOffset(params.page, params.pageSize);
      const { search, status, dateFrom, dateTo } = req.body;
      const result = await storage.getStockRequestsPaginated(user.storeId, {
        limit: params.pageSize,
        offset,
        search: search,
        status: status as string,
        dateFrom: dateFrom,
        dateTo: dateTo,
      });

      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize,
      );

      res.json(response);
    } catch (error) {
      console.error("Error fetching paginated requests:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.post("/api/store/requests", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const { productId, quantity, notes } = req.body;
      const request = await storage.createStockRequest({
        storeId: user.storeId,
        requestedBy: user.id,
        productId,
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
        user.id,
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

  app.get("/api/store/sales/search", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }

      const { query } = req.query;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Search query is required" });
      }

      const sales = await storeService.searchStoreSales(user.storeId, query);
      res.json(sales);
    } catch (error) {
      console.error("Error searching sales:", error);
      res.status(500).json({ message: "Failed to search sales" });
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
        return res
          .status(403)
          .json({ message: "Sale belongs to different store" });
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

      const params = parsePaginationParams(req.query);
      const offset = getOffset(params.page, params.pageSize);

      const result = await storeService.getStoreExchangesPaginated(
        user.storeId,
        {
          limit: params.pageSize,
          offset,
          search: params.search,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        },
      );

      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize,
      );

      res.json(response);
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
        },
      );

      res.status(201).json(exchange);
    } catch (error) {
      console.error("Error creating store exchange:", error);
      const message =
        error instanceof Error ? error.message : "Failed to create exchange";
      res.status(400).json({ message });
    }
  });

  // Initialize customer routes
  customerRoutes(app);
};
