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
      const { sareeId, quantity = 1 } = req.body;
      const { cart, count } = await cartServices.addToCart({
        userId: (req as any).user.id,
        sareeId,
        quantity,
      });

      res.json({ cart, count });
    } catch (error) {
      res.status(500).json({ message: "Failed to add to cart" });
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
      res.status(500).json({ message: "Failed to update cart" });
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
      const { sareeId } = req.body;
      const userId = (req as any).user.id;

      const result = await wishlistServices.addToWishlist({ userId, sareeId });

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to wishlist" });
    }
  });

  app.delete("/api/user/wishlist/:sareeId", authUser, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const result = await wishlistServices.removeFromWishlist(
        userId,
        req.params.sareeId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from wishlist" });
    }
  });
};
