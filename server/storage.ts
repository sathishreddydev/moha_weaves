import {
  appSettings,
  categories,
  colors,
  fabrics,
  itemStatusHistory,
  notifications,
  orderItems,
  orders,
  productReviews,
  products,
  productVariants,
  refunds,
  serviceablePincodes,
  stockMovements,
  stockRequests,
  storeExchangeNewItems,
  storeExchangeReturnItems,
  storeExchanges,
  storeInventory,
  stores,
  storeSaleItems,
  storeSales,
  users,
  type InsertNotification,
  type InsertRefund,
  type InsertServiceablePincode,
  type InsertStockRequest,
  type ItemStatusHistory,
  type Notification,
  type Order,
  type OrderWithItems,
  type Refund,
  type ServiceablePincode,
  type StockMovement,
  type StockRequest,
  type StockRequestWithDetails,
  type Store,
  type StoreExchangeWithDetails,
  type StoreSaleWithItems,
  type User
} from "@shared/schema";

import { db } from "./db";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  lte,
  or,
  sql,inArray
} from "drizzle-orm";

import { storeService } from "./store/storeStorage";
import { roleBasedProductService } from "./product/roleBasedProductService";

export type ReviewWithUser = Omit<

  typeof productReviews.$inferSelect,

  "userId"

> & {

  user: {

    id: string;

    name: string;

  };

};



export interface StockMovementWithDetails extends StockMovement {

  productName?: string;

