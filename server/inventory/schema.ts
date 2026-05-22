import { z } from "zod";

const storeAllocationSchema = z.object({
  storeId: z.string().min(1, "Store ID is required"),
  quantity: z.number().int().min(0, "Quantity must be a non-negative integer"),
});

const isValidMediaUrl = (url: string): boolean => {
  if (!url || url.trim() === "") return true;
  if (url.startsWith("/objects/")) return true;
  if (url.startsWith("https://images.unsplash.com/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const emptyToNull = z
  .string()
  .transform((val) => (val === "" ? null : val))
  .nullable()
  .optional();

const productVariantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().optional(),
  size: z.string().min(1, "Size is required"),
  price: z.string().or(z.number()).nullable().transform((val) => val ? String(val) : undefined).optional(),
  actualPrice: z.string().or(z.number()).nullable().transform((val) => val ? String(val) : undefined).optional(),
  stockQuantity: z.number().int().min(0, "Stock quantity must be non-negative"),
  onlineStock: z.number().int().min(0, "Online stock must be non-negative"),
  isActive: z.boolean().default(true),
  storeAllocations: z.array(storeAllocationSchema).optional().default([]),
});

export const productBaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z
    .string()
    .or(z.number())
    .transform((val) => String(val)),
  actualPrice: z
    .string()
    .or(z.number())
    .optional()
    .transform((val) => val ? String(val) : undefined),
  categoryId: emptyToNull,
  subcategoryId: emptyToNull,
  colorId: emptyToNull,
  fabricId: emptyToNull,
  imageUrl: z
    .string()
    .optional()
    .transform((val) => (val === "" ? null : val))
    .nullable(),
  images: z
    .array(z.string().refine(isValidMediaUrl, { message: "Invalid image URL" }))
    .optional()
    .default([]),
  videoUrl: z
    .string()
    .optional()
    .transform((val) => (val === "" ? null : val))
    .nullable(),
  sku: z
    .string()
    .optional()
    .transform((val) => (val === "" ? null : val))
    .nullable(),
  totalStock: z.number().int().min(0, "Total stock must be non-negative"),
  onlineStock: z.number().int().min(0, "Online stock must be non-negative"),
  distributionChannel: z.enum(["shop", "online", "both"]),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  careInstructions: z.string().max(500, "Care instructions must be 500 characters or less").optional(),
  // Variant support fields
  hasVariants: z.boolean().default(false),
  variants: z.array(productVariantSchema).optional().default([]),
  storeAllocations: z.array(storeAllocationSchema).optional().default([]),
  // SEO fields
  seoData: z.object({
    seoTitle: z.string().max(60, "SEO title must be 60 characters or less").optional(),
    seoDescription: z.string().max(160, "SEO description must be 160 characters or less").optional(),
    seoKeywords: z.string().max(500, "SEO keywords must be 500 characters or less").optional(),
    metaTags: z.string().max(500, "Meta tags must be 500 characters or less").optional(),
    urlSlug: z.string().max(255, "URL slug must be 255 characters or less")
      .regex(/^[a-z0-9-]+$/, "URL slug can only contain lowercase letters, numbers, and hyphens")
      .optional(),
  }).optional(),
});

export const trackingNumberSchema = z.object({
  trackingNumber: z
    .string()
    .transform((val) => val.trim())
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

export const productUpdateSchema = productBaseSchema.partial().extend({
  variants: z.array(productVariantSchema).optional().default([]),
  storeAllocations: z.array(storeAllocationSchema).optional().default([]),
});

// SEO Schema for separate table
export const productSeoSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  seoTitle: z.string().max(60, "SEO title must be 60 characters or less").optional(),
  seoDescription: z.string().max(160, "SEO description must be 160 characters or less").optional(),
  seoKeywords: z.string().max(500, "SEO keywords must be 500 characters or less").optional(),
  metaTags: z.string().max(500, "Meta tags must be 500 characters or less").optional(),
  urlSlug: z.string().max(255, "URL slug must be 255 characters or less")
    .regex(/^[a-z0-9-]+$/, "URL slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
});