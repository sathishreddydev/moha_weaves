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

      const history = await storage.getOrderStatusHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order history" });
    }
  });

  // User: Validate return request
  app.post("/api/user/returns/validate", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { orderId, reason, reasonDetails, resolution, items } = req.body;

      // Validate order and eligibility
      const order = await orderService.getOrder(orderId);
      if (!order || order.userId !== user.id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const eligibility = await returnService.checkOrderReturnEligibility(
        orderId
      );
      if (!eligibility.eligible) {
        return res.status(400).json({ message: eligibility.reason });
      }

      const activeStatuses = [
        "requested",
        "approved",
        "pickup_scheduled",
        "picked_up",
        "in_transit",
        "received",
        "inspected",
        "completed",
      ] as const;

      const inProgressStatuses = [
        "requested",
        "approved",
        "pickup_scheduled",
        "picked_up",
        "in_transit",
        "received",
        "inspected",
      ] as const;

      // Per-orderItem lock: if an order item is already part of an in-progress request,
      // do not allow raising another request for that same order item concurrently.
      const requestedOrderItemIds: string[] = Array.from(
        new Set((items || []).map((i: any) => String(i.orderItemId)))
      );
      if (requestedOrderItemIds.length > 0) {
        const existingItemRows = await db
          .select({ orderItemId: returnItems.orderItemId })
          .from(returnItems)
          .innerJoin(
            returnRequests,
            eq(returnItems.returnRequestId, returnRequests.id)
          )
          .where(
            and(
              eq(returnRequests.orderId, orderId),
              inArray(returnRequests.status, [...inProgressStatuses]),
              inArray(returnItems.orderItemId, requestedOrderItemIds)
            )
          )
          .limit(1);

        if (existingItemRows.length > 0) {
          return res.status(400).json({
            message:
              "A return/exchange for one of the selected items is already in progress. Please wait until it is completed/rejected/cancelled.",
          });
        }
      }

      // Allow multiple ONLY for returns; exchanges are restricted if there is already an active request.
      if (resolution === "exchange") {
        const existingActive = await db
          .select({ id: returnRequests.id })
          .from(returnRequests)
          .where(
            and(
              eq(returnRequests.orderId, orderId),
              eq(returnRequests.resolution, "exchange" as any),
              inArray(returnRequests.status, [...inProgressStatuses])
            )
          )
          .limit(1);

        if (existingActive.length > 0) {
          return res.status(400).json({
            message:
              "An active return/exchange request already exists for this order. Only returns can be raised multiple times.",
          });
        }
      }

      // Remaining quantity validation per order item (prevents over-returning across multiple requests)
      const returnedRows = await db
        .select({
          orderItemId: returnItems.orderItemId,
          qty: sql<number>`sum(${returnItems.quantity})::int`,
        })
        .from(returnItems)
        .innerJoin(
          returnRequests,
          eq(returnItems.returnRequestId, returnRequests.id)
        )
        .where(
          and(
            eq(returnRequests.orderId, orderId),
            inArray(returnRequests.status, [...activeStatuses])
          )
        )
        .groupBy(returnItems.orderItemId);

      const returnedByItem: Record<string, number> = {};
      for (const row of returnedRows) {
        returnedByItem[String(row.orderItemId)] = Number(row.qty || 0);
      }

      for (const item of items) {
        const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
        if (!orderItem) {
          return res.status(400).json({ message: "Invalid order item" });
        }

        const purchasedQty = Number(orderItem.quantity || 0);
        const alreadyRequestedQty = Number(returnedByItem[String(orderItem.id)] || 0);
        const remainingQty = Math.max(0, purchasedQty - alreadyRequestedQty);
        const requestedQty = Number(item.quantity || 0);

        if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
          return res.status(400).json({ message: "Invalid quantity" });
        }

        if (requestedQty > remainingQty) {
          return res.status(400).json({
            message: `Invalid quantity for an item. Remaining eligible quantity is ${remainingQty}.`,
          });
        }
      }

      // Calculate return amount and validate exchange items
      let returnAmount = 0;
      let exchangeAmount = 0;

      for (const item of items) {
        const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
        if (orderItem) {
          returnAmount += parseFloat(orderItem.price) * item.quantity;
        }

        // If exchange, validate and calculate exchange product price
        if (resolution === "exchange" && item.exchangeSareeId) {
          const exchangeSaree = await sareeService.getSaree(
            item.exchangeSareeId
          );
          if (!exchangeSaree) {
            return res
              .status(400)
              .json({ message: "Exchange product not found" });
          }
          if (exchangeSaree.onlineStock < item.quantity) {
            return res.status(400).json({
              message: `Insufficient stock for exchange product: ${exchangeSaree.name}`,
            });
          }
          exchangeAmount += parseFloat(exchangeSaree.price) * item.quantity;
        }
      }

      // Calculate price difference for exchanges
      const priceDifference = exchangeAmount - returnAmount;

      const returnRequest = await returnService.createReturnRequest(
        {
          orderId,
          userId: user.id,
          reason,
          reasonDetails,
          resolution: resolution || "refund",
          refundAmount: returnAmount.toString(),
        },
        items.map((item: any) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          reason: item.reason,
          exchangeSareeId: item.exchangeSareeId || null,
        }))
      );

      // Create notification
      const notificationMessage =
        resolution === "exchange"
          ? `Your exchange request for order #${orderId.slice(
              -8
            )} has been submitted. ${
              priceDifference > 0
                ? `You will need to pay ₹${priceDifference.toFixed(
                    2
                  )} for the price difference.`
                : priceDifference < 0
                ? `You will receive ₹${Math.abs(priceDifference).toFixed(
                    2
                  )} as store credit.`
                : ""
            }`
          : `Your return request for order #${orderId.slice(
              -8
            )} has been submitted and is pending review.`;

      await storage.createNotification({
        userId: user.id,
        type: "return",
        title:
          resolution === "exchange"
            ? "Exchange Request Submitted"
            : "Return Request Submitted",
        message: notificationMessage,
        relatedId: returnRequest.id,
        relatedType: "return_request",
      });

      res.json({
        ...returnRequest,
        exchangeAmount: exchangeAmount.toString(),
        priceDifference: priceDifference.toString(),
      });
    } catch (error) {
      console.error("Error creating return request:", error);
      res.status(500).json({ message: "Failed to create return request" });
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

      const history = await storage.getOrderStatusHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order history" });
    }
  });
};
