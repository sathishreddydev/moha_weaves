import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "server/db";
import { 
  StoreExchangeWithDetails,
  StoreExchange,
  InsertStoreExchange,
  InsertStoreExchangeReturnItem,
  InsertStoreExchangeNewItem,
  storeExchangeReturnItems,
  storeExchangeNewItems,
  storeExchanges,
  stores,
  users,
  sarees,
  stockMovements,
  storeInventory,
  storeSaleItems,
  storeSales,
  StoreSaleWithItems
} from "@shared/schema";
import { createSareeJoins, transformSareeWithDetails } from "./storeHelpers";

export class ExchangeManagement {
  async getStoreExchange(id: string): Promise<StoreExchangeWithDetails | undefined> {
    const [exchange] = await db
      .select()
      .from(storeExchanges)
      .leftJoin(stores, eq(storeExchanges.storeId, stores.id))
      .leftJoin(users, eq(storeExchanges.processedBy, users.id))
      .where(eq(storeExchanges.id, id));

    if (!exchange) return undefined;

    // Get return items
    const returnItemsList = await db
      .select()
      .from(storeExchangeReturnItems)
      .innerJoin(sarees, eq(storeExchangeReturnItems.sareeId, sarees.id))
      .call(createSareeJoins)
      .where(eq(storeExchangeReturnItems.exchangeId, id));

    // Get new items
    const newItemsList = await db
      .select()
      .from(storeExchangeNewItems)
      .innerJoin(sarees, eq(storeExchangeNewItems.sareeId, sarees.id))
      .call(createSareeJoins)
      .where(eq(storeExchangeNewItems.exchangeId, id));

    // Get original sale
    const originalSale = await this.getStoreSaleForExchange(exchange.store_exchanges.originalSaleId);

    return {
      ...exchange.store_exchanges,
      store: exchange.stores!,
      originalSale: originalSale!,
      processor: exchange.users!,
      returnItems: returnItemsList.map((item) => ({
        ...item.store_exchange_return_items,
        saree: transformSareeWithDetails(item),
      })),
      newItems: newItemsList.map((item) => ({
        ...item.store_exchange_new_items,
        saree: transformSareeWithDetails(item),
      })),
    };
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
  ): Promise<{ data: StoreExchangeWithDetails[]; total: number }> {
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
      conditions.push(
        lte(storeExchanges.createdAt, new Date(options.dateTo)),
      );
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
      // Get return items
      const returnItemsList = await db
        .select()
        .from(storeExchangeReturnItems)
        .innerJoin(sarees, eq(storeExchangeReturnItems.sareeId, sarees.id))
        .call(createSareeJoins)
        .where(
          and(
            eq(storeExchangeReturnItems.exchangeId, exchange.store_exchanges.id),
            eq(storeExchangeReturnItems.isActive, true),
          ),
        );

      // Get new items
      const newItemsList = await db
        .select()
        .from(storeExchangeNewItems)
        .innerJoin(sarees, eq(storeExchangeNewItems.sareeId, sarees.id))
        .call(createSareeJoins)
        .where(
          and(
            eq(storeExchangeNewItems.exchangeId, exchange.store_exchanges.id),
            eq(storeExchangeNewItems.isActive, true),
          ),
        );

      // Get original sale
      const originalSale = await this.getStoreSaleForExchange(exchange.store_exchanges.originalSaleId);

      result.push({
        ...exchange.store_exchanges,
        store: exchange.stores!,
        originalSale: originalSale!,
        processor: exchange.users!,
        returnItems: returnItemsList.map((item) => ({
          ...item.store_exchange_return_items,
          saree: transformSareeWithDetails(item),
        })),
        newItems: newItemsList.map((item) => ({
          ...item.store_exchange_new_items,
          saree: transformSareeWithDetails(item),
        })),
      });
    }

