import {
  InsertOnlineExchange,
  InsertOnlineExchangeItem,
  OnlineExchange,
  onlineExchangeItems,
  onlineExchanges,
  orderItems,
  orders,
  products,
  productVariants,
  stockMovements,
  users,
} from "@shared/schema";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { roleBasedProductService } from "../product/roleBasedProductService";
import { orderService } from "../order/orderStorage";
import { storage } from "../storage";
import { createOrderHistoryProduct } from "../order/orderStorage";

export type OnlineExchangeWithDetails = OnlineExchange & {
  order: {
    orderId: string;
    shippingAddress: any;
  };
  user: any;
  items: (any & {
    orderItem: {
      product: any;
    };
  })[];
};

export interface IOnlineExchangeStorage {
  getOnlineExchanges(filters?: {
    userId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<OnlineExchangeWithDetails[] | {
    data: OnlineExchangeWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  getOnlineExchange(id: string): Promise<OnlineExchangeWithDetails | undefined>;
  createOnlineExchange(
    exchange: InsertOnlineExchange,
    items: Omit<InsertOnlineExchangeItem, 'exchangeId'>[]
  ): Promise<OnlineExchange>;
  updateOnlineExchangeStatus(
    id: string,
    status: string,
    processedBy?: string,
    inspectionNotes?: string,
    exchangeOrderId?: string
  ): Promise<OnlineExchange | undefined>;
  updateOnlineExchange(
    id: string,
    data: Partial<InsertOnlineExchange>
  ): Promise<OnlineExchange | undefined>;
  getUserOnlineExchanges(userId: string): Promise<OnlineExchangeWithDetails[]>;
  checkOrderOnlineExchangeEligibility(
    orderId: string,
    orderItemIds?: string[]
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number; eligibleItems?: string[] }>;
}

// Status transition guard
const EXCHANGE_TRANSITIONS: Record<string, string[]> = {
  exchange_requested:        ["exchange_approved", "exchange_cancelled"],
  exchange_approved:         ["exchange_processing", "exchange_cancelled"],
  exchange_processing:       ["exchange_pickup_scheduled", "exchange_cancelled"],
  exchange_pickup_scheduled: ["exchange_picked_up", "exchange_cancelled"],
  exchange_picked_up:        ["exchange_in_transit", "exchange_cancelled"],
  exchange_in_transit:       ["exchange_received", "exchange_cancelled"],
  exchange_received:         ["exchange_inspected", "exchange_cancelled"],
  exchange_inspected:        ["exchange_shipped", "exchange_cancelled"],
  exchange_shipped:          ["exchange_delivered"],
  exchange_delivered:        ["exchange_completed"],
  exchange_completed:        [],
  exchange_cancelled:        [],
};

export { EXCHANGE_TRANSITIONS };

// Active statuses (exchange_cancelled intentionally excluded)
const ACTIVE_EXCHANGE_STATUSES = [
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
] as const;

// Fetch only the fields needed for display — never expose password/tokenVersion
async function getSafeUser(userId: string): Promise<{ id: string; name: string; email: string; phone: string | null } | undefined> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? undefined;
}

// Shared helper: fetch exchange items and map products via roleBasedProductService
async function buildExchangeItems(exchangeId: string): Promise<any[]> {
  const rawItems = await db
    .select()
    .from(onlineExchangeItems)
    .innerJoin(orderItems, eq(onlineExchangeItems.orderItemId, orderItems.id))
    .where(eq(onlineExchangeItems.exchangeId, exchangeId));

  if (!rawItems.length) return [];

  const productIds = [...new Set(rawItems.map((r) => r.order_items.productId))];

  const productsData = await roleBasedProductService.getProductsByRole(
    { ids: productIds },
    "inventory"
  );

  const productMap = new Map(productsData.map((p) => [p.id, p]));

  return rawItems.map((row) => {
    const product = productMap.get(row.order_items.productId);
    return {
      ...row.online_exchange_items,
      orderItem: {
        ...row.order_items,
        product: createOrderHistoryProduct(product),
      },
    };
  });
}

export class OnlineExchangeStorage implements IOnlineExchangeStorage {
  async getOnlineExchanges(filters?: {
    userId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<OnlineExchangeWithDetails[] | {
    data: OnlineExchangeWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const conditions: any[] = [];

    if (filters?.userId)
      conditions.push(eq(onlineExchanges.userId, filters.userId));
    if (filters?.status)
      conditions.push(eq(onlineExchanges.status, filters.status as any));
    if (filters?.dateFrom)
      conditions.push(gte(onlineExchanges.createdAt, new Date(filters.dateFrom)));
    if (filters?.dateTo)
      conditions.push(lte(onlineExchanges.createdAt, new Date(filters.dateTo)));

    // Search by exchange ID or order ID at DB level
    if (filters?.search) {
      conditions.push(
        sql`(${onlineExchanges.id} ILIKE ${'%' + filters.search + '%'}
          OR ${onlineExchanges.orderId} ILIKE ${'%' + filters.search + '%'})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const isPaginated = filters?.page !== undefined && filters?.pageSize !== undefined;

    if (isPaginated) {
      const page = filters!.page!;
      const pageSize = filters!.pageSize!;
      const offset = (page - 1) * pageSize;

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(onlineExchanges)
        .where(whereClause);

      const total = Number(countResult?.count ?? 0);
      const totalPages = Math.ceil(total / pageSize);

      const exchangeList = await db
        .select()
        .from(onlineExchanges)
        .where(whereClause)
        .orderBy(desc(onlineExchanges.createdAt))
        .limit(pageSize)
        .offset(offset);

      const data = await this.hydrateExchanges(exchangeList, filters?.search);

      return { data, total, page, pageSize, totalPages };
    }

    // Non-paginated (e.g. getUserOnlineExchanges)
    const exchangeList = await db
      .select()
      .from(onlineExchanges)
      .where(whereClause)
      .orderBy(desc(onlineExchanges.createdAt));

    return this.hydrateExchanges(exchangeList, filters?.search);
  }

  // Hydrate a list of raw exchange rows into OnlineExchangeWithDetails
  private async hydrateExchanges(
    exchangeList: any[],
    search?: string
  ): Promise<OnlineExchangeWithDetails[]> {
    const result: OnlineExchangeWithDetails[] = [];

    for (const exchange of exchangeList) {
      const orderWithItems = await orderService.getOrder(exchange.orderId, "inventory");
      const user = await getSafeUser(exchange.userId);

      if (!orderWithItems || !user) continue;

      // Post-fetch search on user name/email (can't be done in SQL without a join)
      if (search) {
        const term = search.toLowerCase();
        const nameMatch = user.name?.toLowerCase().includes(term);
        const emailMatch = user.email?.toLowerCase().includes(term);
        // ID/orderId already filtered at DB level; skip if no user match either
        const idMatch =
          exchange.id.toLowerCase().includes(term) ||
          exchange.orderId.toLowerCase().includes(term);
        if (!nameMatch && !emailMatch && !idMatch) continue;
      }

      const items = await buildExchangeItems(exchange.id);

      result.push({
        ...exchange,
        order: {
          orderId: orderWithItems.id,
          shippingAddress: orderWithItems.shippingAddress,
        },
        user,
        items,
      });
    }

    return result;
  }

  async getOnlineExchange(id: string): Promise<OnlineExchangeWithDetails | undefined> {
    const [exchange] = await db
      .select()
      .from(onlineExchanges)
      .where(eq(onlineExchanges.id, id));

    if (!exchange) return undefined;

    const orderWithItems = await orderService.getOrder(exchange.orderId, "inventory");
    const user = await getSafeUser(exchange.userId);

    if (!orderWithItems || !user) return undefined;

    const items = await buildExchangeItems(exchange.id);

    return {
      ...exchange,
      order: {
        orderId: orderWithItems.id,
        shippingAddress: orderWithItems.shippingAddress,
      },
      user,
      items,
    };
  }

  async createOnlineExchange(
    exchange: InsertOnlineExchange,
    items: Omit<InsertOnlineExchangeItem, 'exchangeId'>[]
  ): Promise<OnlineExchange> {
    return await db.transaction(async (tx) => {
      const [newExchange] = await tx
        .insert(onlineExchanges)
        .values(exchange)
        .returning();

      for (const item of items) {
        await tx.insert(onlineExchangeItems).values({
          ...item,
          exchangeId: newExchange.id,
        });

        // Read actual current status before updating
        const [currentItem] = await tx
          .select({ status: orderItems.status, variantId: orderItems.variantId })
          .from(orderItems)
          .where(eq(orderItems.id, item.orderItemId));

        const previousStatus = currentItem?.status ?? "delivered";
        const originalVariantId: string | null = currentItem?.variantId ?? null;
        const replacementVariantId: string | null = item.exchangeVariantId ?? null;
        const isDifferentSize =
          replacementVariantId &&
          replacementVariantId !== originalVariantId;

        await tx
          .update(orderItems)
          .set({ status: "exchange_requested", updatedAt: new Date() })
          .where(eq(orderItems.id, item.orderItemId));

        await storage.itemHistory(
          item.orderItemId,
          previousStatus,
          "exchange_requested",
          "Online exchange created",
          exchange.userId
        );

        // ── Reserve replacement stock immediately for different-size exchanges ──
        if (isDifferentSize && item.exchangeproductId) {
          // Validate replacement variant has enough stock before reserving
          const [replacementVariant] = await tx
            .select({ onlineStock: productVariants.onlineStock })
            .from(productVariants)
            .where(eq(productVariants.id, replacementVariantId!));

          if (!replacementVariant || replacementVariant.onlineStock < item.quantity) {
            throw new Error(
              `The selected replacement size is out of stock. Please choose a different size.`
            );
          }

          // Deduct variant stock
          await tx
            .update(productVariants)
            .set({
              stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}`,
              onlineStock: sql`${productVariants.onlineStock} - ${item.quantity}`,
            })
            .where(eq(productVariants.id, replacementVariantId!));

          // Deduct product-level stock
          await tx
            .update(products)
            .set({
              onlineStock: sql`${products.onlineStock} - ${item.quantity}`,
              totalStock: sql`${products.totalStock} - ${item.quantity}`,
            })
            .where(eq(products.id, item.exchangeproductId));

          await tx.insert(stockMovements).values({
            productId: item.exchangeproductId,
            variantId: replacementVariantId,
            quantity: -item.quantity,
            movementType: "sale",
            source: "online",
            orderRefId: newExchange.orderId,
            notes: "Replacement stock reserved for different-size exchange",
            createdAt: new Date(),
          });

          await storage.checkAndCreateStockAlert(item.exchangeproductId);
        }
      }

      return newExchange;
    });
  }

