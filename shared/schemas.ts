import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import * as tables from "./tables";

// Insert schemas
export const insertUserSchema = createInsertSchema(tables.users).omit({
  id: true,
  createdAt: true,
  tokenVersion: true,
});

export const insertRefreshTokenSchema = createInsertSchema(tables.refreshTokens).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(tables.categories).omit({
  id: true,
}).extend({
  sizes: z.array(z.string()).default([]),
});

export const insertSubcategorySchema = createInsertSchema(tables.subcategories).omit({
  id: true,
});

export const insertColorSchema = createInsertSchema(tables.colors).omit({ id: true });

export const insertFabricSchema = createInsertSchema(tables.fabrics).omit({
  id: true,
});

export const insertStoreSchema = createInsertSchema(tables.stores).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(tables.products).omit({
  id: true,
  createdAt: true,
});

export const insertStoreInventorySchema = createInsertSchema(
  tables.storeInventory
).omit({ id: true, updatedAt: true });

export const insertWishlistSchema = createInsertSchema(tables.wishlist).omit({
  id: true,
  createdAt: true,
});

export const insertCartSchema = createInsertSchema(tables.cart).omit({
  id: true,
  createdAt: true,
});

export const insertStoreCartSchema = createInsertSchema(tables.storeCart).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(tables.orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(tables.orderItems).omit({
  id: true,
});

export const insertStoreSaleSchema = createInsertSchema(tables.storeSales).omit({
  id: true,
  createdAt: true,
});

export const insertStoreSaleItemSchema = createInsertSchema(
  tables.storeSaleItems
).omit({ id: true });

export const insertStockRequestSchema = createInsertSchema(tables.stockRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserAddressSchema = createInsertSchema(tables.userAddresses).omit({
  id: true,
  createdAt: true,
});

export const insertServiceablePincodeSchema = createInsertSchema(
  tables.serviceablePincodes
).omit({ id: true, createdAt: true });

export const insertReturnRequestSchema = createInsertSchema(
  tables.returnRequests
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertReturnItemSchema = createInsertSchema(tables.returnItems).omit({
  id: true,
});

export const insertOnlineExchangeSchema = createInsertSchema(
  tables.onlineExchanges
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertOnlineExchangeItemSchema = createInsertSchema(
  tables.onlineExchangeItems
).omit({ id: true });

export const insertRefundSchema = createInsertSchema(tables.refunds).omit({
  id: true,
  createdAt: true,
});

export const insertProductReviewSchema = createInsertSchema(
  tables.productReviews
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCouponSchema = createInsertSchema(tables.coupons).omit({
  id: true,
  createdAt: true,
});

export const insertCouponUsageSchema = createInsertSchema(tables.couponUsage).omit({
  id: true,
  usedAt: true,
});

export const insertNotificationSchema = createInsertSchema(tables.notifications).omit({
  id: true,
  createdAt: true,
});

export const insertAppSettingSchema = createInsertSchema(tables.appSettings).omit({
  updatedAt: true,
});

export const insertItemStatusHistorySchema = createInsertSchema(
  tables.itemStatusHistory
).omit({ id: true, createdAt: true });

export const insertStockMovementSchema = createInsertSchema(
  tables.stockMovements
).omit({ id: true, createdAt: true });

export const insertStockTransferSchema = createInsertSchema(
  tables.stockTransfers
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertInventoryAdjustmentSchema = createInsertSchema(
  tables.inventoryAdjustments
).omit({ id: true, createdAt: true });

export const insertStoreExchangeSchema = createInsertSchema(
  tables.storeExchanges
).omit({ createdAt: true });

export const insertStoreExchangeReturnItemSchema = createInsertSchema(
  tables.storeExchangeReturnItems
).omit({ id: true });

export const insertStoreExchangeNewItemSchema = createInsertSchema(
  tables.storeExchangeNewItems
).omit({ id: true });

export const insertSaleSchema = createInsertSchema(tables.sales)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    validFrom: z.date().or(z.string()),
    validUntil: z.date().or(z.string()),
  });

export const insertSaleProductSchema = createInsertSchema(tables.saleProducts).omit({
  id: true,
  createdAt: true,
});

export const insertContactMessageSchema = createInsertSchema(tables.contactMessages, {
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export const insertProductDamageSchema = createInsertSchema(tables.productDamages)
  .omit({ id: true, createdAt: true, updatedAt: true, reportedBy: true })
  .extend({
    stockReductions: z.record(z.string().transform((val) => parseInt(val) || 0)),
    quantity: z.number().optional(),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    costValue: z.string().optional(),
    recoveryValue: z.string().optional(),
    notes: z.string().optional(),
    allocationType: z.enum(["online", "store", "both"]).optional(),
    storeId: z.string().optional(),
  });

// Type exports for frontend
export type StoreCustomer = typeof tables.store_customers.$inferSelect;
export type CustomerPurchase = {
  id: string;
  saleId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  discountAmount: string;
  paymentMode: string;
  createdAt: Date;
  items: CustomerPurchaseItem[];
};

export type CustomerPurchaseItem = {
  id: string;
  productId: string;
  quantity: number; // notNull in database
  price: string;
  returnedQuantity: number; // notNull in database
  product: {
    id: string;
    name: string;
    code: string;
    imageUrl: string;
    category: { name: string } | null;
    color: { name: string } | null;
    fabric: { name: string } | null;
  } | null;
};
