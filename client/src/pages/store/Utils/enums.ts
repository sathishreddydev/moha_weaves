// Discount types
export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED = "fixed",
  COUPON = "coupon"
}

// Request status
export enum RequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  DISPATCHED = "dispatched",
  RECEIVED = "received",
  COMPLETED = "completed"
}

// Exchange status
export enum ExchangeStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}

// Exchange type
export enum ExchangeType {
  DAMAGE = "damage",
  NORMAL = "normal"
}

// Invoice type
export enum InvoiceType {
  NORMAL = "normal",
  EXCHANGE = "exchange"
}

// Filter types
export enum FilterType {
  CATEGORY = "category",
  BRAND = "brand",
  SIZE = "size",
  COLOR = "color",
  PRICE = "price"
}

// Tree node types
export enum TreeNodeType {
  CATEGORY = "category",
  SUBCATEGORY = "subcategory",
  PRODUCT = "product"
}

// Sale offer types
export enum SaleOfferType {
  PERCENTAGE = "percentage",
  FIXED = "fixed",
  BOGO = "bogo"
}

// Stock balance direction
export enum BalanceDirection {
  REFUND_TO_CUSTOMER = "refund_to_customer",
  CUSTOMER_PAYS = "customer_pays",
  EVEN = "even"
}

// Payment methods
export enum PaymentMethod {
  CASH = "cash",
  CARD = "card",
  UPI = "upi",
  BANK_TRANSFER = "bank_transfer"
}

// Order status
export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  RETURNED = "returned"
}

// Product status
export enum ProductStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  OUT_OF_STOCK = "out_of_stock",
  DISCONTINUED = "discontinued"
}

// Store roles
export enum StoreRole {
  ADMIN = "admin",
  MANAGER = "manager",
  STAFF = "staff"
}

// Priority levels
export enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent"
}
