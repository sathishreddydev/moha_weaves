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
  storeAllocations: z.array(storeAllocationSchema).optional().default([]),
});

export const trackingNumberSchema = z.object({
  trackingNumber: z
    .string()
    .transform((val) => val.trim())
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});