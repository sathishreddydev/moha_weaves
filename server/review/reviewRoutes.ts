import { checkReviewForSpam } from "server/checkReviewForSpam";
import { reviewService } from "./reviewStorage";
import { createAuthMiddleware } from "server/authMiddleware";
import type { Express, Request, Response, NextFunction } from "express";

export const reviewRoutes = (app: Express) => {
  const authUser = createAuthMiddleware(["user"]);
  const authAdmin = createAuthMiddleware(["admin"]);

  app.patch("/api/admin/reviews/:id/status", authAdmin, async (req, res) => {
    try {
      const { isApproved } = req.body;

      if (typeof isApproved !== "boolean") {
        return res
          .status(400)
          .json({ message: "isApproved must be a boolean" });
      }

      const review = await reviewService.updateReviewApproval(
        req.params.id,
        isApproved
      );
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      res.json(review);
    } catch (error) {
      res.status(500).json({ message: "Failed to update review status" });
    }
  });
  app.get("/api/admin/reviews", authAdmin, async (req, res) => {
    try {
      const reviews = await reviewService.getAllReviews();
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });
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
      const spamCheck = checkReviewForSpam({ title, comment });
      if (spamCheck.flag) {
        return res
          .status(403)
          .json({ message: `Review flagged: ${spamCheck.reason}` });
      }
      const review = await reviewService.createReview({
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
      const canReview = await reviewService.canUserReviewProduct(
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
      const canReview = await reviewService.canUserReviewProduct(
        user.id,
        sareeId
      );
      if (!canReview) {
        return res.status(400).json({
          message:
            "You cannot review this product. Either you haven't purchased it or already reviewed it.",
        });
      }

      const review = await reviewService.createReview({
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
      const reviews = await reviewService.getUserReviews(user.id);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });
};
