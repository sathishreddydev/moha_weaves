import { useEffect, useState } from 'react';
import { ProductVariant, StoreAllocation } from './Types';
import { validateVariantStockConsistency, validateSimpleStockConsistency } from './stockCalculations';

export interface StockValidationError {
  field: string;
  message: string;
  variantIndex?: number;
}

export const useStockValidation = (
  hasVariants: boolean,
  variants: ProductVariant[],
  totalStock: number,
  onlineStock: number,
  storeAllocations: StoreAllocation[],
  distributionChannel: "shop" | "online" | "both"
) => {
  const [errors, setErrors] = useState<StockValidationError[]>([]);

  useEffect(() => {
    const newErrors: StockValidationError[] = [];

    if (hasVariants) {
      const variantIssues = validateVariantStockConsistency(variants, distributionChannel);
      
      variantIssues.forEach(issue => {
        // Parse the issue to extract size and create specific field errors
        const sizeMatch = issue.match(/Size ([^:]+):/);
        if (sizeMatch) {
          const size = sizeMatch[1];
          const variantIndex = variants.findIndex(v => v.size === size);
          if (variantIndex !== -1) {
            if (issue.includes('Online') && issue.includes('Store allocations')) {
              newErrors.push({
                field: `variants.${variantIndex}.allocations`,
                message: issue,
                variantIndex
              });
            } else if (issue.includes('Distribution channel')) {
              newErrors.push({
                field: `variants.${variantIndex}.channel`,
                message: issue,
                variantIndex
              });
            }
          }
        }
      });

      // Validate individual variant numeric fields
      variants.forEach((variant, index) => {
        const stockQuantity = parseInt(variant.stockQuantity.toString());
        const onlineStock = parseInt(variant.onlineStock.toString());
        
        if (isNaN(stockQuantity) || stockQuantity < 0) {
          newErrors.push({
            field: `variants.${index}.stockQuantity`,
            message: 'Please enter a valid stock quantity for this size',
            variantIndex: index
          });
        }
        if (isNaN(onlineStock) || onlineStock < 0) {
          newErrors.push({
            field: `variants.${index}.onlineStock`,
            message: 'Please enter a valid online stock quantity for this size',
            variantIndex: index
          });
        }
      });
    } else {
      // Simple product validation
      const simpleIssues = validateSimpleStockConsistency(
        totalStock,
        onlineStock,
        storeAllocations,
        distributionChannel
      );
      
      simpleIssues.forEach(issue => {
        if (issue.includes('Store allocations')) {
          newErrors.push({
            field: 'allocations',
            message: issue
          });
        }
      });

      // Validate simple product numeric fields
      const parsedTotalStock = parseInt(totalStock.toString());
      const parsedOnlineStock = parseInt(onlineStock.toString());
      
      if (isNaN(parsedTotalStock) || parsedTotalStock < 0) {
        newErrors.push({
          field: 'totalStock',
          message: 'Please enter a valid stock quantity (e.g., 50)'
        });
      }
      if (isNaN(parsedOnlineStock) || parsedOnlineStock < 0) {
        newErrors.push({
          field: 'onlineStock',
          message: 'Please enter a valid online stock quantity (e.g., 25)'
        });
      }
    }

    setErrors(newErrors);
  }, [hasVariants, variants, totalStock, onlineStock, storeAllocations, distributionChannel]);

  const hasErrors = errors.length > 0;
  const getErrorForField = (field: string) => errors.find(error => error.field === field)?.message;
  const getVariantErrors = (variantIndex: number) => errors.filter(error => error.variantIndex === variantIndex);

  return {
    errors,
    hasErrors,
    getErrorForField,
    getVariantErrors
  };
};
