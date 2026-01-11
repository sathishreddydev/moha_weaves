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

export interface IproductRepository {
  getProducts(filters?: {
    search?: string;
    category?: string;
    subcategory?: string;
    color?: string;
    fabric?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    distributionChannel?: string;
    sort?: string;
    limit?: number;
    onSale?: boolean;
  }): Promise<ProductWithDetails[]>;
  getProduct(id: string): Promise<ProductWithDetails | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(
    id: string,
    data: Partial<InsertProduct>,
  ): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  getLowStockProducts(threshold?: number): Promise<ProductWithDetails[]>;
  getShopProductsPaginated(
    storeId: string,
    options: {
      limit: number;
      offset: number;
      search?: string;
      categoryId?: string[];
      colorId?: string[];
      fabricId?: string[];
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{
    data: { product: ProductWithDetails; storeStock: number }[];
    total: number;
    totalProducts?: number;
    inStockProducts?: number;
    outOfStockProducts?: number;
  }>;
  getProductsPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    categoriesFilters?: { id: string; subcategories?: { id: string }[] }[];
    colorsFilters?: { id: string }[];
    fabricsFilters?: { id: string }[];
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: ProductWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
}
export class productRepository {
  async getProducts(filters?: {
    search?: string;
    category?: string;
    subcategory?: string;
    color?: string;
    fabric?: string;
    featured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    distributionChannel?: string;
    sort?: string;
    limit?: number;
    onSale?: boolean;
  }): Promise<ProductWithDetails[]> {
    const conditions = [eq(products.isActive, true)];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.description, `%${filters.search}%`),
        ) as any,
      );
    }
    if (filters?.category) {
      conditions.push(eq(products.categoryId, filters.category));
    }
    if (filters?.subcategory) {
      conditions.push(eq(products.subcategoryId, filters.subcategory));
    }
    if (filters?.color) {
      conditions.push(eq(products.colorId, filters.color));
    }
    if (filters?.fabric) {
      conditions.push(eq(products.fabricId, filters.fabric));
    }
    if (filters?.sort === "featured") {
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

    let orderBy: any = desc(products.createdAt);
    if (filters?.sort === "price-low") {
      orderBy = asc(products.price);
    } else if (filters?.sort === "price-high") {
      orderBy = desc(products.price);
    } else if (filters?.sort === "name") {
      orderBy = asc(products.name);
    }

    const result = await db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(filters?.limit || 100);

    const productResults = result.map((row) => ({
      ...row.products,
      category: row.categories,
      subcategory: row.subcategories,
      color: row.colors,
      fabric: row.fabrics,
    }));

    // Get active sales
    const now = new Date();
    const activeSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now),
        ),
      );

    // Get sale products mapping
    const saleProductMappings = await db
      .select()
      .from(saleProducts)
      .where(
        inArray(
          saleProducts.saleId,
          activeSales.map((s) => s.id),
        ),
      );

    // Build the results with relationships and sales
    const results: ProductWithDetails[] = productResults.map((product) => {
      // Find applicable sale (product-specific first, then category-wide)
      let applicableSale = null;

      // Check for product-specific sale (sale has this product in saleProducts table)
      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.productId === product.id,
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId,
        );
      }

      // Check for category-wide sale if no product-specific sale
      // Only exclude category pricing when THIS product is explicitly mapped to a different sale
      if (!applicableSale && product.categoryId) {
        applicableSale = activeSales.find(
          (s) =>
            s.categoryId === product.categoryId &&
            !saleProductMappings.some(
              (sp) => sp.saleId === s.id && sp.productId === product.id,
            ),
        );
      }

      // Calculate discounted price using consistent logic across all flows
      let discountedPrice = parseFloat(product.price);
      if (applicableSale) {
        const originalPrice = discountedPrice;
        if (
          applicableSale.offerType === "percentage" ||
          applicableSale.offerType === "category" ||
          applicableSale.offerType === "flash_sale"
        ) {
          const discount =
            originalPrice * (parseFloat(applicableSale.discountValue) / 100);
          const maxDiscount = applicableSale.maxDiscount
            ? parseFloat(applicableSale.maxDiscount)
            : originalPrice; // Cap at price if no maxDiscount
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

      return {
        ...product,
        activeSale: applicableSale
          ? {
              id: applicableSale.id,
              name: applicableSale.name,
              offerType: applicableSale.offerType,
              discountValue: applicableSale.discountValue,
              maxDiscount: applicableSale.maxDiscount || undefined,
            }
          : null,
        discountedPrice: applicableSale ? discountedPrice : undefined,
      };
    });

    // Apply onSale filter if requested
    const filteredResults = filters?.onSale
      ? results.filter((r) => r.activeSale !== null)
      : results;

    return filteredResults;
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
    distributionChannel?: string;
    sort?: string;
    limit?: number;
    onSale?: boolean;
  }): Promise<ProductWithDetails[]> {
    const conditions = [eq(products.isActive, true)];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.description, `%${filters.search}%`),
        ) as any,
      );
    }

    // Filter by category names - look up IDs from names
    if (filters?.category && filters.category.length > 0) {
      const matchingCategories = await db
        .select({ id: categories.id })
        .from(categories)
        .where(inArray(categories.name, filters.category));
      const categoryIds = matchingCategories.map((c) => c.id);
      if (categoryIds.length > 0) {
        conditions.push(inArray(products.categoryId, categoryIds));
      }
    }

    // Filter by color names - look up IDs from names
    if (filters?.color && filters.color.length > 0) {
      const matchingColors = await db
        .select({ id: colors.id })
        .from(colors)
        .where(inArray(colors.name, filters.color));
      const colorIds = matchingColors.map((c) => c.id);
      if (colorIds.length > 0) {
        conditions.push(inArray(products.colorId, colorIds));
      }
    }

    // Filter by subcategory names - look up IDs from names
    if (filters?.subcategory && filters.subcategory.length > 0) {
      const matchingSubcategories = await db
        .select({ id: subcategories.id })
        .from(subcategories)
        .where(inArray(subcategories.name, filters.subcategory));
      const subcategoryIds = matchingSubcategories.map((s) => s.id);
      if (subcategoryIds.length > 0) {
        conditions.push(inArray(products.subcategoryId, subcategoryIds));
      }
    }

    // Filter by fabric names - look up IDs from names
    if (filters?.fabric && filters.fabric.length > 0) {
      const matchingFabrics = await db
        .select({ id: fabrics.id })
        .from(fabrics)
        .where(inArray(fabrics.name, filters.fabric));
      const fabricIds = matchingFabrics.map((f) => f.id);
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
    const result = await db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(filters?.limit || 100);

    const productResults = result.map((row) => ({
      ...row.products,
      category: row.categories,
      subcategory: row.subcategories,
      color: row.colors,
      fabric: row.fabrics,
    }));

    // --- handle sales as before ---
    const now = new Date();
    const activeSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now),
        ),
      );

    const saleProductMappings = await db
      .select()
      .from(saleProducts)
      .where(
        inArray(
          saleProducts.saleId,
          activeSales.map((s) => s.id),
        ),
      );

    const results: ProductWithDetails[] = productResults.map((product) => {
      let applicableSale = null;

      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.productId === product.id,
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId,
        );
      }

      if (!applicableSale && product.categoryId) {
        applicableSale = activeSales.find(
          (s) =>
            s.categoryId === product.categoryId &&
            !saleProductMappings.some(
              (sp) => sp.saleId === s.id && sp.productId === product.id,
            ),
        );
      }

      let discountedPrice = parseFloat(product.price);
      if (applicableSale) {
        const originalPrice = discountedPrice;
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

      return {
        ...product,
        activeSale: applicableSale
          ? {
              id: applicableSale.id,
              name: applicableSale.name,
              offerType: applicableSale.offerType,
              discountValue: applicableSale.discountValue,
              maxDiscount: applicableSale.maxDiscount || undefined,
            }
          : null,
        discountedPrice: applicableSale ? discountedPrice : undefined,
      };
    });

    // Apply onSale filter
    const filteredResults =
      filters?.sort === "onSale"
        ? results.filter((r) => r.activeSale !== null)
        : results;

    return filteredResults;
  }

  async getProduct(id: string): Promise<ProductWithDetails | undefined> {
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

    // Fetch active sales
    const now = new Date();
    const activeSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now),
        ),
      );

    // Fetch sale product mappings
    const saleProductMappings = await db.select().from(saleProducts);

    // Find applicable sale (product-specific first, then category-wide)
    let applicableSale = null;

    // Check for product-specific sale
    const productSaleMapping = saleProductMappings.find(
      (sp) => sp.productId === product.id,
    );
    if (productSaleMapping) {
      applicableSale = activeSales.find(
        (s) => s.id === productSaleMapping.saleId,
      );
    }

    // Check for category-wide sale if no product-specific sale
    if (!applicableSale && product.categoryId) {
      applicableSale = activeSales.find(
        (s) =>
          s.categoryId === product.categoryId &&
          !saleProductMappings.some(
            (sp) => sp.saleId === s.id && sp.productId === product.id,
          ),
      );
    }

    // Calculate discounted price using consistent logic across all flows
    let discountedPrice = parseFloat(product.price);
    if (applicableSale) {
      const originalPrice = discountedPrice;
      if (
        applicableSale.offerType === "percentage" ||
        applicableSale.offerType === "category" ||
        applicableSale.offerType === "flash_sale"
      ) {
        const discount =
          originalPrice * (parseFloat(applicableSale.discountValue) / 100);
        const maxDiscount = applicableSale.maxDiscount
          ? parseFloat(applicableSale.maxDiscount)
          : originalPrice; // Cap at price if no maxDiscount
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

    return {
      ...product,
      category: result.categories,
      subcategory: result.subcategories,
      color: result.colors,
      fabric: result.fabrics,
      activeSale: applicableSale
        ? {
            id: applicableSale.id,
            name: applicableSale.name,
            offerType: applicableSale.offerType,
            discountValue: applicableSale.discountValue,
            maxDiscount: applicableSale.maxDiscount || undefined,
          }
        : null,
      discountedPrice: applicableSale ? discountedPrice : undefined,
    };
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

    const categoriesResult = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, incomingIds));

    const categoryIds = categoriesResult.map((c) => c.id);

    const subcategoriesResult = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(inArray(subcategories.id, incomingIds));

    const directSubcategoryIds = subcategoriesResult.map((s) => s.id);

    const expandedSubcategories = categoryIds.length
      ? await db
          .select({ id: subcategories.id })
          .from(subcategories)
          .where(inArray(subcategories.categoryId, categoryIds))
      : [];

    const expandedSubcategoryIds = expandedSubcategories.map((s) => s.id);

    const finalSubcategoryIds = Array.from(
      new Set([...directSubcategoryIds, ...expandedSubcategoryIds]),
    );
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

    // Fetch active sales
    const now = new Date();
    const activeSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.isActive, true),
          lte(sales.validFrom, now),
          gte(sales.validUntil, now),
        ),
      );

    // Fetch sale product mappings
    const saleProductMappings = await db.select().from(saleProducts);

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

      // Find applicable sale
      let applicableSale = null;
      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.productId === product.id,
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId,
        );
      }
      // Only exclude category pricing when THIS product is explicitly mapped to a different sale
      if (!applicableSale && product.categoryId) {
        applicableSale = activeSales.find(
          (s) =>
            s.categoryId === product.categoryId &&
            !saleProductMappings.some(
              (sp) => sp.saleId === s.id && sp.productId === product.id,
            ),
        );
      }

      // Calculate discounted price using consistent logic across all flows
      let discountedPrice = parseFloat(product.price);
      if (applicableSale) {
        const originalPrice = discountedPrice;
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

      return {
        product: {
          ...product,
          category: row.categories,
          subcategory: row.subcategories,
          color: row.colors,
          fabric: row.fabrics,
          activeSale: applicableSale
            ? {
                id: applicableSale.id,
                name: applicableSale.name,
                offerType: applicableSale.offerType,
                discountValue: applicableSale.discountValue,
                maxDiscount: applicableSale.maxDiscount || undefined,
              }
            : null,
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
    const incomingIds: string[] = categoryIds ?? [];

    const categoriesResult = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, incomingIds));

    const selectedCategoryIds = categoriesResult.map((c) => c.id);

    const subcategoriesResult = await db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(inArray(subcategories.id, incomingIds));

    const directSubcategoryIds = subcategoriesResult.map((s) => s.id);

    const expandedSubcategories = selectedCategoryIds.length
      ? await db
          .select({ id: subcategories.id })
          .from(subcategories)
          .where(inArray(subcategories.categoryId, selectedCategoryIds))
      : [];

    const expandedSubcategoryIds = expandedSubcategories.map((s) => s.id);

    const finalSubcategoryIds = Array.from(
      new Set([...directSubcategoryIds, ...expandedSubcategoryIds]),
    );
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
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset(offset);

    const productList = await Promise.all(
      result.map(async (row) => {
        const allocations = await db
          .select({
            storeId: storeInventory.storeId,
            quantity: storeInventory.quantity,
          })
          .from(storeInventory)
          .where(eq(storeInventory.productId, row.products.id));

        const storeAllocations = await Promise.all(
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
          }),
        );

        const totalStoreStock = storeAllocations.reduce(
          (sum, alloc) => sum + alloc.quantity,
          0,
        );
        const unallocated = Math.max(
          0,
          row.products.totalStock - row.products.onlineStock - totalStoreStock,
        );

        return {
          ...row.products,
          category: row.categories,
          subcategory: row.subcategories,
          color: row.colors,
          fabric: row.fabrics,
          storeAllocations,
          unallocated,
        };
      }),
    );

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
