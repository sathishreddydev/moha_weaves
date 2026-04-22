import { products, productVariants } from "@shared/schema";
import * as crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import type { Express } from "express";
import { couponsService } from "server/coupons/couponsStorage";
import { db } from "server/db";
import { razorpay } from "server/razorpayClient";
import { createAuthMiddleware } from "../authMiddleware";
import { cartServices } from "../cart/cartStorage";
import { paymentInfo } from "./createOrderService";
import { orderService } from "./orderStorage";

export const orderRoutes = (app: Express) => {
  const authUser = createAuthMiddleware(["user"]);

  // 🔹 Helper: normalize cart pricing
  const mapCartWithPrices = (cart: any[]) => {
    return cart.map((item) => {
      let price =
        typeof item.product.price === "string"
          ? parseFloat(item.product.price)
          : item.product.price;

      if (item.variantId && item.product.variants) {
        const variant = item.product.variants.find(
          (v: any) => v.id === item.variantId
        );
        if (variant?.price) {
          price =
            typeof variant.price === "string"
              ? parseFloat(variant.price)
              : variant.price;
        }
      }

      if (
        item.product.activeSale &&
        item.product.discountedPrice &&
        item.product.price
      ) {
        const ratio =
          parseFloat(item.product.discountedPrice.toString()) /
          parseFloat(item.product.price.toString());
        price = price * ratio;
      }

      return { ...item, price };
    });
  };


  app.get("/api/user/orders", authUser, async (req, res) => {
    try {
      const orders = await orderService.getOrders((req as any).user.id);
      res.json(orders);
    } catch {
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
    } catch {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.get("/api/user/orders/:id/invoice", authUser, async (req, res) => {
    try {
      const order = await orderService.getOrder(req.params.id);
      if (!order || order.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const { default: PDFDocument } = await import("pdfkit");

      const safeId = order.id;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="invoice-${safeId}.pdf"`,
      );

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("error", () => {
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to generate invoice" });
        }
      });
      doc.on("end", () => {
        const pdf = Buffer.concat(chunks);
        res.status(200).send(pdf);
      });

      const currency = "INR";
      const asMoney = (value: any) => {
        const n = Number(value ?? 0);
        return `${currency} ${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
      };
      const maskId = (value?: string | null) => {
        if (!value) return "—";
        const trimmed = value.trim();
        if (trimmed.length <= 8) return trimmed;
        return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
      };

      // Header
      doc.fontSize(20).text("MOHA", { align: "left" });
      doc.fontSize(10).fillColor("#555").text("INVOICE", { align: "left" });
      doc.moveDown(0.5);
      doc.fillColor("#000");

      doc
        .fontSize(10)
        .text(`Invoice No: INV-${safeId}`, { align: "right" })
        .text(`Order ID: ${order.id}`, { align: "right" })
        .text(`Order Date: ${new Date(order.createdAt).toLocaleString()}`, {
          align: "right",
        });

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke();
      doc.moveDown(1);

      // Bill to
      doc.fontSize(12).fillColor("#111").text("Bill To");
      doc
        .moveDown(0.25)
        .fontSize(10)
        .fillColor("#000")
        .text(order.shippingAddress || "—")
        .text(`Phone: ${order.phone || "—"}`);
      doc.moveDown(1);

      // Items table
      const tableTop = doc.y;
      const colNameX = 50;
      const colQtyX = 320;
      const colPriceX = 380;
      const colTotalX = 470;

      doc.fontSize(10).fillColor("#111");
      doc.text("Item", colNameX, tableTop);
      doc.text("Qty", colQtyX, tableTop, { width: 50, align: "right" });
      doc.text("Price", colPriceX, tableTop, { width: 70, align: "right" });
      doc.text("Total", colTotalX, tableTop, { width: 75, align: "right" });

      doc
        .moveTo(50, tableTop + 14)
        .lineTo(545, tableTop + 14)
        .strokeColor("#e5e7eb")
        .stroke();

      let y = tableTop + 22;
      for (const item of order.items) {
        const qty = Number(item.quantity ?? 0);
        const price = Number(item.price ?? 0);
        const total = qty * price;
        doc.fillColor("#000");
        doc.text(item.product?.name || "Item", colNameX, y, { width: 260 });
        doc.text(String(qty), colQtyX, y, { width: 50, align: "right" });
        doc.text(asMoney(price).replace("INR ", ""), colPriceX, y, {
          width: 70,
          align: "right",
        });
        doc.text(asMoney(total).replace("INR ", ""), colTotalX, y, {
          width: 75,
          align: "right",
        });
        y += 18;

        if (y > 720) {
          doc.addPage();
          y = 70;
        }
      }

      doc.moveDown(1);

      // Totals
      const subtotal = Number(order.totalAmount ?? 0);
      const discount = Number(order.discountAmount ?? 0);
      const grandTotal = Number(order.finalAmount ?? order.totalAmount ?? 0);

      doc
        .fontSize(10)
        .fillColor("#111")
        .text(`Subtotal: ${asMoney(subtotal)}`, 350, y + 10, {
          align: "right",
          width: 195,
        })
        .text(`Discount: ${asMoney(discount)}`, 350, y + 28, {
          align: "right",
          width: 195,
        })
        .fontSize(12)
        .text(`Total: ${asMoney(grandTotal)}`, 350, y + 50, {
          align: "right",
          width: 195,
        });

      doc.moveDown(4);

      // Payment info
      doc.fontSize(12).fillColor("#111").text("Payment Details");
      doc
        .moveDown(0.25)
        .fontSize(10)
        .fillColor("#000")
        .text(
          `Method: ${(order.paymentMethod || "").toString().toUpperCase() || "—"}`,
        )
        .text(`Status: ${(order.paymentStatus || "").toString() || "—"}`)
        .text(`Razorpay Payment: ${maskId((order as any).razorpayPaymentId)}`)
        .text(`Payment Reference: ${maskId((order as any).paymentId)}`);

      doc.moveDown(1);
      doc
        .fontSize(9)
        .fillColor("#555")
        .text("This is a system-generated invoice.");

      doc.end();
    } catch  {
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  app.get(
    "/api/user/orders/:id/payment-details",
    authUser,
    async (req, res) => {
      try {
        const order = await orderService.getOrder(req.params.id);
        if (!order || order.userId !== (req as any).user.id) {
          return res.status(404).json({ message: "Order not found" });
        }

        if (!order.razorpayPaymentId) {
          return res.json({ available: false });
        }

        const payment = paymentInfo({ razorpayPaymentId: order.razorpayPaymentId });

        return res.json(payment);
      } catch  {
        res.status(500).json({ message: "Failed to fetch payment details" });
      }
    },
  );

  app.post("/api/user/orders", authUser, async (req, res) => {
    try {
      const { shippingAddress, phone, notes, couponId } = req.body;
      const userId = (req as any).user.id;

      const cartItems = await cartServices.getCartItems(userId);
      if (cartItems.cart.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const items = mapCartWithPrices(cartItems.cart);

      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      let discountAmount = 0;
      let validCoupon = null;

      if (couponId) {
        const coupon = await couponsService.getCoupon(couponId);
        if (coupon?.isActive) {
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
          status: "created",
          paymentStatus: "pending",
          paymentMethod: "razorpay",
        },
        items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price.toString(),
        }))
      );

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
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to place order" });
    }
  });

  // =============================
  // CREATE RAZORPAY ORDER
  // =============================
  app.post("/api/user/create-razorpay-order", authUser, async (req, res) => {
    try {
      const { couponId } = req.body;
      const userId = (req as any).user.id;

      const cartItems = await cartServices.getCartItems(userId);
      if (cartItems.cart.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const items = mapCartWithPrices(cartItems.cart);

      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      let discountAmount = 0;

      if (couponId) {
        const coupon = await couponsService.getCoupon(couponId);
        if (coupon?.isActive) {
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

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(finalAmount * 100),
        currency: "INR",
        receipt: `r${Date.now()}`,
        payment_capture: true,
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

  // =============================
  // VERIFY PAYMENT
  // =============================
  app.post("/api/user/verify-payment", authUser, async (req, res) => {
    try {
      const {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        shippingAddress,
        phone,
        email,
        notes,
        couponId,
      } = req.body;

      const userId = (req as any).user.id;
      const cartItems = await cartServices.getCartItems(userId);

      if (cartItems.cart.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({ message: "Payment verification failed" });
      }

      const items = mapCartWithPrices(cartItems.cart);

      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      let discountAmount = 0;
      let validCoupon = null;

      if (couponId) {
        const coupon = await couponsService.getCoupon(couponId);
        if (coupon?.isActive) {
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

      const order = await db.transaction(async (tx) => {
        const newOrder = await orderService.createOrder(
          {
            userId,
            totalAmount: totalAmount.toString(),
            discountAmount: discountAmount.toString(),
            finalAmount: finalAmount.toString(),
            couponId,
            shippingAddress,
            phone,
            email,
            notes,
            status: "created",
            paymentStatus: "paid",
            paymentMethod: "razorpay",
            razorpayPaymentId,
          },
          items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price.toString(),
          }))
        );

        for (const item of items) {
          if (item.variantId) {
            await tx
              .update(productVariants)
              .set({
                stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}`,
              })
              .where(eq(productVariants.id, item.variantId));
          } else {
            await tx
              .update(products)
              .set({
                totalStock: sql`${products.totalStock} - ${item.quantity}`,
              })
              .where(eq(products.id, item.productId));
          }
        }

        return newOrder;
      });

      if (validCoupon && discountAmount > 0) {
        await couponsService.applyCoupon(
          validCoupon.id,
          userId,
          order.id,
          discountAmount.toString()
        );
      }

      await cartServices.clearCart(userId);

      // // 6️⃣ 🚀 AUTOMATIC SHIPPING PROCESSING
      // console.log(`🚀 Starting automatic shipping for order: ${order.id}`);
      
      // try {
      //   // Send order confirmation first
      //   await NotificationService.sendOrderConfirmation(order.id);
        
      //   // Process shipping automatically
      //   const shippingResult = await AutomaticShippingService.processShippingAutomatically(order.id);
        
      //   if (shippingResult.success) {
      //     // Send shipping confirmation
      //     await NotificationService.sendShippingConfirmation(
      //       order.id, 
      //       shippingResult.waybill!, 
      //       shippingResult.estimatedDelivery
      //     );
          
      //     console.log(`✅ Order ${order.id} processed and shipped successfully`);
          
      //     res.json({
      //       orderId: order.id,
      //       message: "Payment successful, order created and shipped automatically",
      //       shipping: {
      //         waybill: shippingResult.waybill,
      //         courier: shippingResult.courier,
      //         estimatedDelivery: shippingResult.estimatedDelivery
      //       }
      //     });
      //   } else {
      //     // Shipping failed but order created
      //     await AutomaticShippingService.handleShippingFailure(order.id, new Error(shippingResult.error || "Unknown shipping error"));
          
      //     console.log(`⚠️ Order ${order.id} created but shipping failed: ${shippingResult.error}`);
          
      //     res.json({
      //       orderId: order.id,
      //       message: "Payment successful, order created (shipping will be processed manually)",
      //       shipping: null,
      //       note: "Shipping failed - will be processed manually"
      //     });
      //   }
      // } catch (shippingError) {
      //   // Handle any shipping errors gracefully
      //   console.error(`❌ Automatic shipping error for order ${order.id}:`, shippingError);
      //   await AutomaticShippingService.handleShippingFailure(order.id, shippingError instanceof Error ? shippingError : new Error("Unknown shipping error"));
        
      //   res.json({
      //     orderId: order.id,
      //     message: "Payment successful, order created (shipping will be processed manually)",
      //     shipping: null,
      //     note: "Automatic shipping failed - will be processed manually"
      //   });
      // }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Payment verification failed" });
    }
  });
};