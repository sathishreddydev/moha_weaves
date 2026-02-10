import { InsertProduct, Product, storeInventory, stores, productActualPrices, products, productVariants, variantStoreInventory } from "@shared/schema";
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
  createProductWithVariants(
    product: InsertProduct,
    variants: any[],
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string
  ): Promise<Product>;
  updateProductWithVariants(
    id: string,
    data: Partial<InsertProduct>,
    variants: any[],
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string
  ): Promise<Product | undefined>;
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
  async updateProductWithVariants(
    id: string,
    data: Partial<InsertProduct>,
    variants: any[],
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string
  ): Promise<Product | undefined> {
    return await db.transaction(async (tx) => {
      // Update the main product
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
          // Create new record if actualPrice is provided
          await tx.insert(productActualPrices).values({
            productId: id,
            actualPrice: actualPrice || "0",
            totalActualStock: updatedProduct.totalStock,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // Get existing variants to determine what to update/delete/create
      const existingVariants = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, id));

      const existingVariantIds = new Set(existingVariants.map(v => v.id));
      const incomingVariantIds = new Set();

      // Update or create variants
      const updatedVariants = [];
      for (const variant of variants) {
        // Generate SKU if not provided
        const sku = variant.sku || `${updatedProduct.sku || 'PROD'}-${variant.size}`;
        
        if (variant.id && existingVariantIds.has(variant.id)) {
          // Update existing variant
          const [updatedVariant] = await tx
            .update(productVariants)
            .set({
              sku,
              size: variant.size,
              stockQuantity: variant.stockQuantity,
              onlineStock: variant.onlineStock,
              price: variant.price ? String(variant.price) : null,
              actualPrice: variant.actualPrice ? String(variant.actualPrice) : null,
              isActive: variant.isActive !== false,
              updatedAt: new Date(),
            })
            .where(eq(productVariants.id, variant.id))
            .returning();
          
          updatedVariants.push(updatedVariant);
          incomingVariantIds.add(variant.id);

          // Update variant store allocations
          // First delete existing allocations for this variant
          await tx
            .delete(variantStoreInventory)
            .where(eq(variantStoreInventory.variantId, variant.id));

          // Then create new allocations
          if (variant.storeAllocations && variant.storeAllocations.length > 0) {
            for (const allocation of variant.storeAllocations) {
              await tx.insert(variantStoreInventory).values({
                variantId: variant.id,
                storeId: allocation.storeId,
                quantity: allocation.quantity,
                updatedAt: new Date(),
              });
            }
          }
        } else {
          // Create new variant
          const [createdVariant] = await tx
            .insert(productVariants)
            .values({
              productId: updatedProduct.id,
              sku,
              size: variant.size,
              stockQuantity: variant.stockQuantity,
              onlineStock: variant.onlineStock,
              price: variant.price ? String(variant.price) : null,
              actualPrice: variant.actualPrice ? String(variant.actualPrice) : null,
              isActive: variant.isActive !== false,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          
          updatedVariants.push(createdVariant);
          incomingVariantIds.add(createdVariant.id);

          // Create variant store allocations
          if (variant.storeAllocations && variant.storeAllocations.length > 0) {
            for (const allocation of variant.storeAllocations) {
              await tx.insert(variantStoreInventory).values({
                variantId: createdVariant.id,
                storeId: allocation.storeId,
                quantity: allocation.quantity,
                updatedAt: new Date(),
              });
            }
          }
        }
      }

      // Delete variants that are no longer present
      const variantsToDelete = existingVariants.filter(v => !incomingVariantIds.has(v.id));
      for (const variantToDelete of variantsToDelete) {
        // Delete variant store allocations first (foreign key constraint)
        await tx
          .delete(variantStoreInventory)
          .where(eq(variantStoreInventory.variantId, variantToDelete.id));
        
        // Then delete the variant
        await tx
          .delete(productVariants)
          .where(eq(productVariants.id, variantToDelete.id));
      }

      // Update product-level store allocations (aggregated from variants)
      // First delete existing allocations
      await tx
        .delete(storeInventory)
        .where(eq(storeInventory.productId, id));

      // Then create new allocations
      for (const allocation of storeAllocations) {
        await tx.insert(storeInventory).values({
          storeId: allocation.storeId,
          productId: updatedProduct.id,
          quantity: allocation.quantity,
          updatedAt: new Date(),
        });
      }

      return updatedProduct;
    });
  }

  async createProductWithVariants(
    product: InsertProduct,
    variants: any[],
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string
  ): Promise<Product> {
    return await db.transaction(async (tx) => {
      // Create the main product
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

      // Create variants
      const createdVariants = [];
      for (const variant of variants) {
        // Generate SKU if not provided
        const sku = variant.sku || `${createdProduct.sku || 'PROD'}-${variant.size}`;
        
        const [createdVariant] = await tx
          .insert(productVariants)
          .values({
            productId: createdProduct.id,
            sku,
            size: variant.size,
            stockQuantity: variant.stockQuantity,
            onlineStock: variant.onlineStock,
            price: variant.price ? String(variant.price) : null,
            actualPrice: variant.actualPrice ? String(variant.actualPrice) : null,
            isActive: variant.isActive !== false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        
        createdVariants.push(createdVariant);

        // Create variant store allocations
        if (variant.storeAllocations && variant.storeAllocations.length > 0) {
          for (const allocation of variant.storeAllocations) {
            await tx.insert(variantStoreInventory).values({
              variantId: createdVariant.id,
              storeId: allocation.storeId,
              quantity: allocation.quantity,
              updatedAt: new Date(),
            });
          }
        }
      }

      // Create product-level store allocations (aggregated from variants)
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
