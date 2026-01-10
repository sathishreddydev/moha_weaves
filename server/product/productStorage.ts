import {
  ProductWithDetails,
  products,
  categories,
  colors,
  fabrics,
  InsertProduct,
  product,
  sales,
  saleProducts,
} from "@shared/schema";
import { eq, and, or, ilike, gte, lte, desc, asc, inArray } from "drizzle-orm";
import { db } from "server/db";

export interface IproductRepository {
  getProducts(filters?: {
    search?: string;
    category?: string;
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
  createProduct(product: InsertProduct): Promise<product>;
  updateProduct(
    id: string,
    data: Partial<InsertProduct>
  ): Promise<product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  getLowStockProducts(threshold?: number): Promise<ProductWithDetails[]>;
}
export class productRepository {
  async getProducts(filters?: {
    search?: string;
    category?: string;
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
          ilike(products.description, `%${filters.search}%`)
        ) as any
      );
    }
    if (filters?.category) {
      conditions.push(eq(products.categoryId, filters.category));
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
            eq(products.distributionChannel, "both")
          ) as any
        );
      } else if (filters.distributionChannel === "shop") {
        conditions.push(
          or(
            eq(products.distributionChannel, "shop"),
            eq(products.distributionChannel, "both")
          ) as any
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
      .leftJoin(colors, eq(products.colorId, colors.id))
      .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(filters?.limit || 100);

    const productResults = result.map((row) => ({
      ...row.products,
      category: row.categories,
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
          gte(sales.validUntil, now)
        )
      );

    // Get sale products mapping
    const saleProductMappings = await db
      .select()
      .from(saleProducts)
      .where(
        inArray(
          saleProducts.saleId,
          activeSales.map((s) => s.id)
        )
      );

    // Build the results with relationships and sales
    const results: ProductWithDetails[] = productResults.map((product) => {
      // Find applicable sale (product-specific first, then category-wide)
      let applicableSale = null;

      // Check for product-specific sale (sale has this product in saleProducts table)
      const productSaleMapping = saleProductMappings.find(
        (sp) => sp.productId === product.id
      );
      if (productSaleMapping) {
        applicableSale = activeSales.find(
          (s) => s.id === productSaleMapping.saleId
        );
      }

      // Check for category-wide sale if no product-specific sale
      // Only exclude category pricing when THIS product is explicitly mapped to a different sale
      if (!applicableSale && product.categoryId) {
        applicableSale = activeSales.find(
          (s) => s.categoryId === product.categoryId && 
          !saleProductMappings.some(sp => sp.saleId === s.id && sp.productId === product.id)
        );
      }

      // Calculate discounted price using consistent logic across all flows
      let discountedPrice = parseFloat(product.price);
      if (applicableSale) {
        const originalPrice = discountedPrice;
        if (applicableSale.offerType === "percentage" || applicableSale.offerType === "category" || applicableSale.offerType === "flash_sale") {
          const discount = originalPrice * (parseFloat(applicableSale.discountValue) / 100);
          const maxDiscount = applicableSale.maxDiscount 
            ? parseFloat(applicableSale.maxDiscount) 
            : originalPrice; // Cap at price if no maxDiscount
          discountedPrice = originalPrice - Math.min(discount, maxDiscount, originalPrice);
        } else if (applicableSale.offerType === "flat" || applicableSale.offerType === "product") {
          const flatDiscount = Math.min(parseFloat(applicableSale.discountValue), originalPrice);
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
      ? results.filter(r => r.activeSale !== null)
      : results;

    return filteredResults;
  }
async getNewProducts(filters?: {
  search?: string;
  category?: string[]; 
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
        ilike(products.description, `%${filters.search}%`)
      ) as any
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
          eq(products.distributionChannel, "both")
        ) as any
      );
    } else if (filters.distributionChannel === "shop") {
      conditions.push(
        or(
          eq(products.distributionChannel, "shop"),
          eq(products.distributionChannel, "both")
        ) as any
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
    .leftJoin(colors, eq(products.colorId, colors.id))
    .leftJoin(fabrics, eq(products.fabricId, fabrics.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(filters?.limit || 100);

  const productResults = result.map((row) => ({
    ...row.products,
    category: row.categories,
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
        gte(sales.validUntil, now)
      )
    );

  const saleProductMappings = await db
    .select()
    .from(saleProducts)
    .where(
      inArray(
        saleProducts.saleId,
        activeSales.map((s) => s.id)
      )
    );

  const results: ProductWithDetails[] = productResults.map((product) => {
    let applicableSale = null;

    const productSaleMapping = saleProductMappings.find(
      (sp) => sp.productId === product.id
    );
    if (productSaleMapping) {
      applicableSale = activeSales.find(
        (s) => s.id === productSaleMapping.saleId
      );
    }

    if (!applicableSale && product.categoryId) {
      applicableSale = activeSales.find(
        (s) =>
          s.categoryId === product.categoryId &&
          !saleProductMappings.some(
            (sp) => sp.saleId === s.id && sp.productId === product.id
          )
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
          originalPrice
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
  const filteredResults = filters?.sort === "onSale"
    ? results.filter((r) => r.activeSale !== null)
    : results;

  return filteredResults;
}

  async getProduct(id: string): Promise<ProductWithDetails | undefined> {
    const [result] = await db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
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
          gte(sales.validUntil, now)
        )
      );

    // Fetch sale product mappings
    const saleProductMappings = await db.select().from(saleProducts);

    // Find applicable sale (product-specific first, then category-wide)
    let applicableSale = null;

    // Check for product-specific sale
    const productSaleMapping = saleProductMappings.find(
      (sp) => sp.productId === product.id
    );
    if (productSaleMapping) {
      applicableSale = activeSales.find(
        (s) => s.id === productSaleMapping.saleId
      );
    }

    // Check for category-wide sale if no product-specific sale
    // Only exclude category pricing when THIS product is explicitly mapped to a different sale
    if (!applicableSale && product.categoryId) {
      applicableSale = activeSales.find(
        (s) => s.categoryId === product.categoryId && 
        !saleProductMappings.some(sp => sp.saleId === s.id && sp.productId === product.id)
      );
    }

    // Calculate discounted price using consistent logic across all flows
    let discountedPrice = parseFloat(product.price);
    if (applicableSale) {
      const originalPrice = discountedPrice;
      if (applicableSale.offerType === "percentage" || applicableSale.offerType === "category" || applicableSale.offerType === "flash_sale") {
        const discount = originalPrice * (parseFloat(applicableSale.discountValue) / 100);
        const maxDiscount = applicableSale.maxDiscount 
          ? parseFloat(applicableSale.maxDiscount) 
          : originalPrice; // Cap at price if no maxDiscount
        discountedPrice = originalPrice - Math.min(discount, maxDiscount, originalPrice);
      } else if (applicableSale.offerType === "flat" || applicableSale.offerType === "product") {
        const flatDiscount = Math.min(parseFloat(applicableSale.discountValue), originalPrice);
        discountedPrice = originalPrice - flatDiscount;
      }
      discountedPrice = Math.max(0, discountedPrice);
    }

    return {
      ...product,
      category: result.categories,
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

  async createProduct(product: InsertProduct): Promise<product> {
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
    data: Partial<InsertProduct>
  ): Promise<product | undefined> {
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
      .where(and(eq(products.isActive, true), lte(products.totalStock, threshold)))
      .orderBy(asc(products.totalStock));

    return result.map((row) => ({
      ...row.products,
      category: row.categories,
      color: row.colors,
      fabric: row.fabrics,
    }));
  }
}

export const productService = new productRepository();