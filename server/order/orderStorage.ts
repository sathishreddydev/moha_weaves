import {
  InsertOrder,
  InsertOrderItem,
  itemStatusHistory,
  Order,
  orderItems,
  orders,
  OrderWithItems,
  products,
  stockMovements,
  users
} from "@shared/schema";
import { desc, eq, sql, and, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { roleBasedProductService } from "server/product/roleBasedProductService";
import { returnStorage } from "server/return/returnStorage";
import { storage } from "server/storage";
import { IdGenerator } from "server/utils/idGenerator";
import { paymentInfo } from "./createOrderService";

function createOrderHistoryProduct(product: any) {
  if (!product) {
    return {
      id: '',
      name: 'Unknown Product',
      imageUrl: null,
      category: null,
      color: null,
      variants: [],
    };
  }

  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    category: product.category ? {
      id: product.category.id,
      name: product.category.name,
    } : null,
    color: product.color ? {
      id: product.color.id,
      name: product.color.name,
    } : null,
    variants: product.variants?.map((variant: any) => ({
      id: variant.id,
      size: variant.size,
    })) || [],
  };
}

function buildOrderSelectQuery(dbQuery: any, additionalFields = {}) {
  return dbQuery.select({
    id: orders.id,
    userId: orders.userId,
    totalAmount: orders.totalAmount,
    discountAmount: orders.discountAmount,
    finalAmount: orders.finalAmount,
    status: orders.status,
    paymentStatus: orders.paymentStatus,
    paymentMethod: orders.paymentMethod,
    razorpayPaymentId: orders.razorpayPaymentId,
    shippingAddress: orders.shippingAddress,
    phone: orders.phone,
    email: orders.email,
    trackingNumber: orders.trackingNumber,
    estimatedDelivery: orders.estimatedDelivery,
    deliveredAt: orders.deliveredAt,
    couponId: orders.couponId,
    couponCode: orders.couponCode,
    couponType: orders.couponType,
    couponValue: orders.couponValue,
    notes: orders.notes,
    returnEligibleUntil: orders.returnEligibleUntil,
    shippingMethod: orders.shippingMethod,
    delhiveryWaybill: orders.delhiveryWaybill,
    delhiveryOrderId: orders.delhiveryOrderId,
    delhiveryStatus: orders.delhiveryStatus,
    shipmentType: orders.shipmentType,
    totalShipments: orders.totalShipments,
    completedShipments: orders.completedShipments,
    autoProcessed: orders.autoProcessed,
    addressValidated: orders.addressValidated,
    customerNotified: orders.customerNotified,
    pickupScheduled: orders.pickupScheduled,
    autoShippingAttempts: orders.autoShippingAttempts,
    lastAutoShippingAttempt: orders.lastAutoShippingAttempt,
    createdAt: orders.createdAt,
    updatedAt: orders.updatedAt,
    ...additionalFields
  });
}

// Reusable query builder for order items selects
function buildOrderItemsSelectQuery(dbQuery: any, additionalFields = {}) {
  return dbQuery.select({
    id: orderItems.id,
    orderId: orderItems.orderId,
    productId: orderItems.productId,
    variantId: orderItems.variantId,
    quantity: orderItems.quantity,
    price: orderItems.price,
    productPrice: orderItems.productPrice,
    discountedPrice: orderItems.discountedPrice,
    offerDetails: orderItems.offerDetails,
    status: orderItems.status,
    trackingNumber: orderItems.trackingNumber,
    shippedAt: orderItems.shippedAt,
    deliveredAt: orderItems.deliveredAt,
    returnEligibleUntil: orderItems.returnEligibleUntil,
    shipmentId: orderItems.shipmentId,
    delhiveryWaybill: orderItems.delhiveryWaybill,
    delhiveryPackageId: orderItems.delhiveryPackageId,
    weight: orderItems.weight,
    dimensions: orderItems.dimensions,
    createdAt: orderItems.createdAt,
    updatedAt: orderItems.updatedAt,
    ...additionalFields
  });
}

// Extract item status lookup logic
async function getItemStatuses(orderItemsData: any[]) {
  return Promise.all(
    orderItemsData.map(async (item) => {
      const [latestStatus] = await db
        .select({ newStatus: itemStatusHistory.newStatus })
        .from(itemStatusHistory)
        .where(eq(itemStatusHistory.orderItemId, item.id))
        .orderBy(desc(itemStatusHistory.createdAt))
        .limit(1);

      return {
        orderItemId: item.id,
        currentStatus: latestStatus?.newStatus ?? item.status,
      };
    })
  );
}

