import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

// Security: Require SESSION_SECRET environment variable
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for security. Please set it in your environment.");
}

// Token expiration settings
const ACCESS_TOKEN_EXPIRY = "15m"; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // Refresh token valid for 7 days

// Cookie security settings based on environment
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/",
};

// Generate a secure random refresh token
function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

// Hash refresh token using SHA-256 for secure storage
function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const addressSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone must be a 10-digit number"),
  locality: z.string().min(5, "Locality must be at least 5 characters").max(200),
  city: z.string().min(2, "City must be at least 2 characters").max(100),
  pincode: z.string().regex(/^[0-9]{6}$/, "Pincode must be a 6-digit number"),
  isDefault: z.boolean().optional().default(false),
});

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

// Auth middleware with tokenVersion validation for session invalidation
function createAuthMiddleware(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.accessToken;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { 
        userId: string; 
        role: string; 
        tokenVersion: number;
      };
      const user = await storage.getUser(decoded.userId);

      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if token version matches - invalidates tokens after password change
      if (decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: "Token has been invalidated. Please login again." });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is disabled" });
      }

      (req as any).user = user;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }
  };
}

const authUser = createAuthMiddleware(["user"]);
const authAdmin = createAuthMiddleware(["admin"]);
const authInventory = createAuthMiddleware(["inventory"]);
const authStore = createAuthMiddleware(["store"]);
const authAny = createAuthMiddleware(["user", "admin", "inventory", "store"]);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== AUTH ROUTES ====================

  // Helper function to issue tokens
  const issueTokens = async (user: { id: string; role: string; tokenVersion: number }, res: Response) => {
    // Create short-lived access token with tokenVersion for invalidation
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Create refresh token
    const refreshToken = generateRefreshToken();
    const hashedToken = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    // Store HASHED refresh token in database for security
    await storage.createRefreshToken({
      userId: user.id,
      token: hashedToken, // Store hash, not plaintext
      expiresAt,
      isRevoked: false,
    });

    // Set cookies with proper security (client gets plaintext token)
    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });
  };

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      const token = req.cookies?.accessToken;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { 
        userId: string; 
        tokenVersion: number;
      };
      const user = await storage.getUser(decoded.userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check token version for session invalidation
      if (decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: "Session invalidated. Please login again." });
      }

      const { password, tokenVersion, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      }
      res.status(401).json({ message: "Invalid token" });
    }
  });

  // Refresh token endpoint
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token provided" });
      }

      // Hash the incoming token to look it up in database
      const hashedToken = hashRefreshToken(refreshToken);

      // Validate refresh token from database (lookup by hash)
      const storedToken = await storage.getRefreshToken(hashedToken);
      if (!storedToken || storedToken.isRevoked) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      if (new Date() > storedToken.expiresAt) {
        await storage.revokeRefreshToken(hashedToken);
        return res.status(401).json({ message: "Refresh token expired" });
      }

      const user = await storage.getUser(storedToken.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "User not found or disabled" });
      }

      // Revoke old refresh token (rotation)
      await storage.revokeRefreshToken(hashedToken);

      // Issue new tokens
      await issueTokens(user, res);

      const { password, tokenVersion, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(500).json({ message: "Token refresh failed" });
    }
  });

  // User register
  app.post("/api/auth/user/register", async (req, res) => {
    try {
      const { email, password, name, phone } = req.body;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        phone,
        role: "user",
      });

      await issueTokens(user, res);

      const { password: _, tokenVersion, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Generic login handler
  const handleLogin = async (req: Request, res: Response, expectedRole: string) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user || user.role !== expectedRole) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is disabled" });
      }

      await issueTokens(user, res);

      const { password: _, tokenVersion, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  };

  app.post("/api/auth/user/login", (req, res) => handleLogin(req, res, "user"));
  app.post("/api/auth/admin/login", (req, res) => handleLogin(req, res, "admin"));
  app.post("/api/auth/inventory/login", (req, res) => handleLogin(req, res, "inventory"));
  app.post("/api/auth/store/login", (req, res) => handleLogin(req, res, "store"));

  // Logout - revoke current refresh token
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        // Hash the token before revoking to match stored hash
        const hashedToken = hashRefreshToken(refreshToken);
        await storage.revokeRefreshToken(hashedToken);
      }
      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);
      res.json({ success: true });
    } catch (error) {
      // Still clear cookies even if revoke fails
      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);
      res.json({ success: true });
    }
  });

  // Logout from all devices - invalidates all sessions by incrementing tokenVersion
  app.post("/api/auth/logout-all", authAny, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Increment tokenVersion to invalidate all existing tokens
      await storage.incrementUserTokenVersion(user.id);
      
      // Revoke all refresh tokens for this user
      await storage.revokeAllUserRefreshTokens(user.id);
      
      // Clear current session cookies
      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);
      
      res.json({ success: true, message: "Logged out from all devices" });
    } catch (error) {
      console.error("Logout all error:", error);
      res.status(500).json({ message: "Failed to logout from all devices" });
    }
  });

  // Change password - invalidates all sessions
  app.post("/api/auth/change-password", authAny, async (req, res) => {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      // Validate current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and increment tokenVersion to invalidate all tokens
      await storage.updateUserPassword(user.id, hashedPassword);

      // Revoke all refresh tokens
      await storage.revokeAllUserRefreshTokens(user.id);

      // Issue new tokens
      const updatedUser = await storage.getUser(user.id);
      if (updatedUser) {
        await issueTokens(updatedUser, res);
      }

      res.json({ success: true, message: "Password changed successfully. You have been logged out from other devices." });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // ==================== PUBLIC ROUTES ====================

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Colors
  app.get("/api/colors", async (req, res) => {
    try {
      const colors = await storage.getColors();
      res.json(colors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch colors" });
    }
  });

  // Fabrics
  app.get("/api/fabrics", async (req, res) => {
    try {
      const fabrics = await storage.getFabrics();
      res.json(fabrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch fabrics" });
    }
  });

  // Sarees
  app.get("/api/sarees", async (req, res) => {
    try {
      const { search, category, color, fabric, featured, minPrice, maxPrice, sort, limit } = req.query;

      const sarees = await storage.getSarees({
        search: search as string,
        category: category as string,
        color: color as string,
        fabric: fabric as string,
        featured: featured === "true",
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        sort: sort as string,
        limit: limit ? parseInt(limit as string) : undefined,
        distributionChannel: "online",
      });

      res.json(sarees);
    } catch (error) {
      console.error("Sarees fetch error:", error);
      res.status(500).json({ message: "Failed to fetch sarees" });
    }
  });

  app.get("/api/sarees/:id", async (req, res) => {
    try {
      const saree = await storage.getSaree(req.params.id);
      if (!saree) {
        return res.status(404).json({ message: "Saree not found" });
      }
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saree" });
    }
  });

  // ==================== FILE UPLOAD ROUTES ====================

  // Serve uploaded files
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get presigned upload URL (requires inventory or admin auth)
  app.post("/api/uploads/presigned-url", authAny, async (req, res) => {
    try {
      const { fileType } = req.body;
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath, uploadToken } = await objectStorageService.getObjectEntityUploadURL(fileType || "image");
      res.json({ uploadURL, objectPath, uploadToken });
    } catch (error) {
      console.error("Error getting presigned URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Confirm upload and get normalized path
  app.post("/api/uploads/confirm", authAny, async (req, res) => {
    try {
      const { objectPath, uploadToken } = req.body;
      if (!objectPath || !uploadToken) {
        return res.status(400).json({ error: "objectPath and uploadToken are required" });
      }

      const objectStorageService = new ObjectStorageService();
      
      if (!objectStorageService.verifyUploadToken(uploadToken, objectPath)) {
        return res.status(403).json({ error: "Invalid or expired upload token" });
      }

      if (!objectStorageService.isValidObjectPath(objectPath)) {
        return res.status(400).json({ error: "Invalid object path" });
      }

      const userId = (req as any).user?.id;
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        await objectStorageService.trySetObjectEntityAclPolicy(
          objectPath,
          {
            owner: userId || "system",
            visibility: "public",
          }
        );
      } catch (fileError) {
        return res.status(400).json({ error: "Upload not found - file may not have been uploaded" });
      }

      res.json({ objectPath });
    } catch (error) {
      console.error("Error confirming upload:", error);
      res.status(500).json({ error: "Failed to confirm upload" });
    }
  });

  // ==================== USER ROUTES ====================

  // Cart
  app.get("/api/user/cart", authUser, async (req, res) => {
    try {
      const items = await storage.getCartItems((req as any).user.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.get("/api/user/cart/count", authUser, async (req, res) => {
    try {
      const count = await storage.getCartCount((req as any).user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cart count" });
    }
  });

  app.post("/api/user/cart", authUser, async (req, res) => {
    try {
      const { sareeId, quantity = 1 } = req.body;
      const item = await storage.addToCart({
        userId: (req as any).user.id,
        sareeId,
        quantity,
      });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  app.patch("/api/user/cart/:id", authUser, async (req, res) => {
    try {
      const { quantity } = req.body;
      const item = await storage.updateCartItem(req.params.id, quantity);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update cart" });
    }
  });

  app.delete("/api/user/cart/:id", authUser, async (req, res) => {
    try {
      await storage.removeFromCart(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });

  // Wishlist
  app.get("/api/user/wishlist", authUser, async (req, res) => {
    try {
      const items = await storage.getWishlistItems((req as any).user.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.get("/api/user/wishlist/count", authUser, async (req, res) => {
    try {
      const count = await storage.getWishlistCount((req as any).user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wishlist count" });
    }
  });

  app.post("/api/user/wishlist", authUser, async (req, res) => {
    try {
      const { sareeId } = req.body;
      const item = await storage.addToWishlist({
        userId: (req as any).user.id,
        sareeId,
      });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to wishlist" });
    }
  });

  app.delete("/api/user/wishlist/:sareeId", authUser, async (req, res) => {
    try {
      await storage.removeFromWishlist((req as any).user.id, req.params.sareeId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from wishlist" });
    }
  });

  // Orders
  app.get("/api/user/orders", authUser, async (req, res) => {
    try {
      const orders = await storage.getOrders((req as any).user.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/user/orders/:id", authUser, async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order || order.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post("/api/user/orders", authUser, async (req, res) => {
    try {
      const { shippingAddress, phone, notes, couponId } = req.body;
      const userId = (req as any).user.id;

      const cartItems = await storage.getCartItems(userId);
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const totalAmount = cartItems.reduce((sum, item) => {
        const price = typeof item.saree.price === "string" ? parseFloat(item.saree.price) : item.saree.price;
        return sum + price * item.quantity;
      }, 0);

      // Calculate discount if coupon is provided
      let discountAmount = 0;
      let validCoupon = null;
      if (couponId) {
        const coupon = await storage.getCoupon(couponId);
        if (coupon && coupon.isActive) {
          validCoupon = coupon;
          if (coupon.type === "percentage") {
            discountAmount = (totalAmount * parseFloat(coupon.value)) / 100;
            if (coupon.maxDiscount) {
              discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscount));
            }
          } else {
            discountAmount = parseFloat(coupon.value);
          }
        }
      }

      const finalAmount = totalAmount - discountAmount;

      const order = await storage.createOrder(
        {
          userId,
          totalAmount: totalAmount.toString(),
          discountAmount: discountAmount.toString(),
          finalAmount: finalAmount.toString(),
          couponId,
          shippingAddress,
          phone,
          notes,
          status: "pending",
        },
        cartItems.map((item) => ({
          sareeId: item.sareeId,
          quantity: item.quantity,
          price: item.saree.price,
        }))
      );

      await storage.clearCart(userId);

      // Record coupon usage after order is created
      if (validCoupon && discountAmount > 0) {
        await storage.applyCoupon(validCoupon.id, userId, order.id, discountAmount.toString());
      }

      res.json({ orderId: order.id });
    } catch (error) {
      console.error("Order error:", error);
      res.status(500).json({ message: "Failed to place order" });
    }
  });

  // User Addresses
  app.get("/api/user/addresses", authUser, async (req, res) => {
    try {
      const addresses = await storage.getUserAddresses((req as any).user.id);
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  app.post("/api/user/addresses", authUser, async (req, res) => {
    try {
      const validation = addressSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const address = await storage.createUserAddress({
        ...validation.data,
        userId: (req as any).user.id,
      });
      res.json(address);
    } catch (error) {
      res.status(500).json({ message: "Failed to create address" });
    }
  });

  app.patch("/api/user/addresses/:id", authUser, async (req, res) => {
    try {
      const address = await storage.getUserAddress(req.params.id);
      if (!address || address.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Address not found" });
      }
      const validation = addressSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const updated = await storage.updateUserAddress(req.params.id, validation.data);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update address" });
    }
  });

  app.patch("/api/user/addresses/:id/default", authUser, async (req, res) => {
    try {
      const address = await storage.setDefaultAddress((req as any).user.id, req.params.id);
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }
      res.json(address);
    } catch (error) {
      res.status(500).json({ message: "Failed to set default address" });
    }
  });

  app.delete("/api/user/addresses/:id", authUser, async (req, res) => {
    try {
      const address = await storage.getUserAddress(req.params.id);
      if (!address || address.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Address not found" });
      }
      await storage.deleteUserAddress(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  // Pincode availability check (public)
  app.get("/api/pincodes/:pincode/check", async (req, res) => {
    try {
      const pincode = await storage.checkPincodeAvailability(req.params.pincode);
      if (pincode) {
        res.json({
          available: true,
          city: pincode.city,
          state: pincode.state,
          deliveryDays: pincode.deliveryDays,
        });
      } else {
        res.json({
          available: false,
          message: "Delivery not available in this area",
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to check pincode" });
    }
  });

  // ==================== ADMIN ROUTES ====================

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
      const { role } = req.query;
      const users = await storage.getUsers({ role: role as string });
      res.json(users.map(({ password, ...u }) => u));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", authAdmin, async (req, res) => {
    try {
      const { email, password, name, phone, role, storeId } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
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
      const { email, password, name, phone, role, storeId, isActive } = req.body;
      const updateData: Record<string, unknown> = { email, name, phone, role, storeId, isActive };
      
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
      
      const user = await storage.updateUser(req.params.id, updateData);
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
      const user = await storage.updateUser(req.params.id, { isActive: false });
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
      const sarees = await storage.getSarees({});
      res.json(sarees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sarees" });
    }
  });

  app.post("/api/admin/sarees", authAdmin, async (req, res) => {
    try {
      const saree = await storage.createSaree(req.body);
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to create saree" });
    }
  });

  app.patch("/api/admin/sarees/:id", authAdmin, async (req, res) => {
    try {
      const saree = await storage.updateSaree(req.params.id, req.body);
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to update saree" });
    }
  });

  app.delete("/api/admin/sarees/:id", authAdmin, async (req, res) => {
    try {
      await storage.deleteSaree(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete saree" });
    }
  });

  // Admin category management
  app.post("/api/admin/categories", authAdmin, async (req, res) => {
    try {
      const category = await storage.createCategory(req.body);
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.patch("/api/admin/categories/:id", authAdmin, async (req, res) => {
    try {
      const category = await storage.updateCategory(req.params.id, req.body);
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  // Admin color management
  app.post("/api/admin/colors", authAdmin, async (req, res) => {
    try {
      const color = await storage.createColor(req.body);
      res.json(color);
    } catch (error) {
      res.status(500).json({ message: "Failed to create color" });
    }
  });

  // Admin fabric management
  app.post("/api/admin/fabrics", authAdmin, async (req, res) => {
    try {
      const fabric = await storage.createFabric(req.body);
      res.json(fabric);
    } catch (error) {
      res.status(500).json({ message: "Failed to create fabric" });
    }
  });

  // Admin store management
  app.get("/api/admin/stores", authAdmin, async (req, res) => {
    try {
      const stores = await storage.getStores();
      res.json(stores);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.post("/api/admin/stores", authAdmin, async (req, res) => {
    try {
      const store = await storage.createStore(req.body);
      res.json(store);
    } catch (error) {
      res.status(500).json({ message: "Failed to create store" });
    }
  });

  app.patch("/api/admin/stores/:id", authAdmin, async (req, res) => {
    try {
      const store = await storage.updateStore(req.params.id, req.body);
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
      const store = await storage.updateStore(req.params.id, { isActive: false });
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete store" });
    }
  });

  // ==================== INVENTORY ROUTES ====================

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

  // ==================== STORE ROUTES ====================

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

  app.post("/api/store/sales", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const { customerName, customerPhone, items, saleType } = req.body;

      const totalAmount = items.reduce(
        (sum: number, item: any) => sum + parseFloat(item.price) * item.quantity,
        0
      );

      const sale = await storage.createStoreSale(
        {
          storeId: user.storeId,
          soldBy: user.id,
          customerName,
          customerPhone,
          totalAmount: totalAmount.toString(),
          saleType,
        },
        items
      );
      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: "Failed to create sale" });
    }
  });

  app.get("/api/store/requests", authStore, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user.storeId) {
        return res.status(400).json({ message: "No store assigned" });
      }
      const requests = await storage.getStockRequests({ storeId: user.storeId });
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

  // ==================== RETURN REQUEST ROUTES ====================

  // User: Check return eligibility for an order
  app.get("/api/user/orders/:id/return-eligibility", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const order = await storage.getOrder(req.params.id);
      
      if (!order || order.userId !== user.id) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const eligibility = await storage.checkOrderReturnEligibility(req.params.id);
      res.json(eligibility);
    } catch (error) {
      res.status(500).json({ message: "Failed to check return eligibility" });
    }
  });

  // User: Get user's return requests
  app.get("/api/user/returns", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const returns = await storage.getUserReturnRequests(user.id);
      res.json(returns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch return requests" });
    }
  });

  // User: Get single return request
  app.get("/api/user/returns/:id", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const returnRequest = await storage.getReturnRequest(req.params.id);
      
      if (!returnRequest || returnRequest.userId !== user.id) {
        return res.status(404).json({ message: "Return request not found" });
      }
      
      res.json(returnRequest);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch return request" });
    }
  });

  // User: Create return request (supports both refund and exchange)
  app.post("/api/user/returns", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { orderId, reason, description, resolutionType, items } = req.body;
      
      // Validate order and eligibility
      const order = await storage.getOrder(orderId);
      if (!order || order.userId !== user.id) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const eligibility = await storage.checkOrderReturnEligibility(orderId);
      if (!eligibility.eligible) {
        return res.status(400).json({ message: eligibility.reason });
      }
      
      // Calculate return amount and validate exchange items
      let returnAmount = 0;
      let exchangeAmount = 0;
      
      for (const item of items) {
        const orderItem = order.items.find(oi => oi.id === item.orderItemId);
        if (orderItem) {
          returnAmount += parseFloat(orderItem.price) * item.quantity;
        }
        
        // If exchange, validate and calculate exchange product price
        if (resolutionType === "exchange" && item.exchangeSareeId) {
          const exchangeSaree = await storage.getSaree(item.exchangeSareeId);
          if (!exchangeSaree) {
            return res.status(400).json({ message: "Exchange product not found" });
          }
          if (exchangeSaree.onlineStock < item.quantity) {
            return res.status(400).json({ message: `Insufficient stock for exchange product: ${exchangeSaree.name}` });
          }
          exchangeAmount += parseFloat(exchangeSaree.price) * item.quantity;
        }
      }
      
      // Calculate price difference for exchanges
      const priceDifference = exchangeAmount - returnAmount;
      
      const returnRequest = await storage.createReturnRequest(
        {
          orderId,
          userId: user.id,
          reason,
          description,
          resolutionType: resolutionType || "refund",
          returnAmount: returnAmount.toString(),
        },
        items.map((item: any) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          reason: item.reason,
          exchangeSareeId: item.exchangeSareeId || null,
        }))
      );
      
      // Create notification
      const notificationMessage = resolutionType === "exchange" 
        ? `Your exchange request for order #${orderId.slice(-8)} has been submitted. ${priceDifference > 0 ? `You will need to pay ₹${priceDifference.toFixed(2)} for the price difference.` : priceDifference < 0 ? `You will receive ₹${Math.abs(priceDifference).toFixed(2)} as store credit.` : ""}`
        : `Your return request for order #${orderId.slice(-8)} has been submitted and is pending review.`;
      
      await storage.createNotification({
        userId: user.id,
        type: "return",
        title: resolutionType === "exchange" ? "Exchange Request Submitted" : "Return Request Submitted",
        message: notificationMessage,
        relatedId: returnRequest.id,
        relatedType: "return_request",
      });
      
      res.json({
        ...returnRequest,
        exchangeAmount: exchangeAmount.toString(),
        priceDifference: priceDifference.toString(),
      });
    } catch (error) {
      console.error("Error creating return request:", error);
      res.status(500).json({ message: "Failed to create return request" });
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
      
      const isExchange = returnRequest.resolutionType === "exchange";
      
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
        case "in_transit":
          notificationTitle = "Return Items Received";
          notificationMessage = `We have received your return items and they are being processed.`;
          break;
        case "completed":
          if (isExchange) {
            notificationTitle = "Exchange Completed";
            notificationMessage = `Your exchange has been completed. Your new product will be shipped soon!`;
            // For exchanges, we could create a new order for the exchange product
            // This would involve processing any price difference
          } else {
            notificationTitle = "Return Completed";
            notificationMessage = `Your return has been completed. Refund will be processed shortly.`;
            
            // Create refund record when return is completed
            await storage.createRefund({
              returnRequestId: returnRequest.id,
              orderId: returnRequest.orderId,
              userId: returnRequest.userId,
              amount: returnRequest.returnAmount,
              method: returnRequest.order.paymentMethod || "original_method",
            });
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

  // ==================== REFUND ROUTES ====================

  // User: Get user's refunds
  app.get("/api/user/refunds", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const refunds = await storage.getRefunds({ userId: user.id });
      res.json(refunds);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch refunds" });
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

  // ==================== PRODUCT REVIEW ROUTES ====================

  // Public: Get reviews for a saree
  app.get("/api/sarees/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getProductReviews(req.params.id, { status: "approved" });
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Public: Get review stats for a saree
  app.get("/api/sarees/:id/reviews/stats", async (req, res) => {
    try {
      const reviews = await storage.getProductReviews(req.params.id, { status: "approved" });
      
      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
        : 0;
      
      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach((r) => {
        if (ratingDistribution[r.rating] !== undefined) {
          ratingDistribution[r.rating]++;
        }
      });
      
      res.json({
        averageRating,
        totalReviews,
        ratingDistribution,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review stats" });
    }
  });

  // User: Create a review for a specific saree
  app.post("/api/sarees/:id/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const sareeId = req.params.id;
      const { rating, comment, title, images } = req.body;
      
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      
      const review = await storage.createReview({
        sareeId,
        userId: user.id,
        rating,
        title,
        comment,
        images: images || [],
      });
      
      res.json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Public: Get saree with reviews and ratings
  app.get("/api/sarees/:id/with-reviews", async (req, res) => {
    try {
      const saree = await storage.getSareeWithReviews(req.params.id);
      if (!saree) {
        return res.status(404).json({ message: "Saree not found" });
      }
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saree with reviews" });
    }
  });

  // User: Check if user can review a product
  app.get("/api/user/can-review/:sareeId", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const canReview = await storage.canUserReviewProduct(user.id, req.params.sareeId);
      res.json({ canReview });
    } catch (error) {
      res.status(500).json({ message: "Failed to check review eligibility" });
    }
  });

  // User: Create a review
  app.post("/api/user/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { sareeId, orderId, rating, title, comment, images } = req.body;
      
      // Validate rating
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      
      // Check if user can review
      const canReview = await storage.canUserReviewProduct(user.id, sareeId);
      if (!canReview) {
        return res.status(400).json({ message: "You cannot review this product. Either you haven't purchased it or already reviewed it." });
      }
      
      const review = await storage.createReview({
        sareeId,
        userId: user.id,
        orderId,
        rating,
        title,
        comment,
        images: images || [],
      });
      
      res.json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // User: Get user's reviews
  app.get("/api/user/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const reviews = await storage.getUserReviews(user.id);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Admin: Get all reviews (for moderation)
  app.get("/api/admin/reviews", authAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      const reviews = await storage.getAllReviews({
        status: status as string | undefined,
      });
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Admin: Update review status (approve/reject)
  app.patch("/api/admin/reviews/:id/status", authAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const review = await storage.updateReviewStatus(req.params.id, status);
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
      const coupons = await storage.getCoupons({
        isActive: active === "true" ? true : active === "false" ? false : undefined,
      });
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  // Admin: Create coupon
  app.post("/api/admin/coupons", authAdmin, async (req, res) => {
    try {
      const { code, type, value, minOrderAmount, maxDiscount, maxUsageLimit, perUserLimit, expiresAt, validFrom, isActive } = req.body;
      
      if (!code || !type) {
        return res.status(400).json({ message: "Code and type are required" });
      }
      
      // Value is required for percentage and fixed types
      if ((type === "percentage" || type === "fixed") && (value === undefined || value === null || value === "")) {
        return res.status(400).json({ message: "Value is required for percentage and fixed discount types" });
      }
      
      // Check if code already exists
      const existing = await storage.getCouponByCode(code);
      if (existing) {
        return res.status(400).json({ message: "Coupon code already exists" });
      }
      
      // Set default dates if not provided
      const now = new Date();
      const oneYearLater = new Date(now);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      
      const coupon = await storage.createCoupon({
        code: code.toUpperCase(),
        name: code.toUpperCase(),
        type,
        value: value !== undefined && value !== null && value !== "" ? String(value) : "0",
        minOrderAmount: minOrderAmount !== undefined && minOrderAmount !== null && minOrderAmount !== "" ? String(minOrderAmount) : null,
        maxDiscount: maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== "" ? String(maxDiscount) : null,
        usageLimit: maxUsageLimit !== undefined && maxUsageLimit !== null && maxUsageLimit !== "" ? Number(maxUsageLimit) : null,
        perUserLimit: perUserLimit !== undefined && perUserLimit !== null && perUserLimit !== "" ? Number(perUserLimit) : null,
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
      const { code, type, value, minOrderAmount, maxDiscount, maxUsageLimit, perUserLimit, expiresAt, validFrom, isActive } = req.body;
      
      const updateData: any = {};
      if (code !== undefined) {
        updateData.code = code.toUpperCase();
        updateData.name = code.toUpperCase();
      }
      if (type !== undefined) updateData.type = type;
      if (value !== undefined) updateData.value = value !== null && value !== "" ? String(value) : "0";
      if (minOrderAmount !== undefined) updateData.minOrderAmount = minOrderAmount !== null && minOrderAmount !== "" ? String(minOrderAmount) : null;
      if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount !== null && maxDiscount !== "" ? String(maxDiscount) : null;
      if (maxUsageLimit !== undefined) updateData.usageLimit = maxUsageLimit !== null && maxUsageLimit !== "" ? Number(maxUsageLimit) : null;
      if (perUserLimit !== undefined) updateData.perUserLimit = perUserLimit !== null && perUserLimit !== "" ? Number(perUserLimit) : null;
      if (validFrom !== undefined) updateData.validFrom = validFrom ? new Date(validFrom) : null;
      if (expiresAt !== undefined) updateData.validUntil = expiresAt ? new Date(expiresAt) : null;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const coupon = await storage.updateCoupon(req.params.id, updateData);
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
      await storage.deleteCoupon(req.params.id);
      res.json({ message: "Coupon deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  // User: Validate coupon
  app.post("/api/user/coupons/validate", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { code, orderAmount } = req.body;
      
      const result = await storage.validateCoupon(code, user.id, orderAmount);
      
      if (!result.valid) {
        return res.status(400).json({ message: result.error });
      }
      
      // Calculate discount
      let discountAmount = 0;
      const coupon = result.coupon!;
      
      if (coupon.type === "percentage") {
        discountAmount = (orderAmount * parseFloat(coupon.value)) / 100;
        if (coupon.maxDiscount) {
          discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscount));
        }
      } else {
        discountAmount = parseFloat(coupon.value);
      }
      
      res.json({
        valid: true,
        coupon,
        discountAmount: discountAmount.toFixed(2),
        finalAmount: (orderAmount - discountAmount).toFixed(2),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to validate coupon" });
    }
  });

  // ==================== ADMIN SETTINGS ROUTES ====================

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

  // ==================== NOTIFICATION ROUTES ====================

  // User: Get notifications
  app.get("/api/user/notifications", authAny, async (req, res) => {
    try {
      const user = (req as any).user;
      const { unreadOnly } = req.query;
      const notifications = await storage.getNotifications(user.id, unreadOnly === "true");
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // User: Get unread notification count
  app.get("/api/user/notifications/unread-count", authAny, async (req, res) => {
    try {
      const user = (req as any).user;
      const count = await storage.getUnreadNotificationCount(user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  // User: Mark notification as read
  app.patch("/api/user/notifications/:id/read", authAny, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // User: Mark all notifications as read
  app.post("/api/user/notifications/mark-all-read", authAny, async (req, res) => {
    try {
      const user = (req as any).user;
      await storage.markAllNotificationsAsRead(user.id);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // ==================== ORDER STATUS HISTORY ROUTES ====================

  // User: Get order status history
  app.get("/api/user/orders/:id/history", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const order = await storage.getOrder(req.params.id);
      
      if (!order || order.userId !== user.id) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const history = await storage.getOrderStatusHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order history" });
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

  return httpServer;
}
