import { store_customers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

export interface StoreCustomer {
  id: string;
  name: string;
  phone: string;
  storeId: string;
  loyaltyPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerStorage {
  getCustomerByPhone(phone: string): Promise<any | undefined>;
  getAllCustomers(storeId: string, search?: string): Promise<any[]>;
  addOrCreateCustomerLoyalty(name: string, phone: string, storeId: string, pointsToAdd: number): Promise<StoreCustomer>;
}

export class CustomerService implements CustomerStorage {
  async getCustomerByPhone(phone: string): Promise<any | undefined> {
    const [customer] = await db
      .select()
      .from(store_customers)
      .where(eq(store_customers.phone, phone));

    return customer;
  }

  async getAllCustomers(storeId: string, search?: string): Promise<any[]> {
    const customers = await db
      .select()
      .from(store_customers)
      .where(eq(store_customers.storeId, storeId));

    return customers;
  }

  async addOrCreateCustomerLoyalty(
    name: string,
    phone: string,
    storeId: string,
    pointsToAdd: number,
  ): Promise<StoreCustomer> {
    let customer = await db
      .select()
      .from(store_customers)
      .where(eq(store_customers.phone, phone))
      .limit(1)
      .then(res => res[0]);

    if (customer) {
      const newPoints = Math.max(0, customer.loyaltyPoints + pointsToAdd);

      const [updatedCustomer] = await db
        .update(store_customers)
        .set({
          loyaltyPoints: newPoints,
          updatedAt: new Date(),
        })
        .where(eq(store_customers.id, customer.id))
        .returning();

      return updatedCustomer;
    } else {

      const [newCustomer] = await db
        .insert(store_customers)
        .values({
          name,
          phone,
          storeId,
          loyaltyPoints: Math.max(0, pointsToAdd),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newCustomer;
    }
  }

}
