import type { Express} from "express";
import postalcodes from "postalcodes-india";
import { z } from "zod";
import { createAuthMiddleware } from "../authMiddleware";
import { addressService } from "./addressStorage";
const addressSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone must be a 10-digit number"),
  locality: z.string().min(5, "Locality must be at least 5 characters").max(200),
  city: z.string().min(2, "City must be at least 2 characters").max(100),
  pincode: z.string().regex(/^[0-9]{6}$/, "Pincode must be a 6-digit number"),
  isDefault: z.boolean().optional().default(false),
});


export const addressRoutes = (app: Express) => {
    const authUser = createAuthMiddleware(["user"]);

   // User Addresses
   app.get("/api/user/addresses", authUser, async (req, res) => {
     try {
       const addresses = await addressService.getUserAddresses((req as any).user.id);
       res.json(addresses);
     } catch (error) {
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
     } catch (error) {
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
     } catch (error) {
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
     } catch (error) {
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
     } catch (error) {
       res.status(500).json({ message: "Failed to delete address" });
     }
   });
 
   // Pincode availability check (public)
   app.get("/api/pincodes/:pincode/check", async (req, res) => {
     try {
       // const pincode = await addressService.checkPincodeAvailability(req.params.pincode);
       const info = postalcodes.find(req.params.pincode);
       
       if (info) {
         res.json({
           available: info.isValid,
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
     } catch (error) {
       res.status(500).json({ message: "Failed to check pincode" });
     }
   });
}