import { eq, sql } from "drizzle-orm";
import { db } from "server/db";
import { 
  Store, 
  stores, 
  InsertStore, 
  storeSales, 
  storeExchanges 
} from "@shared/schema";

export class StoreManagement {
  async getStores(): Promise<Store[]> {
    return await db.select().from(stores);
  }

  async getStore(id: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store;
  }

  async createStore(store: InsertStore): Promise<Store> {
    const [newStore] = await db.insert(stores).values(store).returning();
    return newStore;
  }

  async updateStore(
    id: string,
    data: Partial<InsertStore>,
  ): Promise<Store | undefined> {
    const [updatedStore] = await db
      .update(stores)
      .set(data)
      .where(eq(stores.id, id))
      .returning();
    return updatedStore;
  }

  async generateStoreSaleId(storeId: string): Promise<string> {
    const store = await this.getStore(storeId);
    if (!store) {
      throw new Error("Store not found");
    }

    // Clean store name for ID generation
    const cleanStoreName = store.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    // Get the count of existing sales for this store to determine the next number
    const existingSalesCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeSales)
      .where(eq(storeSales.storeId, storeId));

    const nextNumber = (existingSalesCount[0]?.count || 0) + 1;

    // Format: MOHA + store name + sequential number (padded to 2 digits)
    return `MOHA${cleanStoreName}${nextNumber.toString().padStart(2, "0")}`;
  }

  async generateStoreExchangeId(storeId: string): Promise<string> {
    const store = await this.getStore(storeId);
    if (!store) {
      throw new Error("Store not found");
    }

    // Clean store name for ID generation
    const cleanStoreName = store.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    // Get the count of existing exchanges for this store
    const existingExchangesCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeExchanges)
      .where(eq(storeExchanges.storeId, storeId));

    const nextNumber = (existingExchangesCount[0]?.count || 0) + 1;

    // Format: EXCH + store name + sequential number (padded to 2 digits)
    return `EXCH${cleanStoreName}${nextNumber.toString().padStart(2, "0")}`;
  }
}
