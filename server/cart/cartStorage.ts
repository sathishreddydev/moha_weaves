import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "server/db";

import {
  cart,
  CartItemWithProduct,
  categories,
  colors,
  fabrics,
  InsertCartItem,
  InsertWishlistItem,
  products,
  productVariants,
  saleProducts,
  sales,
  wishlist,
  WishlistItemWithProduct,
} from "@shared/schema";

export class productRepository {
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

  async buildProduct(row: any, activeSales: any[], mappings: any[]) {
    const product = row.products;

    let applicableSale: any = null;

    const productMapping = mappings.find((m) => m.productId === product.id);
    if (productMapping) {
      applicableSale = activeSales.find((s) => s.id === productMapping.saleId);
    }

    if (!applicableSale && product.categoryId) {
      applicableSale = activeSales.find(
        (s) => s.categoryId === product.categoryId
      );
    }

    const discountedPrice = this.applySalePricing(product.price, applicableSale);

    return {
      ...product,
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
            bgColor: applicableSale.bgColor ?? undefined,
          }
        : null,
      discountedPrice,
    };
  }

  async getProduct(id: string) {
    const rows = await db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(eq(products.id, id));

    if (!rows.length) return null;

    const { activeSales, mappings } = await this.loadSaleData();

    return await this.buildProduct(rows[0], activeSales, mappings);
  }
}

export const productRepo = new productRepository();

export class CartRepository {
  async buildCart(userId: string): Promise<{
    cart: CartItemWithProduct[];
    count: number;
  }> {
    const rows = await db
      .select()
      .from(cart)
      .innerJoin(products, eq(cart.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .leftJoin(productVariants, eq(cart.variantId, productVariants.id))
      .where(eq(cart.userId, userId))
      .orderBy(asc(cart.createdAt));

    const { activeSales, mappings } = await productRepo.loadSaleData();

    const cartItems: CartItemWithProduct[] = await Promise.all(
      rows.map(async (row) => {
        const product = await productRepo.buildProduct(row, activeSales, mappings);

        // Include variant information if exists
        const variantInfo = row.product_variants ? {
          id: row.product_variants.id,
          sku: row.product_variants.sku,
          size: row.product_variants.size,
          price: row.product_variants.price,
          actualPrice: row.product_variants.actualPrice,
          stockQuantity: row.product_variants.stockQuantity,
          onlineStock: row.product_variants.onlineStock,
          isActive: row.product_variants.isActive,
        } : undefined;

        return {
          id: row.cart.id,
          createdAt: row.cart.createdAt,
          userId: row.cart.userId,
          productId: row.cart.productId,
          quantity: row.cart.quantity,
          variantId: row.cart.variantId,
          product: {
            ...product,
            variants: variantInfo ? [variantInfo] : undefined,
          },
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
    // Check if item with same productId and variantId already exists
    const existingConditions = [eq(cart.userId, item.userId), eq(cart.productId, item.productId)];
    if (item.variantId) {
      existingConditions.push(eq(cart.variantId, item.variantId));
    }
    
    const [existing] = await db
      .select()
      .from(cart)
      .where(and(...existingConditions));

    // Get current stock to validate
    let availableStock = 0;
    if (item.variantId) {
      // Get variant stock
      const [variant] = await db
        .select()
        .from(productVariants)
        .where(and(
          eq(productVariants.id, item.variantId),
          eq(productVariants.isActive, true)
        ));
      availableStock = variant?.onlineStock || 0;
    } else {
      // Get product stock
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId));
      availableStock = product?.onlineStock || 0;
    }

    const currentQuantity = existing?.quantity || 0;
    const newQuantity = currentQuantity + (item.quantity || 1);

    // Validate stock
    if (newQuantity > availableStock) {
      throw new Error(`Only ${availableStock} items available in stock.`);
    }

    if (existing) {
      if (newQuantity <= 0) {
        await db.delete(cart).where(eq(cart.id, existing.id));
      } else {
        await db.update(cart).set({ quantity: newQuantity }).where(eq(cart.id, existing.id));
      }
    } else {
      if ((item.quantity || 1) > 0) {
        await db.insert(cart).values(item);
      }
    }

    return await this.buildCart(item.userId);
  }

  async updateCartItem(id: string, quantity: number, userId: string) {
    if (quantity <= 0) {
      await db.delete(cart).where(eq(cart.id, id));
      return await this.buildCart(userId);
    }

    // Get the cart item to check stock
    const [cartItem] = await db
      .select()
      .from(cart)
      .where(eq(cart.id, id));

    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    // Get current stock to validate
    let availableStock = 0;
    if (cartItem.variantId) {
      // Get variant stock
      const [variant] = await db
        .select()
        .from(productVariants)
        .where(and(
          eq(productVariants.id, cartItem.variantId),
          eq(productVariants.isActive, true)
        ));
      availableStock = variant?.onlineStock || 0;
    } else {
      // Get product stock
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, cartItem.productId));
      availableStock = product?.onlineStock || 0;
    }

    // Validate stock
    if (quantity > availableStock) {
      throw new Error(`Only ${availableStock} items available in stock.`);
    }

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
    wishlist: WishlistItemWithProduct[];
    count: number;
  }> {
    const rows = await db
      .select()
      .from(wishlist)
      .innerJoin(products, eq(wishlist.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(eq(wishlist.userId, userId));

    const { activeSales, mappings } = await productRepo.loadSaleData();

    const wishlistItems: WishlistItemWithProduct[] = await Promise.all(
      rows.map(async (row) => {
        const product = await productRepo.buildProduct(row, activeSales, mappings);

        return {
          id: row.wishlist.id,
          createdAt: row.wishlist.createdAt,
          userId: row.wishlist.userId,
          productId: row.wishlist.productId,
          product,
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
          eq(wishlist.productId, item.productId)
        )
      );

    if (!existing) {
      await db.insert(wishlist).values(item);
    }

    return await this.buildWishlist(item.userId);
  }

  async removeFromWishlist(userId: string, productId: string) {
    await db
      .delete(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.productId, productId)));

    return await this.buildWishlist(userId);
  }

  async isInWishlist(userId: string, productId: string) {
    const [result] = await db
      .select()
      .from(wishlist)
      .where(and(eq(wishlist.userId, userId), eq(wishlist.productId, productId)));

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
