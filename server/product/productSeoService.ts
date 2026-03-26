import { db } from "../db";
import { productSeoSchema } from "../inventory/schema";
import { eq, and, inArray } from "drizzle-orm";
import { productSeo } from "@shared/schema";

export interface ProductSEOData {
  productId: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  metaTags?: string;
  urlSlug?: string;
}

export interface ProductSEOWithId {
  id: string;
  productId: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  metaTags: string | null;
  urlSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Create or update SEO data for a product
export async function createOrUpdateProductSEO(data: ProductSEOData): Promise<ProductSEOWithId> {
  try {
    // Check if SEO data already exists for this product
    const existingSEO = await db
      .select()
      .from(productSeo)
      .where(eq(productSeo.productId, data.productId))
      .limit(1);

    if (existingSEO.length > 0) {
      // Update existing SEO data
      const updatedSEO = await db
        .update(productSeo)
        .set({
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          seoKeywords: data.seoKeywords,
          metaTags: data.metaTags,
          urlSlug: data.urlSlug,
          updatedAt: new Date(),
        })
        .where(eq(productSeo.productId, data.productId))
        .returning();

      return Array.isArray(updatedSEO) ? updatedSEO[0] : updatedSEO;
    } else {
      // Create new SEO data
      const newSEO = await db
        .insert(productSeo)
        .values({
          productId: data.productId,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          seoKeywords: data.seoKeywords,
          metaTags: data.metaTags,
          urlSlug: data.urlSlug,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return Array.isArray(newSEO) ? newSEO[0] : newSEO;
    }
  } catch (error) {
    console.error("Error creating/updating product SEO:", error);
    throw new Error("Failed to save SEO data");
  }
}

// Get SEO data for a specific product
export async function getProductSEO(productId: string): Promise<ProductSEOWithId | null> {
  try {
    const [seoData] = await db
      .select()
      .from(productSeo)
      .where(eq(productSeo.productId, productId))
      .limit(1);

    return seoData || null;
  } catch (error) {
    console.error("Error fetching product SEO:", error);
    throw new Error("Failed to fetch SEO data");
  }
}

// Get SEO data for multiple products
export async function getProductsSEO(productIds: string[]): Promise<ProductSEOWithId[]> {
  try {
    return await db
      .select()
      .from(productSeo)
      .where(inArray(productSeo.productId, productIds));
  } catch (error) {
    console.error("Error fetching products SEO:", error);
    throw new Error("Failed to fetch SEO data");
  }
}

// Delete SEO data for a product
export async function deleteProductSEO(productId: string): Promise<void> {
  try {
    await db
      .delete(productSeo)
      .where(eq(productSeo.productId, productId));
  } catch (error) {
    console.error("Error deleting product SEO:", error);
    throw new Error("Failed to delete SEO data");
  }
}

// Generate auto SEO data from product information
export function generateAutoSEO(product: {
  name: string;
  description?: string;
  category?: string;
  color?: string;
  fabric?: string;
}): Omit<ProductSEOData, 'productId'> {
  const productName = product.name || '';
  const description = product.description || '';
  
  // Generate SEO title (product name + key attributes)
  const seoTitle = `${productName}${product.color ? ` - ${product.color}` : ''}${product.fabric ? ` - ${product.fabric}` : ''}`;
  
  // Generate SEO description (product description + key details)
  const seoDescription = description || 
    `Buy ${productName}${product.color ? ` in ${product.color}` : ''}${product.fabric ? ` made from ${product.fabric}` : ''}. High quality ${product.category || 'clothing'} with excellent craftsmanship.`;
  
  // Generate keywords (product name + attributes + category)
  const keywords = [
    productName.toLowerCase(),
    product.color?.toLowerCase() || '',
    product.fabric?.toLowerCase() || '',
    product.category?.toLowerCase() || '',
    'quality clothing',
    'premium fabric'
  ].filter(Boolean).join(', ');
  
  // Generate meta tags
  const metaTags = [
    product.color?.toLowerCase() || '',
    product.fabric?.toLowerCase() || '',
    product.category?.toLowerCase() || '',
    'in stock',
    'free shipping'
  ].filter(Boolean).join(', ');
  
  // Generate URL slug
  const urlSlug = productName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();

  return {
    seoTitle,
    seoDescription,
    seoKeywords: keywords,
    metaTags,
    urlSlug,
  };
}

// Validate SEO data
export function validateSEOData(data: ProductSEOData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (data.seoTitle && data.seoTitle.length > 60) {
    errors.push("SEO title must be 60 characters or less");
  }
  
  if (data.seoDescription && data.seoDescription.length > 160) {
    errors.push("SEO description must be 160 characters or less");
  }
  
  if (data.seoKeywords && data.seoKeywords.length > 500) {
    errors.push("SEO keywords must be 500 characters or less");
  }
  
  if (data.metaTags && data.metaTags.length > 500) {
    errors.push("Meta tags must be 500 characters or less");
  }
  
  if (data.urlSlug && data.urlSlug.length > 255) {
    errors.push("URL slug must be 255 characters or less");
  }
  
  if (data.urlSlug && !/^[a-z0-9-]+$/.test(data.urlSlug)) {
    errors.push("URL slug can only contain lowercase letters, numbers, and hyphens");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
