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
  subcategories,
  products,
  sales
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { db } from "server/db";

// Size ordering: predefined sizes in logical sequence
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

function sortSizes(sizes: string[] | null): string[] {
  if (!sizes || !sizes.length) return sizes || [];
  return [...sizes].sort((a, b) => {
    const indexA = SIZE_ORDER.indexOf(a);
    const indexB = SIZE_ORDER.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });
}

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
    const result = await db.select().from(categories).where(eq(categories.isActive, true));
    return result.map(cat => ({ ...cat, sizes: sortSizes(cat.sizes) }));
  }

  async getCategoriesWithSubcategories(): Promise<(Category & { subcategories: Subcategory[] })[]> {
    const allCategories = await db.select().from(categories).where(eq(categories.isActive, true));
    const allSubcategories = await db.select().from(subcategories).where(eq(subcategories.isActive, true));
    
    return allCategories.map(category => ({
      ...category,
      sizes: sortSizes(category.sizes),
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
    try {
      // First check if category exists and grab its imageUrl
      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id));
      
      if (!category) {
        throw new Error('Category not found');
      }

      // Check for dependencies before deletion
      const [productCount, salesCount, subcategoryCount] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .where(and(eq(products.categoryId, id), eq(products.isActive, true))),
        db
          .select({ count: sql<number>`count(*)` })
          .from(sales)
          .where(and(eq(sales.categoryId, id), eq(sales.isActive, true))),
        db
          .select({ count: sql<number>`count(*)` })
          .from(subcategories)
          .where(and(eq(subcategories.categoryId, id), eq(subcategories.isActive, true)))
      ]);

      if (productCount[0]?.count > 0) {
        throw new Error('Cannot delete category: It is referenced by active products. Please remove or reassign these products first.');
      }

      if (salesCount[0]?.count > 0) {
        throw new Error('Cannot delete category: It is referenced by active sales. Please remove or reassign these sales first.');
      }

      // Fetch subcategory imageUrls before deletion for Cloudinary cleanup
      const subcategoryRows = await db
        .select({ imageUrl: subcategories.imageUrl })
        .from(subcategories)
        .where(eq(subcategories.categoryId, id));

      if (subcategoryCount[0]?.count > 0) {
        await db.delete(subcategories).where(eq(subcategories.categoryId, id));
      }

      const result = await db.delete(categories).where(eq(categories.id, id));

      // Clean up Cloudinary images after DB deletion (fire and forget)
      const cloudinaryUrls: string[] = [];
      if (category.imageUrl?.includes("res.cloudinary.com")) cloudinaryUrls.push(category.imageUrl);
      subcategoryRows.forEach((s) => {
        if (s.imageUrl?.includes("res.cloudinary.com")) cloudinaryUrls.push(s.imageUrl);
      });
      if (cloudinaryUrls.length > 0) {
        this._deleteCloudinaryUrls(cloudinaryUrls);
      }

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting category:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Cannot delete category') || errorMessage.includes('Category not found')) {
        throw error;
      }
      throw new Error('Failed to delete category');
    }
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
    try {
      // Fetch imageUrl before deletion for Cloudinary cleanup
      const [sub] = await db
        .select({ imageUrl: subcategories.imageUrl })
        .from(subcategories)
        .where(eq(subcategories.id, id));

      const result = await db
        .delete(subcategories)
        .where(eq(subcategories.id, id));

      // Clean Cloudinary image after DB deletion (fire and forget)
      if (sub?.imageUrl?.includes("res.cloudinary.com")) {
        this._deleteCloudinaryUrls([sub.imageUrl]);
      }

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('violates foreign key constraint')) {
        throw new Error('Cannot delete subcategory: It is referenced by products. Please remove or reassign these references first.');
      }
      throw error;
    }
  }

  /** Shared helper — deletes Cloudinary assets fire-and-forget */
  private _deleteCloudinaryUrls(urls: string[]): void {
    import("cloudinary").then((cloudinary) => {
      cloudinary.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      Promise.allSettled(
        urls.map(async (url) => {
          const parts = url.split("/");
          const uploadIdx = parts.indexOf("upload");
          if (uploadIdx === -1) return;
          let after = parts.slice(uploadIdx + 1);
          if (after[0] && /^v\d+$/.test(after[0])) after = after.slice(1);
          const publicIdWithExt = after.join("/");
          if (!publicIdWithExt) return;
          const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf("."));
          const resourceType = url.includes("/video/") ? "video" : "image";
          const result = await cloudinary.v2.uploader.destroy(publicId, { resource_type: resourceType });
          if (result.result !== "ok") {
            console.warn(`Cloudinary delete skipped for ${publicId}: ${result.result}`);
          }
        })
      ).catch((err) => console.error("Cloudinary bulk delete error:", err));
    }).catch((err) => console.error("Failed to import cloudinary:", err));
  }
}

export const publicStorage = new PublicRepository();