// Reusable item mapping function
function mapOrderItems(
  orderItemsData: any[],
  itemStatuses: any[],
  productMap: Map<string, any>,
  eligibilityMap?: any[]
) {
  return orderItemsData.map((item) => {
    const statusObj = itemStatuses.find((s) => s.orderItemId === item.id);
    const eligibility = eligibilityMap?.find(e => e.itemId === item.id);
    const product = productMap.get(item.productId);

    return {
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price: item.price,
      productPrice: item.productPrice ? item.productPrice.toString() : null,
      discountedPrice: item.discountedPrice ? item.discountedPrice.toString() : null,
      offerDetails: item.offerDetails as any,
      status: item.status,
      trackingNumber: item.trackingNumber,
      shippedAt: item.shippedAt,
      deliveredAt: item.deliveredAt,
      returnEligibleUntil: item.returnEligibleUntil,
      shipmentId: item.shipmentId,
      delhiveryWaybill: item.delhiveryWaybill,
      delhiveryPackageId: item.delhiveryPackageId,
      weight: item.weight,
      dimensions: item.dimensions,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      currentStatus: statusObj?.currentStatus || item.status,
      returnEligibility: eligibility || { itemId: item.id, eligible: false },
      product: createOrderHistoryProduct(product) as any,
    };
  });
}

// Shared helper: parse shippingAddress JSON string if needed
function parseShippingAddress(raw: any): any {
  try {
    return typeof raw === 'string' && raw.startsWith('{')
      ? JSON.parse(raw)
      : raw;
  } catch (e) {
    console.warn('Failed to parse shipping address:', e);
    return raw;
  }
}

// Valid item statuses and allowed transitions
export const VALID_ITEM_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
] as const;

export type ItemStatus = typeof VALID_ITEM_STATUSES[number];

// Defines which statuses a given status can transition to
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:           ["confirmed", "cancelled"],
  confirmed:         ["processing", "cancelled"],
  processing:        ["shipped", "cancelled"],
  shipped:           ["delivered"],
  delivered:         ["return_requested"],
  cancelled:         [],
  return_requested:  ["returned", "delivered"],
  returned:          [],
};

export interface OrderStorage {
  createOrder(
    order: InsertOrder,
    items: Omit<InsertOrderItem, "orderId">[]
  ): Promise<Order>;
  getOrders(userId: string, page?: number, pageSize?: number, userRole?: "user" | "admin" | "inventory" | "store"): Promise<{
    data: OrderWithItems[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  getOrdersPaginated(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    userRole?: "user" | "admin" | "inventory" | "store";
  }): Promise<{
    data: OrderWithItems[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  getOrder(id: string, userRole?: "user" | "admin" | "inventory" | "store"): Promise<OrderWithItems | undefined>;
  getBasicOrder(id: string, userRole?: "user" | "admin" | "inventory" | "store"): Promise<OrderWithItems | undefined>;
  /** Lightweight check: returns the item row if itemId belongs to orderId, otherwise undefined. */
  verifyItemBelongsToOrder(orderId: string, itemId: string): Promise<{ id: string; orderId: string; status: string; userId: string } | undefined>;
  updateItemStatus(
    orderItemId: string,
    status: string,
    updatedBy?: string,
    note?: string,
    userId?: string,
  ): Promise<any | undefined>;
  updateOrderStatus(
    orderId: string,
    status: string,
    updatedBy?: string,
    note?: string
  ): Promise<any | undefined>;
}

export class OrderRepository implements OrderStorage {
  async createOrder(
    order: InsertOrder,
    items: Omit<InsertOrderItem, "orderId">[]
  ): Promise<Order> {
    const orderId = await IdGenerator.generateOrderId();

    const [newOrder] = await db.insert(orders).values({
      ...order,
      id: orderId,
    }).returning();

    // Fix #7: start at 0 and pass directly — no off-by-one confusion
    let itemIndex = 0;
    for (const item of items) {
      const itemId = IdGenerator.generateItemIdFromOrder(orderId, itemIndex);

      // Fix #5: destructure pricing fields so they are saved, not dropped
      const { productPrice, discountedPrice, offerDetails, ...itemData } = item as any;

      const [newOrderItem] = await db.insert(orderItems).values({
        ...itemData,
        id: itemId,
        orderId: newOrder.id,
        status: "confirmed",
        productPrice: productPrice ?? null,
        discountedPrice: discountedPrice ?? null,
        offerDetails: offerDetails ?? null,
      }).returning();

      // Create initial item status history
      await storage.itemHistory(
        newOrderItem.id,
        "confirmed",
        "confirmed",
        "Order placed and confirmed"
      );

      // Deduct from online stock and total stock
      await db
        .update(products)
        .set({
          onlineStock: sql`${products.onlineStock} - ${item.quantity}`,
          totalStock: sql`${products.totalStock} - ${item.quantity}`,
        })
        .where(eq(products.id, item.productId));

      // Record stock movement (negative for deduction)
      await db.insert(stockMovements).values({
        productId: item.productId,
        quantity: -item.quantity,
        movementType: "sale",
        source: "online",
        orderRefId: newOrder.id,
        storeId: null,
      });

      // Check for low stock and create alert
      await storage.checkAndCreateStockAlert(item.productId);

      itemIndex++;
    }

    return newOrder;
  }

  async getOrders(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
    userRole: "user" | "admin" | "inventory" | "store" = "user"
  ): Promise<{
    data: OrderWithItems[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    
    const offset = (page - 1) * pageSize;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.userId, userId));

    // Fix #4: count(*) returns a string from Postgres — coerce to number explicitly
    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    const orderList = await db
      .select()
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    const result: OrderWithItems[] = [];

    for (const order of orderList) {
      const customerName = order.users.name;

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.orders.id));

      const productIds = items.map(item => item.productId);

      const productsData = await roleBasedProductService.getProductsByRole(
        { ids: productIds },
        userRole
      );

      const productMap = new Map(
        productsData.map(product => [product.id, product])
      );

      const eligibilityMap = await returnStorage.checkOrderReturnEligibility(order.orders.id);

      // Fix #2: fetch currentStatus from itemStatusHistory, consistent with getOrder
      const itemStatuses = await getItemStatuses(items);

      // Fix #3: parse shippingAddress JSON string, consistent with getOrderWithDetails
      const parsedShippingAddress = parseShippingAddress(order.orders.shippingAddress);

      result.push({
        ...order.orders,
        shippingAddress: parsedShippingAddress,
        customerName,
        items: items.map((item) => {
          const statusObj = itemStatuses.find((s) => s.orderItemId === item.id);
          const product = productMap.get(item.productId);
          return {
            ...item,
            currentStatus: statusObj?.currentStatus || item.status,
            returnEligibility: eligibilityMap.find(e => e.itemId === item.id) || { itemId: item.id, eligible: false },
            product: createOrderHistoryProduct(product) as any,
            offerDetails: item.offerDetails as any,
          };
        }),
      });
    }

    return { data: result as OrderWithItems[], total, page, pageSize, totalPages };
  }

