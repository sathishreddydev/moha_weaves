import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "admin",
  "inventory",
  "store",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "created",
  "processing",
  "completed",
  "cancelled",
]);

export const itemStatusEnum = pgEnum("item_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  'return_requested',
  'exchange_requested',
  "cancelled",
]);

export const returnStatusEnum = pgEnum("return_status", [
  "return_requested",
  "return_approved",
  "return_rejected",
  "return_pickup_scheduled",
  "return_picked_up",
  "return_in_transit",
  "return_received",
  "return_inspected",
  "return_completed",
  "return_cancelled",
]);

export const onlineExchangeStatusEnum = pgEnum("online_exchange_status", [
  "exchange_requested",
  "exchange_approved",
  "exchange_processing",
  "exchange_pickup_scheduled",
  "exchange_picked_up",
  "exchange_in_transit",
  "exchange_received",
  "exchange_inspected",
  "exchange_shipped",
  "exchange_delivered",
  "exchange_completed",
  "exchange_cancelled",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "initiated",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "razorpay",
]);

// Store and distribution enums
export const distributionChannelEnum = pgEnum("distribution_channel", [
  "shop",
  "online",
  "both",
]);

export const storeSaleTypeEnum = pgEnum("store_sale_type", [
  "walk_in",
  "reserved",
]);

// Request and status enums
export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "dispatched",
  "received",
  "rejected",
]);

export const requestPriorityEnum = pgEnum("request_priority", [
  "urgent",
  "high",
  "normal",
  "low",
]);

// Return and exchange enums
export const returnReasonEnum = pgEnum("return_reason", [
  "defective",
  "wrong_item",
  "not_as_described",
  "size_issue",
  "color_mismatch",
  "damaged_in_shipping",
  "changed_mind",
  "quality_issue",
  "other",
]);

export const returnResolutionEnum = pgEnum("return_resolution", [
  "refund",
  "exchange",
  "store_credit",
]);

// Coupon and offer enums
export const couponTypeEnum = pgEnum("coupon_type", [
  "percentage",
  "fixed",
  "free_shipping",
]);

export const offerTypeEnum = pgEnum("offer_type", [
  "percentage",
  "flat",
  "category",
  "product",
  "flash_sale",
]);

// Notification enums
export const notificationTypeEnum = pgEnum("notification_type", [
  "order",
  "return",
  "refund",
  "promotion",
  "system",
]);

// Stock management enums
export const stockMovementSourceEnum = pgEnum("stock_movement_source", [
  "online",
  "store",
]);

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "sale",
  "return",
  "restock",
  "transfer",
  "adjustment",
  "exchange",
]);

export const transferStatusEnum = pgEnum("transfer_status", [
  "pending",
  "approved",
  "in_transit",
  "received",
  "rejected",
  "cancelled",
]);

// Store exchange enums
export const storeExchangeStatusEnum = pgEnum("store_exchange_status", [
  "pending",
  "completed",
  "cancelled",
]);

export const balanceDirectionEnum = pgEnum("balance_direction", [
  "refund_to_customer",
  "due_from_customer",
  "even",
]);

// Damage tracking enums
export const damageCategoryEnum = pgEnum("damage_category", [
  "manufacturing_defect",
  "shipping_damage",
  "storage_damage",
  "handling_damage",
  "customer_damage",
  "expired",
  "theft_loss",
  "other",
]);

export const damageSeverityEnum = pgEnum("damage_severity", [
  "minor",
  "major",
  "total_loss",
]);

export const damageSourceEnum = pgEnum("damage_source", [
  "store",           // In-store damage
  "online_return",   // Customer return damage
  "warehouse",       // Warehouse damage
  "shipping",        // Shipping damage
  "manufacturing",   // Manufacturing defect
]);
