import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "inventory", "store"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
export const distributionChannelEnum = pgEnum("distribution_channel", ["shop", "online", "both"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "dispatched", "received", "rejected"]);
export const storeSaleTypeEnum = pgEnum("store_sale_type", ["walk_in", "reserved"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded", "partially_refunded"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod", "online", "upi", "card", "netbanking"]);
export const returnStatusEnum = pgEnum("return_status", ["requested", "approved", "rejected", "pickup_scheduled", "picked_up", "received", "inspected", "completed", "cancelled"]);
export const returnReasonEnum = pgEnum("return_reason", ["defective", "wrong_item", "not_as_described", "size_issue", "color_mismatch", "damaged_in_shipping", "changed_mind", "other"]);
export const returnResolutionEnum = pgEnum("return_resolution", ["refund", "exchange", "store_credit"]);
export const refundStatusEnum = pgEnum("refund_status", ["pending", "initiated", "processing", "completed", "failed"]);
export const couponTypeEnum = pgEnum("coupon_type", ["percentage", "fixed", "free_shipping"]);
export const notificationTypeEnum = pgEnum("notification_type", ["order", "return", "refund", "promotion", "system"]);

// Users table - supports all roles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("user"),
  storeId: varchar("store_id"),
  isActive: boolean("is_active").notNull().default(true),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Refresh tokens for secure session management
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isRevoked: boolean("is_revoked").notNull().default(false),
});

// Categories for sarees
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
});