  storeName?: string | null;

}



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



  getStockDistribution(): Promise<{

    summary: {

      totalProducts: number;

      totalStock: number;

      onlineStock: number;

      storeAllocations: { store: Store; quantity: number }[];

      unallocated: number;

    };

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



  // Advanced Analytics

  getInventoryTurnover(): Promise<{

    productId: string;

    productName: string;

    sku: string;

    totalStock: number;

    averageStock: number;

    costOfGoodsSold: number;

    turnoverRatio: number;

    daysOfSupply: number;

    category: string;

  }[]>;



  getABCAnalysis(): Promise<{

    class: 'A' | 'B' | 'C';

    productId: string;

    productName: string;

    sku: string;

    revenueContribution: number;

    cumulativeRevenue: number;

    revenuePercentage: number;

    quantitySold: number;

    currentStock: number;

    category: string;

  }[]>;



  getSeasonalTrends(): Promise<{

    productId: string;

    productName: string;

    category: string;

    monthlyData: {

      month: string;

      year: number;

      quantity: number;

      revenue: number;

    }[];

    trend: 'increasing' | 'decreasing' | 'stable' | 'seasonal';

    seasonalityIndex: number;

    peakMonths: string[];

  }[]>;



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

  }): Promise<StockMovementWithDetails[]>;



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

        .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))

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

            variants: row.product_variants ? [row.product_variants] : undefined,

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



    const safeUsers = userList.map(({ ...u }) => u);



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



  async getStockDistribution(): Promise<{

    summary: {

      totalProducts: number;

      totalStock: number;

      onlineStock: number;

      storeAllocated: number;

      storeAllocations: { store: Store; quantity: number }[];

      unallocated: number;

    };

    // products: {

    //   product: ProductWithDetails;

    //   totalStock: number;

    //   onlineStock: number;

    //   storeAllocations: { store: Store; quantity: number }[];

    //   unallocated: number;

    // }[];

  }> {

    // MIGRATED: Use role-based service for analytics (admin access)

    const allProducts = await roleBasedProductService.getProductsByRole({ limit: 1000 }, "admin");



    const totalProducts = allProducts.length;



    let totalStock = 0;

    let onlineStock = 0;

    let totalStoreStock = 0;



    const summaryStoreMap = new Map<

      string,

      { store: Store; quantity: number }

    >();



    const productsDistribution = [];



    for (const product of allProducts) {

      totalStock += product.totalStock;

      onlineStock += product.onlineStock;



      const allocations = await db

        .select()

        .from(storeInventory)

        .innerJoin(stores, eq(storeInventory.storeId, stores.id))

        .where(eq(storeInventory.productId, product.id));



      const productStoreAllocations = allocations.map((alloc) => ({

        store: alloc.stores,

        quantity: alloc.store_inventory.quantity,

      }));



      const productStoreStock = productStoreAllocations.reduce(

        (sum, alloc) => sum + alloc.quantity,

        0,

      );



      const productUnallocated = Math.max(

        0,

        product.totalStock - product.onlineStock - productStoreStock,

      );



      // accumulate summary store allocations

      for (const alloc of productStoreAllocations) {

        totalStoreStock += alloc.quantity;



        if (summaryStoreMap.has(alloc.store.id)) {

          summaryStoreMap.get(alloc.store.id)!.quantity += alloc.quantity;

        } else {

          summaryStoreMap.set(alloc.store.id, {

            store: alloc.store,

            quantity: alloc.quantity,

          });

        }

      }



      productsDistribution.push({

        product,

        totalStock: product.totalStock,

        onlineStock: product.onlineStock,

        storeAllocations: productStoreAllocations,

        unallocated: productUnallocated,

      });

    }



    const summaryStoreAllocations = Array.from(summaryStoreMap.values());



    const unallocated = Math.max(0, totalStock - onlineStock - totalStoreStock);



    return {

      summary: {

        totalProducts,

        totalStock,

        onlineStock,

        storeAllocated: totalStoreStock,

        storeAllocations: summaryStoreAllocations,

        unallocated,

      },

      // products: productsDistribution,

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

  }): Promise<StockMovementWithDetails[]> {

    const conditions = [];



    if (filters?.source) {

      conditions.push(

        eq(stockMovements.source, filters.source as "online" | "store"),

      );

    }

    if (filters?.productId) {

      conditions.push(eq(stockMovements.productId, filters.productId));

    }



    const query = db

      .select({

        id: stockMovements.id,

        productId: stockMovements.productId,

        quantity: stockMovements.quantity,

        movementType: stockMovements.movementType,

        source: stockMovements.source,

        orderRefId: stockMovements.orderRefId,

        storeId: stockMovements.storeId,

        notes: stockMovements.notes,

        createdAt: stockMovements.createdAt,

        productName: products.name,

        storeName: stores.name || undefined,

      })

      .from(stockMovements)

      .innerJoin(products, eq(stockMovements.productId, products.id))

      .leftJoin(stores, eq(stockMovements.storeId, stores.id))

      .where(conditions.length > 0 ? and(...conditions) : undefined)

      .orderBy(desc(stockMovements.createdAt));



    if (filters?.limit) {

      return query.limit(filters.limit) as any;

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



  // Advanced Analytics Implementation

  async getInventoryTurnover(): Promise<{

    productId: string;

    productName: string;

    sku: string;

    totalStock: number;

    averageStock: number;

    costOfGoodsSold: number;

    turnoverRatio: number;

    daysOfSupply: number;

    category: string;

  }[]> {

    // Get sales data for the last 12 months

    const twelveMonthsAgo = new Date();

    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);



    const salesData = await db

      .select({

        productId: stockMovements.productId,

        quantity: sql<number>`ABS(SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END))::int`,

        revenue: sql<number>`SUM(CASE WHEN movement_type = 'sale' THEN ABS(quantity) * ${products.price} ELSE 0 END)::decimal(10,2)`,

      })

      .from(stockMovements)

      .innerJoin(products, eq(stockMovements.productId, products.id))

      .where(

        and(

          eq(stockMovements.movementType, 'sale'),

          gte(stockMovements.createdAt, twelveMonthsAgo)

        )

      )

      .groupBy(stockMovements.productId);



    // Get current stock data

    const currentStock = await db

      .select({

        productId: products.id,

        productName: products.name,

        sku: products.sku,

        totalStock: products.totalStock,

        category: categories.name,

      })

      .from(products)

      .leftJoin(categories, eq(products.categoryId, categories.id))

      .where(gt(products.totalStock, 0));



    // Calculate turnover metrics

    const turnoverData = currentStock.map(product => {

      const sales = salesData.find(s => s.productId === product.productId);

      const quantitySold = sales?.quantity || 0;

      const revenue = Number(sales?.revenue || 0);

      const averageStock = product.totalStock > 0 ? product.totalStock : 1; // Avoid division by zero

      const costOfGoodsSold = revenue * 0.7; // Assuming 70% COGS (you may want to track actual cost)

      const turnoverRatio = averageStock > 0 ? (costOfGoodsSold / averageStock) : 0;

      const daysOfSupply = quantitySold > 0 ? (product.totalStock / quantitySold) * 365 : 999;



      return {

        productId: product.productId,

        productName: product.productName,

        sku: product.sku || '',

        totalStock: product.totalStock,

        averageStock,

        costOfGoodsSold,

        turnoverRatio: Math.round(turnoverRatio * 100) / 100,

        daysOfSupply: Math.round(daysOfSupply),

        category: product.category || 'Uncategorized',

      };

    });



    return turnoverData.sort((a, b) => b.turnoverRatio - a.turnoverRatio);

  }



  async getABCAnalysis(): Promise<{

    class: 'A' | 'B' | 'C';

    productId: string;

    productName: string;

    sku: string;

    revenueContribution: number;

    cumulativeRevenue: number;

    revenuePercentage: number;

    quantitySold: number;

    currentStock: number;

    category: string;

  }[]> {

    // Get sales data for the last 12 months

    const twelveMonthsAgo = new Date();

    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);



    const salesData = await db

      .select({

        productId: stockMovements.productId,

        productName: products.name,

        sku: products.sku,

        quantity: sql<number>`ABS(SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END))::int`,

        revenue: sql<number>`SUM(CASE WHEN movement_type = 'sale' THEN ABS(quantity) * ${products.price} ELSE 0 END)::decimal(10,2)`,

        category: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,

        currentStock: products.totalStock,

      })

      .from(stockMovements)

      .innerJoin(products, eq(stockMovements.productId, products.id))

      .leftJoin(categories, eq(products.categoryId, categories.id))

      .where(

        and(

          eq(stockMovements.movementType, 'sale'),

          gte(stockMovements.createdAt, twelveMonthsAgo)

        )

      )

      .groupBy(stockMovements.productId, products.name, products.sku, categories.name, products.totalStock)

      .having(sql`ABS(SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END)) > 0`);



    if (salesData.length === 0) return [];



    // Sort by revenue (descending)

    salesData.sort((a, b) => Number(b.revenue) - Number(a.revenue));



    // Calculate total revenue

    const totalRevenue = salesData.reduce((sum, item) => sum + Number(item.revenue), 0);



    // Calculate cumulative revenue and assign ABC classes

    let cumulativeRevenue = 0;

    const abcData = salesData.map((item) => {

      const revenue = Number(item.revenue);

      cumulativeRevenue += revenue;

      const revenuePercentage = (revenue / totalRevenue) * 100;

      const cumulativePercentage = (cumulativeRevenue / totalRevenue) * 100;



      let abcClass: 'A' | 'B' | 'C';

      if (cumulativePercentage <= 80) {

        abcClass = 'A';

      } else if (cumulativePercentage <= 95) {

        abcClass = 'B';

      } else {

        abcClass = 'C';

      }



      return {

        class: abcClass,

        productId: item.productId,

        productName: item.productName,

        sku: item.sku || '',

        revenueContribution: revenue,

        cumulativeRevenue,

        revenuePercentage: Math.round(revenuePercentage * 100) / 100,

        quantitySold: item.quantity,

        currentStock: item.currentStock,

        category: item.category,

      };

    });



    return abcData;

  }



  async getSeasonalTrends(): Promise<{

    productId: string;

    productName: string;

    category: string;

    monthlyData: {

      month: string;

      year: number;

      quantity: number;

      revenue: number;

    }[];

    trend: 'increasing' | 'decreasing' | 'stable' | 'seasonal';

    seasonalityIndex: number;

    peakMonths: string[];

  }[]> {

    // Get monthly sales data for the last 24 months

    const twentyFourMonthsAgo = new Date();

    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);



    const monthlySales = await db

      .select({

        productId: stockMovements.productId,

        productName: products.name,

        category: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,

        month: sql<string>`TO_CHAR(${stockMovements.createdAt}, 'YYYY-MM')`,

        year: sql<number>`EXTRACT(YEAR FROM ${stockMovements.createdAt})::int`,

        quantity: sql<number>`ABS(SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END))::int`,

        revenue: sql<number>`SUM(CASE WHEN movement_type = 'sale' THEN ABS(quantity) * ${products.price} ELSE 0 END)::decimal(10,2)`,

      })

      .from(stockMovements)

      .innerJoin(products, eq(stockMovements.productId, products.id))

      .leftJoin(categories, eq(products.categoryId, categories.id))

      .where(

        and(

          eq(stockMovements.movementType, 'sale'),

          gte(stockMovements.createdAt, twentyFourMonthsAgo)

        )

      )

      .groupBy(

        stockMovements.productId,

        products.name,

        categories.name,

        sql`TO_CHAR(${stockMovements.createdAt}, 'YYYY-MM')`,

        sql`EXTRACT(YEAR FROM ${stockMovements.createdAt})`

      )

      .orderBy(

        stockMovements.productId,

        sql`TO_CHAR(${stockMovements.createdAt}, 'YYYY-MM')`

      );



    // Group by product and analyze trends

    const productGroups = monthlySales.reduce((groups, sale) => {

      if (!groups[sale.productId]) {

        groups[sale.productId] = {

          productId: sale.productId,

          productName: sale.productName,

          category: sale.category,

          monthlyData: [],

        };

      }

      groups[sale.productId].monthlyData.push({

        month: sale.month,

        year: sale.year,

        quantity: sale.quantity,

        revenue: Number(sale.revenue),

      });

      return groups;

    }, {} as Record<string, any>);



    // Analyze trends for each product

    const trendsData = Object.values(productGroups).map((product: any) => {

      const monthlyData = product.monthlyData;



      // Calculate trend using linear regression on quantities

      const n = monthlyData.length;

      if (n < 3) {

        return {

          ...product,

          trend: 'stable' as const,

          seasonalityIndex: 0,

          peakMonths: [],

        };

      }



      // Simple linear regression to determine trend

      const xValues: number[] = [];

      const yValues: number[] = [];



      for (let i = 0; i < monthlyData.length; i++) {

        xValues.push(i);

        yValues.push(monthlyData[i].quantity);

      }



      const xMean = xValues.reduce((a: number, b: number) => a + b, 0) / n;

      const yMean = yValues.reduce((a: number, b: number) => a + b, 0) / n;



      let numerator = 0;

      for (let i = 0; i < xValues.length; i++) {

        numerator += (xValues[i] - xMean) * (yValues[i] - yMean);

      }



      const denominator = xValues.reduce((sum: number, x: number) => sum + Math.pow(x - xMean, 2), 0);



      const slope = denominator !== 0 ? numerator / denominator : 0;



      // Determine trend

      let trend: 'increasing' | 'decreasing' | 'stable' | 'seasonal';

      if (Math.abs(slope) < 0.5) {

        trend = 'stable';

      } else if (slope > 0) {

        trend = 'increasing';

      } else {

        trend = 'decreasing';

      }



      // Calculate seasonality (simplified - looking for monthly patterns)

      const monthlyAverages = new Map<string, number>();

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];



      monthlyData.forEach((data: any) => {

        const month = new Date(data.month + '-01').getMonth();

        const monthName = monthNames[month];

        if (!monthlyAverages.has(monthName)) {

          monthlyAverages.set(monthName, 0);

        }

        monthlyAverages.set(monthName, monthlyAverages.get(monthName)! + data.quantity);

      });

      // Average the monthly totals across years
      const yearsOfData = new Set(monthlyData.map((d: any) => d.year)).size;

      monthlyAverages.forEach((total, month) => {

        monthlyAverages.set(month, total / yearsOfData);

      });



      // Calculate seasonality index (coefficient of variation)

      const avgMonthly = Array.from(monthlyAverages.values()).reduce((a, b) => a + b, 0) / 12;

      const variance = Array.from(monthlyAverages.values()).reduce((sum, val) => sum + Math.pow(val - avgMonthly, 2), 0) / 12;

      const stdDev = Math.sqrt(variance);

      const seasonalityIndex = avgMonthly > 0 ? (stdDev / avgMonthly) * 100 : 0;



      // Find peak months (months with sales > 20% above average)

      const peakMonths = Array.from(monthlyAverages.entries())

        .filter(([, avg]) => avg > avgMonthly * 1.2)

        .map(([month]) => month);



      // If high seasonality, mark as seasonal

      if (seasonalityIndex > 30) {

        trend = 'seasonal';

      }



      return {

        ...product,

        trend,

        seasonalityIndex: Math.round(seasonalityIndex),

        peakMonths,

      };

    });



    return trendsData;

  }

}



export const storage = new DatabaseStorage();

