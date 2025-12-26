import { InsertSaree, Saree, storeInventory, stores } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "server/db";
import { sareeService } from "server/saree/sareeStorage";
import { storeService } from "server/store/storeStorage";

interface IStorage {
  createSareeWithAllocations(
    saree: InsertSaree,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree>;
  updateSareeWithAllocations(
    id: string,
    data: Partial<InsertSaree>,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree | undefined>;
  getSareeAllocations(
    sareeId: string
  ): Promise<{ storeId: string; storeName: string; quantity: number }[]>;
}

export class InventoryRepository implements IStorage {
  async createSareeWithAllocations(
    saree: InsertSaree,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree> {
    return await db.transaction(async (tx) => {
      const createdSaree = await sareeService.createSaree(saree);

      for (const allocation of storeAllocations) {
        await tx.insert(storeInventory).values({
          storeId: allocation.storeId,
          sareeId: createdSaree.id,
          quantity: allocation.quantity,
          updatedAt: new Date(),
        });
      }

      return createdSaree;
    });
  }

  async updateSareeWithAllocations(
    id: string,
    data: Partial<InsertSaree>,
    storeAllocations: { storeId: string; quantity: number }[]
  ): Promise<Saree | undefined> {
    return await db.transaction(async (tx) => {
      const updatedSaree = await sareeService.updateSaree(id, data);
      if (!updatedSaree) return undefined;

      for (const allocation of storeAllocations) {
        const existing = await storeService.getStoreInventoryItem(
          allocation.storeId,
          id
        );
        if (existing) {
          await tx
            .update(storeInventory)
            .set({ quantity: allocation.quantity, updatedAt: new Date() })
            .where(
              and(
                eq(storeInventory.storeId, allocation.storeId),
                eq(storeInventory.sareeId, id)
              )
            );
        } else {
          await tx.insert(storeInventory).values({
            storeId: allocation.storeId,
            sareeId: id,
            quantity: allocation.quantity,
            updatedAt: new Date(),
          });
        }
      }

      return updatedSaree;
    });
  }

  async getSareeAllocations(
    sareeId: string
  ): Promise<{ storeId: string; storeName: string; quantity: number }[]> {
    const allocations = await db
      .select({
        storeId: storeInventory.storeId,
        quantity: storeInventory.quantity,
      })
      .from(storeInventory)
      .where(eq(storeInventory.sareeId, sareeId));

    const result = await Promise.all(
      allocations.map(async (alloc) => {
        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, alloc.storeId));
        return {
          storeId: alloc.storeId,
          storeName: store?.name || "Unknown",
          quantity: alloc.quantity,
        };
      })
    );

    return result;
  }
}

export const inventoryService = new InventoryRepository();
