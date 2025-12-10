import type { Express } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import { createAuthMiddleware } from "../authMiddleware";
import { parsePaginationParams } from "../paginationHelper";
import { userService } from "../auth/authStorage";
import { publicStorage } from "../public/publicStorage";
import { storeService } from "server/store/storeStorage";
import { salesService } from "server/sales&offer/salesStorage";
import { couponsService } from "server/coupons/couponsStorage";
import { sareeService } from "server/saree/sareeStorage";

export const adminRoutes = (app: Express) => {
  const authAdmin = createAuthMiddleware(["admin"]);

  app.get("/api/admin/stats", authAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/orders", authAdmin, async (req, res) => {
    try {
      const { status, limit, page, pageSize, search, dateFrom, dateTo } = req.query;
      
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
      
      const orders = await storage.getAllOrders({
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.patch("/api/admin/orders/:id/status", authAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status);
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.get("/api/admin/users", authAdmin, async (req, res) => {
    try {
      const { role, page, pageSize, search, dateFrom, dateTo } = req.query;
      
      if (page && pageSize) {
        const params = parsePaginationParams(req.query);
        const result = await storage.getUsersPaginated({
          page: params.page,
          pageSize: params.pageSize,
          role: role as string,
          search: search as string,
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
        });
        return res.json(result);
      }
      
      const users = await userService.getUsers({ role: role as string });
      res.json(users.map(({ password, ...u }) => u));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", authAdmin, async (req, res) => {
    try {
      const { email, password, name, phone, role, storeId } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await userService.createUser({
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        storeId,
      });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", authAdmin, async (req, res) => {
    try {
      const { email, password, name, phone, role, storeId, isActive } =
        req.body;
      const updateData: Record<string, unknown> = {
        email,
        name,
        phone,
        role,
        storeId,
        isActive,
      };

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key]
      );

      const user = await userService.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", authAdmin, async (req, res) => {
    try {
      const user = await userService.updateUser(req.params.id, { isActive: false });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin saree management
  app.get("/api/admin/sarees", authAdmin, async (req, res) => {
    try {
      const { page, pageSize, search, category, status, dateFrom, dateTo } = req.query;
      
      if (page && pageSize) {
        const params = parsePaginationParams(req.query);
        const result = await storage.getSareesPaginated({
          page: params.page,
          pageSize: params.pageSize,
          search: search as string,
          category: category as string,
          status: status as string,
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
        });
        return res.json(result);
      }
      
      const sarees = await sareeService.getSarees({});
      res.json(sarees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sarees" });
    }
  });

  app.post("/api/admin/sarees", authAdmin, async (req, res) => {
    try {
      const saree = await sareeService.createSaree(req.body);
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to create saree" });
    }
  });

  app.patch("/api/admin/sarees/:id", authAdmin, async (req, res) => {
    try {
      const saree = await sareeService.updateSaree(req.params.id, req.body);
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to update saree" });
    }
  });

  app.delete("/api/admin/sarees/:id", authAdmin, async (req, res) => {
    try {
      await sareeService.deleteSaree(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete saree" });
    }
  });

  // Admin category management
  app.post("/api/admin/categories", authAdmin, async (req, res) => {
    try {
      const category = await publicStorage.createCategory(req.body);
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch("/api/admin/categories/:id", authAdmin, async (req, res) => {
    try {
      const category = await publicStorage.updateCategory(req.params.id, req.body);
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  // Admin color management
  app.post("/api/admin/colors", authAdmin, async (req, res) => {
    try {
      const color = await publicStorage.createColor(req.body);
      res.json(color);
    } catch (error) {
      res.status(500).json({ message: "Failed to create color" });
    }
  });

  // Admin fabric management
  app.post("/api/admin/fabrics", authAdmin, async (req, res) => {
    try {
      const fabric = await publicStorage.createFabric(req.body);
      res.json(fabric);
    } catch (error) {
      res.status(500).json({ message: "Failed to create fabric" });
    }
  });

  // Admin store management
  app.get("/api/admin/stores", authAdmin, async (req, res) => {
    try {
      const stores = await storeService.getStores();
      res.json(stores);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.post("/api/admin/stores", authAdmin, async (req, res) => {
    try {
      const store = await storeService.createStore(req.body);
      res.json(store);
    } catch (error) {
      res.status(500).json({ message: "Failed to create store" });
    }
  });

  app.patch("/api/admin/stores/:id", authAdmin, async (req, res) => {
    try {
      const store = await storeService.updateStore(req.params.id, req.body);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      res.json(store);
    } catch (error) {
      res.status(500).json({ message: "Failed to update store" });
    }
  });

  app.delete("/api/admin/stores/:id", authAdmin, async (req, res) => {
    try {
      const store = await storeService.updateStore(req.params.id, {
        isActive: false,
      });
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete store" });
    }
  });

  // Admin: Get all reviews (for moderation)
  app.get("/api/admin/reviews", authAdmin, async (req, res) => {
    try {
      const { approved } = req.query;
      const reviews = await storage.getAllReviews({
        approved: approved === "true" ? true : approved === "false" ? false : undefined,
      });
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Admin: Update review approval status
  app.patch("/api/admin/reviews/:id/status", authAdmin, async (req, res) => {
    try {
      const { isApproved } = req.body;

      if (typeof isApproved !== "boolean") {
        return res.status(400).json({ message: "isApproved must be a boolean" });
      }

      const review = await storage.updateReviewApproval(req.params.id, isApproved);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      res.json(review);
    } catch (error) {
      res.status(500).json({ message: "Failed to update review status" });
    }
  });

  // ==================== COUPON ROUTES ====================

  // Admin: Get all coupons
  app.get("/api/admin/coupons", authAdmin, async (req, res) => {
    try {
      const { active } = req.query;
      const coupons = await couponsService.getCoupons({
        isActive:
          active === "true" ? true : active === "false" ? false : undefined,
      });
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  // Admin: Create coupon
  app.post("/api/admin/coupons", authAdmin, async (req, res) => {
    try {
      const {
        code,
        type,
        value,
        minOrderAmount,
        maxDiscount,
        maxUsageLimit,
        perUserLimit,
        expiresAt,
        validFrom,
        isActive,
      } = req.body;

      if (!code || !type) {
        return res.status(400).json({ message: "Code and type are required" });
      }

      // Value is required for percentage and fixed types
      if (
        (type === "percentage" || type === "fixed") &&
        (value === undefined || value === null || value === "")
      ) {
        return res
          .status(400)
          .json({
            message:
              "Value is required for percentage and fixed discount types",
          });
      }

      // Check if code already exists
      const existing = await couponsService.getCouponByCode(code);
      if (existing) {
        return res.status(400).json({ message: "Coupon code already exists" });
      }

      // Set default dates if not provided
      const now = new Date();
      const oneYearLater = new Date(now);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      const coupon = await couponsService.createCoupon({
        code: code.toUpperCase(),
        name: code.toUpperCase(),
        type,
        value:
          value !== undefined && value !== null && value !== ""
            ? String(value)
            : "0",
        minOrderAmount:
          minOrderAmount !== undefined &&
          minOrderAmount !== null &&
          minOrderAmount !== ""
            ? String(minOrderAmount)
            : null,
        maxDiscount:
          maxDiscount !== undefined &&
          maxDiscount !== null &&
          maxDiscount !== ""
            ? String(maxDiscount)
            : null,
        usageLimit:
          maxUsageLimit !== undefined &&
          maxUsageLimit !== null &&
          maxUsageLimit !== ""
            ? Number(maxUsageLimit)
            : null,
        perUserLimit:
          perUserLimit !== undefined &&
          perUserLimit !== null &&
          perUserLimit !== ""
            ? Number(perUserLimit)
            : null,
        validFrom: validFrom ? new Date(validFrom) : now,
        validUntil: expiresAt ? new Date(expiresAt) : oneYearLater,
        isActive: isActive !== undefined ? isActive : true,
      });

      res.json(coupon);
    } catch (error) {
      console.error("Error creating coupon:", error);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  // Admin: Update coupon
  app.patch("/api/admin/coupons/:id", authAdmin, async (req, res) => {
    try {
      const {
        code,
        type,
        value,
        minOrderAmount,
        maxDiscount,
        maxUsageLimit,
        perUserLimit,
        expiresAt,
        validFrom,
        isActive,
      } = req.body;

      const updateData: any = {};
      if (code !== undefined) {
        updateData.code = code.toUpperCase();
        updateData.name = code.toUpperCase();
      }
      if (type !== undefined) updateData.type = type;
      if (value !== undefined)
        updateData.value = value !== null && value !== "" ? String(value) : "0";
      if (minOrderAmount !== undefined)
        updateData.minOrderAmount =
          minOrderAmount !== null && minOrderAmount !== ""
            ? String(minOrderAmount)
            : null;
      if (maxDiscount !== undefined)
        updateData.maxDiscount =
          maxDiscount !== null && maxDiscount !== ""
            ? String(maxDiscount)
            : null;
      if (maxUsageLimit !== undefined)
        updateData.usageLimit =
          maxUsageLimit !== null && maxUsageLimit !== ""
            ? Number(maxUsageLimit)
            : null;
      if (perUserLimit !== undefined)
        updateData.perUserLimit =
          perUserLimit !== null && perUserLimit !== ""
            ? Number(perUserLimit)
            : null;
      if (validFrom !== undefined)
        updateData.validFrom = validFrom ? new Date(validFrom) : null;
      if (expiresAt !== undefined)
        updateData.validUntil = expiresAt ? new Date(expiresAt) : null;
      if (isActive !== undefined) updateData.isActive = isActive;

      const coupon = await couponsService.updateCoupon(req.params.id, updateData);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      console.error("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  // Admin: Delete (deactivate) coupon
  app.delete("/api/admin/coupons/:id", authAdmin, async (req, res) => {
    try {
      await couponsService.deleteCoupon(req.params.id);
      res.json({ message: "Coupon deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  // ==================== SALES & OFFERS ROUTES ====================

  // Admin: Get all sales
  app.get("/api/admin/sales", authAdmin, async (req, res) => {
    try {
      const { active, featured, category } = req.query;
      const sales = await salesService.getSales({
        isActive: active === "true" ? true : active === "false" ? false : undefined,
        isFeatured: featured === "true" ? true : undefined,
        categoryId: category as string,
      });
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  // Admin: Get single sale
  app.get("/api/admin/sales/:id", authAdmin, async (req, res) => {
    try {
      const sale = await salesService.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });

  // Admin: Create sale
  app.post("/api/admin/sales", authAdmin, async (req, res) => {
    try {
      const {
        name,
        description,
        offerType,
        discountValue,
        categoryId,
        minOrderAmount,
        maxDiscount,
        startDate,
        endDate,
        isActive,
        isFeatured,
        bannerImage,
        productIds,
      } = req.body;

      if (!name || !offerType || !discountValue || !startDate || !endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const sale = await salesService.createSale({
        name,
        description: description || null,
        offerType,
        discountValue: String(discountValue),
        categoryId: categoryId || null,
        minOrderAmount: minOrderAmount ? String(minOrderAmount) : null,
        maxDiscount: maxDiscount ? String(maxDiscount) : null,
        validFrom: new Date(startDate),
        validUntil: new Date(endDate),
        isActive: isActive !== undefined ? isActive : true,
        isFeatured: isFeatured !== undefined ? isFeatured : false,
        bannerImage: bannerImage || null,
      });

      // Add products if it's a product-level offer
      if (offerType === 'product' && productIds && Array.isArray(productIds) && productIds.length > 0) {
        await salesService.addProductsToSale(sale.id, productIds);
      }

      res.json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: "Failed to create sale", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Admin: Update sale
  app.patch("/api/admin/sales/:id", authAdmin, async (req, res) => {
    try {
      const {
        name,
        description,
        offerType,
        discountValue,
        categoryId,
        minOrderAmount,
        maxDiscount,
        startDate,
        endDate,
        isActive,
        isFeatured,
        bannerImage,
        productIds,
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (offerType !== undefined) updateData.offerType = offerType;
      if (discountValue !== undefined) updateData.discountValue = String(discountValue);
      if (categoryId !== undefined) updateData.categoryId = categoryId || null;
      if (minOrderAmount !== undefined) updateData.minOrderAmount = minOrderAmount ? String(minOrderAmount) : null;
      if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount ? String(maxDiscount) : null;
      if (startDate !== undefined) updateData.validFrom = new Date(startDate);
      if (endDate !== undefined) updateData.validUntil = new Date(endDate);
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
      if (bannerImage !== undefined) updateData.bannerImage = bannerImage || null;

      const sale = await salesService.updateSale(req.params.id, updateData);
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }

      // Update products if provided
      if (productIds !== undefined && Array.isArray(productIds)) {
        await salesService.addProductsToSale(req.params.id, productIds);
      }

      res.json(sale);
    } catch (error) {
      console.error("Error updating sale:", error);
      res.status(500).json({ message: "Failed to update sale" });
    }
  });

  // Admin: Delete sale
  app.delete("/api/admin/sales/:id", authAdmin, async (req, res) => {
    try {
      await salesService.deleteSale(req.params.id);
      res.json({ message: "Sale deleted" });
    } catch (error) {
      console.error("Error deleting sale:", error);
      res.status(500).json({ message: "Failed to delete sale" });
    }
  });
    // Admin: Get all settings
    app.get("/api/admin/settings", authAdmin, async (req, res) => {
      try {
        const settings = await storage.getAllSettings();
        
        // Add default values for known settings if not set
        const settingsMap = new Map(settings.map(s => [s.key, s]));
        
        const allSettings = [
          {
            key: "return_window_days",
            value: settingsMap.get("return_window_days")?.value || "7",
            description: settingsMap.get("return_window_days")?.description || "Number of days customers have to initiate a return after delivery",
            updatedAt: settingsMap.get("return_window_days")?.updatedAt || null,
          },
        ];
        
        res.json(allSettings);
      } catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ message: "Failed to fetch settings" });
      }
    });
  
    // Admin: Update a setting
    app.put("/api/admin/settings/:key", authAdmin, async (req, res) => {
      try {
        const user = (req as any).user;
        const { key } = req.params;
        const { value, description } = req.body;
        
        // Validate known settings
        if (key === "return_window_days") {
          const days = parseInt(value);
          if (isNaN(days) || days < 0 || days > 60) {
            return res.status(400).json({ message: "Return window must be between 0 and 60 days" });
          }
        }
        
        await storage.setSetting(key, value.toString(), description, user.id);
        
        res.json({ 
          key, 
          value: value.toString(), 
          description, 
          updatedAt: new Date() 
        });
      } catch (error) {
        console.error("Error updating setting:", error);
        res.status(500).json({ message: "Failed to update setting" });
      }
    });

    // Admin: Stock Movement Endpoints
    app.get("/api/admin/stock-movements", authAdmin, async (req, res) => {
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

    app.get("/api/admin/stock-stats", authAdmin, async (req, res) => {
      try {
        const stats = await storage.getStockMovementStats();
        res.json(stats);
      } catch (error) {
        console.error("Error fetching stock stats:", error);
        res.status(500).json({ message: "Failed to fetch stock stats" });
      }
    });

    app.get("/api/admin/inventory-overview", authAdmin, async (req, res) => {
      try {
        const overview = await storage.getInventoryOverview();
        res.json(overview);
      } catch (error) {
        console.error("Error fetching inventory overview:", error);
        res.status(500).json({ message: "Failed to fetch inventory overview" });
      }
    });
};
