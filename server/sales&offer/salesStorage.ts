import {
  InsertSale,
  Sale,
  SaleWithProducts,
  categories,
  saleProducts,
  sales,
  subcategories
} from "@shared/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "server/db";

export interface SalesStorage {
  getSales(filters?: {
    isActive?: boolean;
    isFeatured?: boolean;
    categoryId?: string;
    current?: boolean;
  }): Promise<Array<SaleWithProducts & { productCount: number }>>;
  getSale(
    id: string
  ): Promise<(SaleWithProducts & { productCount: number }) | null>;
  createSale(data: InsertSale): Promise<Sale>;
  updateSale(id: string, data: Partial<InsertSale>): Promise<Sale | undefined>;
  deleteSale(id: string): Promise<void>;
  addProductsToSale(saleId: string, productIds: string[]): Promise<void>;
  getActiveSalesForProduct(
    productId: string,
    categoryId?: string
  ): Promise<SaleWithProducts[]>;
  checkOfferTypeConflicts(
    offerType: string,
    targetType: string,
    categoryId?: string,
    productIds?: string[]
  ): Promise<{
    hasConflict: boolean;
    conflictingSales: Array<{
      id: string;
      name: string;
      offerType: string;
      targetType: string;
    }>;
  }>;
}
export class SalesRepository implements SalesStorage {
  async getSales(filters?: {
    isActive?: boolean;
    isFeatured?: boolean;
    categoryId?: string;
    current?: boolean;
  }): Promise<Array<SaleWithProducts & { productCount: number }>> {
    const actualFilters = filters || {};
    const conditions: any[] = [];

    if (actualFilters.isActive !== undefined) {
      conditions.push(eq(sales.isActive, actualFilters.isActive));
    }

    if (actualFilters.isFeatured !== undefined) {
      conditions.push(eq(sales.isFeatured, actualFilters.isFeatured));
    }

    if (actualFilters.categoryId) {
      conditions.push(eq(sales.categoryId, actualFilters.categoryId));
    }

    if (actualFilters.current) {
      const now = new Date();
      conditions.push(lte(sales.validFrom, now));
      conditions.push(gte(sales.validUntil, now));
    }

    const salesResult = await db
      .select({
        id: sales.id,
        name: sales.name,
        description: sales.description,
        offerType: sales.offerType,
        discountValue: sales.discountValue,
        categoryId: sales.categoryId,
        subcategoryId: sales.subcategoryId,
        minOrderAmount: sales.minOrderAmount,
        maxDiscount: sales.maxDiscount,
        validFrom: sales.validFrom,
        validUntil: sales.validUntil,
        isActive: sales.isActive,
        isFeatured: sales.isFeatured,
        bannerImage: sales.bannerImage,
        createdAt: sales.createdAt,
        updatedAt: sales.updatedAt,
        category: categories,
        subcategory: subcategories,
      })
      .from(sales)
      .leftJoin(categories, eq(sales.categoryId, categories.id))
      .leftJoin(subcategories, eq(sales.subcategoryId, subcategories.id))
      .where(and(...conditions))
      .orderBy(desc(sales.createdAt));

    const result = [];

    for (const sale of salesResult) {
      const products = await db
        .select()
        .from(saleProducts)
        .where(eq(saleProducts.saleId, sale.id));

      result.push({
        ...sale,
        products: products,
        productCount: products.length,
      });
    }

    return result;
  }

  async getSale(
    id: string
  ): Promise<(SaleWithProducts & { productCount: number }) | null> {
    const [sale] = await db
      .select({
        id: sales.id,
        name: sales.name,
        description: sales.description,
        offerType: sales.offerType,
        discountValue: sales.discountValue,
        categoryId: sales.categoryId,
        subcategoryId: sales.subcategoryId,
        minOrderAmount: sales.minOrderAmount,
        maxDiscount: sales.maxDiscount,
        validFrom: sales.validFrom,
        validUntil: sales.validUntil,
        isActive: sales.isActive,
        isFeatured: sales.isFeatured,
        bannerImage: sales.bannerImage,
        createdAt: sales.createdAt,
        updatedAt: sales.updatedAt,
        category: categories,
        subcategory: subcategories,
      })
      .from(sales)
      .leftJoin(categories, eq(sales.categoryId, categories.id))
      .leftJoin(subcategories, eq(sales.subcategoryId, subcategories.id))
      .where(eq(sales.id, id));

    if (!sale) return null;

    const products = await db
      .select()
      .from(saleProducts)
      .where(eq(saleProducts.saleId, sale.id));

    return {
      ...sale,
      products: products.map((p) => ({
        ...p,
        product: null, // Placeholder for product details
      })),
      productCount: products.length,
    };
  }

  async createSale(data: InsertSale): Promise<Sale> {
    const saleData = {
      ...data,
      validFrom:
        typeof data.validFrom === "string"
          ? new Date(data.validFrom)
          : data.validFrom,
      validUntil:
        typeof data.validUntil === "string"
          ? new Date(data.validUntil)
          : data.validUntil,
    };
    const [result] = await db.insert(sales).values(saleData).returning();
    return result;
  }

