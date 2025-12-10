import {
  SareeWithDetails,
  sarees,
  categories,
  colors,
  fabrics,
  InsertSaree,
  Saree,
  sales,
  saleProducts,
} from "@shared/schema";
import { eq, and, or, ilike, gte, lte, desc, asc, inArray } from "drizzle-orm";
import { db } from "server/db";

export interface ISareeRepository {
  getSarees(filters?: {
    search?: string;
    category?: string;
    color?: string;
    fabric?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    distributionChannel?: string;
    sort?: string;
    limit?: number;
    onSale?: boolean;
  }): Promise<SareeWithDetails[]>;
  getSaree(id: string): Promise<SareeWithDetails | undefined>;
  createSaree(saree: InsertSaree): Promise<Saree>;
  updateSaree(
    id: string,
    data: Partial<InsertSaree>
  ): Promise<Saree | undefined>;
  deleteSaree(id: string): Promise<boolean>;
  getLowStockSarees(threshold?: number): Promise<SareeWithDetails[]>;
}
export class SareeRepository {
  async getSarees(filters?: {
    search?: string;
    category?: string;
    color?: string;
    fabric?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    distributionChannel?: string;
    sort?: string;
    limit?: number;
    onSale?: boolean;
  }): Promise<SareeWithDetails[]> {
    const conditions = [eq(sarees.isActive, true)];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(sarees.name, `%${filters.search}%`),
          ilike(sarees.description, `%${filters.search}%`)
        ) as any
      );
    }
    if (filters?.category) {
      conditions.push(eq(sarees.categoryId, filters.category));
    }
    if (filters?.color) {
      conditions.push(eq(sarees.colorId, filters.color));
    }
    if (filters?.fabric) {
      conditions.push(eq(sarees.fabricId, filters.fabric));
    }
    if (filters?.featured) {
      conditions.push(eq(sarees.isFeatured, true));
    }
    if (filters?.minPrice) {
      conditions.push(gte(sarees.price, filters.minPrice.toString()));
    }
    if (filters?.maxPrice) {
      conditions.push(lte(sarees.price, filters.maxPrice.toString()));
    }
    if (filters?.distributionChannel) {
      if (filters.distributionChannel === "online") {
        conditions.push(
          or(
            eq(sarees.distributionChannel, "online"),
            eq(sarees.distributionChannel, "both")
          ) as any
        );
      } else if (filters.distributionChannel === "shop") {
        conditions.push(
          or(
            eq(sarees.distributionChannel, "shop"),
            eq(sarees.distributionChannel, "both")
          ) as any
        );
      }
    }

    let orderBy: any = desc(sarees.createdAt);
    if (filters?.sort === "price-low") {
      orderBy = asc(sarees.price);
    } else if (filters?.sort === "price-high") {
      orderBy = desc(sarees.price);
    } else if (filters?.sort === "name") {
      orderBy = asc(sarees.name);
    }

    const result = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(filters?.limit || 100);

    const sareeResults = result.map((row) => ({
      ...row.sarees,
      category: row.categories,
      color: row.colors,
      fabric: row.fabrics,
    }));

    // Get active sales
    const now = new Date();
    const activeSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now)
        )
      );

    // Get sale products mapping
    const saleProductMappings = await db
      .select()
      .from(saleProducts)
      .where(
        inArray(
          saleProducts.saleId,
          activeSales.map((s) => s.id)
        )
      );

    // Build the results with relationships and sales
    const results: SareeWithDetails[] = sareeResults.map((saree) => {
      // Find applicable sale (product-specific first, then category-wide)
      let applicableSale = null;

      // Check for product-specific sale (sale has this product in saleProducts table)
      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.sareeId === saree.id
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId
        );
      }

      // Check for category-wide sale if no product-specific sale
      // Category sales have categoryId set and no specific products
      if (!applicableSale && saree.categoryId) {
        applicableSale = activeSales.find(
          (s) => s.categoryId === saree.categoryId && 
          !saleProductMappings.some(sp => sp.saleId === s.id)
        );
      }

      // Calculate discounted price
      let discountedPrice = parseFloat(saree.price);
      if (applicableSale) {
        // Apply discount based on type (percentage or flat)
        if (applicableSale.offerType === "percentage" || applicableSale.offerType === "category") {
          const discount = discountedPrice * (parseFloat(applicableSale.discountValue) / 100);
          const maxDiscount = applicableSale.maxDiscount 
            ? parseFloat(applicableSale.maxDiscount) 
            : Infinity;
          discountedPrice -= Math.min(discount, maxDiscount);
        } else if (applicableSale.offerType === "flat" || applicableSale.offerType === "product") {
          discountedPrice -= parseFloat(applicableSale.discountValue);
        } else if (applicableSale.offerType === "flash_sale") {
          // Flash sales use percentage discount
          const discount = discountedPrice * (parseFloat(applicableSale.discountValue) / 100);
          const maxDiscount = applicableSale.maxDiscount 
            ? parseFloat(applicableSale.maxDiscount) 
            : Infinity;
          discountedPrice -= Math.min(discount, maxDiscount);
        }
        discountedPrice = Math.max(0, discountedPrice);
      }

      return {
        ...saree,
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
    });

    // Apply onSale filter if requested
    const filteredResults = filters?.onSale 
      ? results.filter(r => r.activeSale !== null)
      : results;

    return filteredResults;
  }

  async getSaree(id: string): Promise<SareeWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(sarees.id, id));

    if (!result) return undefined;

    return {
      ...result.sarees,
      category: result.categories,
      color: result.colors,
      fabric: result.fabrics,
    };
  }

  async createSaree(saree: InsertSaree): Promise<Saree> {
    // Auto-generate SKU if not provided: MH-YYYYMMDD-XXXXX (timestamp + random suffix)
    let sareeData = saree;
    if (!saree.sku) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();
      const generatedSku = `MH-${dateStr}-${randomSuffix}`;
      sareeData = { ...saree, sku: generatedSku };
    }
    const [result] = await db.insert(sarees).values(sareeData).returning();
    return result;
  }

  async updateSaree(
    id: string,
    data: Partial<InsertSaree>
  ): Promise<Saree | undefined> {
    const [result] = await db
      .update(sarees)
      .set(data)
      .where(eq(sarees.id, id))
      .returning();
    return result || undefined;
  }

  async deleteSaree(id: string): Promise<boolean> {
    const [result] = await db
      .update(sarees)
      .set({ isActive: false })
      .where(eq(sarees.id, id))
      .returning();
    return !!result;
  }
  async getLowStockSarees(threshold = 10): Promise<SareeWithDetails[]> {
    const result = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(and(eq(sarees.isActive, true), lte(sarees.totalStock, threshold)))
      .orderBy(asc(sarees.totalStock));

    return result.map((row) => ({
      ...row.sarees,
      category: row.categories,
      color: row.colors,
      fabric: row.fabrics,
    }));
  }
}

export const sareeService = new SareeRepository();