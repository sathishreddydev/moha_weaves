import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import * as enums from "./enums";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: enums.userRoleEnum("role").notNull().default("user"),
  storeId: varchar("store_id"),
  isActive: boolean("is_active").notNull().default(true),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Refresh tokens for secure session management
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isRevoked: boolean("is_revoked").notNull().default(false),
});

// Categories for sarees
export const categories = pgTable("categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
});

// Colors
export const colors = pgTable("colors", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  hexCode: text("hex_code").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// Fabrics
export const fabrics = pgTable("fabrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

// Stores (physical outlets)
export const stores = pgTable("stores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  managerId: varchar("manager_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sarees (products)
export const sarees = pgTable("sarees", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  distributionChannel: enums.distributionChannelEnum("distribution_channel")
    .notNull()
    .default("both"),
  isActive: boolean("is_active").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store inventory (stock per store)
export const storeInventory = pgTable("store_inventory", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .references(() => stores.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Wishlist
export const wishlist = pgTable("wishlist", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store cart (for in-store sales)
export const storeCart = pgTable("store_cart", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .references(() => stores.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineAmount: decimal("line_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Cart
export const cart = pgTable("cart", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Online Orders
export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .notNull(),
  userId: varchar("user_id").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  finalAmount: decimal("final_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  status: enums.orderStatusEnum("status").notNull().default("created"),
  paymentStatus: enums.paymentStatusEnum("payment_status")
    .notNull()
    .default("pending"),
  paymentMethod: enums.paymentMethodEnum("payment_method").default("razorpay"),
  paymentId: text("payment_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
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
  id: varchar("id")
    .primaryKey()
    .notNull(),
  orderId: varchar("order_id")
    .references(() => orders.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  returnEligibleUntil: timestamp("return_eligible_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Store sales (in-store transactions)
export const storeSales = pgTable("store_sales", {
  id: varchar("id")
    .primaryKey()
    .notNull(),
  storeId: varchar("store_id")
    .references(() => stores.id)
    .notNull(),
  soldBy: varchar("sold_by")
    .references(() => users.id)
    .notNull(),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  paymentMode: varchar("payment_mode").default("cash"),
  saleType: enums.storeSaleTypeEnum("sale_type").notNull().default("walk_in"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store sale items
export const storeSaleItems = pgTable("store_sale_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id")
    .references(() => storeSales.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  returnedQuantity: integer("returned_quantity").notNull().default(0),
});

// User addresses for delivery
export const userAddresses = pgTable("user_addresses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pincode: text("pincode").notNull().unique(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  deliveryDays: integer("delivery_days").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Stock requests from stores
export const stockRequests = pgTable("stock_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .references(() => stores.id)
    .notNull(),
  requestedBy: varchar("requested_by")
    .references(() => users.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  status: enums.requestStatusEnum("status").notNull().default("pending"),
  approvedBy: varchar("approved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Return requests
export const returnRequests = pgTable("return_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .references(() => orders.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  status: enums.returnStatusEnum("status").notNull().default("return_requested"),
  reason: enums.returnReasonEnum("reason").notNull(),
  reasonDetails: text("reason_details"),
  resolution: enums.returnResolutionEnum("resolution").notNull().default("refund"),
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  returnRequestId: varchar("return_request_id")
    .references(() => returnRequests.id)
    .notNull(),
  orderItemId: varchar("order_item_id")
    .references(() => orderItems.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  condition: text("condition"),
  isRestockable: boolean("is_restockable").default(true),
});

// Online exchanges - separate table for online exchange requests
export const onlineExchanges = pgTable("online_exchanges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .references(() => orders.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  status: enums.onlineExchangeStatusEnum("status").notNull().default("exchange_requested"),
  reason: enums.returnReasonEnum("reason").notNull(),
  reasonDetails: text("reason_details"),
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

// Online exchange items - items being exchanged in online exchanges
export const onlineExchangeItems = pgTable("online_exchange_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  exchangeId: varchar("exchange_id")
    .references(() => onlineExchanges.id)
    .notNull(),
  orderItemId: varchar("order_item_id")
    .references(() => orderItems.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  exchangeSareeId: varchar("exchange_saree_id").references(() => sarees.id),
  condition: text("condition"),
  isRestockable: boolean("is_restockable").default(true),
});

// Refunds
export const refunds = pgTable("refunds", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  returnRequestId: varchar("return_request_id").references(
    () => returnRequests.id
  ),
  orderId: varchar("order_id")
    .references(() => orders.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: enums.refundStatusEnum("status").notNull().default("pending"),
  refundMethod: text("refund_method"),
  razorpayRefundId: text("razorpay_refund_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  reason: text("reason"),
  processedBy: varchar("processed_by"),
  initiatedAt: timestamp("initiated_at"),
  completedAt: timestamp("completed_at"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Product reviews
export const productReviews = pgTable("product_reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  type: enums.couponTypeEnum("type").notNull(),
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

// Sales and Offers
export const sales = pgTable("sales", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  offerType: enums.offerTypeEnum("offer_type").notNull(),
  discountValue: decimal("discount_value", {
    precision: 10,
    scale: 2,
  }).notNull(),
  categoryId: varchar("category_id").references(() => categories.id),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  bannerImage: text("banner_image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Sale product mapping (for product-level offers)
export const saleProducts = pgTable("sale_products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id")
    .references(() => sales.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Coupon usage tracking
export const couponUsage = pgTable("coupon_usage", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id")
    .references(() => coupons.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  orderId: varchar("order_id")
    .references(() => orders.id)
    .notNull(),
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  type: enums.notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: text("data"),
  isRead: boolean("is_read").default(false),
  relatedId: varchar("related_id"),
  relatedType: text("related_type"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Item status history for tracking individual item status changes
export const itemStatusHistory = pgTable("item_status_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderItemId: varchar("order_item_id")
    .references(() => orderItems.id)
    .notNull(),
  status: text("status").notNull(),
  newStatus: text("new_status"),
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

// Stock movements for tracking stock deductions
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  movementType: enums.stockMovementTypeEnum("movement_type")
    .notNull()
    .default("sale"),
  source: enums.stockMovementSourceEnum("source").notNull(),
  orderRefId: varchar("order_ref_id").notNull(),
  storeId: varchar("store_id").references(() => stores.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Stock transfers between stores
export const stockTransfers = pgTable("stock_transfers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  fromStoreId: varchar("from_store_id").references(() => stores.id),
  toStoreId: varchar("to_store_id")
    .references(() => stores.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  status: enums.transferStatusEnum("status").notNull().default("pending"),
  requestedBy: varchar("requested_by")
    .references(() => users.id)
    .notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Inventory adjustments for damaged/lost items
export const inventoryAdjustments = pgTable("inventory_adjustments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  storeId: varchar("store_id").references(() => stores.id),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  adjustedBy: varchar("adjusted_by")
    .references(() => users.id)
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store exchanges - for in-store item exchanges
export const storeExchanges = pgTable("store_exchanges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .references(() => stores.id)
    .notNull(),
  originalSaleId: varchar("original_sale_id")
    .references(() => storeSales.id)
    .notNull(),
  processedBy: varchar("processed_by")
    .references(() => users.id)
    .notNull(),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  reason: text("reason"),
  notes: text("notes"),
  returnAmount: decimal("return_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  newItemsAmount: decimal("new_items_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  balanceAmount: decimal("balance_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  balanceDirection: enums.balanceDirectionEnum("balance_direction")
    .notNull()
    .default("even"),
  status: enums.storeExchangeStatusEnum("status").notNull().default("completed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Store exchange return items - items being returned in the exchange
export const storeExchangeReturnItems = pgTable("store_exchange_return_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  exchangeId: varchar("exchange_id")
    .references(() => storeExchanges.id)
    .notNull(),
  saleItemId: varchar("sale_item_id")
    .references(() => storeSaleItems.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  returnAmount: decimal("return_amount", { precision: 10, scale: 2 }).notNull(),
});

// Store exchange new items - new items being given in the exchange
export const storeExchangeNewItems = pgTable("store_exchange_new_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  exchangeId: varchar("exchange_id")
    .references(() => storeExchanges.id)
    .notNull(),
  sareeId: varchar("saree_id")
    .references(() => sarees.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineAmount: decimal("line_amount", { precision: 10, scale: 2 }).notNull(),
});

// Contact Us Schema
export const contactMessages = pgTable("contact_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
