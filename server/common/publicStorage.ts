import {
  Category,
  Color,
  Fabric,
  InsertCategory,
  InsertColor,
  InsertFabric,
  Subcategory,
  categories,
  colors,
  fabrics,
  insertSubcategorySchema,
  subcategories
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from "server/db";

export interface PublicStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  getCategoriesWithSubcategories(): Promise<(Category & { subcategories: Subcategory[] })[]>;
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

  // Subcategories
  getSubcategories(): Promise<Subcategory[]>;
  getSubcategoriesByCategory(categoryId: string): Promise<Subcategory[]>;
  createSubcategory(subcategory: typeof insertSubcategorySchema._type): Promise<Subcategory>;
  updateSubcategory(
    id: string,
    data: Partial<typeof insertSubcategorySchema._type>
  ): Promise<Subcategory | undefined>;
  deleteSubcategory(id: string): Promise<boolean>;
}

export class PublicRepository implements PublicStorage {
  
  // Categories
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.isActive, true));
  }

  async getCategoriesWithSubcategories(): Promise<(Category & { subcategories: Subcategory[] })[]> {
    const allCategories = await db.select().from(categories).where(eq(categories.isActive, true));
    const allSubcategories = await db.select().from(subcategories).where(eq(subcategories.isActive, true));
    
    return allCategories.map(category => ({
      ...category,
      subcategories: allSubcategories.filter(sub => sub.categoryId === category.id)
    }));
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

  // Subcategories
  async getSubcategories(): Promise<Subcategory[]> {
    return db.select().from(subcategories).where(eq(subcategories.isActive, true));
  }

  async getSubcategoriesByCategory(categoryId: string): Promise<Subcategory[]> {
    return db.select().from(subcategories).where(
      and(
        eq(subcategories.categoryId, categoryId),
        eq(subcategories.isActive, true)
      )
    );
  }

  async createSubcategory(subcategory: typeof insertSubcategorySchema._type): Promise<Subcategory> {
    const [result] = await db.insert(subcategories).values(subcategory).returning();
    return result;
  }

  async updateSubcategory(
    id: string,
    data: Partial<typeof insertSubcategorySchema._type>
  ): Promise<Subcategory | undefined> {
    const [result] = await db
      .update(subcategories)
      .set(data)
      .where(eq(subcategories.id, id))
      .returning();
    return result || undefined;
  }

  async deleteSubcategory(id: string): Promise<boolean> {
    const [result] = await db
      .update(subcategories)
      .set({ isActive: false })
      .where(eq(subcategories.id, id))
      .returning();
    return !!result;
  }
}

export const publicStorage = new PublicRepository();
