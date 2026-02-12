import {
  ProductDamage,
  productDamages,
  products,
  stockMovements,
  storeInventory
} from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { db } from "server/db";

export interface DamageReportData {
  productId: string;
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
  allocationType?: "online" | "store" | "both";
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
  async reportDamage(data: DamageReportData): Promise<ProductDamage> {
    return await db.transaction(async (tx) => {
      // 1. Create damage record
      const [damage] = await tx
        .insert(productDamages)
        .values({
          productId: data.productId,
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
          allocationType: data.allocationType || "both",
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 2. Process each stock reduction with detailed error tracking
      const errors: string[] = [];
      const successfulReductions: Array<{ allocationId: string; quantity: number }> = [];

      for (const [allocationId, quantity] of Object.entries(data.stockReductions)) {
        if (quantity <= 0) continue; // Skip zero quantities

        try {
          if (allocationId === "online") {
            // Reduce from online stock
            const [product] = await tx
              .select({ onlineStock: products.onlineStock, totalStock: products.totalStock })
              .from(products)
              .where(eq(products.id, data.productId));

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

            successfulReductions.push({ allocationId: "online", quantity });

          } else {
            // Reduce from store inventory
            const storeId = allocationId;
            
            const [storeStock] = await tx
              .select({ quantity: storeInventory.quantity })
              .from(storeInventory)
              .where(and(
                eq(storeInventory.productId, data.productId),
                eq(storeInventory.storeId, storeId)
              ));

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

            successfulReductions.push({ allocationId: storeId, quantity });
          }
        } catch (error) {
          errors.push(`${allocationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // If any reductions failed, throw detailed error
      if (errors.length > 0) {
        throw new Error(`Stock reduction failed for allocations: ${errors.join('; ')}`);
      }

      return damage;
    });
  }

  async getDamages(filters?: {
    productId?: string;
    source?: string;
    status?: string;
    limit?: number;
  }): Promise<ProductDamage[]> {
    let query = db
      .select({
        id: productDamages.id,
        productId: productDamages.productId,
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
        allocationType: productDamages.allocationType,
        storeId: productDamages.storeId,
        status: productDamages.status,
        createdAt: productDamages.createdAt,
        updatedAt: productDamages.updatedAt,
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
    if (filters?.status) {
      conditions.push(eq(productDamages.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query.orderBy(productDamages.createdAt);
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
      conditions.push(eq(productDamages.source, filters.source));
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
    const recentDamages = await this.getDamages({ limit: 10 });

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

    const [updated] = await db
      .update(productDamages)
      .set(updateData)
      .where(eq(productDamages.id, damageId))
      .returning();

    return updated;
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
