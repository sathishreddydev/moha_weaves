import { z } from "zod";
import * as tables from "./tables";
import * as schemas from "./schemas";
import { ReviewWithUser } from "server/storage";

// Basic types
export type User = typeof tables.users.$inferSelect;
export type InsertUser = z.infer<typeof schemas.insertUserSchema>;
export type RefreshToken = typeof tables.refreshTokens.$inferSelect;
export type InsertRefreshToken = z.infer<typeof schemas.insertRefreshTokenSchema>;
export type Category = typeof tables.categories.$inferSelect;
export type InsertCategory = z.infer<typeof schemas.insertCategorySchema>;
export type Subcategory = typeof tables.subcategories.$inferSelect;
export type InsertSubcategory = z.infer<typeof schemas.insertSubcategorySchema>;

export type CategoryWithSubcategories = Category & {
  subcategories?: Subcategory[];
};
export type Color = typeof tables.colors.$inferSelect;
export type InsertColor = z.infer<typeof schemas.insertColorSchema>;
export type Fabric = typeof tables.fabrics.$inferSelect;
export type InsertFabric = z.infer<typeof schemas.insertFabricSchema>;
export type Store = typeof tables.stores.$inferSelect;
export type InsertStore = z.infer<typeof schemas.insertStoreSchema>;
export type Product = typeof tables.products.$inferSelect;
export type InsertProduct = z.infer<typeof schemas.insertProductSchema>;
export type StoreInventory = typeof tables.storeInventory.$inferSelect;
export type InsertStoreInventory = z.infer<typeof schemas.insertStoreInventorySchema>;
export type WishlistItem = typeof tables.wishlist.$inferSelect;
export type InsertWishlistItem = z.infer<typeof schemas.insertWishlistSchema>;
export type CartItem = typeof tables.cart.$inferSelect;
export type InsertCartItem = z.infer<typeof schemas.insertCartSchema>;
export type StoreCartItem = typeof tables.storeCart.$inferSelect;
export type InsertStoreCartItem = z.infer<typeof schemas.insertStoreCartSchema>;
export type Order = typeof tables.orders.$inferSelect;
export type InsertOrder = z.infer<typeof schemas.insertOrderSchema>;
export type OrderItem = typeof tables.orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof schemas.insertOrderItemSchema>;
export type StoreSale = typeof tables.storeSales.$inferSelect;
export type InsertStoreSale = z.infer<typeof schemas.insertStoreSaleSchema>;
export type StoreSaleItem = typeof tables.storeSaleItems.$inferSelect;
export type InsertStoreSaleItem = z.infer<typeof schemas.insertStoreSaleItemSchema>;
export type StockRequest = typeof tables.stockRequests.$inferSelect;
export type InsertStockRequest = z.infer<typeof schemas.insertStockRequestSchema>;
export type UserAddress = typeof tables.userAddresses.$inferSelect;
export type InsertUserAddress = z.infer<typeof schemas.insertUserAddressSchema>;
export type ServiceablePincode = typeof tables.serviceablePincodes.$inferSelect;
export type InsertServiceablePincode = z.infer<
  typeof schemas.insertServiceablePincodeSchema
>;
export type ReturnRequest = typeof tables.returnRequests.$inferSelect;
export type InsertReturnRequest = z.infer<typeof schemas.insertReturnRequestSchema>;
export type ReturnItem = typeof tables.returnItems.$inferSelect;
export type InsertReturnItem = z.infer<typeof schemas.insertReturnItemSchema>;
export type OnlineExchange = typeof tables.onlineExchanges.$inferSelect;
export type InsertOnlineExchange = z.infer<typeof schemas.insertOnlineExchangeSchema>;
export type OnlineExchangeItem = typeof tables.onlineExchangeItems.$inferSelect;
export type InsertOnlineExchangeItem = z.infer<typeof schemas.insertOnlineExchangeItemSchema>;
export type Refund = typeof tables.refunds.$inferSelect;
export type InsertRefund = z.infer<typeof schemas.insertRefundSchema>;
export type ProductReview = typeof tables.productReviews.$inferSelect;
export type InsertProductReview = z.infer<typeof schemas.insertProductReviewSchema>;
export type Coupon = typeof tables.coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof schemas.insertCouponSchema>;
export type CouponUsage = typeof tables.couponUsage.$inferSelect;
export type InsertCouponUsage = z.infer<typeof schemas.insertCouponUsageSchema>;
export type Notification = typeof tables.notifications.$inferSelect;
export type InsertNotification = z.infer<typeof schemas.insertNotificationSchema>;
export type ItemStatusHistory = typeof tables.itemStatusHistory.$inferSelect;
export type InsertItemStatusHistory = z.infer<
  typeof schemas.insertItemStatusHistorySchema
>;
export type AppSetting = typeof tables.appSettings.$inferSelect;
export type InsertAppSetting = z.infer<typeof schemas.insertAppSettingSchema>;
export type StockMovement = typeof tables.stockMovements.$inferSelect;
export type InsertStockMovement = z.infer<typeof schemas.insertStockMovementSchema>;
export type StockTransfer = typeof tables.stockTransfers.$inferSelect;
export type InsertStockTransfer = z.infer<typeof schemas.insertStockTransferSchema>;
export type InventoryAdjustment = typeof tables.inventoryAdjustments.$inferSelect;
export type InsertInventoryAdjustment = z.infer<
  typeof schemas.insertInventoryAdjustmentSchema
