import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { stores, storeSales, storeExchanges } from "@shared/schema";

/**
 * Cleans store name by removing non-alphanumeric characters and converting to lowercase
 */
function cleanStoreName(storeName: string): string {
  return storeName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Gets the next sequential number for a given table and store
 */
async function getNextSequenceNumber(
  table: typeof storeSales | typeof storeExchanges,
  storeId: string
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(eq(table.storeId, storeId));

  return (result?.count || 0) + 1;
}

/**
 * Validates that a store exists and returns it
 */
async function validateStore(storeId: string) {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!store) {
    throw new Error("Store not found");
  }
  return store;
}

/**
 * Generates a unique store sale ID in format: MOHA + store name + sequential number
 * Example: MOHAstore01, MOHAstore02
 */
export async function generateStoreSaleId(storeId: string): Promise<string> {
  const store = await validateStore(storeId);
  const cleanName = cleanStoreName(store.name);
  const nextNumber = await getNextSequenceNumber(storeSales, storeId);
  
  return `MOHA${cleanName}${nextNumber.toString().padStart(2, "0")}`;
}

/**
 * Generates a unique store exchange ID in format: EX + store name + sequential number
 * Example: EXstore01, EXstore02
 */
export async function generateStoreExchangeId(storeId: string): Promise<string> {
  const store = await validateStore(storeId);
  const cleanName = cleanStoreName(store.name);
  const nextNumber = await getNextSequenceNumber(storeExchanges, storeId);
  
  return `EX${cleanName}${nextNumber.toString().padStart(2, "0")}`;
}
