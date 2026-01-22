import type { Express } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import { createAuthMiddleware } from "../authMiddleware";
import { parsePaginationParams } from "../paginationHelper";
import { userService } from "../auth/authStorage";
import { publicStorage } from "server/common/publicStorage";
import { storeService } from "server/store/storeStorage";
import { salesService } from "server/sales&offer/salesStorage";
import { couponsService } from "server/coupons/couponsStorage";
import { AdminServices } from "./adminStorage";
import { productService } from "server/product/productStorage";

export const adminRoutes = (app: Express) => {
  const authAdmin = createAuthMiddleware(["admin"]);

  app.get("/api/admin/stats", authAdmin, async (req, res) => {
    try {
      const stats = await AdminServices.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/orders", authAdmin, async (req, res) => {
    try {
      const { status, limit, page, pageSize, search, dateFrom, dateTo } =
        req.query;

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

  app.post("/api/admin/getUsers", authAdmin, async (req, res) => {
    try {
      const { page, pageSize } = req.query;
      const { role, search, dateFrom, dateTo } = req.body;
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
        (key) => updateData[key] === undefined && delete updateData[key],
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
      const user = await userService.updateUser(req.params.id, {
        isActive: false,
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin product management
  app.post("/api/admin/getProducts", authAdmin, async (req, res) => {
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

  app.post("/api/admin/products", authAdmin, async (req, res) => {
    try {
      const product = await productService.createProduct(req.body);
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.get("/api/admin/products/:id", authAdmin, async (req, res) => {
    try {
      const product = await AdminServices.getAdminProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.patch("/api/admin/products/:id", authAdmin, async (req, res) => {
    try {
      const product = await productService.updateProduct(
        req.params.id,
        req.body,
      );
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", authAdmin, async (req, res) => {
    try {
      await productService.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Admin category management
  app.get("/api/admin/categories", authAdmin, async (req, res) => {
    try {
      const { includeSubcategories } = req.query;

      if (includeSubcategories === "true") {
        const categoriesWithSubs =
          await publicStorage.getCategoriesWithSubcategories();
        res.json(categoriesWithSubs);
      } else {
        const categories = await publicStorage.getCategories();
        res.json(categories);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

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
      const category = await publicStorage.updateCategory(
        req.params.id,
        req.body,
      );
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", authAdmin, async (req, res) => {
    try {
      await publicStorage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
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

  app.patch("/api/admin/colors/:id", authAdmin, async (req, res) => {
    try {
      const color = await publicStorage.updateColor(req.params.id, req.body);
      res.json(color);
    } catch (error) {
      res.status(500).json({ message: "Failed to update color" });
    }
  });

  app.delete("/api/admin/colors/:id", authAdmin, async (req, res) => {
    try {
      await publicStorage.deleteColor(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete color" });
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

  app.patch("/api/admin/fabrics/:id", authAdmin, async (req, res) => {
    try {
      const fabric = await publicStorage.updateFabric(req.params.id, req.body);
      res.json(fabric);
    } catch (error) {
      res.status(500).json({ message: "Failed to update fabric" });
    }
  });

  app.delete("/api/admin/fabrics/:id", authAdmin, async (req, res) => {
    try {
      await publicStorage.deleteFabric(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete fabric" });
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
        return res.status(400).json({
          message: "Value is required for percentage and fixed discount types",
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

      const coupon = await couponsService.updateCoupon(
        req.params.id,
        updateData,
      );
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
        isActive:
          active === "true" ? true : active === "false" ? false : undefined,
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

  // Admin: Check for sale conflicts
  app.post("/api/admin/sales/check-conflicts", authAdmin, async (req, res) => {
    try {
      const { offerType, targetType, categoryId, productIds } = req.body;

      if (!offerType || !targetType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const conflictCheck = await salesService.checkOfferTypeConflicts(
        offerType,
        targetType,
        categoryId,
        productIds
      );

      res.json(conflictCheck);
    } catch (error) {
      console.error("Error checking conflicts:", error);
      res.status(500).json({
        message: "Failed to check conflicts",
        error: error instanceof Error ? error.message : String(error),
      });
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
        subcategoryId,
        minOrderAmount,
        maxDiscount,
        startDate,
        endDate,
        isActive,
        isFeatured,
        bannerImage,
        productIds,
        targetType,
      } = req.body;

      if (!name || !offerType || !discountValue || !startDate || !endDate || !targetType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check for offer type conflicts
      const conflictCheck = await salesService.checkOfferTypeConflicts(
        offerType,
        targetType,
        categoryId,
        productIds
      );

      if (conflictCheck.hasConflict) {
        const conflictDetails = conflictCheck.conflictingSales.map(sale => 
          `- "${sale.name}" (${sale.offerType} on ${sale.targetType})`
        ).join('\n');
        
        return res.status(400).json({ 
          message: `Cannot create sale: Products already have active ${offerType} sales`,
          conflicts: conflictCheck.conflictingSales,
          conflictDetails: `Conflicting sales:\n${conflictDetails}`
        });
      }

      const sale = await salesService.createSale({
        name,
        description: description || null,
        offerType,
        discountValue: String(discountValue),
        categoryId: categoryId || null,
        subcategoryId: subcategoryId === "all" || !subcategoryId ? null : subcategoryId,
        minOrderAmount: minOrderAmount ? String(minOrderAmount) : null,
        maxDiscount: maxDiscount ? String(maxDiscount) : null,
        validFrom: new Date(startDate),
        validUntil: new Date(endDate),
        isActive: isActive !== undefined ? isActive : true,
        isFeatured: isFeatured !== undefined ? isFeatured : false,
        bannerImage: bannerImage || null,
      });

      // Add products if it's a product-level offer
      if (
        offerType === "product" &&
        productIds &&
        Array.isArray(productIds) &&
        productIds.length > 0
      ) {
        await salesService.addProductsToSale(sale.id, productIds);
      }

      res.json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({
        message: "Failed to create sale",
        error: error instanceof Error ? error.message : String(error),
      });
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
        subcategoryId,
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
      if (discountValue !== undefined)
        updateData.discountValue = String(discountValue);
      if (categoryId !== undefined) updateData.categoryId = categoryId || null;
      if (subcategoryId !== undefined) 
        updateData.subcategoryId = subcategoryId === "all" || !subcategoryId ? null : subcategoryId;
      if (minOrderAmount !== undefined)
        updateData.minOrderAmount = minOrderAmount
          ? String(minOrderAmount)
          : null;
      if (maxDiscount !== undefined)
        updateData.maxDiscount = maxDiscount ? String(maxDiscount) : null;
      if (startDate !== undefined) updateData.validFrom = new Date(startDate);
      if (endDate !== undefined) updateData.validUntil = new Date(endDate);
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
      if (bannerImage !== undefined)
        updateData.bannerImage = bannerImage || null;

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
      const settingsMap = new Map(settings.map((s) => [s.key, s]));

      const allSettings = [
        {
          key: "return_window_days",
          value: settingsMap.get("return_window_days")?.value || "7",
          description:
            settingsMap.get("return_window_days")?.description ||
            "Number of days customers have to initiate a return after delivery",
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
          return res
            .status(400)
            .json({ message: "Return window must be between 0 and 60 days" });
        }
      }

      await storage.setSetting(key, value.toString(), description, user.id);

      res.json({
        key,
        value: value.toString(),
        description,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  };
