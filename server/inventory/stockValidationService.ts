import { products, productVariants, storeInventory, variantStoreInventory, stockMovements } from "@shared/schema";
import { and, eq, sql, sum } from "drizzle-orm";
import { db } from "../db";

export interface StockValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  discrepancies: {
    productId: string;
    productName?: string;
    expectedTotal: number;
    actualTotal: number;
    onlineStock: number;
    storeStock: number;
    unallocated: number;
  }[];
}

export interface StockReconciliationData {
  productId: string;
  productName?: string;
  sku?: string;
  totalStock: number;
  onlineStock: number;
  calculatedStoreStock: number;
  calculatedVariantStock: number;
  discrepancy: number;
  variantDiscrepancies: {
    variantId: string;
    size: string;
    expectedStock: number;
    actualStock: number;
  }[];
}

export class StockValidationService {
  
  /**
   * Validate stock consistency across all allocations for a single product
   */
  async validateProductStock(productId: string): Promise<StockValidationResult> {
    const result: StockValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      discrepancies: []
    };

    try {
      // Get product details
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId));

      if (!product) {
        result.isValid = false;
        result.errors.push(`Product ${productId} not found`);
        return result;
      }

      // Get store allocations
      const storeAllocations = await db
        .select({ quantity: storeInventory.quantity })
        .from(storeInventory)
        .where(eq(storeInventory.productId, productId));

      const totalStoreStock = storeAllocations.reduce((sum, alloc) => sum + (alloc.quantity || 0), 0);

      // Check if product has variants
      const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId));

      let calculatedVariantStock = 0;
      let variantDiscrepancies: any[] = [];

      if (variants.length > 0) {
        // For variant products, validate each variant
        for (const variant of variants) {
          // Get variant store allocations
          const variantStoreAllocs = await db
            .select({ quantity: variantStoreInventory.quantity })
            .from(variantStoreInventory)
            .where(eq(variantStoreInventory.variantId, variant.id));

          const variantStoreStock = variantStoreAllocs.reduce((sum, alloc) => sum + (alloc.quantity || 0), 0);
          const variantTotal = variant.onlineStock + variantStoreStock;

          if (variantTotal !== variant.stockQuantity) {
            result.isValid = false;
            result.errors.push(
              `Variant ${variant.size} (${variant.id}): Online (${variant.onlineStock}) + Store (${variantStoreStock}) = ${variantTotal}, but expected ${variant.stockQuantity}`
            );
            
            variantDiscrepancies.push({
              variantId: variant.id,
              size: variant.size,
              expectedStock: variant.stockQuantity,
              actualStock: variantTotal
            });
          }

          calculatedVariantStock += variant.stockQuantity;
        }

        // Check if product total matches sum of variants
        if (product.totalStock !== calculatedVariantStock) {
          result.isValid = false;
          result.errors.push(
            `Product total stock (${product.totalStock}) doesn't match sum of variants (${calculatedVariantStock})`
          );
        }

        // Check if product online stock matches sum of variant online stocks
        const totalVariantOnlineStock = variants.reduce((sum, v) => sum + v.onlineStock, 0);
        if (product.onlineStock !== totalVariantOnlineStock) {
          result.isValid = false;
          result.errors.push(
            `Product online stock (${product.onlineStock}) doesn't match sum of variant online stocks (${totalVariantOnlineStock})`
          );
        }
      }

      // Calculate expected total based on allocations
      const expectedTotal = product.onlineStock + totalStoreStock;
      const unallocated = product.totalStock - expectedTotal;

      // Check for discrepancies
      if (unallocated !== 0) {
        result.warnings.push(
          `Product ${product.name || product.sku}: ${unallocated} units are unallocated (Total: ${product.totalStock}, Online: ${product.onlineStock}, Store: ${totalStoreStock})`
        );

        result.discrepancies.push({
          productId,
          productName: product.name,
          expectedTotal,
          actualTotal: product.totalStock,
          onlineStock: product.onlineStock,
          storeStock: totalStoreStock,
          unallocated
        });
      }

      // Validate distribution channel constraints
      if (product.distributionChannel === "online" && totalStoreStock > 0) {
        result.isValid = false;
        result.errors.push(
          `Product ${product.name || product.sku}: Distribution channel is 'Online Only' but has store allocations (${totalStoreStock})`
        );
      }

      if (product.distributionChannel === "shop" && product.onlineStock > 0) {
        result.isValid = false;
        result.errors.push(
          `Product ${product.name || product.sku}: Distribution channel is 'Shop Only' but has online stock (${product.onlineStock})`
        );
      }

      return result;

    } catch (error) {
      console.error(`Error validating product stock for ${productId}:`, error);
      result.isValid = false;
      result.errors.push("Validation failed due to system error");
      return result;
    }
  }

  /**
   * Validate stock consistency across all products
   */
  async validateAllStock(): Promise<StockValidationResult> {
    const result: StockValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      discrepancies: []
    };

    try {
      // Get all product IDs
      const allProducts = await db
        .select({ id: products.id, name: products.name, sku: products.sku })
        .from(products);

      console.log(`Validating stock for ${allProducts.length} products...`);

      // Validate each product
      for (const product of allProducts) {
        const productResult = await this.validateProductStock(product.id);
        
        // Merge results
        result.errors.push(...productResult.errors);
        result.warnings.push(...productResult.warnings);
        result.discrepancies.push(...productResult.discrepancies);
        
        if (!productResult.isValid) {
          result.isValid = false;
        }
      }

      console.log(`Stock validation completed. Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);

      return result;

    } catch (error) {
      console.error("Error validating all stock:", error);
      result.isValid = false;
      result.errors.push("System-wide validation failed");
      return result;
    }
  }

  /**
   * Get detailed reconciliation data for all products
   */
  async getStockReconciliationData(): Promise<StockReconciliationData[]> {
    try {
      // Get all products with their allocations
      const productsWithAllocations = await db
        .select({
          productId: products.id,
          productName: products.name,
          sku: products.sku,
          totalStock: products.totalStock,
          onlineStock: products.onlineStock,
          distributionChannel: products.distributionChannel
        })
        .from(products);

      const reconciliationData: StockReconciliationData[] = [];

      for (const product of productsWithAllocations) {
        // Get store allocations
        const storeAllocResult = await db
          .select({ 
            quantity: sql<number>`COALESCE(SUM(${storeInventory.quantity}), 0)` 
          })
          .from(storeInventory)
          .where(eq(storeInventory.productId, product.productId));

        const calculatedStoreStock = Number(storeAllocResult[0]?.quantity) || 0;

        // Get variants and their stock
        const variants = await db
          .select({
            variantId: productVariants.id,
            size: productVariants.size,
            stockQuantity: productVariants.stockQuantity,
            onlineStock: productVariants.onlineStock
          })
          .from(productVariants)
          .where(eq(productVariants.productId, product.productId));

        let calculatedVariantStock = 0;
        const variantDiscrepancies: any[] = [];

        for (const variant of variants) {
          // Get variant store allocations
          const variantStoreResult = await db
            .select({ 
              quantity: sql<number>`COALESCE(SUM(${variantStoreInventory.quantity}), 0)` 
            })
            .from(variantStoreInventory)
            .where(eq(variantStoreInventory.variantId, variant.variantId));

          const variantStoreStock = Number(variantStoreResult[0]?.quantity) || 0;
          const variantTotal = Number(variant.onlineStock) + variantStoreStock;

          if (variantTotal !== Number(variant.stockQuantity)) {
            variantDiscrepancies.push({
              variantId: variant.variantId,
              size: variant.size,
              expectedStock: Number(variant.stockQuantity),
              actualStock: variantTotal
            });
          }

          calculatedVariantStock += Number(variant.stockQuantity);
        }

        const expectedTotal = Number(product.onlineStock) + Number(calculatedStoreStock);
        const discrepancy = Number(product.totalStock) - expectedTotal;

        reconciliationData.push({
          productId: product.productId,
          productName: product.productName,
          sku: product.sku || undefined,
          totalStock: product.totalStock,
          onlineStock: product.onlineStock,
          calculatedStoreStock,
          calculatedVariantStock,
          discrepancy,
          variantDiscrepancies
        });
      }

      return reconciliationData;

    } catch (error) {
      console.error("Error getting stock reconciliation data:", error);
      throw new Error("Failed to retrieve reconciliation data");
    }
  }

  /**
   * Fix stock discrepancies by updating product totals to match allocations
   */
  async fixStockDiscrepancies(productIds: string[]): Promise<{ fixed: string[], failed: string[] }> {
    const fixed: string[] = [];
    const failed: string[] = [];

    for (const productId of productIds) {
      try {
        await db.transaction(async (tx) => {
          // Get current allocations
          const storeAllocResult = await tx
            .select({ 
              quantity: sql<number>`COALESCE(SUM(${storeInventory.quantity}), 0)` 
            })
            .from(storeInventory)
            .where(eq(storeInventory.productId, productId));

          const calculatedStoreStock = storeAllocResult[0]?.quantity || 0;

          // Get product details
          const [product] = await tx
            .select({ onlineStock: products.onlineStock })
            .from(products)
            .where(eq(products.id, productId));

          if (!product) {
            throw new Error("Product not found");
          }

          // Calculate correct total
          const correctTotal = product.onlineStock + calculatedStoreStock;

          // Update product total
          await tx
            .update(products)
            .set({ 
              totalStock: correctTotal,
              updatedAt: new Date()
            })
            .where(eq(products.id, productId));

          // Record stock movement for audit
          await tx.insert(stockMovements).values({
            productId,
            quantity: correctTotal - ((product as any).totalStock || 0),
            movementType: "adjustment",
            source: "online", // Must be "store" | "online" per schema
            orderRefId: "", // Required field - use empty string for non-order movements
            notes: `Stock reconciliation: Updated total stock to match allocations`,
            createdAt: new Date()
          });
        });

        fixed.push(productId);

      } catch (error) {
        console.error(`Failed to fix stock discrepancy for product ${productId}:`, error);
        failed.push(productId);
      }
    }

    return { fixed, failed };
  }
}

export const stockValidationService = new StockValidationService();
