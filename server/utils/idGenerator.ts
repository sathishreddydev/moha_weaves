// Import sql for raw queries
import { sql } from "drizzle-orm";

import { orders } from "@shared/schema";
import { db } from "../db";

// Sequential ID Generator for Business Context
export class IdGenerator {
  private static orderSequence = 0;
  private static itemSequence = 0;

  // Get next order sequence number
  static async getNextOrderSequence(): Promise<number> {
    try {
      // Get the highest existing sequence from database
      // Order ID format: MOHAORDYY##### (7 prefix + 2 year + 5 sequence = 14 chars)
      // SUBSTRING from position 10 extracts the 5-digit sequence number
      const year = new Date().getFullYear().toString().slice(-2);
      const prefix = `MOHAORD${year}%`;
      
      const [{ maxSeq }] = await db
        .select({
          maxSeq: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${orders.id}, 10) AS INTEGER)), 0)`,
        })
        .from(orders)
        .where(sql`${orders.id} LIKE ${prefix}`);


      return (maxSeq ?? 0) + 1;
    } catch (error) {
      console.error("Error getting order sequence:", error);
      // Fallback to timestamp-based sequence to avoid collisions
      this.orderSequence = Date.now() % 100000;
      return this.orderSequence;
    }
  }

  // Generate Order ID
  static async generateOrderId(): Promise<string> {
    const sequence = await this.getNextOrderSequence();
    const year = new Date().getFullYear().toString().slice(-2);
    const sequenceStr = sequence.toString().padStart(5, "0");
    return `MOHAORD${year}${sequenceStr}`;
  }

  // Get next item sequence for an order
  static async getNextItemSequence(orderId: string): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM order_items
        WHERE order_id = ${orderId}
      `);

      return (result as any)[0]?.count || 0 + 1;
    } catch (error) {
      console.error("Error getting item sequence:", error);
      // Fallback to in-memory sequence
      this.itemSequence++;
      return this.itemSequence;
    }
  }

  // Generate Item ID
  static async generateItemId(orderId: string): Promise<string> {
    const sequence = await this.getNextItemSequence(orderId);
    const sequenceStr = sequence.toString().padStart(2, "0");
    return `MOHAITM${sequenceStr}`;
  }

  // Alternative: Generate item ID based on order ID
  static generateItemIdFromOrder(orderId: string, itemIndex: number): string {
    const orderSuffix = orderId.replace("MOHAORD", "");
    const itemIndexStr = (itemIndex + 1).toString().padStart(2, "0");
    return `MOHAITM${orderSuffix}${itemIndexStr}`;
  }

  // Helper to convert display ID to URL-safe ID (now returns same since it's already URL-safe)
  static toUrlSafe(id: string): string {
    return id;
  }

  // Helper to convert URL-safe ID back to display ID (now returns same since it's already URL-safe)
  static toDisplayId(urlSafeId: string): string {
    return urlSafeId;
  }
}
