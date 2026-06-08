import { colors, cart, orders, products, productVariants, storeInventory, stockMovements, variantStoreInventory, wishlist } from "@shared/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Express } from "express";
import { publishRealtimeEvent } from "realtime/events";
import { productService } from "server/product/productStorage";
import {
  ProductFilters,
  roleBasedProductService,
} from "server/product/roleBasedProductService";
import { stockRequestService } from "server/store/stockRequestStorage";
import { storeService } from "server/store/storeStorage";
import { createAuthMiddleware } from "../authMiddleware";
import { publicStorage } from "../common/publicStorage";
import { db } from "../db";
import { orderService } from "../order/orderStorage";
import { parsePaginationParams } from "../paginationHelper";
import { storage } from "../storage";
import {
  DatabaseTransactionError,
  handleInventoryError,
  InsufficientStockError,
  ProductNotFoundError,
  StockValidationError,
  validateDistributionChannel,
  validateStockAllocation,
} from "./errorHandling";
import { inventoryService } from "./inventoryStorage";
import { productBaseSchema, trackingNumberSchema } from "./schema";

const productWithAllocationsSchema = productBaseSchema.refine(
  (data) => {
    const storeIds = data.storeAllocations?.map((a) => a.storeId) || [];
    return new Set(storeIds).size === storeIds.length;
  },
  { message: "Duplicate store IDs are not allowed" },
);

const productUpdateSchema = productBaseSchema.partial();

