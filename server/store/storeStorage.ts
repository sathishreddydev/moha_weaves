import {
  Store,
  stores,
  InsertStore,
  categories,
  colors,
  fabrics,
  sarees,
  stockMovements,
  storeInventory,
  StoreSale,
  storeSaleItems,
  storeSales,
  StoreSaleWithItems,
  storeExchangeReturnItems,
  InsertStoreExchange,
  InsertStoreExchangeNewItem,
  InsertStoreExchangeReturnItem,
  StoreExchange,
  storeExchangeNewItems,
  storeExchanges,
  StoreExchangeWithDetails,
  users,
  SareeWithDetails,
  StoreInventory,
  sales,
  saleProducts,
  storeCart,
  StoreCartItem,
  coupons,
  Coupon,
  couponUsage,
} from "@shared/schema";
import { and, desc, eq, gte, gt, ilike, lte, sql } from "drizzle-orm";
import { db } from "server/db";

export interface StoreStorage {
  // Stores
  getStores(): Promise<Store[]>;
  getStore(id: string): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(
    id: string,
    data: Partial<InsertStore>,
  ): Promise<Store | undefined>;

  createStoreSale(
    storeId: string,
    processedBy: string,
    data: {
      customerName: string;
      customerPhone: string;
      items: Array<{
        sareeId: string;
        quantity: number;
        unitPrice: number;
        lineAmount: number;
      }>;
      discountAmount: number;
      taxAmount: number;
      totalAmount: number;
      paymentMode: string;
      discountCode?: string;
    },
  ): Promise<StoreSale>;
  // Store Exchanges
  getStoreSaleForExchange(
    saleId: string,
  ): Promise<StoreSaleWithItems | undefined>;
  searchStoreSales(
    storeId: string,
    query: string,
  ): Promise<StoreSaleWithItems[]>;
  checkStoreSaleExchangeEligibility(
    saleId: string,
    storeId: string,
  ): Promise<{
    eligible: boolean;
    eligibleUntil?: Date;
    daysRemaining?: number;
    reason?: string;
    items?: Array<{
      itemId: string;
      eligible: boolean;
      reason?: string;
      availableQuantity: number;
    }>;
  } | undefined>;

  getStoreExchangesPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{ data: StoreExchangeWithDetails[]; total: number }>;
  getStoreExchange(id: string): Promise<StoreExchangeWithDetails | undefined>;
  createStoreExchange(
    exchange: InsertStoreExchange,
    returnItems: Omit<InsertStoreExchangeReturnItem, "exchangeId">[],
    newItems: Omit<InsertStoreExchangeNewItem, "exchangeId">[],
  ): Promise<StoreExchange>;
  createStoreExchangeWithValidation(
    storeId: string,
    processedBy: string,
    data: {
      originalSaleId: string;
      returnItems: {
        saleItemId: string;
        sareeId: string;
        quantity: number;
        unitPrice: string;
        returnAmount: string;
      }[];
      newItems?: {
        sareeId: string;
        quantity: number;
        unitPrice: string;
        lineAmount: string;
      }[];
      reason?: string;
      notes?: string;
      customerName?: string;
      customerPhone?: string;
    },
  ): Promise<StoreExchange>;
  getShopAvailableProducts(
    storeId: string,
  ): Promise<{ saree: SareeWithDetails; storeStock: number }[]>;
  getAllStoreSales(): Promise<StoreSaleWithItems[]>;
  getStoreSales(storeId: string, limit?: number): Promise<StoreSaleWithItems[]>;
  getStoreSalesPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{ data: StoreSaleWithItems[]; total: number }>;
  updateStoreInventory(
    storeId: string,
    sareeId: string,
    quantity: number,
  ): Promise<StoreInventory>;
  getStoreInventory(
    storeId: string,
  ): Promise<(StoreInventory & { saree: SareeWithDetails })[]>;
  getLowStockProducts(storeId: string): Promise<
    Array<{
      saree: SareeWithDetails;
      currentStock: number;
      reorderLevel: number;
    }>
  >;
  getStoreInventoryItem(
    storeId: string,
    sareeId: string,
  ): Promise<StoreInventory | undefined>;
  getStoreCart(storeId: string): Promise<{ items: any[] }>;
  deleteFromStoreCart(
    storeId: string,
    sareeId: string,
  ): Promise<{ items: any[] }>;
  updateStoreCart(storeId: string, items: any[]): Promise<{ items: any[] }>;
  clearStoreCart(storeId: string): Promise<{ items: any[] }>;
  applyCoupon(storeId: string, code: string): Promise<any>;
  updateCouponUsage(
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: string,
  ): Promise<void>;
  generateReceipt(storeId: string, orderId: string): Promise<any>;
  generateStoreExchangeId(storeId: string): Promise<string>;
}
export class StoreRepository implements StoreStorage {
  async generateStoreSaleId(storeId: string): Promise<string> {
    const store = await this.getStore(storeId);
    if (!store) {
      throw new Error("Store not found");
    }

    const cleanStoreName = store.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    // Get the count of existing sales for this store to determine the next number
    const existingSalesCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales)
      .where(eq(storeSales.storeId, storeId));

