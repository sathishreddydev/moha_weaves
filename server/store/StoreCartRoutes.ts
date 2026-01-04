import { z } from "zod";
import { Express, Request, Response } from "express";
import { StoreRepository } from "./storeStorage";
import { createAuthMiddleware } from "server/authMiddleware";


const cartItemSchema = z.object({
  id: z.string().optional(),
  sareeId: z.string(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  lineAmount: z.number().min(0),
});

export const addToCartSchema = z.object({
  sareeId: z.string(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});

export const updateCartSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      quantity: z.number().min(1).optional(),
      unitPrice: z.number().min(0).optional(),
    })
  ),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1),
});

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema),
  discount: z
    .object({
      type: z.enum(["percentage", "fixed", "coupon"]),
      value: z.number().min(0),
      code: z.string().optional(),
      couponId: z.string().optional(),
      description: z.string(),
      minOrderAmount: z.number().optional(),
      maxDiscount: z.number().optional(),
    })
    .optional(),
  tax: z.number().min(0),
  total: z.number().min(0),
  paymentMode: z.enum(["cash", "card", "upi"]),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
});

export const storeCartRoutes = (app: Express) => {
  const authStore = createAuthMiddleware(["store"]);

  app.get("/api/store/cart", authStore, async (req: Request, res: Response) => {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) return res.status(401).json({ error: "Store not authenticated" });

      const storeRepo = new StoreRepository();
      const cart = await storeRepo.getStoreCart(storeId);

      res.json(cart);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ error: "Failed to fetch cart" });
    }
  });

  app.post("/api/store/cart", authStore, async (req: Request, res: Response) => {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) return res.status(401).json({ error: "Store not authenticated" });

      const validatedData = addToCartSchema.parse(req.body);

      const storeRepo = new StoreRepository();
      const currentCart = await storeRepo.getStoreCart(storeId);

      const existingItem = currentCart.items.find(item => item.sareeId === validatedData.sareeId);

      let updatedItems;
      if (existingItem) {
        updatedItems = currentCart.items.map(item =>
          item.sareeId === validatedData.sareeId
            ? {
                ...item,
                quantity: item.quantity + validatedData.quantity,
                lineAmount: (item.quantity + validatedData.quantity) * validatedData.unitPrice,
              }
            : item
        );
      } else {
        const newItem = {
          id: validatedData.sareeId, 
          sareeId: validatedData.sareeId,
          quantity: validatedData.quantity,
          unitPrice: validatedData.unitPrice,
          lineAmount: validatedData.quantity * validatedData.unitPrice,
        };
        updatedItems = [...currentCart.items, newItem];
      }

      const updatedCart = await storeRepo.updateStoreCart(storeId, updatedItems);
      res.json({ message: "Item added to cart successfully", cart: updatedCart });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid item data", details: error.errors });
      }
      console.error("Error adding to cart:", error);
      res.status(500).json({ error: "Failed to add item to cart" });
    }
  });

  app.put("/api/store/cart", authStore, async (req: Request, res: Response) => {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) return res.status(401).json({ error: "Store not authenticated" });

      const validatedData = updateCartSchema.parse(req.body);
      const storeRepo = new StoreRepository();
      const currentCart = await storeRepo.getStoreCart(storeId);

      const updatedItems = currentCart.items.map(item => {
        const update = validatedData.items.find(i => i.id === item.id);
        if (!update) return item;

        const newQuantity = update.quantity ?? item.quantity;
        const newUnitPrice = update.unitPrice ?? item.unitPrice;

        return {
          ...item,
          quantity: newQuantity,
          unitPrice: newUnitPrice,
          lineAmount: newQuantity * newUnitPrice,
        };
      });

      const updatedCart = await storeRepo.updateStoreCart(storeId, updatedItems);
      res.json(updatedCart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid cart data", details: error.errors });
      }
      console.error("Error updating cart:", error);
      res.status(500).json({ error: "Failed to update cart" });
    }
  });

  app.post("/api/store/apply-coupon", authStore, async (req: Request, res: Response) => {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) return res.status(401).json({ error: "Store not authenticated" });

      const validatedData = applyCouponSchema.parse(req.body);
      const storeRepo = new StoreRepository();
      const discount = await storeRepo.applyCoupon(storeId, validatedData.code);

      res.json({ discount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid coupon data", details: error.errors });
      }
      console.error("Error applying coupon:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to apply coupon" });
    }
  });

  app.post("/api/store/checkout", authStore, async (req: Request, res: Response) => {
    try {
      const storeId = req.user?.storeId;
      const processedBy = req.user?.id;
      if (!storeId || !processedBy) return res.status(401).json({ error: "Store not authenticated" });

      const validatedData = checkoutSchema.parse(req.body);
      const storeRepo = new StoreRepository();

      const subtotal = validatedData.items.reduce((sum, item) => sum + item.lineAmount, 0);
      const discountAmount = validatedData.discount
        ? validatedData.discount.type === "percentage"
          ? (validatedData.discount.value / 100) * subtotal
          : validatedData.discount.value
        : 0;

      const order = await storeRepo.createStoreSale(storeId, processedBy, {
        customerName: validatedData.customerName,
        customerPhone: validatedData.customerPhone,
        items: validatedData.items,
        discountAmount,
        taxAmount: validatedData.tax,
        totalAmount: validatedData.total,
        paymentMode: validatedData.paymentMode,
        discountCode: validatedData.discount?.code,
      });

      // Clear cart
      await storeRepo.updateStoreCart(storeId, []);

      // Update coupon usage if applicable
      if (validatedData.discount?.code && validatedData.discount?.couponId) {
        await storeRepo.updateCouponUsage(
          validatedData.discount.couponId,
          processedBy,
          order.id,
          discountAmount.toString()
        );
      }

      res.json({ orderId: order.id, receiptUrl: `/api/store/receipt/${order.id}` });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid checkout data", details: error.errors });
      }
      console.error("Error during checkout:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to complete checkout" });
    }
  });

  app.get("/api/store/receipt/:orderId", authStore, async (req: Request, res: Response) => {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) return res.status(401).json({ error: "Store not authenticated" });

      const { orderId } = req.params;
      const storeRepo = new StoreRepository();
      const receipt = await storeRepo.generateReceipt(storeId, orderId);

      res.json(receipt);
    } catch (error) {
      console.error("Error generating receipt:", error);
      res.status(500).json({ error: "Failed to generate receipt" });
    }
  });
};
