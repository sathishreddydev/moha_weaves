import { eq, sql, and, lte, gte } from "drizzle-orm";
import { db } from "server/db";
import {
  CartItem,
  CartItemWithSaree,
  InsertCartItem,
  WishlistItem,
  WishlistItemWithSaree,
  InsertWishlistItem,
  cart,
  wishlist,
  sarees,
  categories,
  colors,
  fabrics,
  sales,
  saleProducts,
} from "@shared/schema";
export interface CartStorage {
  // Cart
  getCartItems(userId: string): Promise<CartItemWithSaree[]>;
  getCartCount(userId: string): Promise<number>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: string): Promise<boolean>;
  clearCart(userId: string): Promise<boolean>;

  // Wishlist
  getWishlistItems(userId: string): Promise<WishlistItemWithSaree[]>;
  getWishlistCount(userId: string): Promise<number>;
  addToWishlist(item: InsertWishlistItem): Promise<WishlistItem>;
  removeFromWishlist(userId: string, sareeId: string): Promise<boolean>;
  isInWishlist(userId: string, sareeId: string): Promise<boolean>;
}
export class CartRepository implements CartStorage {
  // Cart
  async getCartItems(userId: string): Promise<CartItemWithSaree[]> {
    const result = await db
      .select()
      .from(cart)
      .innerJoin(sarees, eq(cart.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(cart.userId, userId));

    // Fetch active sales
    const now = new Date();
    const activeSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now)
        )
      );

    // Fetch sale product mappings
    const saleProductMappings = await db.select().from(saleProducts);

    return result.map((row) => {
      const saree = row.sarees;
      
      // Find applicable sale
      let applicableSale = null;
      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.sareeId === saree.id
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId
        );
      }
      // Only exclude category pricing when THIS saree is explicitly mapped to a different sale
      if (!applicableSale && saree.categoryId) {
        applicableSale = activeSales.find(
          (s) => s.categoryId === saree.categoryId && 
          !saleProductMappings.some(sp => sp.saleId === s.id && sp.sareeId === saree.id)
        );
      }

      // Calculate discounted price using consistent logic across all flows
      let discountedPrice = parseFloat(saree.price);
      if (applicableSale) {
        const originalPrice = discountedPrice;
        if (applicableSale.offerType === "percentage" || applicableSale.offerType === "category" || applicableSale.offerType === "flash_sale") {
          const discount = originalPrice * (parseFloat(applicableSale.discountValue) / 100);
          const maxDiscount = applicableSale.maxDiscount 
            ? parseFloat(applicableSale.maxDiscount) 
            : originalPrice; // Cap at price if no maxDiscount
          discountedPrice = originalPrice - Math.min(discount, maxDiscount, originalPrice);
        } else if (applicableSale.offerType === "flat" || applicableSale.offerType === "product") {
          const flatDiscount = Math.min(parseFloat(applicableSale.discountValue), originalPrice);
          discountedPrice = originalPrice - flatDiscount;
        }
        discountedPrice = Math.max(0, discountedPrice);
      }

      return {
        ...row.cart,
        saree: {
          ...saree,
          category: row.categories,
          color: row.colors,
          fabric: row.fabrics,
          activeSale: applicableSale
            ? {
                id: applicableSale.id,
                name: applicableSale.name,
                offerType: applicableSale.offerType,
                discountValue: applicableSale.discountValue,
                maxDiscount: applicableSale.maxDiscount || undefined,
              }
            : null,
          discountedPrice: applicableSale ? discountedPrice : undefined,
        },
      };
    });
  }

  async getCartCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cart)
      .where(eq(cart.userId, userId));
    return result?.count || 0;
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const [existing] = await db
      .select()
      .from(cart)
      .where(and(eq(cart.userId, item.userId), eq(cart.sareeId, item.sareeId)));

    if (existing) {
      const [updated] = await db
        .update(cart)
        .set({ quantity: existing.quantity + (item.quantity || 1) })
        .where(eq(cart.id, existing.id))
        .returning();
      return updated;
    }

    const [result] = await db.insert(cart).values(item).returning();
    return result;
  }

  async updateCartItem(
    id: string,
    quantity: number
  ): Promise<CartItem | undefined> {
    const [result] = await db
      .update(cart)
      .set({ quantity })
      .where(eq(cart.id, id))
      .returning();
    return result || undefined;
  }

  async removeFromCart(id: string): Promise<boolean> {
    const [result] = await db.delete(cart).where(eq(cart.id, id)).returning();
    return !!result;
  }

  async clearCart(userId: string): Promise<boolean> {
    await db.delete(cart).where(eq(cart.userId, userId));
    return true;
  }

  // Wishlist
  async getWishlistItems(userId: string): Promise<WishlistItemWithSaree[]> {
    const result = await db
      .select()
      .from(wishlist)
      .innerJoin(sarees, eq(wishlist.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(wishlist.userId, userId));

    return result.map((row) => ({
      ...row.wishlist,
      saree: {
        ...row.sarees,
        category: row.categories,
        color: row.colors,
        fabric: row.fabrics,
      },
    }));
  }

  async getWishlistCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wishlist)
      .where(eq(wishlist.userId, userId));
    return result?.count || 0;
  }

  async addToWishlist(item: InsertWishlistItem): Promise<WishlistItem> {
    const [existing] = await db
      .select()
      .from(wishlist)
      .where(
        and(
          eq(wishlist.userId, item.userId),
          eq(wishlist.sareeId, item.sareeId)
        )
      );

    if (existing) return existing;

    const [result] = await db.insert(wishlist).values(item).returning();
    return result;
  }

  async removeFromWishlist(userId: string, sareeId: string): Promise<boolean> {
    const [result] = await db
      .delete(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.sareeId, sareeId)))
      .returning();
    return !!result;
  }

  async isInWishlist(userId: string, sareeId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.sareeId, sareeId)));
    return !!result;
  }
}

export const cartServices = new CartRepository();