    const nextNumber = (existingSalesCount[0]?.count || 0) + 1;

    // Format: MOHA + store name + sequential number (padded to 2 digits)
    return `MOHA${cleanStoreName}${nextNumber.toString().padStart(2, "0")}`;
  }

  async generateStoreExchangeId(storeId: string): Promise<string> {
    const store = await this.getStore(storeId);
    if (!store) {
      throw new Error("Store not found");
    }

    const cleanStoreName = store.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    // Get the count of existing exchanges for this store to determine the next number
    const existingExchangesCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeExchanges)
      .where(eq(storeExchanges.storeId, storeId));

    const nextNumber = (existingExchangesCount[0]?.count || 0) + 1;

    // Format: EX + store name + sequential number (padded to 2 digits)
    return `EX${cleanStoreName}${nextNumber.toString().padStart(2, "0")}`;
  }

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

  async updateStore(
    id: string,
    data: Partial<InsertStore>,
  ): Promise<Store | undefined> {
    const [result] = await db
      .update(stores)
      .set(data)
      .where(eq(stores.id, id))
      .returning();
    return result || undefined;
  }

  async createStoreSale(
    storeId: string,
    processedBy: string,
    data: {
      customerName: string;
      customerPhone: string;
      items: Array<{
        sareeId: string;
        quantity: number;
        unitPrice: number;
        lineAmount: number;
      }>;
      discountAmount: number;
      taxAmount: number;
      totalAmount: number;
      paymentMode: string;
      discountCode?: string;
    },
  ): Promise<StoreSale> {
    // Generate custom sale ID
    const saleId = await this.generateStoreSaleId(storeId);

    const [newSale] = await db
      .insert(storeSales)
      .values({
        id: saleId,
        storeId,
        soldBy: processedBy,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        totalAmount: data.totalAmount.toString(),
        discountAmount: data.discountAmount.toString(),
        taxAmount: data.taxAmount.toString(),
        paymentMode: data.paymentMode,
        saleType: "walk_in",
      })
      .returning();

    for (const item of data.items) {
      await db.insert(storeSaleItems).values({
        saleId: newSale.id,
        sareeId: item.sareeId,
        quantity: item.quantity,
        price: item.unitPrice.toString(),
      });

      // Deduct from store inventory
      await db
        .update(storeInventory)
        .set({ quantity: sql`${storeInventory.quantity} - ${item.quantity}` })
        .where(
          and(
            eq(storeInventory.storeId, storeId),
            eq(storeInventory.sareeId, item.sareeId),
          ),
        );

      // Deduct from total stock
      await db
        .update(sarees)
        .set({ totalStock: sql`${sarees.totalStock} - ${item.quantity}` })
        .where(eq(sarees.id, item.sareeId));

      // Record stock movement (negative for deduction)
      await db.insert(stockMovements).values({
        sareeId: item.sareeId,
        quantity: -item.quantity,
        movementType: "sale",
        source: "store",
        orderRefId: newSale.id,
        storeId,
      });
    }
    await this.clearStoreCart(storeId);

    return newSale;
  }

  async getStoreSaleForExchange(
    saleId: string,
  ): Promise<StoreSaleWithItems | undefined> {
    const [sale] = await db
      .select()
      .from(storeSales)
      .leftJoin(stores, eq(storeSales.storeId, stores.id))
      .where(eq(storeSales.id, saleId));

    if (!sale) return undefined;

    const items = await db
      .select()
      .from(storeSaleItems)
      .leftJoin(sarees, eq(storeSaleItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(storeSaleItems.saleId, saleId));

    const itemsWithReturns = await Promise.all(
      items.map(async (item) => {
        const returnedResult = await db
          .select({
            totalReturned: sql<number>`COALESCE(SUM(${storeExchangeReturnItems.quantity}), 0)`,
          })
          .from(storeExchangeReturnItems)
          .where(
            eq(storeExchangeReturnItems.saleItemId, item.store_sale_items.id),
          );

        const returnedQuantity = Number(returnedResult[0]?.totalReturned || 0);

        return {
          ...item.store_sale_items,
          returnedQuantity,
          saree: {
            ...item.sarees!,
            category: item.categories,
            color: item.colors,
            fabric: item.fabrics,
          },
        };
      }),
    );

    return {
      ...sale.store_sales,
      store: sale.stores!,
      items: itemsWithReturns,
    };
  }

  async searchStoreSales(
    storeId: string,
    query: string,
  ): Promise<StoreSaleWithItems[]> {
    const searchConditions = [
      eq(storeSales.storeId, storeId),
      sql`${storeSales.id}::text ILIKE ${`%${query}%`}`,
      sql`${storeSales.customerName} ILIKE ${`%${query}%`}`,
      sql`${storeSales.customerPhone} ILIKE ${`%${query}%`}`,
    ];

    const whereClause = and(
      eq(storeSales.storeId, storeId),
      sql`(${storeSales.id}::text ILIKE ${`%${query}%`} OR ${storeSales.customerName} ILIKE ${`%${query}%`} OR ${storeSales.customerPhone} ILIKE ${`%${query}%`})`
    );

    const salesList = await db
      .select()
      .from(storeSales)
      .innerJoin(stores, eq(storeSales.storeId, stores.id))
      .where(whereClause)
      .orderBy(desc(storeSales.createdAt))
      .limit(20); // Limit to 20 results for better UX

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

      const itemsWithReturns = await Promise.all(
        items.map(async (item) => {
          const returnedResult = await db
            .select({
              totalReturned: sql<number>`COALESCE(SUM(${storeExchangeReturnItems.quantity}), 0)`,
            })
            .from(storeExchangeReturnItems)
            .where(
              eq(storeExchangeReturnItems.saleItemId, item.store_sale_items.id),
            );

          const returnedQuantity = Number(returnedResult[0]?.totalReturned || 0);

          return {
            ...item.store_sale_items,
            returnedQuantity,
            saree: {
              ...item.sarees!,
              category: item.categories,
              color: item.colors,
              fabric: item.fabrics,
            },
          };
        }),
      );

      // Get eligibility data for this sale
      const eligibilityData = await this.checkStoreSaleExchangeEligibility(
        row.store_sales.id,
        storeId
      );

      result.push({
        ...row.store_sales,
        store: row.stores,
        eligibilityData,
        items: itemsWithReturns,
      });
    }

    return result;
  }

  async checkStoreSaleExchangeEligibility(
    saleId: string,
    storeId: string,
  ): Promise<{
    eligible: boolean;
    eligibleUntil?: Date;
    daysRemaining?: number;
    reason?: string;
    items?: Array<{
      itemId: string;
      eligible: boolean;
      reason?: string;
      availableQuantity: number;
    }>;
  } | undefined > {
    // First, get the sale with items
    const sale = await this.getStoreSaleForExchange(saleId);
    
 
    // Check if sale belongs to the specified store
    if (sale?.storeId !== storeId) {
      return {
        eligible: false,
        reason: "Sale belongs to different store",
        items: [],
      };
    }

    // Get exchange window days from settings (similar to return window)
    const windowDays = await this.getExchangeWindowDays();
    const days = windowDays ? parseInt(windowDays) : 7;

    const now = new Date();
    const saleDate = new Date(sale.createdAt);
    const eligibleUntil = new Date(saleDate);
    eligibleUntil.setDate(eligibleUntil.getDate() + days);

    // Check if the exchange window has passed
    if (now > eligibleUntil) {
      return {
        eligible: false,
        eligibleUntil,
        daysRemaining: 0,
        reason: `Exchange window has expired. Items were eligible for exchange until ${eligibleUntil.toLocaleDateString()}`,
        items: [],
      };
    }

    // Calculate days remaining
    const daysRemaining = Math.ceil((eligibleUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check each item for eligibility
    const itemsEligibility = sale.items.map((item) => {
      const availableQuantity = item.quantity - (item.returnedQuantity || 0);
      
      if (availableQuantity <= 0) {
        return {
          itemId: item.id,
          eligible: false,
          reason: "All items have already been returned/exchanged",
          availableQuantity: 0,
        };
      }

      return {
        itemId: item.id,
        eligible: true,
        availableQuantity,
      };
    });

    // Check if any items are eligible for exchange
    const hasEligibleItems = itemsEligibility.some(item => item.eligible);

    if (!hasEligibleItems) {
      return {
        eligible: false,
        eligibleUntil,
        daysRemaining,
        reason: "No items available for exchange - all items have been returned/exchanged",
        items: itemsEligibility,
      };
    }

    return {
      eligible: true,
      eligibleUntil,
      daysRemaining,
      items: itemsEligibility,
    };
  }

  private async getExchangeWindowDays(): Promise<string | null> {
    try {
      // Try to get from settings table or return default
      const result = await db
        .select({ value: sql`value` })
        .from(sql`settings`)
        .where(sql`key = 'exchange_window_days'`)
        .limit(1);

      return (result[0]?.value as string) || null;
    } catch (error) {
      console.error("Error getting exchange window days:", error);
      return null;
    }
  }

  async getStoreExchange(
    id: string,
  ): Promise<StoreExchangeWithDetails | undefined> {
    const [exchange] = await db
      .select()
      .from(storeExchanges)
      .leftJoin(stores, eq(storeExchanges.storeId, stores.id))
      .leftJoin(users, eq(storeExchanges.processedBy, users.id))
      .where(eq(storeExchanges.id, id));

    if (!exchange) return undefined;

    const originalSale = await this.getStoreSaleForExchange(
      exchange.store_exchanges.originalSaleId,
    );

    const returnItemsList = await db
      .select()
      .from(storeExchangeReturnItems)
      .leftJoin(sarees, eq(storeExchangeReturnItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(storeExchangeReturnItems.exchangeId, id));

    const newItemsList = await db
      .select()
      .from(storeExchangeNewItems)
      .leftJoin(sarees, eq(storeExchangeNewItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(storeExchangeNewItems.exchangeId, id));

    return {
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
    };
  }

  async createStoreExchange(
    exchange: InsertStoreExchange,
    returnItemsData: Omit<InsertStoreExchangeReturnItem, "exchangeId">[],
    newItemsData: Omit<InsertStoreExchangeNewItem, "exchangeId">[],
  ): Promise<StoreExchange> {
    return await db.transaction(async (tx) => {
      const [createdExchange] = await tx
        .insert(storeExchanges)
        .values(exchange)
        .returning();

      if (returnItemsData.length > 0) {
        const returnRecords = returnItemsData.map((item) => ({
          ...item,
          exchangeId: createdExchange.id,
        }));
        await tx.insert(storeExchangeReturnItems).values(returnRecords);

        for (const item of returnItemsData) {
          await tx
            .update(storeSaleItems)
            .set({
              returnedQuantity: sql`${storeSaleItems.returnedQuantity} + ${item.quantity}`,
            })
            .where(eq(storeSaleItems.id, item.saleItemId));

          // Update store inventory
          await tx
            .update(storeInventory)
            .set({
              quantity: sql`${storeInventory.quantity} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(storeInventory.storeId, exchange.storeId),
                eq(storeInventory.sareeId, item.sareeId),
              ),
            );

          // Update total stock in sarees table
          await tx
            .update(sarees)
            .set({
              totalStock: sql`${sarees.totalStock} + ${item.quantity}`,
            })
            .where(eq(sarees.id, item.sareeId));

          await tx.insert(stockMovements).values({
            sareeId: item.sareeId,
            quantity: item.quantity,
            movementType: "return",
            source: "store",
            orderRefId: createdExchange.id,
            storeId: exchange.storeId,
            notes: "Exchange return - item returned to store",
          });
        }
      }

      if (newItemsData.length > 0) {
        const newRecords = newItemsData.map((item) => ({
          ...item,
          exchangeId: createdExchange.id,
        }));
        await tx.insert(storeExchangeNewItems).values(newRecords);

        for (const item of newItemsData) {
          // Update store inventory
          await tx
            .update(storeInventory)
            .set({
              quantity: sql`${storeInventory.quantity} - ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(storeInventory.storeId, exchange.storeId),
                eq(storeInventory.sareeId, item.sareeId),
              ),
            );

          // Update total stock in sarees table
          await tx
            .update(sarees)
            .set({
              totalStock: sql`${sarees.totalStock} - ${item.quantity}`,
            })
            .where(eq(sarees.id, item.sareeId));

          await tx.insert(stockMovements).values({
            sareeId: item.sareeId,
            quantity: -item.quantity,
            movementType: "sale",
            source: "store",
            orderRefId: createdExchange.id,
            storeId: exchange.storeId,
            notes: "Exchange - new item given to customer",
          });
        }
      }

      return createdExchange;
    });
  }

  async createStoreExchangeWithValidation(
    storeId: string,
    processedBy: string,
    data: {
      originalSaleId: string;
      returnItems: {
        saleItemId: string;
        sareeId: string;
        quantity: number;
        unitPrice: string;
        returnAmount: string;
      }[];
      newItems?: {
        sareeId: string;
        quantity: number;
        unitPrice: string;
        lineAmount: string;
      }[];
      reason?: string;
      notes?: string;
      customerName?: string;
      customerPhone?: string;
    },
  ): Promise<StoreExchange> {
    // Generate custom exchange ID
    const exchangeId = await this.generateStoreExchangeId(storeId);
    // Validate required fields
    if (
      !data.originalSaleId ||
      !data.returnItems ||
      data.returnItems.length === 0
    ) {
      throw new Error(
        "Original sale ID and at least one return item are required",
      );
    }

    // Verify original sale exists and belongs to this store
    const originalSale = await this.getStoreSaleForExchange(
      data.originalSaleId,
    );
    if (!originalSale) {
      throw new Error("Original sale not found");
    }
    if (originalSale.storeId !== storeId) {
      throw new Error("Sale belongs to different store");
    }

    // Check exchange eligibility (within 7 days)
    const saleDate = new Date(originalSale.createdAt);
    const currentDate = new Date();
    const daysSinceSale = Math.floor(
      (currentDate.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceSale > 7) {
      throw new Error("Items can only be exchanged within 7 days of purchase");
    }

    // Validate return items
    for (const returnItem of data.returnItems) {
      if (
        !returnItem.saleItemId ||
        !returnItem.sareeId ||
        !returnItem.quantity ||
        !returnItem.unitPrice ||
        !returnItem.returnAmount
      ) {
        throw new Error("Invalid return item data");
      }

      // Check if sale item exists and has sufficient quantity
      const saleItem = originalSale.items.find(
        (item) => item.id === returnItem.saleItemId,
      );
      if (!saleItem) {
        throw new Error(`Sale item ${returnItem.saleItemId} not found`);
      }

      const availableQuantity =
        saleItem.quantity - (saleItem.returnedQuantity || 0);
      if (returnItem.quantity > availableQuantity) {
        throw new Error(
          `Cannot return more than available quantity for item ${returnItem.saleItemId}`,
        );
      }

      // Validate return amount
      const returnAmount = parseFloat(returnItem.returnAmount);
      if (returnAmount <= 0 || isNaN(returnAmount)) {
        throw new Error("Return amount must be greater than 0");
      }
    }

    // Validate new items and check store inventory
    if (data.newItems && data.newItems.length > 0) {
      for (const newItem of data.newItems) {
        if (
          !newItem.sareeId ||
          !newItem.quantity ||
          !newItem.unitPrice ||
          !newItem.lineAmount
        ) {
          throw new Error("Invalid new item data");
        }

        // Check store inventory
        const inventory = await this.getStoreInventoryItem(
          storeId,
          newItem.sareeId,
        );
        if (!inventory || inventory.quantity < newItem.quantity) {
          throw new Error(`Insufficient stock for item ${newItem.sareeId}`);
        }

        // Validate new item amount
        const newAmount = parseFloat(newItem.lineAmount);
        if (newAmount <= 0 || isNaN(newAmount)) {
          throw new Error("New item amount must be greater than 0");
        }
      }
    }

    // Calculate totals
    const returnAmount = data.returnItems.reduce((sum: number, item: any) => {
      return (
        sum +
        (parseFloat(item.returnAmount) ||
          parseFloat(item.unitPrice) * item.quantity)
      );
    }, 0);

    const newItemsAmount = data.newItems
      ? data.newItems.reduce((sum: number, item: any) => {
          return (
            sum +
            (parseFloat(item.lineAmount) ||
              parseFloat(item.unitPrice) * item.quantity)
          );
        }, 0)
      : 0;

    // Mandatory amount checks
    if (returnAmount <= 0) {
      throw new Error("Zero-value exchanges are not allowed");
    }

    // Block unfavorable exchanges where returned value is higher than new items
    if (returnAmount > newItemsAmount) {
      throw new Error(
        `Unfavorable exchange: Returned items value (${returnAmount}) > Exchange items value (${newItemsAmount}). This would result in a loss of ${returnAmount - newItemsAmount} for the store.`,
      );
    }

    // Balance calculation for valid exchanges only
    const balanceAmount = Math.abs(returnAmount - newItemsAmount);
    let balanceDirection: "refund_to_customer" | "due_from_customer" | "even";

    if (newItemsAmount > returnAmount) {
      balanceDirection = "due_from_customer";
    } else {
      balanceDirection = "even";
    }

    return await this.createStoreExchange(
      {
        id: exchangeId,
        storeId,
        originalSaleId: data.originalSaleId,
        processedBy,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        reason: data.reason,
        notes: data.notes,
        returnAmount: returnAmount.toString(),
        newItemsAmount: newItemsAmount.toString(),
        balanceAmount: balanceAmount.toString(),
        balanceDirection,
      },
      data.returnItems,
      data.newItems || [],
    );
  }

  async getStoreExchangesPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const conditions = [eq(storeExchanges.storeId, storeId)];

    if (options.search) {
      conditions.push(
        sql`${storeExchanges.id}::text ILIKE ${`%${options.search}%`}`,
      );
    }

    if (options.dateFrom) {
      conditions.push(
        gte(storeExchanges.createdAt, new Date(options.dateFrom)),
      );
    }

    if (options.dateTo) {
      conditions.push(lte(storeExchanges.createdAt, new Date(options.dateTo)));
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(storeExchanges)
        .leftJoin(stores, eq(storeExchanges.storeId, stores.id))
        .leftJoin(users, eq(storeExchanges.processedBy, users.id))
        .where(whereClause)
        .orderBy(desc(storeExchanges.createdAt))
        .limit(options.limit)
        .offset(options.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeExchanges)
        .where(whereClause),
    ]);

    const result: StoreExchangeWithDetails[] = [];

    for (const exchange of data) {
      const originalSale = await this.getStoreSaleForExchange(
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

    return {
      data: result,
      total: countResult[0]?.count || 0,
    };
  }
  async getShopAvailableProducts(
    storeId: string,
  ): Promise<{ saree: SareeWithDetails; storeStock: number }[]> {
    const result = await db
      .select()
      .from(storeInventory)
      .innerJoin(sarees, eq(storeInventory.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(
        and(
          eq(storeInventory.storeId, storeId),
          gt(storeInventory.quantity, 0), // Only show products with stock > 0
        ),
      );

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

    return result.map((row) => {
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
  }

  async updateStoreInventory(
    storeId: string,
    sareeId: string,
    quantity: number,
  ): Promise<StoreInventory> {
    const [result] = await db
      .update(storeInventory)
      .set({ quantity, updatedAt: new Date() })
      .where(
        and(
          eq(storeInventory.storeId, storeId),
          eq(storeInventory.sareeId, sareeId),
        ),
      )
      .returning();

    if (!result) {
      // If no existing record, insert a new one
      const [inserted] = await db
        .insert(storeInventory)
        .values({ storeId, sareeId, quantity, updatedAt: new Date() })
        .returning();
      return inserted;
    }
    return result;
  }

  async getStoreSales(
    storeId: string,
    limit?: number,
  ): Promise<StoreSaleWithItems[]> {
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

      // Get eligibility data for this sale
      const eligibilityData = await this.checkStoreSaleExchangeEligibility(
        row.store_sales.id,
        storeId
      );

      result.push({
        ...row.store_sales,
        store: row.stores,
        eligibilityData,
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

  async getStoreSalesPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const conditions = [eq(storeSales.storeId, storeId)];

    if (options.search) {
      conditions.push(
        sql`${storeSales.id}::text ILIKE ${`%${options.search}%`}`,
      );
    }

    if (options.dateFrom) {
      conditions.push(gte(storeSales.createdAt, new Date(options.dateFrom)));
    }

    if (options.dateTo) {
      conditions.push(lte(storeSales.createdAt, new Date(options.dateTo)));
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(storeSales)
        .innerJoin(stores, eq(storeSales.storeId, stores.id))
        .where(whereClause)
        .orderBy(desc(storeSales.createdAt))
        .limit(options.limit)
        .offset(options.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeSales)
        .where(whereClause),
    ]);

    const result: StoreSaleWithItems[] = [];

    for (const row of data) {
      const items = await db
        .select()
        .from(storeSaleItems)
        .innerJoin(sarees, eq(storeSaleItems.sareeId, sarees.id))
        .leftJoin(categories, eq(sarees.categoryId, categories.id))
        .leftJoin(colors, eq(sarees.colorId, colors.id))
        .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
        .where(eq(storeSaleItems.saleId, row.store_sales.id));

      // Get eligibility data for this sale
      const eligibilityData = await this.checkStoreSaleExchangeEligibility(
        row.store_sales.id,
        storeId
      );

      result.push({
        ...row.store_sales,
        store: row.stores,
        eligibilityData,
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
      total: countResult[0]?.count || 0,
    };
  }

  async getAllStoreSales(): Promise<StoreSaleWithItems[]> {
    const salesList = await db
      .select()
      .from(storeSales)
      .innerJoin(stores, eq(storeSales.storeId, stores.id))
      .orderBy(desc(storeSales.createdAt));

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

      // Get eligibility data for this sale
      const eligibilityData = await this.checkStoreSaleExchangeEligibility(
        row.store_sales.id,
        row.stores.id
      );

      result.push({
        ...row.store_sales,
        store: row.stores,
        eligibilityData,
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
  // Store Inventory
  async getStoreInventory(
    storeId: string,
  ): Promise<(StoreInventory & { saree: SareeWithDetails })[]> {
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

  async getLowStockProducts(storeId: string): Promise<
    Array<{
      saree: SareeWithDetails;
      currentStock: number;
      reorderLevel: number;
    }>
  > {
    // Define reorder level as 5 units (you can make this configurable later)
    const REORDER_LEVEL = 5;

    const result = await db
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
      .orderBy(storeInventory.quantity); // Order by quantity (lowest first)

    return result.map((row) => ({
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
      currentStock: row.store_inventory.quantity,
      reorderLevel: REORDER_LEVEL,
    }));
  }

  async getStoreInventoryItem(
    storeId: string,
    sareeId: string,
  ): Promise<StoreInventory | undefined> {
    const [result] = await db
      .select()
      .from(storeInventory)
      .where(
        and(
          eq(storeInventory.storeId, storeId),
          eq(storeInventory.sareeId, sareeId),
        ),
      );
    return result || undefined;
  }

  async addToStoreCart(
    storeId: string,
    sareeId: string,
    quantity: number,
    unitPrice: number,
  ): Promise<{ items: any[] }> {
    const price = Number(unitPrice);

    await db.transaction(async (tx) => {
      const [existingItem] = await tx
        .select()
        .from(storeCart)
        .where(
          and(eq(storeCart.storeId, storeId), eq(storeCart.sareeId, sareeId)),
        )
        .limit(1);

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        const newLineAmount = newQuantity * price;

        await tx
          .update(storeCart)
          .set({
            quantity: newQuantity,
            unitPrice: price.toString(),
            lineAmount: newLineAmount.toString(),
          })
          .where(eq(storeCart.id, existingItem.id));
      } else {
        const lineAmount = quantity * price;

        await tx.insert(storeCart).values({
          storeId,
          sareeId,
          quantity,
          unitPrice: price.toString(),
          lineAmount: lineAmount.toString(),
        });
      }
    });

    return this.getStoreCart(storeId);
  }

  async getStoreCart(storeId: string): Promise<{ items: any[] }> {
    const cartItems = await db
      .select()
      .from(storeCart)
      .innerJoin(sarees, eq(storeCart.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .leftJoin(
        storeInventory,
        and(
          eq(storeInventory.sareeId, sarees.id),
          eq(storeInventory.storeId, storeId),
        ),
      )
      .where(eq(storeCart.storeId, storeId));

    return {
      items: cartItems.map((item) => ({
        id: item.store_cart.id,
        sareeId: item.store_cart.sareeId,
        quantity: item.store_cart.quantity,
        unitPrice: Number(item.store_cart.unitPrice),
        lineAmount: Number(item.store_cart.lineAmount),
        storeStock: item.store_inventory?.quantity || 0,
        saree: {
          id: item.sarees.id,
          name: item.sarees.name,
          code: item.sarees.sku || item.sarees.id,
          image: item.sarees.imageUrl,
          category: item.categories,
          color: item.colors,
          fabric: item.fabrics,
        },
      })),
    };
  }

  async deleteFromStoreCart(
    storeId: string,
    sareeId: string,
  ): Promise<{ items: any[] }> {
    await db
      .delete(storeCart)
      .where(
        and(eq(storeCart.storeId, storeId), eq(storeCart.sareeId, sareeId)),
      );

    // Return updated cart after deletion
    return this.getStoreCart(storeId);
  }

  async updateStoreCart(
    storeId: string,
    items: any[],
  ): Promise<{ items: any[] }> {
    await db.transaction(async (tx) => {
      for (const item of items) {
        const [existingItem] = await tx
          .select()
          .from(storeCart)
          .where(
            and(
              eq(storeCart.storeId, storeId),
              eq(storeCart.sareeId, item.sareeId),
            ),
          )
          .limit(1);

        const quantity = item.quantity || 0;
        const unitPrice = Number(item.unitPrice || 0);
        const lineAmount =
          item.lineAmount !== undefined
            ? Number(item.lineAmount)
            : quantity * unitPrice;

        if (existingItem) {
          await tx
            .update(storeCart)
            .set({
              quantity,
              unitPrice: unitPrice.toString(),
              lineAmount: lineAmount.toString(),
            })
            .where(
              and(
                eq(storeCart.storeId, storeId),
                eq(storeCart.sareeId, item.sareeId),
              ),
            );
        } else {
          await tx.insert(storeCart).values({
            storeId,
            sareeId: item.sareeId,
            quantity,
            unitPrice: unitPrice.toString(),
            lineAmount: lineAmount.toString(),
          });
        }
      }
    });

    return this.getStoreCart(storeId);
  }
  async clearStoreCart(storeId: string): Promise<{ items: any[] }> {
    await db.delete(storeCart).where(eq(storeCart.storeId, storeId));

    return this.getStoreCart(storeId);
  }

  async applyCoupon(storeId: string, code: string): Promise<any> {
    const now = new Date();

    const [coupon] = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.code, code.toUpperCase()),
          eq(coupons.isActive, true),
          lte(coupons.validFrom || now, now),
          gte(coupons.validUntil || now, now),
        ),
      );

    if (!coupon) {
      throw new Error("Invalid or expired coupon code");
    }

    if (coupon.usageLimit) {
      const [totalUsage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsage)
        .where(eq(couponUsage.couponId, coupon.id));

      if (totalUsage && totalUsage.count >= coupon.usageLimit) {
        throw new Error("Coupon usage limit exceeded");
      }
    }

    return {
      discount: {
        type: coupon.type,
        value: Number(coupon.value),
        code: coupon.code,
        description: coupon.name || coupon.code,
        minOrderAmount: coupon.minOrderAmount
          ? Number(coupon.minOrderAmount)
          : null,
        maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
        couponId: coupon.id,
      },
    };
  }

  async updateCouponUsage(
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: string,
  ): Promise<void> {
    await db.insert(couponUsage).values({
      couponId,
      userId,
      orderId,
      discountAmount,
    });
  }

  async getExchangeHistoryForOrder(orderId: string): Promise<StoreExchangeWithDetails[]> {
    const exchanges = await db
      .select()
      .from(storeExchanges)
      .where(eq(storeExchanges.originalSaleId, orderId))
      .orderBy(desc(storeExchanges.createdAt));

    const result: StoreExchangeWithDetails[] = [];

    for (const exchange of exchanges) {
      const exchangeDetails = await this.getStoreExchange(exchange.id);
      if (exchangeDetails) {
        result.push(exchangeDetails);
      }
    }

    return result;
  }

  async generateReceipt(storeId: string, orderId: string): Promise<any> {
    const exchangeHistory = await this.getExchangeHistoryForOrder(orderId);
    
    if (exchangeHistory.length > 0) {
      return {
        type: 'exchange',
        exchangeHistory:exchangeHistory,
      };
    }
    
    const sales = await this.getStoreSales(storeId);
    const sale = sales.find((s) => s.id === orderId);
    if (!sale) {
      throw new Error("Sale not found");
    }

    return {
      type: 'normal',
     ...sale,
    };
  }
}

export const storeService = new StoreRepository();
