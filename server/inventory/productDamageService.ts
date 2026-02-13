import {
  ProductDamage,
  productDamages,
  products,
  productVariants,
  variantStoreInventory,
  stockMovements,
  storeInventory,
  users
} from "@shared/schema";
import { and, eq, sql, desc, inArray } from "drizzle-orm";
import { db } from "server/db";

export interface DamageReportData {
  productId: string;
  variantId?: string;
  source: "store" | "warehouse" | "online_return" | "shipping" | "manufacturing";
  stockReductions: {
    [allocationId: string]: number; // online, storeId1, storeId2, etc.
  };
  damageCategory: "manufacturing_defect" | "shipping_damage" | "storage_damage" | "handling_damage" | "customer_damage" | "expired" | "theft_loss" | "other";
  damageSeverity: "minor" | "major" | "total_loss";
  reason: string;
  reportedBy: string;
  costValue?: string;
  recoveryValue?: string;
  disposalMethod?: string | null;
  notes?: string;
  imageUrls?: string[]; // Array of image URLs for damage evidence
  allocationType?: "online" | "store" | "both";
}

export interface StockValidationResult {
  isValid: boolean;
  availableStock: number;
  requestedQuantity: number;
  allocationType: string;
  allocationId: string;
  error?: string;
}

export interface PermissionValidationResult {
  hasPermission: boolean;
  canReportDamage: boolean;
  canApproveDamage: boolean;
  storeAccess?: string[]; // Store IDs user has access to
  error?: string;
}

export interface DamageAnalytics {
  totalDamages: number;
  totalCost: number;
  totalRecovered: number;
  damagesBySource: Array<{
    source: string;
    count: number;
    cost: number;
  }>;
  damagesByCategory: Array<{
    category: string;
    count: number;
    cost: number;
  }>;
  recentDamages: ProductDamage[];
}

