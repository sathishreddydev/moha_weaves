import {
  InsertProductDamage,
  ProductDamage,
  productDamages,
  products,
  users,
  stockMovements,
  productActualPrices
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { db } from "server/db";
import { stockMovementTypeEnum, stockMovementSourceEnum, damageSourceEnum, damageCategoryEnum, damageSeverityEnum } from "@shared/enums";

export interface DamageReportData {
  productId: string;
  source: "store" | "online_return" | "warehouse" | "shipping" | "manufacturing";
  quantity: number;
  damageCategory: "manufacturing_defect" | "shipping_damage" | "storage_damage" | "handling_damage" | "customer_damage" | "expired" | "theft_loss" | "other";
  damageSeverity: "minor" | "major" | "total_loss";
  reason: string;
  reportedBy: string;
  costValue?: string;
  recoveryValue?: string;
  disposalMethod?: string;
  notes?: string;
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
          quantity: data.quantity,
          damageCategory: data.damageCategory,
          damageSeverity: data.damageSeverity,
          reason: data.reason,
          reportedBy: data.reportedBy,
          costValue: data.costValue,
          recoveryValue: data.recoveryValue,
          disposalMethod: data.disposalMethod,
          notes: data.notes,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 2. Update product stock (reduce from totalStock)
      await tx
        .update(products)
        .set({
          totalStock: sql`${products.totalStock} - ${data.quantity}`
        })
        .where(eq(products.id, data.productId));

      // 3. Record stock movement
      await tx.insert(stockMovements).values({
        productId: data.productId,
        quantity: -data.quantity,
        movementType: "adjustment",
        source: "store",
        orderRefId: damage.id,
        notes: `Damage reported: ${data.reason}`,
        createdAt: new Date(),
      });

      return damage;
    });
  }

  async getDamages(filters?: {
    productId?: string;
    source?: "store" | "online_return" | "warehouse" | "shipping" | "manufacturing";
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
        status: productDamages.status,
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
        status: productDamages.status,
        createdAt: productDamages.createdAt,
      })
      .from(productDamages);

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
    const totalCost = allDamages.reduce((sum, d) => sum + Number(d.costValue || 0), 0);
    const totalRecovered = allDamages.reduce((sum, d) => sum + Number(d.recoveryValue || 0), 0);

    // Group by source
    const damagesBySource = allDamages.reduce((acc, damage) => {
      const existing = acc.find(item => item.source === damage.source);
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
    const damagesByCategory = allDamages.reduce((acc, damage) => {
      const existing = acc.find(item => item.category === damage.damageCategory);
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
