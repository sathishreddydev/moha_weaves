import {
  storeInventory,
  products,
  categories,
  subcategories,
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
 
  getStoreStats(storeId: string): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalInventory: number;
    pendingRequests: number;
  }>;
}
export class StoreProductsStorage implements IStoreProductsStorage {
 
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
