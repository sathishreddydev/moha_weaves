import type { ProductWithDetails, StockRequestWithDetails, StoreExchangeWithDetails, StoreSaleWithItems } from "@shared/schema";
import { RequestStatus, ExchangeStatus, BalanceDirection } from "./enums";

// Cart related types
export interface Discount {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  type: "percentage" | "fixed" | "coupon";
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  categoryId: string | null;
  createdAt: string;
}

export interface ExistingCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  product?: ProductWithDetails;
}

// Shop product with sale info
export type ShopProduct = ProductWithDetails & {
  activeSale?: {
    id: string;
    name: string;
    offerType: string;
    discountValue: string;
    maxDiscount?: string;
  } | null;
  discountedPrice?: number;
};

// Dashboard stats
export interface StoreStats {
  todaySales: number;
  todayRevenue: number;
  totalInventory: number;
  pendingRequests: number;
  totalSales?: number;
  totalRevenue?: number;
  weeklySalesGrowth?: number;
  monthlyRevenueGrowth?: number;
  topSellingProducts?: Array<{
    product: ProductWithDetails;
    quantity: number;
    revenue: number;
  }>;
  lowStockProducts?: Array<{
    product: ProductWithDetails;
    currentStock: number;
    reorderLevel: number;
  }>;
  recentSales?: StoreSaleWithItems[];
  recentRequests?: StockRequestWithDetails[];
  recentExchanges?: StoreExchangeWithDetails[];
  requestStats?: {
    pending: number;
    approved: number;
    dispatched: number;
    received: number;
  };
}

// Request dialog
export interface RequestDialogProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  productData: ProductWithDetails | undefined;
}

// Invoice types
export interface InvoiceData {
  type: "normal" | "exchange";
  orderId: string;
  items?: any[];
  exchangeHistory?: any[];
  discountAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  customer?: {
    name: string;
    email: string;
    phone: string;
    address?: string;
  };
  store?: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  createdAt: string;
}

// Exchange item
export interface ExchangeItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  reason: string;
  exchangeType: "damage" | "normal";
  specificReason: string;
  product?: ProductWithDetails;
}

// Return item for exchange
export interface ReturnItem {
  saleItemId: string;
  productId: string;
  variantId?: string;
  product: ProductWithDetails;
  quantity: number;
  maxQuantity: number;
  unitPrice: string;
  returnAmount: string;
  exchangeType: string;
  specificReason: string;
  damageImages: string[];
}

// New cart item for exchange
export interface NewCartItem {
  productId: string;
  variantId?: string;
  product: ProductWithDetails;
  quantity: number;
  maxQuantity: number;
  unitPrice: string;
  lineAmount: string;
}

// Sale item with available stock
export interface SaleItemWithAvailable {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  returnedQuantity: number;
  price: string;
  availableQuantity: number;
  product: ProductWithDetails & {
    activeSale?: {
      id: string;
      name: string;
      offerType: string;
      discountValue: string;
      maxDiscount?: string;
    } | null;
    discountedPrice?: number;
    availableStock?: number;
  };
}

// Status config type
export interface StatusConfig {
  icon: any;
  label: string;
  color: string;
}

// Form types
export interface RequestFormData {
  quantity: string;
  reason: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

// Filter types
export interface StoreFilterItem {
  id: string;
  label: string;
  value: string;
  type: "category" | "brand" | "size" | "color" | "price";
}

// Tree node for inventory
export interface StoreTreeNode {
  id: string;
  name: string;
  type: "category" | "subcategory" | "product";
  children?: StoreTreeNode[];
  data?: any;
}

// Exchange history item
export interface ExchangeHistoryItem {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: ExchangeItem[];
  totalAmount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  createdAt: string;
  updatedAt: string;
}

// Sale item
export interface SaleItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  discount?: number;
  product?: ProductWithDetails;
}

// Store sale with items
export interface StoreSale {
  id: string;
  items: SaleItem[];
  store: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  eligibilityData?: any;
  totalAmount: number;
  discountAmount?: number;
  taxAmount?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentMethod?: string;
  saleId?: string;
}

// Stock request with details
export interface StoreStockRequest {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  storeId: string;
  productId: string;
  quantity: number;
  requestedBy: string;
  status: RequestStatus;
  approvedBy: string | null;
  notes: string | null;
  product?: ProductWithDetails;
}

// Store exchange with details
export interface StoreExchange {
  id: string;
  createdAt: Date;
  storeId: string;
  customerName: string | null;
  customerPhone: string | null;
  status: ExchangeStatus;
  notes: string | null;
  items: ExchangeItem[];
  totalAmount: number;
  balanceAmount: number;
  balanceDirection: BalanceDirection;
  exchangeDate: Date;
}
