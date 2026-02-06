import { InsertProduct, Product, storeInventory, stores, productActualPrices, products } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "server/db";
import { productService } from "server/product/productStorage";
import { storeService } from "server/store/storeStorage";

interface IStorage {
  createProductWithAllocations(
    product: InsertProduct,
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string
  ): Promise<Product>;
  updateProductWithAllocations(
    id: string,
    data: Partial<InsertProduct>,
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string
  ): Promise<Product | undefined>;
  getProductAllocations(
    productId: string
  ): Promise<{ storeId: string; storeName: string; quantity: number }[]>;
}

export class InventoryRepository implements IStorage {
  async createProductWithAllocations(
    product: InsertProduct,
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string
  ): Promise<Product> {
    return await db.transaction(async (tx) => {
      const createdProduct = await productService.createProduct(product);

      // Save actual price and total actual stock if provided
      if (actualPrice) {
        await tx.insert(productActualPrices).values({
          productId: createdProduct.id,
          actualPrice: actualPrice || "0",
          totalActualStock: createdProduct.totalStock,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

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
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string
  ): Promise<Product | undefined> {
    return await db.transaction(async (tx) => {
      // Update product within transaction for atomicity
      const [updatedProduct] = await tx
        .update(products)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      
      if (!updatedProduct) return undefined;

      // Update actual price and total actual stock if provided
      if (actualPrice !== undefined) {
        const existingActualPrice = await tx
          .select()
          .from(productActualPrices)
          .where(eq(productActualPrices.productId, id))
          .limit(1);

        if (existingActualPrice.length > 0) {
          // Update existing record
          await tx
            .update(productActualPrices)
            .set({
              actualPrice: actualPrice || existingActualPrice[0].actualPrice,
              totalActualStock: updatedProduct.totalStock,
              updatedAt: new Date()
            })
            .where(eq(productActualPrices.productId, id));
        } else if (actualPrice) {
          // Create new record if actualPrice is provided or has stock
          await tx.insert(productActualPrices).values({
            productId: id,
            actualPrice: actualPrice || "0",
            totalActualStock: updatedProduct.totalStock,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

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
