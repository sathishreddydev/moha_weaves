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
  refunds,
  productReviews,
  notifications,
  itemStatusHistory,
  appSettings,
  stockMovements,
  storeExchanges,
  storeExchangeReturnItems,
  storeExchangeNewItems,
  sales,
  saleProducts,
  type User,
  type Store,
  type Order,
  type StockRequest,
  type InsertStockRequest,
  type ServiceablePincode,
  type InsertServiceablePincode,
  type Refund,
  type InsertRefund,
  type Notification,
  type InsertNotification,
  type ItemStatusHistory,
  type InsertItemStatusHistory,
  type StockMovement,
  type SareeWithDetails,
  type OrderWithItems,
  type StockRequestWithDetails,
  type StoreSaleWithItems,
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
  lt,
  inArray,
  count,
} from "drizzle-orm";
import { userService } from "./auth/authStorage";
import { orderService } from "./order/orderStorage";
import { storeService } from "./store/storeStorage";
import { sareeService } from "./saree/sareeStorage";
export type ReviewWithUser = Omit<
  typeof productReviews.$inferSelect,
  "userId"
> & {
  user: {
    id: string;
    name: string;
  };
};

export interface IStorage {
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

  updateOrderTrackingNumber(
    id: string,
    trackingNumber: string | null | undefined,
  ): Promise<Order | undefined>;

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
  getStockRequest(id: string): Promise<StockRequestWithDetails | undefined>;
  createStockRequest(request: InsertStockRequest): Promise<StockRequest>;
  updateStockRequestStatus(
    id: string,
    status: string,
    approvedBy?: string,
    notes?: string,
  ): Promise<StockRequest | undefined>;

  getStoreStats(storeId: string): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalInventory: number;
    pendingRequests: number;
  }>;

  // Serviceable Pincodes
  checkPincodeAvailability(
    pincode: string,
  ): Promise<ServiceablePincode | undefined>;
  getServiceablePincodes(): Promise<ServiceablePincode[]>;
  createServiceablePincode(
    pincode: InsertServiceablePincode,
  ): Promise<ServiceablePincode>;
  updateServiceablePincode(
    id: string,
    data: Partial<InsertServiceablePincode>,
  ): Promise<ServiceablePincode | undefined>;
  deleteServiceablePincode(id: string): Promise<boolean>;

  // Refunds
  getRefunds(filters?: { userId?: string; status?: string }): Promise<Refund[]>;
  getRefund(id: string): Promise<Refund | undefined>;
  createRefund(refund: InsertRefund): Promise<Refund>;
  getRefundByReturnRequest(
    returnRequestId: string,
  ): Promise<Refund | undefined>;

  // Notifications
  getNotifications(
    userId: string,
    unreadOnly?: boolean,
  ): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // App Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(
    key: string,
    value: string,
    description?: string,
    updatedBy?: string,
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
    orderRefId: string,
  ): Promise<void>;

  // Paginated methods for store sales and products
  getShopProductsPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      category?: string;
      color?: string;
      fabric?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{
    data: { saree: SareeWithDetails; storeStock: number }[];
    total: number;
  }>;

  getStockMovements(filters?: {
    source?: string;
    sareeId?: string;
    limit?: number;
  }): Promise<StockMovement[]>;

  // Item status history tracking
  itemHistory(
    orderItemId: string,
    currentStatus: string,
    newStatus: string,
    note: string,
    updatedBy?: string,
  ): Promise<void>;
}