  async getOrdersPaginated(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    userRole?: "user" | "admin" | "inventory" | "store";
  }): Promise<{
    data: OrderWithItems[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      pageSize = 20,
      status,
      search,
      dateFrom,
      dateTo,
      userRole = "admin",
    } = params;

    const offset = (page - 1) * pageSize;
    const conditions: any[] = [];

    // Filter by item status — find orders that have at least one item with this status
    if (status) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = ${orders.id}
          AND oi.status = ${status}
        )`
      );
    }
    // Search by order ID or customer name
    if (search) {
      conditions.push(
        sql`(${orders.id} ILIKE ${'%' + search + '%'}
          OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = ${orders.userId}
            AND u.name ILIKE ${'%' + search + '%'}
          )
        )`
      );
    }
    if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(orders.createdAt, new Date(dateTo)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    const orderList = await db
      .select()
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    const result: OrderWithItems[] = [];

    for (const order of orderList) {
      const customerName = order.users.name;

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.orders.id));

      const productIds = items.map((item) => item.productId);

      const productsData = await roleBasedProductService.getProductsByRole(
        { ids: productIds },
        userRole,
      );

      const productMap = new Map(productsData.map((p) => [p.id, p]));

      const itemStatuses = await getItemStatuses(items);

      const parsedShippingAddress = parseShippingAddress(order.orders.shippingAddress);

      result.push({
        ...order.orders,
        shippingAddress: parsedShippingAddress,
        customerName,
        items: mapOrderItems(items, itemStatuses, productMap),
      });
    }

    return { data: result, total, page, pageSize, totalPages };
  }

  // Fix #1: pass false so getBasicOrder skips payment info and return eligibility
  async getBasicOrder(id: string, userRole: "user" | "admin" | "inventory" | "store" = "user"): Promise<OrderWithItems | undefined> {
    return await this.getOrderWithDetails(id, false, userRole);
  }

  async getOrder(id: string, userRole: "user" | "admin" | "inventory" | "store" = "user"): Promise<OrderWithItems | undefined> {
    return await this.getOrderWithDetails(id, true, userRole);
  }

  private async getOrderWithDetails(id: string, includeDetails: boolean, userRole: "user" | "admin" | "inventory" | "store" = "user"): Promise<OrderWithItems | undefined> {
    const [order] = await buildOrderSelectQuery(db)
      .from(orders)
      .where(eq(orders.id, id));

    if (!order) return undefined;

    const orderItemsData = await buildOrderItemsSelectQuery(db)
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    if (!orderItemsData.length) {
      return { ...order, items: [] };
    }

    const productIds = orderItemsData.map((item: any) => item.productId);

    const productsData = await roleBasedProductService.getProductsByRole(
      { ids: productIds },
      userRole
    );

    const productMap = new Map(
      productsData.map(product => [product.id, product])
    );

    // Get return eligibility only when full details are requested
    const eligibilityMap = includeDetails
      ? await returnStorage.checkOrderReturnEligibility(order.id)
      : undefined;

    const itemStatuses = await getItemStatuses(orderItemsData);

    // Get payment data only when full details are requested
    const paymentData = includeDetails && order.razorpayPaymentId
      ? await paymentInfo({ razorpayPaymentId: order.razorpayPaymentId })
      : null;

    const parsedShippingAddress = parseShippingAddress(order.shippingAddress);

    return {
      ...order,
      shippingAddress: parsedShippingAddress,
      paymentDetails: paymentData || undefined,
      items: mapOrderItems(orderItemsData, itemStatuses, productMap, eligibilityMap),
    };
  }

  /** Lightweight check — single query, no joins, no product/payment fetching. */
  async verifyItemBelongsToOrder(
    orderId: string,
    itemId: string,
  ): Promise<{ id: string; orderId: string; status: string; userId: string } | undefined> {
    // Join orders so we get userId in the same round-trip — the route needs it
    // for notifications and would otherwise have to make a second query.
    const [row] = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        status: orderItems.status,
        userId: orders.userId,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
      .limit(1);
    return row ?? undefined;
  }

  async updateItemStatus(
    orderItemId: string,
    status: string,
    updatedBy?: string,
    note?: string,
    userId?: string,   // caller passes this so we don't re-fetch the order
  ): Promise<any | undefined> {
    // Validate status value
    if (!(VALID_ITEM_STATUSES as readonly string[]).includes(status)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: "${status}" is not a valid item status. Allowed: ${VALID_ITEM_STATUSES.join(", ")}`
      );
    }

    return await db.transaction(async (tx) => {
      try {
        const [currentItem] = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.id, orderItemId));

        if (!currentItem) return undefined;

        // Validate transition
        const allowed = ALLOWED_TRANSITIONS[currentItem.status] ?? [];
        if (!allowed.includes(status)) {
          throw new Error(
            `INVALID_STATUS_TRANSITION: Cannot move item from "${currentItem.status}" to "${status}". Allowed next statuses: ${allowed.length ? allowed.join(", ") : "none"}`
          );
        }

        const updateData = {
          status: status as any,
          updatedAt: new Date(),
          ...(status === "shipped"   && { shippedAt: new Date() }),
          ...(status === "delivered" && { deliveredAt: new Date() }),
        };

        const [updatedItem] = await tx
          .update(orderItems)
          .set(updateData)
          .where(eq(orderItems.id, orderItemId))
          .returning();

        // Audit history — note is always provided by the caller now
        await storage.itemHistory(
          orderItemId,
          currentItem.status,
          status,
          note ?? `Status updated to ${status}`,
          updatedBy
        );

        // Send per-item notification.
        // userId is passed in by the caller to avoid a redundant SELECT on orders.
        // Fall back to fetching if not provided (e.g. called outside a route context).
        const notifyUserId = userId ?? await (async () => {
          const [ord] = await tx
            .select({ userId: orders.userId })
            .from(orders)
            .where(eq(orders.id, currentItem.orderId));
          return ord?.userId;
        })();

        const notificationMessages: Record<string, string> = {
          confirmed:  "An item in your order has been confirmed and is being processed.",
          processing: "An item in your order is being prepared for shipment.",
          shipped:    "An item in your order has been shipped!",
          delivered:  "An item in your order has been delivered.",
          cancelled:  "An item in your order has been cancelled.",
        };

        const notificationMessage = notificationMessages[status];
        if (notificationMessage && notifyUserId) {
          await storage.createNotification({
            userId: notifyUserId,
            type: "order",
            title: `Item ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: notificationMessage,
            relatedId: currentItem.orderId,
            relatedType: "order",
          });
        }

        return updatedItem;
      } catch (error) {
        console.error("Error in updateItemStatus transaction:", error);
        throw error;
      }
    });
  }

  // Fix #6: accept updatedBy and note to match the interface, record audit history
  async updateOrderStatus(
    orderId: string,
    status: string,
    updatedBy?: string,
    note?: string,
  ): Promise<any | undefined> {
    return await db.transaction(async (tx) => {
      const [currentOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId));

      if (!currentOrder) return undefined;

      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: status as any,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      // Record audit history, consistent with updateItemStatus
      await storage.itemHistory(
        orderId,
        currentOrder.status,
        status,
        note || `Order status updated to ${status}`,
        updatedBy
      );

      return updatedOrder;
    });
  }
}

export const orderService = new OrderRepository();
