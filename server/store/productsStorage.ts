import {
  storeInventory,
  products,
  categories,
  colors,
  fabrics,
  sales,
  saleProducts,
  stockRequests,
  stores,
  storeSaleItems,
  storeSales,
} from "@shared/tables";
import {
  ProductWithDetails,
  StockRequestWithDetails,
  StoreExchangeWithDetails,
  StoreSaleWithItems,
} from "@shared/types";
import {
  eq,
  or,
  ilike,
  gte,
  lte,
  and,
  desc,
  sql,
  inArray,
  lt,
} from "drizzle-orm";
import { db } from "server/db";
interface IStoreProductsStorage {
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
    data: { product: ProductWithDetails; storeStock: number }[];
    total: number;
    totalProducts?: number;
    inStockProducts?: number;
    outOfStockProducts?: number;
  }>;
  getStoreStats(storeId: string): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalInventory: number;
    pendingRequests: number;
  }>;
}
export class StoreProductsStorage implements IStoreProductsStorage {
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
    data: {
      product: ProductWithDetails;
      storeStock: number;
      stockRequests: any[];
    }[];
    total: number;
    totalProducts?: number;
    inStockProducts?: number;
    outOfStockProducts?: number;
  }> {
    const conditions = [eq(storeInventory.storeId, storeId)];

    // Filter by search term (product name or SKU)
    if (options.search) {
      conditions.push(
        or(
          ilike(products.name, `%${options.search}%`),
          ilike(products.sku, `%${options.search}%`),
        )!,
      );
    }

    // Filter by category ID
    if (options.categoryId) {
      conditions.push(eq(products.categoryId, options.categoryId));
    }

    // Filter by color ID
    if (options.colorId) {
      conditions.push(eq(products.colorId, options.colorId));
    }

    // Filter by fabric ID
    if (options.fabricId) {
      conditions.push(eq(products.fabricId, options.fabricId));
    }

    // Date filters (based on product creation date)
    if (options.dateFrom) {
      conditions.push(gte(products.createdAt, new Date(options.dateFrom)));
    }

    if (options.dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(options.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(products.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    const [allProducts, countResult] = await Promise.all([
      db
        .select()
        .from(storeInventory)
        .innerJoin(products, eq(storeInventory.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .where(whereClause)
        .orderBy(desc(products.createdAt))
        .limit(options.limit)
        .offset(options.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeInventory)
        .innerJoin(products, eq(storeInventory.productId, products.id))
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

    // Fetch stock requests for all products in the result (batch query - efficient)
    const productIds = allProducts.map((row) => row.products.id);
    const stockRequestsData =
      productIds.length > 0
        ? await db
            .select()
            .from(stockRequests)
            .innerJoin(stores, eq(stockRequests.storeId, stores.id))
            .where(
              and(
                eq(stockRequests.storeId, storeId),
                inArray(stockRequests.productId, productIds),
              ),
            )
            .orderBy(desc(stockRequests.createdAt))
        : [];

    // Group stock requests by product ID for efficient lookup
    const stockRequestsByProduct = stockRequestsData.reduce(
      (acc, row) => {
        const productId = row.stock_requests.productId;
        if (!acc[productId]) {
          acc[productId] = [];
        }
        // Only include essential fields that frontend needs
        acc[productId].push({
          ...row.stock_requests,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    const data = allProducts.map((row) => {
      const product = row.products;

      // Find applicable sale
      let applicableSale = null;
      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.productId === product.id,
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId,
        );
      }
      // Only exclude category pricing when THIS product is explicitly mapped to a different sale
      if (!applicableSale && product.categoryId) {
        applicableSale = activeSales.find(
          (s) =>
            s.categoryId === product.categoryId &&
            !saleProductMappings.some(
              (sp) => sp.saleId === s.id && sp.productId === product.id,
            ),
        );
      }

      // Calculate discounted price using consistent logic across all flows
      let discountedPrice = parseFloat(product.price);
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
            : originalPrice;
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
        product: {
          ...product,
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
        stockRequests: stockRequestsByProduct[product.id] || [],
      };
    });

    const allProductsStats = await db
      .select({
        totalProducts: sql<number>`COUNT(*)::int`,
        inStockProducts: sql<number>`
      COUNT(*) FILTER (WHERE ${storeInventory.quantity} > 0)::int
    `,
        outOfStockProducts: sql<number>`
      COUNT(*) FILTER (WHERE ${storeInventory.quantity} = 0)::int
    `,
      })
      .from(storeInventory)
      .where(eq(storeInventory.storeId, storeId));

    const stats = allProductsStats[0] ?? {
      totalProducts: 0,
      inStockProducts: 0,
      outOfStockProducts: 0,
    };

    return {
      data,
      total: countResult[0]?.count || 0,
      totalProducts: stats.totalProducts,
      inStockProducts: stats.inStockProducts,
      outOfStockProducts: stats.outOfStockProducts,
    };
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
      product: ProductWithDetails;
      quantity: number;
      revenue: number;
    }>;
    lowStockProducts?: Array<{
      product: ProductWithDetails;
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
        productId: storeSaleItems.productId,
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
      .groupBy(storeSaleItems.productId)
      .orderBy(sql`sum(${storeSaleItems.quantity}) DESC`)
      .limit(5);

    // Low stock products - simplified query
    const REORDER_LEVEL = 5;
    const lowStockProductsData = await db
      .select()
      .from(storeInventory)
      .innerJoin(products, eq(storeInventory.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(
        and(
          eq(storeInventory.storeId, storeId),
          lte(storeInventory.quantity, REORDER_LEVEL),
        ),
      )
      .orderBy(storeInventory.quantity)
      .limit(10);

    const lowStockProducts = lowStockProductsData.map((row) => ({
      product: {
        ...row.products,
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
}

export const storeProductsStorage = new StoreProductsStorage();
