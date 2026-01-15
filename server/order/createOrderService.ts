// services/orderService.ts
import { eq, sql } from "drizzle-orm";
import {
  InsertOrder,
  InsertOrderItem,
  orders,
  orderItems,
  products,
  stockMovements,
} from "@shared/schema";
import { db } from "server/db";
import { storage } from "server/storage";
import { IdGenerator } from "server/utils/idGenerator";
import { fetchPaymentDetails } from "server/razorpayClient";

export async function createOrderTransaction(
  orderData: InsertOrder,
  items: Omit<InsertOrderItem, "orderId">[],
) {
  return await db.transaction(async (trx) => {
    // 1️⃣ Generate order ID
    const orderId = await IdGenerator.generateOrderId();

    // 1️⃣ Create order with generated ID
    const [newOrder] = await trx
      .insert(orders)
      .values({
        ...orderData,
        id: orderId,
      })
      .returning();

    // 2️⃣ Process items
    let itemIndex = 1;
    for (const item of items) {
      const itemId = IdGenerator.generateItemIdFromOrder(
        orderId,
        itemIndex - 1,
      );

      await trx.insert(orderItems).values({
        ...item,
        id: itemId,
        orderId: newOrder.id,
      });

      // Deduct stock
      const updated = await trx
        .update(products)
        .set({
          onlineStock: sql`${products.onlineStock} - ${item.quantity}`,
          totalStock: sql`${products.totalStock} - ${item.quantity}`,
        })
        .where(eq(products.id, item.productId))
        .returning({ onlineStock: products.onlineStock })
        .execute();

      if (!updated[0] || updated[0].onlineStock < 0) {
        throw new Error(`Insufficient stock for productId ${item.productId}`);
      }

      // Record stock movement
      await trx.insert(stockMovements).values({
        productId: item.productId,
        quantity: -item.quantity,
        movementType: "sale",
        source: "online",
        orderRefId: newOrder.id,
        storeId: null,
      });

      // Low stock alert
      await storage.checkAndCreateStockAlert(item.productId);

      itemIndex++;
    }

    return newOrder;
  });
}

export async function paymentInfo({
  razorpayPaymentId,
}: {
  razorpayPaymentId: string;
}) {
  const payment = await fetchPaymentDetails(razorpayPaymentId);

  const mask = (value?: string | null) => {
    if (!value) return "—";
    const trimmed = value.trim();
    if (trimmed.length <= 8) return trimmed;
    return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
  };

  const method = (payment as any).method as string | undefined;
  const card = (payment as any).card;
  const bank = (payment as any).bank;
  const wallet = (payment as any).wallet;
  const vpa = (payment as any).vpa;

  let display = method ? method.toUpperCase() : "—";
  let subtype: string | undefined;

  if (method === "card") {
    const last4 = card?.last4 ? String(card.last4) : "—";
    const network = card?.network ? String(card.network).toUpperCase() : "CARD";
    subtype = card?.type ? String(card.type).toUpperCase() : undefined;
    display = `${network} •••• ${last4}`;
  } else if (method === "upi") {
    display = vpa ? `UPI ${mask(String(vpa))}` : "UPI";
  } else if (method === "netbanking") {
    display = bank ? `NETBANKING ${String(bank).toUpperCase()}` : "NETBANKING";
  } else if (method === "wallet") {
    display = wallet ? `WALLET ${String(wallet).toUpperCase()}` : "WALLET";
  } else if (method === "emi") {
    display = "EMI";
  } else if (method === "paylater") {
    display = "PAY LATER";
  }

  return {
    available: true,
    method,
    display,
    subtype,
    razorpayPaymentId: mask(razorpayPaymentId),
  };
}
