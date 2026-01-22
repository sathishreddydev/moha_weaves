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
    const lastWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastMonthStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const lastMonthEnd = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Batch all sales and revenue calculations into single query
    const [salesStats] = await db
      .select({
        todaySales: sql<number>`COUNT(*) FILTER (WHERE ${storeSales.createdAt} >= ${today})::int`,
        todayRevenue: sql<number>`COALESCE(SUM(total_amount::numeric) FILTER (WHERE ${storeSales.createdAt} >= ${today}), 0)::float`,
        totalSales: sql<number>`COUNT(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(total_amount::numeric), 0)::float`,
        thisWeekSales: sql<number>`COUNT(*) FILTER (WHERE ${storeSales.createdAt} >= ${thisWeekStart})::int`,
        lastWeekSales: sql<number>`COUNT(*) FILTER (WHERE ${storeSales.createdAt} >= ${lastWeekStart} AND ${storeSales.createdAt} < ${lastWeekEnd})::int`,
        thisMonthRevenue: sql<number>`COALESCE(SUM(total_amount::numeric) FILTER (WHERE ${storeSales.createdAt} >= ${thisMonthStart}), 0)::float`,
        lastMonthRevenue: sql<number>`COALESCE(SUM(total_amount::numeric) FILTER (WHERE ${storeSales.createdAt} >= ${lastMonthStart} AND ${storeSales.createdAt} < ${lastMonthEnd}), 0)::float`,
      })
      .from(storeSales)
      .where(eq(storeSales.storeId, storeId));

    // Batch inventory and stock request stats
    const [inventoryAndRequestStats] = await db
      .select({
        totalInventory: sql<number>`COALESCE(SUM(${storeInventory.quantity}), 0)::int`,
        pendingRequests: sql<number>`COUNT(*) FILTER (WHERE ${stockRequests.status} = 'pending')::int`,
        approvedRequests: sql<number>`COUNT(*) FILTER (WHERE ${stockRequests.status} = 'approved')::int`,
        dispatchedRequests: sql<number>`COUNT(*) FILTER (WHERE ${stockRequests.status} = 'dispatched')::int`,
        receivedRequests: sql<number>`COUNT(*) FILTER (WHERE ${stockRequests.status} = 'received')::int`,
      })
      .from(storeInventory)
      .leftJoin(stockRequests, eq(storeInventory.storeId, stockRequests.storeId))
      .where(eq(storeInventory.storeId, storeId));

    // Get top selling products and low stock products in parallel
    const [topProductsData, lowStockProductsData] = await Promise.all([
      db
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
            gte(storeSales.createdAt, thisMonthStart),
          ),
        )
        .groupBy(storeSaleItems.productId)
        .orderBy(sql`sum(${storeSaleItems.quantity}) DESC`)
        .limit(5),
      
      db
        .select()
        .from(storeInventory)
        .innerJoin(products, eq(storeInventory.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .where(
          and(
            eq(storeInventory.storeId, storeId),
            lte(storeInventory.quantity, 5), // REORDER_LEVEL = 5
          ),
        )
        .orderBy(storeInventory.quantity)
        .limit(10)
    ]);

    // Process low stock products
    const lowStockProducts = lowStockProductsData.map((row) => ({
      product: {
        ...row.products,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
      currentStock: row.store_inventory.quantity,
      reorderLevel: 5,
    }));

    // Calculate growth percentages
    const weeklySalesGrowth =
      salesStats.lastWeekSales > 0
        ? ((salesStats.thisWeekSales - salesStats.lastWeekSales) / salesStats.lastWeekSales) *
          100
        : 0;

    const monthlyRevenueGrowth =
      salesStats.lastMonthRevenue > 0
        ? ((salesStats.thisMonthRevenue - salesStats.lastMonthRevenue) /
            salesStats.lastMonthRevenue) *
          100
        : 0;

    return {
      todaySales: salesStats.todaySales || 0,
      todayRevenue: salesStats.todayRevenue || 0,
      totalInventory: inventoryAndRequestStats.totalInventory || 0,
      pendingRequests: inventoryAndRequestStats.pendingRequests || 0,
      totalSales: salesStats.totalSales || 0,
      totalRevenue: salesStats.totalRevenue || 0,
      weeklySalesGrowth: Math.round(weeklySalesGrowth * 10) / 10,
      monthlyRevenueGrowth: Math.round(monthlyRevenueGrowth * 10) / 10,
      lowStockProducts,
      recentSales: [],
      recentRequests: [],
      recentExchanges: [],
      requestStats: {
        pending: inventoryAndRequestStats.pendingRequests || 0,
        approved: inventoryAndRequestStats.approvedRequests || 0,
        dispatched: inventoryAndRequestStats.dispatchedRequests || 0,
        received: inventoryAndRequestStats.receivedRequests || 0,
      },
    };
  }
}

export const storeProductsStorage = new StoreProductsStorage();