export class ProductDamageService {
  /**
   * Validates user permissions for damage operations
   */
  async validateUserPermissions(userId: string, productId: string, variantId?: string): Promise<PermissionValidationResult> {
    try {
      // Get user details
      const [user] = await db
        .select({ role: users.role, storeId: users.storeId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return {
          hasPermission: false,
          canReportDamage: false,
          canApproveDamage: false,
          error: "User not found"
        };
      }

      // Admin and inventory roles have full permissions
      if (user.role === "admin" || user.role === "inventory") {
        return {
          hasPermission: true,
          canReportDamage: true,
          canApproveDamage: user.role === "admin" || user.role === "inventory",
        };
      }

      // Store users can only report damage for their store
      if (user.role === "store" && user.storeId) {
        // Check if product/variant has stock in user's store
        let hasStoreStock = false;
        
        if (variantId) {
          const [variantStock] = await db
            .select({ quantity: variantStoreInventory.quantity })
            .from(variantStoreInventory)
            .where(and(
              eq(variantStoreInventory.variantId, variantId),
              eq(variantStoreInventory.storeId, user.storeId)
            ))
            .limit(1);
          hasStoreStock = variantStock?.quantity > 0;
        } else {
          const [productStock] = await db
            .select({ quantity: storeInventory.quantity })
            .from(storeInventory)
            .where(and(
              eq(storeInventory.productId, productId),
              eq(storeInventory.storeId, user.storeId)
            ))
            .limit(1);
          hasStoreStock = productStock?.quantity > 0;
        }

        return {
          hasPermission: hasStoreStock,
          canReportDamage: hasStoreStock,
          canApproveDamage: false,
          storeAccess: [user.storeId]
        };
      }

      return {
        hasPermission: false,
        canReportDamage: false,
        canApproveDamage: false,
        error: "Insufficient permissions for damage operations"
      };
    } catch (error) {
      return {
        hasPermission: false,
        canReportDamage: false,
        canApproveDamage: false,
        error: "Permission validation failed"
      };
    }
  }

  /**
   * Validates stock availability before processing damage
   */
  async validateStockAvailability(
    productId: string,
    variantId: string | undefined,
    stockReductions: { [allocationId: string]: number }
  ): Promise<StockValidationResult[]> {
    const results: StockValidationResult[] = [];

    for (const [allocationId, requestedQuantity] of Object.entries(stockReductions)) {
      if (requestedQuantity <= 0) continue;

      try {
        let availableStock = 0;
        let allocationType = "";

        if (allocationId === "online") {
          allocationType = "online";
          
          if (variantId) {
            // Check variant online stock
            const [variant] = await db
              .select({ onlineStock: productVariants.onlineStock, stockQuantity: productVariants.stockQuantity })
              .from(productVariants)
              .where(eq(productVariants.id, variantId))
              .limit(1);
            
            if (!variant) {
              results.push({
                isValid: false,
                availableStock: 0,
                requestedQuantity,
                allocationType,
                allocationId,
                error: "Variant not found"
              });
              continue;
            }
            
            availableStock = variant.onlineStock || 0;
          } else {
            // Check product online stock
            const [product] = await db
              .select({ onlineStock: products.onlineStock, totalStock: products.totalStock })
              .from(products)
              .where(eq(products.id, productId))
              .limit(1);
            
            if (!product) {
              results.push({
                isValid: false,
                availableStock: 0,
                requestedQuantity,
                allocationType,
                allocationId,
                error: "Product not found"
              });
              continue;
            }
            
            availableStock = product.onlineStock || 0;
          }
        } else {
          // Store allocation
          allocationType = "store";
          
          if (variantId) {
            // Check variant store stock
            const [variantStoreStock] = await db
              .select({ quantity: variantStoreInventory.quantity })
              .from(variantStoreInventory)
              .where(and(
                eq(variantStoreInventory.variantId, variantId),
                eq(variantStoreInventory.storeId, allocationId)
              ))
              .limit(1);
            
            if (!variantStoreStock) {
              results.push({
                isValid: false,
                availableStock: 0,
                requestedQuantity,
                allocationType,
                allocationId,
                error: `Variant store allocation not found for store ${allocationId}`
              });
              continue;
            }
            
            availableStock = variantStoreStock.quantity || 0;
          } else {
            // Check product store stock
            const [storeStock] = await db
              .select({ quantity: storeInventory.quantity })
              .from(storeInventory)
              .where(and(
                eq(storeInventory.productId, productId),
                eq(storeInventory.storeId, allocationId)
              ))
              .limit(1);
            
            if (!storeStock) {
              results.push({
                isValid: false,
                availableStock: 0,
                requestedQuantity,
                allocationType,
                allocationId,
                error: `Store allocation not found for store ${allocationId}`
              });
              continue;
            }
            
            availableStock = storeStock.quantity || 0;
          }
        }

        const isValid = requestedQuantity <= availableStock;
        results.push({
          isValid,
          availableStock,
          requestedQuantity,
          allocationType,
          allocationId,
          error: isValid ? undefined : `Insufficient stock. Available: ${availableStock}, Requested: ${requestedQuantity}`
        });
      } catch (error) {
        results.push({
          isValid: false,
          availableStock: 0,
          requestedQuantity,
          allocationType: allocationId === "online" ? "online" : "store",
          allocationId,
          error: `Stock validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return results;
  }

  /**
   * Validates data consistency between variants and products
   */
  async validateDataConsistency(
    productId: string,
    variantId: string | undefined,
    stockReductions: { [allocationId: string]: number }
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if product exists
      const [product] = await db
        .select({ 
          id: products.id, 
          totalStock: products.totalStock, 
          onlineStock: products.onlineStock,
          hasVariants: sql<boolean>`EXISTS (SELECT 1 FROM product_variants WHERE product_id = ${productId})`
        })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) {
        errors.push("Product not found");
        return { isValid: false, errors };
      }

      // If variant is provided, validate it exists and belongs to product
      if (variantId) {
        const [variant] = await db
          .select({ 
            id: productVariants.id,
            productId: productVariants.productId,
            stockQuantity: productVariants.stockQuantity,
            onlineStock: productVariants.onlineStock
          })
          .from(productVariants)
          .where(and(
            eq(productVariants.id, variantId),
            eq(productVariants.productId, productId)
          ))
          .limit(1);

        if (!variant) {
          errors.push("Variant not found or does not belong to the specified product");
        } else {
          // Validate variant stock consistency
          let totalVariantStock = variant.onlineStock || 0;
          
          // Calculate variant store stock
          const variantStoreStocks = await db
            .select({ quantity: variantStoreInventory.quantity })
            .from(variantStoreInventory)
            .where(eq(variantStoreInventory.variantId, variantId));
          
          totalVariantStock += variantStoreStocks.reduce((sum, stock) => sum + (stock.quantity || 0), 0);

          if (totalVariantStock !== variant.stockQuantity) {
            errors.push(`Variant stock inconsistency: Online + Store (${totalVariantStock}) != Total (${variant.stockQuantity})`);
          }
        }
      } else {
        // If no variant, ensure product doesn't have variants (or user intentionally selected product level)
        const [variantCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(productVariants)
          .where(eq(productVariants.productId, productId));

        if (variantCount?.count > 0) {
          // Product has variants but no variant was selected
          errors.push("Product has variants. Please specify a variant for damage reporting.");
        }
      }

      // Validate allocation type consistency
      const hasOnlineReduction = stockReductions.online > 0;
      const hasStoreReductions = Object.entries(stockReductions)
        .filter(([id]) => id !== "online")
        .some(([, qty]) => qty > 0);

      if (hasOnlineReduction && hasStoreReductions) {
        // Both online and store reductions - should be "both" allocation type
        // This is more of a warning than an error
      } else if (hasOnlineReduction && !hasStoreReductions) {
        // Only online - should be "online" allocation type
      } else if (!hasOnlineReduction && hasStoreReductions) {
        // Only store - should be "store" allocation type
      }

    } catch (error) {
      errors.push(`Data consistency validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
  async reportDamage(data: DamageReportData): Promise<ProductDamage> {
    // Pre-transaction validations
    
    // 1. Validate user permissions
    const permissionValidation = await this.validateUserPermissions(
      data.reportedBy, 
      data.productId, 
      data.variantId
    );
    
    if (!permissionValidation.hasPermission || !permissionValidation.canReportDamage) {
      throw new Error(permissionValidation.error || "Insufficient permissions to report damage");
    }
    
    // 2. Validate data consistency
    const consistencyValidation = await this.validateDataConsistency(
      data.productId,
      data.variantId,
      data.stockReductions
    );
    
    if (!consistencyValidation.isValid) {
      throw new Error(`Data consistency validation failed: ${consistencyValidation.errors.join(", ")}`);
    }
    
    // 3. Validate stock availability
    const stockValidations = await this.validateStockAvailability(
      data.productId,
      data.variantId,
      data.stockReductions
    );
    
    const invalidStock = stockValidations.find(validation => !validation.isValid);
    if (invalidStock) {
      throw new Error(`Stock validation failed: ${invalidStock.error}`);
    }

    return await db.transaction(async (tx) => {
      // Re-validate stock within transaction to prevent race conditions
      const transactionStockValidations = await this.validateStockAvailability(
        data.productId,
        data.variantId,
        data.stockReductions
      );
      
      const transactionInvalidStock = transactionStockValidations.find(validation => !validation.isValid);
      if (transactionInvalidStock) {
        throw new Error(`Stock validation failed during transaction: ${transactionInvalidStock.error}`);
      }
      
      let damageRecord: ProductDamage;
      
      try {
        // 1. Create damage record
        const [damage] = await tx
          .insert(productDamages)
          .values({
            productId: data.productId,
            variantId: data.variantId || null,
            source: data.source,
            quantity: Object.values(data.stockReductions).reduce((sum, qty) => sum + qty, 0), // Total damaged quantity
            damageCategory: data.damageCategory,
            damageSeverity: data.damageSeverity,
            reason: data.reason,
            reportedBy: data.reportedBy,
            costValue: data.costValue,
            recoveryValue: data.recoveryValue,
            disposalMethod: data.disposalMethod,
            notes: data.notes,
            imageUrls: data.imageUrls || [], // Add image URLs for damage evidence
            allocationType: data.allocationType || "both",
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
          
        damageRecord = damage;
        
        // 2. Process each stock reduction with detailed error tracking
        const errors: string[] = [];
        const successfulReductions: Array<{ allocationId: string; quantity: number }> = [];

        for (const [allocationId, quantity] of Object.entries(data.stockReductions)) {
          if (quantity <= 0) continue;

          try {
            if (allocationId === "online") {
              // Handle online stock reduction
              if (data.variantId) {
                // Reduce from variant online stock
                const [variant] = await tx
                  .select({ onlineStock: productVariants.onlineStock, stockQuantity: productVariants.stockQuantity })
                  .from(productVariants)
                  .where(eq(productVariants.id, data.variantId))
                  .for('update'); // Lock for transaction

                if (!variant || variant.onlineStock < quantity) {
                  throw new Error(`Insufficient variant online stock. Available: ${variant?.onlineStock || 0}, Requested: ${quantity}`);
                }

                await tx
                  .update(productVariants)
                  .set({
                    onlineStock: sql`${productVariants.onlineStock} - ${quantity}`,
                    stockQuantity: sql`${productVariants.stockQuantity} - ${quantity}`
                  })
                  .where(eq(productVariants.id, data.variantId));

                // Also update product total stock
                await tx
                  .update(products)
                  .set({
                    totalStock: sql`${products.totalStock} - ${quantity}`
                  })
                  .where(eq(products.id, data.productId));

                // Record stock movement for variant online
                await tx.insert(stockMovements).values({
                  productId: data.productId,
                  quantity: -quantity,
                  movementType: "adjustment",
                  source: "online",
                  orderRefId: damage.id,
                  notes: `Damage reported - Variant ${data.variantId} Online stock: ${data.reason}`,
                  createdAt: new Date(),
                });

              } else {
                // Reduce from product online stock (existing logic)
                const [product] = await tx
                  .select({ onlineStock: products.onlineStock, totalStock: products.totalStock })
                  .from(products)
                  .where(eq(products.id, data.productId))
                  .for('update'); // Lock for transaction

                if (!product || product.onlineStock < quantity) {
                  throw new Error(`Insufficient online stock. Available: ${product?.onlineStock || 0}, Requested: ${quantity}`);
                }

                await tx
                  .update(products)
                  .set({
                    onlineStock: sql`${products.onlineStock} - ${quantity}`,
                    totalStock: sql`${products.totalStock} - ${quantity}`
                  })
                  .where(eq(products.id, data.productId));

                // Record stock movement for online
                await tx.insert(stockMovements).values({
                  productId: data.productId,
                  quantity: -quantity,
                  movementType: "adjustment",
                  source: "online",
                  orderRefId: damage.id,
                  notes: `Damage reported - Online stock: ${data.reason}`,
                  createdAt: new Date(),
                });
              }

              successfulReductions.push({ allocationId: "online", quantity });

            } else {
              // Handle store stock reduction
              const storeId = allocationId;
              
              if (data.variantId) {
                // Reduce from variant store inventory
                const [variantStoreStock] = await tx
                  .select({ quantity: variantStoreInventory.quantity })
                  .from(variantStoreInventory)
                  .where(and(
                    eq(variantStoreInventory.variantId, data.variantId),
                    eq(variantStoreInventory.storeId, storeId)
                  ))
                  .for('update'); // Lock for transaction

                if (!variantStoreStock || variantStoreStock.quantity < quantity) {
                  throw new Error(`Insufficient variant store stock for store ${storeId}. Available: ${variantStoreStock?.quantity || 0}, Requested: ${quantity}`);
                }

                await tx
                  .update(variantStoreInventory)
                  .set({
                    quantity: sql`${variantStoreInventory.quantity} - ${quantity}`
                  })
                  .where(and(
                    eq(variantStoreInventory.variantId, data.variantId),
                    eq(variantStoreInventory.storeId, storeId)
                  ));

                // Also update variant total stock and product total stock
                await tx
                  .update(productVariants)
                  .set({
                    stockQuantity: sql`${productVariants.stockQuantity} - ${quantity}`
                  })
                  .where(eq(productVariants.id, data.variantId));

                await tx
                  .update(products)
                  .set({
                    totalStock: sql`${products.totalStock} - ${quantity}`
                  })
                  .where(eq(products.id, data.productId));

                // Record stock movement for variant store
                await tx.insert(stockMovements).values({
                  productId: data.productId,
                  quantity: -quantity,
                  movementType: "adjustment",
                  source: "store",
                  orderRefId: damage.id,
                  notes: `Damage reported - Variant ${data.variantId} Store ${storeId}: ${data.reason}`,
                  createdAt: new Date(),
                });

              } else {
                // Reduce from product store inventory (existing logic)
                const [storeStock] = await tx
                  .select({ quantity: storeInventory.quantity })
                  .from(storeInventory)
                  .where(and(
                    eq(storeInventory.productId, data.productId),
                    eq(storeInventory.storeId, storeId)
                  ))
                  .for('update'); // Lock for transaction

                if (!storeStock || storeStock.quantity < quantity) {
                  throw new Error(`Insufficient store stock for store ${storeId}. Available: ${storeStock?.quantity || 0}, Requested: ${quantity}`);
                }

                await tx
                  .update(storeInventory)
                  .set({
                    quantity: sql`${storeInventory.quantity} - ${quantity}`
                  })
                  .where(and(
                    eq(storeInventory.productId, data.productId),
                    eq(storeInventory.storeId, storeId)
                  ));

                // Also update total stock
                await tx
                  .update(products)
                  .set({
                    totalStock: sql`${products.totalStock} - ${quantity}`
                  })
                  .where(eq(products.id, data.productId));

                // Record stock movement for store
                await tx.insert(stockMovements).values({
                  productId: data.productId,
                  quantity: -quantity,
                  movementType: "adjustment",
                  source: "store",
                  orderRefId: damage.id,
                  notes: `Damage reported - Store ${storeId}: ${data.reason}`,
                  createdAt: new Date(),
                });
              }

              successfulReductions.push({ allocationId: storeId, quantity });
            }
          } catch (error) {
            errors.push(`${allocationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // 3. Validate all operations completed successfully
        if (errors.length > 0) {
          throw new Error(`Stock reduction failed for allocations: ${errors.join('; ')}`);
        }
        
        if (successfulReductions.length === 0) {
          throw new Error("No stock reductions were processed successfully");
        }
        
        return damageRecord;
        
      } catch (error) {
        // Transaction will automatically rollback, but we log the error for debugging
        console.error('Damage report transaction failed:', {
          error: error instanceof Error ? error.message : error,
          data: {
            productId: data.productId,
            variantId: data.variantId,
            stockReductions: data.stockReductions
          }
        });
        
        // Re-throw the error to be handled by the caller
        throw error;
      }
    });
  }

  async getDamages(filters?: {
    productId?: string;
    source?: "store" | "online_return" | "warehouse" | "shipping" | "manufacturing";
    status?: string;
    category?: "manufacturing_defect" | "shipping_damage" | "storage_damage" | "handling_damage" | "customer_damage" | "expired" | "theft_loss" | "other";
    severity?: "minor" | "major" | "total_loss";
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ProductDamage[]; total: number }> {
    try {
      // Build base query
      let query = db
        .select({
          id: productDamages.id,
          productId: productDamages.productId,
          variantId: productDamages.variantId,
          source: productDamages.source,
          quantity: productDamages.quantity,
          damageCategory: productDamages.damageCategory,
          damageSeverity: productDamages.damageSeverity,
          reason: productDamages.reason,
          reportedBy: productDamages.reportedBy,
          approvedBy: productDamages.approvedBy,
          costValue: productDamages.costValue,
          recoveryValue: productDamages.recoveryValue,
          disposalMethod: productDamages.disposalMethod,
          notes: productDamages.notes,
          imageUrls: productDamages.imageUrls,
          status: productDamages.status,
          allocationType: productDamages.allocationType,
          storeId: productDamages.storeId,
          createdAt: productDamages.createdAt,
          updatedAt: productDamages.updatedAt,
        })
        .from(productDamages);

      // Apply filters
      const conditions = [];
      
      if (filters?.productId) {
        conditions.push(eq(productDamages.productId, filters.productId));
      }
      
      if (filters?.source) {
        if (Array.isArray(filters.source)) {
          conditions.push(inArray(productDamages.source, filters.source as any));
        } else {
          conditions.push(eq(productDamages.source, filters.source as any));
        }
      }
      
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          conditions.push(inArray(productDamages.status, filters.status as any));
        } else {
          conditions.push(eq(productDamages.status, filters.status));
        }
      }
      
      if (filters?.category) {
        if (Array.isArray(filters.category)) {
          conditions.push(inArray(productDamages.damageCategory, filters.category as any));
        } else {
          conditions.push(eq(productDamages.damageCategory, filters.category as any));
        }
      }
      
      if (filters?.severity) {
        if (Array.isArray(filters.severity)) {
          conditions.push(inArray(productDamages.damageSeverity, filters.severity as any));
        } else {
          conditions.push(eq(productDamages.damageSeverity, filters.severity as any));
        }
      }
      
      if (filters?.dateFrom) {
        conditions.push(sql`${productDamages.createdAt} >= ${filters.dateFrom}`);
      }
      
      if (filters?.dateTo) {
        conditions.push(sql`${productDamages.createdAt} <= ${filters.dateTo}`);
      }
      
      if (filters?.search) {
        conditions.push(
          sql`(
            ${productDamages.productId} ILIKE ${'%' + filters.search + '%'} OR
            ${productDamages.reason} ILIKE ${'%' + filters.search + '%'} OR
            ${productDamages.notes} ILIKE ${'%' + filters.search + '%'}
          )`
        );
      }
      
      // Apply all conditions
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      // Get total count
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(productDamages);
      
      if (conditions.length > 0) {
        countQuery.where(and(...conditions));
      }
      
      const [countResult] = await countQuery;
      const total = countResult?.count || 0;
      
      // Apply pagination and ordering
      const data = await query
        .orderBy(desc(productDamages.createdAt))
        .limit(filters?.limit || 10)
        .offset(filters?.offset || 0);

      return { data, total };
    } catch (error) {
      console.error('Error fetching damages:', error);
      throw new Error('Failed to fetch damages');
    }
  }


  async getDamageAnalytics(filters?: {
    productId?: string;
    source?: "store" | "online_return" | "warehouse" | "shipping" | "manufacturing";
    dateFrom?: string;
    dateTo?: string;
  }): Promise<DamageAnalytics> {
    let query = db
      .select({
        id: productDamages.id,
        productId: productDamages.productId,
        variantId: productDamages.variantId,
        source: productDamages.source,
        quantity: productDamages.quantity,
        damageCategory: productDamages.damageCategory,
        damageSeverity: productDamages.damageSeverity,
        costValue: productDamages.costValue,
        recoveryValue: productDamages.recoveryValue,
        allocationType: productDamages.allocationType,
        storeId: productDamages.storeId,
        status: productDamages.status,
        createdAt: productDamages.createdAt,
      })
      .from(productDamages) as any;

    // Apply filters
    const conditions = [];
    if (filters?.productId) {
      conditions.push(eq(productDamages.productId, filters.productId));
    }
    if (filters?.source) {
      conditions.push(eq(productDamages.source, filters.source as any));
    }
    if (filters?.dateFrom) {
      conditions.push(sql`${productDamages.createdAt} >= ${new Date(filters.dateFrom)}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${productDamages.createdAt} <= ${new Date(filters.dateTo)}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const allDamages = await query;

    // Calculate analytics
    const totalDamages = allDamages.length;
    const totalCost = allDamages.reduce((sum:any, d:any) => sum + Number(d.costValue || 0), 0);
    const totalRecovered = allDamages.reduce((sum:any, d:any) => sum + Number(d.recoveryValue || 0), 0);

    // Group by source
    const damagesBySource = allDamages.reduce((acc:any, damage:any) => {
      const existing = acc.find((item:any) => item.source === damage.source);
      if (existing) {
        existing.count += 1;
        existing.cost += Number(damage.costValue || 0);
      } else {
        acc.push({
          source: damage.source,
          count: 1,
          cost: Number(damage.costValue || 0),
        });
      }
      return acc;
    }, [] as Array<{ source: string; count: number; cost: number }>);

    // Group by category
    const damagesByCategory = allDamages.reduce((acc:any, damage:any) => {
      const existing = acc.find((item:any )=> item.category === damage.damageCategory);
      if (existing) {
        existing.count += 1;
        existing.cost += Number(damage.costValue || 0);
      } else {
        acc.push({
          category: damage.damageCategory,
          count: 1,
          cost: Number(damage.costValue || 0),
        });
      }
      return acc;
    }, [] as Array<{ category: string; count: number; cost: number }>);

    // Get recent damages
    const recentDamagesResult = await this.getDamages({ limit: 10 });
    const recentDamages = recentDamagesResult.data;

    return {
      totalDamages,
      totalCost,
      totalRecovered,
      damagesBySource,
      damagesByCategory,
      recentDamages,
    };
  }

  async updateDamageStatus(
    damageId: string,
    status: string,
    approvedBy?: string,
    notes?: string
  ): Promise<ProductDamage> {
    // Validate user permissions for status updates
    if (approvedBy) {
      // Get the damage record to extract product info for permission validation
      const damage = await this.getDamageById(damageId);
      if (!damage) {
        throw new Error("Damage record not found");
      }
      
      const permissionValidation = await this.validateUserPermissions(
        approvedBy,
        damage.productId,
        damage.variantId || undefined
      );
      
      // Only admin and inventory users can approve/reject damage
      if (!permissionValidation.canApproveDamage) {
        throw new Error(permissionValidation.error || "Insufficient permissions to approve/reject damage");
      }
    }

    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (approvedBy) {
      updateData.approvedBy = approvedBy;
    }

    if (notes) {
      updateData.notes = notes;
    }

    try {
      const [updated] = await db
        .update(productDamages)
        .set(updateData)
        .where(eq(productDamages.id, damageId))
        .returning();

      if (!updated) {
        throw new Error("Damage record not found or update failed");
      }

      return updated;
    } catch (error) {
      console.error('Failed to update damage status:', {
        damageId,
        status,
        approvedBy,
        error: error instanceof Error ? error.message : error
      });
      
      throw new Error(`Failed to update damage status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDamageById(damageId: string): Promise<ProductDamage | undefined> {
    const [damage] = await db
      .select()
      .from(productDamages)
      .where(eq(productDamages.id, damageId))
      .limit(1);

    return damage;
  }
}

export const productDamageService = new ProductDamageService();
