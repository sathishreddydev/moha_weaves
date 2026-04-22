import {
  categories,
  colors,
  coupons,
  fabrics,
  InsertOrder,
  InsertOrderItem,
  itemStatusHistory,
  Order,
  orderItems,
  orders,
  OrderWithItems,
  productVariants,
  products,
  sales,
  saleProducts,
  stockMovements,
  users
} from "@shared/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import { db } from "server/db";
import { returnStorage } from "server/return/returnStorage";
import { storage } from "server/storage";
import { IdGenerator } from "server/utils/idGenerator";
import { paymentInfo } from "./createOrderService";

export interface OrderStorage {
  createOrder(
    order: InsertOrder,
    items: Omit<InsertOrderItem, "orderId">[]
  ): Promise<Order>;
  getOrders(userId: string): Promise<OrderWithItems[]>;
  getOrder(id: string): Promise<OrderWithItems | undefined>;
  getBasicOrder(id: string): Promise<OrderWithItems | undefined>;
  updateItemStatus(
    orderItemId: string,
    status: string,
    updatedBy?: string,
    note?: string
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
    // Generate order ID
    const orderId = await IdGenerator.generateOrderId();
    
    const [newOrder] = await db.insert(orders).values({
      ...order,
      id: orderId,
    }).returning();

    let itemIndex = 1;
    for (const item of items) {
      const itemId = IdGenerator.generateItemIdFromOrder(orderId, itemIndex - 1);
      
      // Extract additional fields if they exist
      const { productPrice, discountedPrice, offerDetails, ...itemData } = item as any;
      
      const [newOrderItem] = await db.insert(orderItems).values({
        ...itemData,
        id: itemId,
        orderId: newOrder.id,
        status: "confirmed" // 🔄 Changed from "pending" to "confirmed"
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
  async getOrders(userId: string): Promise<OrderWithItems[]> {
    const orderList = await db
      .select()
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .leftJoin(coupons, eq(orders.couponId, coupons.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    const result: OrderWithItems[] = [];

    for (const order of orderList) {
        const customerName = order.users.name;
        
        // Get coupon information
        const couponInfo = order.coupons ? {
          couponCode: order.coupons.code,
          couponType: order.coupons.type,
          couponValue: order.coupons.value
        } : {
          couponCode: null,
          couponType: null,
          couponValue: null
        };

      const items = await db
        .select()
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
        .where(eq(orderItems.orderId, order.orders.id));

      // Get return eligibility for all items in this order
      const eligibilityMap = await returnStorage.checkOrderReturnEligibility(order.orders.id);
      
      // Get active sales for each product to determine offer details
      const itemsWithOffers = await Promise.all(
        items.map(async (row) => {
          // Find active sales for this product
          const activeSales = await db
            .select()
            .from(sales)
            .innerJoin(saleProducts, eq(sales.id, saleProducts.saleId))
            .where(
              and(
                eq(saleProducts.productId, row.products.id),
                eq(sales.isActive, true),
                sql`${sales.validFrom} <= NOW()`,
                sql`${sales.validUntil} >= NOW()`
              )
            )
            .limit(1);
          
          const offerDetails = activeSales.length > 0 ? activeSales[0].sales : null;
          
          // Calculate product pricing
          const basePrice = row.products.price;
          const variantPrice = row.product_variants?.price;
          const finalPrice = row.order_items.price;
          
          // Determine if there was a discount from offers
          let discountedPrice = null;
          if (offerDetails && basePrice) {
            const basePriceNum = parseFloat(basePrice.toString());
            if (offerDetails.offerType === 'flat') {
              discountedPrice = Math.max(0, basePriceNum - parseFloat(offerDetails.discountValue.toString())).toString();
            } else if (offerDetails.offerType === 'percentage') {
              const discount = (basePriceNum * parseFloat(offerDetails.discountValue.toString())) / 100;
              discountedPrice = Math.max(0, basePriceNum - discount).toString();
            }
          }
          
          return {
            ...row,
            offerDetails,
            productPrice: basePrice?.toString() || null,
            discountedPrice: discountedPrice || (finalPrice !== basePrice?.toString() ? finalPrice : null)
          };
        })
      );

      // Fix shipping address serialization
      let shippingAddress = order.orders.shippingAddress;
      if (typeof shippingAddress === 'string') {
        try {
          shippingAddress = JSON.parse(shippingAddress);
        } catch (e) {
          // If parsing fails, keep as string
          console.warn('Failed to parse shipping address:', shippingAddress);
        }
      }

      result.push({
        ...order.orders,
        ...couponInfo,
        shippingAddress,
        customerName,
        delhiveryWaybill: order.orders.delhiveryWaybill || "",
        delhiveryStatus: order.orders.delhiveryStatus || "",
        shippingMethod: order.orders.shippingMethod || "manual",
        estimatedDelivery: order.orders.estimatedDelivery as any,
        autoProcessed: order.orders.autoProcessed ?? true,
        addressValidated: order.orders.addressValidated ?? false,
        pickupScheduled: order.orders.pickupScheduled ?? false,
        customerNotified: order.orders.customerNotified ?? false,
        items: itemsWithOffers.map((row) => {
          const eligibility = eligibilityMap.find(e => e.itemId === row.order_items.id);
          return {
            ...row.order_items,
            returnEligibility: eligibility || { itemId: row.order_items.id, eligible: false },
            offerDetails: row.offerDetails as any,
            productPrice: row.productPrice,
            discountedPrice: row.discountedPrice,
            delhiveryWaybill: row.order_items.delhiveryWaybill || null,
            shipmentId: row.order_items.shipmentId || null,
            product: {
              ...row.products,
              category: row.categories,
              color: row.colors,
              fabric: row.fabrics,
              variants: row.product_variants ? [row.product_variants] : undefined,
              images: row.products.images,
            },
          };
        }),
      });
    }

    return result;
  }

  async getBasicOrder(id: string): Promise<OrderWithItems | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const itemsRows = await db
      .select()
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(eq(orderItems.orderId, order.id));
    
    const itemStatuses = await Promise.all(
      itemsRows.map(async (itemRow) => {
        const [latestStatus] = await db
          .select({ newStatus: itemStatusHistory.newStatus })
          .from(itemStatusHistory)
          .where(eq(itemStatusHistory.orderItemId, itemRow.order_items.id))
          .orderBy(desc(itemStatusHistory.createdAt))
          .limit(1);

        return {
          orderItemId: itemRow.order_items.id,
          currentStatus: latestStatus?.newStatus ?? itemRow.order_items.status,
        };
      })
    );
    const { estimatedDelivery, ...orderWithoutDelivery } = order;
    return {
      ...orderWithoutDelivery,
      delhiveryWaybill: order.delhiveryWaybill || "",
      delhiveryStatus: order.delhiveryStatus || "",
      shippingMethod: order.shippingMethod || "manual",
      estimatedDelivery: (estimatedDelivery?.toISOString() || undefined) as string | undefined,
      autoProcessed: order.autoProcessed ?? true,
      addressValidated: order.addressValidated ?? false,
      pickupScheduled: order.pickupScheduled ?? false,
      customerNotified: order.customerNotified ?? false,
      items: itemsRows.map((row) => {
        const statusObj = itemStatuses.find((s) => s.orderItemId === row.order_items.id);
        return {
          ...row.order_items,
          status: row.order_items.status,
          currentStatus: statusObj?.currentStatus || row.order_items.status,
          returnEligibility: { itemId: row.order_items.id, eligible: false },
          offerDetails: null,
          productPrice: null,
          discountedPrice: null,
          delhiveryWaybill: row.order_items.delhiveryWaybill || null,
          shipmentId: row.order_items.shipmentId || null,
          product: {
            ...row.products,
            category: row.categories,
            color: row.colors,
            fabric: row.fabrics,
            images: row.products.images,
            variants: row.product_variants ? [row.product_variants] : undefined,
          },
        };
      }),
    };
  }

  async getOrder(id: string): Promise<OrderWithItems | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .leftJoin(coupons, eq(orders.couponId, coupons.id))
      .where(eq(orders.id, id));
    if (!order) return undefined;

    const itemsRows = await db
      .select()
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(eq(orderItems.orderId, order.orders.id));
    
    // Get return eligibility for all items in this order
    const eligibilityMap = await returnStorage.checkOrderReturnEligibility(order.orders.id);
    
    // Get coupon information
    const couponInfo = order.coupons ? {
      couponCode: order.coupons.code,
      couponType: order.coupons.type,
      couponValue: order.coupons.value
    } : {
      couponCode: null,
      couponType: null,
      couponValue: null
    };
    
    // Get active sales for each product to determine offer details
    const itemsWithOffers = await Promise.all(
      itemsRows.map(async (row) => {
        // Find active sales for this product
        const activeSales = await db
          .select()
          .from(sales)
          .innerJoin(saleProducts, eq(sales.id, saleProducts.saleId))
          .where(
            and(
              eq(saleProducts.productId, row.products.id),
              eq(sales.isActive, true),
              sql`${sales.validFrom} <= NOW()`,
              sql`${sales.validUntil} >= NOW()`
            )
          )
          .limit(1);
        
        const offerDetails = activeSales.length > 0 ? activeSales[0].sales : null;
        
        // Calculate product pricing
        const basePrice = row.products.price;
        const variantPrice = row.product_variants?.price;
        const finalPrice = row.order_items.price;
        
        // Determine if there was a discount from offers
        let discountedPrice = null;
        if (offerDetails && basePrice) {
          const basePriceNum = parseFloat(basePrice.toString());
          if (offerDetails.offerType === 'flat') {
            discountedPrice = Math.max(0, basePriceNum - parseFloat(offerDetails.discountValue.toString())).toString();
          } else if (offerDetails.offerType === 'percentage') {
            const discount = (basePriceNum * parseFloat(offerDetails.discountValue.toString())) / 100;
            discountedPrice = Math.max(0, basePriceNum - discount).toString();
          }
        }
        
        return {
          ...row,
          offerDetails,
          productPrice: basePrice?.toString() || null,
          discountedPrice: discountedPrice || (finalPrice !== basePrice?.toString() ? finalPrice : null)
        };
      })
    );
    
    const itemStatuses = await Promise.all(
      itemsWithOffers.map(async (itemRow) => {
        const [latestStatus] = await db
          .select({ newStatus: itemStatusHistory.newStatus })
          .from(itemStatusHistory)
          .where(eq(itemStatusHistory.orderItemId, itemRow.order_items.id))
          .orderBy(desc(itemStatusHistory.createdAt))
          .limit(1);

        return {
          orderItemId: itemRow.order_items.id,
          currentStatus: latestStatus?.newStatus ?? itemRow.order_items.status,
        };
      })
    );
   const paymentData = order.orders.razorpayPaymentId ? await paymentInfo({razorpayPaymentId: order.orders.razorpayPaymentId}) : null;
   
   // Fix shipping address serialization
   let shippingAddress = order.orders.shippingAddress;
   if (typeof shippingAddress === 'string') {
     try {
       shippingAddress = JSON.parse(shippingAddress);
     } catch (e) {
       // If parsing fails, keep as string
       console.warn('Failed to parse shipping address:', shippingAddress);
     }
   }
   
    const { estimatedDelivery, ...orderWithoutDelivery } = order.orders;
    const result = {
      ...orderWithoutDelivery,
      ...couponInfo,
      shippingAddress,
      delhiveryWaybill: order.orders.delhiveryWaybill || "",
      delhiveryStatus: order.orders.delhiveryStatus || "",
      shippingMethod: order.orders.shippingMethod || "manual",
      estimatedDelivery: estimatedDelivery?.toISOString() || undefined,
      autoProcessed: order.orders.autoProcessed ?? true,
      addressValidated: order.orders.addressValidated ?? false,
      pickupScheduled: order.orders.pickupScheduled ?? false,
      customerNotified: order.orders.customerNotified ?? false,
      paymentDetails: paymentData || undefined,
      items: itemsWithOffers.map((row) => {
        const statusObj = itemStatuses.find((s) => s.orderItemId === row.order_items.id);
        const eligibility = eligibilityMap.find(e => e.itemId === row.order_items.id);
        return {
          ...row.order_items,
          status: row.order_items.status,
          currentStatus: statusObj?.currentStatus || row.order_items.status,
          returnEligibility: eligibility || { itemId: row.order_items.id, eligible: false },
          offerDetails: row.offerDetails as any,
          productPrice: row.productPrice,
          discountedPrice: row.discountedPrice,
          delhiveryWaybill: row.order_items.delhiveryWaybill || null,
          shipmentId: row.order_items.shipmentId || null,
          product: {
            ...row.products,
            category: row.categories,
            color: row.colors,
            fabric: row.fabrics,
            images: row.products.images,
            variants: row.product_variants ? [row.product_variants] : undefined,
          },
        };
      }),
    };
  }

  async updateItemStatus(
    orderItemId: string,
    status: string,
    updatedBy?: string,
    note?: string
  ): Promise<any | undefined> {
    return await db.transaction(async (tx) => {
      // Get current item status
      const [currentItem] = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, orderItemId));

      if (!currentItem) return undefined;

      // Update item status
      const [updatedItem] = await tx
        .update(orderItems)
        .set({
          status: status as any,
          updatedAt: new Date(),
          ...(status === "shipped" && { shippedAt: new Date() }),
          ...(status === "delivered" && { deliveredAt: new Date() }),
        })
        .where(eq(orderItems.id, orderItemId))
        .returning();

      // Create status history record
      await storage.itemHistory(
        orderItemId,
        currentItem.status,
        status,
        note || `Status updated to ${status}`,
        updatedBy
      );

      // Create notification for user if this is a significant status change
      let notificationMessage = "";
      switch (status) {
        case "confirmed":
          notificationMessage = "An item in your order has been confirmed and is being processed.";
          break;
        case "processing":
          notificationMessage = "An item in your order is being prepared for shipment.";
          break;
        case "shipped":
          notificationMessage = "An item in your order has been shipped!";
          break;
        case "delivered":
          notificationMessage = "An item in your order has been delivered.";
          break;
        case "cancelled":
          notificationMessage = "An item in your order has been cancelled.";
          break;
      }

      if (notificationMessage) {
        // Get order to find userId for notification
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, currentItem.orderId));

        if (order) {
          await storage.createNotification({
            userId: order.userId,
            type: "order",
            title: `Item ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: notificationMessage,
            relatedId: currentItem.orderId,
            relatedType: "order",
          });
        }
      }

      return updatedItem;
    });
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
  ): Promise<any | undefined> {
    return await db.transaction(async (tx) => {
      // Get current order status
      const [currentOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId));

      if (!currentOrder) return undefined;

      // Update order status
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: status as any,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      return updatedOrder;
    });
  }
}

export const orderService = new OrderRepository();
