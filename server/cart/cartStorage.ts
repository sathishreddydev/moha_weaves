import { db } from "server/db";
import { eq, and, sql, lte, gte } from "drizzle-orm";

import {
  sarees,
  categories,
  colors,
  fabrics,
  sales,
  saleProducts,
  cart,
  wishlist,
  CartItemWithSaree,
  WishlistItemWithSaree,
  InsertCartItem,
  InsertWishlistItem,
} from "@shared/schema";

export class SareeRepository {
  applySalePricing(price: string, sale: any) {
    if (!sale) return undefined;

    const original = parseFloat(price);
    let discounted = original;

    if (
      sale.offerType === "percentage" ||
      sale.offerType === "category" ||
      sale.offerType === "flash_sale"
    ) {
      const discount = original * (parseFloat(sale.discountValue) / 100);
      const max = sale.maxDiscount ? parseFloat(sale.maxDiscount) : original;

      discounted = original - Math.min(discount, max, original);
    } else {
      const flat = Math.min(parseFloat(sale.discountValue), original);
      discounted = original - flat;
    }

    return Math.max(discounted, 0);
  }

  async loadSaleData() {
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

    const mappings = await db.select().from(saleProducts);

    return { activeSales, mappings };
  }

  async buildSaree(row: any, activeSales: any[], mappings: any[]) {
    const saree = row.sarees;

    let applicableSale: any = null;

    const productMapping = mappings.find((m) => m.sareeId === saree.id);
    if (productMapping) {
      applicableSale = activeSales.find((s) => s.id === productMapping.saleId);
    }

    if (!applicableSale && saree.categoryId) {
      applicableSale = activeSales.find(
        (s) => s.categoryId === saree.categoryId
      );
    }

    const discountedPrice = this.applySalePricing(saree.price, applicableSale);

    return {
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
            maxDiscount: applicableSale.maxDiscount ?? undefined,
          }
        : null,
      discountedPrice,
    };
  }

  async getSaree(id: string) {
    const rows = await db
      .select()
      .from(sarees)
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(sarees.id, id));

    if (!rows.length) return null;

    const { activeSales, mappings } = await this.loadSaleData();

    return await this.buildSaree(rows[0], activeSales, mappings);
  }
}

export const sareeRepo = new SareeRepository();

export class CartRepository {
  async buildCart(userId: string): Promise<{
    cart: CartItemWithSaree[];
    count: number;
  }> {
    const rows = await db
      .select()
      .from(cart)
      .innerJoin(sarees, eq(cart.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(cart.userId, userId));

    const { activeSales, mappings } = await sareeRepo.loadSaleData();

    const cartItems: CartItemWithSaree[] = await Promise.all(
      rows.map(async (row) => {
        const saree = await sareeRepo.buildSaree(row, activeSales, mappings);

        return {
          id: row.cart.id,
          createdAt: row.cart.createdAt,
          userId: row.cart.userId,
          sareeId: row.cart.sareeId,
          quantity: row.cart.quantity,
          saree,
        };
      })
    );

    const [countRow] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${cart.quantity}), 0)`,
      })
      .from(cart)
      .where(eq(cart.userId, userId));

    return {
      cart: cartItems,
      count: countRow?.total || 0,
    };
  }

  async getCartItems(userId: string) {
    return await this.buildCart(userId);
  }

  async addToCart(item: InsertCartItem) {
    const [existing] = await db
      .select()
      .from(cart)
      .where(and(eq(cart.userId, item.userId), eq(cart.sareeId, item.sareeId)));

    if (existing) {
      await db
        .update(cart)
        .set({ quantity: existing.quantity + (item.quantity || 1) })
        .where(eq(cart.id, existing.id));
    } else {
      await db.insert(cart).values(item);
    }

    return await this.buildCart(item.userId);
  }

  async updateCartItem(id: string, quantity: number, userId: string) {
    await db.update(cart).set({ quantity }).where(eq(cart.id, id));
    return await this.buildCart(userId);
  }

  async removeFromCart(id: string, userId: string) {
    await db.delete(cart).where(eq(cart.id, id));
    return await this.buildCart(userId);
  }

  async clearCart(userId: string) {
    await db.delete(cart).where(eq(cart.userId, userId));
    return { cart: [], count: 0 };
  }
  async getCartCount(userId: string): Promise<number> {
    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${cart.quantity}), 0)`,
      })
      .from(cart)
      .where(eq(cart.userId, userId));

    return result?.total ?? 0;
  }
}

export const cartServices = new CartRepository();

export class WishlistRepository {
  async buildWishlist(userId: string): Promise<{
    wishlist: WishlistItemWithSaree[];
    count: number;
  }> {
    const rows = await db
      .select()
      .from(wishlist)
      .innerJoin(sarees, eq(wishlist.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(wishlist.userId, userId));

    const { activeSales, mappings } = await sareeRepo.loadSaleData();

    const wishlistItems: WishlistItemWithSaree[] = await Promise.all(
      rows.map(async (row) => {
        const saree = await sareeRepo.buildSaree(row, activeSales, mappings);

        return {
          id: row.wishlist.id,
          createdAt: row.wishlist.createdAt,
          userId: row.wishlist.userId,
          sareeId: row.wishlist.sareeId,
          saree,
        };
      })
    );

    return {
      wishlist: wishlistItems,
      count: wishlistItems.length,
    };
  }

  async getWishlistItems(userId: string) {
    return await this.buildWishlist(userId);
  }

  async addToWishlist(item: InsertWishlistItem) {
    const [existing] = await db
      .select()
      .from(wishlist)
      .where(
        and(
          eq(wishlist.userId, item.userId),
          eq(wishlist.sareeId, item.sareeId)
        )
      );

    if (!existing) {
      await db.insert(wishlist).values(item);
    }

    return await this.buildWishlist(item.userId);
  }

  async removeFromWishlist(userId: string, sareeId: string) {
    await db
      .delete(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.sareeId, sareeId)));

    return await this.buildWishlist(userId);
  }

  async isInWishlist(userId: string, sareeId: string) {
    const [result] = await db
      .select()
      .from(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.sareeId, sareeId)));

    return !!result;
  }
  async getWishlistCount(userId: string): Promise<number> {
    const [result] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(wishlist)
      .where(eq(wishlist.userId, userId));

    return result?.count ?? 0;
  }
}

export const wishlistServices = new WishlistRepository();
