import { db } from "../db";
import { and, desc, eq, ilike, sql, gte, gt } from "drizzle-orm";
import { store_customers, storeSales, storeSaleItems, sarees, categories, colors, fabrics, stores } from "@shared/schema";

export interface StoreCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null; // Changed to null to match database
  storeId: string;
  totalPurchases: string;
  purchaseCount: number;
  firstPurchaseDate: Date;
  lastPurchaseDate: Date;
  notes: string | null; // Changed to null to match database
  loyaltyPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPurchase {
  id: string;
  saleId: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: string;
  discountAmount: string;
  paymentMode: string;
  createdAt: Date;
  items: CustomerPurchaseItem[];
}

export interface CustomerPurchaseItem {
  id: string;
  sareeId: string;
  quantity: number; // notNull in database
  price: string; // decimal from database
  returnedQuantity: number; // notNull in database
  saree: {
    id: string;
    name: string;
    code: string;
    imageUrl: string;
    category: { name: string } | null;
    color: { name: string } | null;
    fabric: { name: string } | null;
  } | null;
}

export interface CustomerStorage {
  findOrCreateCustomer(phone: string, name: string, storeId: string): Promise<StoreCustomer>;
  updateCustomerAfterPurchase(customerId: string, purchaseAmount: number): Promise<void>;
  getCustomerByPhone(phone: string, storeId: string): Promise<StoreCustomer | undefined>;
  getAllCustomers(storeId: string, search?: string): Promise<StoreCustomer[]>;
  getCustomerById(customerId: string): Promise<StoreCustomer | undefined>;
  getCustomerPurchases(customerId: string): Promise<CustomerPurchase[]>;
  updateCustomerNotes(customerId: string, notes: string): Promise<StoreCustomer>;
  updateCustomerLoyaltyPoints(customerId: string, points: number): Promise<StoreCustomer>;
}

export class CustomerService implements CustomerStorage {
  async findOrCreateCustomer(phone: string, name: string, storeId: string): Promise<StoreCustomer> {
    // First try to find existing customer
    let customer = await this.getCustomerByPhone(phone, storeId);
    
    if (!customer) {
      // Create new customer
      const [newCustomer] = await db
        .insert(store_customers)
        .values({
          name,
          phone,
          storeId,
          totalPurchases: "0",
          purchaseCount: 1,
          firstPurchaseDate: new Date(),
          lastPurchaseDate: new Date(),
          loyaltyPoints: 0,
        })
        .returning();
      
      customer = newCustomer;
    }
    
    return customer;
  }

  async updateCustomerAfterPurchase(customerId: string, purchaseAmount: number): Promise<void> {
    await db
      .update(store_customers)
      .set({
        totalPurchases: sql`${store_customers.totalPurchases} + ${purchaseAmount}`,
        purchaseCount: sql`${store_customers.purchaseCount} + 1`,
        lastPurchaseDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(store_customers.id, customerId));
  }

  async getCustomerByPhone(phone: string, storeId: string): Promise<StoreCustomer | undefined> {
    const [customer] = await db
      .select()
      .from(store_customers)
      .where(
        and(
          eq(store_customers.phone, phone),
          eq(store_customers.storeId, storeId)
        )
      );
    
    return customer;
  }

  async getAllCustomers(storeId: string, search?: string): Promise<StoreCustomer[]> {
    let whereClause = eq(store_customers.storeId, storeId);
    
    if (search) {
      whereClause = and(
        whereClause,
        sql`(${store_customers.name} ILIKE ${`%${search}%`} OR ${store_customers.phone} ILIKE ${`%${search}%`})`
      )!;
    }

    const customers = await db
      .select()
      .from(store_customers)
      .where(whereClause)
      .orderBy(desc(store_customers.lastPurchaseDate));

    return customers;
  }

  async getCustomerById(customerId: string): Promise<StoreCustomer | undefined> {
    const [customer] = await db
      .select()
      .from(store_customers)
      .where(eq(store_customers.id, customerId));
    
    return customer;
  }

  async getCustomerPurchases(customerId: string): Promise<CustomerPurchase[]> {
    // Single query with joins to avoid N+1 problem
    const salesWithItems = await db
      .select({
        // Sale fields
        saleId: storeSales.id,
        customerName: storeSales.customerName,
        customerPhone: storeSales.customerPhone,
        totalAmount: storeSales.totalAmount,
        discountAmount: storeSales.discountAmount,
        paymentMode: storeSales.paymentMode,
        createdAt: storeSales.createdAt,
        // Item fields
        itemId: storeSaleItems.id,
        itemSareeId: storeSaleItems.sareeId,
        itemQuantity: storeSaleItems.quantity,
        itemPrice: storeSaleItems.price,
        itemReturnedQuantity: storeSaleItems.returnedQuantity,
        // Saree fields
        sareeId: sarees.id,
        sareeName: sarees.name,
        sareeCode: sarees.sku,
        sareeImage: sarees.imageUrl,
        categoryName: categories.name,
        colorName: colors.name,
        fabricName: fabrics.name,
      })
      .from(storeSales)
      .leftJoin(storeSaleItems, eq(storeSales.id, storeSaleItems.saleId))
      .leftJoin(sarees, eq(storeSaleItems.sareeId, sarees.id))
      .leftJoin(categories, eq(sarees.categoryId, categories.id))
      .leftJoin(colors, eq(sarees.colorId, colors.id))
      .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id))
      .where(eq(storeSales.customerId, customerId))
      .orderBy(desc(storeSales.createdAt));

