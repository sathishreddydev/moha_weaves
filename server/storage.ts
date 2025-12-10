import {
  users,
  categories,
  colors,
  fabrics,
  stores,
  sarees,
  storeInventory,
  orders,
  orderItems,
  storeSales,
  storeSaleItems,
  stockRequests,
  serviceablePincodes,
  returnRequests,
  returnItems,
  refunds,
  productReviews,
  coupons,
  couponUsage,
  notifications,
  orderStatusHistory,
  appSettings,
  stockMovements,
  storeExchanges,
  storeExchangeReturnItems,
  storeExchangeNewItems,
  type User,
  type Store,
  type InsertStore,
  type Saree,
  type InsertSaree,
  type StoreInventory,
  type Order,
  type StoreSale,
  type InsertStoreSale,
  type InsertStoreSaleItem,
  type StockRequest,
  type InsertStockRequest,
  type ServiceablePincode,
  type InsertServiceablePincode,
  type ReturnRequest,
  type InsertReturnRequest,
  type InsertReturnItem,
  type Refund,
  type InsertRefund,
  type ProductReview,
  type InsertProductReview,
  type Coupon,
  type InsertCoupon,
  type CouponUsage,
  type InsertCouponUsage,
  type Notification,
  type InsertNotification,
  type OrderStatusHistory,
  type InsertOrderStatusHistory,
  type StockMovement,
  type SareeWithDetails,
  type CartItemWithSaree,
  type WishlistItemWithSaree,
  type OrderWithItems,
  type StockRequestWithDetails,
  type StoreSaleWithItems,
  type ReturnRequestWithDetails,
  type SareeWithReviews,
  type CouponWithUsage,
  type StoreExchangeWithDetails,
} from "@shared/schema";
import { db } from "./db";
import {
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  sql,
  gte,
  lte,
  inArray,
} from "drizzle-orm";
import { userService } from "./auth/authStorage";
import { orderService } from "./order/orderStorage";
import { storeService } from "./store/storeStorage";
import { sareeService } from "./saree/sareeStorage";

export interface IStorage {

  // Orders