// Colors
export const colors = pgTable("colors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  hexCode: text("hex_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// Fabrics
export const fabrics = pgTable("fabrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

// Stores (physical outlets)
export const stores = pgTable("stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  managerId: varchar("manager_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sarees (products)
export const sarees = pgTable("sarees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  categoryId: varchar("category_id").references(() => categories.id),
  colorId: varchar("color_id").references(() => colors.id),
  fabricId: varchar("fabric_id").references(() => fabrics.id),
  imageUrl: text("image_url"),
  images: text("images").array(),
  videoUrl: text("video_url"),
  sku: text("sku").unique(),
  totalStock: integer("total_stock").notNull().default(0),
  onlineStock: integer("online_stock").notNull().default(0),
  distributionChannel: distributionChannelEnum("distribution_channel").notNull().default("both"),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store inventory (stock per store)
export const storeInventory = pgTable("store_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id).notNull(),
  sareeId: varchar("saree_id").references(() => sarees.id).notNull(),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Wishlist
export const wishlist = pgTable("wishlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sareeId: varchar("saree_id").references(() => sarees.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Cart
export const cart = pgTable("cart", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sareeId: varchar("saree_id").references(() => sarees.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Online Orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  paymentMethod: paymentMethodEnum("payment_method").default("cod"),
  paymentId: text("payment_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  shippingAddress: text("shipping_address").notNull(),
  phone: text("phone").notNull(),
  trackingNumber: text("tracking_number"),
  estimatedDelivery: timestamp("estimated_delivery"),
  deliveredAt: timestamp("delivered_at"),
  couponId: varchar("coupon_id"),
  notes: text("notes"),
  returnEligibleUntil: timestamp("return_eligible_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Order items
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  sareeId: varchar("saree_id").references(() => sarees.id).notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

// Store sales (in-store transactions)
export const storeSales = pgTable("store_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id).notNull(),
  soldBy: varchar("sold_by").references(() => users.id).notNull(),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  saleType: storeSaleTypeEnum("sale_type").notNull().default("walk_in"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store sale items
export const storeSaleItems = pgTable("store_sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").references(() => storeSales.id).notNull(),
  sareeId: varchar("saree_id").references(() => sarees.id).notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

// User addresses for delivery
export const userAddresses = pgTable("user_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  locality: text("locality").notNull(),
  city: text("city").notNull(),
  pincode: text("pincode").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Serviceable pincodes for delivery availability check
export const serviceablePincodes = pgTable("serviceable_pincodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pincode: text("pincode").notNull().unique(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  deliveryDays: integer("delivery_days").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Stock requests from stores
export const stockRequests = pgTable("stock_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").references(() => stores.id).notNull(),
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  sareeId: varchar("saree_id").references(() => sarees.id).notNull(),
  quantity: integer("quantity").notNull(),
  status: requestStatusEnum("status").notNull().default("pending"),
  approvedBy: varchar("approved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Return requests
export const returnRequests = pgTable("return_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  status: returnStatusEnum("status").notNull().default("requested"),
  reason: returnReasonEnum("reason").notNull(),
  reasonDetails: text("reason_details"),
  resolution: returnResolutionEnum("resolution").notNull().default("refund"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  pickupAddress: text("pickup_address"),
  pickupScheduledAt: timestamp("pickup_scheduled_at"),
  pickedUpAt: timestamp("picked_up_at"),
  receivedAt: timestamp("received_at"),
  inspectionNotes: text("inspection_notes"),
  processedBy: varchar("processed_by"),
  exchangeOrderId: varchar("exchange_order_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Return items (individual items in a return request)
export const returnItems = pgTable("return_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnRequestId: varchar("return_request_id").references(() => returnRequests.id).notNull(),
  orderItemId: varchar("order_item_id").references(() => orderItems.id).notNull(),
  quantity: integer("quantity").notNull(),
  condition: text("condition"),
  isRestockable: boolean("is_restockable").default(true),
});

// Refunds
export const refunds = pgTable("refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnRequestId: varchar("return_request_id").references(() => returnRequests.id),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: refundStatusEnum("status").notNull().default("pending"),
  refundMethod: text("refund_method"),
  stripeRefundId: text("stripe_refund_id"),
  reason: text("reason"),
  processedBy: varchar("processed_by"),
  initiatedAt: timestamp("initiated_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Product reviews
export const productReviews = pgTable("product_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sareeId: varchar("saree_id").references(() => sarees.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  rating: integer("rating").notNull(),
  title: text("title"),
  comment: text("comment"),
  images: text("images").array(),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false),
  isApproved: boolean("is_approved").default(true),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Coupons
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  type: couponTypeEnum("type").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0),
  perUserLimit: integer("per_user_limit").default(1),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  categoryId: varchar("category_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Coupon usage tracking
export const couponUsage = pgTable("coupon_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").references(() => coupons.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: text("data"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Order status history for tracking
export const orderStatusHistory = pgTable("order_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  status: orderStatusEnum("status").notNull(),
  note: text("note"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Application settings for configurable values
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(stores, { fields: [users.storeId], references: [stores.id] }),
  wishlistItems: many(wishlist),
  cartItems: many(cart),
  orders: many(orders),
  storeSales: many(storeSales),
  stockRequests: many(stockRequests),
  addresses: many(userAddresses),
  returnRequests: many(returnRequests),
  refunds: many(refunds),
  reviews: many(productReviews),
  notifications: many(notifications),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, { fields: [userAddresses.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  sarees: many(sarees),
}));

export const colorsRelations = relations(colors, ({ many }) => ({
  sarees: many(sarees),
}));

export const fabricsRelations = relations(fabrics, ({ many }) => ({
  sarees: many(sarees),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  manager: one(users, { fields: [stores.managerId], references: [users.id] }),
  inventory: many(storeInventory),
  sales: many(storeSales),
  stockRequests: many(stockRequests),
}));

export const sareesRelations = relations(sarees, ({ one, many }) => ({
  category: one(categories, { fields: [sarees.categoryId], references: [categories.id] }),
  color: one(colors, { fields: [sarees.colorId], references: [colors.id] }),
  fabric: one(fabrics, { fields: [sarees.fabricId], references: [fabrics.id] }),
  wishlistItems: many(wishlist),
  cartItems: many(cart),
  orderItems: many(orderItems),
  storeInventory: many(storeInventory),
  storeSaleItems: many(storeSaleItems),
  stockRequests: many(stockRequests),
  reviews: many(productReviews),
}));

export const storeInventoryRelations = relations(storeInventory, ({ one }) => ({
  store: one(stores, { fields: [storeInventory.storeId], references: [stores.id] }),
  saree: one(sarees, { fields: [storeInventory.sareeId], references: [sarees.id] }),
}));

export const wishlistRelations = relations(wishlist, ({ one }) => ({
  user: one(users, { fields: [wishlist.userId], references: [users.id] }),
  saree: one(sarees, { fields: [wishlist.sareeId], references: [sarees.id] }),
}));

export const cartRelations = relations(cart, ({ one }) => ({
  user: one(users, { fields: [cart.userId], references: [users.id] }),
  saree: one(sarees, { fields: [cart.sareeId], references: [sarees.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  returnRequests: many(returnRequests),
  refunds: many(refunds),
  statusHistory: many(orderStatusHistory),
  reviews: many(productReviews),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  saree: one(sarees, { fields: [orderItems.sareeId], references: [sarees.id] }),
}));

export const storeSalesRelations = relations(storeSales, ({ one, many }) => ({
  store: one(stores, { fields: [storeSales.storeId], references: [stores.id] }),
  seller: one(users, { fields: [storeSales.soldBy], references: [users.id] }),
  items: many(storeSaleItems),
}));

export const storeSaleItemsRelations = relations(storeSaleItems, ({ one }) => ({
  sale: one(storeSales, { fields: [storeSaleItems.saleId], references: [storeSales.id] }),
  saree: one(sarees, { fields: [storeSaleItems.sareeId], references: [sarees.id] }),
}));

export const stockRequestsRelations = relations(stockRequests, ({ one }) => ({
  store: one(stores, { fields: [stockRequests.storeId], references: [stores.id] }),
  requester: one(users, { fields: [stockRequests.requestedBy], references: [users.id] }),
  saree: one(sarees, { fields: [stockRequests.sareeId], references: [sarees.id] }),
}));

export const returnRequestsRelations = relations(returnRequests, ({ one, many }) => ({
  order: one(orders, { fields: [returnRequests.orderId], references: [orders.id] }),
  user: one(users, { fields: [returnRequests.userId], references: [users.id] }),
  items: many(returnItems),
  refund: many(refunds),
}));

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  returnRequest: one(returnRequests, { fields: [returnItems.returnRequestId], references: [returnRequests.id] }),
  orderItem: one(orderItems, { fields: [returnItems.orderItemId], references: [orderItems.id] }),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  returnRequest: one(returnRequests, { fields: [refunds.returnRequestId], references: [returnRequests.id] }),
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
  user: one(users, { fields: [refunds.userId], references: [users.id] }),
}));

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  saree: one(sarees, { fields: [productReviews.sareeId], references: [sarees.id] }),
  user: one(users, { fields: [productReviews.userId], references: [users.id] }),
  order: one(orders, { fields: [productReviews.orderId], references: [orders.id] }),
}));

export const couponsRelations = relations(coupons, ({ many }) => ({
  usage: many(couponUsage),
  orders: many(orders),
}));

export const couponUsageRelations = relations(couponUsage, ({ one }) => ({
  coupon: one(coupons, { fields: [couponUsage.couponId], references: [coupons.id] }),
  user: one(users, { fields: [couponUsage.userId], references: [users.id] }),
  order: one(orders, { fields: [couponUsage.orderId], references: [orders.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, tokenVersion: true });
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertColorSchema = createInsertSchema(colors).omit({ id: true });
export const insertFabricSchema = createInsertSchema(fabrics).omit({ id: true });
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true });
export const insertSareeSchema = createInsertSchema(sarees).omit({ id: true, createdAt: true });
export const insertStoreInventorySchema = createInsertSchema(storeInventory).omit({ id: true, updatedAt: true });
export const insertWishlistSchema = createInsertSchema(wishlist).omit({ id: true, createdAt: true });
export const insertCartSchema = createInsertSchema(cart).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertStoreSaleSchema = createInsertSchema(storeSales).omit({ id: true, createdAt: true });
export const insertStoreSaleItemSchema = createInsertSchema(storeSaleItems).omit({ id: true });
export const insertStockRequestSchema = createInsertSchema(stockRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserAddressSchema = createInsertSchema(userAddresses).omit({ id: true, createdAt: true });
export const insertServiceablePincodeSchema = createInsertSchema(serviceablePincodes).omit({ id: true, createdAt: true });
export const insertReturnRequestSchema = createInsertSchema(returnRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReturnItemSchema = createInsertSchema(returnItems).omit({ id: true });
export const insertRefundSchema = createInsertSchema(refunds).omit({ id: true, createdAt: true });
export const insertProductReviewSchema = createInsertSchema(productReviews).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true });
export const insertCouponUsageSchema = createInsertSchema(couponUsage).omit({ id: true, usedAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertOrderStatusHistorySchema = createInsertSchema(orderStatusHistory).omit({ id: true, createdAt: true });
export const insertAppSettingSchema = createInsertSchema(appSettings).omit({ updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Color = typeof colors.$inferSelect;
export type InsertColor = z.infer<typeof insertColorSchema>;
export type Fabric = typeof fabrics.$inferSelect;
export type InsertFabric = z.infer<typeof insertFabricSchema>;
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Saree = typeof sarees.$inferSelect;
export type InsertSaree = z.infer<typeof insertSareeSchema>;
export type StoreInventory = typeof storeInventory.$inferSelect;
export type InsertStoreInventory = z.infer<typeof insertStoreInventorySchema>;
export type WishlistItem = typeof wishlist.$inferSelect;
export type InsertWishlistItem = z.infer<typeof insertWishlistSchema>;
export type CartItem = typeof cart.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type StoreSale = typeof storeSales.$inferSelect;
export type InsertStoreSale = z.infer<typeof insertStoreSaleSchema>;
export type StoreSaleItem = typeof storeSaleItems.$inferSelect;
export type InsertStoreSaleItem = z.infer<typeof insertStoreSaleItemSchema>;
export type StockRequest = typeof stockRequests.$inferSelect;
export type InsertStockRequest = z.infer<typeof insertStockRequestSchema>;
export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = z.infer<typeof insertUserAddressSchema>;
export type ServiceablePincode = typeof serviceablePincodes.$inferSelect;
export type InsertServiceablePincode = z.infer<typeof insertServiceablePincodeSchema>;
export type ReturnRequest = typeof returnRequests.$inferSelect;
export type InsertReturnRequest = z.infer<typeof insertReturnRequestSchema>;
export type ReturnItem = typeof returnItems.$inferSelect;
export type InsertReturnItem = z.infer<typeof insertReturnItemSchema>;
export type Refund = typeof refunds.$inferSelect;
export type InsertRefund = z.infer<typeof insertRefundSchema>;
export type ProductReview = typeof productReviews.$inferSelect;
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type CouponUsage = typeof couponUsage.$inferSelect;
export type InsertCouponUsage = z.infer<typeof insertCouponUsageSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type InsertOrderStatusHistory = z.infer<typeof insertOrderStatusHistorySchema>;
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;

// Extended types for frontend use
export type SareeWithDetails = Saree & {
  category?: Category | null;
  color?: Color | null;
  fabric?: Fabric | null;
};

export type CartItemWithSaree = CartItem & {
  saree: SareeWithDetails;
};

export type WishlistItemWithSaree = WishlistItem & {
  saree: SareeWithDetails;
};

export type OrderWithItems = Order & {
  items: (OrderItem & { saree: SareeWithDetails })[];
};

export type StockRequestWithDetails = StockRequest & {
  saree: SareeWithDetails;
  store: Store;
};

export type StoreSaleWithItems = StoreSale & {
  items: (StoreSaleItem & { saree: SareeWithDetails })[];
  store: Store;
};

export type SareeWithReviews = SareeWithDetails & {
  reviews?: ProductReview[];
  averageRating?: number;
  reviewCount?: number;
};

export type ReturnRequestWithDetails = ReturnRequest & {
  order: OrderWithItems;
  user: User;
  items: (ReturnItem & { orderItem: OrderItem & { saree: SareeWithDetails } })[];
  refund?: Refund;
};

export type RefundWithDetails = Refund & {
  returnRequest?: ReturnRequest;
  order: Order;
  user: User;
};

export type CouponWithUsage = Coupon & {
  usageCount?: number;
};
