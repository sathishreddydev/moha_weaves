import {
  InsertStore,
  Store,
  stores
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "server/db";

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
}
