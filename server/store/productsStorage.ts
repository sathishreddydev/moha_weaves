import {
  categories,
  colors,
  fabrics,
  products,
  stockRequests,
  storeExchanges,
  storeInventory,
  storeSales
} from "@shared/tables";
import {
  ProductWithDetails,
  StockRequestWithDetails,
  StoreExchangeWithDetails,
  StoreSaleWithItems,
} from "@shared/types";
import {
  and,
  eq,
  gte,
  lte,
  sql
} from "drizzle-orm";
import { db } from "server/db";

interface IStoreProductsStorage {
  getStoreStats(storeId: string, dateFrom?: Date, dateTo?: Date): Promise<{
    todaySales: number;
    todayRevenue: number;
    totalInventory: number;
    pendingRequests: number;
  }>;
}

export class StoreProductsStorage implements IStoreProductsStorage {

  async getStoreStats(
    storeId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{
    todaySales: number;
    todayRevenue: number;
    netTodayRevenue: number;
    totalInventory: number;
    pendingRequests: number;
    totalSales?: number;
    totalRevenue?: number;
    netRevenue: number;
    weeklySalesGrowth?: number;
    monthlyRevenueGrowth?: number;
    // Exchange stats
    totalExchanges?: number;
    exchangeReturnAmount?: number;
    exchangeNewAmount?: number;
    exchangeBalanceRevenue?: number; // extra paid by customer in exchanges
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
    dateRange?: {
      from: Date | null;
      to: Date | null;
      isFiltered: boolean;
    };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If a date range is provided, use it; otherwise use all-time
    const rangeStart = dateFrom ?? null;
    const rangeEnd = dateTo ?? null;
    const isFiltered = !!(rangeStart || rangeEnd);

    // --- Sales & Revenue (with optional date range) ---
    // Build WHERE conditions for storeSales
    const salesConditions: any[] = [eq(storeSales.storeId, storeId)];
    if (rangeStart) salesConditions.push(gte(storeSales.createdAt, rangeStart));
    if (rangeEnd) salesConditions.push(lte(storeSales.createdAt, rangeEnd));

    // "Period" = the selected range (or all-time if no range)
    // When date range is filtered, todaySales/todayRevenue should reflect the range
    const [salesStats] = await db
      .select({
        // If date range is selected, show range stats; otherwise show today's stats
        todaySales: isFiltered 
          ? sql<number>`COUNT(*)::int`
          : sql<number>`COUNT(*) FILTER (WHERE ${storeSales.createdAt} >= ${today})::int`,
        todayRevenue: isFiltered
          ? sql<number>`COALESCE(SUM(total_amount::numeric), 0)::float`
          : sql<number>`COALESCE(SUM(total_amount::numeric) FILTER (WHERE ${storeSales.createdAt} >= ${today}), 0)::float`,
        totalSales: sql<number>`COUNT(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(total_amount::numeric), 0)::float`,
        // Weekly comparison (always based on last 7/14 days for trend indicators)
        thisWeekSales: sql<number>`COUNT(*) FILTER (WHERE ${storeSales.createdAt} >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)})::int`,
        lastWeekSales: sql<number>`COUNT(*) FILTER (WHERE ${storeSales.createdAt} >= ${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)} AND ${storeSales.createdAt} < ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)})::int`,
        // Monthly comparison (always based on last 30/60 days for trend indicators)
        thisMonthRevenue: sql<number>`COALESCE(SUM(total_amount::numeric) FILTER (WHERE ${storeSales.createdAt} >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}), 0)::float`,
        lastMonthRevenue: sql<number>`COALESCE(SUM(total_amount::numeric) FILTER (WHERE ${storeSales.createdAt} >= ${new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)} AND ${storeSales.createdAt} < ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}), 0)::float`,
      })
      .from(storeSales)
      .where(and(...salesConditions));

    const exchangeConditions: any[] = [eq(storeExchanges.storeId, storeId)];
    if (rangeStart) exchangeConditions.push(gte(storeExchanges.createdAt, rangeStart));
    if (rangeEnd) exchangeConditions.push(lte(storeExchanges.createdAt, rangeEnd));

    const [exchangeStats] = await db
      .select({
        totalExchanges: sql<number>`COUNT(*)::int`,
        exchangeReturnAmount: sql<number>`COALESCE(SUM(return_amount::numeric), 0)::float`,
        exchangeNewAmount: sql<number>`COALESCE(SUM(new_items_amount::numeric), 0)::float`,
        exchangeBalanceRevenue: sql<number>`COALESCE(SUM(balance_amount::numeric) FILTER (WHERE balance_direction = 'due_from_customer'), 0)::float`,
      })
      .from(storeExchanges)
      .where(and(...exchangeConditions));

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
          lte(storeInventory.quantity, 5),
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
      reorderLevel: 5,
    }));

    // --- Growth percentages (always based on last 7/30 days for trend indicators) ---
    const weeklySalesGrowth =
      salesStats.lastWeekSales > 0
        ? ((salesStats.thisWeekSales - salesStats.lastWeekSales) / salesStats.lastWeekSales) * 100
        : 0;

    const monthlyRevenueGrowth =
      salesStats.lastMonthRevenue > 0
        ? ((salesStats.thisMonthRevenue - salesStats.lastMonthRevenue) / salesStats.lastMonthRevenue) * 100
        : 0;

    // Calculate net revenue (sales + extra exchange money - returned items)
    const netRevenue = (salesStats.totalRevenue || 0) + (exchangeStats.exchangeBalanceRevenue || 0);
    const netTodayRevenue = (salesStats.todayRevenue || 0);

    return {
      todaySales: salesStats.todaySales || 0,
      todayRevenue: salesStats.todayRevenue || 0,
      netTodayRevenue: netTodayRevenue,
      totalInventory: inventoryAndRequestStats.totalInventory || 0,
      pendingRequests: inventoryAndRequestStats.pendingRequests || 0,
      totalSales: salesStats.totalSales || 0,
      totalRevenue: salesStats.totalRevenue || 0,
      netRevenue: netRevenue,
      weeklySalesGrowth: Math.round(weeklySalesGrowth * 10) / 10,
      monthlyRevenueGrowth: Math.round(monthlyRevenueGrowth * 10) / 10,
      // Exchange stats
      totalExchanges: exchangeStats.totalExchanges || 0,
      exchangeReturnAmount: exchangeStats.exchangeReturnAmount || 0,
      exchangeNewAmount: exchangeStats.exchangeNewAmount || 0,
      exchangeBalanceRevenue: exchangeStats.exchangeBalanceRevenue || 0,
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
      dateRange: {
        from: rangeStart,
        to: rangeEnd,
        isFiltered,
      },
    };
  }
}

export const storeProductsStorage = new StoreProductsStorage();
