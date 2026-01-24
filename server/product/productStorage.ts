import {
  ProductWithDetails,
  Product,
  products,
  categories,
  subcategories,
  colors,
  fabrics,
  InsertProduct,
  sales,
  saleProducts,
  stockRequests,
  storeInventory,
  stores,
  productActualPrices,
} from "@shared/schema";
import {
  eq,
  and,
  or,
  ilike,
  gte,
  lte,
  desc,
  asc,
  inArray,
  sql,
} from "drizzle-orm";
import { db } from "server/db";
import { IproductRepository } from "./types";

export class productRepository implements IproductRepository {
  private async getActiveSales() {
    const now = new Date();
    return await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now),
        ),
      );
  }

  // Helper method to fetch sale product mappings (optimized)
  private async getSaleProductMappings(saleIds?: string[]) {
    if (saleIds && saleIds.length > 0) {
      return await db
        .select()
        .from(saleProducts)
        .where(inArray(saleProducts.saleId, saleIds));
    }
    return await db.select().from(saleProducts);
  }

  // Helper method to resolve names to IDs for categories
  private async resolveCategoryNames(names: string[]) {
    if (names.length === 0) return [];
    const result = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.name, names));
    return result.map((c) => c.id);
  }

  // Helper method to resolve names to IDs for subcategories
  private async resolveSubcategoryNames(names: string[]) {
    if (names.length === 0) return [];
    const result = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(inArray(subcategories.name, names));
    return result.map((s) => s.id);
  }

  // Helper method to resolve names to IDs for colors
  private async resolveColorNames(names: string[]) {
    if (names.length === 0) return [];
    const result = await db
      .select({ id: colors.id })
      .from(colors)
      .where(inArray(colors.name, names));
    return result.map((c) => c.id);
  }

  // Helper method to resolve names to IDs for fabrics
  private async resolveFabricNames(names: string[]) {
    if (names.length === 0) return [];
    const result = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(inArray(fabrics.name, names));
    return result.map((f) => f.id);
  }

  // Helper method to find applicable sale for a product
  private findApplicableSale(
    productId: string,
    categoryId: string | null,
    activeSales: any[],
    saleProductMappings: any[],
  ) {
    // Check for product-specific sale
    const productSaleMapping = saleProductMappings.find(
      (sp) => sp.productId === productId,
    );
    let applicableSale = null;
    if (productSaleMapping) {
      applicableSale = activeSales.find(
        (s) => s.id === productSaleMapping.saleId,
      );
    }

    // Check for category-wide sale if no product-specific sale
    if (!applicableSale && categoryId) {
      applicableSale = activeSales.find(
        (s) =>
          s.categoryId === categoryId &&
          !saleProductMappings.some(
            (sp) => sp.saleId === s.id && sp.productId === productId,
          ),
      );
    }

    return applicableSale;
  }

  // Helper method to calculate discounted price
  private calculateDiscountedPrice(originalPrice: number, applicableSale: any) {
    let discountedPrice = originalPrice;
    if (applicableSale) {
      if (
        applicableSale.offerType === "percentage" ||
        applicableSale.offerType === "category" ||
        applicableSale.offerType === "flash_sale"
      ) {
        const discount =
          originalPrice * (parseFloat(applicableSale.discountValue) / 100);
        const maxDiscount = applicableSale.maxDiscount
          ? parseFloat(applicableSale.maxDiscount)
          : originalPrice;
        discountedPrice =
          originalPrice - Math.min(discount, maxDiscount, originalPrice);
      } else if (
        applicableSale.offerType === "flat" ||
        applicableSale.offerType === "product"
      ) {
        const flatDiscount = Math.min(
          parseFloat(applicableSale.discountValue),
          originalPrice,
        );
        discountedPrice = originalPrice - flatDiscount;
      }
      discountedPrice = Math.max(0, discountedPrice);
    }
    return discountedPrice;
  }

  // Helper method to construct active sale object
  private constructActiveSaleObject(applicableSale: any) {
    return applicableSale
      ? {
          id: applicableSale.id,
          name: applicableSale.name,
          offerType: applicableSale.offerType,
          discountValue: applicableSale.discountValue,
          maxDiscount: applicableSale.maxDiscount || undefined,
        }
      : null;
  }

   private async resolveCategoryAndSubcategoryIds(categoryIds: string[]) {
    if (categoryIds.length === 0) return [];

    const categoriesResult = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, categoryIds));

    const selectedCategoryIds = categoriesResult.map((c) => c.id);

    // Get direct subcategories that were passed in the IDs
    const directSubcategoriesResult = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(inArray(subcategories.id, categoryIds));

    const directSubcategoryIds = directSubcategoriesResult.map((s) => s.id);

    // Get subcategories under selected categories
    const expandedSubcategories = selectedCategoryIds.length > 0
      ? await db
          .select({ id: subcategories.id })
          .from(subcategories)
          .where(inArray(subcategories.categoryId, selectedCategoryIds))
      : [];

    return Array.from(
      new Set([...directSubcategoryIds, ...expandedSubcategories.map(s => s.id)]),
    );
  }
  async getNewProducts(filters?: {
    search?: string;
    category?: string[];
    subcategory?: string[];
    color?: string[];
    fabric?: string[];
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    distributionChannel?: "shop" | "online" | "both";
    sort?: string;
    limit?: number;
    onSale?: boolean;
    ids?: string[];
    userRole?: string;
  }): Promise<ProductWithDetails[]> {
    const conditions = [eq(products.isActive, true)];

    // Handle specific product IDs lookup
    if (filters?.ids && filters.ids.length > 0) {
      conditions.push(inArray(products.id, filters.ids));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.description, `%${filters.search}%`),
        ) as any,
      );
    }

    // Filter by category names - use helper method
    if (filters?.category && filters.category.length > 0) {
      const categoryIds = await this.resolveCategoryNames(filters.category);
      if (categoryIds.length > 0) {
        conditions.push(inArray(products.categoryId, categoryIds));
      }
    }

    // Filter by color names - use helper method
    if (filters?.color && filters.color.length > 0) {
      const colorIds = await this.resolveColorNames(filters.color);
      if (colorIds.length > 0) {
        conditions.push(inArray(products.colorId, colorIds));
      }
    }

    // Filter by subcategory names - use helper method
    if (filters?.subcategory && filters.subcategory.length > 0) {
      const subcategoryIds = await this.resolveSubcategoryNames(filters.subcategory);
      if (subcategoryIds.length > 0) {
        conditions.push(inArray(products.subcategoryId, subcategoryIds));
      }
    }

    // Filter by fabric names - use helper method
    if (filters?.fabric && filters.fabric.length > 0) {
      const fabricIds = await this.resolveFabricNames(filters.fabric);
      if (fabricIds.length > 0) {
        conditions.push(inArray(products.fabricId, fabricIds));
      }
    }

    if (filters?.featured) {
      conditions.push(eq(products.isFeatured, true));
    }

    if (filters?.minPrice) {
      conditions.push(gte(products.price, filters.minPrice.toString()));
    }

    if (filters?.maxPrice) {
      conditions.push(lte(products.price, filters.maxPrice.toString()));
    }

    if (filters?.distributionChannel) {
      if (filters.distributionChannel === "online") {
        conditions.push(
          or(
            eq(products.distributionChannel, "online"),
            eq(products.distributionChannel, "both"),
          ) as any,
        );
      } else if (filters.distributionChannel === "shop") {
        conditions.push(
          or(
            eq(products.distributionChannel, "shop"),
            eq(products.distributionChannel, "both"),
          ) as any,
        );
      }
    }

    // Sorting
    let orderBy: any = desc(products.createdAt);
    if (filters?.sort === "price-low") orderBy = asc(products.price);
    else if (filters?.sort === "price-high") orderBy = desc(products.price);
    else if (filters?.sort === "name") orderBy = asc(products.name);

    // Query
    const queryResult = await db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(filters?.limit || 100);

    const productResults = queryResult.map((row) => ({
      ...row.products,
      category: row.categories,
      subcategory: row.subcategories,
      color: row.colors,
      fabric: row.fabrics,
    }));

    // --- handle sales using optimized helper methods ---
    const activeSales = await this.getActiveSales();
    const saleProductMappings = await this.getSaleProductMappings(
      activeSales.map((s) => s.id)
    );

    const results: ProductWithDetails[] = productResults.map((product) => {
      const applicableSale = this.findApplicableSale(
        product.id,
        product.categoryId,
        activeSales,
        saleProductMappings,
      );

      const discountedPrice = this.calculateDiscountedPrice(
        parseFloat(product.price),
        applicableSale,
      );

      const productResult: any = {
        ...product,
        activeSale: this.constructActiveSaleObject(applicableSale),
        discountedPrice: applicableSale ? discountedPrice : undefined,
      };

      return productResult;
    });

    // Apply onSale filter
    const filteredResults =
      filters?.onSale || filters?.sort === "onSale"
        ? results.filter((r) => r.activeSale !== null)
        : results;

    return filteredResults;
  }

  async getProduct(
    id: string,
    userRole?: string,
  ): Promise<ProductWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(eq(products.id, id));

    if (!result) return undefined;

    const product = result.products;

    // Fetch active sales and mappings using optimized helper methods
    const activeSales = await this.getActiveSales();
    const saleProductMappings = await this.getSaleProductMappings(
      activeSales.map((s) => s.id)
    );

    // Find applicable sale using helper method
    const applicableSale = this.findApplicableSale(
      product.id,
      product.categoryId,
      activeSales,
      saleProductMappings,
    );

    // Calculate discounted price using helper method
    const discountedPrice = this.calculateDiscountedPrice(
      parseFloat(product.price),
      applicableSale,
    );

    const productResult: any = {
      ...product,
      category: result.categories,
      subcategory: result.subcategories,
      color: result.colors,
      fabric: result.fabrics,
      activeSale: this.constructActiveSaleObject(applicableSale),
      discountedPrice: applicableSale ? discountedPrice : undefined,
    };


    return productResult;
  }

  async getProductBySku(
    sku: string,
    userRole?: string,
  ): Promise<ProductWithDetails | undefined> {
    const result = await db
      .select({
        product: products,
        category: categories,
        subcategory: subcategories,
        color: colors,
        fabric: fabrics,
        actualPrice: productActualPrices.actualPrice,
        storeInventory: {
          storeId: storeInventory.storeId,
          quantity: storeInventory.quantity,
          storeName: stores.name,
        },
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .leftJoin(productActualPrices, eq(products.id, productActualPrices.productId))
      .leftJoin(storeInventory, eq(products.id, storeInventory.productId))
      .leftJoin(stores, eq(storeInventory.storeId, stores.id))
      .where(eq(products.sku, sku));

    if (result.length === 0) return undefined;

    // Group store allocations by product ID
    const productMap = new Map<string, any>();
    
    for (const row of result) {
      const productId = row.product.id;
      
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          ...row.product,
          category: row.category,
          subcategory: row.subcategory,
          color: row.color,
          fabric: row.fabric,
          actualPrice: row.actualPrice || null,
          storeAllocations: [],
        });
      }
      
      // Add store allocation if it exists
      if (row.storeInventory.storeId) {
        const product = productMap.get(productId);
        product.storeAllocations.push({
          storeId: row.storeInventory.storeId,
          storeName: row.storeInventory.storeName || "Unknown",
          quantity: row.storeInventory.quantity,
        });
      }
    }

    // Calculate unallocated stock and format final result
    const productList = Array.from(productMap.values()).map((product) => {
      const totalStoreStock = product.storeAllocations.reduce(
        (sum: any, alloc: any) => sum + alloc.quantity,
        0,
      );
      const unallocated = Math.max(
        0,
        product.totalStock - product.onlineStock - totalStoreStock,
      );
      
      return {
        ...product,
        unallocated,
      };
    });

    const productData = productList[0];

    // Fetch active sales and mappings using optimized helper methods
    const activeSales = await this.getActiveSales();
    const saleProductMappings = await this.getSaleProductMappings(
      activeSales.map((s) => s.id)
    );

    // Find applicable sale using helper method
    const applicableSale = this.findApplicableSale(
      productData.id,
      productData.categoryId,
      activeSales,
      saleProductMappings,
    );

    // Calculate discounted price using helper method
    const discountedPrice = this.calculateDiscountedPrice(
      parseFloat(productData.price),
      applicableSale,
    );

    const productResult: any = {
      ...productData,
      activeSale: this.constructActiveSaleObject(applicableSale),
      discountedPrice: applicableSale ? discountedPrice : undefined,
    };

    return productResult;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    // Auto-generate SKU if not provided: MH-YYYYMMDD-XXXXX (timestamp + random suffix)
    let productData = product;
    if (!product.sku) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();
      const generatedSku = `MH-${dateStr}-${randomSuffix}`;
      productData = { ...product, sku: generatedSku };
    }
    const [result] = await db.insert(products).values(productData).returning();
    return result;
  }

  async updateProduct(
    id: string,
    data: Partial<InsertProduct>,
  ): Promise<Product | undefined> {
    const [result] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return result || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const [result] = await db
      .update(products)
      .set({ isActive: false })
      .where(eq(products.id, id))
      .returning();
    return !!result;
  }
  async getLowStockProducts(threshold = 10): Promise<ProductWithDetails[]> {
    const result = await db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(
        and(eq(products.isActive, true), lte(products.totalStock, threshold)),
      )
      .orderBy(asc(products.totalStock));

    return result.map((row) => ({
      ...row.products,
      category: row.categories,
      color: row.colors,
      fabric: row.fabrics,
    }));
  }
  async getShopProductsPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      categoryIds?: string[];
      colorIds?: string[];
      fabricIds?: string[];
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{
    data: {
      product: ProductWithDetails;
      storeStock: number;
      stockRequests: any[];
    }[];
    total: number;
    totalProducts?: number;
    inStockProducts?: number;
    outOfStockProducts?: number;
  }> {
    const conditions = [eq(storeInventory.storeId, storeId)];

    // Filter by search term (product name or SKU)
    if (options.search) {
      conditions.push(
        or(
          ilike(products.name, `%${options.search}%`),
          ilike(products.sku, `%${options.search}%`),
        )!,
      );
    }
    const incomingIds: string[] = options.categoryIds ?? [];

    const finalSubcategoryIds = await this.resolveCategoryAndSubcategoryIds(incomingIds);
    
    if (finalSubcategoryIds.length) {
      conditions.push(inArray(products.subcategoryId, finalSubcategoryIds));
    }

    if (options.colorIds?.length) {
      conditions.push(inArray(products.colorId, options.colorIds));
    }

    if (options.fabricIds?.length) {
      conditions.push(inArray(products.fabricId, options.fabricIds));
    }

    // Date filters (based on product creation date)
    if (options.dateFrom) {
      conditions.push(gte(products.createdAt, new Date(options.dateFrom)));
    }

    if (options.dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(options.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(products.createdAt, endDate));
    }

    const whereClause = and(...conditions);

    const [allProducts, countResult] = await Promise.all([
      db
        .select()
        .from(storeInventory)
        .innerJoin(products, eq(storeInventory.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
        .leftJoin(colors, eq(products.colorId, colors.id))
        .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
        .where(whereClause)
        .orderBy(desc(products.createdAt))
        .limit(options.limit)
        .offset(options.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(storeInventory)
        .innerJoin(products, eq(storeInventory.productId, products.id))
        .where(whereClause),
    ]);

    // Fetch active sales and mappings using optimized helper methods
    const activeSales = await this.getActiveSales();
    const saleProductMappings = await this.getSaleProductMappings(
      activeSales.map((s) => s.id)
    );

    // Fetch stock requests for all products in the result (batch query - efficient)
    const productIds = allProducts.map((row) => row.products.id);
    const stockRequestsData =
      productIds.length > 0
        ? await db
            .select()
            .from(stockRequests)
            .innerJoin(stores, eq(stockRequests.storeId, stores.id))
            .where(
              and(
                eq(stockRequests.storeId, storeId),
                inArray(stockRequests.productId, productIds),
              ),
            )
            .orderBy(desc(stockRequests.createdAt))
        : [];

    // Group stock requests by product ID for efficient lookup
    const stockRequestsByProduct = stockRequestsData.reduce(
      (acc, row) => {
        const productId = row.stock_requests.productId;
        if (!acc[productId]) {
          acc[productId] = [];
        }
        // Only include essential fields that frontend needs
        acc[productId].push({
          ...row.stock_requests,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    const data = allProducts.map((row) => {
      const product = row.products;

      // Find applicable sale using helper method
      const applicableSale = this.findApplicableSale(
        product.id,
        product.categoryId,
        activeSales,
        saleProductMappings,
      );

      // Calculate discounted price using helper method
      const discountedPrice = this.calculateDiscountedPrice(
        parseFloat(product.price),
        applicableSale,
      );

      return {
        product: {
          ...product,
          category: row.categories,
          subcategory: row.subcategories,
          color: row.colors,
          fabric: row.fabrics,
          activeSale: this.constructActiveSaleObject(applicableSale),
          discountedPrice: applicableSale ? discountedPrice : undefined,
        },
        storeStock: row.store_inventory.quantity,
        stockRequests: stockRequestsByProduct[product.id] || [],
      };
    });

    const allProductsStats = await db
      .select({
        totalProducts: sql<number>`COUNT(*)::int`,
        inStockProducts: sql<number>`
        COUNT(*) FILTER (WHERE ${storeInventory.quantity} > 0)::int
      `,
        outOfStockProducts: sql<number>`
        COUNT(*) FILTER (WHERE ${storeInventory.quantity} = 0)::int
      `,
      })
      .from(storeInventory)
      .where(eq(storeInventory.storeId, storeId));

    const stats = allProductsStats[0] ?? {
      totalProducts: 0,
      inStockProducts: 0,
      outOfStockProducts: 0,
    };

    return {
      data,
      total: countResult[0]?.count || 0,
      totalProducts: stats.totalProducts,
      inStockProducts: stats.inStockProducts,
      outOfStockProducts: stats.outOfStockProducts,
    };
  }
  async getProductsPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    categoryIds?: string[];
    colorIds?: string[];
    fabricIds?: string[];
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    userRole?: string;
  }): Promise<{
    data: ProductWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const {
      page,
      pageSize,
      search,
      categoryIds,
      colorIds,
      fabricIds,
      status,
      dateFrom,
      dateTo,
    } = params;
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];

    if (status !== "inactive") {
      conditions.push(eq(products.isActive, true));
    }

    if (status === "active") {
      conditions.push(eq(products.isActive, true));
    } else if (status === "inactive") {
      conditions.push(eq(products.isActive, false));
    }

    if (dateFrom) {
      conditions.push(gte(products.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(products.createdAt, new Date(dateTo)));
    }

    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.description, `%${search}%`),
        ),
      );
    }
    const finalSubcategoryIds = await this.resolveCategoryAndSubcategoryIds(categoryIds ?? []);

    if (finalSubcategoryIds.length) {
      conditions.push(inArray(products.subcategoryId, finalSubcategoryIds));
    }

    if (colorIds?.length) {
      conditions.push(inArray(products.colorId, colorIds));
    }

    if (fabricIds?.length) {
      conditions.push(inArray(products.fabricId, fabricIds));
    }
    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const result = await db
      .select({
        product: products,
        category: categories,
        subcategory: subcategories,
        color: colors,
        fabric: fabrics,
        actualPrice: productActualPrices.actualPrice,
        storeInventory: {
          storeId: storeInventory.storeId,
          quantity: storeInventory.quantity,
          storeName: stores.name,
        },
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .leftJoin(productActualPrices, eq(products.id, productActualPrices.productId))
      .leftJoin(storeInventory, eq(products.id, storeInventory.productId))
      .leftJoin(stores, eq(storeInventory.storeId, stores.id))
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset(offset);

    const productMap = new Map<string, any>();
    
    for (const row of result) {
      const productId = row.product.id;
      
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          ...row.product,
          category: row.category,
          subcategory: row.subcategory,
          color: row.color,
          fabric: row.fabric,
          actualPrice: row.actualPrice || null,
          storeAllocations: [],
        });
      }
      
      // Add store allocation if it exists
      if (row.storeInventory.storeId) {
        const product = productMap.get(productId);
        product.storeAllocations.push({
          storeId: row.storeInventory.storeId,
          storeName: row.storeInventory.storeName || "Unknown",
          quantity: row.storeInventory.quantity,
        });
      }
    }

    // Calculate unallocated stock and format final result
    const productList = Array.from(productMap.values()).map((product) => {
      const totalStoreStock = product.storeAllocations.reduce(
        (sum:any, alloc:any) => sum + alloc.quantity,
        0,
      );
      const unallocated = Math.max(
        0,
        product.totalStock - product.onlineStock - totalStoreStock,
      );
      
      return {
        ...product,
        unallocated,
      };
    });

    return {
      data: productList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const productService = new productRepository();