    return {
      data: result,
      total: countResult[0]?.count || 0,
    };
  }

  async createStoreExchange(
    exchange: InsertStoreExchange,
    returnItems: Omit<InsertStoreExchangeReturnItem, "exchangeId">[],
    newItems: Omit<InsertStoreExchangeNewItem, "exchangeId">[],
  ): Promise<StoreExchange> {
    return await db.transaction(async (tx) => {
      const [createdExchange] = await tx
        .insert(storeExchanges)
        .values(exchange)
        .returning();

      if (returnItems.length > 0) {
        const returnRecords = returnItems.map((item) => ({
          ...item,
          exchangeId: createdExchange.id,
        }));

        await tx.insert(storeExchangeReturnItems).values(returnRecords);

        // Update inventory for returned items
        for (const returnItem of returnItems) {
          // Add items back to inventory
          await tx
            .update(storeInventory)
            .set({
              quantity: sql`${storeInventory.quantity} + ${returnItem.quantity}`,
            })
            .where(
              and(
                eq(storeInventory.storeId, exchange.storeId),
                eq(storeInventory.sareeId, returnItem.sareeId),
              ),
            );

          // Get current inventory for stock movement
          const [currentInventory] = await tx
            .select()
            .from(storeInventory)
            .where(
              and(
                eq(storeInventory.storeId, exchange.storeId),
                eq(storeInventory.sareeId, returnItem.sareeId),
              ),
            );

          // Record stock movement (positive for addition)
          await tx.insert(stockMovements).values({
            sareeId: returnItem.sareeId,
            quantity: returnItem.quantity,
            movementType: "return",
            referenceId: createdExchange.id,
            referenceType: "store_exchange",
            previousQuantity: currentInventory?.quantity || 0,
            newQuantity: (currentInventory?.quantity || 0) + returnItem.quantity,
            storeId: exchange.storeId,
          });
        }
      }

      if (newItemsData.length > 0) {
        const newRecords = newItemsData.map((item) => ({
          ...item,
          exchangeId: createdExchange.id,
        }));

        await tx.insert(storeExchangeNewItems).values(newRecords);

        // Update inventory for new items
        for (const newItem of newItemsData) {
          // Deduct items from inventory
          await tx
            .update(storeInventory)
            .set({
              quantity: sql`${storeInventory.quantity} - ${newItem.quantity}`,
            })
            .where(
              and(
                eq(storeInventory.storeId, exchange.storeId),
                eq(storeInventory.sareeId, newItem.sareeId),
              ),
            );

          // Get current inventory for stock movement
          const [currentInventory] = await tx
            .select()
            .from(storeInventory)
            .where(
              and(
                eq(storeInventory.storeId, exchange.storeId),
                eq(storeInventory.sareeId, newItem.sareeId),
              ),
            );

          // Record stock movement (negative for deduction)
          await tx.insert(stockMovements).values({
            sareeId: newItem.sareeId,
            quantity: -newItem.quantity,
            movementType: "exchange",
            referenceId: createdExchange.id,
            referenceType: "store_exchange",
            previousQuantity: currentInventory?.quantity || 0,
            newQuantity: (currentInventory?.quantity || 0) - newItem.quantity,
            storeId: exchange.storeId,
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

    // Get original sale
    const originalSale = await this.getStoreSaleForExchange(data.originalSaleId);
    if (!originalSale) {
      throw new Error("Original sale not found");
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
        throw new Error("All return item fields are required");
      }

      if (returnItem.quantity <= 0) {
        throw new Error("Return quantity must be positive");
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
          throw new Error("All new item fields are required");
        }

        if (newItem.quantity <= 0) {
          throw new Error("New item quantity must be positive");
        }

        // Check inventory availability
        const inventory = await db
          .select()
          .from(storeInventory)
          .where(
            and(
              eq(storeInventory.storeId, storeId),
              eq(storeInventory.sareeId, newItem.sareeId),
            ),
          )
          .limit(1);

        if (!inventory || inventory[0].quantity < newItem.quantity) {
          throw new Error(`Insufficient stock for item ${newItem.sareeId}`);
        }
      }
    }

    // Generate custom exchange ID
    const exchangeId = await this.generateStoreExchangeId(storeId);

    // Create exchange with validation
    return await this.createStoreExchange(
      {
        id: exchangeId,
        storeId,
        processedBy,
        originalSaleId: data.originalSaleId,
        returnAmount: data.returnItems.reduce(
          (sum, item) => sum + parseFloat(item.returnAmount),
          0,
        ).toString(),
        newAmount: data.newItems
          ? data.newItems.reduce((sum, item) => sum + parseFloat(item.lineAmount), 0)
          : 0,
        reason: data.reason,
        notes: data.notes,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
      },
      data.returnItems,
      data.newItems || [],
    );
  }

  async getExchangeHistoryForOrder(orderId: string): Promise<StoreExchangeWithDetails[]> {
    const exchanges = await db
      .select()
      .from(storeExchanges)
      .leftJoin(stores, eq(storeExchanges.storeId, stores.id))
      .leftJoin(users, eq(storeExchanges.processedBy, users.id))
      .where(eq(storeExchanges.originalSaleId, orderId));

    const result: StoreExchangeWithDetails[] = [];

    for (const exchange of exchanges) {
      // Get return items
      const returnItemsList = await db
        .select()
        .from(storeExchangeReturnItems)
        .innerJoin(sarees, eq(storeExchangeReturnItems.sareeId, sarees.id))
        .call(createSareeJoins)
        .where(eq(storeExchangeReturnItems.exchangeId, exchange.store_exchanges.id));

      // Get new items
      const newItemsList = await db
        .select()
        .from(storeExchangeNewItems)
        .innerJoin(sarees, eq(storeExchangeNewItems.sareeId, sarees.id))
        .call(createSareeJoins)
        .where(eq(storeExchangeNewItems.exchangeId, exchange.store_exchanges.id));

      // Get original sale
      const originalSale = await this.getStoreSaleForExchange(exchange.store_exchanges.originalSaleId);

      result.push({
        ...exchange.store_exchanges,
        store: exchange.stores!,
        originalSale: originalSale!,
        processor: exchange.users!,
        returnItems: returnItemsList.map((item) => ({
          ...item.store_exchange_return_items,
          saree: transformSareeWithDetails(item),
        })),
        newItems: newItemsList.map((item) => ({
          ...item.store_exchange_new_items,
          saree: transformSareeWithDetails(item),
        })),
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
  } | undefined> {
    const sale = await db
      .select()
      .from(storeSales)
      .where(eq(storeSales.id, saleId))
      .get();

    if (!sale) return undefined;

    const saleDate = new Date(sale.createdAt);
    const currentDate = new Date();
    const daysSinceSale = Math.floor(
      (currentDate.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const eligible = daysSinceSale <= 7;
    const eligibleUntil = new Date(saleDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, 7 - daysSinceSale);

    // Get items and their return quantities
    const items = await db
      .select()
      .from(storeSaleItems)
      .innerJoin(sarees, eq(storeSaleItems.sareeId, sarees.id))
      .call(createSareeJoins)
      .where(eq(storeSaleItems.saleId, saleId));

    const itemEligibility = await Promise.all(
      items.map(async (item) => {
        const [returnInfo] = await db
          .select()
          .from(storeExchangeReturnItems)
          .where(eq(storeExchangeReturnItems.saleItemId, item.store_sale_items.id));

        const returnedQuantity = returnInfo?.quantity || 0;
        const availableQuantity = item.store_sale_items.quantity - returnedQuantity;

        // Check if item is in stock
        const [inventory] = await db
          .select()
          .from(storeInventory)
          .where(
            and(
              eq(storeInventory.storeId, storeId),
              eq(storeInventory.sareeId, item.store_sale_items.sareeId),
            ),
          );

        const stockAvailable = inventory ? inventory.quantity >= availableQuantity : false;

        return {
          itemId: item.store_sale_items.id,
          eligible: eligible && availableQuantity > 0 && stockAvailable,
          reason: !eligible
            ? "Exchange period expired (7 days)"
            : availableQuantity <= 0
            ? "All items already returned"
            : !stockAvailable
            ? "Item out of stock"
            : undefined,
          availableQuantity,
        };
      }),
    );

    return {
      eligible: eligible && itemEligibility.some((item) => item.eligible),
      eligibleUntil,
      daysRemaining,
      reason: !eligible
        ? "Exchange period expired (7 days)"
        : !itemEligibility.some((item) => item.eligible)
        ? "No items available for exchange"
        : undefined,
      items: itemEligibility,
    };
  }

  private async getStoreSaleForExchange(
    saleId: string,
  ): Promise<StoreSaleWithItems | undefined> {
    const [sale] = await db
      .select()
      .from(storeSales)
      .leftJoin(stores, eq(storeSales.storeId, stores.id))
      .where(eq(storeSales.id, saleId));

    if (!sale) return undefined;

    // Get items with return information
    const items = await db
      .select()
      .from(storeSaleItems)
      .innerJoin(sarees, eq(storeSaleItems.sareeId, sarees.id))
      .call(createSareeJoins)
      .where(eq(storeSaleItems.saleId, saleId));

    const itemsWithReturns = await Promise.all(
      items.map(async (item) => {
        const [returnInfo] = await db
          .select()
          .from(storeExchangeReturnItems)
          .where(eq(storeExchangeReturnItems.saleItemId, item.store_sale_items.id));

        return {
          ...item.store_sale_items,
          saree: transformSareeWithDetails(item),
          returnedQuantity: returnInfo?.quantity || 0,
        };
      }),
    );

    return {
      ...sale.store_sales,
      store: sale.stores!,
      items: itemsWithReturns,
    };
  }

  private async generateStoreExchangeId(storeId: string): Promise<string> {
    const store = await db.select().from(stores).where(eq(stores.id, storeId)).get();
    if (!store) {
      throw new Error("Store not found");
    }

    const cleanStoreName = store.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    const existingExchangesCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeExchanges)
      .where(eq(storeExchanges.storeId, storeId));

    const nextNumber = (existingExchangesCount[0]?.count || 0) + 1;

    return `EXCH${cleanStoreName}${nextNumber.toString().padStart(2, "0")}`;
  }
}
