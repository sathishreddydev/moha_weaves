import {
  InsertProduct,
  Product,
  products
} from "@shared/schema";
import {
  eq,
  inArray
} from "drizzle-orm";
import { db } from "server/db";
import { IproductRepository } from "./types";

export class productRepository implements IproductRepository {

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
