import bcrypt from "bcryptjs";
import type { Express } from "express";
import { publicStorage } from "server/common/publicStorage";
import { pub } from "../../realtime/redis";
import { couponsService } from "server/coupons/couponsStorage";
import { productService } from "server/product/productStorage";
import { ProductFilters, roleBasedProductService } from "server/product/roleBasedProductService";
import { salesService } from "server/sales&offer/salesStorage";
import { storeService } from "server/store/storeStorage";
import { z } from "zod";
import { userService } from "../auth/authStorage";
import { createAuthMiddleware } from "../authMiddleware";
import { adminRateLimit, sensitiveRateLimit } from "../middleware/rateLimit";
import { parsePaginationParams } from "../paginationHelper";
import { storage } from "../storage";
import { AdminServices } from "./adminStorage";
import { stockAuditService } from "../inventory/stockAuditService";

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  role: z.enum(["admin", "inventory", "store"], {
    errorMap: () => ({ message: "Invalid role" })
  }),
  storeId: z.string().optional()
});

const updateUserSchema = createUserSchema.partial().extend({
  isActive: z.boolean().optional()
});

const updateOrderStatusSchema = z.object({
  status: z.string().min(1, "Status is required")
});

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  sizes: z.array(z.string()).default([]),
  isActive: z.boolean().optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  price: z.string().min(1, "Price is required"),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  colorId: z.string().optional(),
  fabricId: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  totalStock: z.number().min(0, "Stock must be non-negative"),
  onlineStock: z.number().min(0, "Online stock must be non-negative"),
  isActive: z.boolean().optional(),
  distributionChannel: z.enum(["online", "shop", "both"], {
    errorMap: () => ({ message: "Invalid distribution channel" })
  }).optional()
});

