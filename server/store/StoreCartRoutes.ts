import { Express, Request, Response } from "express";
import { createAuthMiddleware } from "server/authMiddleware";
import { z } from "zod";
import { StoreRepository } from "./storeStorage";


const cartItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  variantId: z.string().nullable().optional(),
  quantity: z.number().min(1),
  unitPrice: z.union([z.number().min(0), z.string().min(0)]),
  lineAmount: z.number().min(0),
  totalStock: z.number().min(0),
});

export const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});

export const updateCartSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      quantity: z.number().min(1).optional(),
      unitPrice: z.number().min(0).optional(),
      productId: z.string(),
      variantId: z.string().optional(),
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
      description: z.string().nullable(),
      minOrderAmount: z.number().nullable(),
      maxDiscount: z.number().nullable(),
    })
    .nullable()
    .optional(),
  loyaltyDiscount: z.object({
    pointsRedeemed: z.number().min(0),
    discountValue: z.number().min(0),
  }).nullable().optional(),
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
      if (!storeId) {
        return res.status(401).json({ error: "Store not authenticated" });
      }

      const validatedData = addToCartSchema.parse(req.body);
      const storeRepo = new StoreRepository();

      const inventory = await storeRepo.getStoreInventoryItem(
        storeId,
        validatedData.productId
      );

      if (!inventory || inventory.quantity < validatedData.quantity) {
        return res.status(400).json({
          error: "Insufficient stock",
          message: `Only ${inventory?.quantity || 0} items available in stock`,
        });
      }

      const updatedCart = await storeRepo.addToStoreCart(
        storeId,
        validatedData.productId,
        validatedData.variantId,
        validatedData.quantity,
        validatedData.unitPrice
      );

      res.json(updatedCart);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid item data",
          details: error.errors,
        });
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

      // Validate stock availability for all items in single query
      const productIds = validatedData.items
        .filter(item => item.quantity !== undefined)
        .map(item => item.productId);

      const inventoryData = await storeRepo.getStoreInventoryItems(storeId, productIds);
      const inventoryMap = new Map(
        inventoryData.map((inv: any) => [inv.productId, inv])
      );

      // Get variant inventory for variant items
      const variantIds = validatedData.items
        .filter(item => item.quantity !== undefined && item.variantId)
        .map(item => item.variantId) as string[];

      let variantInventoryData: any[] = [];
      if (variantIds.length > 0) {
        variantInventoryData = await storeRepo.getStoreVariantInventoryItems(storeId, variantIds);
      }
      const variantInventoryMap = new Map(
        variantInventoryData.map((inv: any) => [inv.variantId, inv])
      );

      for (const item of validatedData.items) {
        if (item.quantity === undefined) continue;

        if (item.variantId) {
          // Check variant-level stock
          const variantInventory = variantInventoryMap.get(item.variantId);
          if (!variantInventory || (variantInventory as any).quantity < item.quantity) {
            return res.status(400).json({
              error: "Insufficient stock",
              message: `Only ${(variantInventory as any)?.quantity || 0} items available for variant ${item.variantId}`
            });
          }
        } else {
          // Check product-level stock
          const inventory = inventoryMap.get(item.productId);
          if (!inventory || (inventory as any).quantity < item.quantity) {
            return res.status(400).json({
              error: "Insufficient stock",
              message: `Only ${(inventory as any)?.quantity || 0} items available for item ${item.productId}`
            });
          }
        }
      }

      const updatedCart = await storeRepo.updateStoreCart(storeId, validatedData.items);
      res.json(updatedCart);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid cart data", details: error.errors });
      }
      console.error("Error updating cart:", error);
      res.status(500).json({ error: "Failed to update cart" });
    }
  });

  app.delete("/api/store/cart/:productId/:variantId?", authStore, async (req: Request, res: Response) => {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) return res.status(401).json({ error: "Store not authenticated" });

      const { productId, variantId } = req.params;
      const storeRepo = new StoreRepository();

      await storeRepo.deleteFromStoreCart(storeId, productId, variantId);

      res.json({ message: "Item removed from cart successfully" });
    } catch (error) {
      console.error("Error removing item:", error);
      res.status(500).json({ error: "Failed to remove item from cart" });
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

      // Validate stock availability for all checkout items in single query
      const productIds = validatedData.items.map(item => item.productId);
      const inventoryData = await storeRepo.getStoreInventoryItems(storeId, productIds);
      const inventoryMap = new Map(
        inventoryData.map((inv: any) => [inv.productId, inv])
      );

      // Get variant inventory for variant items
      const variantIds = validatedData.items
        .filter(item => item.variantId)
        .map(item => item.variantId) as string[];

      let variantInventoryData: any[] = [];
      if (variantIds.length > 0) {
        variantInventoryData = await storeRepo.getStoreVariantInventoryItems(storeId, variantIds);
      }
      const variantInventoryMap = new Map(
        variantInventoryData.map((inv: any) => [inv.variantId, inv])
      );

      for (const item of validatedData.items) {
        if (item.variantId) {
          // Check variant-level stock
          const variantInventory = variantInventoryMap.get(item.variantId);
          if (!variantInventory || (variantInventory as any).quantity < item.quantity) {
            return res.status(400).json({
              error: "Insufficient stock",
              message: `Only ${(variantInventory as any)?.quantity || 0} items available for variant ${item.variantId}. Cannot complete checkout.`
            });
          }
        } else {
          // Check product-level stock
          const inventory = inventoryMap.get(item.productId);
          if (!inventory || (inventory as any).quantity < item.quantity) {
            return res.status(400).json({
              error: "Insufficient stock",
              message: `Only ${(inventory as any)?.quantity || 0} items available for item ${item.productId}. Cannot complete checkout.`
            });
          }
        }
      }

      const subtotal = validatedData.items.reduce((sum, item) => sum + item.lineAmount, 0);
      const discountAmount = validatedData.discount
        ? validatedData.discount.type === "percentage"
          ? (validatedData.discount.value / 100) * subtotal
          : validatedData.discount.value
        : 0;
      
      const loyaltyDiscountAmount = 0;
      const pointsRedeemed = 0;
      
      // // Handle loyalty points redemption
      // if (validatedData.loyaltyDiscount && validatedData.loyaltyDiscount.pointsRedeemed > 0) {
      //   // Get customer to check available points
      //   const customer = await customerService.getCustomerByPhone(validatedData.customerPhone);
      //   if (!customer) {
      //     return res.status(404).json({ error: "Customer not found for loyalty points redemption" });
      //   }

      //   if (customer.loyaltyPoints < validatedData.loyaltyDiscount.pointsRedeemed) {
      //     return res.status(400).json({ 
      //       error: "Insufficient loyalty points",
      //       availablePoints: customer.loyaltyPoints,
      //       requestedPoints: validatedData.loyaltyDiscount.pointsRedeemed
      //     });
      //   }

      //   // Redeem the points
      //   const updatedCustomer = await customerService.addOrCreateCustomerLoyalty(
      //     customer.name,
      //     customer.phone,
      //     customer.storeId,
      //     -validatedData.loyaltyDiscount.pointsRedeemed
      //   );
        
      //   loyaltyDiscountAmount = validatedData.loyaltyDiscount.discountValue;
      //   pointsRedeemed = validatedData.loyaltyDiscount.pointsRedeemed;
      // }

      const order = await storeRepo.createStoreSale(storeId, processedBy, {
        customerName: validatedData.customerName,
        customerPhone: validatedData.customerPhone,
        items: validatedData.items,
        discountAmount,
        loyaltyDiscountAmount,
        taxAmount: validatedData.tax,
        totalAmount: validatedData.total,
        paymentMode: validatedData.paymentMode,
        discountCode: validatedData.discount?.code,
      });

      if (validatedData.discount?.code && validatedData.discount?.couponId) {
        await storeRepo.updateCouponUsage(
          validatedData.discount.couponId,
          processedBy,
          order.id,
          discountAmount.toString()
        );
      }

      res.json({ 
        orderId: order.id, 
        receiptUrl: `/api/store/receipt/${order.id}`,
        pointsRedeemed,
        loyaltyDiscountAmount
      });
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
