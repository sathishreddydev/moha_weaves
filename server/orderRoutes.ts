import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createAuthMiddleware } from "./authMiddleware";

export const orderRoutes = (app: Express) => {
  const authUser = createAuthMiddleware(["user"]);

  // Orders
  app.get("/api/user/orders", authUser, async (req, res) => {
    try {
      const orders = await storage.getOrders((req as any).user.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/user/orders/:id", authUser, async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order || order.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post("/api/user/orders", authUser, async (req, res) => {
    try {
      const { shippingAddress, phone, notes, couponId } = req.body;
      const userId = (req as any).user.id;

      const cartItems = await storage.getCartItems(userId);
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const totalAmount = cartItems.reduce((sum, item) => {
        const price =
          typeof item.saree.price === "string"
            ? parseFloat(item.saree.price)
            : item.saree.price;
        return sum + price * item.quantity;
      }, 0);

      // Calculate discount if coupon is provided
      let discountAmount = 0;
      let validCoupon = null;
      if (couponId) {
        const coupon = await storage.getCoupon(couponId);
        if (coupon && coupon.isActive) {
          validCoupon = coupon;
          if (coupon.type === "percentage") {
            discountAmount = (totalAmount * parseFloat(coupon.value)) / 100;
            if (coupon.maxDiscount) {
              discountAmount = Math.min(
                discountAmount,
                parseFloat(coupon.maxDiscount)
              );
            }
          } else {
            discountAmount = parseFloat(coupon.value);
          }
        }
      }

      const finalAmount = totalAmount - discountAmount;

      const order = await storage.createOrder(
        {
          userId,
          totalAmount: totalAmount.toString(),
          discountAmount: discountAmount.toString(),
          finalAmount: finalAmount.toString(),
          couponId,
          shippingAddress,
          phone,
          notes,
          status: "pending",
        },
        cartItems.map((item) => ({
          sareeId: item.sareeId,
          quantity: item.quantity,
          price: item.saree.price,
        }))
      );

      // Deduct stock from online inventory for each ordered item
      for (const item of cartItems) {
        await storage.deductOnlineStock(item.sareeId, item.quantity);
      }

      await storage.clearCart(userId);

      // Record coupon usage after order is created
      if (validCoupon && discountAmount > 0) {
        await storage.applyCoupon(
          validCoupon.id,
          userId,
          order.id,
          discountAmount.toString()
        );
      }

      res.json({ orderId: order.id });
    } catch (error) {
      console.error("Order error:", error);
      res.status(500).json({ message: "Failed to place order" });
    }
  });
};
