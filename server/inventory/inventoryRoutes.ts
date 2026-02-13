import { insertProductDamageSchema, products } from "@shared/schema";
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
      const requests = await storage.getStockRequests({
        status: status as string,
      });
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

        // Get the request details to check stock before approval
        if (status === "approved") {
          const stockRequest = await storage.getStockRequest(req.params.id);

          if (!stockRequest) {
            return res.status(404).json({ message: "Request not found" });
          }

          // Use database transaction to prevent race conditions
          await db.transaction(async (tx: any) => {
            // Get product details within transaction for consistent read
            const [product] = await tx
              .select()
              .from(products)
              .where(eq(products.id, stockRequest.productId))
              .for('update'); // Lock the row for this transaction

            if (!product) {
              throw new Error("Product not found");
            }

            // Check if sufficient stock is available (double-check within transaction)
            if (product.totalStock < stockRequest.quantity) {
              throw new Error(`Insufficient stock available. Available: ${product.totalStock}, Requested: ${stockRequest.quantity}`);
            }

            // Update stock atomically
            await tx
              .update(products)
              .set({ 
                totalStock: product.totalStock - stockRequest.quantity,
                updatedAt: new Date()
              })
              .where(eq(products.id, stockRequest.productId));
          });

          // If we get here, the stock was successfully updated
          const updateData: any = { status };
          if (rejectionReason && status === "rejected") {
            updateData.notes = rejectionReason;
          }

          const updatedRequest = await storage.updateStockRequestStatus(
            req.params.id,
            status,
            (req as any).user.id,
            rejectionReason,
          );
          
          if (!updatedRequest) {
            return res.status(404).json({ message: "Request not found" });
          }
          res.json(updatedRequest);
          return;
        }

        const updateData: any = { status };
        if (rejectionReason && status === "rejected") {
          updateData.notes = rejectionReason;
        }

        const request = await storage.updateStockRequestStatus(
          req.params.id,
          status,
          (req as any).user.id,
          rejectionReason,
        );
        if (!request) {
          return res.status(404).json({ message: "Request not found" });
        }
        res.json(request);
      } catch  {
        res.status(500).json({ message: "Failed to update request" });
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
      } catch  {
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
    } catch  {
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
    } catch  {
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
    } catch  {
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
      } catch  {
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
      } catch  {
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
      } catch  {
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
      } catch  {
        res.status(500).json({ message: "Failed to fetch stock distribution" });
      }
    },
  );

  // Inventory product management (moved from admin)
  app.post("/api/inventory/getProducts", authInventory, async (req, res) => {
    try {
      const {
        search,
        categoryIds,
      } = req.body;

      const params = parsePaginationParams(req.query);

      // Convert categoryIds to names for role-based service
      let categoryNames: string[] = [];
      if (categoryIds && categoryIds.length > 0) {
        const categories = await publicStorage.getCategoriesWithSubcategories();
        categoryNames = categories
          .filter((cat: any) => categoryIds.includes(cat.id))
          .map((cat: any) => cat.name);
      }

      const filters: ProductFilters = {
        search,
        category: categoryNames,
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
    } catch  {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/inventory/stores", authInventory, async (req, res) => {
    try {
      const stores = await storeService.getStores();
      res.json(stores);
    } catch  {
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
      } catch  {
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
        const storeAllocationsMap = new Map<string, {quantity: number, storeName: string}>();
        variants.forEach(variant => {
          variant.storeAllocations?.forEach(alloc => {
            const current = storeAllocationsMap.get(alloc.storeId) || {quantity: 0, storeName: ''};
            storeAllocationsMap.set(alloc.storeId, {
              quantity: current.quantity + alloc.quantity,
              storeName: current.storeName || `Store ${alloc.storeId}` // Fallback name
            });
          });
        });
        
        const aggregatedStoreAllocations = Array.from(storeAllocationsMap.entries()).map(([storeId, data]) => ({
          storeId,
          quantity: data.quantity
        }));

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
        if (totalAllocated !== productData.totalStock) {
          return res.status(400).json({
            message: `Store allocations (${totalAllocated}) must equal total stock (${productData.totalStock})`,
          });
        }
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
        if (storeTotal + onlineStock !== productData.totalStock) {
          return res.status(400).json({
            message: `Online (${onlineStock}) + Store allocations (${storeTotal}) must equal total stock (${productData.totalStock})`,
          });
        }
        const product = await inventoryService.createProductWithAllocations(
          productData,
          allocations,
          actualPrice,
          seoData
        );
        res.json(product);
      }
    } catch  {
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch("/api/inventory/products/:id", authInventory, async (req, res) => {
    try {
      console.log("Update request body:", JSON.stringify(req.body, null, 2));
      
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
        const storeAllocationsMap = new Map<string, {quantity: number, storeName: string}>();
        variants.forEach(variant => {
          variant.storeAllocations?.forEach(alloc => {
            const current = storeAllocationsMap.get(alloc.storeId) || {quantity: 0, storeName: ''};
            storeAllocationsMap.set(alloc.storeId, {
              quantity: current.quantity + alloc.quantity,
              storeName: current.storeName || `Store ${alloc.storeId}`
            });
          });
        });
        
        const aggregatedStoreAllocations = Array.from(storeAllocationsMap.entries()).map(([storeId, data]) => ({
          storeId,
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
    } catch  {
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
    } catch  {
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
      } catch  {
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
    } catch  {
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
      } catch  {
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
      } catch  {
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

  // Stock Movement Endpoints
  app.get("/api/inventory/stock-movements", authInventory, async (req, res) => {
    try {
      const { source, productId, limit } = req.query;
      const movements = await storage.getStockMovements({
        source: source as string,
        productId: productId as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(movements);
    } catch  {
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  app.get("/api/inventory/low-stock", authInventory, async (req, res) => {
    try {
      // MIGRATED: Use role-based service for inventory users (full access)
      const items = await roleBasedProductService.getProductsByRole({ limit: 10 }, "inventory");
      const lowStockItems = items.filter(item => item.totalStock <= 10);
      res.json(lowStockItems);
    } catch  {
      res.status(500).json({ message: "Failed to fetch low stock items" });
    }
  });

  app.get("/api/inventory/overview", authInventory, async (req, res) => {
    try {
      const overview = await storage.getInventoryOverview();
      res.json(overview);
    } catch  {
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
    } catch  {
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
    } catch  {
      res.status(500).json({ message: "Failed to report damage" });
    }
  });

  // Get all damages with filters
  app.get("/api/inventory/damages", authInventory, async (req, res) => {
    try {
      const { productId, source, status, limit } = req.query;

      const damages = await productDamageService.getDamages({
        productId: productId as string,
        source: source as
          | "store"
          | "online_return"
          | "warehouse"
          | "shipping"
          | "manufacturing",
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json(damages);
    } catch  {
      res.status(500).json({ message: "Failed to fetch damages" });
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
      } catch  {
        res.status(500).json({ message: "Failed to fetch damage analytics" });
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
    } catch  {
      res.status(500).json({ message: "Failed to fetch damage" });
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
      } catch  {
        res.status(500).json({ message: "Failed to update damage status" });
      }
    },
  );
};
