import type { Express } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { cartServices, wishlistServices } from "./cartStorage";

const authUser = createAuthMiddleware(["user"]);
export const cartRoutes = (app: Express) => {
  // Cart
  app.get("/api/user/cart", authUser, async (req, res) => {
    try {
      const items = await cartServices.getCartItems((req as any).user.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.get("/api/user/cart/count", authUser, async (req, res) => {
    try {
      const count = await cartServices.getCartCount((req as any).user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cart count" });
    }
  });

  app.post("/api/user/cart", authUser, async (req, res) => {
    try {
      const { productId, quantity = 1, variantId } = req.body;
      const { cart, count } = await cartServices.addToCart({
        userId: (req as any).user.id,
        productId,
        quantity,
        variantId,
      });

      res.json({ cart, count });
    } catch (error) {
      if (error instanceof Error && error.message.includes("available in stock")) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to add to cart" });
      }
    }
  });
  app.patch("/api/user/cart/:id", authUser, async (req, res) => {
    try {
      const { quantity } = req.body;
      const userId = (req as any).user.id;

      const updatedCart = await cartServices.updateCartItem(
        req.params.id,
        quantity,
        userId
      );

      res.json(updatedCart);
    } catch (error) {
      if (error instanceof Error && error.message.includes("available in stock")) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes("Cart item not found")) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update cart" });
      }
    }
  });

  app.delete("/api/user/cart/:id", authUser, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const updatedCart = await cartServices.removeFromCart(
        req.params.id,
        userId
      );

      res.json(updatedCart);
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });
  // Wishlist
  app.get("/api/user/wishlist", authUser, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const result = await wishlistServices.getWishlistItems(userId);

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.get("/api/user/wishlist/count", authUser, async (req, res) => {
    try {
      const count = await wishlistServices.getWishlistCount((req as any).user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wishlist count" });
    }
  });

  app.post("/api/user/wishlist", authUser, async (req, res) => {
    try {
      const { productId } = req.body;
      const userId = (req as any).user.id;

      const result = await wishlistServices.addToWishlist({ userId, productId });

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to wishlist" });
    }
  });

  app.delete("/api/user/wishlist/:productId", authUser, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const result = await wishlistServices.removeFromWishlist(
        userId,
        req.params.productId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from wishlist" });
    }
  });
};