export const adminRoutes = (app: Express) => {
  const authAdmin = createAuthMiddleware(["admin"]);

  // Apply general admin rate limiting to all admin routes
  app.use("/api/admin", adminRateLimit);

  app.get("/api/admin/stats", authAdmin, async (req, res) => {
    try {
      const stats = await AdminServices.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch admin statistics",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
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
      console.error("Error fetching admin orders:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch orders",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.patch("/api/admin/orders/:id/status", authAdmin, async (req, res) => {
    try {
      const validatedData = updateOrderStatusSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validatedData.error.errors
        });
      }

      const { status } = validatedData.data;
      const order = await storage.updateOrderStatus(req.params.id, status);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to update order status",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
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
      res.json(users.map(({ ...u }) => u));
    } catch (error) {
      console.error("Error fetching admin users:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch users",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.post("/api/admin/users", authAdmin, sensitiveRateLimit, async (req, res) => {
    try {
      const { email, password, name, phone, role, storeId } = req.body;

      // Input validation
      if (!email || !password || !name) {
        return res.status(400).json({
          message: "Email, password, and name are required"
        });
      }

      if (!role) {
        return res.status(400).json({
          message: "User role is required"
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters long"
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await userService.createUser({
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        storeId,
      });
      const { ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Error creating admin user:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";

      // Handle specific database errors
      if (message.includes('duplicate key') || message.includes('UNIQUE')) {
        return res.status(409).json({
          message: "User with this email already exists"
        });
      }

      res.status(500).json({
        message: "Failed to create user",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.patch("/api/admin/users/:id", authAdmin, sensitiveRateLimit, async (req, res) => {
    try {
      const validatedData = updateUserSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validatedData.error.errors
        });
      }

      const { email, password, name, phone, role, storeId, isActive } = validatedData.data;
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
      const { ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating admin user:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";

      if (message.includes('duplicate key') || message.includes('UNIQUE')) {
        return res.status(409).json({
          message: "User with this email already exists"
        });
      }

      res.status(500).json({
        message: "Failed to update user",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.delete("/api/admin/users/:id", authAdmin, sensitiveRateLimit, async (req, res) => {
    try {
      const user = await userService.updateUser(req.params.id, {
        isActive: false,
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting admin user:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to delete user",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  // Admin product management
  app.post("/api/admin/getProducts", authAdmin, async (req, res) => {
    try {
      const {
        search,
        categoryIds,
      } = req.body;

      const params = parsePaginationParams(req.query);

      const filters: ProductFilters = {
        search,
        categoryIds: categoryIds,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      };

      // MIGRATED: Use role-based service for admin users (full access)
      const products = await roleBasedProductService.getProductsByRole(filters, "admin");

      const total = products.length;
      const totalPages = Math.ceil(total / params.pageSize);

      return res.json({
        data: products,
        total,
        page: params.page,
        pageSize: params.pageSize,
        totalPages,
      });
    } catch (error) {
      console.error("Error fetching admin products:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch products",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.post("/api/admin/products", authAdmin, sensitiveRateLimit, async (req, res) => {
    try {
      const validatedData = createProductSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validatedData.error.errors
        });
      }

      const product = await productService.createProduct(validatedData.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating admin product:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";

      if (message.includes('duplicate key') || message.includes('UNIQUE')) {
        return res.status(409).json({
          message: "Product with this SKU already exists"
        });
      }

      res.status(500).json({
        message: "Failed to create product",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.get("/api/admin/products/:id", authAdmin, async (req, res) => {
    try {
      const product = await roleBasedProductService.getProductByRole(req.params.id, 'admin');
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching admin product:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch product",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.patch("/api/admin/products/:id", authAdmin, sensitiveRateLimit, async (req, res) => {
    try {
      const validatedData = createProductSchema.partial().safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validatedData.error.errors
        });
      }

      const product = await productService.updateProduct(
        req.params.id,
        validatedData.data,
      );
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating admin product:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";

      if (message.includes('duplicate key') || message.includes('UNIQUE')) {
        return res.status(409).json({
          message: "Product with this SKU already exists"
        });
      }

      res.status(500).json({
        message: "Failed to update product",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.delete("/api/admin/products/:id", authAdmin, sensitiveRateLimit, async (req, res) => {
    try {
      const deleted = await productService.deleteProducts([req.params.id]);
      if (!deleted) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting admin product:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to delete product",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
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
    } catch {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/admin/categories", authAdmin, async (req, res) => {
    try {
      const validatedData = createCategorySchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validatedData.error.errors
        });
      }

      const category = await publicStorage.createCategory(validatedData.data);

      await pub.publish(
        "realtime",
        JSON.stringify({
          type: "filter_event"
        })
      )
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to create category",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.patch("/api/admin/categories/:id", authAdmin, async (req, res) => {
    try {
      const category = await publicStorage.updateCategory(
        req.params.id,
        req.body,
      );
      res.json(category);
    } catch {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", authAdmin, async (req, res) => {
    try {
      await publicStorage.deleteCategory(req.params.id);
      res.json({ success: true, message: "Category and its subcategories deleted permanently" });
    } catch (error) {
      console.error("Error deleting category:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      
      if (message.includes('Cannot delete category: It is referenced by active products')) {
        return res.status(400).json({
          message: message,
          error: "PRODUCT_DEPENDENCY"
        });
      }
      
      if (message.includes('Cannot delete category: It is referenced by active sales')) {
        return res.status(400).json({
          message: message,
          error: "SALES_DEPENDENCY"
        });
      }
      
      if (message.includes('Category not found')) {
        return res.status(404).json({
          message: message,
          error: "CATEGORY_NOT_FOUND"
        });
      }
      
      res.status(500).json({
        message: "Failed to delete category",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  // Admin subcategory management
  app.post("/api/admin/subcategories", authAdmin, async (req, res) => {
    try {
      const { categoryId, name, description, imageUrl, isActive } = req.body;

      if (!categoryId || !name) {
        return res.status(400).json({
          message: "Category ID and name are required"
        });
      }

      const subcategory = await publicStorage.createSubcategory({
        categoryId,
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        isActive: isActive !== undefined ? isActive : true,
      });
      
      await pub.publish(
        "realtime",
        JSON.stringify({
          type: "filter_event"
        })
      )
      res.status(201).json(subcategory);
    } catch (error) {
      console.error("Error creating subcategory:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to create subcategory",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.patch("/api/admin/subcategories/:id", authAdmin, async (req, res) => {
    try {
      const subcategory = await publicStorage.updateSubcategory(
        req.params.id,
        req.body,
      );
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      res.json(subcategory);
    } catch (error) {
      console.error("Error updating subcategory:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to update subcategory",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  app.delete("/api/admin/subcategories/:id", authAdmin, async (req, res) => {
    try {
      await publicStorage.deleteSubcategory(req.params.id);
      res.json({ success: true, message: "Subcategory deleted permanently" });
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      
      if (message.includes('Cannot delete subcategory: It is referenced by products')) {
        return res.status(400).json({
          message: message,
          error: "FOREIGN_KEY_CONSTRAINT"
        });
      }
      
      res.status(500).json({
        message: "Failed to delete subcategory",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  // Admin color management
  app.post("/api/admin/colors", authAdmin, async (req, res) => {
    try {
      const color = await publicStorage.createColor(req.body);
      res.json(color);
    } catch {
      res.status(500).json({ message: "Failed to create color" });
    }
  });

  app.patch("/api/admin/colors/:id", authAdmin, async (req, res) => {
    try {
      const color = await publicStorage.updateColor(req.params.id, req.body);
      res.json(color);
    } catch {
      res.status(500).json({ message: "Failed to update color" });
    }
  });

  app.delete("/api/admin/colors/:id", authAdmin, async (req, res) => {
    try {
      await publicStorage.deleteColor(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete color" });
    }
  });

  // Admin fabric management
  app.post("/api/admin/fabrics", authAdmin, async (req, res) => {
    try {
      const fabric = await publicStorage.createFabric(req.body);
      res.json(fabric);
    } catch {
      res.status(500).json({ message: "Failed to create fabric" });
    }
  });

  app.patch("/api/admin/fabrics/:id", authAdmin, async (req, res) => {
    try {
      const fabric = await publicStorage.updateFabric(req.params.id, req.body);
      res.json(fabric);
    } catch {
      res.status(500).json({ message: "Failed to update fabric" });
    }
  });

  app.delete("/api/admin/fabrics/:id", authAdmin, async (req, res) => {
    try {
      await publicStorage.deleteFabric(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete fabric" });
    }
  });

  // Admin store management
  app.get("/api/admin/stores", authAdmin, async (req, res) => {
    try {
      const stores = await storeService.getStores();
      res.json(stores);
    } catch {
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.post("/api/admin/stores", authAdmin, async (req, res) => {
    try {
      const store = await storeService.createStore(req.body);
      res.json(store);
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  // Admin: Delete (deactivate) coupon
  app.delete("/api/admin/coupons/:id", authAdmin, async (req, res) => {
    try {
      await couponsService.deleteCoupon(req.params.id);
      res.json({ message: "Coupon deleted" });
    } catch {
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
    } catch {
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
    } catch {
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
        error: error instanceof Error ? error.message : String,
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
    } catch {
      res.status(500).json({ message: "Failed to update sale" });
    }
  });

  // Admin: Delete sale
  app.delete("/api/admin/sales/:id", authAdmin, async (req, res) => {
    try {
      await salesService.deleteSale(req.params.id);
      res.json({ message: "Sale deleted" });
    } catch {
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
    } catch {
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
    } catch {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Stock Audit Trail Endpoints

  // Get stock movement history with user attribution
  app.get("/api/admin/stock-audit", authAdmin, async (req, res) => {
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
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch audit history",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  // Get user-specific audit trail
  app.get("/api/admin/stock-audit/user/:userId", authAdmin, async (req, res) => {
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
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch user audit trail",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  // Get product-specific audit trail
  app.get("/api/admin/stock-audit/product/:productId", authAdmin, async (req, res) => {
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
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to fetch product audit trail",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  // Generate audit report for compliance
  app.post("/api/admin/stock-audit/report", authAdmin, async (req, res) => {
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
      console.log(`Audit report generated by admin user ${(req as any).user.id}:`, {
        dateFrom,
        dateTo,
        filters: { userId, productId, movementType },
        totalMovements: report.summary.totalMovements
      });

      res.json(report);
    } catch (error: any) {
      console.error("Error generating audit report:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to generate audit report",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

  // Create stock movement with audit trail
  app.post("/api/admin/stock-movement-with-audit", authAdmin, async (req, res) => {
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
        message: "Stock movement created successfully with audit trail"
      });
    } catch (error: any) {
      console.error("Error creating stock movement with audit:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        message: "Failed to create stock movement",
        error: process.env.NODE_ENV === "development" ? message : undefined
      });
    }
  });

};
