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
  Store,
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
  categoryIds?: string[];
  subcategoryIds?: string[];
  colorIds?: string[];
  fabricIds?: string[];
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
  size?: string[];
  inStock?: boolean;
  minStock?: number;
  tags?: string[];
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

  // Helper method to fetch sale product mappings (optimized)
  private async getSaleProductMappings(saleIds?: string[]) {
    if (saleIds && saleIds.length > 0) {
      return await db
        .select()
        .from(saleProducts)
        .where(inArray(saleProducts.saleId, saleIds));
    }
    return await db.select().from(saleProducts);
  }

  // Helper method to resolve names to IDs for categories
  private async resolveCategoryNames(names: string[]) {
    if (names.length === 0) return [];
    const result = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.name, names));
    return result.map((c) => c.id);
  }

  // Helper method to resolve names to IDs for subcategories
  private async resolveSubcategoryNames(names: string[]) {
    if (names.length === 0) return [];
    const result = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(inArray(subcategories.name, names));
    return result.map((s) => s.id);
  }

  // Helper method to resolve names to IDs for colors
  private async resolveColorNames(names: string[]) {
    if (names.length === 0) return [];
    const result = await db
      .select({ id: colors.id })
      .from(colors)
      .where(inArray(colors.name, names));
    return result.map((c) => c.id);
  }

  // Helper method to resolve names to IDs for fabrics
  private async resolveFabricNames(names: string[]) {
    if (names.length === 0) return [];
    const result = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(inArray(fabrics.name, names));
    return result.map((f) => f.id);
  }

  // Helper method to find applicable sale for a product
  private findApplicableSale(
    productId: string,
    categoryId: string | null,
    activeSales: any[],
    saleProductMappings: any[],
  ) {
    // Check for product-specific sale
    const productSaleMapping = saleProductMappings.find(
      (sp) => sp.productId === productId,
    );
    let applicableSale = null;
    if (productSaleMapping) {
      applicableSale = activeSales.find(
        (s) => s.id === productSaleMapping.saleId,
      );
    }

    // Check for category-wide sale if no product-specific sale
    if (!applicableSale && categoryId) {
      applicableSale = activeSales.find(
        (s) =>
          s.categoryId === categoryId &&
          !saleProductMappings.some(
            (sp) => sp.saleId === s.id && sp.productId === productId,
          ),
      );
    }

    return applicableSale;
  }

  // Helper method to construct active sale object
  private constructActiveSaleObject(applicableSale: any) {
    return applicableSale
      ? {
          id: applicableSale.id,
          name: applicableSale.name,
          offerType: applicableSale.offerType,
          discountValue: applicableSale.discountValue,
          maxDiscount: applicableSale.maxDiscount || undefined,
        }
      : null;
  }

  private async resolveCategoryAndSubcategoryIds(categoryIds: string[]) {
    if (categoryIds.length === 0) return [];

    const categoriesResult = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, categoryIds));

    const selectedCategoryIds = categoriesResult.map((c) => c.id);

    // Get direct subcategories that were passed in IDs
    const directSubcategoriesResult = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(inArray(subcategories.id, categoryIds));

    const directSubcategoryIds = directSubcategoriesResult.map((s) => s.id);

    // Get subcategories under selected categories
    const expandedSubcategories =
      selectedCategoryIds.length > 0
        ? await db
            .select({ id: subcategories.id })
            .from(subcategories)
            .where(inArray(subcategories.categoryId, selectedCategoryIds))
        : [];

    return Array.from(
      new Set([
        ...directSubcategoryIds,
        ...expandedSubcategories.map((s) => s.id),
      ]),
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


  private static readonly SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

  private sortVariantsBySize(variants: any[]): any[] {
    return variants.sort((a, b) => {
      const indexA = RoleBasedProductService.SIZE_ORDER.indexOf(a.size);
      const indexB = RoleBasedProductService.SIZE_ORDER.indexOf(b.size);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.size.localeCompare(b.size);
    });
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
      );

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

    // Sort variants by logical size order (XS, S, M, L, XL, 2XL, 3XL)
    for (const [productId, variants] of productVariantMap) {
      productVariantMap.set(productId, this.sortVariantsBySize(variants));
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
    const incomingIds: string[] = filters.categoryIds ?? [];

    const finalSubcategoryIds =
      await this.resolveCategoryAndSubcategoryIds(incomingIds);

    if (finalSubcategoryIds.length) {
      conditions.push(inArray(products.subcategoryId, finalSubcategoryIds));
    }

    if (filters.colorIds?.length) {
      conditions.push(inArray(products.colorId, filters.colorIds));
    }

    if (filters.fabricIds?.length) {
      conditions.push(inArray(products.fabricId, filters.fabricIds));
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

    if (filters.storeId) {
      results = results.filter(p => {
        const hasStoreAllocation = p.storeAllocations?.some(
          (allocation: { storeId: string; storeName: string; quantity: number }) => allocation.storeId === filters.storeId
        );
        const hasVariantInStore = p.variants?.some((variant: any) =>
          variant.storeAllocations?.some(
            (storeAllocation: { storeId: string; storeName: string; quantity: number }) => storeAllocation.storeId === filters.storeId
          )
        );
        return hasStoreAllocation || hasVariantInStore;
      });
    }

    if (filters.size?.length) {
      results = results.filter(p => 
        p.variants?.some((variant: any) => 
          filters.size!.includes(variant.size)
        )
      );
    }

    if (filters.inStock) {
      results = results.filter(p => {
        if (!p.variants?.length) return (p.onlineStock || 0) > 0;
        const totalStock = p.variants.reduce((sum: number, variant: any) => {
          const onlineStock = variant.onlineStock || 0;
          const storeStock = Array.isArray(variant.storeAllocations)
            ? variant.storeAllocations.reduce((storeSum: number, allocation: { quantity: number }) =>
                storeSum + (allocation.quantity || 0), 0)
            : 0;
          return sum + onlineStock + storeStock;
        }, 0);
        return totalStock > 0;
      });
    }

    if (filters.minStock !== undefined) {
      results = results.filter(p => {
        if (!p.variants?.length) return (p.onlineStock || 0) >= filters.minStock!;
        const totalStock = p.variants.reduce((sum: number, variant: any) => {
          const onlineStock = variant.onlineStock || 0;
          const storeStock = Array.isArray(variant.storeAllocations)
            ? variant.storeAllocations.reduce((storeSum: number, allocation: { quantity: number }) =>
                storeSum + (allocation.quantity || 0), 0)
            : 0;
          return sum + onlineStock + storeStock;
        }, 0);
        return totalStock >= filters.minStock!;
      });
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
      });
    }

    return map;
  }


}

export const roleBasedProductService =
  new RoleBasedProductService();
