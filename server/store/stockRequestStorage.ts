import {
    InsertStockRequest,
    InsertStore,
    InsertStoreExchange,
    InsertStoreExchangeNewItem,
    InsertStoreExchangeReturnItem,
    ProductWithDetails,
    StockRequest,
    StockRequestWithDetails,
    Store,
    StoreExchange,
    StoreExchangeWithDetails,
    StoreInventory,
    StoreSale,
    StoreSaleWithItems,
    appSettings,
    categories,
    colors,
    couponUsage,
    coupons,
    fabrics,
    products,
    saleProducts,
    sales,
    stockMovements,
    storeCart,
    storeExchangeNewItems,
    storeExchangeReturnItems,
    storeExchanges,
    storeInventory,
    storeSaleItems,
    storeSales,
    stores,
    subcategories,
    users,
} from "@shared/schema";
import { and, count, desc, eq, gt, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "server/db";
import { roleBasedProductService } from "server/product/roleBasedProductService";
import { stockRequests, variantStoreInventory } from "../../shared/tables";
import { CustomerService } from "./customerStorage";
import { formatProductsByStore } from "./formatedData";

export interface Iprops {
    getStockRequestsForProducts(
        storeId: string,
        productIds: string[],
    ): Promise<StockRequest[]>;
    getStockRequest(id: string, role?: string): Promise<StockRequestWithDetails | undefined>;
    getStockRequests(filters?: {
        storeId?: string;
        status?: string;
    }, role?: string): Promise<StockRequestWithDetails[]>;
    createStockRequest(request: InsertStockRequest): Promise<StockRequest>;
    updateStockRequestStatus(
        id: string,
        status: string,
        approvedBy?: string,
        notes?: string,
    ): Promise<StockRequest | undefined>;

}
export class StockRequestRepository implements Iprops {
    async getStockRequestsForProducts(
        storeId: string,
        productIds: string[],
    ): Promise<StockRequest[]> {
        const conditions = [eq(stockRequests.storeId, storeId)];

        if (productIds.length > 0) {
            conditions.push(inArray(stockRequests.productId, productIds));
        }

        const result = await db
            .select()
            .from(stockRequests)
            .where(and(...conditions))
            .orderBy(desc(stockRequests.createdAt));

        return result;
    }

    async getStockRequest(
        id: string,
        role: string = "admin",
    ): Promise<StockRequestWithDetails | undefined> {
        const result = await db
            .select()
            .from(stockRequests)
            .innerJoin(stores, eq(stockRequests.storeId, stores.id))
            .where(eq(stockRequests.id, id))
            .limit(1);
        if (result.length === 0) return undefined;
        const row = result[0];
        const product = await roleBasedProductService.getProductByRole(row.stock_requests.productId, role as any);
        
        if (!product) {
            throw new Error(`Product not found: ${row.stock_requests.productId}`);
        }

        return {
            ...row.stock_requests,
            store: row.stores,
            product,
        };

    }

    async getStockRequests(filters?: {
        storeId?: string;
        status?: string;
    }, role: string = "admin"): Promise<StockRequestWithDetails[]> {
        const conditions = [];

        if (filters?.storeId) {
            conditions.push(eq(stockRequests.storeId, filters.storeId));
        }

        if (filters?.status) {
            conditions.push(eq(stockRequests.status, filters.status as any));
        }

        const result = await db

            .select()
            .from(stockRequests)
            .innerJoin(stores, eq(stockRequests.storeId, stores.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(stockRequests.createdAt));

        // Get all product IDs for batch fetching
        const productIds = result.map(row => row.stock_requests.productId);
        const products = await roleBasedProductService.getProductsByRole(
            { ids: productIds },
            role as any
        );

        const productMap = new Map(products.map(p => [p.id, p]));

        return result.map((row) => {
            const product = productMap.get(row.stock_requests.productId);
            if (!product) {
                throw new Error(`Product not found: ${row.stock_requests.productId}`);
            }
            return {
                ...row.stock_requests,
                store: row.stores,
                product,
            };
        });
    }

    async getStockRequestsPaginated(
        storeId: string,
        options: {
            limit: number;
            offset: number;
            search?: string;
            status?: string;
            dateFrom?: string;
            dateTo?: string;
        },
        role: string,
    ): Promise<{ data: StockRequestWithDetails[]; total: number }> {
        const conditions = [eq(stockRequests.storeId, storeId)];
        if (options.status) {
            conditions.push(eq(stockRequests.status, options.status as any));
        }
        if (options.search) {
            conditions.push(
                or(
                    ilike(stockRequests.notes, `%${options.search}%`),
                )!,
            );
        }

        if (options.dateFrom) {
            conditions.push(gte(stockRequests.createdAt, new Date(options.dateFrom)));
        }

        if (options.dateTo) {
            conditions.push(lte(stockRequests.createdAt, new Date(options.dateTo)));
        }

        const countResult = await db
            .select({ count: count() })
            .from(stockRequests)
            .where(and(...conditions));

        const result = await db
            .select()
            .from(stockRequests)
            .innerJoin(stores, eq(stockRequests.storeId, stores.id))
            .where(and(...conditions))
            .orderBy(desc(stockRequests.createdAt))
            .limit(options.limit)
            .offset(options.offset);

        const productIds = result.map(row => row.stock_requests.productId);
        const getProductsByRole = await roleBasedProductService.getProductsByRole(
            { ids: productIds },
            role as any
        );
        const products = formatProductsByStore(getProductsByRole, storeId);
        const productMap = new Map(products.map(p => [p.id, p]));

        let filteredResults = result;
        if (options.search) {
            filteredResults = result.filter(row => {
                const product = productMap.get(row.stock_requests.productId);
                return product && (
                    product.name.toLowerCase().includes(options.search!.toLowerCase()) ||
                    product.sku?.toLowerCase().includes(options.search!.toLowerCase())
                );
            });
        }

        const results = filteredResults.map((row) => {
            const product = productMap.get(row.stock_requests.productId);
            if (!product) {
                throw new Error(`Product not found: ${row.stock_requests.productId}`);
            }
            return {
                ...row.stock_requests,
                store: row.stores,
                product,
            };
        });

        return {
            data: results,

            total: countResult[0]?.count || 0,
        };
    }

    async createStockRequest(request: InsertStockRequest): Promise<StockRequest> {
        const [result] = await db.insert(stockRequests).values(request).returning();

        return result;
    }

    async updateStockRequestStatus(
        id: string,
        status: string,
        approvedBy?: string,
        notes?: string,
    ): Promise<StockRequest | undefined> {
        const updateData: any = { status: status as any, updatedAt: new Date() };
        if (approvedBy) {
            updateData.approvedBy = approvedBy;
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }
        const [result] = await db
            .update(stockRequests)
            .set(updateData)
            .where(eq(stockRequests.id, id))
            .returning();
        return result || undefined;
    }
}

export const stockRequestService = new StockRequestRepository();
