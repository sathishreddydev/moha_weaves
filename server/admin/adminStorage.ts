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
  categories,
  colors,
  fabrics,
  ProductWithDetails,
  saleProducts,
  sales,
  storeInventory,
  stores,
  subcategories,
  productActualPrices,
  orderItems,
  storeSaleItems,
} from "@shared/schema";
import { and, eq, gte, lte, sql, inArray } from "drizzle-orm";
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
  getAdminProduct(id: string): Promise<ProductWithDetails | undefined>;
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

  async getAdminProduct(id: string): Promise<ProductWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(eq(products.id, id));

    if (!result) return undefined;

    const product = result.products;

    // Fetch actual price
    const [actualPriceData] = await db
      .select()
      .from(productActualPrices)
      .where(eq(productActualPrices.productId, id))
      .limit(1);

    // Fetch store allocations with store names in a single query to avoid N+1
    const allocations = await db
      .select({
        storeId: storeInventory.storeId,
        quantity: storeInventory.quantity,
        storeName: stores.name,
      })
      .from(storeInventory)
      .leftJoin(stores, eq(storeInventory.storeId, stores.id))
      .where(eq(storeInventory.productId, product.id));

    const storeAllocations = allocations.map(alloc => ({
      storeId: alloc.storeId,
      storeName: alloc.storeName || "Unknown",
      quantity: alloc.quantity,
    }));

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

    // Find applicable sale (product-specific first, then category-wide)
    let applicableSale = null;

    // Check for product-specific sale
    const productSaleMapping = saleProductMappings.find(
      (sp) => sp.productId === product.id,
    );
    if (productSaleMapping) {
      applicableSale = activeSales.find(
        (s) => s.id === productSaleMapping.saleId,
      );
    }

    // Check for category-wide sale if no product-specific sale
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
          : originalPrice; // Cap at price if no maxDiscount
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

    const totalStoreStock = storeAllocations.reduce(
      (sum, alloc) => sum + alloc.quantity,
      0,
    );
    const unallocated = Math.max(
      0,
      product.totalStock - product.onlineStock - totalStoreStock,
    );

    return {
      ...product,
      category: result.categories,
      subcategory: result.subcategories,
      color: result.colors,
      fabric: result.fabrics,
      actualPrice: actualPriceData?.actualPrice ? parseFloat(actualPriceData.actualPrice) : null,
      storeAllocations,
      unallocated,
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
    };
  }
}

export const AdminServices = new AdminRepository();
