import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { createAuthMiddleware } from "../authMiddleware";
import { orderService } from "server/order/orderStorage";
import { couponsService } from "server/coupons/couponsStorage";

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

        const eligibility = await storage.checkOrderReturnEligibility(
          req.params.id
        );
        res.json(eligibility);
      } catch (error) {
        res.status(500).json({ message: "Failed to check return eligibility" });
      }
    }
  );

  // User: Get user's return requests
  app.get("/api/user/returns", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const returns = await storage.getUserReturnRequests(user.id);
      res.json(returns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch return requests" });
    }
  });

  // User: Get single return request
  app.get("/api/user/returns/:id", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const returnRequest = await storage.getReturnRequest(req.params.id);

      if (!returnRequest || returnRequest.userId !== user.id) {
        return res.status(404).json({ message: "Return request not found" });
      }

      res.json(returnRequest);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch return request" });
    }
  });

  // User: Create return request (supports both refund and exchange)
  app.post("/api/user/returns", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { orderId, reason, description, resolutionType, items } = req.body;

      // Validate order and eligibility
      const order = await orderService.getOrder(orderId);
      if (!order || order.userId !== user.id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const eligibility = await storage.checkOrderReturnEligibility(orderId);
      if (!eligibility.eligible) {
        return res.status(400).json({ message: eligibility.reason });
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
        if (resolutionType === "exchange" && item.exchangeSareeId) {
          const exchangeSaree = await storage.getSaree(item.exchangeSareeId);
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

      const returnRequest = await storage.createReturnRequest(
        {
          orderId,
          userId: user.id,
          reason,
          reasonDetails: description,
          resolution: resolutionType || "refund",
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
        resolutionType === "exchange"
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
          resolutionType === "exchange"
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
  // User: Get user's refunds
  app.get("/api/user/refunds", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const refunds = await storage.getRefunds({ userId: user.id });
      res.json(refunds);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch refunds" });
    }
  });

  // User: Create a review for a specific saree
  app.post("/api/sarees/:id/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const sareeId = req.params.id;
      const { rating, comment, title, images } = req.body;

      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ message: "Rating must be between 1 and 5" });
      }

      const review = await storage.createReview({
        sareeId,
        userId: user.id,
        rating,
        title,
        comment,
        images: images || [],
      });

      res.json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // User: Check if user can review a product
  app.get("/api/user/can-review/:sareeId", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const canReview = await storage.canUserReviewProduct(
        user.id,
        req.params.sareeId
      );
      res.json({ canReview });
    } catch (error) {
      res.status(500).json({ message: "Failed to check review eligibility" });
    }
  });

  // User: Create a review
  app.post("/api/user/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { sareeId, orderId, rating, title, comment, images } = req.body;

      // Validate rating
      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ message: "Rating must be between 1 and 5" });
      }

      // Check if user can review
      const canReview = await storage.canUserReviewProduct(user.id, sareeId);
      if (!canReview) {
        return res.status(400).json({
          message:
            "You cannot review this product. Either you haven't purchased it or already reviewed it.",
        });
      }

      const review = await storage.createReview({
        sareeId,
        userId: user.id,
        orderId,
        rating,
        title,
        comment,
        images: images || [],
      });

      res.json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // User: Get user's reviews
  app.get("/api/user/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const reviews = await storage.getUserReviews(user.id);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // User: Validate coupon
  app.post("/api/user/coupons/validate", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { code, orderAmount } = req.body;

      const result = await couponsService.validateCoupon(code, user.id, orderAmount);

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
};
