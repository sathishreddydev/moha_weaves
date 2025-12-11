// services/orderService.ts
import { eq, sql } from "drizzle-orm";
import {
  InsertOrder,
  InsertOrderItem,
  orders,
  orderItems,
  sarees,
  stockMovements,
} from "@shared/schema";
import { db } from "server/db";
import { storage } from "server/storage";

export async function createOrderTransaction(
  orderData: InsertOrder,
  items: Omit<InsertOrderItem, "orderId">[]
) {
  return await db.transaction(async (trx) => {
    // 1️⃣ Create order
    const [newOrder] = await trx.insert(orders).values(orderData).returning();

    // 2️⃣ Process items
    for (const item of items) {
      await trx.insert(orderItems).values({ ...item, orderId: newOrder.id });

      // Deduct stock
      const updated = await trx
        .update(sarees)
        .set({
          onlineStock: sql`${sarees.onlineStock} - ${item.quantity}`,
          totalStock: sql`${sarees.totalStock} - ${item.quantity}`,
        })
        .where(eq(sarees.id, item.sareeId))
        .returning({ onlineStock: sarees.onlineStock })
        .execute();

      if (!updated[0] || updated[0].onlineStock < 0) {
        throw new Error(`Insufficient stock for sareeId ${item.sareeId}`);
      }

      // Record stock movement
      await trx.insert(stockMovements).values({
        sareeId: item.sareeId,
        quantity: -item.quantity,
        movementType: "sale",
        source: "online",
        orderRefId: newOrder.id,
        storeId: null,
      });

      // Low stock alert
      await storage.checkAndCreateStockAlert(item.sareeId);
    }

    return newOrder;
  });
}
