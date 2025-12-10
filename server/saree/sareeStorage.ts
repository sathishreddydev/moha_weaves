import {
  SareeWithDetails,
  sarees,
  categories,
  colors,
  fabrics,
  InsertSaree,
  Saree,
} from "@shared/schema";
import { eq, or, ilike, gte, lte, desc, asc, and } from "drizzle-orm";
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

    return result.map((row) => ({
      ...row.sarees,
      category: row.categories,
      color: row.colors,
      fabric: row.fabrics,
    }));
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
