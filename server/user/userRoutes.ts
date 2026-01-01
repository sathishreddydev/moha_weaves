import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { createAuthMiddleware } from "../authMiddleware";
import { orderService } from "server/order/orderStorage";
import { couponsService } from "server/coupons/couponsStorage";
import { sareeService } from "server/saree/sareeStorage";
import { returnService } from "server/inventory/returnServices";
import { db } from "server/db";
import { returnItems, returnRequests } from "@shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

const authUser = createAuthMiddleware(["user"]);
export const userRoutes = (app: Express) => {
  // User: Check return eligibility for an order
  app.get(
    "/api/user/orders/:id/return-eligibility",
    authUser,
    async (req, res) => {
      try {
        const user = (req as any).user;
        const order = await orderService.getOrder(req.params.id);

        if (!order || order.userId !== user.id) {
          return res.status(404).json({ message: "Order not found" });
        }

        const eligibility = await returnService.checkOrderReturnEligibility(
          req.params.id
        );
        res.json(eligibility);
      } catch (error) {
        res.status(500).json({ message: "Failed to check return eligibility" });
      }
    }
  );

  // User: Validate coupon
  app.post("/api/user/coupons/validate", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { code, orderAmount } = req.body;

      const result = await couponsService.validateCoupon(
        code,
        user.id,
        orderAmount
      );

      if (!result.valid) {
        return res.status(400).json({ message: result.error });
      }

      // Calculate discount
      let discountAmount = 0;
      const coupon = result.coupon!;

      if (coupon.type === "percentage") {
        discountAmount = (orderAmount * parseFloat(coupon.value)) / 100;
        if (coupon.maxDiscount) {
          discountAmount = Math.min(
            discountAmount,
            parseFloat(coupon.maxDiscount)
          );
        }
      } else {
        discountAmount = parseFloat(coupon.value);
      }

      res.json({
        valid: true,
        coupon,
        discountAmount: discountAmount.toFixed(2),
        finalAmount: (orderAmount - discountAmount).toFixed(2),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to validate coupon" });
    }
  });

  // User: Get order status history
  app.get("/api/user/orders/:id/history", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const order = await orderService.getOrder(req.params.id);

      if (!order || order.userId !== user.id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const history = await storage.getItemStatusHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order history" });
    }
  });

  // User: Get order status history
  app.get("/api/user/orders/:id/history", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const order = await orderService.getOrder(req.params.id);

      if (!order || order.userId !== user.id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const history = await storage.getItemStatusHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order history" });
    }
  });
};
