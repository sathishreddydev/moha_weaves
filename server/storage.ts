import {
  users, categories, colors, fabrics, stores, sarees, storeInventory,
  wishlist, cart, orders, orderItems, storeSales, storeSaleItems, stockRequests,
  userAddresses, serviceablePincodes, refreshTokens,
  returnRequests, returnItems, refunds, productReviews, coupons, couponUsage,
  notifications, orderStatusHistory, appSettings,
  type User, type InsertUser, type Category, type InsertCategory,
  type Color, type InsertColor, type Fabric, type InsertFabric,
  type Store, type InsertStore, type Saree, type InsertSaree,
  type StoreInventory, type InsertStoreInventory,
  type WishlistItem, type InsertWishlistItem,
  type CartItem, type InsertCartItem,
  type Order, type InsertOrder, type OrderItem, type InsertOrderItem,
  type StoreSale, type InsertStoreSale, type StoreSaleItem, type InsertStoreSaleItem,
  type StockRequest, type InsertStockRequest,
  type UserAddress, type InsertUserAddress,
  type ServiceablePincode, type InsertServiceablePincode,
  type RefreshToken, type InsertRefreshToken,
  type ReturnRequest, type InsertReturnRequest, type ReturnItem, type InsertReturnItem,
  type Refund, type InsertRefund, type ProductReview, type InsertProductReview,
  type Coupon, type InsertCoupon, type CouponUsage, type InsertCouponUsage,
  type Notification, type InsertNotification,
  type OrderStatusHistory, type InsertOrderStatusHistory,
  type SareeWithDetails, type CartItemWithSaree, type WishlistItemWithSaree,
  type OrderWithItems, type StockRequestWithDetails, type StoreSaleWithItems,
  type ReturnRequestWithDetails, type SareeWithReviews, type CouponWithUsage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, desc, asc, sql, gte, lte, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(filters?: { role?: string }): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  incrementUserTokenVersion(id: string): Promise<void>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;

  // Refresh Tokens
  createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken>;
  getRefreshToken(token: string): Promise<RefreshToken | undefined>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: string): Promise<void>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Colors
  getColors(): Promise<Color[]>;
  getColor(id: string): Promise<Color | undefined>;
  createColor(color: InsertColor): Promise<Color>;
  updateColor(id: string, data: Partial<InsertColor>): Promise<Color | undefined>;
  deleteColor(id: string): Promise<boolean>;

  // Fabrics
  getFabrics(): Promise<Fabric[]>;
  getFabric(id: string): Promise<Fabric | undefined>;
  createFabric(fabric: InsertFabric): Promise<Fabric>;
  updateFabric(id: string, data: Partial<InsertFabric>): Promise<Fabric | undefined>;
  deleteFabric(id: string): Promise<boolean>;

  // Stores
  getStores(): Promise<Store[]>;
  getStore(id: string): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: string, data: Partial<InsertStore>): Promise<Store | undefined>;

  // Sarees
  getSarees(filters?: {
    search?: string;
    category?: string;
    color?: string;
    fabric?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    distributionChannel?: string;
    sort?: string;
    limit?: number;
  }): Promise<SareeWithDetails[]>;
  getSaree(id: string): Promise<SareeWithDetails | undefined>;
  createSaree(saree: InsertSaree): Promise<Saree>;
  updateSaree(id: string, data: Partial<InsertSaree>): Promise<Saree | undefined>;
  deleteSaree(id: string): Promise<boolean>;
  getLowStockSarees(threshold?: number): Promise<SareeWithDetails[]>;

  // Cart
  getCartItems(userId: string): Promise<CartItemWithSaree[]>;
  getCartCount(userId: string): Promise<number>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: string): Promise<boolean>;
  clearCart(userId: string): Promise<boolean>;

  // Wishlist
  getWishlistItems(userId: string): Promise<WishlistItemWithSaree[]>;
  getWishlistCount(userId: string): Promise<number>;
  addToWishlist(item: InsertWishlistItem): Promise<WishlistItem>;
  removeFromWishlist(userId: string, sareeId: string): Promise<boolean>;
  isInWishlist(userId: string, sareeId: string): Promise<boolean>;

  // Orders
  getOrders(userId: string): Promise<OrderWithItems[]>;
  getOrder(id: string): Promise<OrderWithItems | undefined>;
  getAllOrders(filters?: { status?: string; limit?: number }): Promise<OrderWithItems[]>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;

  // Store Inventory
  getStoreInventory(storeId: string): Promise<(StoreInventory & { saree: SareeWithDetails })[]>;
  getShopAvailableProducts(storeId: string): Promise<{ saree: SareeWithDetails; storeStock: number }[]>;
  updateStoreInventory(storeId: string, sareeId: string, quantity: number): Promise<StoreInventory>;
  
  // Saree with Store Allocations
  createSareeWithAllocations(
    saree: InsertSaree,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree>;
  updateSareeWithAllocations(
    id: string,
    data: Partial<InsertSaree>,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree | undefined>;
  getSareeAllocations(sareeId: string): Promise<{ storeId: string; storeName: string; quantity: number }[]>;
  
  // Stock Distribution (centralized view)
  getStockDistribution(): Promise<{
    saree: SareeWithDetails;
    totalStock: number;
    onlineStock: number;
    storeAllocations: { store: Store; quantity: number }[];
    unallocated: number;
  }[]>;

  // Store Sales
  getStoreSales(storeId: string, limit?: number): Promise<StoreSaleWithItems[]>;
  createStoreSale(sale: InsertStoreSale, items: InsertStoreSaleItem[]): Promise<StoreSale>;

  // Stock Requests
  getStockRequests(filters?: { storeId?: string; status?: string }): Promise<StockRequestWithDetails[]>;
  createStockRequest(request: InsertStockRequest): Promise<StockRequest>;
  updateStockRequestStatus(id: string, status: string, approvedBy?: string): Promise<StockRequest | undefined>;

  // Stats
  getAdminStats(): Promise<{
    totalUsers: number;
    totalSarees: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    lowStockItems: number;
  }>;
  getStoreStats(storeId: string): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalInventory: number;
    pendingRequests: number;
  }>;

  // User Addresses
  getUserAddresses(userId: string): Promise<UserAddress[]>;
  getUserAddress(id: string): Promise<UserAddress | undefined>;
  createUserAddress(address: InsertUserAddress): Promise<UserAddress>;
  updateUserAddress(id: string, data: Partial<InsertUserAddress>): Promise<UserAddress | undefined>;
  deleteUserAddress(id: string): Promise<boolean>;
  setDefaultAddress(userId: string, addressId: string): Promise<UserAddress | undefined>;

  // Serviceable Pincodes
  checkPincodeAvailability(pincode: string): Promise<ServiceablePincode | undefined>;
  getServiceablePincodes(): Promise<ServiceablePincode[]>;
  createServiceablePincode(pincode: InsertServiceablePincode): Promise<ServiceablePincode>;
  updateServiceablePincode(id: string, data: Partial<InsertServiceablePincode>): Promise<ServiceablePincode | undefined>;
  deleteServiceablePincode(id: string): Promise<boolean>;

  // Return Requests
  getReturnRequests(filters?: { userId?: string; status?: string }): Promise<ReturnRequestWithDetails[]>;
  getReturnRequest(id: string): Promise<ReturnRequestWithDetails | undefined>;
  createReturnRequest(request: InsertReturnRequest, items: InsertReturnItem[]): Promise<ReturnRequest>;
  updateReturnRequestStatus(id: string, status: string, processedBy?: string, adminNotes?: string): Promise<ReturnRequest | undefined>;
  getUserReturnRequests(userId: string): Promise<ReturnRequestWithDetails[]>;
  checkOrderReturnEligibility(orderId: string): Promise<{ eligible: boolean; reason?: string }>;

  // Refunds
  getRefunds(filters?: { userId?: string; status?: string }): Promise<Refund[]>;
  getRefund(id: string): Promise<Refund | undefined>;
  createRefund(refund: InsertRefund): Promise<Refund>;
  updateRefundStatus(id: string, status: string, processedAt?: Date, transactionId?: string): Promise<Refund | undefined>;
  getRefundByReturnRequest(returnRequestId: string): Promise<Refund | undefined>;

  // Product Reviews
  getProductReviews(sareeId: string, filters?: { status?: string }): Promise<ProductReview[]>;
  getReview(id: string): Promise<ProductReview | undefined>;
  createReview(review: InsertProductReview): Promise<ProductReview>;
  updateReviewStatus(id: string, status: string): Promise<ProductReview | undefined>;
  getUserReviews(userId: string): Promise<ProductReview[]>;
  getSareeWithReviews(sareeId: string): Promise<SareeWithReviews | undefined>;
  canUserReviewProduct(userId: string, sareeId: string): Promise<boolean>;
  getAllReviews(filters?: { status?: string; limit?: number }): Promise<(ProductReview & { saree: SareeWithDetails })[]>;

  // Coupons
  getCoupons(filters?: { isActive?: boolean }): Promise<CouponWithUsage[]>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<boolean>;
  validateCoupon(code: string, userId: string, orderAmount: number): Promise<{ valid: boolean; coupon?: Coupon; error?: string }>;
  applyCoupon(couponId: string, userId: string, orderId: string, discountAmount: string): Promise<CouponUsage>;

  // Notifications
  getNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Order Status History
  getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]>;
  addOrderStatusHistory(entry: InsertOrderStatusHistory): Promise<OrderStatusHistory>;
  updateOrderWithStatusHistory(orderId: string, status: string, changedBy?: string, notes?: string): Promise<Order | undefined>;

  // App Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string, description?: string, updatedBy?: string): Promise<void>;
  getAllSettings(): Promise<{ key: string; value: string; description: string | null; updatedAt: Date }[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(filters?: { role?: string }): Promise<User[]> {
    if (filters?.role) {
      return db.select().from(users).where(eq(users.role, filters.role as any));
    }
    return db.select().from(users);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async incrementUserTokenVersion(id: string): Promise<void> {
    await db.update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, id));
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(users)
      .set({ 
        password: hashedPassword, 
        tokenVersion: sql`${users.tokenVersion} + 1` 
      })
      .where(eq(users.id, id));
  }

  // Refresh Tokens
  async createRefreshToken(token: InsertRefreshToken): Promise<RefreshToken> {
    const [result] = await db.insert(refreshTokens).values(token).returning();
    return result;
  }

  async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
    const [result] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token));
    return result || undefined;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await db.update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.token, token));
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await db.update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.userId, userId));
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.isActive, true));
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [result] = await db.insert(categories).values(category).returning();
    return result;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [result] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return result || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const [result] = await db.update(categories).set({ isActive: false }).where(eq(categories.id, id)).returning();
    return !!result;
  }

  // Colors
  async getColors(): Promise<Color[]> {
    return db.select().from(colors).where(eq(colors.isActive, true));
  }

  async getColor(id: string): Promise<Color | undefined> {
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    return color || undefined;
  }

  async createColor(color: InsertColor): Promise<Color> {
    const [result] = await db.insert(colors).values(color).returning();
    return result;
  }

  async updateColor(id: string, data: Partial<InsertColor>): Promise<Color | undefined> {
    const [result] = await db.update(colors).set(data).where(eq(colors.id, id)).returning();
    return result || undefined;
  }

  async deleteColor(id: string): Promise<boolean> {
    const [result] = await db.update(colors).set({ isActive: false }).where(eq(colors.id, id)).returning();
    return !!result;
  }

  // Fabrics
  async getFabrics(): Promise<Fabric[]> {
    return db.select().from(fabrics).where(eq(fabrics.isActive, true));
  }

  async getFabric(id: string): Promise<Fabric | undefined> {
    const [fabric] = await db.select().from(fabrics).where(eq(fabrics.id, id));
    return fabric || undefined;
  }

  async createFabric(fabric: InsertFabric): Promise<Fabric> {
    const [result] = await db.insert(fabrics).values(fabric).returning();
    return result;
  }

  async updateFabric(id: string, data: Partial<InsertFabric>): Promise<Fabric | undefined> {
    const [result] = await db.update(fabrics).set(data).where(eq(fabrics.id, id)).returning();
    return result || undefined;
  }

  async deleteFabric(id: string): Promise<boolean> {
    const [result] = await db.update(fabrics).set({ isActive: false }).where(eq(fabrics.id, id)).returning();
    return !!result;
  }

  // Stores
  async getStores(): Promise<Store[]> {
    return db.select().from(stores).where(eq(stores.isActive, true));
  }

  async getStore(id: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async createStore(store: InsertStore): Promise<Store> {
    const [result] = await db.insert(stores).values(store).returning();
    return result;
  }

  async updateStore(id: string, data: Partial<InsertStore>): Promise<Store | undefined> {
    const [result] = await db.update(stores).set(data).where(eq(stores.id, id)).returning();
    return result || undefined;
  }

  // Sarees
  async getSarees(filters?: {
    search?: string;
    category?: string;
    color?: string;
    fabric?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    distributionChannel?: string;
    sort?: string;
    limit?: number;
  }): Promise<SareeWithDetails[]> {
    const conditions = [eq(sarees.isActive, true)];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(sarees.name, `%${filters.search}%`),
          ilike(sarees.description, `%${filters.search}%`)
        ) as any
      );
    }
    if (filters?.category) {
      conditions.push(eq(sarees.categoryId, filters.category));
    }
    if (filters?.color) {
      conditions.push(eq(sarees.colorId, filters.color));
    }
    if (filters?.fabric) {
      conditions.push(eq(sarees.fabricId, filters.fabric));
    }
    if (filters?.featured) {
      conditions.push(eq(sarees.isFeatured, true));
    }
    if (filters?.minPrice) {
      conditions.push(gte(sarees.price, filters.minPrice.toString()));
    }
    if (filters?.maxPrice) {
      conditions.push(lte(sarees.price, filters.maxPrice.toString()));
    }
    if (filters?.distributionChannel) {
      if (filters.distributionChannel === "online") {
        conditions.push(or(
          eq(sarees.distributionChannel, "online"),
          eq(sarees.distributionChannel, "both")
        ) as any);
      } else if (filters.distributionChannel === "shop") {
        conditions.push(or(
          eq(sarees.distributionChannel, "shop"),
          eq(sarees.distributionChannel, "both")
        ) as any);
      }
    }

    let orderBy: any = desc(sarees.createdAt);
    if (filters?.sort === "price-low") {
      orderBy = asc(sarees.price);
    } else if (filters?.sort === "price-high") {
      orderBy = desc(sarees.price);
    } else if (filters?.sort === "name") {
      orderBy = asc(sarees.name);
    }

    const result = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(filters?.limit || 100);

    return result.map((row) => ({
      ...row.sarees,
      category: row.categories,
      color: row.colors,
      fabric: row.fabrics,
    }));
  }

  async getSaree(id: string): Promise<SareeWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(sarees.id, id));

    if (!result) return undefined;

    return {
      ...result.sarees,
      category: result.categories,
      color: result.colors,
      fabric: result.fabrics,
    };
  }

  async createSaree(saree: InsertSaree): Promise<Saree> {
    // Auto-generate SKU if not provided: MH-YYYYMMDD-XXXXX (timestamp + random suffix)
    let sareeData = saree;
    if (!saree.sku) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const generatedSku = `MH-${dateStr}-${randomSuffix}`;
      sareeData = { ...saree, sku: generatedSku };
    }
    const [result] = await db.insert(sarees).values(sareeData).returning();
    return result;
  }

  async updateSaree(id: string, data: Partial<InsertSaree>): Promise<Saree | undefined> {
    const [result] = await db.update(sarees).set(data).where(eq(sarees.id, id)).returning();
    return result || undefined;
  }

  async deleteSaree(id: string): Promise<boolean> {
    const [result] = await db.update(sarees).set({ isActive: false }).where(eq(sarees.id, id)).returning();
    return !!result;
  }

  async createSareeWithAllocations(
    saree: InsertSaree,
    allocations: { storeId: string; quantity: number }[]
  ): Promise<Saree> {
    return await db.transaction(async (tx) => {
      // Auto-generate SKU: MH-YYYYMMDD-XXXXX (timestamp + random suffix)
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const generatedSku = `MH-${dateStr}-${randomSuffix}`;
      
      const sareeWithSku = {
        ...saree,
        sku: generatedSku,
      };
      
      const [createdSaree] = await tx.insert(sarees).values(sareeWithSku).returning();
      
      const nonZeroAllocations = allocations.filter(a => a.quantity > 0);
      if (nonZeroAllocations.length > 0) {
        const inventoryRecords = nonZeroAllocations.map((alloc) => ({
          storeId: alloc.storeId,
          sareeId: createdSaree.id,
          quantity: alloc.quantity,
        }));
        await tx.insert(storeInventory).values(inventoryRecords);
      }
      
      return createdSaree;
    });
  }

  async updateSareeWithAllocations(
    id: string,
    data: Partial<InsertSaree>,
    allocations: { storeId: string; quantity: number }[]
  ): Promise<Saree | undefined> {
    return await db.transaction(async (tx) => {
      // Remove SKU from update data - SKU is auto-generated and should not be changed
      const { sku, ...updateData } = data as any;
      
      const [updatedSaree] = await tx.update(sarees).set(updateData).where(eq(sarees.id, id)).returning();
      if (!updatedSaree) return undefined;
      
      await tx.delete(storeInventory).where(eq(storeInventory.sareeId, id));
      
      const nonZeroAllocations = allocations.filter(a => a.quantity > 0);
      if (nonZeroAllocations.length > 0) {
        const inventoryRecords = nonZeroAllocations.map((alloc) => ({
          storeId: alloc.storeId,
          sareeId: id,
          quantity: alloc.quantity,
        }));
        await tx.insert(storeInventory).values(inventoryRecords);
      }
      
      return updatedSaree;
    });
  }

  async getSareeAllocations(sareeId: string): Promise<{ storeId: string; storeName: string; quantity: number }[]> {
    const result = await db
      .select({
        storeId: storeInventory.storeId,
        storeName: stores.name,
        quantity: storeInventory.quantity,
      })
      .from(storeInventory)
      .innerJoin(stores, eq(storeInventory.storeId, stores.id))
      .where(eq(storeInventory.sareeId, sareeId));
    
    return result;
  }

  async getLowStockSarees(threshold = 10): Promise<SareeWithDetails[]> {
    const result = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(and(eq(sarees.isActive, true), lte(sarees.totalStock, threshold)))
      .orderBy(asc(sarees.totalStock));

    return result.map((row) => ({
      ...row.sarees,
      category: row.categories,
      color: row.colors,
      fabric: row.fabrics,
    }));
  }

  // Cart
  async getCartItems(userId: string): Promise<CartItemWithSaree[]> {
    const result = await db
      .select()
      .from(cart)
      .innerJoin(sarees, eq(cart.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(cart.userId, userId));

    return result.map((row) => ({
      ...row.cart,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }

  async getCartCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cart)
      .where(eq(cart.userId, userId));
    return result?.count || 0;
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const [existing] = await db
      .select()
      .from(cart)
      .where(and(eq(cart.userId, item.userId), eq(cart.sareeId, item.sareeId)));

    if (existing) {
      const [updated] = await db
        .update(cart)
        .set({ quantity: existing.quantity + (item.quantity || 1) })
        .where(eq(cart.id, existing.id))
        .returning();
      return updated;
    }

    const [result] = await db.insert(cart).values(item).returning();
    return result;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [result] = await db.update(cart).set({ quantity }).where(eq(cart.id, id)).returning();
    return result || undefined;
  }

  async removeFromCart(id: string): Promise<boolean> {
    const [result] = await db.delete(cart).where(eq(cart.id, id)).returning();
    return !!result;
  }

  async clearCart(userId: string): Promise<boolean> {
    await db.delete(cart).where(eq(cart.userId, userId));
    return true;
  }

  // Wishlist
  async getWishlistItems(userId: string): Promise<WishlistItemWithSaree[]> {
    const result = await db
      .select()
      .from(wishlist)
      .innerJoin(sarees, eq(wishlist.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(wishlist.userId, userId));

    return result.map((row) => ({
      ...row.wishlist,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }

  async getWishlistCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wishlist)
      .where(eq(wishlist.userId, userId));
    return result?.count || 0;
  }

  async addToWishlist(item: InsertWishlistItem): Promise<WishlistItem> {
    const [existing] = await db
      .select()
      .from(wishlist)
      .where(and(eq(wishlist.userId, item.userId), eq(wishlist.sareeId, item.sareeId)));

    if (existing) return existing;

    const [result] = await db.insert(wishlist).values(item).returning();
    return result;
  }

  async removeFromWishlist(userId: string, sareeId: string): Promise<boolean> {
    const [result] = await db
      .delete(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.sareeId, sareeId)))
      .returning();
    return !!result;
  }

  async isInWishlist(userId: string, sareeId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.sareeId, sareeId)));
    return !!result;
  }

  // Orders
  async getOrders(userId: string): Promise<OrderWithItems[]> {
    const orderList = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    const result: OrderWithItems[] = [];

    for (const order of orderList) {
      const items = await db
        .select()
        .from(orderItems)
        .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(orderItems.orderId, order.id));

      result.push({
        ...order,
        items: items.map((row) => ({
          ...row.order_items,
          saree: {
            ...row.sarees,
            category: row.categories,
            color: row.colors,
            fabric: row.fabrics,
          },
        })),
      });
    }

    return result;
  }

  async getOrder(id: string): Promise<OrderWithItems | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await db
      .select()
      .from(orderItems)
      .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(orderItems.orderId, order.id));

    return {
      ...order,
      items: items.map((row) => ({
        ...row.order_items,
        saree: {
          ...row.sarees,
          category: row.categories,
          color: row.colors,
          fabric: row.fabrics,
        },
      })),
    };
  }

  async getAllOrders(filters?: { status?: string; limit?: number }): Promise<OrderWithItems[]> {
    let query = db.select().from(orders).orderBy(desc(orders.createdAt));

    if (filters?.status) {
      query = query.where(eq(orders.status, filters.status as any)) as any;
    }

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    const orderList = await query;
    const result: OrderWithItems[] = [];

    for (const order of orderList) {
      const items = await db
        .select()
        .from(orderItems)
        .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(orderItems.orderId, order.id));

      result.push({
        ...order,
        items: items.map((row) => ({
          ...row.order_items,
          saree: {
            ...row.sarees,
            category: row.categories,
            color: row.colors,
            fabric: row.fabrics,
          },
        })),
      });
    }

    return result;
  }

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();

    for (const item of items) {
      await db.insert(orderItems).values({ ...item, orderId: newOrder.id });
      await db
        .update(sarees)
        .set({ onlineStock: sql`${sarees.onlineStock} - ${item.quantity}` })
        .where(eq(sarees.id, item.sareeId));
    }

    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const updateData: any = { 
      status: status as any, 
      updatedAt: new Date() 
    };
    
    // When marking as delivered, set deliveredAt and calculate returnEligibleUntil
    if (status === "delivered") {
      const now = new Date();
      updateData.deliveredAt = now;
      
      // Get return window setting, default to 7 days
      const windowDays = await this.getSetting("return_window_days");
      const days = windowDays ? parseInt(windowDays) : 7;
      
      const eligibleUntil = new Date(now);
      eligibleUntil.setDate(eligibleUntil.getDate() + days);
      updateData.returnEligibleUntil = eligibleUntil;
    }
    
    const [result] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return result || undefined;
  }

  // Store Inventory
  async getStoreInventory(storeId: string): Promise<(StoreInventory & { saree: SareeWithDetails })[]> {
    const result = await db
      .select()
      .from(storeInventory)
      .innerJoin(sarees, eq(storeInventory.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(storeInventory.storeId, storeId));

    return result.map((row) => ({
      ...row.store_inventory,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }

  async getShopAvailableProducts(storeId: string): Promise<{ saree: SareeWithDetails; storeStock: number }[]> {
    const result = await db
      .select({
        saree: sarees,
        category: categories,
        color: colors,
        fabric: fabrics,
        storeStock: sql<number>`COALESCE((
          SELECT quantity FROM store_inventory 
          WHERE store_id = ${storeId} AND saree_id = ${sarees.id}
        ), 0)::int`,
      })
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(
        and(
          eq(sarees.isActive, true),
          or(
            eq(sarees.distributionChannel, "shop"),
            eq(sarees.distributionChannel, "both")
          )
        )
      )
      .orderBy(sarees.name);

    return result.map((row) => ({
      saree: {
        ...row.saree,
        category: row.category,
        color: row.color,
        fabric: row.fabric,
      },
      storeStock: row.storeStock || 0,
    }));
  }

  async updateStoreInventory(storeId: string, sareeId: string, quantity: number): Promise<StoreInventory> {
    const [existing] = await db
      .select()
      .from(storeInventory)
      .where(and(eq(storeInventory.storeId, storeId), eq(storeInventory.sareeId, sareeId)));

    if (existing) {
      const [updated] = await db
        .update(storeInventory)
        .set({ quantity, updatedAt: new Date() })
        .where(eq(storeInventory.id, existing.id))
        .returning();
      return updated;
    }

    const [result] = await db
      .insert(storeInventory)
      .values({ storeId, sareeId, quantity })
      .returning();
    return result;
  }

  async getStockDistribution(): Promise<{
    saree: SareeWithDetails;
    totalStock: number;
    onlineStock: number;
    storeAllocations: { store: Store; quantity: number }[];
    unallocated: number;
  }[]> {
    const allSarees = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(sarees.isActive, true))
      .orderBy(sarees.name);

    const allStores = await db.select().from(stores).where(eq(stores.isActive, true));
    const allStoreInventory = await db.select().from(storeInventory);

    const result = allSarees.map((row) => {
      const sareeStoreInventory = allStoreInventory.filter(
        (inv) => inv.sareeId === row.sarees.id
      );

      const storeAllocations = sareeStoreInventory
        .map((inv) => {
          const store = allStores.find((s) => s.id === inv.storeId);
          if (store && inv.quantity > 0) {
            return { store, quantity: inv.quantity };
          }
          return null;
        })
        .filter((item): item is { store: Store; quantity: number } => item !== null);

      const totalStoreAllocated = storeAllocations.reduce((sum, a) => sum + a.quantity, 0);
      const unallocated = row.sarees.totalStock - row.sarees.onlineStock - totalStoreAllocated;

      return {
        saree: {
          ...row.sarees,
          category: row.categories,
          color: row.colors,
          fabric: row.fabrics,
        },
        totalStock: row.sarees.totalStock,
        onlineStock: row.sarees.onlineStock,
        storeAllocations,
        unallocated: Math.max(0, unallocated),
      };
    });

    return result;
  }

  // Store Sales
  async getStoreSales(storeId: string, limit?: number): Promise<StoreSaleWithItems[]> {
    let query = db
      .select()
      .from(storeSales)
      .innerJoin(stores, eq(storeSales.storeId, stores.id))
      .where(eq(storeSales.storeId, storeId))
      .orderBy(desc(storeSales.createdAt));

    if (limit) {
      query = query.limit(limit) as any;
    }

    const salesList = await query;
    const result: StoreSaleWithItems[] = [];

    for (const row of salesList) {
      const items = await db
        .select()
        .from(storeSaleItems)
        .innerJoin(sarees, eq(storeSaleItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(storeSaleItems.saleId, row.store_sales.id));

      result.push({
        ...row.store_sales,
        store: row.stores,
        items: items.map((itemRow) => ({
          ...itemRow.store_sale_items,
          saree: {
            ...itemRow.sarees,
            category: itemRow.categories,
            color: itemRow.colors,
            fabric: itemRow.fabrics,
          },
        })),
      });
    }

    return result;
  }

  async createStoreSale(sale: InsertStoreSale, items: InsertStoreSaleItem[]): Promise<StoreSale> {
    const [newSale] = await db.insert(storeSales).values(sale).returning();

    for (const item of items) {
      await db.insert(storeSaleItems).values({ ...item, saleId: newSale.id });
      await db
        .update(storeInventory)
        .set({ quantity: sql`${storeInventory.quantity} - ${item.quantity}` })
        .where(and(eq(storeInventory.storeId, sale.storeId), eq(storeInventory.sareeId, item.sareeId)));
    }

    return newSale;
  }

  // Stock Requests
  async getStockRequests(filters?: { storeId?: string; status?: string }): Promise<StockRequestWithDetails[]> {
    const conditions = [];

    if (filters?.storeId) {
      conditions.push(eq(stockRequests.storeId, filters.storeId));
    }
    if (filters?.status) {
      conditions.push(eq(stockRequests.status, filters.status as any));
    }

    const result = await db
      .select()
      .from(stockRequests)
      .innerJoin(stores, eq(stockRequests.storeId, stores.id))
      .innerJoin(sarees, eq(stockRequests.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockRequests.createdAt));

    return result.map((row) => ({
      ...row.stock_requests,
      store: row.stores,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }

  async createStockRequest(request: InsertStockRequest): Promise<StockRequest> {
    const [result] = await db.insert(stockRequests).values(request).returning();
    return result;
  }

  async updateStockRequestStatus(id: string, status: string, approvedBy?: string): Promise<StockRequest | undefined> {
    const [result] = await db
      .update(stockRequests)
      .set({ status: status as any, approvedBy, updatedAt: new Date() })
      .where(eq(stockRequests.id, id))
      .returning();
    return result || undefined;
  }

  // Stats
  async getAdminStats(): Promise<{
    totalUsers: number;
    totalSarees: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    lowStockItems: number;
  }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [sareeCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sarees).where(eq(sarees.isActive, true));
    const [orderCount] = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
    const [revenueSum] = await db.select({ sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float` }).from(orders).where(eq(orders.status, "delivered"));
    const [pendingCount] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "pending"));
    const [lowStockCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sarees).where(and(eq(sarees.isActive, true), lte(sarees.totalStock, 10)));

    return {
      totalUsers: userCount?.count || 0,
      totalSarees: sareeCount?.count || 0,
      totalOrders: orderCount?.count || 0,
      totalRevenue: revenueSum?.sum || 0,
      pendingOrders: pendingCount?.count || 0,
      lowStockItems: lowStockCount?.count || 0,
    };
  }

  async getStoreStats(storeId: string): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalInventory: number;
    pendingRequests: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [salesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales)
      .where(and(eq(storeSales.storeId, storeId), gte(storeSales.createdAt, today)));

    const [revenueSum] = await db
      .select({ sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float` })
      .from(storeSales)
      .where(and(eq(storeSales.storeId, storeId), gte(storeSales.createdAt, today)));

    const [inventorySum] = await db
      .select({ sum: sql<number>`coalesce(sum(quantity), 0)::int` })
      .from(storeInventory)
      .where(eq(storeInventory.storeId, storeId));

    const [requestCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockRequests)
      .where(and(eq(stockRequests.storeId, storeId), eq(stockRequests.status, "pending")));

    return {
      todaySales: salesCount?.count || 0,
      todayRevenue: revenueSum?.sum || 0,
      totalInventory: inventorySum?.sum || 0,
      pendingRequests: requestCount?.count || 0,
    };
  }

  // User Addresses
  async getUserAddresses(userId: string): Promise<UserAddress[]> {
    return db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, userId))
      .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));
  }

  async getUserAddress(id: string): Promise<UserAddress | undefined> {
    const [address] = await db.select().from(userAddresses).where(eq(userAddresses.id, id));
    return address || undefined;
  }

  async createUserAddress(address: InsertUserAddress): Promise<UserAddress> {
    if (address.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, address.userId));
    }
    const [result] = await db.insert(userAddresses).values(address).returning();
    return result;
  }

  async updateUserAddress(id: string, data: Partial<InsertUserAddress>): Promise<UserAddress | undefined> {
    if (data.isDefault) {
      const [existing] = await db.select().from(userAddresses).where(eq(userAddresses.id, id));
      if (existing) {
        await db
          .update(userAddresses)
          .set({ isDefault: false })
          .where(eq(userAddresses.userId, existing.userId));
      }
    }
    const [result] = await db.update(userAddresses).set(data).where(eq(userAddresses.id, id)).returning();
    return result || undefined;
  }

  async deleteUserAddress(id: string): Promise<boolean> {
    const result = await db.delete(userAddresses).where(eq(userAddresses.id, id));
    return true;
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<UserAddress | undefined> {
    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
    const [result] = await db
      .update(userAddresses)
      .set({ isDefault: true })
      .where(and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId)))
      .returning();
    return result || undefined;
  }

  // Serviceable Pincodes
  async checkPincodeAvailability(pincode: string): Promise<ServiceablePincode | undefined> {
    const [result] = await db
      .select()
      .from(serviceablePincodes)
      .where(and(eq(serviceablePincodes.pincode, pincode), eq(serviceablePincodes.isActive, true)));
    return result || undefined;
  }

  async getServiceablePincodes(): Promise<ServiceablePincode[]> {
    return db.select().from(serviceablePincodes).orderBy(asc(serviceablePincodes.pincode));
  }

  async createServiceablePincode(pincode: InsertServiceablePincode): Promise<ServiceablePincode> {
    const [result] = await db.insert(serviceablePincodes).values(pincode).returning();
    return result;
  }

  async updateServiceablePincode(id: string, data: Partial<InsertServiceablePincode>): Promise<ServiceablePincode | undefined> {
    const [result] = await db.update(serviceablePincodes).set(data).where(eq(serviceablePincodes.id, id)).returning();
    return result || undefined;
  }

  async deleteServiceablePincode(id: string): Promise<boolean> {
    await db.delete(serviceablePincodes).where(eq(serviceablePincodes.id, id));
    return true;
  }

  // Return Requests
  async getReturnRequests(filters?: { userId?: string; status?: string }): Promise<ReturnRequestWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(returnRequests.userId, filters.userId));
    if (filters?.status) conditions.push(eq(returnRequests.status, filters.status as any));

    const requests = await db
      .select()
      .from(returnRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(returnRequests.createdAt));

    const result: ReturnRequestWithDetails[] = [];
    for (const request of requests) {
      const orderWithItems = await this.getOrder(request.orderId);
      const user = await this.getUser(request.userId);
      const items = await db
        .select()
        .from(returnItems)
        .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
        .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(returnItems.returnRequestId, request.id));

      const [refund] = await db.select().from(refunds).where(eq(refunds.returnRequestId, request.id));

      if (orderWithItems && user) {
        result.push({
          ...request,
          order: orderWithItems,
          user,
          items: items.map(item => ({
            ...item.return_items,
            orderItem: {
              ...item.order_items,
              saree: {
                ...item.sarees,
                category: item.categories,
                color: item.colors,
                fabric: item.fabrics,
              },
            },
          })),
          refund: refund || undefined,
        });
      }
    }
    return result;
  }

  async getReturnRequest(id: string): Promise<ReturnRequestWithDetails | undefined> {
    const [request] = await db.select().from(returnRequests).where(eq(returnRequests.id, id));
    if (!request) return undefined;

    const orderWithItems = await this.getOrder(request.orderId);
    const user = await this.getUser(request.userId);
    if (!orderWithItems || !user) return undefined;

    const items = await db
      .select()
      .from(returnItems)
      .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
      .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(returnItems.returnRequestId, request.id));

    const [refund] = await db.select().from(refunds).where(eq(refunds.returnRequestId, request.id));

    return {
      ...request,
      order: orderWithItems,
      user,
      items: items.map(item => ({
        ...item.return_items,
        orderItem: {
          ...item.order_items,
          saree: {
            ...item.sarees,
            category: item.categories,
            color: item.colors,
            fabric: item.fabrics,
          },
        },
      })),
      refund: refund || undefined,
    };
  }

  async createReturnRequest(request: InsertReturnRequest, items: InsertReturnItem[]): Promise<ReturnRequest> {
    return await db.transaction(async (tx) => {
      const [newRequest] = await tx.insert(returnRequests).values(request).returning();
      
      for (const item of items) {
        await tx.insert(returnItems).values({
          ...item,
          returnRequestId: newRequest.id,
        });
      }
      
      return newRequest;
    });
  }

  async updateReturnRequestStatus(id: string, status: string, processedBy?: string, adminNotes?: string): Promise<ReturnRequest | undefined> {
    const updateData: any = { status };
    if (processedBy) updateData.processedBy = processedBy;
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (status === "approved" || status === "rejected") {
      updateData.processedAt = new Date();
    }
    
    const [result] = await db.update(returnRequests).set(updateData).where(eq(returnRequests.id, id)).returning();
    return result || undefined;
  }

  async getUserReturnRequests(userId: string): Promise<ReturnRequestWithDetails[]> {
    return this.getReturnRequests({ userId });
  }

  async checkOrderReturnEligibility(orderId: string): Promise<{ eligible: boolean; reason?: string }> {
    const order = await this.getOrder(orderId);
    if (!order) return { eligible: false, reason: "Order not found" };
    if (order.status !== "delivered") return { eligible: false, reason: "Order must be delivered to initiate return" };
    
    // Handle missing return window - calculate from deliveredAt if available
    if (!order.returnEligibleUntil) {
      if (order.deliveredAt) {
        // Get return window setting, default to 7 days
        const windowDays = await this.getSetting("return_window_days");
        const days = windowDays ? parseInt(windowDays) : 7;
        const eligibleUntil = new Date(order.deliveredAt);
        eligibleUntil.setDate(eligibleUntil.getDate() + days);
        
        // Update the order with the calculated return window
        await db.update(orders).set({ returnEligibleUntil: eligibleUntil }).where(eq(orders.id, orderId));
        
        if (new Date() > eligibleUntil) {
          return { eligible: false, reason: "Return window has expired" };
        }
        return { eligible: true };
      }
      return { eligible: false, reason: "Return window not set - order delivery date missing" };
    }
    
    if (new Date() > new Date(order.returnEligibleUntil)) {
      return { eligible: false, reason: "Return window has expired" };
    }
    
    const existingReturns = await db
      .select()
      .from(returnRequests)
      .where(and(eq(returnRequests.orderId, orderId), inArray(returnRequests.status, ["requested", "approved", "in_transit", "inspection", "completed"])));
    
    if (existingReturns.length > 0) {
      return { eligible: false, reason: "A return request already exists for this order" };
    }
    
    return { eligible: true };
  }

  // Refunds
  async getRefunds(filters?: { userId?: string; status?: string }): Promise<Refund[]> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(refunds.userId, filters.userId));
    if (filters?.status) conditions.push(eq(refunds.status, filters.status as any));
    
    return db
      .select()
      .from(refunds)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(refunds.createdAt));
  }

  async getRefund(id: string): Promise<Refund | undefined> {
    const [result] = await db.select().from(refunds).where(eq(refunds.id, id));
    return result || undefined;
  }

  async createRefund(refund: InsertRefund): Promise<Refund> {
    const [result] = await db.insert(refunds).values(refund).returning();
    return result;
  }

  async updateRefundStatus(id: string, status: string, processedAt?: Date, transactionId?: string): Promise<Refund | undefined> {
    const updateData: any = { status };
    if (processedAt) updateData.processedAt = processedAt;
    if (transactionId) updateData.transactionId = transactionId;
    
    const [result] = await db.update(refunds).set(updateData).where(eq(refunds.id, id)).returning();
    return result || undefined;
  }

  async getRefundByReturnRequest(returnRequestId: string): Promise<Refund | undefined> {
    const [result] = await db.select().from(refunds).where(eq(refunds.returnRequestId, returnRequestId));
    return result || undefined;
  }

  // Product Reviews
  async getProductReviews(sareeId: string, filters?: { status?: string }): Promise<ProductReview[]> {
    const conditions = [eq(productReviews.sareeId, sareeId)];
    if (filters?.status) conditions.push(eq(productReviews.status, filters.status as any));
    
    return db
      .select()
      .from(productReviews)
      .where(and(...conditions))
      .orderBy(desc(productReviews.createdAt));
  }

  async getReview(id: string): Promise<ProductReview | undefined> {
    const [result] = await db.select().from(productReviews).where(eq(productReviews.id, id));
    return result || undefined;
  }

  async createReview(review: InsertProductReview): Promise<ProductReview> {
    const [result] = await db.insert(productReviews).values(review).returning();
    return result;
  }

  async updateReviewStatus(id: string, status: string): Promise<ProductReview | undefined> {
    const [result] = await db.update(productReviews).set({ status: status as any }).where(eq(productReviews.id, id)).returning();
    return result || undefined;
  }

  async getUserReviews(userId: string): Promise<ProductReview[]> {
    return db
      .select()
      .from(productReviews)
      .where(eq(productReviews.userId, userId))
      .orderBy(desc(productReviews.createdAt));
  }

  async getSareeWithReviews(sareeId: string): Promise<SareeWithReviews | undefined> {
    const saree = await this.getSaree(sareeId);
    if (!saree) return undefined;

    const reviews = await this.getProductReviews(sareeId, { status: "approved" });
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    return {
      ...saree,
      reviews,
      averageRating: avgRating,
      reviewCount: reviews.length,
    };
  }

  async canUserReviewProduct(userId: string, sareeId: string): Promise<boolean> {
    const deliveredOrders = await db
      .select()
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.userId, userId), eq(orders.status, "delivered"), eq(orderItems.sareeId, sareeId)));
    
    if (deliveredOrders.length === 0) return false;

    const existingReview = await db
      .select()
      .from(productReviews)
      .where(and(eq(productReviews.userId, userId), eq(productReviews.sareeId, sareeId)));
    
    return existingReview.length === 0;
  }

  async getAllReviews(filters?: { status?: string; limit?: number }): Promise<(ProductReview & { saree: SareeWithDetails })[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(productReviews.status, filters.status as any));
    
    const reviews = await db
      .select()
      .from(productReviews)
      .innerJoin(sarees, eq(productReviews.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(productReviews.createdAt))
      .limit(filters?.limit || 100);

    return reviews.map(row => ({
      ...row.product_reviews,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }

  // Coupons
  async getCoupons(filters?: { isActive?: boolean }): Promise<CouponWithUsage[]> {
    const conditions: any[] = [];
    if (filters?.isActive !== undefined) conditions.push(eq(coupons.isActive, filters.isActive));
    
    const couponList = await db
      .select()
      .from(coupons)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(coupons.createdAt));

    const result: CouponWithUsage[] = [];
    for (const coupon of couponList) {
      const [usage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsage)
        .where(eq(couponUsage.couponId, coupon.id));
      
      result.push({
        ...coupon,
        usageCount: usage?.count || 0,
      });
    }
    return result;
  }

  async getCoupon(id: string): Promise<Coupon | undefined> {
    const [result] = await db.select().from(coupons).where(eq(coupons.id, id));
    return result || undefined;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [result] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return result || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [result] = await db.insert(coupons).values({
      ...coupon,
      code: coupon.code.toUpperCase(),
    }).returning();
    return result;
  }

  async updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    if (data.code) data.code = data.code.toUpperCase();
    const [result] = await db.update(coupons).set(data).where(eq(coupons.id, id)).returning();
    return result || undefined;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    await db.update(coupons).set({ isActive: false }).where(eq(coupons.id, id));
    return true;
  }

  async validateCoupon(code: string, userId: string, orderAmount: number): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
    const coupon = await this.getCouponByCode(code);
    if (!coupon) return { valid: false, error: "Coupon not found" };
    if (!coupon.isActive) return { valid: false, error: "Coupon is not active" };
    
    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return { valid: false, error: "Coupon is not yet valid" };
    }
    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return { valid: false, error: "Coupon has expired" };
    }
    
    if (coupon.maxUsage) {
      const [totalUsage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsage)
        .where(eq(couponUsage.couponId, coupon.id));
      
      if (totalUsage && totalUsage.count >= coupon.maxUsage) {
        return { valid: false, error: "Coupon usage limit reached" };
      }
    }
    
    if (coupon.maxUsagePerUser) {
      const [userUsage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsage)
        .where(and(eq(couponUsage.couponId, coupon.id), eq(couponUsage.userId, userId)));
      
      if (userUsage && userUsage.count >= coupon.maxUsagePerUser) {
        return { valid: false, error: "You have already used this coupon the maximum number of times" };
      }
    }
    
    if (coupon.minOrderAmount && orderAmount < parseFloat(coupon.minOrderAmount)) {
      return { valid: false, error: `Minimum order amount of ₹${coupon.minOrderAmount} required` };
    }
    
    return { valid: true, coupon };
  }

  async applyCoupon(couponId: string, userId: string, orderId: string, discountAmount: string): Promise<CouponUsage> {
    const [result] = await db.insert(couponUsage).values({
      couponId,
      userId,
      orderId,
      discountAmount,
    }).returning();
    return result;
  }

  // Notifications
  async getNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) conditions.push(eq(notifications.isRead, false));
    
    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(notification).returning();
    return result;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [result] = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return result || undefined;
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return true;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result?.count || 0;
  }

  // Order Status History
  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    return db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(asc(orderStatusHistory.createdAt));
  }

  async addOrderStatusHistory(entry: InsertOrderStatusHistory): Promise<OrderStatusHistory> {
    const [result] = await db.insert(orderStatusHistory).values(entry).returning();
    return result;
  }

  async updateOrderWithStatusHistory(orderId: string, status: string, changedBy?: string, notes?: string): Promise<Order | undefined> {
    // Get return window setting for delivered orders
    let returnWindowDays = 7;
    if (status === "delivered") {
      const windowDays = await this.getSetting("return_window_days");
      if (windowDays) returnWindowDays = parseInt(windowDays);
    }
    
    return await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
      if (!order) return undefined;
      
      const updateData: any = { 
        status: status as any,
        updatedAt: new Date()
      };
      
      // Set deliveredAt and returnEligibleUntil when marking as delivered
      if (status === "delivered") {
        const now = new Date();
        updateData.deliveredAt = now;
        const eligibleUntil = new Date(now);
        eligibleUntil.setDate(eligibleUntil.getDate() + returnWindowDays);
        updateData.returnEligibleUntil = eligibleUntil;
      }
      
      const [updatedOrder] = await tx
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, orderId))
        .returning();
      
      await tx.insert(orderStatusHistory).values({
        orderId,
        status: status as any,
        note: notes,
        updatedBy: changedBy,
      });
      
      return updatedOrder || undefined;
    });
  }

  // App Settings
  async getSetting(key: string): Promise<string | null> {
    const [result] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return result?.value ?? null;
  }

  async setSetting(key: string, value: string, description?: string, updatedBy?: string): Promise<void> {
    await db
      .insert(appSettings)
      .values({ key, value, description, updatedBy, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, description, updatedBy, updatedAt: new Date() },
      });
  }

  async getAllSettings(): Promise<{ key: string; value: string; description: string | null; updatedAt: Date }[]> {
    return db.select({
      key: appSettings.key,
      value: appSettings.value,
      description: appSettings.description,
      updatedAt: appSettings.updatedAt,
    }).from(appSettings).orderBy(asc(appSettings.key));
  }
}

export const storage = new DatabaseStorage();
