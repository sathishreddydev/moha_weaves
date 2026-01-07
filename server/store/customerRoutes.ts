import { z } from "zod";
import type { Express, Request, Response } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { CustomerService } from "./customerStorage";
import { parsePaginationParams } from "../paginationHelper";

const customerService = new CustomerService();

// Validation schemas
const updateCustomerNotesSchema = z.object({
  notes: z.string().optional(),
});

const updateLoyaltyPointsSchema = z.object({
  points: z.number().min(0),
});

const redeemLoyaltyPointsSchema = z.object({
  phone: z.string().min(1),
  pointsToRedeem: z.number().min(1, "Points to redeem must be at least 1"),
});

export const customerRoutes = (app: Express) => {
  const authStore = createAuthMiddleware(["store"]);

  app.get(
    "/api/store_customers/:phone",
    authStore,
    async (req: Request, res: Response) => {
      try {
        const { phone } = req.params;
        const customer = await customerService.getCustomerByPhone(phone);

        res.json(customer || null);
      } catch (error) {
        console.error("Error finding customer by phone:", error);
        res.status(500).json({ error: "Failed to find customer" });
      }
    },
  );

  // Redeem loyalty points
  app.post(
    "/api/store_customers/redeem-points",
    authStore,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        if (!user.storeId) {
          return res.status(400).json({ error: "No store assigned" });
        }

        const validatedData = redeemLoyaltyPointsSchema.parse(req.body);
        
        // Get customer to check available points
        const customer = await customerService.getCustomerByPhone(validatedData.phone);
        if (!customer) {
          return res.status(404).json({ error: "Customer not found" });
        }

        if (customer.loyaltyPoints < validatedData.pointsToRedeem) {
          return res.status(400).json({ 
            error: "Insufficient loyalty points",
            availablePoints: customer.loyaltyPoints,
            requestedPoints: validatedData.pointsToRedeem
          });
        }

        const redeemValue = validatedData.pointsToRedeem * 2;

        const updatedCustomer = await customerService.addOrCreateCustomerLoyalty(
          customer.name,
          customer.phone,
          customer.storeId,
          -validatedData.pointsToRedeem
        );

        res.json({
          success: true,
          pointsRedeemed: validatedData.pointsToRedeem,
          redeemValue,
          remainingPoints: updatedCustomer.loyaltyPoints,
          message: `Successfully redeemed ${validatedData.pointsToRedeem} points for ₹${redeemValue}`
        });
      } catch (error) {
        console.error("Error redeeming loyalty points:", error);
        res.status(500).json({ error: "Failed to redeem loyalty points" });
      }
    },
  );
};
