import type { Express } from "express";
import { publicStorage } from "./publicStorage";
import { storage } from "../storage";
import { productService } from "server/product/productStorage";
import { salesService } from "server/sales&offer/salesStorage";
import { reviewService } from "server/review/reviewStorage";

export const publicRoutes = (app: Express) => {
  app.get("/api/filters", async (req, res) => {
    try {
      const [categories, colors, fabrics] = await Promise.all([
        publicStorage.getCategoriesWithSubcategories(),
        publicStorage.getColors(),
        publicStorage.getFabrics(),
      ]);

      res.json({ categories, colors, fabrics });
    } catch {
      res.status(500).json({ message: "Failed to fetch filters" });
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await publicStorage.getCategoriesWithSubcategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // products
  app.get("/api/products", async (req, res) => {
    try {
      const {
        search,
        category,
        subcategory,
        color,
        fabric,
        featured,
        minPrice,
        maxPrice,
        sort,
        limit,
      } = req.query;

      const products = await productService.getProducts({
        search: search as string,
        category: category as string,
        subcategory: subcategory as string,
        color: color as string,
        fabric: fabric as string,
        featured: featured === "true",
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        sort: sort as string,
        limit: limit ? parseInt(limit as string) : undefined,
        distributionChannel: "online",
      });

      res.json(products);
    } catch (error) {
      console.error("products fetch error:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });
  app.post("/api/getProducts", async (req, res) => {
    try {
      const {
        search,
        category,
        subcategory,
        color,
        fabric,
        featured,
        minPrice,
        maxPrice,
        sort,
        limit,
        onSale,
      } = req.body;

      const products = await productService.getNewProducts({
        search,
        category,
        subcategory,
        color,
        fabric,
        featured: featured === true,
        minPrice,
        maxPrice,
        sort,
        limit,
        onSale: onSale === true,
        distributionChannel: "online",
      });

      res.json(products);
    } catch (error) {
      console.error("products fetch error:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await productService.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });
  // Public: Get reviews for a product
  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const reviews = await reviewService.getProductReviews(req.params.id);
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
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Public: Get product with reviews and ratings
  app.get("/api/products/:id/with-reviews", async (req, res) => {
    try {
      const product = await reviewService.getProductWithReviews(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product with reviews" });
    }
  });

  // Public: Get active sales
  app.get("/api/sales", async (req, res) => {
    try {
      const { featured, category } = req.query;
      const sales = await salesService.getSales({
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
      const sale = await salesService.getSale(req.params.id);
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