    // Group items by sale
    const salesMap = new Map<string, CustomerPurchase>();
    
    for (const row of salesWithItems) {
      const saleId = row.saleId;
      
      if (!salesMap.has(saleId)) {
        salesMap.set(saleId, {
          id: saleId,
          saleId,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          totalAmount: row.totalAmount,
          discountAmount: row.discountAmount || "0",
          paymentMode: row.paymentMode || "cash",
          createdAt: row.createdAt,
          items: [],
        });
      }
      
      const sale = salesMap.get(saleId)!;
      
      // Add item if it exists (sales without items won't have item data)
      if (row.itemId) {
        sale.items.push({
          id: row.itemId,
          sareeId: row.itemSareeId || '',
          quantity: row.itemQuantity || 0,
          price: row.itemPrice || "0",
          returnedQuantity: row.itemReturnedQuantity || 0,
          saree: row.sareeId ? {
            id: row.sareeId,
            name: row.sareeName || '',
            code: row.sareeCode || '',
            imageUrl: row.sareeImage || '',
            category: row.categoryName ? { name: row.categoryName } : null,
            color: row.colorName ? { name: row.colorName } : null,
            fabric: row.fabricName ? { name: row.fabricName } : null,
          } : null,
        });
      }
    }

    return Array.from(salesMap.values());
  }

  async updateCustomerNotes(customerId: string, notes: string): Promise<StoreCustomer> {
    const [updatedCustomer] = await db
      .update(store_customers)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(eq(store_customers.id, customerId))
      .returning();

    return updatedCustomer;
  }

  async updateCustomerLoyaltyPoints(customerId: string, points: number): Promise<StoreCustomer> {
    const [updatedCustomer] = await db
      .update(store_customers)
      .set({
        loyaltyPoints: points,
        updatedAt: new Date(),
      })
      .where(eq(store_customers.id, customerId))
      .returning();

    return updatedCustomer;
  }

  // Get customer statistics for dashboard
  async getCustomerStats(storeId: string): Promise<{
    totalCustomers: number;
    newCustomersThisMonth: number;
    repeatCustomers: number;
    topCustomers: StoreCustomer[];
  }> {
    const totalCustomers = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(store_customers)
      .where(eq(store_customers.storeId, storeId));

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const newCustomersThisMonth = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(store_customers)
      .where(
        and(
          eq(store_customers.storeId, storeId),
          gte(store_customers.createdAt, thisMonth)
        )
      );

    const repeatCustomers = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(store_customers)
      .where(
        and(
          eq(store_customers.storeId, storeId),
          gt(store_customers.purchaseCount, 1)
        )
      );

    const topCustomers = await db
      .select()
      .from(store_customers)
      .where(eq(store_customers.storeId, storeId))
      .orderBy(desc(store_customers.totalPurchases))
      .limit(10);

    return {
      totalCustomers: totalCustomers[0]?.count || 0,
      newCustomersThisMonth: newCustomersThisMonth[0]?.count || 0,
      repeatCustomers: repeatCustomers[0]?.count || 0,
      topCustomers,
    };
  }
}
