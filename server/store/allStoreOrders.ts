import {
    ProductWithDetails,
    StoreExchangeWithDetails,
    StoreSaleWithItems,
    storeExchangeNewItems,
    storeExchangeReturnItems,
    storeExchanges,
    storeSaleItems,
    storeSales,
    stores,
    users
} from "@shared/schema";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "server/db";
import { roleBasedProductService } from "server/product/roleBasedProductService";


export class AllStoreOrdersRepo {
    async getAllStoreExchangesPaginated(
        options: {
            page: number;
            pageSize: number;
            search?: string;
            dateFrom?: string;
            dateTo?: string;
            storeId?: string;
            exchangeType?: string;
            reason?: string;
            sort?: string;
        },
    ): Promise<{ data: StoreExchangeWithDetails[]; total: number }> {
        try {
            const offset = (options.page - 1) * options.pageSize;

            // Build the base query
            const baseQuery = db
                .select({
                    exchange: storeExchanges,
                    store: stores,
                    processor: users,
                    originalSale: storeSales,
                })
                .from(storeExchanges)
                .innerJoin(stores, eq(storeExchanges.storeId, stores.id))
                .leftJoin(users, eq(storeExchanges.processedBy, users.id))
                .leftJoin(storeSales, eq(storeExchanges.originalSaleId, storeSales.id));

            // Apply filters
            const conditions = [];
            let needsReturnItemsJoin = false;

            if (options.search) {
                conditions.push(or(
                    ilike(stores.name, `%${options.search}%`),
                    ilike(users.email, `%${options.search}%`),
                    sql`${storeExchanges.id}::text ILIKE ${`%${options.search}%`}`
                ));
            }

            if (options.dateFrom) {
                conditions.push(gte(storeExchanges.createdAt, new Date(options.dateFrom)));
            }

            if (options.dateTo) {
                conditions.push(lte(storeExchanges.createdAt, new Date(options.dateTo)));
            }

            if (options.storeId) {
                conditions.push(eq(storeExchanges.storeId, options.storeId));
            }

            // ADD NEW FILTER CONDITIONS
            if (options.exchangeType) {
                if (options.exchangeType === 'exchange') {
                    conditions.push(sql`${storeExchanges.status} = 'completed'`);
                } else if (options.exchangeType === 'return') {
                    conditions.push(sql`${storeExchanges.status} = 'return_only'`);
                }
                // 'both' means no filter needed
            }

            if (options.reason) {
                conditions.push(
                    sql`${storeExchangeReturnItems.specificReason} ILIKE ${`%${options.reason}%`}`,
                );
                needsReturnItemsJoin = true;
            }

            // Build the final query with conditions
            let query = baseQuery;
            
            // Add conditional join first if needed for reason filtering
            if (needsReturnItemsJoin) {
                query = query.innerJoin(
                    storeExchangeReturnItems, 
                    eq(storeExchanges.id, storeExchangeReturnItems.exchangeId)
                );
            }
            
            // Apply where clause after all necessary joins are in place
            if (conditions.length > 0) {
                query = (query as any).where(and(...conditions));
            }

            // ADD DYNAMIC SORTING
            let orderByClause = desc(storeExchanges.createdAt); // default
            if (options.sort) {
                switch (options.sort) {
                    case 'date-asc':
                        orderByClause = asc(storeExchanges.createdAt);
                        break;
                    case 'date-desc':
                    default:
                        orderByClause = desc(storeExchanges.createdAt);
                        break;
                }
            }

            // Get total count
            let totalQuery = db
                .select({ count: count() })
                .from(storeExchanges)
                .innerJoin(stores, eq(storeExchanges.storeId, stores.id))
                .leftJoin(users, eq(storeExchanges.processedBy, users.id))
                .leftJoin(storeSales, eq(storeExchanges.originalSaleId, storeSales.id));
            
            if (needsReturnItemsJoin) {
                totalQuery = totalQuery.innerJoin(
                    storeExchangeReturnItems, 
                    eq(storeExchanges.id, storeExchangeReturnItems.exchangeId)
                );
            }

            if (conditions.length > 0) {
                totalQuery = (totalQuery as any).where(and(...conditions));
            }

            const [{ count: total }] = await totalQuery;

            // Get paginated results
            const exchanges = await query
                .orderBy(orderByClause)
                .limit(options.pageSize)
                .offset(offset);

            // Fetch all return and new items for the exchanges in bulk
            const exchangeIds = exchanges.map(row => row.exchange.id);

            // Get original sale IDs that need to be fetched with full details
            const originalSaleIds = exchanges
                .map(row => row.originalSale?.id)
                .filter((id): id is string => id !== undefined);

            const [allReturnItems, allNewItems, originalSalesData] = await Promise.all([
                exchangeIds.length > 0
                    ? db.select().from(storeExchangeReturnItems).where(inArray(storeExchangeReturnItems.exchangeId, exchangeIds))
                    : Promise.resolve([]),
                exchangeIds.length > 0
                    ? db.select().from(storeExchangeNewItems).where(inArray(storeExchangeNewItems.exchangeId, exchangeIds))
                    : Promise.resolve([]),
                originalSaleIds.length > 0
                    ? db.select({
                        sale: storeSales,
                        store: stores,
                    })
                        .from(storeSales)
                        .innerJoin(stores, eq(storeSales.storeId, stores.id))
                        .where(inArray(storeSales.id, originalSaleIds))
                    : Promise.resolve([])
            ]);

            // Fetch sale items for original sales
            const saleItemsMap = new Map<string, typeof storeSaleItems.$inferSelect[]>();
            if (originalSaleIds.length > 0) {
                const saleItems = await db
                    .select()
                    .from(storeSaleItems)
                    .where(inArray(storeSaleItems.saleId, originalSaleIds));

                for (const item of saleItems) {
                    if (!saleItemsMap.has(item.saleId)) {
                        saleItemsMap.set(item.saleId, []);
                    }
                    const items = saleItemsMap.get(item.saleId);
                    if (items) {
                        items.push(item);
                    }
                }
            }

            // Get all unique product IDs from return, new, and sale items
            const allProductIds = [
                ...allReturnItems.map(item => item.productId),
                ...allNewItems.map(item => item.productId),
                ...Array.from(saleItemsMap.values()).flat().map(item => item.productId)
            ];

            // Fetch product details for all items in bulk
            const productsMap = new Map<string, ProductWithDetails>();
            if (allProductIds.length > 0) {
                const products = await roleBasedProductService.getProductsByRole({ ids: allProductIds },'inventory');
                for (const product of products) {
                    productsMap.set(product.id, product);
                }
            }

            // Create original sales map with full details
            const originalSalesMap = new Map<string, StoreSaleWithItems>();
            for (const saleRow of originalSalesData) {
                const items = saleItemsMap.get(saleRow.sale.id) || [];
                originalSalesMap.set(saleRow.sale.id, {
                    ...saleRow.sale,
                    store: saleRow.store,
                    items: items
                        .map(item => {
                            const product = productsMap.get(item.productId);
                            return product ? { ...item, product } : null;
                        })
                        .filter((item): item is Exclude<typeof item, null> => item !== null),
                });
            }

            // Create maps for efficient lookup
            const returnItemsMap = new Map<string, typeof storeExchangeReturnItems.$inferSelect[]>();
            const newItemsMap = new Map<string, typeof storeExchangeNewItems.$inferSelect[]>();

            for (const item of allReturnItems) {
                if (!returnItemsMap.has(item.exchangeId)) {
                    returnItemsMap.set(item.exchangeId, []);
                }
                const items = returnItemsMap.get(item.exchangeId);
                if (items) {
                    items.push(item);
                }
            }

            for (const item of allNewItems) {
                if (!newItemsMap.has(item.exchangeId)) {
                    newItemsMap.set(item.exchangeId, []);
                }
                const items = newItemsMap.get(item.exchangeId);
                if (items) {
                    items.push(item);
                }
            }

            // Map results to expected format
            const data = exchanges.map(row => {
                const exchangeId = row.exchange.id;
                const returnItems = returnItemsMap.get(exchangeId) || [];
                const newItems = newItemsMap.get(exchangeId) || [];

                return {
                    ...row.exchange,
                    store: row.store,
                    processor: row.processor,
                    originalSale: row.originalSale?.id ? originalSalesMap.get(row.originalSale.id) || null : null,
                    returnItems: returnItems
                        .map((item) => {
                            const product = productsMap.get(item.productId);
                            return product ? { ...item, product } : null;
                        })
                        .filter((item): item is Exclude<typeof item, null> => item !== null),
                    newItems: newItems
                        .map((item) => {
                            const product = productsMap.get(item.productId);
                            return product ? { ...item, product } : null;
                        })
                        .filter((item): item is Exclude<typeof item, null> => item !== null),
                };
            });

            return { data, total };
        } catch (error) {
            console.error("Error in getAllStoreExchangesPaginated:", error);
            return { data: [], total: 0 };
        }
    }
    async getStoreSalesPaginatedInventory(params: {
        page: number;
        pageSize: number;
        search?: string;
        storeId?: string;
        dateFrom?: string;
        dateTo?: string;
    }): Promise<{
        data: StoreSaleWithItems[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        try {
            const { page, pageSize, search, storeId, dateFrom, dateTo } = params;
            const offset = (page - 1) * pageSize;
            const conditions: any[] = [];
            
            if (search) {
                conditions.push(ilike(storeSales.id, `%${search}%`));
            }

            if (storeId) {
                conditions.push(eq(storeSales.storeId, storeId));
            }
            if (dateFrom) {
                conditions.push(gte(storeSales.createdAt, new Date(dateFrom)));
            }

            if (dateTo) {
                conditions.push(lte(storeSales.createdAt, new Date(dateTo)));
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
            
            // Get total count
            const [countResult] = await db
                .select({ count: sql<number>`count(*)` })
                .from(storeSales)
                .where(whereClause);

            const total = Number(countResult?.count || 0);
            
            // Get sales with store info
            const salesList = await db
                .select({
                    sale: storeSales,
                    store: stores
                })
                .from(storeSales)
                .innerJoin(stores, eq(storeSales.storeId, stores.id))
                .where(whereClause)
                .orderBy(desc(storeSales.createdAt))
                .limit(pageSize)
                .offset(offset);

            // Collect all sale IDs for bulk fetching
            const saleIds = salesList.map(row => row.sale.id);
            
            // Bulk fetch all sale items
            const allSaleItems = saleIds.length > 0
                ? await db
                    .select()
                    .from(storeSaleItems)
                    .where(inArray(storeSaleItems.saleId, saleIds))
                : [];
            
            // Group sale items by sale ID
            const saleItemsMap = new Map<string, typeof storeSaleItems.$inferSelect[]>();
            for (const item of allSaleItems) {
                if (!saleItemsMap.has(item.saleId)) {
                    saleItemsMap.set(item.saleId, []);
                }
                saleItemsMap.get(item.saleId)!.push(item);
            }
            
            // Collect all product IDs
            const allProductIds = new Set<string>();
            allSaleItems.forEach(item => allProductIds.add(item.productId));

            // Fetch all products using roleBasedProductService
            const productsMap = new Map<string, ProductWithDetails>();
            if (allProductIds.size > 0) {
                const products = await roleBasedProductService.getProductsByRole({
                    ids: Array.from(allProductIds)
                },'inventory');
                products.forEach(product => productsMap.set(product.id, product));
            }

            // Build the result with product details
            const result: StoreSaleWithItems[] = salesList.map(row => {
                const items = saleItemsMap.get(row.sale.id) || [];
                
                return {
                    ...row.sale,
                    store: row.store,
                    items: items
                        .map((item) => {
                            const product = productsMap.get(item.productId);
                            return product ? { ...item, product } : null;
                        })
                        .filter((item): item is NonNullable<typeof item> => item !== null),
                };
            });

            return {
                data: result,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            };
        } catch (error) {
            console.error("Error in getStoreSalesPaginatedInventory:", error);
            return {
                data: [],
                total: 0,
                page: params.page,
                pageSize: params.pageSize,
                totalPages: 0,
            };
        }
    }
}

export const allStoreOrdersService = new AllStoreOrdersRepo()