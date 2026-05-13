import { InsertProduct, Product, cart, productActualPrices, products, productVariants, storeInventory, stores, variantStoreInventory, wishlist } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { db } from "server/db";
import { createOrUpdateProductSEO } from "../product/productSeoService";

interface IStorage {
  createProductWithAllocations(
    product: InsertProduct,
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string,
    seoData?: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      metaTags?: string;
      urlSlug?: string;
    }
  ): Promise<Product>;
  createProductWithVariants(
    product: InsertProduct,
    variants: any[],
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string,
    seoData?: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      metaTags?: string;
      urlSlug?: string;
    }
  ): Promise<Product>;
  updateProductWithVariants(
    id: string,
    data: Partial<InsertProduct>,
    variants: any[],
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string,
    seoData?: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      metaTags?: string;
      urlSlug?: string;
    }
  ): Promise<Product | undefined>;
  updateProductWithAllocations(
    id: string,
    data: Partial<InsertProduct>,
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string,
    seoData?: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      metaTags?: string;
      urlSlug?: string;
    }
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
    actualPrice?: string,
    seoData?: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      metaTags?: string;
      urlSlug?: string;
    }
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

          // Then create new allocations (skip zero-quantity entries)
          if (variant.storeAllocations && variant.storeAllocations.length > 0) {
            for (const allocation of variant.storeAllocations) {
              if (allocation.quantity > 0) {
                await tx.insert(variantStoreInventory).values({
                  variantId: variant.id,
                  storeId: allocation.storeId,
                  quantity: allocation.quantity,
                  updatedAt: new Date(),
                });
              }
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

          // Create variant store allocations (skip zero-quantity entries)
          if (variant.storeAllocations && variant.storeAllocations.length > 0) {
            for (const allocation of variant.storeAllocations) {
              if (allocation.quantity > 0) {
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

      // Then create new allocations (skip zero-quantity entries)
      for (const allocation of storeAllocations) {
        if (allocation.quantity > 0) {
          await tx.insert(storeInventory).values({
            storeId: allocation.storeId,
            productId: updatedProduct.id,
            quantity: allocation.quantity,
            updatedAt: new Date(),
          });
        }
      }

      // Handle SEO data if provided
      if (seoData) {
        await createOrUpdateProductSEO({
          productId: updatedProduct.id,
          ...seoData
        });
      }

      return updatedProduct;
    });
  }

  async createProductWithVariants(
    product: InsertProduct,
    variants: any[],
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string,
    seoData?: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      metaTags?: string;
      urlSlug?: string;
    }
  ): Promise<Product> {
    return await db.transaction(async (tx) => {
      // Generate SKU if not provided
      let productData = product;
      if (!product.sku) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
        productData = { ...product, sku: `MH-${dateStr}-${randomSuffix}` };
      }

      // Create the main product inside the transaction so it rolls back on failure
      const [createdProduct] = await tx.insert(products).values(productData).returning();

      // Save actual price if provided
      if (actualPrice) {
        await tx.insert(productActualPrices).values({
          productId: createdProduct.id,
          actualPrice,
          totalActualStock: createdProduct.totalStock,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Create variants and their store allocations
      for (const variant of variants) {
        const sku = variant.sku || `${createdProduct.sku}-${variant.size}`;
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

        if (variant.storeAllocations && variant.storeAllocations.length > 0) {
          for (const allocation of variant.storeAllocations) {
            if (allocation.quantity > 0) {
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

      // Create product-level store allocations (aggregated from variants)
      for (const allocation of storeAllocations) {
        if (allocation.quantity > 0) {
          await tx.insert(storeInventory).values({
            storeId: allocation.storeId,
            productId: createdProduct.id,
            quantity: allocation.quantity,
            updatedAt: new Date(),
          });
        }
      }

      if (seoData) {
        await createOrUpdateProductSEO({ productId: createdProduct.id, ...seoData });
      }

      return createdProduct;
    });
  }

  async createProductWithAllocations(
    product: InsertProduct,
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string,
    seoData?: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      metaTags?: string;
      urlSlug?: string;
    }
  ): Promise<Product> {
    return await db.transaction(async (tx) => {
      // Generate SKU if not provided
      let productData = product;
      if (!product.sku) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
        productData = { ...product, sku: `MH-${dateStr}-${randomSuffix}` };
      }

      // Create the main product inside the transaction so it rolls back on failure
      const [createdProduct] = await tx.insert(products).values(productData).returning();

      // Save actual price if provided
      if (actualPrice) {
        await tx.insert(productActualPrices).values({
          productId: createdProduct.id,
          actualPrice,
          totalActualStock: createdProduct.totalStock,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Insert store allocations (skip zero-quantity entries)
      for (const allocation of storeAllocations) {
        if (allocation.quantity > 0) {
          await tx.insert(storeInventory).values({
            storeId: allocation.storeId,
            productId: createdProduct.id,
            quantity: allocation.quantity,
            updatedAt: new Date(),
          });
        }
      }

      if (seoData) {
        await createOrUpdateProductSEO({ productId: createdProduct.id, ...seoData });
      }

      return createdProduct;
    });
  }

  async updateProductWithAllocations(
    id: string,
    data: Partial<InsertProduct>,
    storeAllocations: { storeId: string; quantity: number }[],
    actualPrice?: string,
    seoData?: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string;
      metaTags?: string;
      urlSlug?: string;
    }
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

      // Delete all existing store allocations for this product, then re-insert.
      // This ensures stores that were removed or set to 0 are properly cleared.
      await tx
        .delete(storeInventory)
        .where(eq(storeInventory.productId, id));

      for (const allocation of storeAllocations) {
        // Skip zero-quantity entries — no point storing them
        if (allocation.quantity > 0) {
          await tx.insert(storeInventory).values({
            storeId: allocation.storeId,
            productId: id,
            quantity: allocation.quantity,
            updatedAt: new Date(),
          });
        }
      }

      // Clean up any orphaned variant rows if this product is being saved as simple.
      // This handles the variant→simple transition correctly.
      const existingVariants = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.productId, id));

      if (existingVariants.length > 0) {
        const variantIds = existingVariants.map(v => v.id);
        await tx
          .delete(variantStoreInventory)
          .where(inArray(variantStoreInventory.variantId, variantIds));
        await tx
          .delete(productVariants)
          .where(eq(productVariants.productId, id));
      }

      // Handle SEO data if provided
      if (seoData) {
        await createOrUpdateProductSEO({
          productId: id,
          ...seoData
        });
      }

      return updatedProduct;
    });
  }

  async getProductAllocations(
    productId: string
  ): Promise<{ storeId: string; storeName: string; quantity: number }[]> {
    const rows = await db
      .select({
        storeId: storeInventory.storeId,
        storeName: stores.name,
        quantity: storeInventory.quantity,
      })
      .from(storeInventory)
      .leftJoin(stores, eq(storeInventory.storeId, stores.id))
      .where(eq(storeInventory.productId, productId));

    return rows.map(row => ({
      storeId: row.storeId,
      storeName: row.storeName ?? "Unknown",
      quantity: row.quantity,
    }));
  }
}

export const inventoryService = new InventoryRepository();
