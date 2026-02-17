import {
  categories,
  colors,
  fabrics,
  orderItems,
  productActualPrices,
  products,
  ProductWithDetails,
  saleProducts,
  sales,
  storeInventory,
  stores,
  storeSaleItems,
  storeSales,
  subcategories,
  users
} from "@shared/schema";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
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
    totalStock: number;
    outOfStockCount: number;
    totalProfit: number;
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
    totalStock: number;
    outOfStockCount: number;
    totalProfit: number;
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
      .from(orderItems);
    const [storeSalesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales);
    const [orderSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(price * quantity), 0)::float`,
      })
      .from(orderItems)
      .where(eq(orderItems.status, "delivered"));

    const [storeSalesSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(price * quantity), 0)::float`,
      })
      .from(storeSaleItems);

    const revenueSum = orderSum.sum + storeSalesSum.sum;
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderItems)
      .where(eq(orderItems.status, "pending"));
    const [lowStockCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.isActive, true), lte(products.totalStock, 10)));

    const [totalStockResult] = await db
      .select({
        total: sql<number>`coalesce(sum(total_stock + online_stock), 0)::int`
      })
      .from(products)
      .where(eq(products.isActive, true));

    const [outOfStockResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.isActive, true), eq(products.totalStock, 0)));

    const completedOrders = await db
      .select({
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
      })
      .from(orderItems)
      .where(eq(orderItems.status, "delivered"));

    const completedStoreSales = await db
      .select({
        saleId: storeSaleItems.saleId,
        productId: storeSaleItems.productId,
        quantity: storeSaleItems.quantity,
        price: storeSaleItems.price,
      })
      .from(storeSaleItems);

    // Get all product IDs from orders and store sales
    const allSoldProductIds = [
      ...completedOrders.map(item => item.productId).filter(Boolean),
      ...completedStoreSales.map(item => item.productId).filter(Boolean)
    ];

    // Get actual prices for all sold products
    const actualPricesData =
      allSoldProductIds.length > 0
        ? await db
          .select({
            productId: productActualPrices.productId,
            actualPrice: productActualPrices.actualPrice,
          })
          .from(productActualPrices)
          .where(
            inArray(productActualPrices.productId, allSoldProductIds)
          )
        : [];


    // Create a map for efficient actual price lookup
    const actualPriceMap = actualPricesData.reduce(
      (acc, priceData) => {
        acc[priceData.productId] = parseFloat(priceData.actualPrice);
        return acc;
      },
      {} as Record<string, number>,
    );


    // Calculate total profit
    let totalProfit = 0;

    // Calculate profit from online orders - use order items data
    for (const order of completedOrders) {
      if (order.productId && actualPriceMap[order.productId] && order.quantity) {
        const actualPrice = actualPriceMap[order.productId];
        const sellingPrice = parseFloat(order.price || '0');
        const profitPerItem = sellingPrice - actualPrice;
        totalProfit += profitPerItem * order.quantity;
      } else {
        //
      }
    }

    // Calculate profit from store sales
    for (const sale of completedStoreSales) {
      if (sale.productId && actualPriceMap[sale.productId] && sale.quantity) {
        const actualPrice = actualPriceMap[sale.productId];
        const sellingPrice = parseFloat(sale.price || '0');
        const profitPerItem = sellingPrice - actualPrice;
        totalProfit += profitPerItem * sale.quantity;
      } else {
        //
      }
    }


    return {
      totalUsers: userCount?.count || 0,
      totalProducts: productCount?.count || 0,
      totalOnlineOrders: orderCount?.count || 0,
      totalStoreSales: storeSalesCount?.count || 0,
      totalOrders: (orderCount?.count || 0) + (storeSalesCount?.count || 0),
      totalRevenue: revenueSum || 0,
      pendingOrders: pendingCount?.count || 0,
      lowStockItems: lowStockCount?.count || 0,
      totalOnlineOrdersRevenue: orderSum?.sum || 0,
      totalStoresSalesRevenue: storeSalesSum?.sum || 0,
      totalStock: totalStockResult?.total || 0,
      outOfStockCount: outOfStockResult?.count || 0,
      totalProfit: totalProfit || 0,
    };
  }

}

export const AdminServices = new AdminRepository();
