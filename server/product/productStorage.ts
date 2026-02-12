import {
  ProductWithDetails,
  Product,
  products,
  categories,
  subcategories,
  colors,
  fabrics,
  InsertProduct,
  sales,
  saleProducts,
  stockRequests,
  storeInventory,
  stores,
  productActualPrices,
  productVariants,
  variantStoreInventory,
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
  sql,
} from "drizzle-orm";
import { db } from "server/db";
import { IproductRepository } from "./types";

export class productRepository implements IproductRepository {
  private async getActiveSales() {
    const now = new Date();
    return await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now),
        ),
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

  // Helper method to calculate discounted price
  private calculateDiscountedPrice(originalPrice: number, applicableSale: any) {
    let discountedPrice = originalPrice;
    if (applicableSale) {
      if (
        applicableSale.offerType === "percentage" ||
        applicableSale.offerType === "category" ||
        applicableSale.offerType === "flash_sale"
      ) {
        const discount =
          originalPrice * (parseFloat(applicableSale.discountValue) / 100);
        const maxDiscount = applicableSale.maxDiscount
          ? parseFloat(applicableSale.maxDiscount)
          : originalPrice;
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
    return discountedPrice;
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

    // Get direct subcategories that were passed in the IDs
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

  async createProduct(product: InsertProduct): Promise<Product> {
    let productData = product;
    if (!product.sku) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();
      const generatedSku = `MH-${dateStr}-${randomSuffix}`;
      productData = { ...product, sku: generatedSku };
    }
    const [result] = await db.insert(products).values(productData).returning();
    return result;
  }

  async updateProduct(
    id: string,
    data: Partial<InsertProduct>,
  ): Promise<Product | undefined> {
    const [result] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return result || undefined;
  }

  async deleteProducts(ids: string[]): Promise<string[]> {
    const deleted = await db
      .update(products)
      .set({ isActive: false })
      .where(inArray(products.id, ids))
      .returning({ id: products.id });

    return deleted.map((row) => row.id);
  }

}

export const productService = new productRepository();
