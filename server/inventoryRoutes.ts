import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { createAuthMiddleware } from "./authMiddleware";
import { z } from "zod";
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

const mediaUrlSchema = z.string().refine(
  (url) => !url || isValidMediaUrl(url),
  { message: "Invalid URL format - must be HTTPS or a valid object path" }
).optional();

const emptyToNull = z.string().transform(val => val === "" ? null : val).nullable().optional();

const sareeBaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.string().or(z.number()).transform(val => String(val)),
  categoryId: emptyToNull,
  colorId: emptyToNull,
  fabricId: emptyToNull,
  imageUrl: z.string().optional().transform(val => val === "" ? null : val).nullable(),
  images: z.array(z.string().refine(isValidMediaUrl, { message: "Invalid image URL" })).optional().default([]),
  videoUrl: z.string().optional().transform(val => val === "" ? null : val).nullable(),
  sku: z.string().optional().transform(val => val === "" ? null : val).nullable(),
  totalStock: z.number().int().min(0, "Total stock must be non-negative"),
  onlineStock: z.number().int().min(0, "Online stock must be non-negative"),
  distributionChannel: z.enum(["shop", "online", "both"]),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  storeAllocations: z.array(storeAllocationSchema).optional().default([]),
});

const sareeWithAllocationsSchema = sareeBaseSchema.refine(data => {
  const storeIds = data.storeAllocations?.map(a => a.storeId) || [];
  return new Set(storeIds).size === storeIds.length;
}, { message: "Duplicate store IDs are not allowed" });

const sareeUpdateSchema = sareeBaseSchema.partial();


