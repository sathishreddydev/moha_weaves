import type { Express } from "express";
import { z } from "zod";
import { createAuthMiddleware } from "../authMiddleware";
import { addressService } from "./addressStorage";
const addressSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .regex(
      /^(\+91[\-\s]?)?[6-9]\d{9}$/,
      "Enter a valid 10-digit Indian mobile number"
    ),
  addressLine1: z
    .string()
    .min(5, "Address line 1 must be at least 5 characters")
    .max(200),
  locality: z.string().min(2, "Locality must be at least 2 characters").max(200),
  city: z.string().min(2, "City must be at least 2 characters").max(100),
  state: z.string().min(2, "State must be at least 2 characters").max(100),
  pincode: z
    .string()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  isDefault: z.boolean().optional().default(false),
  addressType: z.enum(["home", "work", "other"]).default("home"),
});


export const addressRoutes = (app: Express) => {
  const authUser = createAuthMiddleware(["user"]);

  // User Addresses
  app.get("/api/user/addresses", authUser, async (req, res) => {
    try {
      const addresses = await addressService.getUserAddresses((req as any).user.id);
      res.json(addresses);
    } catch {
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  app.post("/api/user/addresses", authUser, async (req, res) => {
    try {
      const validation = addressSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const address = await addressService.createUserAddress({
        ...validation.data,
        userId: (req as any).user.id,
      });
      res.json(address);
    } catch {
      res.status(500).json({ message: "Failed to create address" });
    }
  });

  app.patch("/api/user/addresses/:id", authUser, async (req, res) => {
    try {
      const address = await addressService.getUserAddress(req.params.id);
      if (!address || address.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Address not found" });
      }
      const validation = addressSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const updated = await addressService.updateUserAddress(req.params.id, validation.data);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update address" });
    }
  });

  app.patch("/api/user/addresses/:id/default", authUser, async (req, res) => {
    try {
      const address = await addressService.setDefaultAddress((req as any).user.id, req.params.id);
      if (!address) {
        return res.status(404).json({ message: "Address not found" });
      }
      res.json(address);
    } catch {
      res.status(500).json({ message: "Failed to set default address" });
    }
  });

  app.delete("/api/user/addresses/:id", authUser, async (req, res) => {
    try {
      const address = await addressService.getUserAddress(req.params.id);
      if (!address || address.userId !== (req as any).user.id) {
        return res.status(404).json({ message: "Address not found" });
      }
      await addressService.deleteUserAddress(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  // Pincode availability check (public)
  app.get("/api/pincodes/:pincode/check", async (req, res) => {
    try {
      const { pincode } = req.params;

      // Validate format first
      if (!/^[1-9][0-9]{5}$/.test(pincode)) {
        return res.status(400).json({ available: false, message: "Invalid pincode format" });
      }

      const postalcodes = await import("postalcodes-india");
      const info = postalcodes.default.find(pincode);

      if (info && info.isValid) {
        res.json({
          available: true,
          city: info.place,
          state: info.state,
          deliveryDays: 5,
        });
      } else {
        res.json({
          available: false,
          message: "Delivery not available in this area",
        });
      }
    } catch {
      res.status(500).json({ message: "Failed to check pincode" });
    }
  });
}