import { ProductWithDetails, Product, InsertProduct } from "@shared/schema";

export interface IFilters {
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
}

export interface IproductRepository {
  getNewProducts(filters?:IFilters ): Promise<ProductWithDetails[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(
    id: string,
    data: Partial<InsertProduct>,
  ): Promise<Product | undefined>;
  deleteProducts(id: string[]): Promise<string[]>;
  getLowStockProducts(threshold?: number): Promise<ProductWithDetails[]>;
  getShopProductsPaginated(
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
    data: { product: ProductWithDetails; storeStock: number; stockRequests: any[] }[];
    total: number;
    totalProducts?: number;
    inStockProducts?: number;
    outOfStockProducts?: number;
  }>;
  getProductsPaginated(params: {
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
  }>;
}