import {
  CouponWithUsage,
  coupons,
  couponUsage,
  Coupon,
  InsertCoupon,
  CouponUsage,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "server/db";

export interface ICouponsRepository {
  // Coupons
  getCoupons(filters?: { isActive?: boolean }): Promise<CouponWithUsage[]>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(
    id: string,
    data: Partial<InsertCoupon>
  ): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<boolean>;
  validateCoupon(
    code: string,
    userId: string,
    orderAmount: number
  ): Promise<{ valid: boolean; coupon?: Coupon; error?: string }>;
  applyCoupon(
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: string
  ): Promise<CouponUsage>;
}
export class CouponsRepository implements ICouponsRepository {
  // Coupons
  async getCoupons(filters?: {
    isActive?: boolean;
  }): Promise<CouponWithUsage[]> {
    const conditions: any[] = [];
    if (filters?.isActive !== undefined)
      conditions.push(eq(coupons.isActive, filters.isActive));

    const couponList = await db
      .select()
      .from(coupons)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(coupons.createdAt));

    const result: CouponWithUsage[] = [];
    for (const coupon of couponList) {
      const [usage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsage)
        .where(eq(couponUsage.couponId, coupon.id));

      result.push({
        ...coupon,
        usageCount: usage?.count || 0,
      });
    }
    return result;
  }

  async getCoupon(id: string): Promise<Coupon | undefined> {
    const [result] = await db.select().from(coupons).where(eq(coupons.id, id));
    return result || undefined;
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [result] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.toUpperCase()));
    return result || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [result] = await db
      .insert(coupons)
      .values({
        ...coupon,
        code: coupon.code.toUpperCase(),
      })
      .returning();
    return result;
  }

  async updateCoupon(
    id: string,
    data: Partial<InsertCoupon>
  ): Promise<Coupon | undefined> {
    if (data.code) data.code = data.code.toUpperCase();
    const [result] = await db
      .update(coupons)
      .set(data)
      .where(eq(coupons.id, id))
      .returning();
    return result || undefined;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    await db.update(coupons).set({ isActive: false }).where(eq(coupons.id, id));
    return true;
  }

  async validateCoupon(
    code: string,
    userId: string,
    orderAmount: number
  ): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
    const coupon = await this.getCouponByCode(code);
    if (!coupon) return { valid: false, error: "Coupon not found" };
    if (!coupon.isActive)
      return { valid: false, error: "Coupon is not active" };

    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return { valid: false, error: "Coupon is not yet valid" };
    }
    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return { valid: false, error: "Coupon has expired" };
    }

    if (coupon.usageLimit) {
      const [totalUsage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsage)
        .where(eq(couponUsage.couponId, coupon.id));

      if (totalUsage && totalUsage.count >= coupon.usageLimit) {
        return { valid: false, error: "Coupon usage limit reached" };
      }
    }

    if (coupon.perUserLimit) {
      const [userUsage] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsage)
        .where(
          and(
            eq(couponUsage.couponId, coupon.id),
            eq(couponUsage.userId, userId)
          )
        );

      if (userUsage && userUsage.count >= coupon.perUserLimit) {
        return {
          valid: false,
          error:
            "You have already used this coupon the maximum number of times",
        };
      }
    }

    if (
      coupon.minOrderAmount &&
      orderAmount < parseFloat(coupon.minOrderAmount)
    ) {
      return {
        valid: false,
        error: `Minimum order amount of ₹${coupon.minOrderAmount} required`,
      };
    }

    return { valid: true, coupon };
  }

  async applyCoupon(
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: string
  ): Promise<CouponUsage> {
    const [result] = await db
      .insert(couponUsage)
      .values({
        couponId,
        userId,
        orderId,
        discountAmount,
      })
      .returning();
    return result;
  }
}

export const couponsService = new CouponsRepository();
