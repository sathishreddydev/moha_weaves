import { Product, InsertProduct } from "@shared/schema";

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
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(
    id: string,
    data: Partial<InsertProduct>,
  ): Promise<Product | undefined>;
  deleteProducts(id: string[]): Promise<string[]>;
}