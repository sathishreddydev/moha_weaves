import {
  users,
  categories,
  subcategories,
  colors,
  fabrics,
  stores,
  products,
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
  type ProductWithDetails,
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
import { productService } from "./product/productStorage";
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
  
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;

  updateOrderTrackingNumber(
    id: string,
    trackingNumber: string | null | undefined,
  ): Promise<Order | undefined>;

  // Stock Distribution (centralized view)
  getStockDistribution(): Promise<
    {
      product: ProductWithDetails;
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
      productId: string;
      productName: string;
      quantity: number;
      orderRefId: string;
      createdAt: Date;
    }[];
    storeMovements: {
      productId: string;
      productName: string;
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
    productId: string,
    quantity: number,
    orderRefId: string,
  ): Promise<void>;

  getStockMovements(filters?: {
    source?: string;
    productId?: string;
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
        .innerJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .where(eq(orderItems.orderId, order.id));

      result.push({
        ...order,
        items: items.map((row) => ({
          ...row.order_items,
          product: {
            ...row.products,
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
        .innerJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .where(eq(orderItems.orderId, order.orders.id));

      result.push({
        ...order.orders,
        customerName,

        items: items.map((row) => ({
          ...row.order_items,
          product: {
            ...row.products,
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



  async checkAndCreateStockAlert(productId: string): Promise<void> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));
    if (!product) return;

    // Get threshold from settings, default to 10
    const thresholdSetting = await this.getSetting("low_stock_threshold");
    const threshold = thresholdSetting ? parseInt(thresholdSetting) : 10;

    // Alert if total stock is at or below threshold
    if (product.totalStock <= threshold) {
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
              eq(notifications.relatedId, productId),
              gte(notifications.createdAt, dayAgo),
            ),
          );

        if (!existingAlert) {
          await this.createNotification({
            userId: user.id,
            type: "system",
            title: "Low Stock Alert",
            message: `${product.name} is running low on stock (${product.totalStock} remaining). Please restock soon.`,
            relatedId: productId,
            relatedType: "product",
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
        .innerJoin(products, eq(storeSaleItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .where(eq(storeSaleItems.saleId, row.store_sales.id));

      result.push({
        ...row.store_sales,
        store: row.stores,
        items: items.map((itemRow) => ({
          ...itemRow.store_sale_items,
          product: {
            ...itemRow.products,
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

  async deductOnlineStock(productId: string, quantity: number): Promise<void> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));
    if (!product) throw new Error("product not found");

    const newOnlineStock = product.onlineStock - quantity;
    const newTotalStock = product.totalStock - quantity;

    if (newOnlineStock < 0) {
      throw new Error("Insufficient online stock");
    }

    await db
      .update(products)
      .set({
        onlineStock: newOnlineStock,
        totalStock: newTotalStock,
      })
      .where(eq(products.id, productId));

    // Record stock movement
    await db.insert(stockMovements).values({
      productId,
      quantity: -quantity,
      movementType: "sale",
      source: "online",
      orderRefId: productId, // Use productId as reference when no specific order
      notes: "Online order stock deduction",
    });
  }

  async getStockDistribution(): Promise<
    {
      product: ProductWithDetails;
      totalStock: number;
      onlineStock: number;
      storeAllocations: { store: Store; quantity: number }[];
      unallocated: number;
    }[]
  > {
    const allProducts = await productService.getProducts({ limit: 1000 });
    const result = [];

    for (const product of allProducts) {
      const allocations = await db
        .select()
        .from(storeInventory)
        .innerJoin(stores, eq(storeInventory.storeId, stores.id))
        .where(eq(storeInventory.productId, product.id));

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
        product.totalStock - product.onlineStock - totalStoreStock,
      );

      result.push({
        product,
        totalStock: product.totalStock,
        onlineStock: product.onlineStock,
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
      .innerJoin(products, eq(stockRequests.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockRequests.createdAt));

    return result.map((row) => ({
      ...row.stock_requests,
      store: row.stores,
      product: {
        ...row.products,
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
    },
  ): Promise<{ data: StockRequestWithDetails[]; total: number }> {
    const conditions = [eq(stockRequests.storeId, storeId)];

    if (options.status) {
      conditions.push(eq(stockRequests.status, options.status as any));
    }

    if (options.search) {
      conditions.push(
        or(
          ilike(products.name, `%${options.search}%`),
          ilike(products.sku, `%${options.search}%`),
          ilike(stockRequests.notes, `%${options.search}%`),
        )!,
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
      .innerJoin(products, eq(stockRequests.productId, products.id))
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    // Get paginated data
    const result = await db
      .select()
      .from(stockRequests)
      .innerJoin(stores, eq(stockRequests.storeId, stores.id))
      .innerJoin(products, eq(stockRequests.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(and(...conditions))
      .orderBy(desc(stockRequests.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    const results = result.map((row) => ({
      ...row.stock_requests,
      store: row.stores,
      product: {
        ...row.products,
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
      .innerJoin(products, eq(stockRequests.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(eq(stockRequests.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      ...row.stock_requests,
      store: row.stores,
      product: {
        ...row.products,
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
      productId: string;
      productName: string;
      quantity: number;
      orderRefId: string;
      createdAt: Date;
    }[];
    storeMovements: {
      productId: string;
      productName: string;
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
        productId: stockMovements.productId,
        productName: products.name,
        quantity: sql<number>`ABS(${stockMovements.quantity})::int`,
        orderRefId: stockMovements.orderRefId,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
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
        productId: stockMovements.productId,
        productName: products.name,
        quantity: sql<number>`ABS(${stockMovements.quantity})::int`,
        orderRefId: stockMovements.orderRefId,
        storeId: stockMovements.storeId,
        storeName: stores.name,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
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
      .from(products)
      .where(eq(products.isActive, true));

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
    const productsData = await db
      .select({
        id: products.id,
        name: products.name,
        totalStock: products.totalStock,
        onlineStock: products.onlineStock,
        storeStock: sql<number>`COALESCE((
          SELECT SUM(quantity) FROM store_inventory WHERE product_id = ${products.id}
        ), 0)::int`,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name);

    return {
      totalStock: stockTotals?.totalStock || 0,
      onlineStock: stockTotals?.onlineStock || 0,
      storeStock: storeStockTotal?.sum || 0,
      totalOnlineCleared: onlineCleared?.sum || 0,
      totalStoreCleared: storeCleared?.sum || 0,
      products: productsData,
    };
  }

  async getStockMovements(filters?: {
    source?: string;
    productId?: string;
    limit?: number;
  }): Promise<StockMovement[]> {
    const conditions = [];

    if (filters?.source) {
      conditions.push(
        eq(stockMovements.source, filters.source as "online" | "store"),
      );
    }
    if (filters?.productId) {
      conditions.push(eq(stockMovements.productId, filters.productId));
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
    productId: string,
    quantity: number,
    orderRefId: string,
  ): Promise<void> {
    // Add stock back to total stock and online stock (assuming returns are processed centrally)
    await db
      .update(products)
      .set({
        totalStock: sql`${products.totalStock} + ${quantity}`,
        onlineStock: sql`${products.onlineStock} + ${quantity}`,
      })
      .where(eq(products.id, productId));

    // Record stock movement (positive quantity for stock addition)
    await db.insert(stockMovements).values({
      productId,
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
        .leftJoin(products, eq(storeExchangeReturnItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .where(
          eq(storeExchangeReturnItems.exchangeId, exchange.store_exchanges.id),
        );

      const newItemsList = await db
        .select()
        .from(storeExchangeNewItems)
        .leftJoin(products, eq(storeExchangeNewItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
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
          product: {
            ...item.products!,
            category: item.categories,
            color: item.colors,
            fabric: item.fabrics,
          },
        })),
        newItems: newItemsList.map((item) => ({
          ...item.store_exchange_new_items,
          product: {
            ...item.products!,
            category: item.categories,
            color: item.colors,
            fabric: item.fabrics,
          },
        })),
      });
    }

    return result;
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
