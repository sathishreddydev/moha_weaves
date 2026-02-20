// Stock Status enum
export enum StockStatus {
  IN_STOCK = "in-stock",
  LOW_STOCK = "low-stock", 
  OUT_OF_STOCK = "out-of-stock"
}

// Featured Status enum
export enum FeaturedStatus {
  FEATURED = "true",
  NOT_FEATURED = "false"
}

// Sort Options enum
export enum SortOption {
  STOCK_ASC = "stock-asc",
  STOCK_DESC = "stock-desc", 
  NAME_ASC = "name",
  CREATED_DESC = "created-desc"
}

// Return Status enum
export enum ReturnStatus {
  RETURN_REQUESTED = "return_requested",
  RETURN_APPROVED = "return_approved",
  RETURN_IN_TRANSIT = "return_in_transit",
  RETURN_RECEIVED = "return_received",
  RETURN_INSPECTED = "return_inspected",
  RETURN_COMPLETED = "return_completed",
  RETURN_REJECTED = "return_rejected",
  RETURN_CANCELLED = "return_cancelled"
}

// Filter Keys enum
export enum FilterKey {
  CATEGORY_IDS = "categoryIds",
  COLOR_IDS = "colorIds",
  FABRIC_IDS = "fabricIds",
  STOCK_STATUS = "stockStatus",
  FEATURED = "featured",
  SORT = "sort"
}

// Tree Node Type enum
export enum TreeNodeType {
  CATEGORY = "category",
  SUBCATEGORY = "subcategory", 
  PRODUCT = "product"
}

// Distribution Channel enum (based on product.distributionChannel usage)
export enum DistributionChannel {
  ONLINE = "online",
  SHOP = "shop", 
  BOTH = "both",
  STORE = "store"
}

// Damage Source enum
export enum DamageSource {
  STORE = "store",
  WAREHOUSE = "warehouse",
  ONLINE_RETURN = "online_return",
  SHIPPING = "shipping",
  MANUFACTURING = "manufacturing"
}

// Damage Category enum
export enum DamageCategory {
  MANUFACTURING_DEFECT = "manufacturing_defect",
  SHIPPING_DAMAGE = "shipping_damage",
  STORAGE_DAMAGE = "storage_damage",
  HANDLING_DAMAGE = "handling_damage",
  CUSTOMER_DAMAGE = "customer_damage",
  EXPIRED = "expired",
  THEFT_LOSS = "theft_loss",
  OTHER = "other"
}

// Damage Severity enum
export enum DamageSeverity {
  MINOR = "minor",
  MAJOR = "major",
  TOTAL_LOSS = "total_loss"
}

// Allocation Type enum
export enum AllocationType {
  ONLINE = "online",
  STORE = "store",
  BOTH = "both"
}

// ABC Analysis Class enum
export enum ABCClass {
  A = "A",
  B = "B", 
  C = "C"
}

// Trend Type enum
export enum TrendType {
  INCREASING = "increasing",
  DECREASING = "decreasing",
  STABLE = "stable",
  SEASONAL = "seasonal"
}

// Analytics Tab enum
export enum AnalyticsTab {
  OVERVIEW = "overview",
  TURNOVER = "turnover",
  ABC = "abc",
  SEASONAL = "seasonal"
}

// User Role enum
export enum UserRole {
  INVENTORY = "inventory",
  ADMIN = "admin"
}

// Turnover Health enum
export enum TurnoverHealth {
  EXCELLENT = "Excellent",
  GOOD = "Good",
  AVERAGE = "Average",
  POOR = "Poor"
}

// Severity Colors mapping
export const SeverityColors: Record<DamageSeverity, string> = {
  [DamageSeverity.MINOR]: "bg-blue-100 text-blue-800",
  [DamageSeverity.MAJOR]: "bg-orange-100 text-orange-800",
  [DamageSeverity.TOTAL_LOSS]: "bg-red-100 text-red-800",
};

// Exchange Status enum
export enum ExchangeStatus {
  EXCHANGE_REQUESTED = "exchange_requested",
  EXCHANGE_APPROVED = "exchange_approved",
  EXCHANGE_CANCELLED = "exchange_cancelled",
  EXCHANGE_PROCESSING = "exchange_processing",
  EXCHANGE_PICKUP_SCHEDULED = "exchange_pickup_scheduled",
  EXCHANGE_PICKED_UP = "exchange_picked_up",
  EXCHANGE_IN_TRANSIT = "exchange_in_transit",
  EXCHANGE_RECEIVED = "exchange_received",
  EXCHANGE_INSPECTED = "exchange_inspected",
  EXCHANGE_SHIPPED = "exchange_shipped",
  EXCHANGE_DELIVERED = "exchange_delivered",
  EXCHANGE_COMPLETED = "exchange_completed"
}