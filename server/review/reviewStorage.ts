import {
  productReviews,
  users,
  ProductReview,
  InsertProductReview,
  ProductWithReviews,
  ProductWithDetails,
  categories,
  colors,
  fabrics,
  orderItems,
  orders,
  products,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { db } from "server/db";
import { productService } from "server/product/productStorage";

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
  getProductReviews(productId: string): Promise<ReviewWithUser[]>;
  getReview(id: string): Promise<ProductReview | undefined>;
  createReview(review: InsertProductReview): Promise<ReviewWithUser[]>;
  updateReviewApproval(
    id: string,
    isApproved: boolean
  ): Promise<ProductReview | undefined>;
  getUserReviews(userId: string): Promise<ProductReview[]>;
  getProductWithReviews(productId: string): Promise<ProductWithReviews | undefined>;
  canUserReviewProduct(userId: string, productId: string): Promise<boolean>;
  getAllReviews(filters?: {
    approved?: boolean;
    limit?: number;
  }): Promise<(ProductReview & { product: ProductWithDetails })[]>;
}

export class ReviewRepository implements IReviewStorage {
  // Product Reviews
  async getProductReviews(productId: string): Promise<ReviewWithUser[]> {
    const rows = await db
      .select()
      .from(productReviews)
      .innerJoin(users, eq(users.id, productReviews.userId))
      .where(eq(productReviews.productId, productId))
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

    return this.getProductReviews(review.productId);
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

  async getProductWithReviews(
    productId: string
  ): Promise<ProductWithReviews | undefined> {
    const product = await productService.getProduct(productId);
    if (!product) return undefined;

    const reviews = await this.getProductReviews(productId);
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      ...product,
      reviews,
      averageRating: avgRating,
      reviewCount: reviews.length,
    };
  }

  async canUserReviewProduct(
    userId: string,
    productId: string
  ): Promise<boolean> {
    const deliveredOrders = await db
      .select()
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.status, "completed"),
          eq(orderItems.productId, productId)
        )
      );

    if (deliveredOrders.length === 0) return false;

    const existingReview = await db
      .select()
      .from(productReviews)
      .where(
        and(
          eq(productReviews.userId, userId),
          eq(productReviews.productId, productId)
        )
      );

    return existingReview.length === 0;
  }

  async getAllReviews(filters?: { limit?: number }): Promise<
    (ProductReview & {
      product: ProductWithDetails;
      user: { id: string; name: string };
    })[]
  > {
    const reviews = await db
      .select()
      .from(productReviews)
      .innerJoin(users, eq(users.id, productReviews.userId))
      .innerJoin(products, eq(productReviews.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .orderBy(desc(productReviews.createdAt))
      .limit(filters?.limit || 100);

    return reviews.map((row) => ({
      ...row.product_reviews,
      user: {
        id: row.users.id,
        name: row.users.name,
      },
      product: {
        ...row.products,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }
}

export const reviewService = new ReviewRepository();
