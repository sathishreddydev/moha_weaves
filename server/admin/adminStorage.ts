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
} from "@shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
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

    // Fetch store allocations
    const allocations = await db
      .select({
        storeId: storeInventory.storeId,
        quantity: storeInventory.quantity,
      })
      .from(storeInventory)
      .where(eq(storeInventory.productId, product.id));

    const storeAllocations = await Promise.all(
      allocations.map(async (alloc) => {
        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, alloc.storeId));
        return {
          storeId: alloc.storeId,
          storeName: store?.name || "Unknown",
          quantity: alloc.quantity,
        };
      }),
    );

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
