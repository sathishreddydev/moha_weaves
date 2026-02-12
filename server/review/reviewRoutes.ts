import type { Express } from "express";
import { createAuthMiddleware } from "server/authMiddleware";
import { checkReviewForSpam } from "server/checkReviewForSpam";
import { reviewService } from "./reviewStorage";

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
    } catch {
      res.status(500).json({ message: "Failed to update review status" });
    }
  });
  app.get("/api/admin/reviews", authAdmin, async (req, res) => {
    try {
      const reviews = await reviewService.getAllReviews();
      res.json(reviews);
    } catch {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });
  app.post("/api/products/:id/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = req.params.id;
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
      const reviews = await reviewService.createReview({
        productId,
        userId: user.id,
        rating,
        title,
        comment,
        images: images || [],
      });

      const totalReviews = reviews.length;
      const averageRating =
        totalReviews > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
          : 0;

      const ratingDistribution: Record<number, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      reviews.forEach((r) => {
        if (ratingDistribution[r.rating] !== undefined) {
          ratingDistribution[r.rating]++;
        }
      });
      const response = {
        reviews: reviews,
        stats: { averageRating, totalReviews, ratingDistribution },
      };
      res.json(response);
    } catch {
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // User: Check if user can review a product
  app.get("/api/user/can-review/:productId", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const canReview = await reviewService.canUserReviewProduct(
        user.id,
        req.params.productId
      );
      res.json({ canReview });
    } catch {
      res.status(500).json({ message: "Failed to check review eligibility" });
    }
  });

  // User: Create a review
  app.post("/api/user/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const { productId, orderId, rating, title, comment, images } = req.body;

      // Validate rating
      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ message: "Rating must be between 1 and 5" });
      }

      // Check if user can review
      const canReview = await reviewService.canUserReviewProduct(
        user.id,
        productId
      );
      if (!canReview) {
        return res.status(400).json({
          message:
            "You cannot review this product. Either you haven't purchased it or already reviewed it.",
        });
      }

      const review = await reviewService.createReview({
        productId,
        userId: user.id,
        orderId,
        rating,
        title,
        comment,
        images: images || [],
      });

      res.json(review);
    } catch {
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // User: Get user's reviews
  app.get("/api/user/reviews", authUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const reviews = await reviewService.getUserReviews(user.id);
      res.json(reviews);
    } catch {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });
};
