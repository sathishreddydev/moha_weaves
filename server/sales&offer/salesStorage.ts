import {
  SaleWithProducts,
  sales,
  saleProducts,
  InsertSale,
  Sale,
} from "@shared/schema";
import { eq, lte, gte, and, desc, sql } from "drizzle-orm";
import { db } from "server/db";

export interface SalesStorage {
  // ==================== SALES & OFFERS ====================
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
  addProductsToSale(saleId: string, sareeIds: string[]): Promise<void>;
  getActiveSalesForSaree(
    sareeId: string,
    categoryId?: string
  ): Promise<SaleWithProducts[]>;
}
export class SalesRepository implements SalesStorage {
  // ==================== SALES & OFFERS ====================
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
      .select()
      .from(sales)
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
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    if (!sale) return null;

    const products = await db
      .select()
      .from(saleProducts)
      .where(eq(saleProducts.saleId, sale.id));

    return {
      ...sale,
      products: products.map((p) => ({
        ...p,
        saree: null, // Placeholder for saree details
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


  async addProductsToSale(saleId: string, sareeIds: string[]): Promise<void> {
    if (!sareeIds || sareeIds.length === 0) return;

    await db.transaction(async (tx) => {
      // First, remove existing products for this sale
      await tx.delete(saleProducts).where(eq(saleProducts.saleId, saleId));

      // Then add the new products
      for (const sareeId of sareeIds) {
        await tx.insert(saleProducts).values({ saleId, sareeId });
      }
    });
  }

  async getActiveSalesForSaree(
    sareeId: string,
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

    // Find sales that include the specific saree
    const salesWithSaree = await db
      .select()
      .from(sales)
      .innerJoin(saleProducts, eq(sales.id, saleProducts.saleId))
      .where(and(...conditions, eq(saleProducts.sareeId, sareeId)));

    // Fetch products for each sale (simplified, actual products might be complex)
    const result: SaleWithProducts[] = [];
    for (const sale of salesWithSaree) {
      const products = await db
        .select()
        .from(saleProducts)
        .where(eq(saleProducts.saleId, sale.sales.id));
      result.push({
        ...sale.sales,
        products: products.map((p) => ({ ...p, saree: null })),
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
            sql`NOT EXISTS (SELECT 1 FROM sale_products WHERE sale_id = sales.id AND saree_id = ${sareeId})`
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
          products: products.map((p) => ({ ...p, saree: null })),
        });
      }
      result.push(...categorySalesWithProducts);
    }

    return result;
  }
}

export const salesService = new SalesRepository();