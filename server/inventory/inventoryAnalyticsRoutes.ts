import type { Express } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { storage } from "../storage";

export const inventoryAnalyticsRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);

  // Inventory turnover
  app.get("/api/inventory/analytics/turnover", authInventory, async (req, res) => {
    try {
      const { limit, category, minStock } = req.query;

      const parsedLimit = limit ? parseInt(limit as string) : undefined;
      if (parsedLimit && (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000)) {
        return res.status(400).json({ message: "Invalid limit parameter. Must be between 1 and 1000." });
      }

      let filteredData = await storage.getInventoryTurnover();

      if (category) {
        filteredData = filteredData.filter((item) =>
          item.category.toLowerCase().includes((category as string).toLowerCase()),
        );
      }
      if (minStock) {
        const minStockValue = parseInt(minStock as string);
        if (!isNaN(minStockValue)) {
          filteredData = filteredData.filter((item) => item.totalStock >= minStockValue);
        }
      }
      if (parsedLimit) {
        filteredData = filteredData.slice(0, parsedLimit);
      }

      res.json({
        data: filteredData,
        summary: {
          totalProducts: filteredData.length,
          averageTurnover:
            filteredData.length > 0
              ? filteredData.reduce((sum, item) => sum + item.turnoverRatio, 0) / filteredData.length
              : 0,
          highPerformers: filteredData.filter((item) => item.turnoverRatio >= 4).length,
          lowPerformers: filteredData.filter((item) => item.turnoverRatio < 1).length,
          totalStockValue: filteredData.reduce((sum, item) => sum + item.costOfGoodsSold, 0),
        },
        filters: { limit: parsedLimit, category, minStock },
      });
    } catch (error) {
      console.error("Error fetching inventory turnover:", error);
      res.status(500).json({
        message: "Failed to fetch inventory turnover",
        error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      });
    }
  });

  // ABC analysis
  app.get("/api/inventory/analytics/abc-analysis", authInventory, async (req, res) => {
    try {
      const { class: abcClass, category, minRevenue } = req.query;

      if (abcClass && !["A", "B", "C"].includes(abcClass as string)) {
        return res.status(400).json({ message: "Invalid class parameter. Must be 'A', 'B', or 'C'." });
      }

      const minRevenueValue = minRevenue ? parseFloat(minRevenue as string) : undefined;
      if (minRevenueValue && (isNaN(minRevenueValue) || minRevenueValue < 0)) {
        return res.status(400).json({ message: "Invalid minRevenue parameter. Must be a positive number." });
      }

      let filteredData = await storage.getABCAnalysis();

      if (abcClass) filteredData = filteredData.filter((item) => item.class === abcClass);
      if (category) {
        filteredData = filteredData.filter((item) =>
          item.category.toLowerCase().includes((category as string).toLowerCase()),
        );
      }
      if (minRevenueValue) {
        filteredData = filteredData.filter((item) => item.revenueContribution >= minRevenueValue);
      }

      res.json({
        data: filteredData,
        summary: {
          totalProducts: filteredData.length,
          totalRevenue: filteredData.reduce((sum, item) => sum + item.revenueContribution, 0),
          classDistribution: {
            A: filteredData.filter((item) => item.class === "A").length,
            B: filteredData.filter((item) => item.class === "B").length,
            C: filteredData.filter((item) => item.class === "C").length,
          },
          revenueDistribution: {
            A: filteredData.filter((item) => item.class === "A").reduce((sum, item) => sum + item.revenueContribution, 0),
            B: filteredData.filter((item) => item.class === "B").reduce((sum, item) => sum + item.revenueContribution, 0),
            C: filteredData.filter((item) => item.class === "C").reduce((sum, item) => sum + item.revenueContribution, 0),
          },
          averageRevenuePerProduct:
            filteredData.length > 0
              ? filteredData.reduce((sum, item) => sum + item.revenueContribution, 0) / filteredData.length
              : 0,
        },
        filters: { class: abcClass, category, minRevenue: minRevenueValue },
      });
    } catch (error) {
      console.error("Error fetching ABC analysis:", error);
      res.status(500).json({
        message: "Failed to fetch ABC analysis",
        error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      });
    }
  });

  // Seasonal trends
  app.get("/api/inventory/analytics/seasonal-trends", authInventory, async (req, res) => {
    try {
      const { trend, category, minSeasonality, months } = req.query;

      if (trend && !["increasing", "decreasing", "stable", "seasonal"].includes(trend as string)) {
        return res.status(400).json({
          message: "Invalid trend parameter. Must be 'increasing', 'decreasing', 'stable', or 'seasonal'.",
        });
      }

      const minSeasonalityValue = minSeasonality ? parseInt(minSeasonality as string) : undefined;
      if (minSeasonalityValue && (isNaN(minSeasonalityValue) || minSeasonalityValue < 0 || minSeasonalityValue > 100)) {
        return res.status(400).json({ message: "Invalid minSeasonality parameter. Must be between 0 and 100." });
      }

      const monthsValue = months ? parseInt(months as string) : undefined;
      if (monthsValue && (isNaN(monthsValue) || monthsValue < 1 || monthsValue > 24)) {
        return res.status(400).json({ message: "Invalid months parameter. Must be between 1 and 24." });
      }

      let filteredData = await storage.getSeasonalTrends();

      if (trend) filteredData = filteredData.filter((item) => item.trend === trend);
      if (category) {
        filteredData = filteredData.filter((item) =>
          item.category.toLowerCase().includes((category as string).toLowerCase()),
        );
      }
      if (minSeasonalityValue) {
        filteredData = filteredData.filter((item) => item.seasonalityIndex >= minSeasonalityValue);
      }
      if (monthsValue) {
        filteredData = filteredData.filter((item) => item.monthlyData.length >= monthsValue);
      }

      res.json({
        data: filteredData,
        summary: {
          totalProducts: filteredData.length,
          trendDistribution: {
            increasing: filteredData.filter((item) => item.trend === "increasing").length,
            decreasing: filteredData.filter((item) => item.trend === "decreasing").length,
            stable: filteredData.filter((item) => item.trend === "stable").length,
            seasonal: filteredData.filter((item) => item.trend === "seasonal").length,
          },
          averageSeasonality:
            filteredData.length > 0
              ? filteredData.reduce((sum, item) => sum + item.seasonalityIndex, 0) / filteredData.length
              : 0,
          highlySeasonal: filteredData.filter((item) => item.seasonalityIndex > 30).length,
          totalDataPoints: filteredData.reduce((sum, item) => sum + item.monthlyData.length, 0),
          categories: Array.from(new Set(filteredData.map((item) => item.category))).length,
        },
        filters: { trend, category, minSeasonality: minSeasonalityValue, months: monthsValue },
      });
    } catch (error) {
      console.error("Error fetching seasonal trends:", error);
      res.status(500).json({
        message: "Failed to fetch seasonal trends",
        error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      });
    }
  });

  // Analytics summary
  app.get("/api/inventory/analytics/summary", authInventory, async (req, res) => {
    try {
      const [turnover, abcAnalysis, seasonalTrends] = await Promise.all([
        storage.getInventoryTurnover(),
        storage.getABCAnalysis(),
        storage.getSeasonalTrends(),
      ]);

      res.json({
        inventory: {
          totalProducts: turnover.length,
          averageTurnover:
            turnover.length > 0
              ? turnover.reduce((sum, item) => sum + item.turnoverRatio, 0) / turnover.length
              : 0,
          highPerformers: turnover.filter((item) => item.turnoverRatio >= 4).length,
          lowPerformers: turnover.filter((item) => item.turnoverRatio < 1).length,
        },
        abc: {
          totalRevenue: abcAnalysis.reduce((sum, item) => sum + item.revenueContribution, 0),
          classDistribution: {
            A: abcAnalysis.filter((item) => item.class === "A").length,
            B: abcAnalysis.filter((item) => item.class === "B").length,
            C: abcAnalysis.filter((item) => item.class === "C").length,
          },
          topProducts: abcAnalysis.slice(0, 10).map((item) => ({
            name: item.productName,
            revenue: item.revenueContribution,
            class: item.class,
          })),
        },
        seasonal: {
          totalProducts: seasonalTrends.length,
          trendDistribution: {
            increasing: seasonalTrends.filter((item) => item.trend === "increasing").length,
            decreasing: seasonalTrends.filter((item) => item.trend === "decreasing").length,
            stable: seasonalTrends.filter((item) => item.trend === "stable").length,
            seasonal: seasonalTrends.filter((item) => item.trend === "seasonal").length,
          },
          highlySeasonal: seasonalTrends.filter((item) => item.seasonalityIndex > 30).length,
          averageSeasonality:
            seasonalTrends.length > 0
              ? seasonalTrends.reduce((sum, item) => sum + item.seasonalityIndex, 0) / seasonalTrends.length
              : 0,
        },
        insights: {
          criticalIssues: [
            ...(turnover.filter((item) => item.turnoverRatio < 1).length > 0
              ? [{ type: "low_turnover", count: turnover.filter((item) => item.turnoverRatio < 1).length, description: "Products with very low turnover ratio" }]
              : []),
            ...(turnover.filter((item) => item.daysOfSupply > 365).length > 0
              ? [{ type: "excess_stock", count: turnover.filter((item) => item.daysOfSupply > 365).length, description: "Products with over 1 year of supply" }]
              : []),
          ],
          opportunities: [
            ...(seasonalTrends.filter((item) => item.trend === "increasing").length > 0
              ? [{ type: "growing_products", count: seasonalTrends.filter((item) => item.trend === "increasing").length, description: "Products with increasing demand" }]
              : []),
            ...(abcAnalysis.filter((item) => item.class === "A" && item.currentStock < 5).length > 0
              ? [{ type: "high_value_low_stock", count: abcAnalysis.filter((item) => item.class === "A" && item.currentStock < 5).length, description: "High-value products with low stock" }]
              : []),
          ],
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({
        message: "Failed to fetch analytics summary",
        error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      });
    }
  });
};
