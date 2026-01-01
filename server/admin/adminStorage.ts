import {
  InsertRefreshToken,
  InsertUser,
  orders,
  RefreshToken,
  refreshTokens,
  sarees,
  storeSales,
  User,
  users,
} from "@shared/schema";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "server/db";
export interface IStorage {
  getAdminStats(): Promise<{
    totalUsers: number;
    totalSarees: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    lowStockItems: number;
    totalOnlineOrders: number;
    totalStoreSales: number;
    totalOnlineOrdersRevenue: number;
    totalStoresSalesRevenue: number;
  }>;
}

export class AdminRepository implements IStorage {
  // Stats
  async getAdminStats(): Promise<{
    totalUsers: number;
    totalSarees: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    lowStockItems: number;
    totalOnlineOrders: number;
    totalStoreSales: number;
    totalOnlineOrdersRevenue: number;
    totalStoresSalesRevenue: number;
  }> {
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [sareeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sarees)
      .where(eq(sarees.isActive, true));
    const [orderCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders);
    const [storeSalesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales);
    const [orderSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(orders)
      .where(eq(orders.status, "completed"));

    const [storeSalesSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(total_amount::numeric), 0)::float`,
      })
      .from(storeSales);

    const revenueSum = orderSum.sum + storeSalesSum.sum;
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.status, "created"));
    const [lowStockCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sarees)
      .where(and(eq(sarees.isActive, true), lte(sarees.totalStock, 10)));

    return {
      totalUsers: userCount?.count || 0,
      totalSarees: sareeCount?.count || 0,
      totalOnlineOrders: orderCount?.count || 0,
      totalStoreSales: storeSalesCount?.count || 0,
      totalOrders: (orderCount?.count || 0) + (storeSalesCount?.count || 0),
      totalRevenue: revenueSum || 0,
      pendingOrders: pendingCount?.count || 0,
      lowStockItems: lowStockCount?.count || 0,
      totalOnlineOrdersRevenue: storeSalesSum.sum || 0,
      totalStoresSalesRevenue: orderSum.sum || 0,
    };
  }
}

export const AdminServices = new AdminRepository();