  getAllOrders(filters?: {
    status?: string;
    limit?: number;
  }): Promise<OrderWithItems[]>;
  getOrdersPaginated(params: {
    page: number;
    pageSize: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: OrderWithItems[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  getUsersPaginated(params: {
    page: number;
    pageSize: number;
    role?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: Omit<User, "password">[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  getSareesPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    category?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: SareeWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;

  createSareeWithAllocations(
    saree: InsertSaree,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree>;
  updateSareeWithAllocations(
    id: string,
    data: Partial<InsertSaree>,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree | undefined>;
  getSareeAllocations(
    sareeId: string
  ): Promise<{ storeId: string; storeName: string; quantity: number }[]>;

  // Stock Distribution (centralized view)
  getStockDistribution(): Promise<
    {
      saree: SareeWithDetails;
      totalStock: number;
      onlineStock: number;
      storeAllocations: { store: Store; quantity: number }[];
      unallocated: number;
    }[]
  >;

  getStockRequests(filters?: {
    storeId?: string;
    status?: string;
  }): Promise<StockRequestWithDetails[]>;
  createStockRequest(request: InsertStockRequest): Promise<StockRequest>;
  updateStockRequestStatus(
    id: string,
    status: string,
    approvedBy?: string
  ): Promise<StockRequest | undefined>;

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

  // Serviceable Pincodes
  checkPincodeAvailability(
    pincode: string
  ): Promise<ServiceablePincode | undefined>;
  getServiceablePincodes(): Promise<ServiceablePincode[]>;
  createServiceablePincode(
    pincode: InsertServiceablePincode
  ): Promise<ServiceablePincode>;
  updateServiceablePincode(
    id: string,
    data: Partial<InsertServiceablePincode>
  ): Promise<ServiceablePincode | undefined>;
  deleteServiceablePincode(id: string): Promise<boolean>;

  // Return Requests
  getReturnRequests(filters?: {
    userId?: string;
    status?: string;
  }): Promise<ReturnRequestWithDetails[]>;
  getReturnRequest(id: string): Promise<ReturnRequestWithDetails | undefined>;
  createReturnRequest(
    request: InsertReturnRequest,
    items: InsertReturnItem[]
  ): Promise<ReturnRequest>;
  updateReturnRequestStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string
  ): Promise<ReturnRequest | undefined>;
  updateReturnRequest(
    id: string,
    data: Partial<InsertReturnRequest>
  ): Promise<ReturnRequest | undefined>;
  getUserReturnRequests(userId: string): Promise<ReturnRequestWithDetails[]>;
  checkOrderReturnEligibility(
    orderId: string
  ): Promise<{ eligible: boolean; reason?: string }>;

  // Refunds
  getRefunds(filters?: { userId?: string; status?: string }): Promise<Refund[]>;
  getRefund(id: string): Promise<Refund | undefined>;
  createRefund(refund: InsertRefund): Promise<Refund>;
  updateRefundStatus(
    id: string,
    status: string,
    processedAt?: Date,
    transactionId?: string
  ): Promise<Refund | undefined>;
  getRefundByReturnRequest(
    returnRequestId: string
  ): Promise<Refund | undefined>;

  // Product Reviews
  getProductReviews(
    sareeId: string,
    filters?: { approved?: boolean }
  ): Promise<ProductReview[]>;
  getReview(id: string): Promise<ProductReview | undefined>;
  createReview(review: InsertProductReview): Promise<ProductReview>;
  updateReviewApproval(
    id: string,
    isApproved: boolean
  ): Promise<ProductReview | undefined>;
  getUserReviews(userId: string): Promise<ProductReview[]>;
  getSareeWithReviews(sareeId: string): Promise<SareeWithReviews | undefined>;
  canUserReviewProduct(userId: string, sareeId: string): Promise<boolean>;
  getAllReviews(filters?: {
    approved?: boolean;
    limit?: number;
  }): Promise<(ProductReview & { saree: SareeWithDetails })[]>;

  // Notifications
  getNotifications(
    userId: string,
    unreadOnly?: boolean
  ): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Order Status History
  getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]>;
  addOrderStatusHistory(
    entry: InsertOrderStatusHistory
  ): Promise<OrderStatusHistory>;
  updateOrderWithStatusHistory(
    orderId: string,
    status: string,
    changedBy?: string,
    notes?: string
  ): Promise<Order | undefined>;

  // App Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(
    key: string,
    value: string,
    description?: string,
    updatedBy?: string
  ): Promise<void>;
  getAllSettings(): Promise<
    {
      key: string;
      value: string;
      description: string | null;
      updatedAt: Date;
    }[]
  >;

  // Stock Movement Stats
  getStockMovementStats(): Promise<{
    totalOnlineCleared: number;
    totalStoreCleared: number;
    onlineMovements: {
      sareeId: string;
      sareeName: string;
      quantity: number;
      orderRefId: string;
      createdAt: Date;
    }[];
    storeMovements: {
      sareeId: string;
      sareeName: string;
      quantity: number;
      orderRefId: string;
      storeId: string | null;
      storeName: string | null;
      createdAt: Date;
    }[];
  }>;

  getInventoryOverview(): Promise<{
    totalStock: number;
    onlineStock: number;
    storeStock: number;
    totalOnlineCleared: number;
    totalStoreCleared: number;
    products: {
      id: string;
      name: string;
      totalStock: number;
      onlineStock: number;
      storeStock: number;
    }[];
  }>;

  // Stock restoration from returns
  restoreStockFromReturn(
    sareeId: string,
    quantity: number,
    orderRefId: string
  ): Promise<void>;

  // Paginated methods for store sales and products
  getShopProductsPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      categoryId?: string;
      colorId?: string;
      fabricId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{
    data: { saree: SareeWithDetails; storeStock: number }[];
    total: number;
  }>;

  getStockMovements(filters?: {
    source?: string;
    sareeId?: string;
    limit?: number;
  }): Promise<StockMovement[]>;
}

export class DatabaseStorage implements IStorage {


 

  // Orders

  async getAllOrders(filters?: {
    status?: string;
    limit?: number;
  }): Promise<OrderWithItems[]> {
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

  async getOrdersPaginated(params: {
    page: number;
    pageSize: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: OrderWithItems[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize, status, search, dateFrom, dateTo } = params;
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];

    if (status) {
      conditions.push(eq(orders.status, status as any));
    }

    if (dateFrom) {
      conditions.push(gte(orders.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(orders.createdAt, new Date(dateTo)));
    }

    if (search) {
      conditions.push(ilike(orders.id, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const orderList = await db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

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

    return {
      data: result,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUsersPaginated(params: {
    page: number;
    pageSize: number;
    role?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: Omit<User, "password">[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize, role, search, dateFrom, dateTo } = params;
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];

    if (role) {
      conditions.push(eq(users.role, role as any));
    }

    if (dateFrom) {
      conditions.push(gte(users.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(users.createdAt, new Date(dateTo)));
    }

    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.phone, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const userList = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset);

    const safeUsers = userList.map(({ password, ...u }) => u);

    return {
      data: safeUsers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSareesPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    category?: string;
    color?: string;
    fabric?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: SareeWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const {
      page,
      pageSize,
      search,
      category,
      color,
      fabric,
      status,
      dateFrom,
      dateTo,
    } = params;
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [eq(sarees.isActive, true)];

    if (category) {
      conditions.push(eq(sarees.categoryId, category));
    }

    if (color) {
      conditions.push(eq(sarees.colorId, color));
    }

    if (fabric) {
      conditions.push(eq(sarees.fabricId, fabric));
    }

    if (status === "active") {
      conditions.push(eq(sarees.isActive, true));
    } else if (status === "inactive") {
      conditions.push(eq(sarees.isActive, false));
    }

    if (dateFrom) {
      conditions.push(gte(sarees.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(sarees.createdAt, new Date(dateTo)));
    }

    if (search) {
      conditions.push(
        or(
          ilike(sarees.name, `%${search}%`),
          ilike(sarees.sku, `%${search}%`),
          ilike(sarees.description, `%${search}%`)
        )
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sarees)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const result = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(whereClause)
      .orderBy(desc(sarees.createdAt))
      .limit(pageSize)
      .offset(offset);

    const sareeList = await Promise.all(
      result.map(async (row) => {
        // Get store allocations for this saree
        const allocations = await db
          .select({
            storeId: storeInventory.storeId,
            quantity: storeInventory.quantity,
          })
          .from(storeInventory)
          .where(eq(storeInventory.sareeId, row.sarees.id));

        // Get store details for each allocation
        const storeAllocations = await Promise.all(
          allocations.map(async (alloc) => {
            const [store] = await db
              .select()
              .from(stores)
              .where(eq(stores.id, alloc.storeId));
            return {
              storeId: alloc.storeId,
              storeName: store?.name || "Unknown",
              quantity: alloc.quantity,
            };
          })
        );

        // Calculate unallocated stock
        const totalStoreStock = storeAllocations.reduce(
          (sum, alloc) => sum + alloc.quantity,
          0
        );
        const unallocated = Math.max(
          0,
          row.sarees.totalStock - row.sarees.onlineStock - totalStoreStock
        );

        return {
          ...row.sarees,
          category: row.categories,
          color: row.colors,
          fabric: row.fabrics,
          storeAllocations,
          unallocated,
        };
      })
    );

    return {
      data: sareeList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async checkAndCreateStockAlert(sareeId: string): Promise<void> {
    const [saree] = await db
      .select()
      .from(sarees)
      .where(eq(sarees.id, sareeId));
    if (!saree) return;

    // Get threshold from settings, default to 10
    const thresholdSetting = await this.getSetting("low_stock_threshold");
    const threshold = thresholdSetting ? parseInt(thresholdSetting) : 10;

    // Alert if total stock is at or below threshold
    if (saree.totalStock <= threshold) {
      // Get all inventory role users to notify
      const inventoryUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "inventory"));

      for (const user of inventoryUsers) {
        // Check if alert already exists in last 24 hours
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [existingAlert] = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              eq(notifications.type, "system"),
              eq(notifications.relatedId, sareeId),
              gte(notifications.createdAt, dayAgo)
            )
          );

        if (!existingAlert) {
          await this.createNotification({
            userId: user.id,
            type: "system",
            title: "Low Stock Alert",
            message: `${saree.name} is running low on stock (${saree.totalStock} remaining). Please restock soon.`,
            relatedId: sareeId,
            relatedType: "saree",
          });
        }
      }
    }
  }
  async getStoreSalesPaginatedInventory(params: {
    page: number;
    pageSize: number;
    search?: string;
    storeId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: StoreSaleWithItems[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize, search, storeId, dateFrom, dateTo } = params;
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];

    if (search) {
      conditions.push(ilike(storeSales.id, `%${search}%`));
    }

    if (storeId) {
      conditions.push(eq(storeSales.storeId, storeId));
    }

    if (dateFrom) {
      conditions.push(gte(storeSales.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(storeSales.createdAt, new Date(dateTo)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(storeSales)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const salesList = await db
      .select()
      .from(storeSales)
      .innerJoin(stores, eq(storeSales.storeId, stores.id))
      .where(whereClause)
      .orderBy(desc(storeSales.createdAt))
      .limit(pageSize)
      .offset(offset);

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

    return {
      data: result,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateOrderStatus(
    id: string,
    status: string
  ): Promise<Order | undefined> {
    const updateData: any = {
      status: status as any,
      updatedAt: new Date(),
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

  async deductOnlineStock(sareeId: string, quantity: number): Promise<void> {
    const [saree] = await db
      .select()
      .from(sarees)
      .where(eq(sarees.id, sareeId));
    if (!saree) throw new Error("Saree not found");

    const newOnlineStock = saree.onlineStock - quantity;
    const newTotalStock = saree.totalStock - quantity;

    if (newOnlineStock < 0) {
      throw new Error("Insufficient online stock");
    }

    await db
      .update(sarees)
      .set({
        onlineStock: newOnlineStock,
        totalStock: newTotalStock,
      })
      .where(eq(sarees.id, sareeId));

    // Record stock movement
    await db.insert(stockMovements).values({
      sareeId,
      quantity: -quantity,
      movementType: "sale",
      source: "online",
      orderRefId: sareeId, // Use sareeId as reference when no specific order
      notes: "Online order stock deduction",
    });
  }

  // Saree with Store Allocations
  async createSareeWithAllocations(
    saree: InsertSaree,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree> {
    return await db.transaction(async (tx) => {
      const createdSaree = await sareeService.createSaree(saree);

      for (const allocation of storeAllocations) {
        await tx.insert(storeInventory).values({
          storeId: allocation.storeId,
          sareeId: createdSaree.id,
          quantity: allocation.quantity,
          updatedAt: new Date(),
        });
      }

      return createdSaree;
    });
  }

  async updateSareeWithAllocations(
    id: string,
    data: Partial<InsertSaree>,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree | undefined> {
    return await db.transaction(async (tx) => {
      const updatedSaree = await sareeService.updateSaree(id, data);
      if (!updatedSaree) return undefined;

      for (const allocation of storeAllocations) {
        const existing = await storeService.getStoreInventoryItem(
          allocation.storeId,
          id
        );
        if (existing) {
          await tx
            .update(storeInventory)
            .set({ quantity: allocation.quantity, updatedAt: new Date() })
            .where(
              and(
                eq(storeInventory.storeId, allocation.storeId),
                eq(storeInventory.sareeId, id)
              )
            );
        } else {
          await tx.insert(storeInventory).values({
            storeId: allocation.storeId,
            sareeId: id,
            quantity: allocation.quantity,
            updatedAt: new Date(),
          });
        }
      }

      return updatedSaree;
    });
  }

  async getSareeAllocations(
    sareeId: string
  ): Promise<{ storeId: string; storeName: string; quantity: number }[]> {
    const allocations = await db
      .select({
        storeId: storeInventory.storeId,
        quantity: storeInventory.quantity,
      })
      .from(storeInventory)
      .where(eq(storeInventory.sareeId, sareeId));

    const result = await Promise.all(
      allocations.map(async (alloc) => {
        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, alloc.storeId));
        return {
          storeId: alloc.storeId,
          storeName: store?.name || "Unknown",
          quantity: alloc.quantity,
        };
      })
    );

    return result;
  }

  async getStockDistribution(): Promise<
    {
      saree: SareeWithDetails;
      totalStock: number;
      onlineStock: number;
      storeAllocations: { store: Store; quantity: number }[];
      unallocated: number;
    }[]
  > {
    const allSarees = await sareeService.getSarees({ limit: 1000 });
    const result = [];

    for (const saree of allSarees) {
      const allocations = await db
        .select()
        .from(storeInventory)
        .innerJoin(stores, eq(storeInventory.storeId, stores.id))
        .where(eq(storeInventory.sareeId, saree.id));

      const storeAllocations = allocations.map((alloc) => ({
        store: alloc.stores,
        quantity: alloc.store_inventory.quantity,
      }));

      const totalStoreStock = storeAllocations.reduce(
        (sum, alloc) => sum + alloc.quantity,
        0
      );
      const unallocated = Math.max(
        0,
        saree.totalStock - saree.onlineStock - totalStoreStock
      );

      result.push({
        saree,
        totalStock: saree.totalStock,
        onlineStock: saree.onlineStock,
        storeAllocations,
        unallocated,
      });
    }

    return result;
  }

  // Stock Requests
  async getStockRequests(filters?: {
    storeId?: string;
    status?: string;
  }): Promise<StockRequestWithDetails[]> {
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

  async updateStockRequestStatus(
    id: string,
    status: string,
    approvedBy?: string
  ): Promise<StockRequest | undefined> {
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
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [sareeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sarees)
      .where(eq(sarees.isActive, true));
    const [orderCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders);
    const [revenueSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(orders)
      .where(eq(orders.status, "delivered"));
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.status, "pending"));
    const [lowStockCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sarees)
      .where(and(eq(sarees.isActive, true), lte(sarees.totalStock, 10)));

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
      .where(
        and(eq(storeSales.storeId, storeId), gte(storeSales.createdAt, today))
      );

    const [revenueSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(storeSales)
      .where(
        and(eq(storeSales.storeId, storeId), gte(storeSales.createdAt, today))
      );

    const [inventorySum] = await db
      .select({ sum: sql<number>`coalesce(sum(quantity), 0)::int` })
      .from(storeInventory)
      .where(eq(storeInventory.storeId, storeId));

    const [requestCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockRequests)
      .where(
        and(
          eq(stockRequests.storeId, storeId),
          eq(stockRequests.status, "pending")
        )
      );

    return {
      todaySales: salesCount?.count || 0,
      todayRevenue: revenueSum?.sum || 0,
      totalInventory: inventorySum?.sum || 0,
      pendingRequests: requestCount?.count || 0,
    };
  }

  // Serviceable Pincodes
  async checkPincodeAvailability(
    pincode: string
  ): Promise<ServiceablePincode | undefined> {
    const [result] = await db
      .select()
      .from(serviceablePincodes)
      .where(
        and(
          eq(serviceablePincodes.pincode, pincode),
          eq(serviceablePincodes.isActive, true)
        )
      );
    return result || undefined;
  }

  async getServiceablePincodes(): Promise<ServiceablePincode[]> {
    return db
      .select()
      .from(serviceablePincodes)
      .orderBy(asc(serviceablePincodes.pincode));
  }

  async createServiceablePincode(
    pincode: InsertServiceablePincode
  ): Promise<ServiceablePincode> {
    const [result] = await db
      .insert(serviceablePincodes)
      .values(pincode)
      .returning();
    return result;
  }

  async updateServiceablePincode(
    id: string,
    data: Partial<InsertServiceablePincode>
  ): Promise<ServiceablePincode | undefined> {
    const [result] = await db
      .update(serviceablePincodes)
      .set(data)
      .where(eq(serviceablePincodes.id, id))
      .returning();
    return result || undefined;
  }

  async deleteServiceablePincode(id: string): Promise<boolean> {
    await db.delete(serviceablePincodes).where(eq(serviceablePincodes.id, id));
    return true;
  }

  // Return Requests
  async getReturnRequests(filters?: {
    userId?: string;
    status?: string;
  }): Promise<ReturnRequestWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.userId)
      conditions.push(eq(returnRequests.userId, filters.userId));
    if (filters?.status)
      conditions.push(eq(returnRequests.status, filters.status as any));

    const requests = await db
      .select()
      .from(returnRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(returnRequests.createdAt));

    const result: ReturnRequestWithDetails[] = [];
    for (const request of requests) {
      const orderWithItems = await orderService.getOrder(request.orderId);
      const user = await userService.getUser(request.userId);
      const items = await db
        .select()
        .from(returnItems)
        .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
        .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(returnItems.returnRequestId, request.id));

      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.returnRequestId, request.id));

      if (orderWithItems && user) {
        result.push({
          ...request,
          order: orderWithItems,
          user,
          items: items.map((item) => ({
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

  async getReturnRequest(
    id: string
  ): Promise<ReturnRequestWithDetails | undefined> {
    const [request] = await db
      .select()
      .from(returnRequests)
      .where(eq(returnRequests.id, id));
    if (!request) return undefined;

    const orderWithItems = await orderService.getOrder(request.orderId);
    const user = await userService.getUser(request.userId);
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

    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.returnRequestId, request.id));

    return {
      ...request,
      order: orderWithItems,
      user,
      items: items.map((item) => ({
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

  async createReturnRequest(
    request: InsertReturnRequest,
    items: InsertReturnItem[]
  ): Promise<ReturnRequest> {
    return await db.transaction(async (tx) => {
      const [newRequest] = await tx
        .insert(returnRequests)
        .values(request)
        .returning();

      for (const item of items) {
        await tx.insert(returnItems).values({
          ...item,
          returnRequestId: newRequest.id,
        });
      }

      return newRequest;
    });
  }

  async updateReturnRequestStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string
  ): Promise<ReturnRequest | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (processedBy) updateData.processedBy = processedBy;
    if (inspectionNotes) updateData.inspectionNotes = inspectionNotes;

    const [result] = await db
      .update(returnRequests)
      .set(updateData)
      .where(eq(returnRequests.id, id))
      .returning();
    return result || undefined;
  }

  async updateReturnRequest(
    id: string,
    data: Partial<InsertReturnRequest>
  ): Promise<ReturnRequest | undefined> {
    const [result] = await db
      .update(returnRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(returnRequests.id, id))
      .returning();
    return result || undefined;
  }

  async getUserReturnRequests(
    userId: string
  ): Promise<ReturnRequestWithDetails[]> {
    return this.getReturnRequests({ userId });
  }

  async checkOrderReturnEligibility(
    orderId: string
  ): Promise<{ eligible: boolean; reason?: string }> {
    const order = await orderService.getOrder(orderId);
    if (!order) return { eligible: false, reason: "Order not found" };
    if (order.status !== "delivered")
      return {
        eligible: false,
        reason: "Order must be delivered to initiate return",
      };

    // Handle missing return window - calculate from deliveredAt if available
    if (!order.returnEligibleUntil) {
      if (order.deliveredAt) {
        // Get return window setting, default to 7 days
        const windowDays = await this.getSetting("return_window_days");
        const days = windowDays ? parseInt(windowDays) : 7;
        const eligibleUntil = new Date(order.deliveredAt);
        eligibleUntil.setDate(eligibleUntil.getDate() + days);

        // Update the order with the calculated return window
        await db
          .update(orders)
          .set({ returnEligibleUntil: eligibleUntil })
          .where(eq(orders.id, orderId));

        if (new Date() > eligibleUntil) {
          return { eligible: false, reason: "Return window has expired" };
        }
        return { eligible: true };
      }
      return {
        eligible: false,
        reason: "Return window not set - order delivery date missing",
      };
    }

    if (new Date() > new Date(order.returnEligibleUntil)) {
      return { eligible: false, reason: "Return window has expired" };
    }

    const existingReturns = await db
      .select()
      .from(returnRequests)
      .where(
        and(
          eq(returnRequests.orderId, orderId),
          inArray(returnRequests.status, [
            "requested",
            "approved",
            "pickup_scheduled",
            "picked_up",
            "received",
            "inspected",
            "completed",
          ])
        )
      );

    if (existingReturns.length > 0) {
      return {
        eligible: false,
        reason: "A return request already exists for this order",
      };
    }

    return { eligible: true };
  }

  // Refunds
  async getRefunds(filters?: {
    userId?: string;
    status?: string;
  }): Promise<Refund[]> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(refunds.userId, filters.userId));
    if (filters?.status)
      conditions.push(eq(refunds.status, filters.status as any));

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

  async updateRefundStatus(
    id: string,
    status: string,
    processedAt?: Date,
    transactionId?: string
  ): Promise<Refund | undefined> {
    const updateData: any = { status };
    if (processedAt) updateData.processedAt = processedAt;
    if (transactionId) updateData.transactionId = transactionId;

    const [result] = await db
      .update(refunds)
      .set(updateData)
      .where(eq(refunds.id, id))
      .returning();
    return result || undefined;
  }

  async getRefundByReturnRequest(
    returnRequestId: string
  ): Promise<Refund | undefined> {
    const [result] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.returnRequestId, returnRequestId));
    return result || undefined;
  }

  // Product Reviews
  async getProductReviews(
    sareeId: string,
    filters?: { approved?: boolean }
  ): Promise<ProductReview[]> {
    const conditions = [eq(productReviews.sareeId, sareeId)];
    if (filters?.approved !== undefined)
      conditions.push(eq(productReviews.isApproved, filters.approved));

    return db
      .select()
      .from(productReviews)
      .where(and(...conditions))
      .orderBy(desc(productReviews.createdAt));
  }

  async getReview(id: string): Promise<ProductReview | undefined> {
    const [result] = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.id, id));
    return result || undefined;
  }

  async createReview(review: InsertProductReview): Promise<ProductReview> {
    const [result] = await db.insert(productReviews).values(review).returning();
    return result;
  }

  async updateReviewApproval(
    id: string,
    isApproved: boolean
  ): Promise<ProductReview | undefined> {
    const [result] = await db
      .update(productReviews)
      .set({ isApproved })
      .where(eq(productReviews.id, id))
      .returning();
    return result || undefined;
  }

  async getUserReviews(userId: string): Promise<ProductReview[]> {
    return db
      .select()
      .from(productReviews)
      .where(eq(productReviews.userId, userId))
      .orderBy(desc(productReviews.createdAt));
  }

  async getSareeWithReviews(
    sareeId: string
  ): Promise<SareeWithReviews | undefined> {
    const saree = await sareeService.getSaree(sareeId);
    if (!saree) return undefined;

    const reviews = await this.getProductReviews(sareeId, { approved: true });
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      ...saree,
      reviews,
      averageRating: avgRating,
      reviewCount: reviews.length,
    };
  }

  async canUserReviewProduct(
    userId: string,
    sareeId: string
  ): Promise<boolean> {
    const deliveredOrders = await db
      .select()
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.status, "delivered"),
          eq(orderItems.sareeId, sareeId)
        )
      );

    if (deliveredOrders.length === 0) return false;

    const existingReview = await db
      .select()
      .from(productReviews)
      .where(
        and(
          eq(productReviews.userId, userId),
          eq(productReviews.sareeId, sareeId)
        )
      );

    return existingReview.length === 0;
  }

  async getAllReviews(filters?: {
    approved?: boolean;
    limit?: number;
  }): Promise<(ProductReview & { saree: SareeWithDetails })[]> {
    const conditions: any[] = [];
    if (filters?.approved !== undefined)
      conditions.push(eq(productReviews.isApproved, filters.approved));

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

    return reviews.map((row) => ({
      ...row.product_reviews,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }

  // Notifications
  async getNotifications(
    userId: string,
    unreadOnly?: boolean
  ): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) conditions.push(eq(notifications.isRead, false));

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(
    notification: InsertNotification
  ): Promise<Notification> {
    const [result] = await db
      .insert(notifications)
      .values(notification)
      .returning();
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
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );
    return true;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );
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

  async addOrderStatusHistory(
    entry: InsertOrderStatusHistory
  ): Promise<OrderStatusHistory> {
    const [result] = await db
      .insert(orderStatusHistory)
      .values(entry)
      .returning();
    return result;
  }

  async updateOrderWithStatusHistory(
    orderId: string,
    status: string,
    changedBy?: string,
    notes?: string
  ): Promise<Order | undefined> {
    // Get return window setting for delivered orders
    let returnWindowDays = 7;
    if (status === "delivered") {
      const windowDays = await this.getSetting("return_window_days");
      if (windowDays) returnWindowDays = parseInt(windowDays);
    }

    return await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId));
      if (!order) return undefined;

      const updateData: any = {
        status: status as any,
        updatedAt: new Date(),
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
    const [result] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key));
    return result?.value ?? null;
  }

  async setSetting(
    key: string,
    value: string,
    description?: string,
    updatedBy?: string
  ): Promise<void> {
    await db
      .insert(appSettings)
      .values({ key, value, description, updatedBy, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, description, updatedBy, updatedAt: new Date() },
      });
  }

  async getAllSettings(): Promise<
    {
      key: string;
      value: string;
      description: string | null;
      updatedAt: Date;
    }[]
  > {
    return db
      .select({
        key: appSettings.key,
        value: appSettings.value,
        description: appSettings.description,
        updatedAt: appSettings.updatedAt,
      })
      .from(appSettings)
      .orderBy(asc(appSettings.key));
  }

  // Stock Movement Stats
  async getStockMovementStats(): Promise<{
    totalOnlineCleared: number;
    totalStoreCleared: number;
    onlineMovements: {
      sareeId: string;
      sareeName: string;
      quantity: number;
      orderRefId: string;
      createdAt: Date;
    }[];
    storeMovements: {
      sareeId: string;
      sareeName: string;
      quantity: number;
      orderRefId: string;
      storeId: string | null;
      storeName: string | null;
      createdAt: Date;
    }[];
  }> {
    // Get total stock cleared from online sales only (sales are stored as negative values, so we use ABS)
    // Filter by movementType = 'sale' to only count actual sales, not returns
    const [onlineTotal] = await db
      .select({
        sum: sql<number>`COALESCE(ABS(SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END)), 0)::int`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.source, "online"));

    // Get total stock cleared from store sales only
    const [storeTotal] = await db
      .select({
        sum: sql<number>`COALESCE(ABS(SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END)), 0)::int`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.source, "store"));

    // Get detailed online movements (sales only, convert negative to positive for display)
    const onlineMovements = await db
      .select({
        sareeId: stockMovements.sareeId,
        sareeName: sarees.name,
        quantity: sql<number>`ABS(${stockMovements.quantity})::int`,
        orderRefId: stockMovements.orderRefId,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(sarees, eq(stockMovements.sareeId, sarees.id))
      .where(
        and(
          eq(stockMovements.source, "online"),
          eq(stockMovements.movementType, "sale")
        )
      )
      .orderBy(desc(stockMovements.createdAt));

    // Get detailed store movements (sales only, convert negative to positive for display)
    const storeMovements = await db
      .select({
        sareeId: stockMovements.sareeId,
        sareeName: sarees.name,
        quantity: sql<number>`ABS(${stockMovements.quantity})::int`,
        orderRefId: stockMovements.orderRefId,
        storeId: stockMovements.storeId,
        storeName: stores.name,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(sarees, eq(stockMovements.sareeId, sarees.id))
      .leftJoin(stores, eq(stockMovements.storeId, stores.id))
      .where(
        and(
          eq(stockMovements.source, "store"),
          eq(stockMovements.movementType, "sale")
        )
      )
      .orderBy(desc(stockMovements.createdAt));

    return {
      totalOnlineCleared: onlineTotal?.sum || 0,
      totalStoreCleared: storeTotal?.sum || 0,
      onlineMovements,
      storeMovements,
    };
  }

  async getInventoryOverview(): Promise<{
    totalStock: number;
    onlineStock: number;
    storeStock: number;
    totalOnlineCleared: number;
    totalStoreCleared: number;
    products: {
      id: string;
      name: string;
      totalStock: number;
      onlineStock: number;
      storeStock: number;
    }[];
  }> {
    // Get aggregated stock levels
    const [stockTotals] = await db
      .select({
        totalStock: sql<number>`COALESCE(SUM(total_stock), 0)::int`,
        onlineStock: sql<number>`COALESCE(SUM(online_stock), 0)::int`,
      })
      .from(sarees)
      .where(eq(sarees.isActive, true));

    // Get store inventory total
    const [storeStockTotal] = await db
      .select({ sum: sql<number>`COALESCE(SUM(quantity), 0)::int` })
      .from(storeInventory);

    // Get stock cleared totals (sales are stored as negative values, so we use ABS and filter by sale type)
    const [onlineCleared] = await db
      .select({
        sum: sql<number>`COALESCE(ABS(SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END)), 0)::int`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.source, "online"));

    const [storeCleared] = await db
      .select({
        sum: sql<number>`COALESCE(ABS(SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END)), 0)::int`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.source, "store"));

    // Get per-product stock breakdown
    const products = await db
      .select({
        id: sarees.id,
        name: sarees.name,
        totalStock: sarees.totalStock,
        onlineStock: sarees.onlineStock,
        storeStock: sql<number>`COALESCE((
          SELECT SUM(quantity) FROM store_inventory WHERE saree_id = ${sarees.id}
        ), 0)::int`,
      })
      .from(sarees)
      .where(eq(sarees.isActive, true))
      .orderBy(sarees.name);

    return {
      totalStock: stockTotals?.totalStock || 0,
      onlineStock: stockTotals?.onlineStock || 0,
      storeStock: storeStockTotal?.sum || 0,
      totalOnlineCleared: onlineCleared?.sum || 0,
      totalStoreCleared: storeCleared?.sum || 0,
      products,
    };
  }

  async getStockMovements(filters?: {
    source?: string;
    sareeId?: string;
    limit?: number;
  }): Promise<StockMovement[]> {
    const conditions = [];

    if (filters?.source) {
      conditions.push(
        eq(stockMovements.source, filters.source as "online" | "store")
      );
    }
    if (filters?.sareeId) {
      conditions.push(eq(stockMovements.sareeId, filters.sareeId));
    }

    let query = db
      .select()
      .from(stockMovements)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockMovements.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    return query;
  }

  async restoreStockFromReturn(
    sareeId: string,
    quantity: number,
    orderRefId: string
  ): Promise<void> {
    // Add stock back to total stock and online stock (assuming returns are processed centrally)
    await db
      .update(sarees)
      .set({
        totalStock: sql`${sarees.totalStock} + ${quantity}`,
        onlineStock: sql`${sarees.onlineStock} + ${quantity}`,
      })
      .where(eq(sarees.id, sareeId));

    // Record stock movement (positive quantity for stock addition)
    await db.insert(stockMovements).values({
      sareeId,
      quantity, // Positive value to show stock increase
      movementType: "return",
      source: "online", // Assuming central processing
      orderRefId: orderRefId,
      notes: "Stock restored from return",
    });
  }

  async getAllStoreExchanges(
    limit?: number
  ): Promise<StoreExchangeWithDetails[]> {
    const exchangesList = await db
      .select()
      .from(storeExchanges)
      .leftJoin(stores, eq(storeExchanges.storeId, stores.id))
      .leftJoin(users, eq(storeExchanges.processedBy, users.id))
      .orderBy(desc(storeExchanges.createdAt))
      .limit(limit || 100);

    const result: StoreExchangeWithDetails[] = [];

    for (const exchange of exchangesList) {
      const originalSale = await storeService.getStoreSaleForExchange(
        exchange.store_exchanges.originalSaleId
      );

      const returnItemsList = await db
        .select()
        .from(storeExchangeReturnItems)
        .leftJoin(sarees, eq(storeExchangeReturnItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(
          eq(storeExchangeReturnItems.exchangeId, exchange.store_exchanges.id)
        );

      const newItemsList = await db
        .select()
        .from(storeExchangeNewItems)
        .leftJoin(sarees, eq(storeExchangeNewItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(
          eq(storeExchangeNewItems.exchangeId, exchange.store_exchanges.id)
        );

      result.push({
        ...exchange.store_exchanges,
        store: exchange.stores!,
        originalSale: originalSale!,
        processor: exchange.users!,
        returnItems: returnItemsList.map((item) => ({
          ...item.store_exchange_return_items,
          saree: {
            ...item.sarees!,
            category: item.categories,
            color: item.colors,
            fabric: item.fabrics,
          },
        })),
        newItems: newItemsList.map((item) => ({
          ...item.store_exchange_new_items,
          saree: {
            ...item.sarees!,
            category: item.categories,
            color: item.colors,
            fabric: item.fabrics,
          },
        })),
      });
    }

    return result;
  }

  async getShopProductsPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      categoryId?: string;
      colorId?: string;
      fabricId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{
    data: { saree: SareeWithDetails; storeStock: number }[];
    total: number;
  }> {
    const conditions = [eq(storeInventory.storeId, storeId)];

    // Filter by search term (product name or SKU)
    if (options.search) {
      conditions.push(
        or(
          ilike(sarees.name, `%${options.search}%`),
          ilike(sarees.sku, `%${options.search}%`)
        )!
      );
    }

    // Filter by category
    if (options.categoryId) {
      conditions.push(eq(sarees.categoryId, options.categoryId));
    }

    // Filter by color
    if (options.colorId) {
      conditions.push(eq(sarees.colorId, options.colorId));
    }

    // Filter by fabric
    if (options.fabricId) {
      conditions.push(eq(sarees.fabricId, options.fabricId));
    }

    // Date filters (based on product creation date)
    if (options.dateFrom) {
      conditions.push(gte(sarees.createdAt, new Date(options.dateFrom)));
    }

    if (options.dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(options.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(sarees.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    const [allSarees, countResult] = await Promise.all([
      db
        .select()
        .from(storeInventory)
        .innerJoin(sarees, eq(storeInventory.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(whereClause)
        .orderBy(desc(sarees.createdAt))
        .limit(options.limit)
        .offset(options.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeInventory)
        .innerJoin(sarees, eq(storeInventory.sareeId, sarees.id))
        .where(whereClause),
    ]);

    const data = allSarees.map((row) => ({
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
      storeStock: row.store_inventory.quantity,
    }));

    return {
      data,
      total: countResult[0]?.count || 0,
    };
  }
}

export const storage = new DatabaseStorage();