export class DatabaseStorage implements IStorage {
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
      .innerJoin(users, eq(orders.userId, users.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    const result: OrderWithItems[] = [];

    for (const order of orderList) {
      const customerName = order.users.name;

      const items = await db
        .select()
        .from(orderItems)
        .innerJoin(sarees, eq(orderItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(orderItems.orderId, order.orders.id));

      result.push({
        ...order.orders,
        customerName,

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
          ilike(users.phone, `%${search}%`),
        ),
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
          ilike(sarees.description, `%${search}%`),
        ),
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
          }),
        );

        // Calculate unallocated stock
        const totalStoreStock = storeAllocations.reduce(
          (sum, alloc) => sum + alloc.quantity,
          0,
        );
        const unallocated = Math.max(
          0,
          row.sarees.totalStock - row.sarees.onlineStock - totalStoreStock,
        );

        return {
          ...row.sarees,
          category: row.categories,
          color: row.colors,
          fabric: row.fabrics,
          storeAllocations,
          unallocated,
        };
      }),
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
              gte(notifications.createdAt, dayAgo),
            ),
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
    status: string,
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

  async updateOrderTrackingNumber(
    id: string,
    trackingNumber: string | null | undefined,
  ): Promise<Order | undefined> {
    const [result] = await db
      .update(orders)
      .set({
        trackingNumber: trackingNumber ?? null,
        updatedAt: new Date(),
      })
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
        0,
      );
      const unallocated = Math.max(
        0,
        saree.totalStock - saree.onlineStock - totalStoreStock,
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

  async getStockRequestsPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ data: StockRequestWithDetails[]; total: number }> {
    const conditions = [eq(stockRequests.storeId, storeId)];

    if (options.status) {
      conditions.push(eq(stockRequests.status, options.status as any));
    }

    if (options.search) {
      conditions.push(
        or(
          ilike(sarees.name, `%${options.search}%`),
          ilike(sarees.sku, `%${options.search}%`),
          ilike(stockRequests.notes, `%${options.search}%`)
        )!
      );
    }

    if (options.dateFrom) {
      conditions.push(gte(stockRequests.createdAt, new Date(options.dateFrom)));
    }

    if (options.dateTo) {
      conditions.push(lte(stockRequests.createdAt, new Date(options.dateTo)));
    }

    const countResult = await db
      .select({ count: count() })
      .from(stockRequests)
      .innerJoin(sarees, eq(stockRequests.sareeId, sarees.id))
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    // Get paginated data
    const result = await db
      .select()
      .from(stockRequests)
      .innerJoin(stores, eq(stockRequests.storeId, stores.id))
      .innerJoin(sarees, eq(stockRequests.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(and(...conditions))
      .orderBy(desc(stockRequests.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    const results = result.map((row) => ({
      ...row.stock_requests,
      store: row.stores,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));

    return {
      data: results,
      total: countResult[0]?.count || 0,
    };
  }

  async getStockRequest(
    id: string,
  ): Promise<StockRequestWithDetails | undefined> {
    const result = await db
      .select()
      .from(stockRequests)
      .innerJoin(stores, eq(stockRequests.storeId, stores.id))
      .innerJoin(sarees, eq(stockRequests.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(stockRequests.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      ...row.stock_requests,
      store: row.stores,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    };
  }

  async createStockRequest(request: InsertStockRequest): Promise<StockRequest> {
    const [result] = await db.insert(stockRequests).values(request).returning();
    return result;
  }

  async updateStockRequestStatus(
    id: string,
    status: string,
    approvedBy?: string,
    notes?: string,
  ): Promise<StockRequest | undefined> {
    const updateData: any = { status: status as any, updatedAt: new Date() };
    if (approvedBy) {
      updateData.approvedBy = approvedBy;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const [result] = await db
      .update(stockRequests)
      .set(updateData)
      .where(eq(stockRequests.id, id))
      .returning();
    return result || undefined;
  }

  async getStoreStats(storeId: string): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalInventory: number;
    pendingRequests: number;
    totalSales?: number;
    totalRevenue?: number;
    weeklySalesGrowth?: number;
    monthlyRevenueGrowth?: number;
    topSellingProducts?: Array<{
      saree: SareeWithDetails;
      quantity: number;
      revenue: number;
    }>;
    lowStockProducts?: Array<{
      saree: SareeWithDetails;
      currentStock: number;
      reorderLevel: number;
    }>;
    recentSales?: StoreSaleWithItems[];
    recentRequests?: StockRequestWithDetails[];
    recentExchanges?: StoreExchangeWithDetails[];
    requestStats?: {
      pending: number;
      approved: number;
      dispatched: number;
      received: number;
    };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate dates for comparisons
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Basic stats
    const [salesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales)
      .where(
        and(eq(storeSales.storeId, storeId), gte(storeSales.createdAt, today)),
      );

    const [revenueSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(storeSales)
      .where(
        and(eq(storeSales.storeId, storeId), gte(storeSales.createdAt, today)),
      );

    // Total sales and revenue (all time)
    const [totalSalesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales)
      .where(eq(storeSales.storeId, storeId));

    const [totalRevenueSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(storeSales)
      .where(eq(storeSales.storeId, storeId));

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
          eq(stockRequests.status, "pending"),
        ),
      );

    // Weekly sales growth
    const [thisWeekSales] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales)
      .where(
        and(
          eq(storeSales.storeId, storeId),
          gte(
            storeSales.createdAt,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          ),
        ),
      );

    const [lastWeekSales] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales)
      .where(
        and(
          eq(storeSales.storeId, storeId),
          gte(
            storeSales.createdAt,
            new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          ),
          lt(
            storeSales.createdAt,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          ),
        ),
      );

    // Monthly revenue growth
    const [thisMonthRevenue] = await db
      .select({
        sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(storeSales)
      .where(
        and(
          eq(storeSales.storeId, storeId),
          gte(
            storeSales.createdAt,
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          ),
        ),
      );

    const [lastMonthRevenue] = await db
      .select({
        sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(storeSales)
      .where(
        and(
          eq(storeSales.storeId, storeId),
          gte(
            storeSales.createdAt,
            new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          ),
          lt(
            storeSales.createdAt,
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          ),
        ),
      );

    // Top selling products (last 30 days)
    const topProductsQuery = await db
      .select({
        sareeId: storeSaleItems.sareeId,
        totalQuantity: sql<number>`sum(${storeSaleItems.quantity})::int`,
        totalRevenue: sql<number>`sum(${storeSaleItems.quantity}::numeric * ${storeSaleItems.price}::numeric)::float`,
      })
      .from(storeSaleItems)
      .innerJoin(storeSales, eq(storeSaleItems.saleId, storeSales.id))
      .where(
        and(
          eq(storeSales.storeId, storeId),
          gte(
            storeSales.createdAt,
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .groupBy(storeSaleItems.sareeId)
      .orderBy(sql`sum(${storeSaleItems.quantity}) DESC`)
      .limit(5);

    // Low stock products - simplified query
    const REORDER_LEVEL = 5;
    const lowStockProductsData = await db
      .select()
      .from(storeInventory)
      .innerJoin(sarees, eq(storeInventory.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(
        and(
          eq(storeInventory.storeId, storeId),
          lte(storeInventory.quantity, REORDER_LEVEL),
        ),
      )
      .orderBy(storeInventory.quantity)
      .limit(10);

    const lowStockProducts = lowStockProductsData.map((row) => ({
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
      currentStock: row.store_inventory.quantity,
      reorderLevel: REORDER_LEVEL,
    }));

    // Simplified recent data for now
    const recentSales: StoreSaleWithItems[] = [];
    const recentRequests: StockRequestWithDetails[] = [];
    const recentExchanges: StoreExchangeWithDetails[] = [];

    // Request status breakdown
    const [pendingStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockRequests)
      .where(
        and(
          eq(stockRequests.storeId, storeId),
          eq(stockRequests.status, "pending"),
        ),
      );

    const [approvedStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockRequests)
      .where(
        and(
          eq(stockRequests.storeId, storeId),
          eq(stockRequests.status, "approved"),
        ),
      );

    const [dispatchedStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockRequests)
      .where(
        and(
          eq(stockRequests.storeId, storeId),
          eq(stockRequests.status, "dispatched"),
        ),
      );

    const [receivedStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockRequests)
      .where(
        and(
          eq(stockRequests.storeId, storeId),
          eq(stockRequests.status, "received"),
        ),
      );

    // Calculate growth percentages
    const weeklySalesGrowth =
      lastWeekSales.count > 0
        ? ((thisWeekSales.count - lastWeekSales.count) / lastWeekSales.count) *
          100
        : 0;

    const monthlyRevenueGrowth =
      lastMonthRevenue.sum > 0
        ? ((thisMonthRevenue.sum - lastMonthRevenue.sum) /
            lastMonthRevenue.sum) *
          100
        : 0;

    return {
      todaySales: salesCount?.count || 0,
      todayRevenue: revenueSum?.sum || 0,
      totalInventory: inventorySum?.sum || 0,
      pendingRequests: requestCount?.count || 0,
      totalSales: totalSalesCount?.count || 0,
      totalRevenue: totalRevenueSum?.sum || 0,
      weeklySalesGrowth: Math.round(weeklySalesGrowth * 10) / 10, // Round to 1 decimal
      monthlyRevenueGrowth: Math.round(monthlyRevenueGrowth * 10) / 10,
      lowStockProducts,
      recentSales,
      recentRequests,
      recentExchanges,
      requestStats: {
        pending: pendingStats?.count || 0,
        approved: approvedStats?.count || 0,
        dispatched: dispatchedStats?.count || 0,
        received: receivedStats?.count || 0,
      },
    };
  }

  // Serviceable Pincodes
  async checkPincodeAvailability(
    pincode: string,
  ): Promise<ServiceablePincode | undefined> {
    const [result] = await db
      .select()
      .from(serviceablePincodes)
      .where(
        and(
          eq(serviceablePincodes.pincode, pincode),
          eq(serviceablePincodes.isActive, true),
        ),
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
    pincode: InsertServiceablePincode,
  ): Promise<ServiceablePincode> {
    const [result] = await db
      .insert(serviceablePincodes)
      .values(pincode)
      .returning();
    return result;
  }

  async updateServiceablePincode(
    id: string,
    data: Partial<InsertServiceablePincode>,
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

  // Refunds
  async getRefunds(filters?: {
    userId?: string;
    status?: string;
  }): Promise<Refund[]> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(refunds.userId, filters.userId));
    if (filters?.status)
      conditions.push(eq(refunds.status, filters.status as any));

    const query = db
      .select({
        id: refunds.id,
        returnRequestId: refunds.returnRequestId,
        orderId: refunds.orderId,
        userId: refunds.userId,
        amount: refunds.amount,
        status: refunds.status,
        refundMethod: refunds.refundMethod,
        razorpayRefundId: refunds.razorpayRefundId,
        razorpayPaymentId: refunds.razorpayPaymentId,
        reason: refunds.reason,
        processedBy: refunds.processedBy,
        initiatedAt: refunds.initiatedAt,
        completedAt: refunds.completedAt,
        failureReason: refunds.failureReason,
        retryCount: refunds.retryCount,
        createdAt: refunds.createdAt,
      })
      .from(refunds);

    const queryWithWhere =
      conditions.length > 0 ? query.where(and(...conditions)) : query;

    return queryWithWhere.orderBy(desc(refunds.createdAt));
  }

  async getRefund(id: string): Promise<Refund | undefined> {
    const [result] = await db.select().from(refunds).where(eq(refunds.id, id));
    return result || undefined;
  }

  async createRefund(refund: InsertRefund): Promise<Refund> {
    const [result] = await db.insert(refunds).values(refund).returning();
    return result;
  }

  async getRefundByReturnRequest(
    returnRequestId: string,
  ): Promise<Refund | undefined> {
    const [result] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.returnRequestId, returnRequestId));
    return result || undefined;
  }

  // Notifications
  async getNotifications(
    userId: string,
    unreadOnly?: boolean,
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
    notification: InsertNotification,
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
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
    return true;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
    return result?.count || 0;
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
    updatedBy?: string,
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
          eq(stockMovements.movementType, "sale"),
        ),
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
          eq(stockMovements.movementType, "sale"),
        ),
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
        eq(stockMovements.source, filters.source as "online" | "store"),
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
    orderRefId: string,
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
    limit?: number,
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
        exchange.store_exchanges.originalSaleId,
      );

      const returnItemsList = await db
        .select()
        .from(storeExchangeReturnItems)
        .leftJoin(sarees, eq(storeExchangeReturnItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(
          eq(storeExchangeReturnItems.exchangeId, exchange.store_exchanges.id),
        );

      const newItemsList = await db
        .select()
        .from(storeExchangeNewItems)
        .leftJoin(sarees, eq(storeExchangeNewItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(
          eq(storeExchangeNewItems.exchangeId, exchange.store_exchanges.id),
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
    },
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
          ilike(sarees.sku, `%${options.search}%`),
        )!,
      );
    }

    // Filter by category ID
    if (options.categoryId) {
      conditions.push(eq(sarees.categoryId, options.categoryId));
    }

    // Filter by color ID
    if (options.colorId) {
      conditions.push(eq(sarees.colorId, options.colorId));
    }

    // Filter by fabric ID
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

    // Fetch active sales
    const now = new Date();
    const activeSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now),
        ),
      );

    // Fetch sale product mappings
    const saleProductMappings = await db.select().from(saleProducts);

    const data = allSarees.map((row) => {
      const saree = row.sarees;

      // Find applicable sale
      let applicableSale = null;
      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.sareeId === saree.id,
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId,
        );
      }
      // Only exclude category pricing when THIS saree is explicitly mapped to a different sale
      if (!applicableSale && saree.categoryId) {
        applicableSale = activeSales.find(
          (s) =>
            s.categoryId === saree.categoryId &&
            !saleProductMappings.some(
              (sp) => sp.saleId === s.id && sp.sareeId === saree.id,
            ),
        );
      }

      // Calculate discounted price using consistent logic across all flows
      let discountedPrice = parseFloat(saree.price);
      if (applicableSale) {
        const originalPrice = discountedPrice;
        if (
          applicableSale.offerType === "percentage" ||
          applicableSale.offerType === "category" ||
          applicableSale.offerType === "flash_sale"
        ) {
          const discount =
            originalPrice * (parseFloat(applicableSale.discountValue) / 100);
          const maxDiscount = applicableSale.maxDiscount
            ? parseFloat(applicableSale.maxDiscount)
            : originalPrice; // Cap at price if no maxDiscount
          discountedPrice =
            originalPrice - Math.min(discount, maxDiscount, originalPrice);
        } else if (
          applicableSale.offerType === "flat" ||
          applicableSale.offerType === "product"
        ) {
          const flatDiscount = Math.min(
            parseFloat(applicableSale.discountValue),
            originalPrice,
          );
          discountedPrice = originalPrice - flatDiscount;
        }
        discountedPrice = Math.max(0, discountedPrice);
      }

      return {
        saree: {
          ...saree,
          category: row.categories,
          color: row.colors,
          fabric: row.fabrics,
          activeSale: applicableSale
            ? {
                id: applicableSale.id,
                name: applicableSale.name,
                offerType: applicableSale.offerType,
                discountValue: applicableSale.discountValue,
                maxDiscount: applicableSale.maxDiscount || undefined,
              }
            : null,
          discountedPrice: applicableSale ? discountedPrice : undefined,
        },
        storeStock: row.store_inventory.quantity,
      };
    });

    return {
      data,
      total: countResult[0]?.count || 0,
    };
  }

  async getItemStatusHistory(orderId: string): Promise<ItemStatusHistory[]> {
    return await db
      .select({
        id: itemStatusHistory.id,
        orderItemId: itemStatusHistory.orderItemId,
        status: itemStatusHistory.status,
        newStatus: itemStatusHistory.newStatus,
        note: itemStatusHistory.note,
        updatedBy: itemStatusHistory.updatedBy,
        createdAt: itemStatusHistory.createdAt,
      })
      .from(itemStatusHistory)
      .innerJoin(orderItems, eq(itemStatusHistory.orderItemId, orderItems.id))
      .where(eq(orderItems.orderId, orderId))
      .orderBy(desc(itemStatusHistory.createdAt));
  }

  async itemHistory(
    orderItemId: string,
    currentStatus: string,
    newStatus: string,
    note: string,
    updatedBy?: string,
  ): Promise<void> {
    await db.insert(itemStatusHistory).values({
      orderItemId,
      status: currentStatus,
      newStatus,
      note,
      updatedBy,
      createdAt: new Date(),
    });
  }
}

export const storage = new DatabaseStorage();
