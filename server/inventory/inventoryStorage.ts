import { InsertProduct, Product, storeInventory, stores } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "server/db";
import { productService } from "server/product/productStorage";
import { storeService } from "server/store/storeStorage";

interface IStorage {
  createProductWithAllocations(
    product: InsertProduct,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Product>;
  updateProductWithAllocations(
    id: string,
    data: Partial<InsertProduct>,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Product | undefined>;
  getProductAllocations(
    productId: string
  ): Promise<{ storeId: string; storeName: string; quantity: number }[]>;
}

export class InventoryRepository implements IStorage {
  async createProductWithAllocations(
    product: InsertProduct,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Product> {
    return await db.transaction(async (tx) => {
      const createdProduct = await productService.createProduct(product);

      for (const allocation of storeAllocations) {
        await tx.insert(storeInventory).values({
          storeId: allocation.storeId,
          productId: createdProduct.id,
          quantity: allocation.quantity,
          updatedAt: new Date(),
        });
      }

      return createdProduct;
    });
  }

  async updateProductWithAllocations(
    id: string,
    data: Partial<InsertProduct>,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Product | undefined> {
    return await db.transaction(async (tx) => {
      const updatedProduct = await productService.updateProduct(id, data);
      if (!updatedProduct) return undefined;

      for (const allocation of storeAllocations) {
        const existing = await storeService.getStoreInventoryItem(
          allocation.storeId,
          id
        );
        if (existing) {
          await tx
            .update(storeInventory)
            .set({ quantity: allocation.quantity, updatedAt: new Date() })
            .where(
              and(
                eq(storeInventory.storeId, allocation.storeId),
                eq(storeInventory.productId, id)
              )
            );
        } else {
          await tx.insert(storeInventory).values({
            storeId: allocation.storeId,
            productId: id,
            quantity: allocation.quantity,
            updatedAt: new Date(),
          });
        }
      }

      return updatedProduct;
    });
  }

  async getProductAllocations(
    productId: string
  ): Promise<{ storeId: string; storeName: string; quantity: number }[]> {
    const allocations = await db
      .select({
        storeId: storeInventory.storeId,
        quantity: storeInventory.quantity,
      })
      .from(storeInventory)
      .where(eq(storeInventory.productId, productId));

    const result = await Promise.all(
      allocations.map(async (alloc) => {
        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, alloc.storeId));
        return {
          storeId: alloc.storeId,
          storeName: store?.name || "Unknown",
          quantity: alloc.quantity,
        };
      })
    );

    return result;
  }
}

export const inventoryService = new InventoryRepository();