  async updateOnlineExchangeStatus(
    id: string,
    status: any,
    processedBy?: string,
    inspectionNotes?: string,
    exchangeOrderId?: string
  ): Promise<OnlineExchange | undefined> {
    return await db.transaction(async (tx) => {
      // Enforce status transition guard
      const [current] = await tx
        .select({ status: onlineExchanges.status })
        .from(onlineExchanges)
        .where(eq(onlineExchanges.id, id));

      if (!current) return undefined;

      const allowed = EXCHANGE_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(status)) {
        throw new Error(
          `Invalid status transition: cannot move from "${current.status}" to "${status}"`
        );
      }

      const updateData: any = { status, updatedAt: new Date() };
      if (processedBy) updateData.processedBy = processedBy;
      if (inspectionNotes !== undefined) updateData.inspectionNotes = inspectionNotes;
      if (exchangeOrderId) updateData.exchangeOrderId = exchangeOrderId;

      const [result] = await tx
        .update(onlineExchanges)
        .set(updateData)
        .where(eq(onlineExchanges.id, id))
        .returning();

      if (!result) return undefined;

      const onlineExchange = await this.getOnlineExchange(id);
      if (!onlineExchange) return result;

      // Map exchange status to order item status (1:1 mapping)
      const statusMap: Record<string, string> = {
        exchange_requested:        "exchange_requested",
        exchange_approved:         "exchange_approved",
        exchange_processing:       "exchange_processing",
        exchange_pickup_scheduled: "exchange_pickup_scheduled",
        exchange_picked_up:        "exchange_picked_up",
        exchange_in_transit:       "exchange_in_transit",
        exchange_received:         "exchange_received",
        exchange_inspected:        "exchange_inspected",
        exchange_shipped:          "exchange_shipped",
        exchange_delivered:        "exchange_delivered",
        exchange_completed:        "exchange_completed",
        exchange_cancelled:        "exchange_cancelled",
      };

      for (const item of onlineExchange.items) {
        const newItemStatus = statusMap[status] ?? "exchange_requested";
        await tx.update(orderItems).set({
          status: newItemStatus as any,
          updatedAt: new Date(),
        }).where(eq(orderItems.id, item.orderItemId));

        await storage.itemHistory(
          item.orderItemId,
          item.orderItem.status,
          newItemStatus,
          `Exchange request ${status}`,
          processedBy
        );
      }

      // Send notification once, outside the item loop
      await storage.createNotification({
        userId: onlineExchange.userId,
        type: "order",
        title: "Online Exchange Update",
        message: `Your online exchange request for order #${String(onlineExchange.orderId)} has been updated to "${String(status)}".`,
        relatedId: onlineExchange.orderId,
        relatedType: "order",
      });

      // ── Release reservation on cancellation ─────────────────────────────
      // If a different-size exchange is cancelled, restore the replacement
      // variant stock that was reserved at creation time.
      if (status === "exchange_cancelled") {
        for (const item of onlineExchange.items) {
          const originalVariantId: string | null = item.orderItem.variantId ?? null;
          const replacementVariantId: string | null = item.exchangeVariantId ?? null;
          const isDifferentSize =
            replacementVariantId && replacementVariantId !== originalVariantId;

          if (isDifferentSize && item.exchangeproductId) {
            // Restore variant stock
            await tx
              .update(productVariants)
              .set({
                stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`,
                onlineStock: sql`${productVariants.onlineStock} + ${item.quantity}`,
              })
              .where(eq(productVariants.id, replacementVariantId!));

            // Restore product-level stock
            await tx
              .update(products)
              .set({
                onlineStock: sql`${products.onlineStock} + ${item.quantity}`,
                totalStock: sql`${products.totalStock} + ${item.quantity}`,
              })
              .where(eq(products.id, item.exchangeproductId));

            await tx.insert(stockMovements).values({
              productId: item.exchangeproductId,
              variantId: replacementVariantId,
              quantity: item.quantity,
              movementType: "return",
              source: "online",
              orderRefId: onlineExchange.orderId,
              notes: "Reservation released — exchange cancelled",
              createdAt: new Date(),
            });
          }
        }
      }

      // Fire stock movements only when exchange_completed
      if (status === "exchange_completed") {
        for (const item of onlineExchange.items) {
          const originalVariantId: string | null = item.orderItem.variantId ?? null;
          const replacementVariantId: string | null = item.exchangeVariantId ?? null;
          const isSameVariant =
            originalVariantId &&
            replacementVariantId &&
            originalVariantId === replacementVariantId;

          // ── Restore returned item stock ──────────────────────────────────
          // Only restore if the item is restockable
          if (item.isRestockable) {
            // Restore product-level stock
            await tx
              .update(products)
              .set({
                totalStock: sql`${products.totalStock} + ${item.quantity}`,
                onlineStock: sql`${products.onlineStock} + ${item.quantity}`,
              })
              .where(eq(products.id, item.orderItem.product.id));

            // Restore the original variant's stock too (if it had one)
            if (originalVariantId) {
              await tx
                .update(productVariants)
                .set({
                  stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`,
                  onlineStock: sql`${productVariants.onlineStock} + ${item.quantity}`,
                })
                .where(eq(productVariants.id, originalVariantId));
            }

            await tx.insert(stockMovements).values({
              productId: item.orderItem.product.id,
              variantId: originalVariantId,
              quantity: item.quantity,
              movementType: "return",
              source: "online",
              orderRefId: onlineExchange.orderId,
              notes: "Stock restored from exchange return",
              createdAt: new Date(),
            });
          }

          // ── Replacement stock at completion ──────────────────────────────
          // Different-size: stock was already reserved at creation time.
          // Nothing to deduct here — just record a dispatch movement for audit.
          // Same-size: no reservation was made at creation, so deduct now
          // (the returned item refills the same slot, net = 0, but we still
          // record both movements for the audit trail).
          if (isSameVariant) {
            // Returned item restores the slot, replacement takes it back out.
            // Net stock change = 0, but record the dispatch movement.
            await tx
              .update(products)
              .set({
                totalStock: sql`${products.totalStock} - ${item.quantity}`,
                onlineStock: sql`${products.onlineStock} - ${item.quantity}`,
              })
              .where(eq(products.id, item.orderItem.product.id));

            await tx
              .update(productVariants)
              .set({
                stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}`,
                onlineStock: sql`${productVariants.onlineStock} - ${item.quantity}`,
              })
              .where(eq(productVariants.id, replacementVariantId));

            await tx.insert(stockMovements).values({
              productId: item.orderItem.product.id,
              variantId: replacementVariantId,
              quantity: -item.quantity,
              movementType: "sale",
              source: "online",
              orderRefId: onlineExchange.orderId,
              notes: "Same-size exchange — replacement dispatched",
              createdAt: new Date(),
            });
          } else if (item.exchangeproductId && replacementVariantId) {
            // Different-size: already reserved at creation — just log dispatch.
            await tx.insert(stockMovements).values({
              productId: item.exchangeproductId,
              variantId: replacementVariantId,
              quantity: 0, // No stock change — already deducted at creation
              movementType: "sale",
              source: "online",
              orderRefId: onlineExchange.orderId,
              notes: "Different-size exchange — replacement dispatched (reserved at creation)",
              createdAt: new Date(),
            });
          } else if (item.exchangeproductId && !replacementVariantId) {
            // No variant specified (non-sized product) — deduct product stock now
            await tx
              .update(products)
              .set({
                onlineStock: sql`${products.onlineStock} - ${item.quantity}`,
                totalStock: sql`${products.totalStock} - ${item.quantity}`,
              })
              .where(eq(products.id, item.exchangeproductId));

            await tx.insert(stockMovements).values({
              productId: item.exchangeproductId,
              variantId: null,
              quantity: -item.quantity,
              movementType: "sale",
              source: "online",
              orderRefId: onlineExchange.orderId,
              notes: "Exchange completed — replacement dispatched",
              createdAt: new Date(),
            });

            await storage.checkAndCreateStockAlert(item.exchangeproductId);
          }
        }
      }

      return result;
    });
  }

  async updateOnlineExchange(
    id: string,
    data: Partial<InsertOnlineExchange>
  ): Promise<OnlineExchange | undefined> {
    const [result] = await db
      .update(onlineExchanges)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onlineExchanges.id, id))
      .returning();
    return result || undefined;
  }

  async getUserOnlineExchanges(userId: string): Promise<OnlineExchangeWithDetails[]> {
    const result = await this.getOnlineExchanges({ userId });
    return Array.isArray(result) ? result : result.data ?? [];
  }

  async checkOrderOnlineExchangeEligibility(
    orderId: string,
    orderItemIds?: string[]
  ): Promise<{ eligible: boolean; reason?: string; remainingDays?: number; eligibleItems?: string[] }> {
    const order = await orderService.getOrder(orderId, "inventory");
    if (!order) return { eligible: false, reason: "Order not found" };

    if (orderItemIds && orderItemIds.length > 0) {
      const eligibleItems: string[] = [];

      for (const orderItemId of orderItemIds) {
        const orderItem = order.items.find((item: any) => item.id === orderItemId);
        if (!orderItem) {
          return { eligible: false, reason: `Order item ${orderItemId} not found` };
        }

        const isDelivered =
          orderItem.status === "delivered" ||
          orderItem.status === "exchange_completed" ||
          orderItem.status === "return_completed";

        if (!isDelivered) {
          return { eligible: false, reason: `Item ${orderItem.product.name} must be delivered to initiate exchange` };
        }

        const exchangedQty = await this.getExchangedQuantityByOrderItem(orderItemId);
        const purchasedQty = Number(orderItem.quantity ?? 0);

        if (purchasedQty <= exchangedQty) {
          return { eligible: false, reason: `Item ${orderItem.product.name} has already been fully exchanged` };
        }

        eligibleItems.push(orderItemId);
      }

      const eligibleUntil = await this.resolveEligibleUntil(order, orderId);
      if (!eligibleUntil) {
        return { eligible: false, reason: "Online exchange window not set - order delivery date missing" };
      }

      const now = new Date();
      if (now > eligibleUntil) {
        return { eligible: false, reason: "Online exchange window has expired" };
      }

      const remainingDays = Math.max(
        0,
        Math.floor((eligibleUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      return { eligible: true, remainingDays, eligibleItems };
    }

    // Entire-order check (backward compatibility)
    const hasDeliveredItem = order.items.some((item: any) =>
      item.status === "delivered" ||
      item.status === "exchange_completed" ||
      item.status === "return_completed"
    );

    if (!hasDeliveredItem) {
      return { eligible: false, reason: "At least one item must be delivered to initiate online exchange" };
    }

    const eligibleUntil = await this.resolveEligibleUntil(order, orderId);
    if (!eligibleUntil) {
      return { eligible: false, reason: "Online exchange window not set - order delivery date missing" };
    }

    const now = new Date();
    if (now > eligibleUntil) {
      return { eligible: false, reason: "Online exchange window has expired" };
    }

    const remainingDays = Math.max(
      0,
      Math.floor((eligibleUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    return { eligible: true, remainingDays };
  }

  // Resolve or compute+persist the exchange eligibility window
  private async resolveEligibleUntil(order: any, orderId: string): Promise<Date | null> {
    if (order.returnEligibleUntil) {
      return new Date(order.returnEligibleUntil);
    }

    if (!order.deliveredAt) return null;

    const windowDays = 7;
    const eligibleUntil = new Date(order.deliveredAt);
    eligibleUntil.setDate(eligibleUntil.getDate() + windowDays);

    await db
      .update(orders)
      .set({ returnEligibleUntil: eligibleUntil })
      .where(eq(orders.id, orderId));

    return eligibleUntil;
  }

  // Sum exchanged quantity for an order item, excluding cancelled exchanges
  private async getExchangedQuantityByOrderItem(orderItemId: string): Promise<number> {
    const result = await db
      .select({
        qty: sql<number>`sum(${onlineExchangeItems.quantity})::int`,
      })
      .from(onlineExchangeItems)
      .innerJoin(
        onlineExchanges,
        eq(onlineExchangeItems.exchangeId, onlineExchanges.id)
      )
      .where(
        and(
          eq(onlineExchangeItems.orderItemId, orderItemId),
          inArray(onlineExchanges.status, [...ACTIVE_EXCHANGE_STATUSES])
        )
      );

    return Number(result[0]?.qty ?? 0);
  }
}

export const onlineExchangeStorage = new OnlineExchangeStorage();