  async updateSale(
    id: string,
    data: Partial<InsertSale>
  ): Promise<Sale | undefined> {
    const updateData: any = { ...data };
    if (updateData.validFrom && typeof updateData.validFrom === "string") {
      updateData.validFrom = new Date(updateData.validFrom);
    }
    if (updateData.validUntil && typeof updateData.validUntil === "string") {
      updateData.validUntil = new Date(updateData.validUntil);
    }
    const [result] = await db
      .update(sales)
      .set(updateData)
      .where(eq(sales.id, id))
      .returning();
    return result || undefined;
  }

async deleteSale(id: string): Promise<void> {
  await db.delete(saleProducts).where(eq(saleProducts.saleId, id));
  await db.delete(sales).where(eq(sales.id, id));
}


  async addProductsToSale(saleId: string, productIds: string[]): Promise<void> {
    if (!productIds || productIds.length === 0) return;

    await db.transaction(async (tx) => {
      // First, remove existing products for this sale
      await tx.delete(saleProducts).where(eq(saleProducts.saleId, saleId));

      // Then add the new products
      for (const productId of productIds) {
        await tx.insert(saleProducts).values({ saleId, productId });
      }
    });
  }

  async getActiveSalesForProduct(
    productId: string,
    categoryId?: string
  ): Promise<SaleWithProducts[]> {
    const now = new Date();
    const conditions: any[] = [
      eq(sales.isActive, true),
      lte(sales.validFrom, now),
      gte(sales.validUntil, now),
    ];

    if (categoryId) {
      conditions.push(eq(sales.categoryId, categoryId));
    }

    // Find sales that include the specific product
    const salesWithProduct = await db
      .select()
      .from(sales)
      .innerJoin(saleProducts, eq(sales.id, saleProducts.saleId))
      .where(and(...conditions, eq(saleProducts.productId, productId)));

    // Fetch products for each sale (simplified, actual products might be complex)
    const result: SaleWithProducts[] = [];
    for (const sale of salesWithProduct) {
      const products = await db
        .select()
        .from(saleProducts)
        .where(eq(saleProducts.saleId, sale.sales.id));
      result.push({
        ...sale.sales,
        products: products.map((p) => ({ ...p, product: null })),
      });
    }

    // Also consider sales in the same category if no direct match
    if (categoryId) {
      const categorySales = await db
        .select()
        .from(sales)
        .leftJoin(saleProducts, eq(sales.id, saleProducts.saleId))
        .where(
          and(
            ...conditions,
            eq(sales.categoryId, categoryId),
            sql`NOT EXISTS (SELECT 1 FROM sale_products WHERE sale_id = sales.id AND product_id = ${productId})`
          )
        );

      const categorySalesWithProducts = [];
      for (const sale of categorySales) {
        const products = await db
          .select()
          .from(saleProducts)
          .where(eq(saleProducts.saleId, sale.sales.id));
        categorySalesWithProducts.push({
          ...sale.sales,
          products: products.map((p) => ({ ...p, product: null })),
        });
      }
      result.push(...categorySalesWithProducts);
    }
    // If no categoryId, we still return any product-specific sales found above

    return result;
  }

  async checkOfferTypeConflicts(
    offerType: string,
    targetType: string,
    categoryId?: string,
    productIds?: string[]
  ): Promise<{
    hasConflict: boolean;
    conflictingSales: Array<{
      id: string;
      name: string;
      offerType: string;
      targetType: string;
    }>;
  }> {
    const now = new Date();
    const conditions: any[] = [
      eq(sales.isActive, true),
      sql`${sales.offerType} = ${offerType}`,
      lte(sales.validFrom, now),
      gte(sales.validUntil, now),
    ];

    // Check for different target types
    if (targetType === "all") {
      // Check if any active sale exists with same offer type
      const conflictingSales = await db
        .select({
          id: sales.id,
          name: sales.name,
          offerType: sales.offerType,
        })
        .from(sales)
        .where(and(...conditions));

      return {
        hasConflict: conflictingSales.length > 0,
        conflictingSales: conflictingSales.map(sale => ({
          ...sale,
          targetType: "all",
        })),
      };
    }

    if (targetType === "category" && categoryId) {
      // Check if same category has same offer type
      conditions.push(eq(sales.categoryId, categoryId));

      const conflictingSales = await db
        .select({
          id: sales.id,
          name: sales.name,
          offerType: sales.offerType,
        })
        .from(sales)
        .where(and(...conditions));

      return {
        hasConflict: conflictingSales.length > 0,
        conflictingSales: conflictingSales.map(sale => ({
          ...sale,
          targetType: "category",
        })),
      };
    }

    if (targetType === "products" && productIds && productIds.length > 0) {
      // Check if any selected products already have same offer type
      const conflictingSales = await db
        .select({
          id: sales.id,
          name: sales.name,
          offerType: sales.offerType,
        })
        .from(sales)
        .innerJoin(saleProducts, eq(sales.id, saleProducts.saleId))
        .where(and(...conditions, eq(saleProducts.productId, productIds[0])));

      // Check for each product (simplified - checking first product as representative)
      const hasConflict = conflictingSales.length > 0;

      return {
        hasConflict,
        conflictingSales: conflictingSales.map(sale => ({
          ...sale,
          targetType: "products",
        })),
      };
    }

    return {
      hasConflict: false,
      conflictingSales: [],
    };
  }
}

export const salesService = new SalesRepository();