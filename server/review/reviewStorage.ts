import {
  productReviews,
  users,
  ProductReview,
  InsertProductReview,
  SareeWithReviews,
  SareeWithDetails,
  categories,
  colors,
  fabrics,
  orderItems,
  orders,
  sarees,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { db } from "server/db";
import { sareeService } from "server/saree/sareeStorage";

export type ReviewWithUser = Omit<
  typeof productReviews.$inferSelect,
  "userId"
> & {
  user: {
    id: string;
    name: string;
  };
};
export interface IReviewStorage {
  // Product Reviews
  getProductReviews(sareeId: string): Promise<ReviewWithUser[]>;
  getReview(id: string): Promise<ProductReview | undefined>;
  createReview(review: InsertProductReview): Promise<ReviewWithUser[]>;
  updateReviewApproval(
    id: string,
    isApproved: boolean
  ): Promise<ProductReview | undefined>;
  getUserReviews(userId: string): Promise<ProductReview[]>;
  getSareeWithReviews(sareeId: string): Promise<SareeWithReviews | undefined>;
  canUserReviewProduct(userId: string, sareeId: string): Promise<boolean>;
  getAllReviews(filters?: {
    approved?: boolean;
    limit?: number;
  }): Promise<(ProductReview & { saree: SareeWithDetails })[]>;
}

export class ReviewRepository implements IReviewStorage {
  // Product Reviews
  async getProductReviews(sareeId: string): Promise<ReviewWithUser[]> {
    const rows = await db
      .select()
      .from(productReviews)
      .innerJoin(users, eq(users.id, productReviews.userId))
      .where(eq(productReviews.sareeId, sareeId))
      .orderBy(desc(productReviews.createdAt));

    return rows.map((row) => ({
      ...row.product_reviews,
      user: {
        id: row.users.id,
        name: row.users.name,
      },
    }));
  }

  async getReview(id: string): Promise<ProductReview | undefined> {
    const [result] = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.id, id));
    return result || undefined;
  }

  async createReview(review: InsertProductReview): Promise<ReviewWithUser[]> {
    await db
      .insert(productReviews)
      .values(review)
      .returning({ id: productReviews.id });

    return this.getProductReviews(review.sareeId);
  }

  async updateReviewApproval(
    id: string,
    isApproved: boolean
  ): Promise<ProductReview | undefined> {
    const [result] = await db
      .update(productReviews)
      .set({ isApproved })
      .where(eq(productReviews.id, id))
      .returning();
    return result || undefined;
  }

  async getUserReviews(userId: string): Promise<ProductReview[]> {
    return db
      .select()
      .from(productReviews)
      .where(eq(productReviews.userId, userId))
      .orderBy(desc(productReviews.createdAt));
  }

  async getSareeWithReviews(
    sareeId: string
  ): Promise<SareeWithReviews | undefined> {
    const saree = await sareeService.getSaree(sareeId);
    if (!saree) return undefined;

    const reviews = await this.getProductReviews(sareeId);
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      ...saree,
      reviews,
      averageRating: avgRating,
      reviewCount: reviews.length,
    };
  }

  async canUserReviewProduct(
    userId: string,
    sareeId: string
  ): Promise<boolean> {
    const deliveredOrders = await db
      .select()
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.status, "delivered"),
          eq(orderItems.sareeId, sareeId)
        )
      );

    if (deliveredOrders.length === 0) return false;

    const existingReview = await db
      .select()
      .from(productReviews)
      .where(
        and(
          eq(productReviews.userId, userId),
          eq(productReviews.sareeId, sareeId)
        )
      );

    return existingReview.length === 0;
  }

  async getAllReviews(filters?: { limit?: number }): Promise<
    (ProductReview & {
      saree: SareeWithDetails;
      user: { id: string; name: string };
    })[]
  > {
    const reviews = await db
      .select()
      .from(productReviews)
      .innerJoin(users, eq(users.id, productReviews.userId))
      .innerJoin(sarees, eq(productReviews.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .orderBy(desc(productReviews.createdAt))
      .limit(filters?.limit || 100);

    return reviews.map((row) => ({
      ...row.product_reviews,
      user: {
        id: row.users.id,
        name: row.users.name,
      },
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }
}

export const reviewService = new ReviewRepository();
