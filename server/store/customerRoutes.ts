import { z } from "zod";
import type { Express, Request, Response } from "express";
import { createAuthMiddleware } from "../authMiddleware";
import { CustomerService } from "./customerStorage";

const customerService = new CustomerService();

// Validation schemas
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

  // Get customer loyalty points by phone
  app.get(
    "/api/store_customers/:phone/loyalty-points",
    authStore,
    async (req: Request, res: Response) => {
      try {
        const { phone } = req.params;
        const customer = await customerService.getCustomerByPhone(phone);

        if (!customer) {
          return res.json({
            loyaltyPoints: 0,
            redeemableValue: 0,
            exists: false,
          });
        }

        const redeemableValue = Math.floor(customer.loyaltyPoints * 0.05);

        res.json({
          loyaltyPoints: customer.loyaltyPoints,
          redeemableValue,
          exists: true,
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
          },
        });
      } catch (error) {
        console.error("Error fetching loyalty points:", error);
        res.status(500).json({ error: "Failed to fetch loyalty points" });
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
        const customer = await customerService.getCustomerByPhone(
          validatedData.phone,
        );
        if (!customer) {
          return res.status(404).json({ error: "Customer not found" });
        }

        if (customer.loyaltyPoints < validatedData.pointsToRedeem) {
          return res.status(400).json({
            error: "Insufficient loyalty points",
            availablePoints: customer.loyaltyPoints,
            requestedPoints: validatedData.pointsToRedeem,
          });
        }

        const redeemValue = validatedData.pointsToRedeem * 0.05; // 100 points = ₹5, so 1 point = ₹0.05

        const updatedCustomer =
          await customerService.addOrCreateCustomerLoyalty(
            customer.name,
            customer.phone,
            customer.storeId,
            -validatedData.pointsToRedeem,
          );

        res.json({
          success: true,
          pointsRedeemed: validatedData.pointsToRedeem,
          redeemValue,
          remainingPoints: updatedCustomer.loyaltyPoints,
          message: `Successfully redeemed ${validatedData.pointsToRedeem} points for ₹${redeemValue}`,
        });
      } catch (error) {
        console.error("Error redeeming loyalty points:", error);
        res.status(500).json({ error: "Failed to redeem loyalty points" });
      }
    },
  );
};