export const inventoryProductRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);

  // Filters for inventory (categories with subcategories, colors, fabrics)
  app.get("/api/inventory/filters", authInventory, async (req, res) => {
    try {
      const [categories, colors, fabrics] = await Promise.all([
        publicStorage.getCategoriesWithSubcategories(),
        publicStorage.getColors(),
        publicStorage.getFabrics(),
      ]);

      res.json({ categories, colors, fabrics });
    } catch (error) {
      console.error("Error fetching inventory filters:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch filters",
        error: process.env.NODE_ENV === "development" ? message : undefined,
      });
    }
  });

  app.get("/api/inventory/requests", authInventory, async (req, res) => {
    try {
      const { status } = req.query;
      const requests = await stockRequestService.getStockRequests(
        {
          status: status as string,
        },
        "inventory",
      );
      res.json(requests);
    } catch (error) {
      console.error("Error fetching stock requests:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch requests",
        error: process.env.NODE_ENV === "development" ? message : undefined,
      });
    }
  });

  app.patch(
    "/api/inventory/requests/:id/status",
    authInventory,
    async (req, res) => {
      try {
        const { status, rejectionReason } = req.body;
        if (!status) {
          return res.status(400).json({ message: "Status is required" });
        }

        // Get the request details first
        const stockRequest = await stockRequestService.getStockRequest(
          req.params.id,
          "inventory",
        );

        if (!stockRequest) {
          return res.status(404).json({ message: "Request not found" });
        }

        // Handle approval with stock deduction
        if (status === "approved") {
          try {
            // Use database transaction to prevent race conditions
            await db.transaction(async (tx: any) => {
              // Get product details within transaction for consistent read with row lock
              const [product] = await tx
                .select()
                .from(products)
                .where(eq(products.id, stockRequest.productId))
                .for("update"); // Lock the row for this transaction

              if (!product) {
                throw new ProductNotFoundError(stockRequest.productId);
              }

              // Check if sufficient stock is available (double-check within transaction)
              if (product.totalStock < stockRequest.quantity) {
                throw new InsufficientStockError(
                  stockRequest.productId,
                  stockRequest.quantity,
                  product.totalStock,
                );
              }

              // Update stock atomically
              const updateResult = await tx
                .update(products)
                .set({
                  totalStock: product.totalStock - stockRequest.quantity,
                  updatedAt: new Date(),
                })
                .where(eq(products.id, stockRequest.productId))
                .returning({ totalStock: products.totalStock });

              // Verify the update was successful
              if (updateResult.length === 0) {
                throw new DatabaseTransactionError(
                  "Failed to update product stock",
                );
              }

              // Record stock movement for audit trail
              await tx.insert(stockMovements).values({
                productId: stockRequest.productId,
                quantity: -stockRequest.quantity,
                movementType: "request",
                source: "online", // Must be "store" | "online" per schema
                orderRefId: stockRequest.id,
                notes: `Stock request approved - ${stockRequest.quantity} units allocated to store ${stockRequest.storeId}`,
                createdAt: new Date(),
              });
            });

            // If transaction succeeds, update request status
            const updatedRequest =
              await stockRequestService.updateStockRequestStatus(
                req.params.id,
                status,
                (req as any).user.id,
                rejectionReason,
              );

            if (!updatedRequest) {
              // This shouldn't happen if transaction succeeded, but handle gracefully
              console.error(
                "Failed to update stock request status after successful stock deduction",
              );
              throw new DatabaseTransactionError(
                "Failed to update request status",
              );
            }

            res.json(updatedRequest);
            return;
          } catch (transactionError: any) {
            console.error(
              "Transaction failed during stock request approval:",
              transactionError,
            );

            // Use proper error handling
            const errorResponse = handleInventoryError(
              transactionError,
              process.env.NODE_ENV === "development",
            );
            return res.status(errorResponse.statusCode).json(errorResponse);
          }
        }

        // Handle rejection status
        const updateData: any = { status };
        if (rejectionReason && status === "rejected") {
          updateData.notes = rejectionReason;
        }

        const request = await stockRequestService.updateStockRequestStatus(
          req.params.id,
          status,
          (req as any).user.id,
          rejectionReason,
        );

        if (!request) {
          return res.status(404).json({ message: "Request not found" });
        }

        res.json(request);
      } catch (error: any) {
        console.error("Error updating stock request status:", error);

        // Use proper error handling
        const errorResponse = handleInventoryError(
          error,
          process.env.NODE_ENV === "development",
        );
        res.status(errorResponse.statusCode).json(errorResponse);
      }
    },
  );

  app.patch(
    "/api/inventory/orders/:id/tracking",
    authInventory,
    async (req, res) => {
      try {
        const order = await orderService.getOrder(req.params.id, "inventory");
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }

        const parsed = trackingNumberSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: parsed.error.errors[0]?.message || "Invalid input",
          });
        }

        const updated = await storage.updateOrderTrackingNumber(
          req.params.id,
          parsed.data.trackingNumber,
        );

        if (!updated) {
          return res
            .status(500)
            .json({ message: "Failed to update tracking number" });
        }

        res.json(updated);
      } catch {
        res.status(500).json({ message: "Failed to update tracking number" });
      }
    },
  );

  app.post("/api/inventory/orders", authInventory, async (req, res) => {
    try {
      const { status, search, dateFrom, dateTo } = req.body;
      const params = parsePaginationParams(req.query);
      const result = await orderService.getOrdersPaginated({
        page: params.page,
        pageSize: params.pageSize,
        status: status as string,
        search: search as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        userRole: "inventory",
      });
      return res.json(result);
    } catch {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Count orders with at least one item matching the given status
  // MUST be registered before /:id to avoid Express matching "count" as an id
  app.get("/api/inventory/orders/count", authInventory, async (req, res) => {
    try {
      const { status } = req.query;
      const conditions: any[] = [];
      if (status) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM order_items oi
            WHERE oi.order_id = ${orders.id}
            AND oi.status = ${status as string}
          )`
        );
      }
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      res.json({ count: result?.count ?? 0 });
    } catch (error: any) {
      console.error("Error fetching order count:", error);
      res.status(500).json({ message: "Failed to fetch order count" });
    }
  });

  app.get("/api/inventory/orders/:id", authInventory, async (req, res) => {
    try {
      const order = await orderService.getOrder(req.params.id, "inventory");
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.get(
    "/api/inventory/orders/:id/history",
    authInventory,
    async (req, res) => {
      try {
        const order = await orderService.getOrder(req.params.id, "inventory");
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }

        const history = await storage.getItemStatusHistory(req.params.id);
        res.json(history);
      } catch {
        res.status(500).json({ message: "Failed to fetch order history" });
      }
    },
  );

  app.patch(
    "/api/inventory/products/:id/distribution",
    authInventory,
    async (req, res) => {
      try {
        const { channel } = req.body;
        const product = await productService.updateProduct(req.params.id, {
          distributionChannel: channel,
        });
        res.json(product);
      } catch {
        res.status(500).json({ message: "Failed to update distribution" });
      }
    },
  );

  app.patch(
    "/api/inventory/products/:id/stock",
    authInventory,
    async (req, res) => {
      try {
        const { totalStock, onlineStock } = req.body;

        // Get previous stock for comparison
        const previousProduct = await productService.getProductById(
          req.params.id,
        );

        const product = await productService.updateProduct(req.params.id, {
          totalStock,
          onlineStock,
        });

        res.json(product);
      } catch {
        res.status(500).json({ message: "Failed to update stock" });
      }
    },
  );

  app.get(
    "/api/inventory/stock-distribution",
    authInventory,
    async (req, res) => {
      try {
        const distribution = await storage.getStockDistribution();
        res.json(distribution);
      } catch {
        res.status(500).json({ message: "Failed to fetch stock distribution" });
      }
    },
  );

  // Inventory product management (moved from admin)
  app.post("/api/inventory/getProducts", authInventory, async (req, res) => {
    try {
      const params = parsePaginationParams(req.query);

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
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      };

      // MIGRATED: Use role-based service for inventory users (full access)
      const products = await roleBasedProductService.getProductsByRole(
        filters,
        "inventory",
      );

      const total = products.length;
      const totalPages = Math.ceil(total / params.pageSize);

      return res.json({
        data: products,
        total,
        page: params.page,
        pageSize: params.pageSize,
        totalPages,
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/inventory/stores", authInventory, async (req, res) => {
    try {
      const stores = await storeService.getStores();
      res.json(stores);
    } catch {
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.get(
    "/api/inventory/products/:id/allocations",
    authInventory,
    async (req, res) => {
      try {
        const allocations = await inventoryService.getProductAllocations(
          req.params.id,
        );
        res.json(allocations);
      } catch {
        res.status(500).json({ message: "Failed to fetch allocations" });
      }
    },
  );

  // Check for duplicate product API
  app.post(
    "/api/inventory/check-product-duplicate",
    authInventory,
    async (req, res) => {
      try {
        const { name, color, categoryId, subcategoryId, excludeId } = req.body;

        if (!name) {
          return res.status(400).json({ error: "Product name is required" });
        }

        // Find color ID by color name
        let colorId = null;
        if (color) {
          const colorRecord = await db
            .select()
            .from(colors)
            .where(eq(colors.name, color))
            .limit(1);
          colorId = colorRecord.length > 0 ? colorRecord[0].id : null;
        }

        const whereConditions = [
          eq(products.name, name),
          eq(products.isActive, true),
        ];

        // Add color condition only if color is specified
        if (colorId) {
          whereConditions.push(eq(products.colorId, colorId));
        } else {
          whereConditions.push(sql`${products.colorId} IS NULL`);
        }

        // Add category condition if specified
        if (categoryId) {
          whereConditions.push(eq(products.categoryId, categoryId));
        }

        // Add subcategory condition if specified
        if (subcategoryId) {
          whereConditions.push(eq(products.subcategoryId, subcategoryId));
        }

        // Exclude current product when editing
        if (excludeId) {
          whereConditions.push(ne(products.id, excludeId));
        }

        const existingProduct = await db
          .select()
          .from(products)
          .where(and(...whereConditions))
          .limit(1);

        // Check if color name and product name are the same
        const isSameNameAndColor =
          color && name.toLowerCase().trim() === color.toLowerCase().trim();

        res.json({
          exists: existingProduct.length > 0,
          isSameNameAndColor,
          existingProduct:
            existingProduct.length > 0 ? existingProduct[0] : null,
          message: isSameNameAndColor
            ? "Product name cannot be the same as color name"
            : existingProduct.length > 0
              ? "A product with this combination already exists"
              : "Product combination is unique",
        });
      } catch (error) {
        console.error("Error checking duplicate:", error);
        res.status(500).json({ error: "Failed to check duplicate" });
      }
    },
  );

  app.post("/api/inventory/products", authInventory, async (req, res) => {
    try {
      const validation = productWithAllocationsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: validation.error.errors[0]?.message || "Invalid input",
        });
      }

      const {
        storeAllocations,
        actualPrice,
        variants,
        seoData,
        ...productData
      } = validation.data;

      // Check for duplicate product (same name + color)
      const existingProduct = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.name, productData.name),
            eq(products.colorId, productData.colorId || ""),
            eq(products.isActive, true),
          ),
        )
        .limit(1);

      if (existingProduct.length > 0) {
        return res.status(400).json({
          error: "Product with this name and color already exists",
          field: "name",
          existingProduct: existingProduct[0],
        });
      }

      // Handle variant products
      if (productData.hasVariants && variants && variants.length > 0) {
        // Validate variant stock consistency
        for (const variant of variants) {
          const storeTotal =
            variant.storeAllocations?.reduce((sum, a) => sum + a.quantity, 0) ||
            0;
          const onlinePlusStore = variant.onlineStock + storeTotal;

          if (onlinePlusStore !== variant.stockQuantity) {
            throw new StockValidationError(
              `Variant ${variant.size}: Online (${variant.onlineStock}) + Store allocations (${storeTotal}) must equal total stock (${variant.stockQuantity})`,
            );
          }

          // Validate distribution channel constraints for variants
          validateDistributionChannel(
            productData.distributionChannel,
            variant.onlineStock,
            storeTotal,
          );
        }

        // Calculate aggregated totals from variants
        const totalStock = variants.reduce(
          (sum, v) => sum + v.stockQuantity,
          0,
        );
        const onlineStock = variants.reduce((sum, v) => sum + v.onlineStock, 0);

        // Aggregate store allocations across variants
        const storeAllocationsMap = new Map<
          string,
          { quantity: number; storeName: string }
        >();
        variants.forEach((variant) => {
          variant.storeAllocations?.forEach((alloc) => {
            const current = storeAllocationsMap.get(alloc.storeId) || {
              quantity: 0,
              storeName: "",
            };
            storeAllocationsMap.set(alloc.storeId, {
              quantity: current.quantity + alloc.quantity,
              storeName: current.storeName || `Store ${alloc.storeId}`, // Fallback name
            });
          });
        });

        const aggregatedStoreAllocations = Array.from(
          storeAllocationsMap.entries(),
        ).map(([storeId, data]) => ({
          storeId,
          storeName: data.storeName,
          quantity: data.quantity,
        }));

        // Validate final stock allocation
        validateStockAllocation(
          totalStock,
          onlineStock,
          aggregatedStoreAllocations,
        );

        // Update product data with calculated totals
        const updatedProductData = {
          ...productData,
          totalStock,
          onlineStock,
        };

        const product = await inventoryService.createProductWithVariants(
          updatedProductData,
          variants,
          aggregatedStoreAllocations,
          actualPrice,
          seoData,
        );
        res.json(product);
        return;
      }

      // Handle simple products (existing logic)
      if (productData.distributionChannel === "online") {
        productData.onlineStock = productData.totalStock;
        const product = await inventoryService.createProductWithAllocations(
          productData,
          [],
          actualPrice,
          seoData,
        );
        res.json(product);
        await publishRealtimeEvent("product_event");
      } else if (productData.distributionChannel === "shop") {
        productData.onlineStock = 0;
        const allocations = storeAllocations || [];
        const totalAllocated = allocations.reduce(
          (sum, a) => sum + a.quantity,
          0,
        );

        validateStockAllocation(
          productData.totalStock,
          productData.onlineStock,
          allocations,
        );
        validateDistributionChannel(
          productData.distributionChannel,
          productData.onlineStock,
          totalAllocated,
        );

        const product = await inventoryService.createProductWithAllocations(
          productData,
          allocations,
          actualPrice,
          seoData,
        );
        res.json(product);
        await publishRealtimeEvent("product_event");
      } else {
        const allocations = storeAllocations || [];
        const storeTotal = allocations.reduce((sum, a) => sum + a.quantity, 0);
        const onlineStock = productData.onlineStock || 0;

        validateStockAllocation(
          productData.totalStock,
          onlineStock,
          allocations,
        );

        const product = await inventoryService.createProductWithAllocations(
          productData,
          allocations,
          actualPrice,
          seoData,
        );
        res.json(product);
        await publishRealtimeEvent("product_event");
      }
    } catch (error: any) {
      console.error("Error creating product:", error);

      // Use proper error handling
      const errorResponse = handleInventoryError(
        error,
        process.env.NODE_ENV === "development",
      );
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  });

  app.patch("/api/inventory/products/:id", authInventory, async (req, res) => {
    try {
      const validation = productUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        console.log("Validation errors:", validation.error.errors);
        return res.status(400).json({
          message: validation.error.errors[0]?.message || "Invalid input",
          errors: validation.error.errors,
        });
      }

      const {
        storeAllocations,
        actualPrice,
        variants,
        seoData,
        ...productData
      } = validation.data;
      const allocations = storeAllocations || [];

      // Check for duplicate product (same name + color) - exclude current product
      if (productData.name || productData.colorId) {
        const currentProduct = await db
          .select()
          .from(products)
          .where(eq(products.id, req.params.id))
          .limit(1);

        if (currentProduct.length > 0) {
          const nameToCheck = productData.name || currentProduct[0].name;
          const colorIdToCheck =
            productData.colorId || currentProduct[0].colorId || "";

          const existingProduct = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.name, nameToCheck),
                eq(products.colorId, colorIdToCheck),
                eq(products.isActive, true),
                ne(products.id, req.params.id),
              ),
            )
            .limit(1);

          if (existingProduct.length > 0) {
            return res.status(400).json({
              error: "Product with this name and color already exists",
              field: "name",
              existingProduct: existingProduct[0],
            });
          }
        }
      }

      // Handle variant products
      if (productData.hasVariants && variants && variants.length > 0) {
        // Validate variant stock consistency
        for (const variant of variants) {
          const storeTotal =
            variant.storeAllocations?.reduce((sum, a) => sum + a.quantity, 0) ||
            0;
          const onlinePlusStore = variant.onlineStock + storeTotal;

          if (onlinePlusStore !== variant.stockQuantity) {
            return res.status(400).json({
              message: `Variant ${variant.size}: Online (${variant.onlineStock}) + Store allocations (${storeTotal}) must equal total stock (${variant.stockQuantity})`,
            });
          }

          // Validate distribution channel constraints for variants
          if (productData.distributionChannel === "online" && storeTotal > 0) {
            return res.status(400).json({
              message: `Variant ${variant.size}: Distribution channel is 'Online Only' but has store allocations (${storeTotal})`,
            });
          }
          if (
            productData.distributionChannel === "shop" &&
            variant.onlineStock > 0
          ) {
            return res.status(400).json({
              message: `Variant ${variant.size}: Distribution channel is 'Shop Only' but has online stock (${variant.onlineStock})`,
            });
          }
        }

        // Calculate aggregated totals from variants
        const totalStock = variants.reduce(
          (sum, v) => sum + v.stockQuantity,
          0,
        );
        const onlineStock = variants.reduce((sum, v) => sum + v.onlineStock, 0);

        // Aggregate store allocations across variants
        const storeAllocationsMap = new Map<
          string,
          { quantity: number; storeName: string }
        >();
        variants.forEach((variant) => {
          variant.storeAllocations?.forEach((alloc) => {
            const current = storeAllocationsMap.get(alloc.storeId) || {
              quantity: 0,
              storeName: "",
            };
            storeAllocationsMap.set(alloc.storeId, {
              quantity: current.quantity + alloc.quantity,
              storeName: current.storeName || `Store ${alloc.storeId}`,
            });
          });
        });

        const aggregatedStoreAllocations = Array.from(
          storeAllocationsMap.entries(),
        ).map(([storeId, data]) => ({
          storeId,
          storeName: data.storeName,
          quantity: data.quantity,
        }));

        // Update product data with calculated totals
        const updatedProductData = {
          ...productData,
          totalStock,
          onlineStock,
        };

        const product = await inventoryService.updateProductWithVariants(
          req.params.id,
          updatedProductData,
          variants,
          aggregatedStoreAllocations,
          actualPrice,
          seoData,
        );
        res.json(product);
        await publishRealtimeEvent("product_event");
        return;
      }

      // Handle simple products (existing logic)
      if (productData.distributionChannel === "online") {
        productData.onlineStock = productData.totalStock;
        const product = await inventoryService.updateProductWithAllocations(
          req.params.id,
          productData,
          [],
          actualPrice,
          seoData,
        );
        res.json(product);
        await publishRealtimeEvent("product_event");
      } else if (productData.distributionChannel === "shop") {
        productData.onlineStock = 0;
        const totalAllocated = allocations.reduce(
          (sum: number, a: { quantity: number }) => sum + a.quantity,
          0,
        );
        if (
          productData.totalStock !== undefined &&
          totalAllocated !== productData.totalStock
        ) {
          return res.status(400).json({
            message: `Store allocations (${totalAllocated}) must equal total stock (${productData.totalStock})`,
          });
        }
        const product = await inventoryService.updateProductWithAllocations(
          req.params.id,
          productData,
          allocations,
          actualPrice,
          seoData,
        );
        res.json(product);
        await publishRealtimeEvent("product_event");
      } else if (productData.distributionChannel === "both") {
        const storeTotal = allocations.reduce(
          (sum: number, a: { quantity: number }) => sum + a.quantity,
          0,
        );
        const onlineStock = productData.onlineStock || 0;
        if (
          productData.totalStock !== undefined &&
          storeTotal + onlineStock !== productData.totalStock
        ) {
          return res.status(400).json({
            message: `Online (${onlineStock}) + Store allocations (${storeTotal}) must equal total stock (${productData.totalStock})`,
          });
        }
        const product = await inventoryService.updateProductWithAllocations(
          req.params.id,
          productData,
          allocations,
          actualPrice,
          seoData,
        );
        res.json(product);
        await publishRealtimeEvent("product_event");
      } else {
        const product = await inventoryService.updateProductWithAllocations(
          req.params.id,
          productData,
          allocations,
          actualPrice,
          seoData,
        );
        res.json(product);
        await publishRealtimeEvent("product_event");
      }
    } catch {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/inventory/products", authInventory, async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids must be a non-empty array" });
    }

    try {
      // Fetch all image/video URLs before deleting so we can clean Cloudinary
      const productsToDelete = await db
        .select({
          id: products.id,
          imageUrl: products.imageUrl,
          images: products.images,
          videoUrl: products.videoUrl,
        })
        .from(products)
        .where(inArray(products.id, ids));

      await db.transaction(async (tx) => {
        // 1. Collect all variant IDs for these products
        const variants = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(inArray(productVariants.productId, ids));

        const variantIds = variants.map(v => v.id);

        // 2. Delete variant-level store allocations
        if (variantIds.length > 0) {
          await tx
            .delete(variantStoreInventory)
            .where(inArray(variantStoreInventory.variantId, variantIds));
        }

        // 3. Delete product variants
        await tx
          .delete(productVariants)
          .where(inArray(productVariants.productId, ids));

        // 4. Delete product-level store allocations
        await tx
          .delete(storeInventory)
          .where(inArray(storeInventory.productId, ids));

        // 5. Remove from online cart
        await tx
          .delete(cart)
          .where(inArray(cart.productId, ids));

        // 6. Remove from wishlists
        await tx
          .delete(wishlist)
          .where(inArray(wishlist.productId, ids));

        // 7. Soft-delete the products
        await tx
          .update(products)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(products.id, ids));
      });

      // 8. Delete Cloudinary assets after DB transaction succeeds (fire and forget)
      // Collect all Cloudinary URLs across all deleted products
      const cloudinaryUrls: string[] = [];
      for (const p of productsToDelete) {
        if (p.imageUrl?.includes("res.cloudinary.com")) cloudinaryUrls.push(p.imageUrl);
        if (p.videoUrl?.includes("res.cloudinary.com")) cloudinaryUrls.push(p.videoUrl);
        if (Array.isArray(p.images)) {
          p.images.forEach((img) => {
            if (img?.includes("res.cloudinary.com")) cloudinaryUrls.push(img);
          });
        }
      }

      if (cloudinaryUrls.length > 0) {
        const cloudinary = await import("cloudinary");
        cloudinary.v2.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        // Delete all assets in parallel — non-blocking, failures are logged not thrown
        Promise.allSettled(
          cloudinaryUrls.map(async (url) => {
            const urlParts = url.split("/");
            const uploadIndex = urlParts.indexOf("upload");
            if (uploadIndex === -1) return;

            let afterUpload = urlParts.slice(uploadIndex + 1);
            if (afterUpload[0] && /^v\d+$/.test(afterUpload[0])) {
              afterUpload = afterUpload.slice(1);
            }
            const publicIdWithExt = afterUpload.join("/");
            if (!publicIdWithExt) return;
            const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf("."));
            const resourceType = url.includes("/video/") ? "video" : "image";

            const result = await cloudinary.v2.uploader.destroy(publicId, { resource_type: resourceType });
            if (result.result !== "ok") {
              console.warn(`Cloudinary delete skipped for ${publicId}: ${result.result}`);
            }
          })
        ).catch((err) => console.error("Cloudinary bulk delete error:", err));
      }

      res.json({ success: true, ids });
      await publishRealtimeEvent("product_event");
    } catch {
      res.status(500).json({ message: "Failed to delete products" });
    }
  });

  // Get product by SKU
  app.get(
    "/api/inventory/product-by-sku/:sku",
    authInventory,
    async (req, res) => {
      try {
        // MIGRATED: Use role-based service for inventory users (full access)
        const product = await roleBasedProductService.getProductBySkuByRole(
          req.params.sku,
          "inventory",
        );
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
      } catch {
        res.status(500).json({ message: "Failed to fetch product" });
      }
    },
  );
};
