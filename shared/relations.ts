import { relations } from "drizzle-orm";
import * as tables from "./tables";

// User relations
export const usersRelations = relations(tables.users, ({ one, many }) => ({
  store: one(tables.stores, { fields: [tables.users.storeId], references: [tables.stores.id] }),
  wishlistItems: many(tables.wishlist),
  cartItems: many(tables.cart),
  orders: many(tables.orders),
  storeSales: many(tables.storeSales),
  stockRequests: many(tables.stockRequests),
  addresses: many(tables.userAddresses),
  returnRequests: many(tables.returnRequests),
  refunds: many(tables.refunds),
  reviews: many(tables.productReviews),
  notifications: many(tables.notifications),
}));

export const userAddressesRelations = relations(tables.userAddresses, ({ one }) => ({
  user: one(tables.users, { fields: [tables.userAddresses.userId], references: [tables.users.id] }),
}));

// Category, Color, Fabric relations
export const categoriesRelations = relations(tables.categories, ({ many }) => ({
  sarees: many(tables.sarees),
}));

export const colorsRelations = relations(tables.colors, ({ many }) => ({
  sarees: many(tables.sarees),
}));

export const fabricsRelations = relations(tables.fabrics, ({ many }) => ({
  sarees: many(tables.sarees),
}));

// Store relations
export const storesRelations = relations(tables.stores, ({ one, many }) => ({
  manager: one(tables.users, { fields: [tables.stores.managerId], references: [tables.users.id] }),
  inventory: many(tables.storeInventory),
  sales: many(tables.storeSales),
  stockRequests: many(tables.stockRequests),
}));

// Saree relations
export const sareesRelations = relations(tables.sarees, ({ one, many }) => ({
  category: one(tables.categories, {
    fields: [tables.sarees.categoryId],
    references: [tables.categories.id],
  }),
  color: one(tables.colors, { fields: [tables.sarees.colorId], references: [tables.colors.id] }),
  fabric: one(tables.fabrics, { fields: [tables.sarees.fabricId], references: [tables.fabrics.id] }),
  wishlistItems: many(tables.wishlist),
  cartItems: many(tables.cart),
  orderItems: many(tables.orderItems),
  storeInventory: many(tables.storeInventory),
  storeSaleItems: many(tables.storeSaleItems),
  stockRequests: many(tables.stockRequests),
  reviews: many(tables.productReviews),
}));

// Store inventory relations
export const storeInventoryRelations = relations(tables.storeInventory, ({ one }) => ({
  store: one(tables.stores, {
    fields: [tables.storeInventory.storeId],
    references: [tables.stores.id],
  }),
  saree: one(tables.sarees, {
    fields: [tables.storeInventory.sareeId],
    references: [tables.sarees.id],
  }),
}));

// Cart and wishlist relations
export const wishlistRelations = relations(tables.wishlist, ({ one }) => ({
  user: one(tables.users, { fields: [tables.wishlist.userId], references: [tables.users.id] }),
  saree: one(tables.sarees, { fields: [tables.wishlist.sareeId], references: [tables.sarees.id] }),
}));

export const cartRelations = relations(tables.cart, ({ one }) => ({
  user: one(tables.users, { fields: [tables.cart.userId], references: [tables.users.id] }),
  saree: one(tables.sarees, { fields: [tables.cart.sareeId], references: [tables.sarees.id] }),
}));

export const storeCartRelations = relations(tables.storeCart, ({ one }) => ({
  store: one(tables.stores, { fields: [tables.storeCart.storeId], references: [tables.stores.id] }),
  saree: one(tables.sarees, { fields: [tables.storeCart.sareeId], references: [tables.sarees.id] }),
}));

// Order relations
export const ordersRelations = relations(tables.orders, ({ one, many }) => ({
  user: one(tables.users, { fields: [tables.orders.userId], references: [tables.users.id] }),
  items: many(tables.orderItems),
  returnRequests: many(tables.returnRequests),
  refunds: many(tables.refunds),
  reviews: many(tables.productReviews),
  coupon: one(tables.coupons, { fields: [tables.orders.couponId], references: [tables.coupons.id] }),
}));

export const orderItemsRelations = relations(tables.orderItems, ({ one, many }) => ({
  order: one(tables.orders, { fields: [tables.orderItems.orderId], references: [tables.orders.id] }),
  saree: one(tables.sarees, { fields: [tables.orderItems.sareeId], references: [tables.sarees.id] }),
  statusHistory: many(tables.itemStatusHistory),
}));

