import { UserAddress, userAddresses, InsertUserAddress } from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "server/db";
export interface AddressStorage {
  // User Addresses
  getUserAddresses(userId: string): Promise<UserAddress[]>;
  getUserAddress(id: string): Promise<UserAddress | undefined>;
  createUserAddress(address: InsertUserAddress): Promise<UserAddress>;
  updateUserAddress(
    id: string,
    data: Partial<InsertUserAddress>
  ): Promise<UserAddress | undefined>;
  deleteUserAddress(id: string): Promise<boolean>;
  setDefaultAddress(
    userId: string,
    addressId: string
  ): Promise<UserAddress | undefined>;
}

export class AddressRepository implements AddressStorage {
  // User Addresses
  async getUserAddresses(userId: string): Promise<UserAddress[]> {
    return db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, userId))
      .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));
  }

  async getUserAddress(id: string): Promise<UserAddress | undefined> {
    const [address] = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id));
    return address || undefined;
  }

  async createUserAddress(address: InsertUserAddress): Promise<UserAddress> {
    if (address.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, address.userId));
    }
    const [result] = await db.insert(userAddresses).values(address).returning();
    return result;
  }

  async updateUserAddress(
    id: string,
    data: Partial<InsertUserAddress>
  ): Promise<UserAddress | undefined> {
    if (data.isDefault) {
      const [existing] = await db
        .select()
        .from(userAddresses)
        .where(eq(userAddresses.id, id));
      if (existing) {
        await db
          .update(userAddresses)
          .set({ isDefault: false })
          .where(eq(userAddresses.userId, existing.userId));
      }
    }
    const [result] = await db
      .update(userAddresses)
      .set(data)
      .where(eq(userAddresses.id, id))
      .returning();
    return result || undefined;
  }

  async deleteUserAddress(id: string): Promise<boolean> {
    await db.delete(userAddresses).where(eq(userAddresses.id, id));
    return true;
  }

  async setDefaultAddress(
    userId: string,
    addressId: string
  ): Promise<UserAddress | undefined> {
    await db
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, userId));
    const [result] = await db
      .update(userAddresses)
      .set({ isDefault: true })
      .where(
        and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId))
      )
      .returning();
    return result || undefined;
  }
}

export const addressService = new AddressRepository();
