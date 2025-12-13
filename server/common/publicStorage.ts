import {
  Category,
  InsertCategory,
  Color,
  InsertColor,
  Fabric,
  InsertFabric,
  categories,
  colors,
  fabrics,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "server/db";

export interface PublicStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(
    id: string,
    data: Partial<InsertCategory>
  ): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Colors
  getColors(): Promise<Color[]>;
  getColor(id: string): Promise<Color | undefined>;
  createColor(color: InsertColor): Promise<Color>;
  updateColor(
    id: string,
    data: Partial<InsertColor>
  ): Promise<Color | undefined>;
  deleteColor(id: string): Promise<boolean>;

  // Fabrics
  getFabrics(): Promise<Fabric[]>;
  getFabric(id: string): Promise<Fabric | undefined>;
  createFabric(fabric: InsertFabric): Promise<Fabric>;
  updateFabric(
    id: string,
    data: Partial<InsertFabric>
  ): Promise<Fabric | undefined>;
  deleteFabric(id: string): Promise<boolean>;
}

export class PublicRepository implements PublicStorage {
  
  // Categories
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.isActive, true));
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [result] = await db.insert(categories).values(category).returning();
    return result;
  }

  async updateCategory(
    id: string,
    data: Partial<InsertCategory>
  ): Promise<Category | undefined> {
    const [result] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return result || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const [result] = await db
      .update(categories)
      .set({ isActive: false })
      .where(eq(categories.id, id))
      .returning();
    return !!result;
  }

  // Colors
  async getColors(): Promise<Color[]> {
    return db.select().from(colors).where(eq(colors.isActive, true));
  }

  async getColor(id: string): Promise<Color | undefined> {
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    return color || undefined;
  }

  async createColor(color: InsertColor): Promise<Color> {
    const [result] = await db.insert(colors).values(color).returning();
    return result;
  }

  async updateColor(
    id: string,
    data: Partial<InsertColor>
  ): Promise<Color | undefined> {
    const [result] = await db
      .update(colors)
      .set(data)
      .where(eq(colors.id, id))
      .returning();
    return result || undefined;
  }

  async deleteColor(id: string): Promise<boolean> {
    const [result] = await db
      .update(colors)
      .set({ isActive: false })
      .where(eq(colors.id, id))
      .returning();
    return !!result;
  }

  // Fabrics
  async getFabrics(): Promise<Fabric[]> {
    return db.select().from(fabrics).where(eq(fabrics.isActive, true));
  }

  async getFabric(id: string): Promise<Fabric | undefined> {
    const [fabric] = await db.select().from(fabrics).where(eq(fabrics.id, id));
    return fabric || undefined;
  }

  async createFabric(fabric: InsertFabric): Promise<Fabric> {
    const [result] = await db.insert(fabrics).values(fabric).returning();
    return result;
  }

  async updateFabric(
    id: string,
    data: Partial<InsertFabric>
  ): Promise<Fabric | undefined> {
    const [result] = await db
      .update(fabrics)
      .set(data)
      .where(eq(fabrics.id, id))
      .returning();
    return result || undefined;
  }

  async deleteFabric(id: string): Promise<boolean> {
    const [result] = await db
      .update(fabrics)
      .set({ isActive: false })
      .where(eq(fabrics.id, id))
      .returning();
    return !!result;
  }
}

export const publicStorage = new PublicRepository();
