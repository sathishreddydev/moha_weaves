import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "server/db";
import { 
  StoreSaleWithItems,
  StoreSale,
  storeSaleItems,
  storeSales,
  stores,
  sarees,
  stockMovements,
  storeExchangeReturnItems,
  storeInventory,
  SareeWithDetails,
  StoreInventory
} from "@shared/schema";
import { createSareeJoins, transformSareeWithDetails } from "./storeHelpers";

export class SalesManagement {
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
    const saleId = await this.generateStoreSaleId(storeId);

    const [newSale] = await db
      .insert(storeSales)
      .values({
        id: saleId,
        storeId,
        processedBy,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        items: data.items.length,
        subtotalAmount: data.totalAmount - data.discountAmount - data.taxAmount,
        discountAmount: data.discountAmount,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        paymentMode: data.paymentMode,
        discountCode: data.discountCode,
      })
      .returning();

    // Update inventory and record stock movements
    for (const item of data.items) {
      // Update store inventory
      await db
        .update(storeInventory)
        .set({
          quantity: sql`${storeInventory.quantity} - ${item.quantity}`,
        })
        .where(
          and(
            eq(storeInventory.storeId, storeId),
            eq(storeInventory.sareeId, item.sareeId),
          ),
        );

      // Get current inventory for stock movement
      const [currentInventory] = await db
        .select()
        .from(storeInventory)
        .where(
          and(
            eq(storeInventory.storeId, storeId),
            eq(storeInventory.sareeId, item.sareeId),
          ),
        );

      // Insert sale item
      await db.insert(storeSaleItems).values({
        saleId: newSale.id,
        sareeId: item.sareeId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        lineAmount: item.lineAmount.toString(),
      });

      // Record stock movement (negative for deduction)
      await db.insert(stockMovements).values({
        sareeId: item.sareeId,
        quantity: -item.quantity,
        movementType: "sale",
        referenceId: newSale.id,
        referenceType: "store_sale",
        previousQuantity: currentInventory?.quantity || 0,
        newQuantity: (currentInventory?.quantity || 0) - item.quantity,
        storeId,
      });
    }

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

  async searchStoreSales(
    storeId: string,
    query: string,
  ): Promise<StoreSaleWithItems[]> {
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
        .call(createSareeJoins)
        .where(eq(storeSaleItems.saleId, row.store_sales.id));

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
        .call(createSareeJoins)
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
          saree: transformSareeWithDetails(itemRow),
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
        .call(createSareeJoins)
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
          saree: transformSareeWithDetails(itemRow),
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
        .call(createSareeJoins)
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
          saree: transformSareeWithDetails(itemRow),
        })),
      });
    }

    return result;
  }

  private async generateStoreSaleId(storeId: string): Promise<string> {
    // This will be moved to StoreManagement class
    // For now, keeping it here to maintain functionality
    const store = await db.select().from(stores).where(eq(stores.id, storeId)).get();
    if (!store) {
      throw new Error("Store not found");
    }

    const cleanStoreName = store.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    const existingSalesCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales)
      .where(eq(storeSales.storeId, storeId));

    const nextNumber = (existingSalesCount[0]?.count || 0) + 1;

    return `MOHA${cleanStoreName}${nextNumber.toString().padStart(2, "0")}`;
  }

  private async checkStoreSaleExchangeEligibility(
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
    // This will be moved to ExchangeManagement class
    // For now, keeping it here to maintain functionality
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
}
