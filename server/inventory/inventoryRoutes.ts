import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { refundService } from "../refund/refundService";
import { createAuthMiddleware } from "../authMiddleware";
import { parsePaginationParams } from "../paginationHelper";
import { z } from "zod";
import { orderService } from "../order/orderStorage";
import { storeService } from "server/store/storeStorage";
import { inventoryService } from "./inventoryStorage";
import { productService } from "server/product/productStorage";
import { publicStorage } from "../common/publicStorage";
const storeAllocationSchema = z.object({
  storeId: z.string().min(1, "Store ID is required"),
  quantity: z.number().int().min(0, "Quantity must be a non-negative integer"),
});

const isValidMediaUrl = (url: string): boolean => {
  if (!url || url.trim() === "") return true;
  if (url.startsWith("/objects/")) return true;
  if (url.startsWith("https://images.unsplash.com/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const emptyToNull = z
  .string()
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .optional();

const trackingNumberSchema = z.object({
  trackingNumber: z
    .string()
    .transform((val) => val.trim())
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

const productBaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z
    .string()
    .or(z.number())
    .transform((val) => String(val)),
  actualPrice: z
    .string()
    .or(z.number())
    .optional()
    .transform((val) => val ? String(val) : undefined),
  categoryId: emptyToNull,
  subcategoryId: emptyToNull,
  colorId: emptyToNull,
  fabricId: emptyToNull,
  imageUrl: z
    .string()
    .optional()
    .transform((val) => (val === "" ? null : val))
    .nullable(),
  images: z
    .array(z.string().refine(isValidMediaUrl, { message: "Invalid image URL" }))
    .optional()
    .default([]),
  videoUrl: z
    .string()
    .optional()
    .transform((val) => (val === "" ? null : val))
    .nullable(),
  sku: z
    .string()
    .optional()
    .transform((val) => (val === "" ? null : val))
    .nullable(),
  totalStock: z.number().int().min(0, "Total stock must be non-negative"),
  onlineStock: z.number().int().min(0, "Online stock must be non-negative"),
  distributionChannel: z.enum(["shop", "online", "both"]),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  storeAllocations: z.array(storeAllocationSchema).optional().default([]),
});

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
      res.status(500).json({ message: "Failed to fetch filters" });
    }
  });

  app.get("/api/inventory/low-stock", authInventory, async (req, res) => {
    try {
      const items = await productService.getLowStockProducts(10);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch low stock items" });
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
      res.status(500).json({ message: "Failed to fetch requests" });
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
          const request = await storage.getStockRequest(req.params.id);

          if (!request) {
            return res.status(404).json({ message: "Request not found" });
          }

          // Get product details to check available stock
          const product = await productService.getProduct(request.productId);
          if (!product) {
            return res.status(404).json({ message: "Product not found" });
          }

          // Check if sufficient stock is available
          if (product.totalStock < request.quantity) {
            return res.status(400).json({
              message: `Insufficient stock available. Available: ${product.totalStock}, Requested: ${request.quantity}`,
              availableStock: product.totalStock,
              requestedQuantity: request.quantity,
            });
          }
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
      } catch (error) {
        console.error("Error updating stock request status:", error);
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
      } catch (error) {
        console.error("Error updating tracking number:", error);
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch stock distribution" });
      }
    },
  );

  // Inventory product management (moved from admin)
  app.post("/api/inventory/getProducts", authInventory, async (req, res) => {
    try {
      const {
        search,
        status,
        dateFrom,
        dateTo,
        categoryIds,
        colorIds,
        fabricIds,
      } = req.body;

      const params = parsePaginationParams(req.query);

      const result = await productService.getProductsPaginated({
        page: params.page,
        pageSize: params.pageSize,
        search,
        categoryIds,
        colorIds,
        fabricIds,
        status,
        dateFrom,
        dateTo,
        userRole: (req as any).user?.role,
      });
      return res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/inventory/stores", authInventory, async (req, res) => {
    try {
      const stores = await storeService.getStores();
      res.json(stores);
    } catch (error) {
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
      } catch (error) {
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

      const { storeAllocations, actualPrice, ...productData } = validation.data;

      if (productData.distributionChannel === "online") {
        productData.onlineStock = productData.totalStock;
        const product = await inventoryService.createProductWithAllocations(
          productData,
          [],
          actualPrice,
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
        );
        res.json(product);
      }
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch("/api/inventory/products/:id", authInventory, async (req, res) => {
    try {
      const validation = productUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: validation.error.errors[0]?.message || "Invalid input",
        });
      }

      const { storeAllocations, actualPrice, ...productData } = validation.data;
      const allocations = storeAllocations || [];

      if (productData.distributionChannel === "online") {
        productData.onlineStock = productData.totalStock;
        const product = await inventoryService.updateProductWithAllocations(
          req.params.id,
          productData,
          [],
          actualPrice,
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
        );
        res.json(product);
      } else {
        const product = await inventoryService.updateProductWithAllocations(
          req.params.id,
          productData,
          allocations,
          actualPrice,
        );
        res.json(product);
      }
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/inventory/products/:id", authInventory, async (req, res) => {
    try {
      await productService.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Admin/Inventory: Get all refunds
  app.get("/api/inventory/refunds", authInventory, async (req, res) => {
    try {
      const { status } = req.query;
      const refunds = await storage.getRefunds({
        status: status as string | undefined,
      });
      res.json(refunds);
    } catch (error) {
      console.error("Error fetching refunds:", error);
      res.status(500).json({ message: "Failed to fetch refunds" });
    }
  });

  // Admin/Inventory: Process refund
  app.patch(
    "/api/inventory/refunds/:id/process",
    authInventory,
    async (req, res) => {
      try {
        const { status, transactionId } = req.body;

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
            transactionId,
          );
        }

        res.json(updated);
      } catch (error) {
        console.error("Error processing refund:", error);
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
      } catch (error) {
        console.error("Error checking refund status:", error);
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
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  app.get("/api/inventory/stock-stats", authInventory, async (req, res) => {
    try {
      const stats = await storage.getStockMovementStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stock stats:", error);
      res.status(500).json({ message: "Failed to fetch stock stats" });
    }
  });

  app.get("/api/inventory/overview", authInventory, async (req, res) => {
    try {
      const overview = await storage.getInventoryOverview();
      res.json(overview);
    } catch (error) {
      console.error("Error fetching inventory overview:", error);
      res.status(500).json({ message: "Failed to fetch inventory overview" });
    }
  });

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
    } catch (error) {
      console.error("Error fetching store sales:", error);
      res.status(500).json({ message: "Failed to fetch store sales" });
    }
  });
};
