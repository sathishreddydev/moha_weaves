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

export async function createOrderTransaction(
  orderData: InsertOrder,
  items: Omit<InsertOrderItem, "orderId">[]
) {
  return await db.transaction(async (trx) => {
    // 1️⃣ Generate order ID
    const orderId = await IdGenerator.generateOrderId();
    
    // 1️⃣ Create order with generated ID
    const [newOrder] = await trx.insert(orders).values({
      ...orderData,
      id: orderId,
    }).returning();

    // 2️⃣ Process items
    let itemIndex = 1;
    for (const item of items) {
      const itemId = IdGenerator.generateItemIdFromOrder(orderId, itemIndex - 1);
      
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
