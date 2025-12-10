import {
  Store,
  stores,
  InsertStore,
  categories,
  colors,
  fabrics,
  InsertStoreSale,
  InsertStoreSaleItem,
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
} from "@shared/schema";
import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db } from "server/db";

export interface StoreStorage {
  // Stores
  getStores(): Promise<Store[]>;
  getStore(id: string): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(
    id: string,
    data: Partial<InsertStore>
  ): Promise<Store | undefined>;

  createStoreSale(
    sale: InsertStoreSale,
    items: InsertStoreSaleItem[]
  ): Promise<StoreSale>;
  // Store Exchanges
  getStoreSaleForExchange(
    saleId: string
  ): Promise<StoreSaleWithItems | undefined>;
  getStoreExchanges(
    storeId: string,
    limit?: number
  ): Promise<StoreExchangeWithDetails[]>;
  getStoreExchange(id: string): Promise<StoreExchangeWithDetails | undefined>;
  createStoreExchange(
    exchange: InsertStoreExchange,
    returnItems: Omit<InsertStoreExchangeReturnItem, "exchangeId">[],
    newItems: Omit<InsertStoreExchangeNewItem, "exchangeId">[]
  ): Promise<StoreExchange>;
  getShopAvailableProducts(
    storeId: string
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
    }
  ): Promise<{ data: StoreSaleWithItems[]; total: number }>;
  updateStoreInventory(
    storeId: string,
    sareeId: string,
    quantity: number
  ): Promise<StoreInventory>;
  getStoreInventory(
    storeId: string
  ): Promise<(StoreInventory & { saree: SareeWithDetails })[]>;
}
export class StoreRepository implements StoreStorage {
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
    data: Partial<InsertStore>
  ): Promise<Store | undefined> {
    const [result] = await db
      .update(stores)
      .set(data)
      .where(eq(stores.id, id))
      .returning();
    return result || undefined;
  }

  async createStoreSale(
    sale: InsertStoreSale,
    items: InsertStoreSaleItem[]
  ): Promise<StoreSale> {
    const [newSale] = await db.insert(storeSales).values(sale).returning();

    for (const item of items) {
      await db.insert(storeSaleItems).values({ ...item, saleId: newSale.id });

      // Deduct from store inventory
      await db
        .update(storeInventory)
        .set({ quantity: sql`${storeInventory.quantity} - ${item.quantity}` })
        .where(
          and(
            eq(storeInventory.storeId, sale.storeId),
            eq(storeInventory.sareeId, item.sareeId)
          )
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
        storeId: sale.storeId,
      });
    }

    return newSale;
  }

  async getStoreSaleForExchange(
    saleId: string
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
            eq(storeExchangeReturnItems.saleItemId, item.store_sale_items.id)
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
      })
    );

    return {
      ...sale.store_sales,
      store: sale.stores!,
      items: itemsWithReturns,
    };
  }
  async getStoreExchange(
    id: string
  ): Promise<StoreExchangeWithDetails | undefined> {
    const [exchange] = await db
      .select()
      .from(storeExchanges)
      .leftJoin(stores, eq(storeExchanges.storeId, stores.id))
      .leftJoin(users, eq(storeExchanges.processedBy, users.id))
      .where(eq(storeExchanges.id, id));

    if (!exchange) return undefined;

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
    newItemsData: Omit<InsertStoreExchangeNewItem, "exchangeId">[]
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
                eq(storeInventory.sareeId, item.sareeId)
              )
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
                eq(storeInventory.sareeId, item.sareeId)
              )
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
  async getStoreExchanges(
    storeId: string,
    limit?: number
  ): Promise<StoreExchangeWithDetails[]> {
    const exchangesList = await db
      .select()
      .from(storeExchanges)
      .leftJoin(stores, eq(storeExchanges.storeId, stores.id))
      .leftJoin(users, eq(storeExchanges.processedBy, users.id))
      .where(eq(storeExchanges.storeId, storeId))
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
  async getShopAvailableProducts(
    storeId: string
  ): Promise<{ saree: SareeWithDetails; storeStock: number }[]> {
    const result = await db
      .select()
      .from(storeInventory)
      .innerJoin(sarees, eq(storeInventory.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(storeInventory.storeId, storeId));

    // Fetch active sales
    const now = new Date();
    const activeSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now)
        )
      );

    // Fetch sale product mappings
    const saleProductMappings = await db.select().from(saleProducts);

    return result.map((row) => {
      const saree = row.sarees;
      
      // Find applicable sale
      let applicableSale = null;
      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.sareeId === saree.id
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId
        );
      }
      // Only exclude category pricing when THIS saree is explicitly mapped to a different sale
      if (!applicableSale && saree.categoryId) {
        applicableSale = activeSales.find(
          (s) => s.categoryId === saree.categoryId && 
          !saleProductMappings.some(sp => sp.saleId === s.id && sp.sareeId === saree.id)
        );
      }

      // Calculate discounted price using consistent logic across all flows
      let discountedPrice = parseFloat(saree.price);
      if (applicableSale) {
        const originalPrice = discountedPrice;
        if (applicableSale.offerType === "percentage" || applicableSale.offerType === "category" || applicableSale.offerType === "flash_sale") {
          const discount = originalPrice * (parseFloat(applicableSale.discountValue) / 100);
          const maxDiscount = applicableSale.maxDiscount 
            ? parseFloat(applicableSale.maxDiscount) 
            : originalPrice; // Cap at price if no maxDiscount
          discountedPrice = originalPrice - Math.min(discount, maxDiscount, originalPrice);
        } else if (applicableSale.offerType === "flat" || applicableSale.offerType === "product") {
          const flatDiscount = Math.min(parseFloat(applicableSale.discountValue), originalPrice);
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
    quantity: number
  ): Promise<StoreInventory> {
    const [result] = await db
      .update(storeInventory)
      .set({ quantity, updatedAt: new Date() })
      .where(
        and(
          eq(storeInventory.storeId, storeId),
          eq(storeInventory.sareeId, sareeId)
        )
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
    limit?: number
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

  async getStoreSalesPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const conditions = [eq(storeSales.storeId, storeId)];

    if (options.search) {
      conditions.push(
        sql`${storeSales.id}::text ILIKE ${`%${options.search}%`}`
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
  // Store Inventory
  async getStoreInventory(
    storeId: string
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

  async getStoreInventoryItem(
    storeId: string,
    sareeId: string
  ): Promise<StoreInventory | undefined> {
    const [result] = await db
      .select()
      .from(storeInventory)
      .where(
        and(
          eq(storeInventory.storeId, storeId),
          eq(storeInventory.sareeId, sareeId)
        )
      );
    return result || undefined;
  }
}

export const storeService = new StoreRepository();
