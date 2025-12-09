import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { createAuthMiddleware } from "./authMiddleware";
import { parsePaginationParams, createPaginatedResponse, getOffset } from "./paginationHelper";

export const storeRoutes = (app: Express) => {
  const authStore = createAuthMiddleware(["store"]);

  app.get("/api/store/stats", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const stats = await storage.getStoreStats(user.storeId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/store/inventory", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const inventory = await storage.getStoreInventory(user.storeId);
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
      const products = await storage.getShopAvailableProducts(user.storeId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/store/sales", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const { limit } = req.query;
      const sales = await storage.getStoreSales(
        user.storeId,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.get("/api/store/sales/paginated", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      
      const params = parsePaginationParams(req.query);
      const offset = getOffset(params.page, params.pageSize);
      
      const result = await storage.getStoreSalesPaginated(
        user.storeId,
        {
          limit: params.pageSize,
          offset,
          search: params.search,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }
      );
      
      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize
      );
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching paginated sales:", error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  app.get("/api/store/products/paginated", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      
      const params = parsePaginationParams(req.query);
      const offset = getOffset(params.page, params.pageSize);
      
      console.log("Fetching paginated products for store:", user.storeId, "with params:", {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        categoryId: req.query.categoryId,
        colorId: req.query.colorId,
        fabricId: req.query.fabricId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      });
      
      const result = await storage.getShopProductsPaginated(
        user.storeId,
        {
          limit: params.pageSize,
          offset,
          search: params.search,
          categoryId: req.query.categoryId as string,
          colorId: req.query.colorId as string,
          fabricId: req.query.fabricId as string,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }
      );
      
      const response = createPaginatedResponse(
        result.data,
        result.total,
        params.page,
        params.pageSize
      );
      
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching paginated products:", error);
      res.status(500).json({ message: "Failed to fetch products", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/store/requests", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const requests = await storage.getStockRequests({
        storeId: user.storeId,
      });
      res.json(requests);
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
      const { sareeId, quantity, notes } = req.body;
      const request = await storage.createStockRequest({
        storeId: user.storeId,
        requestedBy: user.id,
        sareeId,
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
        user.id
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

  // Create store sale
  app.post("/api/store/sales", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }

      const { customerName, customerPhone, items, saleType } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ message: "No items in sale" });
      }

      // Verify stock availability and deduct from store inventory
      for (const item of items) {
        const inventory = await storage.getStoreInventoryItem(user.storeId, item.sareeId);
        if (!inventory || inventory.quantity < item.quantity) {
          return res.status(400).json({ 
            message: `Insufficient stock for item ${item.sareeId}` 
          });
        }
      }

      // Calculate total amount
      const totalAmount = items.reduce((sum:any, item:any) => {
        const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
        return sum + (price * item.quantity);
      }, 0);

      // Create the sale and deduct stock
      const sale = await storage.createStoreSale(
        {
          storeId: user.storeId,
          soldBy: user.id,
          customerName,
          customerPhone,
          saleType,
          totalAmount: totalAmount.toString(),
        },
        items
      );

      res.json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: "Failed to create sale" });
    }
  });

  // Get sale details for exchange (with available quantities)
  app.get("/api/store/sales/:id", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const sale = await storage.getStoreSaleForExchange(req.params.id);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      if (sale.storeId !== user.storeId) {
        return res.status(403).json({ message: "Sale belongs to different store" });
      }
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });

  // Get all exchanges for store
  app.get("/api/store/exchanges", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const { limit } = req.query;
      const exchanges = await storage.getStoreExchanges(
        user.storeId,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(exchanges);
    } catch (error) {
      console.error("Error fetching exchanges:", error);
      res.status(500).json({ message: "Failed to fetch exchanges" });
    }
  });

  // Get exchanges for inventory view
  app.get("/api/inventory/exchanges", async (req, res) => {
    try {
      const { storeId, limit } = req.query;
      if (storeId) {
        const exchanges = await storage.getStoreExchanges(
          storeId as string,
          limit ? parseInt(limit as string) : undefined
        );
        res.json(exchanges);
      } else {
        // Get all exchanges across all stores
        const allExchanges = await storage.getAllStoreExchanges(
          limit ? parseInt(limit as string) : undefined
        );
        res.json(allExchanges);
      }
    } catch (error) {
      console.error("Error fetching exchanges:", error);
      res.status(500).json({ message: "Failed to fetch exchanges" });
    }
  });

  // Get single exchange details
  app.get("/api/store/exchanges/:id", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const exchange = await storage.getStoreExchange(req.params.id);
      if (!exchange) {
        return res.status(404).json({ message: "Exchange not found" });
      }
      if (exchange.storeId !== user.storeId) {
        return res.status(403).json({ message: "Exchange belongs to different store" });
      }
      res.json(exchange);
    } catch (error) {
      console.error("Error fetching exchange:", error);
      res.status(500).json({ message: "Failed to fetch exchange" });
    }
  });

  // Create new exchange
  app.post("/api/store/exchanges", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }

      const { originalSaleId, returnItems, newItems, reason, notes, customerName, customerPhone } = req.body;

      if (!originalSaleId) {
        return res.status(400).json({ message: "Original sale ID is required" });
      }

      if (!returnItems || returnItems.length === 0) {
        return res.status(400).json({ message: "At least one return item is required" });
      }

      // Fetch authoritative sale data
      const sale = await storage.getStoreSaleForExchange(originalSaleId);
      if (!sale) {
        return res.status(404).json({ message: "Original sale not found" });
      }
      if (sale.storeId !== user.storeId) {
        return res.status(403).json({ message: "Sale belongs to different store" });
      }

      // Build a map of sale items for validation
      const saleItemMap = new Map<string, { price: string; quantity: number; returnedQuantity: number; sareeId: string }>();
      for (const item of sale.items) {
        saleItemMap.set(item.id, {
          price: item.price,
          quantity: item.quantity,
          returnedQuantity: (item as any).returnedQuantity || 0,
          sareeId: item.sareeId,
        });
      }

      // Validate return items and recalculate amounts from authoritative data
      const validatedReturnItems: { saleItemId: string; sareeId: string; quantity: number; unitPrice: string; returnAmount: string }[] = [];
      let returnAmount = 0;

      for (const item of returnItems) {
        const saleItem = saleItemMap.get(item.saleItemId);
        if (!saleItem) {
          return res.status(400).json({ message: `Invalid sale item ID: ${item.saleItemId}` });
        }

        const availableQuantity = saleItem.quantity - saleItem.returnedQuantity;
        if (item.quantity > availableQuantity) {
          return res.status(400).json({ 
            message: `Cannot return ${item.quantity} items - only ${availableQuantity} available for return` 
          });
        }

        if (item.quantity < 1) {
          return res.status(400).json({ message: "Return quantity must be at least 1" });
        }

        // Use authoritative price from sale item
        const unitPrice = saleItem.price;
        const lineReturnAmount = parseFloat(unitPrice) * item.quantity;
        returnAmount += lineReturnAmount;

        validatedReturnItems.push({
          saleItemId: item.saleItemId,
          sareeId: saleItem.sareeId,
          quantity: item.quantity,
          unitPrice,
          returnAmount: lineReturnAmount.toString(),
        });
      }

      // Validate new items and check inventory
      const validatedNewItems: { sareeId: string; quantity: number; unitPrice: string; lineAmount: string }[] = [];
      let newItemsAmount = 0;

      if (newItems && newItems.length > 0) {
        // Get store inventory to validate - using full inventory for price lookup
        const inventory = await storage.getStoreInventory(user.storeId);
        const inventoryMap = new Map<string, { quantity: number; price: string }>();
        for (const invItem of inventory) {
          inventoryMap.set(invItem.sareeId, { quantity: invItem.quantity, price: invItem.saree.price });
        }

        for (const item of newItems) {
          const inventoryItem = inventoryMap.get(item.sareeId);
          if (!inventoryItem) {
            return res.status(400).json({ message: `Product ${item.sareeId} not found in store inventory` });
          }

          if (item.quantity > inventoryItem.quantity) {
            return res.status(400).json({ 
              message: `Insufficient stock for new item - only ${inventoryItem.quantity} available` 
            });
          }

          if (item.quantity < 1) {
            return res.status(400).json({ message: "New item quantity must be at least 1" });
          }

          // Use authoritative price from saree (fetched from inventory)
          const unitPrice = inventoryItem.price;
          const lineAmount = parseFloat(unitPrice) * item.quantity;
          newItemsAmount += lineAmount;

          validatedNewItems.push({
            sareeId: item.sareeId,
            quantity: item.quantity,
            unitPrice,
            lineAmount: lineAmount.toString(),
          });
        }
      }

      // Calculate balance
      const balanceAmount = Math.abs(returnAmount - newItemsAmount);
      let balanceDirection: "refund_to_customer" | "due_from_customer" | "even" = "even";
      if (returnAmount > newItemsAmount) {
        balanceDirection = "refund_to_customer";
      } else if (newItemsAmount > returnAmount) {
        balanceDirection = "due_from_customer";
      }

      const exchange = await storage.createStoreExchange(
        {
          storeId: user.storeId,
          originalSaleId,
          processedBy: user.id,
          customerName,
          customerPhone,
          reason,
          notes,
          returnAmount: returnAmount.toString(),
          newItemsAmount: newItemsAmount.toString(),
          balanceAmount: balanceAmount.toString(),
          balanceDirection,
          status: "completed",
        },
        validatedReturnItems,
        validatedNewItems
      );

      res.json(exchange);
    } catch (error) {
      console.error("Error creating exchange:", error);
      res.status(500).json({ message: "Failed to create exchange" });
    }
  });
};
