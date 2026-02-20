import { insertProductDamageSchema, products, stockMovements } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { productService } from "server/product/productStorage";
import { ProductFilters, roleBasedProductService } from "server/product/roleBasedProductService";
import { storeService } from "server/store/storeStorage";
import { createAuthMiddleware } from "../authMiddleware";
import { publicStorage } from "../common/publicStorage";
import { db } from "../db";
import { orderService } from "../order/orderStorage";
import { parsePaginationParams } from "../paginationHelper";
import { refundService } from "../refund/refundService";
import { storage } from "../storage";
import { inventoryService } from "./inventoryStorage";
import { productDamageService } from "./productDamageService";
import { productBaseSchema, trackingNumberSchema } from "./schema";
import { stockRequestService } from "server/store/stockRequestStorage";
import { stockValidationService } from "./stockValidationService";
import { 
  handleInventoryError, 
  InsufficientStockError, 
  ProductNotFoundError, 
  DatabaseTransactionError,
  StockValidationError,
  validateStockAllocation,
  validateDistributionChannel
} from "./errorHandling";
import { stockAuditService } from "./stockAuditService";

const productWithAllocationsSchema = productBaseSchema.refine(
  (data) => {
    const storeIds = data.storeAllocations?.map((a) => a.storeId) || [];
    return new Set(storeIds).size === storeIds.length;
  },
  { message: "Duplicate store IDs are not allowed" },
);

const productUpdateSchema = productBaseSchema.partial();

