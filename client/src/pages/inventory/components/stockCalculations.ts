import { StoreAllocation } from "./Types";

export interface StockTotals {
  totalStock: number;
  onlineStock: number;
  storeAllocations: StoreAllocation[];
}

export interface ProductVariant {
  id?: string;
  sku: string;
  size: string;
  stockQuantity: number;
  onlineStock: number;
  storeAllocations: StoreAllocation[];
  isActive: boolean;
  price?: string;
  actualPrice?: string;
}

/**
 * Unified stock calculation function used across frontend and backend
 * Ensures consistent stock totals calculation to prevent race conditions
 */
export const calculateStockTotals = (
  hasVariants: boolean,
  variants: ProductVariant[],
  simpleTotalStock: number,
  simpleOnlineStock: number,
  simpleStoreAllocations: StoreAllocation[]
): StockTotals => {
  if (!hasVariants || variants.length === 0) {
    return {
      totalStock: simpleTotalStock,
      onlineStock: simpleOnlineStock,
      storeAllocations: simpleStoreAllocations,
    };
  }

  // Calculate from variants
  const totalStock = variants.reduce((sum, v) => sum + v.stockQuantity, 0);
  const onlineStock = variants.reduce((sum, v) => sum + v.onlineStock, 0);

  // Aggregate store allocations across variants
  const storeAllocationsMap = new Map<string, { quantity: number; storeName: string }>();
  
  variants.forEach((variant) => {
    variant.storeAllocations?.forEach((alloc) => {
      const current = storeAllocationsMap.get(alloc.storeId) || { 
        quantity: 0, 
        storeName: alloc.storeName || `Store ${alloc.storeId}` // Fallback name
      };
      storeAllocationsMap.set(alloc.storeId, {
        quantity: current.quantity + alloc.quantity,
        storeName: current.storeName
      });
    });
  });

  const aggregatedStoreAllocations: StoreAllocation[] = Array.from(
    storeAllocationsMap.entries(),
  ).map(([storeId, data]) => ({
    storeId,
    storeName: data.storeName,
    quantity: data.quantity,
  }));

  return {
    totalStock,
    onlineStock,
    storeAllocations: aggregatedStoreAllocations,
  };
};

/**
 * Validates stock consistency for variants
 * Ensures online + store allocations = total stock for each variant
 */
export const validateVariantStockConsistency = (
  variants: ProductVariant[],
  distributionChannel: "shop" | "online" | "both"
): string[] => {
  const issues: string[] = [];
  
  variants.forEach((variant) => {
    const variantStoreTotal = variant.storeAllocations?.reduce((sum, a) => sum + a.quantity, 0) || 0;
    const variantExpectedTotal = variant.stockQuantity;
    const variantOnlinePlusStore = variant.onlineStock + variantStoreTotal;
    
    // Check if store allocations + online stock equals total stock
    if (variantOnlinePlusStore !== variantExpectedTotal) {
      issues.push(
        `Size ${variant.size}: Online (${variant.onlineStock}) + Store allocations (${variantStoreTotal}) = ${variantOnlinePlusStore} but Total stock is ${variantExpectedTotal}`
      );
    }

    // Check distribution channel constraints
    if (distributionChannel === "online" && variantStoreTotal > 0) {
      issues.push(
        `Size ${variant.size}: Distribution channel is 'Online Only' but has store allocations (${variantStoreTotal})`
      );
    }
    if (distributionChannel === "shop" && variant.onlineStock > 0) {
      issues.push(
        `Size ${variant.size}: Distribution channel is 'Shop Only' but has online stock (${variant.onlineStock})`
      );
    }
  });
  
  return issues;
};

/**
 * Validates simple product stock consistency
 */
export const validateSimpleStockConsistency = (
  totalStock: number,
  onlineStock: number,
  storeAllocations: StoreAllocation[],
  distributionChannel: "shop" | "online" | "both"
): string[] => {
  const issues: string[] = [];
  const totalAllocated = storeAllocations.reduce((sum, a) => sum + a.quantity, 0);

  if (distributionChannel === "shop") {
    if (totalAllocated !== totalStock) {
      issues.push(
        `Store allocations (${totalAllocated}) must equal total stock (${totalStock})`
      );
    }
  } else if (distributionChannel === "both") {
    if (totalAllocated + onlineStock !== totalStock) {
      issues.push(
        `Online (${onlineStock}) + Store allocations (${totalAllocated}) must equal total stock (${totalStock})`
      );
    }
  }
  
  return issues;
};
