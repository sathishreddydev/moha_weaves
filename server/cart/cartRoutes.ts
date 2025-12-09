import type { Express } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { cartServices } from "./cartStorage";

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
      const item = await cartServices.addToCart({
        userId: (req as any).user.id,
        sareeId,
        quantity,
      });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  app.patch("/api/user/cart/:id", authUser, async (req, res) => {
    try {
      const { quantity } = req.body;
      const item = await cartServices.updateCartItem(req.params.id, quantity);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update cart" });
    }
  });

  app.delete("/api/user/cart/:id", authUser, async (req, res) => {
    try {
      await cartServices.removeFromCart(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });
  // Wishlist
  app.get("/api/user/wishlist", authUser, async (req, res) => {
    try {
      const items = await cartServices.getWishlistItems((req as any).user.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.get("/api/user/wishlist/count", authUser, async (req, res) => {
    try {
      const count = await cartServices.getWishlistCount((req as any).user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch wishlist count" });
    }
  });

  app.post("/api/user/wishlist", authUser, async (req, res) => {
    try {
      const { sareeId } = req.body;
      const item = await cartServices.addToWishlist({
        userId: (req as any).user.id,
        sareeId,
      });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to add to wishlist" });
    }
  });

  app.delete("/api/user/wishlist/:sareeId", authUser, async (req, res) => {
    try {
      await cartServices.removeFromWishlist(
        (req as any).user.id,
        req.params.sareeId
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove from wishlist" });
    }
  });
};