export const inventoryRoutes = (app: Express) => {
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
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch filters",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.get("/api/inventory/requests", authInventory, async (req, res) => {
    try {
      const { status } = req.query;
      const requests = await stockRequestService.getStockRequests({
        status: status as string,
      }, "inventory");
      res.json(requests);
    } catch (error) {
      console.error("Error fetching stock requests:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch requests",
        error: process.env.NODE_ENV === "development" ? message : undefined
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
        const stockRequest = await stockRequestService.getStockRequest(req.params.id, "inventory");

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
                .for('update'); // Lock the row for this transaction

              if (!product) {
                throw new ProductNotFoundError(stockRequest.productId);
              }

              // Check if sufficient stock is available (double-check within transaction)
              if (product.totalStock < stockRequest.quantity) {
                throw new InsufficientStockError(
                  stockRequest.productId,
                  stockRequest.quantity,
                  product.totalStock
                );
              }

              // Update stock atomically
              const updateResult = await tx
                .update(products)
                .set({
                  totalStock: product.totalStock - stockRequest.quantity,
                  updatedAt: new Date()
                })
                .where(eq(products.id, stockRequest.productId))
                .returning({ totalStock: products.totalStock });

              // Verify the update was successful
              if (updateResult.length === 0) {
                throw new DatabaseTransactionError("Failed to update product stock");
              }

              // Record stock movement for audit trail
              await tx.insert(stockMovements).values({
                productId: stockRequest.productId,
                quantity: -stockRequest.quantity,
                movementType: "request",
                source: "online", // Must be "store" | "online" per schema
                orderRefId: stockRequest.id,
                notes: `Stock request approved - ${stockRequest.quantity} units allocated to ${stockRequest.store?.name || 'store'}`,
                createdAt: new Date()
              });
            });

            // If transaction succeeds, update request status
            const updatedRequest = await stockRequestService.updateStockRequestStatus(
              req.params.id,
              status,
              (req as any).user.id,
              rejectionReason,
            );

            if (!updatedRequest) {
              // This shouldn't happen if transaction succeeded, but handle gracefully
              console.error("Failed to update stock request status after successful stock deduction");
              throw new DatabaseTransactionError("Failed to update request status");
            }

            res.json(updatedRequest);
            return;

          } catch (transactionError: any) {
            console.error("Transaction failed during stock request approval:", transactionError);
            
            // Use proper error handling
            const errorResponse = handleInventoryError(transactionError, process.env.NODE_ENV === "development");
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
        const errorResponse = handleInventoryError(error, process.env.NODE_ENV === "development");
        res.status(errorResponse.statusCode).json(errorResponse);
      }
    },
  );

  app.patch(
    "/api/inventory/orders/:id/tracking",
    authInventory,
    async (req, res) => {
      try {
        const order = await orderService.getOrder(req.params.id);
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

  app.get("/api/inventory/orders", authInventory, async (req, res) => {
    try {
      const { status, limit } = req.query;
      const orders = await storage.getAllOrders({
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(orders);
    } catch {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.post("/api/inventory/orders", authInventory, async (req, res) => {
    try {
      const { page, pageSize } = req.query;
      const { status, search, dateFrom, dateTo } = req.body;
      if (page && pageSize) {
        const params = parsePaginationParams(req.query);
        const result = await storage.getOrdersPaginated({
          page: params.page,
          pageSize: params.pageSize,
          status: status as string,
          search: search as string,
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
        });
        return res.json(result);
      }

      const orders = await storage.getAllOrders({ status: status as string });
      res.json(orders);
    } catch {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/inventory/orders/:id", authInventory, async (req, res) => {
    try {
      const order = await orderService.getOrder(req.params.id);
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
        const order = await orderService.getOrder(req.params.id);
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

      const params = parsePaginationParams(req.query)

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
      const products = await roleBasedProductService.getProductsByRole(filters, "inventory");

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

  app.post("/api/inventory/products", authInventory, async (req, res) => {
    try {
      const validation = productWithAllocationsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: validation.error.errors[0]?.message || "Invalid input",
        });
      }

      const { storeAllocations, actualPrice, variants, seoData, ...productData } = validation.data;

      // Handle variant products
      if (productData.hasVariants && variants && variants.length > 0) {
        // Validate variant stock consistency
        for (const variant of variants) {
          const storeTotal = variant.storeAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0;
          const onlinePlusStore = variant.onlineStock + storeTotal;

          if (onlinePlusStore !== variant.stockQuantity) {
            throw new StockValidationError(
              `Variant ${variant.size}: Online (${variant.onlineStock}) + Store allocations (${storeTotal}) must equal total stock (${variant.stockQuantity})`
            );
          }

          // Validate distribution channel constraints for variants
          validateDistributionChannel(productData.distributionChannel, variant.onlineStock, storeTotal);
        }

        // Calculate aggregated totals from variants
        const totalStock = variants.reduce((sum, v) => sum + v.stockQuantity, 0);
        const onlineStock = variants.reduce((sum, v) => sum + v.onlineStock, 0);

        // Aggregate store allocations across variants
        const storeAllocationsMap = new Map<string, { quantity: number, storeName: string }>();
        variants.forEach(variant => {
          variant.storeAllocations?.forEach(alloc => {
            const current = storeAllocationsMap.get(alloc.storeId) || { quantity: 0, storeName: '' };
            storeAllocationsMap.set(alloc.storeId, {
              quantity: current.quantity + alloc.quantity,
              storeName: current.storeName || `Store ${alloc.storeId}` // Fallback name
            });
          });
        });

        const aggregatedStoreAllocations = Array.from(storeAllocationsMap.entries()).map(([storeId, data]) => ({
          storeId,
          storeName: data.storeName,
          quantity: data.quantity
        }));

        // Validate final stock allocation
        validateStockAllocation(totalStock, onlineStock, aggregatedStoreAllocations);

        // Update product data with calculated totals
        const updatedProductData = {
          ...productData,
          totalStock,
          onlineStock
        };

        const product = await inventoryService.createProductWithVariants(
          updatedProductData,
          variants,
          aggregatedStoreAllocations,
          actualPrice,
          seoData
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
          seoData
        );
        res.json(product);
      } else if (productData.distributionChannel === "shop") {
        productData.onlineStock = 0;
        const allocations = storeAllocations || [];
        const totalAllocated = allocations.reduce(
          (sum, a) => sum + a.quantity,
          0,
        );
        
        validateStockAllocation(productData.totalStock, productData.onlineStock, allocations);
        validateDistributionChannel(productData.distributionChannel, productData.onlineStock, totalAllocated);
        
        const product = await inventoryService.createProductWithAllocations(
          productData,
          allocations,
          actualPrice,
          seoData
        );
        res.json(product);
      } else {
        const allocations = storeAllocations || [];
        const storeTotal = allocations.reduce((sum, a) => sum + a.quantity, 0);
        const onlineStock = productData.onlineStock || 0;
        
        validateStockAllocation(productData.totalStock, onlineStock, allocations);
        
        const product = await inventoryService.createProductWithAllocations(
          productData,
          allocations,
          actualPrice,
          seoData
        );
        res.json(product);
      }
    } catch (error: any) {
      console.error("Error creating product:", error);
      
      // Use proper error handling
      const errorResponse = handleInventoryError(error, process.env.NODE_ENV === "development");
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
          errors: validation.error.errors
        });
      }

      const { storeAllocations, actualPrice, variants, seoData, ...productData } = validation.data;
      const allocations = storeAllocations || [];

      // Handle variant products
      if (productData.hasVariants && variants && variants.length > 0) {
        // Validate variant stock consistency
        for (const variant of variants) {
          const storeTotal = variant.storeAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0;
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
          if (productData.distributionChannel === "shop" && variant.onlineStock > 0) {
            return res.status(400).json({
              message: `Variant ${variant.size}: Distribution channel is 'Shop Only' but has online stock (${variant.onlineStock})`,
            });
          }
        }

        // Calculate aggregated totals from variants
        const totalStock = variants.reduce((sum, v) => sum + v.stockQuantity, 0);
        const onlineStock = variants.reduce((sum, v) => sum + v.onlineStock, 0);

        // Aggregate store allocations across variants
        const storeAllocationsMap = new Map<string, { quantity: number, storeName: string }>();
        variants.forEach(variant => {
          variant.storeAllocations?.forEach(alloc => {
            const current = storeAllocationsMap.get(alloc.storeId) || { quantity: 0, storeName: '' };
            storeAllocationsMap.set(alloc.storeId, {
              quantity: current.quantity + alloc.quantity,
              storeName: current.storeName || `Store ${alloc.storeId}`
            });
          });
        });

        const aggregatedStoreAllocations = Array.from(storeAllocationsMap.entries()).map(([storeId, data]) => ({
          storeId,
          storeName: data.storeName,
          quantity: data.quantity
        }));

        // Update product data with calculated totals
        const updatedProductData = {
          ...productData,
          totalStock,
          onlineStock
        };

        const product = await inventoryService.updateProductWithVariants(
          req.params.id,
          updatedProductData,
          variants,
          aggregatedStoreAllocations,
          actualPrice,
          seoData
        );
        res.json(product);
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
          seoData
        );
        res.json(product);
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
          seoData
        );
        res.json(product);
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
          seoData
        );
        res.json(product);
      } else {
        const product = await inventoryService.updateProductWithAllocations(
          req.params.id,
          productData,
          allocations,
          actualPrice,
          seoData
        );
        res.json(product);
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
      const deletedIds = await productService.deleteProducts(ids);

      res.json({
        success: true,
        ids: deletedIds,
      });
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
        const product = await roleBasedProductService.getProductBySkuByRole(req.params.sku, "inventory");
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
      } catch {
        res.status(500).json({ message: "Failed to fetch product" });
      }
    },
  );

  // Admin/Inventory: Get all refunds
  app.get("/api/inventory/refunds", authInventory, async (req, res) => {
    try {
      const { status } = req.query;
      const refunds = await storage.getRefunds({
        status: status as string | undefined,
      });
      res.json(refunds);
    } catch {
      res.status(500).json({ message: "Failed to fetch refunds" });
    }
  });

  // Admin/Inventory: Process refund
  app.patch(
    "/api/inventory/refunds/:id/process",
    authInventory,
    async (req, res) => {
      try {
        const { status } = req.body;

        const refund = await storage.getRefund(req.params.id);
        if (!refund) {
          return res.status(404).json({ message: "Refund not found" });
        }

        let updated;
        if (status === "retry") {
          // Retry failed refund
          await refundService.retryFailedRefund(req.params.id);
          updated = await storage.getRefund(req.params.id);
        } else {
          // Manual processing
          updated = await refundService.processRefundManually(
            req.params.id,
            status,
          );
        }

        res.json(updated);
      } catch {
        res.status(500).json({ message: "Failed to process refund" });
      }
    },
  );

  // Admin/Inventory: Check refund status from Razorpay
  app.post(
    "/api/inventory/refunds/:id/check-status",
    authInventory,
    async (req, res) => {
      try {
        await refundService.checkRefundStatus(req.params.id);
        const updated = await storage.getRefund(req.params.id);
        res.json(updated);
      } catch {
        res.status(500).json({ message: "Failed to check refund status" });
      }
    },
  );
  // Inventory: Update order status with history
  app.patch(
    "/api/inventory/orders/:id/status",
    authInventory,
    async (req, res) => {
      try {
        const user = (req as any).user;
        const { status, note, orderItemIds } = req.body;

        console.log("Updating order item status:", {
          orderId: req.params.id,
          status,
          note,
          orderItemIds,
          userId: user.id,
        });

        const order = await orderService.getOrder(req.params.id);
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }

        // If orderItemIds provided, update specific items only
        if (
          orderItemIds &&
          Array.isArray(orderItemIds) &&
          orderItemIds.length > 0
        ) {
          const updatedItems = [];
          for (const orderItemId of orderItemIds) {
            const updatedItem = await orderService.updateItemStatus(
              orderItemId,
              status,
              user.id,
              note || `Status updated to ${status}`,
            );
            if (updatedItem) {
              updatedItems.push(updatedItem);
            }
          }

          console.log("Order items updated successfully:", updatedItems.length);
          res.json({
            message: "Order item status updated successfully",
            items: updatedItems,
          });
        } else {
          // If no specific items provided, update all items in the order
          const updatedItems = [];
          for (const item of order.items) {
            const updatedItem = await orderService.updateItemStatus(
              item.id,
              status,
              user.id,
              note || `Status updated to ${status}`,
            );
            if (updatedItem) {
              updatedItems.push(updatedItem);
            }
          }

          console.log(
            "All order items updated successfully:",
            updatedItems.length,
          );
          res.json({
            message: "All order items status updated successfully",
            items: updatedItems,
          });
        }

        // Create notification for user
        let notificationMessage = "";
        switch (status) {
          case "confirmed":
            notificationMessage =
              "Your order has been confirmed and is being processed.";
            break;
          case "processing":
            notificationMessage = "Your order is being prepared for shipment.";
            break;
          case "shipped":
            notificationMessage =
              "Your order has been shipped! Track it for delivery updates.";
            break;
          case "delivered":
            notificationMessage =
              "Your order has been delivered. Enjoy your purchase!";
            break;
          case "cancelled":
            notificationMessage = "Your order has been cancelled.";
            break;
        }

        if (notificationMessage) {
          await storage.createNotification({
            userId: order.userId,
            type: "order",
            title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: notificationMessage,
            relatedId: order.id,
            relatedType: "order",
          });
        }
      } catch (error) {
        console.error("Error updating order item status:", error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("INVALID_STATUS_TRANSITION:")) {
          return res.status(400).json({
            message: message.replace("INVALID_STATUS_TRANSITION:", "").trim(),
          });
        }

        res.status(500).json({ message: "Failed to update order item status" });
      }
    },
  );

  // Inventory: Update individual item status
  app.patch(
    "/api/inventory/orders/:orderId/items/:itemId/status",
    authInventory,
    async (req, res) => {
      try {
        const user = (req as any).user;
        const { status, note } = req.body;
        const { orderId, itemId } = req.params;

        console.log("Updating individual item status:", {
          orderId,
          itemId,
          status,
          note,
          userId: user.id,
        });

        // Validate input
        if (!status) {
          return res.status(400).json({ message: "Status is required" });
        }

        // Check if order exists
        const order = await orderService.getOrder(orderId);
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }

        // Check if item exists in the order
        const orderItem = order.items.find((item) => item.id === itemId);
        if (!orderItem) {
          return res.status(404).json({ message: "Order item not found" });
        }

        // Update the item status
        const updatedItem = await orderService.updateItemStatus(
          itemId,
          status,
          user.id,
          note || `Status updated to ${status}`,
        );

        if (!updatedItem) {
          return res
            .status(500)
            .json({ message: "Failed to update item status" });
        }

        console.log("Item status updated successfully:", updatedItem.id);

        res.json({
          message: "Item status updated successfully",
          item: updatedItem,
        });
      } catch (error) {
        console.error("Error updating individual item status:", error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("INVALID_STATUS_TRANSITION:")) {
          return res.status(400).json({
            message: message.replace("INVALID_STATUS_TRANSITION:", "").trim(),
          });
        }

        res.status(500).json({ message: "Failed to update item status" });
      }
    },
  );

  // Stock Validation and Reconciliation Endpoints
  
  // Validate stock for a specific product
  app.get("/api/inventory/validate-stock/:productId", authInventory, async (req, res) => {
    try {
      const { productId } = req.params;
      const validation = await stockValidationService.validateProductStock(productId);
      res.json(validation);
    } catch (error: any) {
      console.error("Error validating product stock:", error);
      res.status(500).json({
        message: "Failed to validate product stock",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
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
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Get stock reconciliation data
  app.get("/api/inventory/stock-reconciliation", authInventory, async (req, res) => {
    try {
      const reconciliationData = await stockValidationService.getStockReconciliationData();
      res.json(reconciliationData);
    } catch (error: any) {
      console.error("Error getting stock reconciliation data:", error);
      res.status(500).json({
        message: "Failed to get stock reconciliation data",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Fix stock discrepancies
  app.post("/api/inventory/fix-stock-discrepancies", authInventory, async (req, res) => {
    try {
      const { productIds } = req.body;
      
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ 
          message: "productIds must be a non-empty array" 
        });
      }

      const result = await stockValidationService.fixStockDiscrepancies(productIds);
      
      // Log the action for audit
      console.log(`Stock discrepancy fix attempted by user ${(req as any).user.id}:`, result);
      
      res.json({
        message: "Stock discrepancy fix completed",
        fixed: result.fixed,
        failed: result.failed,
        totalProcessed: productIds.length
      });
    } catch (error: any) {
      console.error("Error fixing stock discrepancies:", error);
      res.status(500).json({
        message: "Failed to fix stock discrepancies",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Batch stock update endpoint
  app.post("/api/inventory/batch-stock-update", authInventory, async (req, res) => {
    try {
      const { updates } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ 
          message: "updates must be a non-empty array" 
        });
      }

      // Validate update format
      for (const update of updates) {
        if (!update.productId || typeof update.totalStock !== "number" || typeof update.onlineStock !== "number") {
          return res.status(400).json({ 
            message: "Invalid update format. Each update must have productId, totalStock, and onlineStock" 
          });
        }
      }

      const results = await db.transaction(async (tx) => {
        const processed = [];
        
        for (const update of updates) {
          try {
            // Get current product state
            const [currentProduct] = await tx
              .select()
              .from(products)
              .where(eq(products.id, update.productId))
              .for('update');

            if (!currentProduct) {
              processed.push({
                productId: update.productId,
                success: false,
                error: "Product not found"
              });
              continue;
            }

            // Validate stock values
            if (update.totalStock < 0 || update.onlineStock < 0) {
              processed.push({
                productId: update.productId,
                success: false,
                error: "Stock values cannot be negative"
              });
              continue;
            }

            if (update.onlineStock > update.totalStock) {
              processed.push({
                productId: update.productId,
                success: false,
                error: "Online stock cannot exceed total stock"
              });
              continue;
            }

            // Update product stock
            const [updatedProduct] = await tx
              .update(products)
              .set({
                totalStock: update.totalStock,
                onlineStock: update.onlineStock,
                updatedAt: new Date()
              })
              .where(eq(products.id, update.productId))
              .returning();

            // Record stock movement
            const totalChange = update.totalStock - currentProduct.totalStock;
            const onlineChange = update.onlineStock - currentProduct.onlineStock;

            if (totalChange !== 0) {
              await tx.insert(stockMovements).values({
                productId: update.productId,
                quantity: totalChange,
                movementType: "adjustment",
                source: "online", // Must be "store" | "online" per schema
                orderRefId: "", // Required field - use empty string for batch updates
                notes: `Batch stock update: Total ${currentProduct.totalStock} → ${update.totalStock}, Online ${currentProduct.onlineStock} → ${update.onlineStock}`,
                createdAt: new Date()
              });
            }

            processed.push({
              productId: update.productId,
              success: true,
              previousStock: {
                total: currentProduct.totalStock,
                online: currentProduct.onlineStock
              },
              newStock: {
                total: updatedProduct.totalStock,
                online: updatedProduct.onlineStock
              }
            });

          } catch (error: any) {
            processed.push({
              productId: update.productId,
              success: false,
              error: error.message
            });
          }
        }

        return processed;
      });

      // Log batch update for audit
      console.log(`Batch stock update performed by user ${(req as any).user.id}:`, {
        totalUpdates: updates.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      res.json({
        message: "Batch stock update completed",
        results,
        summary: {
          total: updates.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      });

    } catch (error: any) {
      console.error("Error in batch stock update:", error);
      res.status(500).json({
        message: "Failed to perform batch stock update",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Stock Audit Trail Endpoints
  
  // Get stock movement history with user attribution
  app.get("/api/inventory/stock-audit", authInventory, async (req, res) => {
    try {
      const {
        userId,
        productId,
        action,
        movementType,
        dateFrom,
        dateTo,
        search,
        page = 1,
        pageSize = 20
      } = req.query;

      const history = await stockAuditService.getStockMovementHistory({
        userId: userId as string,
        productId: productId as string,
        action: action as string,
        movementType: movementType as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        search: search as string,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string)
      });

      res.json(history);
    } catch (error: any) {
      console.error("Error fetching stock audit history:", error);
      const errorResponse = handleInventoryError(error, process.env.NODE_ENV === "development");
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  });

  // Get user-specific audit trail
  app.get("/api/inventory/stock-audit/user/:userId", authInventory, async (req, res) => {
    try {
      const { userId } = req.params;
      const { dateFrom, dateTo, page = 1, pageSize = 20 } = req.query;

      const trail = await stockAuditService.getUserAuditTrail(userId, {
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string)
      });

      res.json(trail);
    } catch (error: any) {
      console.error("Error fetching user audit trail:", error);
      const errorResponse = handleInventoryError(error, process.env.NODE_ENV === "development");
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  });

  // Get product-specific audit trail
  app.get("/api/inventory/stock-audit/product/:productId", authInventory, async (req, res) => {
    try {
      const { productId } = req.params;
      const { dateFrom, dateTo, page = 1, pageSize = 20 } = req.query;

      const trail = await stockAuditService.getProductAuditTrail(productId, {
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string)
      });

      res.json(trail);
    } catch (error: any) {
      console.error("Error fetching product audit trail:", error);
      const errorResponse = handleInventoryError(error, process.env.NODE_ENV === "development");
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  });

  // Generate audit report for compliance
  app.post("/api/inventory/stock-audit/report", authInventory, async (req, res) => {
    try {
      const { dateFrom, dateTo, userId, productId, movementType } = req.body;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          message: "dateFrom and dateTo are required"
        });
      }

      const report = await stockAuditService.generateAuditReport({
        dateFrom,
        dateTo,
        userId,
        productId,
        movementType
      });

      // Log report generation for audit
      console.log(`Audit report generated by user ${(req as any).user.id}:`, {
        dateFrom,
        dateTo,
        filters: { userId, productId, movementType },
        totalMovements: report.summary.totalMovements
      });

      res.json(report);
    } catch (error: any) {
      console.error("Error generating audit report:", error);
      const errorResponse = handleInventoryError(error, process.env.NODE_ENV === "development");
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  });

  // Create stock movement with audit trail
  app.post("/api/inventory/stock-movement-with-audit", authInventory, async (req, res) => {
    try {
      const {
        productId,
        quantity,
        movementType,
        source,
        orderRefId,
        notes
      } = req.body;

      // Validate required fields
      if (!productId || typeof quantity !== "number" || !movementType || !source) {
        return res.status(400).json({
          message: "productId, quantity, movementType, and source are required"
        });
      }

      // Create stock movement with audit
      await stockAuditService.createStockMovementWithAudit({
        productId,
        quantity,
        movementType,
        source,
        userId: (req as any).user.id,
        orderRefId,
        notes,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        message: "Stock movement created with audit trail",
        movement: {
          productId,
          quantity,
          movementType,
          source,
          orderRefId,
          notes,
          createdBy: (req as any).user.id,
          createdAt: new Date()
        }
      });

    } catch (error: any) {
      console.error("Error creating stock movement with audit:", error);
      const errorResponse = handleInventoryError(error, process.env.NODE_ENV === "development");
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  });

  // Stock Movement Endpoints with Pagination (POST)
  app.post("/api/inventory/stock-movements", authInventory, async (req, res) => {
    try {
      // Accept pagination from both query params and body
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
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.get("/api/inventory/low-stock", authInventory, async (req, res) => {
    try {
      // MIGRATED: Use role-based service for inventory users (full access)
      const items = await roleBasedProductService.getProductsByRole({ limit: 10 }, "inventory");
      const lowStockItems = items.filter(item => item.totalStock <= 10);
      res.json(lowStockItems);
    } catch {
      res.status(500).json({ message: "Failed to fetch low stock items" });
    }
  });

  app.get("/api/inventory/overview", authInventory, async (req, res) => {
    try {
      const overview = await storage.getInventoryOverview();
      res.json(overview);
    } catch {
      res.status(500).json({ message: "Failed to fetch inventory overview" });
    }
  });

  // Advanced Analytics Endpoints
  app.get(
    "/api/inventory/analytics/turnover",
    authInventory,
    async (req, res) => {
      try {
        const { limit, category, minStock } = req.query;

        // Validate query parameters
        const parsedLimit = limit ? parseInt(limit as string) : undefined;
        if (
          parsedLimit &&
          (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000)
        ) {
          return res.status(400).json({
            message: "Invalid limit parameter. Must be between 1 and 1000.",
          });
        }

        const turnover = await storage.getInventoryTurnover();

        // Apply filters if provided
        let filteredData = turnover;

        if (category) {
          filteredData = filteredData.filter((item) =>
            item.category
              .toLowerCase()
              .includes((category as string).toLowerCase()),
          );
        }

        if (minStock) {
          const minStockValue = parseInt(minStock as string);
          if (!isNaN(minStockValue)) {
            filteredData = filteredData.filter(
              (item) => item.totalStock >= minStockValue,
            );
          }
        }

        // Apply limit
        if (parsedLimit) {
          filteredData = filteredData.slice(0, parsedLimit);
        }

        // Add summary statistics
        const summary = {
          totalProducts: filteredData.length,
          averageTurnover:
            filteredData.length > 0
              ? filteredData.reduce(
                (sum, item) => sum + item.turnoverRatio,
                0,
              ) / filteredData.length
              : 0,
          highPerformers: filteredData.filter((item) => item.turnoverRatio >= 4)
            .length,
          lowPerformers: filteredData.filter((item) => item.turnoverRatio < 1)
            .length,
          totalStockValue: filteredData.reduce(
            (sum, item) => sum + item.costOfGoodsSold,
            0,
          ),
        };

        res.json({
          data: filteredData,
          summary,
          filters: { limit: parsedLimit, category, minStock },
        });
      } catch (error) {
        console.error("Error fetching inventory turnover:", error);
        res.status(500).json({
          message: "Failed to fetch inventory turnover",
          error:
            process.env.NODE_ENV === "development"
              ? (error as Error).message
              : undefined,
        });
      }
    },
  );

  app.get(
    "/api/inventory/analytics/abc-analysis",
    authInventory,
    async (req, res) => {
      try {
        const { class: abcClass, category, minRevenue } = req.query;

        // Validate query parameters
        if (abcClass && !["A", "B", "C"].includes(abcClass as string)) {
          return res.status(400).json({
            message: "Invalid class parameter. Must be 'A', 'B', or 'C'.",
          });
        }

        const minRevenueValue = minRevenue
          ? parseFloat(minRevenue as string)
          : undefined;
        if (
          minRevenueValue &&
          (isNaN(minRevenueValue) || minRevenueValue < 0)
        ) {
          return res.status(400).json({
            message: "Invalid minRevenue parameter. Must be a positive number.",
          });
        }

        const abcAnalysis = await storage.getABCAnalysis();

        // Apply filters
        let filteredData = abcAnalysis;

        if (abcClass) {
          filteredData = filteredData.filter((item) => item.class === abcClass);
        }

        if (category) {
          filteredData = filteredData.filter((item) =>
            item.category
              .toLowerCase()
              .includes((category as string).toLowerCase()),
          );
        }

        if (minRevenueValue) {
          filteredData = filteredData.filter(
            (item) => item.revenueContribution >= minRevenueValue,
          );
        }

        // Calculate summary statistics
        const summary = {
          totalProducts: filteredData.length,
          totalRevenue: filteredData.reduce(
            (sum, item) => sum + item.revenueContribution,
            0,
          ),
          classDistribution: {
            A: filteredData.filter((item) => item.class === "A").length,
            B: filteredData.filter((item) => item.class === "B").length,
            C: filteredData.filter((item) => item.class === "C").length,
          },
          revenueDistribution: {
            A: filteredData
              .filter((item) => item.class === "A")
              .reduce((sum, item) => sum + item.revenueContribution, 0),
            B: filteredData
              .filter((item) => item.class === "B")
              .reduce((sum, item) => sum + item.revenueContribution, 0),
            C: filteredData
              .filter((item) => item.class === "C")
              .reduce((sum, item) => sum + item.revenueContribution, 0),
          },
          averageRevenuePerProduct:
            filteredData.length > 0
              ? filteredData.reduce(
                (sum, item) => sum + item.revenueContribution,
                0,
              ) / filteredData.length
              : 0,
        };

        res.json({
          data: filteredData,
          summary,
          filters: { class: abcClass, category, minRevenue: minRevenueValue },
        });
      } catch (error) {
        console.error("Error fetching ABC analysis:", error);
        res.status(500).json({
          message: "Failed to fetch ABC analysis",
          error:
            process.env.NODE_ENV === "development"
              ? (error as Error).message
              : undefined,
        });
      }
    },
  );

  app.get(
    "/api/inventory/analytics/seasonal-trends",
    authInventory,
    async (req, res) => {
      try {
        const { trend, category, minSeasonality, months } = req.query;

        // Validate query parameters
        if (
          trend &&
          !["increasing", "decreasing", "stable", "seasonal"].includes(
            trend as string,
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid trend parameter. Must be 'increasing', 'decreasing', 'stable', or 'seasonal'.",
          });
        }

        const minSeasonalityValue = minSeasonality
          ? parseInt(minSeasonality as string)
          : undefined;
        if (
          minSeasonalityValue &&
          (isNaN(minSeasonalityValue) ||
            minSeasonalityValue < 0 ||
            minSeasonalityValue > 100)
        ) {
          return res.status(400).json({
            message:
              "Invalid minSeasonality parameter. Must be between 0 and 100.",
          });
        }

        const monthsValue = months ? parseInt(months as string) : undefined;
        if (
          monthsValue &&
          (isNaN(monthsValue) || monthsValue < 1 || monthsValue > 24)
        ) {
          return res.status(400).json({
            message: "Invalid months parameter. Must be between 1 and 24.",
          });
        }

        const seasonalTrends = await storage.getSeasonalTrends();

        // Apply filters
        let filteredData = seasonalTrends;

        if (trend) {
          filteredData = filteredData.filter((item) => item.trend === trend);
        }

        if (category) {
          filteredData = filteredData.filter((item) =>
            item.category
              .toLowerCase()
              .includes((category as string).toLowerCase()),
          );
        }

        if (minSeasonalityValue) {
          filteredData = filteredData.filter(
            (item) => item.seasonalityIndex >= minSeasonalityValue,
          );
        }

        // Filter by data points (months)
        if (monthsValue) {
          filteredData = filteredData.filter(
            (item) => item.monthlyData.length >= monthsValue,
          );
        }

        // Calculate summary statistics
        const summary = {
          totalProducts: filteredData.length,
          trendDistribution: {
            increasing: filteredData.filter(
              (item) => item.trend === "increasing",
            ).length,
            decreasing: filteredData.filter(
              (item) => item.trend === "decreasing",
            ).length,
            stable: filteredData.filter((item) => item.trend === "stable")
              .length,
            seasonal: filteredData.filter((item) => item.trend === "seasonal")
              .length,
          },
          averageSeasonality:
            filteredData.length > 0
              ? filteredData.reduce(
                (sum, item) => sum + item.seasonalityIndex,
                0,
              ) / filteredData.length
              : 0,
          highlySeasonal: filteredData.filter(
            (item) => item.seasonalityIndex > 30,
          ).length,
          totalDataPoints: filteredData.reduce(
            (sum, item) => sum + item.monthlyData.length,
            0,
          ),
          categories: Array.from(
            new Set(filteredData.map((item) => item.category)),
          ).length,
        };

        res.json({
          data: filteredData,
          summary,
          filters: {
            trend,
            category,
            minSeasonality: minSeasonalityValue,
            months: monthsValue,
          },
        });
      } catch (error) {
        console.error("Error fetching seasonal trends:", error);
        res.status(500).json({
          message: "Failed to fetch seasonal trends",
          error:
            process.env.NODE_ENV === "development"
              ? (error as Error).message
              : undefined,
        });
      }
    },
  );

  // Analytics summary endpoint
  app.get(
    "/api/inventory/analytics/summary",
    authInventory,
    async (req, res) => {
      try {
        // Fetch all analytics data in parallel
        const [turnover, abcAnalysis, seasonalTrends] = await Promise.all([
          storage.getInventoryTurnover(),
          storage.getABCAnalysis(),
          storage.getSeasonalTrends(),
        ]);

        // Calculate comprehensive summary
        const summary = {
          inventory: {
            totalProducts: turnover.length,
            averageTurnover:
              turnover.length > 0
                ? turnover.reduce((sum, item) => sum + item.turnoverRatio, 0) /
                turnover.length
                : 0,
            highPerformers: turnover.filter((item) => item.turnoverRatio >= 4)
              .length,
            lowPerformers: turnover.filter((item) => item.turnoverRatio < 1)
              .length,
          },
          abc: {
            totalRevenue: abcAnalysis.reduce(
              (sum, item) => sum + item.revenueContribution,
              0,
            ),
            classDistribution: {
              A: abcAnalysis.filter((item) => item.class === "A").length,
              B: abcAnalysis.filter((item) => item.class === "B").length,
              C: abcAnalysis.filter((item) => item.class === "C").length,
            },
            topProducts: abcAnalysis.slice(0, 10).map((item) => ({
              name: item.productName,
              revenue: item.revenueContribution,
              class: item.class,
            })),
          },
          seasonal: {
            totalProducts: seasonalTrends.length,
            trendDistribution: {
              increasing: seasonalTrends.filter(
                (item) => item.trend === "increasing",
              ).length,
              decreasing: seasonalTrends.filter(
                (item) => item.trend === "decreasing",
              ).length,
              stable: seasonalTrends.filter((item) => item.trend === "stable")
                .length,
              seasonal: seasonalTrends.filter(
                (item) => item.trend === "seasonal",
              ).length,
            },
            highlySeasonal: seasonalTrends.filter(
              (item) => item.seasonalityIndex > 30,
            ).length,
            averageSeasonality:
              seasonalTrends.length > 0
                ? seasonalTrends.reduce(
                  (sum, item) => sum + item.seasonalityIndex,
                  0,
                ) / seasonalTrends.length
                : 0,
          },
          insights: {
            criticalIssues: [
              ...(turnover.filter((item) => item.turnoverRatio < 1).length > 0
                ? [
                  {
                    type: "low_turnover",
                    count: turnover.filter((item) => item.turnoverRatio < 1)
                      .length,
                    description: "Products with very low turnover ratio",
                  },
                ]
                : []),
              ...(turnover.filter((item) => item.daysOfSupply > 365).length > 0
                ? [
                  {
                    type: "excess_stock",
                    count: turnover.filter((item) => item.daysOfSupply > 365)
                      .length,
                    description: "Products with over 1 year of supply",
                  },
                ]
                : []),
            ],
            opportunities: [
              ...(seasonalTrends.filter((item) => item.trend === "increasing")
                .length > 0
                ? [
                  {
                    type: "growing_products",
                    count: seasonalTrends.filter(
                      (item) => item.trend === "increasing",
                    ).length,
                    description: "Products with increasing demand",
                  },
                ]
                : []),
              ...(abcAnalysis.filter(
                (item) => item.class === "A" && item.currentStock < 5,
              ).length > 0
                ? [
                  {
                    type: "high_value_low_stock",
                    count: abcAnalysis.filter(
                      (item) => item.class === "A" && item.currentStock < 5,
                    ).length,
                    description: "High-value products with low stock",
                  },
                ]
                : []),
            ],
          },
          generatedAt: new Date().toISOString(),
        };

        res.json(summary);
      } catch (error) {
        console.error("Error fetching analytics summary:", error);
        res.status(500).json({
          message: "Failed to fetch analytics summary",
          error:
            process.env.NODE_ENV === "development"
              ? (error as Error).message
              : undefined,
        });
      }
    },
  );

  app.post("/api/inventory/store-sales", authInventory, async (req, res) => {
    try {
      const { page, pageSize } = req.query;
      const { search, dateFrom, dateTo, storeId } = req.body;
      if (page && pageSize) {
        const params = parsePaginationParams(req.query);
        const result = await storage.getStoreSalesPaginatedInventory({
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

  // Product Damage Management

  // Report product damage
  app.post("/api/inventory/damages", authInventory, async (req, res) => {
    try {
      const validatedData = insertProductDamageSchema.parse(req.body);

      // Add the user reporting the damage and filter to only include expected fields
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
        // Handle validation errors
        if (error.message.includes("validation")) {
          return res.status(400).json({
            message: "Validation failed",
            error: error.message
          });
        }
        // Handle permission errors
        if (error.message.includes("permission") || error.message.includes("Insufficient permissions")) {
          return res.status(403).json({
            message: "Permission denied",
            error: error.message
          });
        }
        // Handle stock errors
        if (error.message.includes("stock") || error.message.includes("Insufficient")) {
          return res.status(409).json({
            message: "Stock validation failed",
            error: error.message
          });
        }
        // Handle data consistency errors
        if (error.message.includes("consistency") || error.message.includes("not found")) {
          return res.status(400).json({
            message: "Data validation failed",
            error: error.message
          });
        }
      }

      res.status(500).json({
        message: "Failed to report damage",
        error: process.env.NODE_ENV === "development" ?
          (error instanceof Error ? error.message : "Unknown error") : undefined
      });
    }
  });

  // Get all damages with filters
  app.post("/api/inventory/getDamages", authInventory, async (req, res) => {
    try {
      const {
        productId,
        source,
        status,
        category,
        severity,
        dateFrom,
        dateTo,
        search,
        page = 1,
        pageSize = 10
      } = req.body;
      const params = parsePaginationParams({ page, pageSize });

      const result = await productDamageService.getDamages({
        productId: productId as string,
        source: source as
          | "store"
          | "online_return"
          | "warehouse"
          | "shipping"
          | "manufacturing",
        status: status as string,
        category: category as "manufacturing_defect" | "shipping_damage" | "storage_damage" | "handling_damage" | "customer_damage" | "expired" | "theft_loss" | "other" | undefined,
        severity: severity as "minor" | "major" | "total_loss" | undefined,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
        search: search as string,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      });

      const paginatedResponse = {
        data: result.data,
        total: result.total,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: Math.ceil(result.total / params.pageSize),
      };

      return res.json(paginatedResponse);

    } catch (error) {
      console.error("Failed to fetch damages:", error);

      if (error instanceof Error) {
        // Handle validation errors
        if (error.message.includes("validation") || error.message.includes("Invalid")) {
          return res.status(400).json({
            message: "Invalid request parameters",
            error: error.message
          });
        }
      }

      res.status(500).json({
        message: "Failed to fetch damages",
        error: process.env.NODE_ENV === "development" ?
          (error instanceof Error ? error.message : "Unknown error") : undefined
      });
    }
  });

  // Get damage analytics
  app.get(
    "/api/inventory/damage-analytics",
    authInventory,
    async (req, res) => {
      try {
        const { productId, source, dateFrom, dateTo } = req.query;

        const analytics = await productDamageService.getDamageAnalytics({
          productId: productId as string,
          source: source as
            | "store"
            | "online_return"
            | "warehouse"
            | "shipping"
            | "manufacturing",
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
        });

        res.json(analytics);
      } catch (error) {
        console.error("Failed to fetch damage analytics:", error);

        if (error instanceof Error) {
          // Handle validation errors
          if (error.message.includes("validation") || error.message.includes("Invalid")) {
            return res.status(400).json({
              message: "Invalid request parameters",
              error: error.message
            });
          }
        }

        res.status(500).json({
          message: "Failed to fetch damage analytics",
          error: process.env.NODE_ENV === "development" ?
            (error instanceof Error ? error.message : "Unknown error") : undefined
        });
      }
    },
  );

  // Get specific damage by ID
  app.get("/api/inventory/damages/:id", authInventory, async (req, res) => {
    try {
      const damage = await productDamageService.getDamageById(req.params.id);

      if (!damage) {
        return res.status(404).json({ message: "Damage not found" });
      }

      res.json(damage);
    } catch (error) {
      console.error("Failed to fetch damage:", error);

      if (error instanceof Error) {
        // Handle validation errors
        if (error.message.includes("validation") || error.message.includes("Invalid")) {
          return res.status(400).json({
            message: "Invalid request parameters",
            error: error.message
          });
        }
      }

      res.status(500).json({
        message: "Failed to fetch damage",
        error: process.env.NODE_ENV === "development" ?
          (error instanceof Error ? error.message : "Unknown error") : undefined
      });
    }
  });

  // Update damage status (approve/reject)
  app.patch(
    "/api/inventory/damages/:id/status",
    authInventory,
    async (req, res) => {
      try {
        const { status, notes } = req.body;

        if (!status) {
          return res.status(400).json({ message: "Status is required" });
        }

        const damage = await productDamageService.updateDamageStatus(
          req.params.id,
          status,
          req.user!.id,
          notes,
        );

        res.json(damage);
      } catch (error) {
        console.error("Failed to update damage status:", error);

        if (error instanceof Error) {
          // Handle validation errors
          if (error.message.includes("validation") || error.message.includes("Invalid")) {
            return res.status(400).json({
              message: "Invalid request parameters",
              error: error.message
            });
          }
          // Handle permission errors
          if (error.message.includes("permission") || error.message.includes("Insufficient permissions")) {
            return res.status(403).json({
              message: "Permission denied",
              error: error.message
            });
          }
          // Handle not found errors
          if (error.message.includes("not found")) {
            return res.status(404).json({
              message: "Damage record not found",
              error: error.message
            });
          }
        }

        res.status(500).json({
          message: "Failed to update damage status",
          error: process.env.NODE_ENV === "development" ?
            (error instanceof Error ? error.message : "Unknown error") : undefined
        });
      }
    },
  );

};