export const inventoryRoutes = (app: Express) => {
const authInventory = createAuthMiddleware(["inventory"]);

  app.get("/api/inventory/low-stock", authInventory, async (req, res) => {
    try {
      const items = await storage.getLowStockSarees(10);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch low stock items" });
    }
  });

  app.get("/api/inventory/requests", authInventory, async (req, res) => {
    try {
      const { status } = req.query;
      const requests = await storage.getStockRequests({ status: status as string });
      res.json(requests);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.patch("/api/inventory/requests/:id/status", authInventory, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      const request = await storage.updateStockRequestStatus(
        req.params.id,
        status,
        (req as any).user.id
      );
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error updating stock request status:", error);
      res.status(500).json({ message: "Failed to update request" });
    }
  });

  app.get("/api/inventory/orders", authInventory, async (req, res) => {
    try {
      const { status } = req.query;
      const orders = await storage.getAllOrders({ status: status as string });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.patch("/api/inventory/orders/:id/status", authInventory, async (req, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status);
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.patch("/api/inventory/sarees/:id/distribution", authInventory, async (req, res) => {
    try {
      const { channel } = req.body;
      const saree = await storage.updateSaree(req.params.id, { distributionChannel: channel });
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to update distribution" });
    }
  });

  app.patch("/api/inventory/sarees/:id/stock", authInventory, async (req, res) => {
    try {
      const { totalStock, onlineStock } = req.body;
      const saree = await storage.updateSaree(req.params.id, { totalStock, onlineStock });
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to update stock" });
    }
  });

  app.get("/api/inventory/stock-distribution", authInventory, async (req, res) => {
    try {
      const distribution = await storage.getStockDistribution();
      res.json(distribution);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stock distribution" });
    }
  });

  // Inventory saree management (moved from admin)
  app.get("/api/inventory/sarees", authInventory, async (req, res) => {
    try {
      const sarees = await storage.getSarees({});
      res.json(sarees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sarees" });
    }
  });

  app.get("/api/inventory/stores", authInventory, async (req, res) => {
    try {
      const stores = await storage.getStores();
      res.json(stores);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.get("/api/inventory/sarees/:id/allocations", authInventory, async (req, res) => {
    try {
      const allocations = await storage.getSareeAllocations(req.params.id);
      res.json(allocations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch allocations" });
    }
  });

  app.post("/api/inventory/sarees", authInventory, async (req, res) => {
    try {
      const validation = sareeWithAllocationsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0]?.message || "Invalid input" });
      }

      const { storeAllocations, ...sareeData } = validation.data;

      if (sareeData.distributionChannel === "online") {
        sareeData.onlineStock = sareeData.totalStock;
        const saree = await storage.createSareeWithAllocations(sareeData, []);
        res.json(saree);
      } else if (sareeData.distributionChannel === "shop") {
        sareeData.onlineStock = 0;
        const allocations = storeAllocations || [];
        const totalAllocated = allocations.reduce((sum, a) => sum + a.quantity, 0);
        if (totalAllocated !== sareeData.totalStock) {
          return res.status(400).json({ message: `Store allocations (${totalAllocated}) must equal total stock (${sareeData.totalStock})` });
        }
        const saree = await storage.createSareeWithAllocations(sareeData, allocations);
        res.json(saree);
      } else {
        const allocations = storeAllocations || [];
        const storeTotal = allocations.reduce((sum, a) => sum + a.quantity, 0);
        const onlineStock = sareeData.onlineStock || 0;
        if (storeTotal + onlineStock !== sareeData.totalStock) {
          return res.status(400).json({ 
            message: `Online (${onlineStock}) + Store allocations (${storeTotal}) must equal total stock (${sareeData.totalStock})` 
          });
        }
        const saree = await storage.createSareeWithAllocations(sareeData, allocations);
        res.json(saree);
      }
    } catch (error) {
      console.error("Error creating saree:", error);
      res.status(500).json({ message: "Failed to create saree" });
    }
  });

  app.patch("/api/inventory/sarees/:id", authInventory, async (req, res) => {
    try {
      const validation = sareeUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0]?.message || "Invalid input" });
      }

      const { storeAllocations, ...sareeData } = validation.data;
      const allocations = storeAllocations || [];

      if (sareeData.distributionChannel === "online") {
        sareeData.onlineStock = sareeData.totalStock;
        const saree = await storage.updateSareeWithAllocations(req.params.id, sareeData, []);
        res.json(saree);
      } else if (sareeData.distributionChannel === "shop") {
        sareeData.onlineStock = 0;
        const totalAllocated = allocations.reduce((sum: number, a: { quantity: number }) => sum + a.quantity, 0);
        if (sareeData.totalStock !== undefined && totalAllocated !== sareeData.totalStock) {
          return res.status(400).json({ message: `Store allocations (${totalAllocated}) must equal total stock (${sareeData.totalStock})` });
        }
        const saree = await storage.updateSareeWithAllocations(req.params.id, sareeData, allocations);
        res.json(saree);
      } else if (sareeData.distributionChannel === "both") {
        const storeTotal = allocations.reduce((sum: number, a: { quantity: number }) => sum + a.quantity, 0);
        const onlineStock = sareeData.onlineStock || 0;
        if (sareeData.totalStock !== undefined && storeTotal + onlineStock !== sareeData.totalStock) {
          return res.status(400).json({ 
            message: `Online (${onlineStock}) + Store allocations (${storeTotal}) must equal total stock (${sareeData.totalStock})` 
          });
        }
        const saree = await storage.updateSareeWithAllocations(req.params.id, sareeData, allocations);
        res.json(saree);
      } else {
        const saree = await storage.updateSareeWithAllocations(req.params.id, sareeData, allocations);
        res.json(saree);
      }
    } catch (error) {
      console.error("Error updating saree:", error);
      res.status(500).json({ message: "Failed to update saree" });
    }
  });

  app.delete("/api/inventory/sarees/:id", authInventory, async (req, res) => {
    try {
      await storage.deleteSaree(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete saree" });
    }
  });

    // Admin/Inventory: Get all return requests
    app.get("/api/inventory/returns", authInventory, async (req, res) => {
      try {
        const { status } = req.query;
        const returns = await storage.getReturnRequests({
          status: status as string | undefined,
        });
        res.json(returns);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch return requests" });
      }
    });

    // Admin/Inventory: Update return request status
    app.patch("/api/inventory/returns/:id/status", authInventory, async (req, res) => {
      try {
        const user = (req as any).user;
        const { status, adminNotes } = req.body;

        const returnRequest = await storage.getReturnRequest(req.params.id);
        if (!returnRequest) {
          return res.status(404).json({ message: "Return request not found" });
        }

        const updated = await storage.updateReturnRequestStatus(
          req.params.id,
          status,
          user.id,
          adminNotes
        );

        // Create notification for user
        let notificationTitle = "";
        let notificationMessage = "";

        const isExchange = returnRequest.resolution === "exchange";

        switch (status) {
          case "approved":
            notificationTitle = isExchange ? "Exchange Request Approved" : "Return Request Approved";
            notificationMessage = isExchange 
              ? `Your exchange request has been approved. Please ship the items back and we'll send your exchange product.`
              : `Your return request has been approved. Please ship the items back.`;
            break;
          case "rejected":
            notificationTitle = isExchange ? "Exchange Request Rejected" : "Return Request Rejected";
            notificationMessage = `Your ${isExchange ? "exchange" : "return"} request has been rejected. ${adminNotes || ""}`;
            break;
          case "received":
            notificationTitle = "Return Items Received";
            notificationMessage = `We have received your return items and they are being processed.`;
            break;
          case "completed":
            if (isExchange) {
              notificationTitle = "Exchange Completed";
              notificationMessage = `Your exchange has been completed. Your new product will be shipped soon!`;
            } else {
              notificationTitle = "Return Completed";
              notificationMessage = `Your return has been completed. Refund will be processed shortly.`;

              // Create refund record when return is completed
              await storage.createRefund({
                returnRequestId: returnRequest.id,
                orderId: returnRequest.orderId,
                userId: returnRequest.userId,
                amount: returnRequest.refundAmount || "0",
                reason: "return_completed",
              });

              // Restore stock for returned items if restockable
              for (const item of returnRequest.items) {
                if (item.isRestockable) {
                  await storage.restoreStockFromReturn(
                    item.orderItem.sareeId,
                    item.quantity,
                    returnRequest.orderId
                  );
                }
              }
            }
            
            // Handle exchange order creation if resolution type is exchange
            if (isExchange && status === "completed" && !returnRequest.exchangeOrderId) {
              const originalOrder = await storage.getOrder(returnRequest.orderId);
              if (originalOrder) {
                // Create exchange order with same items
                const exchangeOrder = await storage.createOrder(
                  {
                    userId: returnRequest.userId,
                    totalAmount: returnRequest.refundAmount || "0",
                    discountAmount: "0",
                    finalAmount: returnRequest.refundAmount || "0",
                    status: "confirmed",
                    paymentStatus: "paid",
                    paymentMethod: "exchange",
                    shippingAddress: originalOrder.shippingAddress,
                    phone: originalOrder.phone,
                    notes: `Exchange order for original order #${returnRequest.orderId.slice(0, 8)}`,
                  },
                  returnRequest.items.map(item => ({
                    sareeId: item.orderItem.sareeId,
                    quantity: item.quantity,
                    price: item.orderItem.price,
                  }))
                );

                // Link exchange order to return request
                await storage.updateReturnRequest(returnRequest.id, {
                  exchangeOrderId: exchangeOrder.id,
                });

                // Create notification about exchange order
                await storage.createNotification({
                  userId: returnRequest.userId,
                  type: "order",
                  title: "Exchange Order Created",
                  message: `Your exchange order #${exchangeOrder.id.slice(0, 8)} has been created and will be shipped soon!`,
                  relatedId: exchangeOrder.id,
                  relatedType: "order",
                });
              }
            }
            break;
        }

        if (notificationTitle) {
          await storage.createNotification({
            userId: returnRequest.userId,
            type: "return",
            title: notificationTitle,
            message: notificationMessage,
            relatedId: returnRequest.id,
            relatedType: "return_request",
          });
        }

        res.json(updated);
      } catch (error) {
        console.error("Error updating return request:", error);
        res.status(500).json({ message: "Failed to update return request" });
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
          res.status(500).json({ message: "Failed to fetch refunds" });
        }
      });

      // Admin/Inventory: Process refund
      app.patch("/api/inventory/refunds/:id/process", authInventory, async (req, res) => {
        try {
          const { status, transactionId } = req.body;

          const refund = await storage.getRefund(req.params.id);
          if (!refund) {
            return res.status(404).json({ message: "Refund not found" });
          }

          const updated = await storage.updateRefundStatus(
            req.params.id,
            status,
            status === "completed" || status === "failed" ? new Date() : undefined,
            transactionId
          );

          // Create notification
          if (status === "completed") {
            await storage.createNotification({
              userId: refund.userId,
              type: "refund",
              title: "Refund Processed",
              message: `Your refund of ₹${refund.amount} has been processed successfully.`,
              relatedId: refund.id,
              relatedType: "refund",
            });
          }

          res.json(updated);
        } catch (error) {
          res.status(500).json({ message: "Failed to process refund" });
        }
      });
        // Inventory: Update order status with history
  app.patch("/api/inventory/orders/:id/status", authInventory, async (req, res) => {
    try {
      const user = (req as any).user;
      const { status, notes } = req.body;

      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const updated = await storage.updateOrderWithStatusHistory(
        req.params.id,
        status,
        user.id,
        notes
      );

      if (!updated) {
        return res.status(500).json({ message: "Failed to update order" });
      }

      // Create notification for user
      let notificationMessage = "";
      switch (status) {
        case "confirmed":
          notificationMessage = "Your order has been confirmed and is being processed.";
          break;
        case "processing":
          notificationMessage = "Your order is being prepared for shipment.";
          break;
        case "shipped":
          notificationMessage = "Your order has been shipped! Track it for delivery updates.";
          break;
        case "delivered":
          notificationMessage = "Your order has been delivered. Enjoy your purchase!";
          // Return eligibility is now set automatically in updateOrderWithStatusHistory
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

      res.json(updated);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Stock Movement Endpoints
  app.get("/api/inventory/stock-movements", authInventory, async (req, res) => {
    try {
      const { source, sareeId, limit } = req.query;
      const movements = await storage.getStockMovements({
        source: source as string,
        sareeId: sareeId as string,
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
}