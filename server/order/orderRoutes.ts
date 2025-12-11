import type { Express } from "express";
import { storage } from "../storage";
import { createAuthMiddleware } from "../authMiddleware";
import { cartServices } from "../cart/cartStorage";
import { orderService } from "./orderStorage";
import { couponsService } from "server/coupons/couponsStorage";
import { razorpay } from "server/razorpayClient";
import { createOrderTransaction } from "./createOrderService";
import crypto from "crypto";

export const orderRoutes = (app: Express) => {
  const authUser = createAuthMiddleware(["user"]);

  // Orders
  app.get("/api/user/orders", authUser, async (req, res) => {
    try {
      const orders = await orderService.getOrders((req as any).user.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/user/orders/:id", authUser, async (req, res) => {
    try {
      const order = await orderService.getOrder(req.params.id);
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

      const cartItems = await cartServices.getCartItems(userId);
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      // Calculate total using sale prices when available
      const totalAmount = cartItems.reduce((sum, item) => {
        // Use discounted price if available, otherwise original price
        const originalPrice =
          typeof item.saree.price === "string"
            ? parseFloat(item.saree.price)
            : item.saree.price;
        const price = (item.saree as any).discountedPrice ?? originalPrice;
        return sum + price * item.quantity;
      }, 0);

      // Calculate discount if coupon is provided
      let discountAmount = 0;
      let validCoupon = null;
      if (couponId) {
        const coupon = await couponsService.getCoupon(couponId);
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

      const order = await orderService.createOrder(
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
        cartItems.map((item) => {
          const originalPrice =
            typeof item.saree.price === "string"
              ? parseFloat(item.saree.price)
              : item.saree.price;
          const effectivePrice =
            (item.saree as any).discountedPrice ?? originalPrice;
          return {
            sareeId: item.sareeId,
            quantity: item.quantity,
            price: effectivePrice.toString(),
          };
        })
      );

      // Deduct stock from online inventory for each ordered item
      // for (const item of cartItems) {
      //   await storage.deductOnlineStock(item.sareeId, item.quantity);
      // }

      // Record coupon usage after order is created
      if (validCoupon && discountAmount > 0) {
        await couponsService.applyCoupon(
          validCoupon.id,
          userId,
          order.id,
          discountAmount.toString()
        );
      }
      await cartServices.clearCart(userId);

      res.json({ orderId: order.id });
    } catch (error) {
      console.error("Order error:", error);
      res.status(500).json({ message: "Failed to place order" });
    }
  });

  app.post("/api/user/create-razorpay-order", authUser, async (req, res) => {
    try {
      const { couponId } = req.body;
      const userId = (req as any).user.id;

      const cartItems = await cartServices.getCartItems(userId);
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }
      // 1️⃣ Calculate total
      const totalAmount = cartItems.reduce((sum, item) => {
        const price = (item.saree as any).discountedPrice ?? item.saree.price;
        return sum + price * item.quantity;
      }, 0);

      // 2️⃣ Calculate discount
      let discountAmount = 0;
      if (couponId) {
        const coupon = await couponsService.getCoupon(couponId);
        if (coupon && coupon.isActive) {
          if (coupon.type === "percentage") {
            discountAmount = (totalAmount * parseFloat(coupon.value)) / 100;
            if (coupon.maxDiscount)
              discountAmount = Math.min(
                discountAmount,
                parseFloat(coupon.maxDiscount)
              );
          } else {
            discountAmount = parseFloat(coupon.value);
          }
        }
      }

      const finalAmount = totalAmount - discountAmount;

      // 3️⃣ Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(finalAmount * 100), // paise
        currency: "INR",
receipt: `r${Date.now()}`,
        payment_capture: true, // ✅ boolean
      });

      res.json({
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to create Razorpay order" });
    }
  });
  app.post("/api/user/verify-payment", authUser, async (req, res) => {
    try {
      const {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        shippingAddress,
        phone,
        notes,
        couponId,
      } = req.body;

      const userId = (req as any).user.id;
      const cartItems = await cartServices.getCartItems(userId);
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }
      // 1️⃣ Verify Razorpay signature
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({ message: "Payment verification failed" });
      }

      // 2️⃣ Calculate totals
      const totalAmount = cartItems.reduce((sum, item) => {
        const price = (item.saree as any).discountedPrice ?? item.saree.price;
        return sum + price * item.quantity;
      }, 0);

      let discountAmount = 0;
      let validCoupon = null;
      if (couponId) {
        const coupon = await couponsService.getCoupon(couponId);
        if (coupon && coupon.isActive) {
          validCoupon = coupon;
          if (coupon.type === "percentage") {
            discountAmount = (totalAmount * parseFloat(coupon.value)) / 100;
            if (coupon.maxDiscount)
              discountAmount = Math.min(
                discountAmount,
                parseFloat(coupon.maxDiscount)
              );
          } else {
            discountAmount = parseFloat(coupon.value);
          }
        }
      }

      const finalAmount = totalAmount - discountAmount;

      // 3️⃣ Create order in DB (transaction-safe)
      const order = await createOrderTransaction(
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
          paymentStatus: "paid",
          paymentMethod: "razorpay",
          razorpayPaymentId, // store Razorpay payment ID
        },
        cartItems.map((item) => ({
          sareeId: item.sareeId,
          quantity: item.quantity,
          price: (
            (item.saree as any).discountedPrice ?? item.saree.price
          ).toString(),
        }))
      );

      // 4️⃣ Apply coupon
      if (validCoupon && discountAmount > 0) {
        await couponsService.applyCoupon(
          validCoupon.id,
          userId,
          order.id,
          discountAmount.toString()
        );
      }

      // 5️⃣ Clear cart
      await cartServices.clearCart(userId);

      res.json({
        orderId: order.id,
        message: "Payment successful, order created",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Payment verification failed" });
    }
  });
};
