import {
  InsertRefreshToken,
  InsertUser,
  orders,
  RefreshToken,
  refreshTokens,
  products,
  storeSales,
  User,
  users,
} from "@shared/schema";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "server/db";
export interface IStorage {
  getAdminStats(): Promise<{
    totalUsers: number;
    totalProducts: number;
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
    totalProducts: number;
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
    const [productCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.isActive, true));
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
      .from(products)
      .where(and(eq(products.isActive, true), lte(products.totalStock, 10)));

    return {
      totalUsers: userCount?.count || 0,
      totalProducts: productCount?.count || 0,
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
