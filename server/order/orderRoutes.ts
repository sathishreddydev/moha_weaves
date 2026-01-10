import type { Express } from "express";
import { storage } from "../storage";
import { createAuthMiddleware } from "../authMiddleware";
import { cartServices } from "../cart/cartStorage";
import { orderService } from "./orderStorage";
import { couponsService } from "server/coupons/couponsStorage";
import { razorpay } from "server/razorpayClient";
import { fetchPaymentDetails } from "../razorpayClient";
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
        `attachment; filename="invoice-${safeId}.pdf"`
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
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#e5e7eb")
        .stroke();
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
        .text(`Method: ${(order.paymentMethod || "").toString().toUpperCase() || "—"}`)
        .text(`Status: ${(order.paymentStatus || "").toString() || "—"}`)
        .text(`Razorpay Payment: ${maskId((order as any).razorpayPaymentId)}`)
        .text(`Payment Reference: ${maskId((order as any).paymentId)}`);

      doc.moveDown(1);
      doc
        .fontSize(9)
        .fillColor("#555")
        .text("This is a system-generated invoice.");

      doc.end();
    } catch (error) {
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  app.get("/api/user/orders/:id/payment-details", authUser, async (req, res) => {
    try {
      const order = await orderService.getOrder(req.params.id);
      if (!order || order.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!order.razorpayPaymentId) {
        return res.json({ available: false });
      }

      const payment = await fetchPaymentDetails(order.razorpayPaymentId);

      const mask = (value?: string | null) => {
        if (!value) return "—";
        const trimmed = value.trim();
        if (trimmed.length <= 8) return trimmed;
        return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
      };

      const method = (payment as any).method as string | undefined;
      const card = (payment as any).card;
      const bank = (payment as any).bank;
      const wallet = (payment as any).wallet;
      const vpa = (payment as any).vpa;

      let display = method ? method.toUpperCase() : "—";
      let subtype: string | undefined;

      if (method === "card") {
        const last4 = card?.last4 ? String(card.last4) : "—";
        const network = card?.network ? String(card.network).toUpperCase() : "CARD";
        subtype = card?.type ? String(card.type).toUpperCase() : undefined;
        display = `${network} •••• ${last4}`;
      } else if (method === "upi") {
        display = vpa ? `UPI ${mask(String(vpa))}` : "UPI";
      } else if (method === "netbanking") {
        display = bank ? `NETBANKING ${String(bank).toUpperCase()}` : "NETBANKING";
      } else if (method === "wallet") {
        display = wallet ? `WALLET ${String(wallet).toUpperCase()}` : "WALLET";
      } else if (method === "emi") {
        display = "EMI";
      } else if (method === "paylater") {
        display = "PAY LATER";
      }

      return res.json({
        available: true,
        method,
        display,
        subtype,
        razorpayPaymentId: mask(order.razorpayPaymentId),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment details" });
    }
  });

  app.post("/api/user/orders", authUser, async (req, res) => {
    try {
      const { shippingAddress, phone, notes, couponId } = req.body;
      const userId = (req as any).user.id;

      const cartItems = await cartServices.getCartItems(userId);
      if (cartItems.cart.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const totalAmount = cartItems.cart.reduce((sum, item) => {
        const originalPrice =
          typeof item.product.price === "string"
            ? parseFloat(item.product.price)
            : item.product.price;
        const price = (item.product as any).discountedPrice ?? originalPrice;
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
          status: "created",
        },
        cartItems.cart.map((item) => {
          const originalPrice =
            typeof item.product.price === "string"
              ? parseFloat(item.product.price)
              : item.product.price;
          const effectivePrice =
            (item.product as any).discountedPrice ?? originalPrice;
          return {
            productId: item.productId,
            quantity: item.quantity,
            price: effectivePrice.toString(),
          };
        })
      );

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
      if (cartItems.cart.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }
      // 1️⃣ Calculate total
      const totalAmount = cartItems.cart.reduce((sum, item) => {
        const price = (item.product as any).discountedPrice ?? item.product.price;
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
      if (  cartItems.cart.length === 0) {
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
      const totalAmount = cartItems.cart.reduce((sum, item) => {
        const price = (item.product as any).discountedPrice ?? item.product.price;
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
          status: "created",
          paymentStatus: "paid",
          paymentMethod: "razorpay",
          razorpayPaymentId, 
        },
        cartItems.cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: (
            (item.product as any).discountedPrice ?? item.product.price
          ).toString(),
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
