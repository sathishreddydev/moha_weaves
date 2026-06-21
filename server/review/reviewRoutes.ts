import type { Express } from "express";
import { createAuthMiddleware } from "server/authMiddleware";
import { reviewService } from "./reviewStorage";

export const reviewRoutes = (app: Express) => {
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
};
