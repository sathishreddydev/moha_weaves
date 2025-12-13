import { UserAddress, userAddresses, InsertUserAddress } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { db } from "server/db";

// Updated interface
export interface AddressStorage {
  // Fetch all addresses of a user
  getUserAddresses(userId: string): Promise<UserAddress[]>;
  
  // Fetch a single address by id
  getUserAddress(id: string): Promise<UserAddress | undefined>;

  // Create, update, delete, set default and return full updated array
  createUserAddress(address: InsertUserAddress): Promise<UserAddress[]>;
  updateUserAddress(
    id: string,
    data: Partial<InsertUserAddress>
  ): Promise<UserAddress[]>;
  deleteUserAddress(id: string): Promise<UserAddress[]>;
  setDefaultAddress(
    userId: string,
    addressId: string
  ): Promise<UserAddress[]>;
}

export class AddressRepository implements AddressStorage {
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
    return address;
  }

  async createUserAddress(address: InsertUserAddress): Promise<UserAddress[]> {
    if (address.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, address.userId));
    }

    await db.insert(userAddresses).values(address);

    return this.getUserAddresses(address.userId);
  }

  async updateUserAddress(
    id: string,
    data: Partial<InsertUserAddress>
  ): Promise<UserAddress[]> {
    const existing = await this.getUserAddress(id);
    if (!existing) return [];

    if (data.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, existing.userId));
    }

    await db.update(userAddresses).set(data).where(eq(userAddresses.id, id));

    return this.getUserAddresses(existing.userId);
  }

  async deleteUserAddress(id: string): Promise<UserAddress[]> {
    const existing = await this.getUserAddress(id);
    if (!existing) return [];

    await db.delete(userAddresses).where(eq(userAddresses.id, id));

    return this.getUserAddresses(existing.userId);
  }

  async setDefaultAddress(
    userId: string,
    addressId: string
  ): Promise<UserAddress[]> {
    await db
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.userId, userId));

    await db
      .update(userAddresses)
      .set({ isDefault: true })
      .where(
        and(eq(userAddresses.id, addressId), eq(userAddresses.userId, userId))
      );

    return this.getUserAddresses(userId);
  }
}

export const addressService = new AddressRepository();