// Store sales relations
export const storeSalesRelations = relations(tables.storeSales, ({ one, many }) => ({
  store: one(tables.stores, { fields: [tables.storeSales.storeId], references: [tables.stores.id] }),
  seller: one(tables.users, { fields: [tables.storeSales.soldBy], references: [tables.users.id] }),
  items: many(tables.storeSaleItems),
}));

export const storeSaleItemsRelations = relations(tables.storeSaleItems, ({ one }) => ({
  sale: one(tables.storeSales, {
    fields: [tables.storeSaleItems.saleId],
    references: [tables.storeSales.id],
  }),
  saree: one(tables.sarees, {
    fields: [tables.storeSaleItems.sareeId],
    references: [tables.sarees.id],
  }),
}));

// Stock requests relations
export const stockRequestsRelations = relations(tables.stockRequests, ({ one }) => ({
  store: one(tables.stores, {
    fields: [tables.stockRequests.storeId],
    references: [tables.stores.id],
  }),
  requester: one(tables.users, {
    fields: [tables.stockRequests.requestedBy],
    references: [tables.users.id],
  }),
  saree: one(tables.sarees, {
    fields: [tables.stockRequests.sareeId],
    references: [tables.sarees.id],
  }),
}));

// Return and exchange relations
export const returnRequestsRelations = relations(
  tables.returnRequests,
  ({ one, many }) => ({
    order: one(tables.orders, {
      fields: [tables.returnRequests.orderId],
      references: [tables.orders.id],
    }),
    user: one(tables.users, {
      fields: [tables.returnRequests.userId],
      references: [tables.users.id],
    }),
    items: many(tables.returnItems),
    refund: many(tables.refunds),
  })
);

export const returnItemsRelations = relations(tables.returnItems, ({ one }) => ({
  returnRequest: one(tables.returnRequests, {
    fields: [tables.returnItems.returnRequestId],
    references: [tables.returnRequests.id],
  }),
  orderItem: one(tables.orderItems, {
    fields: [tables.returnItems.orderItemId],
    references: [tables.orderItems.id],
  }),
}));

export const onlineExchangesRelations = relations(tables.onlineExchanges, ({ one, many }) => ({
  order: one(tables.orders, {
    fields: [tables.onlineExchanges.orderId],
    references: [tables.orders.id],
  }),
  user: one(tables.users, {
    fields: [tables.onlineExchanges.userId],
    references: [tables.users.id],
  }),
  processor: one(tables.users, {
    fields: [tables.onlineExchanges.processedBy],
    references: [tables.users.id],
  }),
  items: many(tables.onlineExchangeItems),
}));

export const onlineExchangeItemsRelations = relations(tables.onlineExchangeItems, ({ one }) => ({
  exchange: one(tables.onlineExchanges, {
    fields: [tables.onlineExchangeItems.exchangeId],
    references: [tables.onlineExchanges.id],
  }),
  orderItem: one(tables.orderItems, {
    fields: [tables.onlineExchangeItems.orderItemId],
    references: [tables.orderItems.id],
  }),
  exchangeSaree: one(tables.sarees, {
    fields: [tables.onlineExchangeItems.exchangeSareeId],
    references: [tables.sarees.id],
  }),
}));

// Refund relations
export const refundsRelations = relations(tables.refunds, ({ one }) => ({
  returnRequest: one(tables.returnRequests, {
    fields: [tables.refunds.returnRequestId],
    references: [tables.returnRequests.id],
  }),
  order: one(tables.orders, { fields: [tables.refunds.orderId], references: [tables.orders.id] }),
  user: one(tables.users, { fields: [tables.refunds.userId], references: [tables.users.id] }),
}));

// Product reviews relations
export const productReviewsRelations = relations(tables.productReviews, ({ one }) => ({
  saree: one(tables.sarees, {
    fields: [tables.productReviews.sareeId],
    references: [tables.sarees.id],
  }),
  user: one(tables.users, { fields: [tables.productReviews.userId], references: [tables.users.id] }),
  order: one(tables.orders, {
    fields: [tables.productReviews.orderId],
    references: [tables.orders.id],
  }),
}));

// Coupon and sales relations
export const couponsRelations = relations(tables.coupons, ({ many }) => ({
  usage: many(tables.couponUsage),
  orders: many(tables.orders),
}));

export const salesRelations = relations(tables.sales, ({ one, many }) => ({
  category: one(tables.categories, {
    fields: [tables.sales.categoryId],
    references: [tables.categories.id],
  }),
  products: many(tables.saleProducts),
}));

