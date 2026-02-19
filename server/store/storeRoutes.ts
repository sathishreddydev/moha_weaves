import type { Express } from "express";
import { ProductFilters, roleBasedProductService } from "server/product/roleBasedProductService";
import { createAuthMiddleware } from "../authMiddleware";
import {
  createPaginatedResponse,
  getOffset,
  parsePaginationParams,
} from "../paginationHelper";
import { razorpay } from "../razorpayClient";
import { customerRoutes } from "./customerRoutes";
import { formatProductsByStore } from "./formatedData";
import { storeProductsStorage } from "./productsStorage";
import { stockRequestService } from "./stockRequestStorage";
import { storeService } from "./storeStorage";
import StoreLogger from "./utils/logger";

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
      StoreLogger.error("Failed to fetch stats", "storeRoutes", error);
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
    } catch {
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
    } catch {
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
    } catch {
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
      const { search, dateFrom, dateTo, sort } = req.body;
      const result = await storeService.getStoreSalesPaginated(user.storeId, {
        limit: params.pageSize,
        offset,
        search: search,
        dateFrom: dateFrom,
        dateTo: dateTo,
        sort: sort,
      });

      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize,
      );

      res.json(response);
    } catch (error) {
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
        subcategoryIds,
        colorIds,
        fabricIds,
        sizes,
        minPrice,
        maxPrice,
        featured,
        onSale,
        inStock,
        minStock,
        sort,
      } = req.body;

      // Convert string boolean values to actual booleans
      const featuredFilter = featured === "true" ? true : featured === "false" ? false : undefined;
      const onSaleFilter = onSale === "true" ? true : onSale === "false" ? false : undefined;
      const inStockFilter = inStock === "true" ? true : inStock === "false" ? false : undefined;

      const filters: ProductFilters = {
        search,
        categoryIds,
        subcategoryIds,
        colorIds,
        fabricIds,
        size: sizes,
        minPrice,
        maxPrice,
        featured: featuredFilter,
        onSale: onSaleFilter,
        inStock: inStockFilter,
        minStock,
        sort,
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
        data: formatProductsByStore(products, user.storeId),
        total: totalProducts,
        page: Number(page),
        pageSize: limit,
        totalPages: Math.ceil(totalProducts / limit),
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch products",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/store/getProducts", authStore, async (req, res) => {
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
        subcategoryIds,
        colorIds,
        fabricIds,
        sizes,
        minPrice,
        maxPrice,
        featured,
        onSale,
        inStock,
        minStock,
        sort,
      } = req.body;

      const filters: ProductFilters = {
        search,
        categoryIds,
        subcategoryIds,
        colorIds,
        fabricIds,
        size: sizes,
        minPrice,
        maxPrice,
        featured,
        onSale,
        inStock,
        minStock,
        sort,
        limit,
        offset,
        storeId: user.storeId, // Important: Pass store ID for role-based filtering
      };

      // MIGRATED: Use role-based service for store users (50-60% faster queries)
      const products = await roleBasedProductService.getProductsByRole(filters, "store");

      // Get stock requests for each product
      const productIds = products.map(p => p.id);
      const stockRequests = await stockRequestService.getStockRequestsForProducts(user.storeId, productIds);


      // Attach stock requests to products

      const formattedData = formatProductsByStore(products, user.storeId)
      // Calculate stats for store-specific products
      const totalProducts = formattedData.length;
      const inStockProducts = formattedData.filter(p =>
        (p.storeAllocations || []).some((alloc: any) => alloc.quantity > 0) ||
        (p.variants || []).some((v: any) => (v.storeAllocations || []).some((alloc: any) => alloc.quantity > 0))
      ).length;
      const outOfStockProducts = totalProducts - inStockProducts;
      const finalData = formattedData.map(product => ({
        ...product,
        stockRequests: stockRequests.filter(
          request => request.productId === product.id
        )
      }));
      res.json({
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        data: finalData,
        total: totalProducts,
        page: Number(page),
        pageSize: limit,
        totalPages: Math.ceil(totalProducts / limit),
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch products",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/store/requestsPaginated", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }

      const params = parsePaginationParams(req.query);
      const offset = getOffset(params.page, params.pageSize);
      const { search, status, priority, dateFrom, dateTo, sort } = req.body;
      const result = await stockRequestService.getStockRequestsPaginated(user.storeId, {
        limit: params.pageSize,
        offset,
        search: search,
        status: status as string,
        priority: priority as string,
        dateFrom: dateFrom,
        dateTo: dateTo,
        sort: sort,
      }, 'store');

      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize,
      );

      res.json(response);
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
      const { productId, quantity, notes } = req.body;
      const request = await stockRequestService.createStockRequest({
        storeId: user.storeId,
        requestedBy: user.id,
        productId,
        quantity,
        notes,
      });
      res.json(request);
    } catch {
      res.status(500).json({ message: "Failed to create request" });
    }
  });

  app.patch("/api/store/requests/:id/received", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const request = await stockRequestService.updateStockRequestStatus(
        req.params.id,
        "received",
        user.id,
      );
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      res.json(request);
    } catch (error) {
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

      // Verify the sale belongs to the user's store
      if (sale.storeId !== user.storeId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });

 app.post("/api/store/getStoreExchanges", authStore, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.storeId) {
      return res.status(400).json({ message: "No store assigned" });
    }

    const params = parsePaginationParams(req.query);
    const body = req.body || {}; // Read from body for POST
    const offset = getOffset(params.page, params.pageSize);

    const result = await storeService.getStoreExchangesPaginated(
      user.storeId,
      {
        limit: params.pageSize,
        offset,
        search: params.search,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        // ADD NEW FILTERS
        exchangeType: body.exchangeType,
        reason: body.reason,
        sort: body.sort,
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
          notes,
          customerName,
          customerPhone,
        },
      );

      res.status(201).json(exchange);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create exchange";
      res.status(400).json({ message });
    }
  });
  // Razorpay endpoints for store module
  app.post("/api/store/create-razorpay-order", authStore, async (req, res) => {
    try {
      const { amount } = req.body;
      const user = (req as any).user;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        receipt: `${user.storeId}`, 
        payment_capture: true,
      });

      res.json({
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to create Razorpay order" });
    }
  });

  // Initialize customer routes
  customerRoutes(app);
};
