import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export const publicRoutes = (app: Express) => {
  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Colors
  app.get("/api/colors", async (req, res) => {
    try {
      const colors = await storage.getColors();
      res.json(colors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch colors" });
    }
  });

  // Fabrics
  app.get("/api/fabrics", async (req, res) => {
    try {
      const fabrics = await storage.getFabrics();
      res.json(fabrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch fabrics" });
    }
  });

  // Sarees
  app.get("/api/sarees", async (req, res) => {
    try {
      const {
        search,
        category,
        color,
        fabric,
        featured,
        minPrice,
        maxPrice,
        sort,
        limit,
      } = req.query;

      const sarees = await storage.getSarees({
        search: search as string,
        category: category as string,
        color: color as string,
        fabric: fabric as string,
        featured: featured === "true",
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        sort: sort as string,
        limit: limit ? parseInt(limit as string) : undefined,
        distributionChannel: "online",
      });

      res.json(sarees);
    } catch (error) {
      console.error("Sarees fetch error:", error);
      res.status(500).json({ message: "Failed to fetch sarees" });
    }
  });

  app.get("/api/sarees/:id", async (req, res) => {
    try {
      const saree = await storage.getSaree(req.params.id);
      if (!saree) {
        return res.status(404).json({ message: "Saree not found" });
      }
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saree" });
    }
  });
  // Public: Get reviews for a saree
  app.get("/api/sarees/:id/reviews", async (req, res) => {
    try {
      const reviews = await storage.getProductReviews(req.params.id, {
        approved: true,
      });
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Public: Get review stats for a saree
  app.get("/api/sarees/:id/reviews/stats", async (req, res) => {
    try {
      const reviews = await storage.getProductReviews(req.params.id, {
        approved: true,
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

      res.json({
        averageRating,
        totalReviews,
        ratingDistribution,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review stats" });
    }
  });

  // Public: Get saree with reviews and ratings
  app.get("/api/sarees/:id/with-reviews", async (req, res) => {
    try {
      const saree = await storage.getSareeWithReviews(req.params.id);
      if (!saree) {
        return res.status(404).json({ message: "Saree not found" });
      }
      res.json(saree);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saree with reviews" });
    }
  });

  // Public: Get active sales
  app.get("/api/sales", async (req, res) => {
    try {
      const { featured, category } = req.query;
      const sales = await storage.getSales({
        isActive: true,
        isFeatured: featured === "true" ? true : undefined,
        categoryId: category as string,
        current: true,
      });
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  // Public: Get single sale with products
  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale || !sale.isActive) {
        return res.status(404).json({ message: "Sale not found" });
      }
      
      const now = new Date();
      if (now < new Date(sale.validFrom) || now > new Date(sale.validUntil)) {
        return res.status(404).json({ message: "Sale not active" });
      }
      
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });
};