export const saleProductsRelations = relations(tables.saleProducts, ({ one }) => ({
  sale: one(tables.sales, { fields: [tables.saleProducts.saleId], references: [tables.sales.id] }),
  saree: one(tables.sarees, {
    fields: [tables.saleProducts.sareeId],
    references: [tables.sarees.id],
  }),
}));

export const couponUsageRelations = relations(tables.couponUsage, ({ one }) => ({
  coupon: one(tables.coupons, {
    fields: [tables.couponUsage.couponId],
    references: [tables.coupons.id],
  }),
  user: one(tables.users, { fields: [tables.couponUsage.userId], references: [tables.users.id] }),
  order: one(tables.orders, {
    fields: [tables.couponUsage.orderId],
    references: [tables.orders.id],
  }),
}));

// Notification relations
export const notificationsRelations = relations(tables.notifications, ({ one }) => ({
  user: one(tables.users, { fields: [tables.notifications.userId], references: [tables.users.id] }),
}));

// Status history relations
export const itemStatusHistoryRelations = relations(tables.itemStatusHistory, ({ one }) => ({
  orderItem: one(tables.orderItems, {
    fields: [tables.itemStatusHistory.orderItemId],
    references: [tables.orderItems.id],
  }),
}));

// Stock management relations
export const stockMovementsRelations = relations(tables.stockMovements, ({ one }) => ({
  saree: one(tables.sarees, {
    fields: [tables.stockMovements.sareeId],
    references: [tables.sarees.id],
  }),
  store: one(tables.stores, {
    fields: [tables.stockMovements.storeId],
    references: [tables.stores.id],
  }),
}));

export const stockTransfersRelations = relations(tables.stockTransfers, ({ one }) => ({
  saree: one(tables.sarees, {
    fields: [tables.stockTransfers.sareeId],
    references: [tables.sarees.id],
  }),
  fromStore: one(tables.stores, {
    fields: [tables.stockTransfers.fromStoreId],
    references: [tables.stores.id],
  }),
  toStore: one(tables.stores, {
    fields: [tables.stockTransfers.toStoreId],
    references: [tables.stores.id],
  }),
  requester: one(tables.users, {
    fields: [tables.stockTransfers.requestedBy],
    references: [tables.users.id],
  }),
}));

export const inventoryAdjustmentsRelations = relations(
  tables.inventoryAdjustments,
  ({ one }) => ({
    saree: one(tables.sarees, {
      fields: [tables.inventoryAdjustments.sareeId],
      references: [tables.sarees.id],
    }),
    store: one(tables.stores, {
      fields: [tables.inventoryAdjustments.storeId],
      references: [tables.stores.id],
    }),
    adjuster: one(tables.users, {
      fields: [tables.inventoryAdjustments.adjustedBy],
      references: [tables.users.id],
    }),
  })
);

// Store exchange relations
export const storeExchangesRelations = relations(
  tables.storeExchanges,
  ({ one, many }) => ({
    store: one(tables.stores, {
      fields: [tables.storeExchanges.storeId],
      references: [tables.stores.id],
    }),
    originalSale: one(tables.storeSales, {
      fields: [tables.storeExchanges.originalSaleId],
      references: [tables.storeSales.id],
    }),
    processor: one(tables.users, {
      fields: [tables.storeExchanges.processedBy],
      references: [tables.users.id],
    }),
    returnItems: many(tables.storeExchangeReturnItems),
    newItems: many(tables.storeExchangeNewItems),
  })
);

export const storeExchangeReturnItemsRelations = relations(
  tables.storeExchangeReturnItems,
  ({ one }) => ({
    exchange: one(tables.storeExchanges, {
      fields: [tables.storeExchangeReturnItems.exchangeId],
      references: [tables.storeExchanges.id],
    }),
    saleItem: one(tables.storeSaleItems, {
      fields: [tables.storeExchangeReturnItems.saleItemId],
      references: [tables.storeSaleItems.id],
    }),
    saree: one(tables.sarees, {
      fields: [tables.storeExchangeReturnItems.sareeId],
      references: [tables.sarees.id],
    }),
  })
);

export const storeExchangeNewItemsRelations = relations(
  tables.storeExchangeNewItems,
  ({ one }) => ({
    exchange: one(tables.storeExchanges, {
      fields: [tables.storeExchangeNewItems.exchangeId],
      references: [tables.storeExchanges.id],
    }),
    saree: one(tables.sarees, {
      fields: [tables.storeExchangeNewItems.sareeId],
      references: [tables.sarees.id],
    }),
  })
);
