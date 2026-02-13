import {
  ProductWithDetails,
  products,
  categories,
  subcategories,
  colors,
  fabrics,
  sales,
  saleProducts,
  productVariants,
  variantStoreInventory,
  storeInventory,
  stores,
  productActualPrices,
  productSeo,
} from "@shared/schema";

import {
  eq,
  and,
  or,
  ilike,
  gte,
  lte,
  desc,
  asc,
  inArray,
} from "drizzle-orm";

import { db } from "server/db";

export interface ProductFilters {
  search?: string;
  sku?: string;
  category?: string[];
  subcategory?: string[];
  color?: string[];
  fabric?: string[];
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  distributionChannel?: "shop" | "online" | "both";
  sort?: string;
  limit?: number;
  offset?: number;
  onSale?: boolean;
  ids?: string[];
  storeId?: string;
}

export type UserRole = "user" | "admin" | "inventory" | "store";

export class RoleBasedProductService {

  private async getActiveSales() {
    const now = new Date();

    return db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now),
        )
      );
  }

  private async getSaleMappings(saleIds: string[]) {
    if (!saleIds.length) return [];

    return db
      .select()
      .from(saleProducts)
      .where(inArray(saleProducts.saleId, saleIds));
  }

  private calculateDiscountedPrice(price: number, sale: any) {
    if (!sale) return undefined;

    let discounted = price;

    if (
      sale.offerType === "percentage" ||
      sale.offerType === "category" ||
      sale.offerType === "flash_sale"
    ) {
      const percent = Number(sale.discountValue);
      const discount = price * (percent / 100);
      const maxDiscount = sale.maxDiscount
        ? Number(sale.maxDiscount)
        : price;

      discounted = price - Math.min(discount, maxDiscount);
    }

    if (sale.offerType === "flat" || sale.offerType === "product") {
      const flat = Number(sale.discountValue);
      discounted = price - Math.min(flat, price);
    }

    return Math.max(0, discounted);
  }


  private async getVariantsForProducts(productIds: string[], userRole: UserRole = "admin") {
    if (!productIds.length) return new Map();

    const rows = await db
      .select({
        variant: productVariants,
        storeId: variantStoreInventory.storeId,
        quantity: variantStoreInventory.quantity,
        storeName: stores.name,
      })
      .from(productVariants)
      .leftJoin(
        variantStoreInventory,
        eq(productVariants.id, variantStoreInventory.variantId)
      )
      .leftJoin(stores, eq(variantStoreInventory.storeId, stores.id))
      .where(
        and(
          inArray(productVariants.productId, productIds),
          eq(productVariants.isActive, true)
        )
      )
      .orderBy(asc(productVariants.size));

    const productVariantMap = new Map<string, any[]>();

    for (const row of rows) {
      const productId = row.variant.productId;

      if (!productVariantMap.has(productId)) {
        productVariantMap.set(productId, []);
      }

      const variants = productVariantMap.get(productId)!;

      let existing = variants.find(v => v.id === row.variant.id);

      if (!existing) {
        existing = {
          ...row.variant,
          storeAllocations: userRole === "user" ? undefined : [],
        };
        
        // Hide onlineStock for store role
        if (userRole === "store") {
          delete existing.onlineStock;
        }
        
        variants.push(existing);
      }

      // Only add store allocations if role is not "user"
      if (row.storeId && userRole !== "user") {
        existing.storeAllocations.push({
          storeId: row.storeId,
          storeName: row.storeName ?? "Unknown",
          quantity: row.quantity,
        });
      }
    }

    return productVariantMap;
  }


  async getProductsByRole(
    filters: ProductFilters = {},
    role: UserRole = "user",
  ): Promise<ProductWithDetails[]> {

    const conditions: any[] = [eq(products.isActive, true)];

    if (filters.ids?.length)
      conditions.push(inArray(products.id, filters.ids));

    if (filters.sku)
      conditions.push(eq(products.sku, filters.sku));

    if (filters.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.description, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`)
        )
      );
    }

    if (filters.featured)
      conditions.push(eq(products.isFeatured, true));

    if (filters.distributionChannel === "online") {
      conditions.push(
        or(
          eq(products.distributionChannel, "online"),
          eq(products.distributionChannel, "both")
        )
      );
    }

    if (filters.distributionChannel === "shop") {
      conditions.push(
        or(
          eq(products.distributionChannel, "shop"),
          eq(products.distributionChannel, "both")
        )
      );
    }

    let orderBy: any = desc(products.createdAt);

    if (filters.sort === "price-low") orderBy = asc(products.price);
    if (filters.sort === "price-high") orderBy = desc(products.price);
    if (filters.sort === "name") orderBy = asc(products.name);

    const rows = await db
      .select({
        product: products,
        category: categories,
        subcategory: subcategories,
        color: colors,
        fabric: fabrics,
        actualPrice: productActualPrices.actualPrice,
        seo: productSeo,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .leftJoin(
        productActualPrices,
        eq(products.id, productActualPrices.productId)
      )
      .leftJoin(
        productSeo,
        eq(products.id, productSeo.productId)
      )
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(filters.limit ?? 100)
      .offset(filters.offset ?? 0);

    const productMap = new Map<string, any>();

    for (const row of rows) {
      if (!productMap.has(row.product.id)) {
        productMap.set(row.product.id, {
          ...row.product,
          category: row.category,
          subcategory: row.subcategory,
          color: row.color,
          fabric: row.fabric,
          actualPrice: row.actualPrice ?? null,
          // Add SEO data
          seoTitle: row.seo?.seoTitle || null,
          seoDescription: row.seo?.seoDescription || null,
          seoKeywords: row.seo?.seoKeywords || null,
          metaTags: row.seo?.metaTags || null,
          urlSlug: row.seo?.urlSlug || null,
        });
      }
    }

    let results = Array.from(productMap.values());
    if (!results.length) return [];

    const activeSales = await this.getActiveSales();
    const saleMappings = await this.getSaleMappings(
      activeSales.map(s => s.id)
    );

    const productSaleMap = new Map<string, any>();

    for (const mapping of saleMappings) {
      productSaleMap.set(mapping.productId, mapping.saleId);
    }


    const variantMap = await this.getVariantsForProducts(
      results.map(p => p.id),role
    );
    const storeAllocationMap =
      await this.getStoreAllocationsForProducts(
        results.map(p => p.id)
      );


    results = results.map(product => {
      const basePrice = Number(product.price);

      let sale = null;

      if (productSaleMap.has(product.id)) {
        sale = activeSales.find(
          s => s.id === productSaleMap.get(product.id)
        );
      } else if (product.categoryId) {
        sale = activeSales.find(
          s => s.categoryId === product.categoryId
        );
      }

      const discountedPrice = sale
        ? this.calculateDiscountedPrice(basePrice, sale)
        : undefined;

      return {
        ...product,
        variants: variantMap.get(product.id) ?? [],
        storeAllocations: role === "user" ? undefined : storeAllocationMap.get(product.id) ?? [],
        activeSale: sale ?? null,
        discountedPrice,
      };
    });


    if (filters.minPrice !== undefined) {
      results = results.filter(p =>
        (p.discountedPrice ?? Number(p.price)) >= filters.minPrice!
      );
    }

    if (filters.maxPrice !== undefined) {
      results = results.filter(p =>
        (p.discountedPrice ?? Number(p.price)) <= filters.maxPrice!
      );
    }

    if (filters.onSale) {
      results = results.filter(p => p.activeSale !== null);
    }

    return results;
  }

  async getProductByRole(id: string, role: UserRole = "user") {
    const products = await this.getProductsByRole(
      { ids: [id], limit: 1 },
      role
    );
    return products[0];
  }

  async getProductBySkuByRole(sku: string, role: UserRole = "user") {
    const products = await this.getProductsByRole(
      { sku, limit: 1 },
      role
    );
    return products[0];
  }

  private async getStoreAllocationsForProducts(productIds: string[]) {
    if (!productIds.length) return new Map<string, any[]>();

    const rows = await db
      .select({
        productId: storeInventory.productId,
        storeId: storeInventory.storeId,
        storeName: stores.name,
        quantity: storeInventory.quantity,
        updatedAt: storeInventory.updatedAt,
      })
      .from(storeInventory)
      .leftJoin(stores, eq(storeInventory.storeId, stores.id))
      .where(
        and(
          inArray(storeInventory.productId, productIds),
          eq(stores.isActive, true)
        )
      )
      .orderBy(asc(stores.name));

    const map = new Map<string, any[]>();

    for (const row of rows) {
      if (!map.has(row.productId)) {
        map.set(row.productId, []);
      }

      map.get(row.productId)!.push({
        storeId: row.storeId,
        storeName: row.storeName,
        quantity: row.quantity,
        updatedAt: row.updatedAt,
      });
    }

    return map;
  }


}

export const roleBasedProductService =
  new RoleBasedProductService();