>;
export type StoreExchange = typeof tables.storeExchanges.$inferSelect;
export type InsertStoreExchange = z.infer<typeof schemas.insertStoreExchangeSchema>;
export type StoreExchangeReturnItem =
  typeof tables.storeExchangeReturnItems.$inferSelect;
export type InsertStoreExchangeReturnItem = z.infer<
  typeof schemas.insertStoreExchangeReturnItemSchema
>;
export type StoreExchangeNewItem = typeof tables.storeExchangeNewItems.$inferSelect;
export type InsertStoreExchangeNewItem = z.infer<
  typeof schemas.insertStoreExchangeNewItemSchema
>;
export type Sale = typeof tables.sales.$inferSelect;
export type InsertSale = z.infer<typeof schemas.insertSaleSchema>;
export type SaleProduct = typeof tables.saleProducts.$inferSelect;
export type InsertSaleProduct = z.infer<typeof schemas.insertSaleProductSchema>;
export type ContactMessage = typeof tables.contactMessages.$inferSelect;
export type InsertContactMessage = typeof tables.contactMessages.$inferInsert;
export type ProductDamage = typeof tables.productDamages.$inferSelect;
export type InsertProductDamage = typeof tables.productDamages.$inferInsert;

// Extended types for frontend use
export type OnlineExchangeWithDetails = OnlineExchange & {
  order: any;
  user: any;
  items: (Omit<OnlineExchangeItem, 'id'> & {
    orderItem: {
      orderId: string;
      product: any;
    };
  })[];
};

export type ProductWithDetails = Product & {
  category?: Category | null;
  subcategory?: Subcategory | null;
  color?: Color | null;
  fabric?: Fabric | null;
  images?: string[] | null;
  videoUrl?: string | null;
  actualPrice?: string | null;
  storeAllocations?: {
    storeId: string;
    storeName: string;
    quantity: number;
  }[];
  variants?: {
    id: string;
    sku: string | null;
    size: string;
    stockQuantity: number;
    onlineStock: number;
    price?: string | null;
    actualPrice?: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    storeAllocations?: {
      storeId: string;
      storeName: string;
      quantity: number;
    }[];
  }[];
  unallocated?: number;
  activeSale?: {
    id: string;
    name: string;
    offerType: string;
    discountValue: string;
    maxDiscount?: string;
    bgColor?: string;
  } | null;
  discountedPrice?: number;
};

export type CartItemWithProduct = CartItem & {
  product: ProductWithDetails;
};

export type WishlistItemWithProduct = WishlistItem & {
  product: ProductWithDetails;
};
export type ShippingAddress = {
  name?: string;
  address?: string;
  locality?: string;
  city?: string;
  pincode?: string;
  phone?: string;
};
export type OrderWithItems = Order & {
  customerName?: string;
  paymentId?: string;
  paymentDetails?: {
    available: boolean;
    method?: string;
    display: string;
    subtype?: string;
    razorpayPaymentId?: string;
  };
  couponCode?: string | null;
  couponType?: string | null;
  couponValue?: string | null;
  shippingAddress?: string | ShippingAddress;
  items: (OrderItem & {
    product: ProductWithDetails;
    currentStatus?: string;
    returnEligibility?: { itemId: string; eligible: boolean; reason?: string; remainingDays?: number };
    productPrice?: string | null;
    discountedPrice?: string | null;
    offerDetails?: any | null;
  })[];
};

export type StockRequestWithDetails = StockRequest & {
  product: ProductWithDetails;
  store: Store;
};

export type StoreSaleWithItems = StoreSale & {
  items: (StoreSaleItem & { product: ProductWithDetails })[];
  store: Store;
  eligibilityData?: {
    eligible: boolean;
    eligibleUntil?: Date;
    daysRemaining?: number;
    reason?: string;
    items?: Array<{
      itemId: string;
      eligible: boolean;
      reason?: string;
      availableQuantity: number;
    }>;
  };
};

export type ProductWithReviews = ProductWithDetails & {
  reviews?: ReviewWithUser[];
  averageRating?: number;
  reviewCount?: number;
};

export type ReturnRequestWithDetails = ReturnRequest & {
  order: OrderWithItems;
  user: User;
  items: (ReturnItem & {
    orderItem: OrderItem & { product: ProductWithDetails };
  })[];
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

export type StockTransferWithDetails = StockTransfer & {
  product: ProductWithDetails;
  fromStore?: Store;
  toStore: Store;
};

export type InventoryAdjustmentWithDetails = InventoryAdjustment & {
  product: ProductWithDetails;
  store?: Store;
};

export type StoreExchangeWithDetails = StoreExchange & {
  store: Store;
  originalSale: StoreSaleWithItems | null;
  processor: User | null;
  returnItems: (StoreExchangeReturnItem & { product: ProductWithDetails })[];
  newItems: (StoreExchangeNewItem & { product: ProductWithDetails })[];
};

export type SaleWithDetails = Sale & {
  category?: Category | null;
  subcategory?: Subcategory | null;
  products?: (SaleProduct & { product: ProductWithDetails })[];
  productCount?: number;
};

export type SaleWithProducts = Sale & {
  products: SaleProduct[];
};
