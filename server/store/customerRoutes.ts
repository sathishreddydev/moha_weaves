import { z } from "zod";
import type { Express, Request, Response } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { CustomerService } from "./customerStorage";

const customerService = new CustomerService();

// Validation schemas
const updateCustomerNotesSchema = z.object({
  notes: z.string().optional(),
});

const updateLoyaltyPointsSchema = z.object({
  points: z.number().min(0),
});

export const customerRoutes = (app: Express) => {
  const authStore = createAuthMiddleware(["store"]);

  // Get all customers for a store
  app.get("/api/store/customers", authStore, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user.storeId) {
        return res.status(400).json({ error: "Store not assigned" });
      }

      const search = req.query.search as string;
      const customers = await customerService.getAllCustomers(user.storeId, search);
      
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Get customer by ID
  app.get("/api/store/customers/:id", authStore, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const customer = await customerService.getCustomerById(id);
      
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Get customer purchase history
  app.get("/api/store/customers/:id/purchases", authStore, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const purchases = await customerService.getCustomerPurchases(id);
      
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching customer purchases:", error);
      res.status(500).json({ error: "Failed to fetch customer purchases" });
    }
  });

  // Update customer notes
  app.patch("/api/store/customers/:id/notes", authStore, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = updateCustomerNotesSchema.parse(req.body);
      
      const customer = await customerService.updateCustomerNotes(id, validatedData.notes || "");
      
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      
      console.error("Error updating customer notes:", error);
      res.status(500).json({ error: "Failed to update customer notes" });
    }
  });

  // Update customer loyalty points
  app.patch("/api/store/customers/:id/loyalty-points", authStore, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = updateLoyaltyPointsSchema.parse(req.body);
      
      const customer = await customerService.updateCustomerLoyaltyPoints(id, validatedData.points);
      
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      
      console.error("Error updating loyalty points:", error);
      res.status(500).json({ error: "Failed to update loyalty points" });
    }
  });

  // Get customer statistics for dashboard
  app.get("/api/store/customers/stats", authStore, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user.storeId) {
        return res.status(400).json({ error: "Store not assigned" });
      }

      const stats = await customerService.getCustomerStats(user.storeId);
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching customer stats:", error);
      res.status(500).json({ error: "Failed to fetch customer stats" });
    }
  });

  // Find customer by phone number (for checkout)
  app.get("/api/store/customers/phone/:phone", authStore, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user.storeId) {
        return res.status(400).json({ error: "Store not assigned" });
      }

      const { phone } = req.params;
      const customer = await customerService.getCustomerByPhone(phone, user.storeId);
      
      res.json(customer || null);
    } catch (error) {
      console.error("Error finding customer by phone:", error);
      res.status(500).json({ error: "Failed to find customer" });
    }
  });
};
