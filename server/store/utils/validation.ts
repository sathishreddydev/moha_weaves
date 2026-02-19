import { z } from "zod";

/**
 * Validation schemas for store operations
 */

export const exchangeValidationSchema = z.object({
  originalSaleId: z.string().min(1, "Original sale ID is required"),
  returnItems: z.array(
    z.object({
      saleItemId: z.string().min(1, "Sale item ID is required"),
      productId: z.string().min(1, "Product ID is required"),
      variantId: z.string().optional(),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      unitPrice: z.union([z.number().min(0), z.string().min(0)]),
      returnAmount: z.union([z.number().min(0), z.string().min(0)]),
      exchangeType: z.enum(["normal", "damage"]),
      specificReason: z.string().min(1, "Reason is required"),
      damageImages: z.array(z.string()).optional()
    })
  ).min(1, "At least one return item is required"),
  newItems: z.array(
    z.object({
      productId: z.string().min(1, "Product ID is required"),
      variantId: z.string().optional(),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      unitPrice: z.union([z.number().min(0), z.string().min(0)]),
      lineAmount: z.union([z.number().min(0), z.string().min(0)])
    })
  ).optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional()
}).refine((data) => {
  // Calculate total return amount
  const returnAmount = data.returnItems.reduce((sum, item) => {
    return sum + (typeof item.returnAmount === 'string' ? parseFloat(item.returnAmount) : item.returnAmount);
  }, 0);

  // Calculate total new items amount
  const newItemsAmount = data.newItems ? data.newItems.reduce((sum, item) => {
    const lineAmount = typeof item.lineAmount === 'string' ? parseFloat(item.lineAmount) : item.lineAmount;
    return sum + lineAmount;
  }, 0) : 0;

  // Validate business rules
  if (returnAmount <= 0) {
    return false; // Zero-value exchanges not allowed
  }

  if (returnAmount > newItemsAmount) {
    return false; // Unfavorable exchange
  }

  return true;
}, {
  message: "Invalid exchange: Either zero-value exchange or unfavorable exchange detected",
  path: ["businessValidation"]
});

export const saleValidationSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(10, "Valid phone number is required"),
  items: z.array(
    z.object({
      productId: z.string().min(1, "Product ID is required"),
      variantId: z.string().optional(),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      unitPrice: z.number().min(0, "Unit price must be non-negative"),
      lineAmount: z.number().min(0, "Line amount must be non-negative")
    })
  ).min(1, "At least one item is required"),
  discountAmount: z.number().min(0, "Discount amount must be non-negative"),
  taxAmount: z.number().min(0, "Tax amount must be non-negative"),
  totalAmount: z.number().min(0, "Total amount must be non-negative"),
  paymentMode: z.string().min(1, "Payment mode is required")
}).refine((data) => {
  // Validate that total amount matches calculated amount
  const calculatedSubtotal = data.items.reduce((sum, item) => sum + item.lineAmount, 0);
  const calculatedTotal = calculatedSubtotal - data.discountAmount + data.taxAmount;
  
  return Math.abs(calculatedTotal - data.totalAmount) < 0.01; // Allow for floating point precision
}, {
  message: "Total amount does not match calculated amount",
  path: ["totalAmount"]
});

export const cartItemValidationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1").max(100, "Quantity cannot exceed 100"),
  unitPrice: z.number().min(0, "Unit price must be non-negative")
});

export const couponValidationSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50, "Coupon code too long")
});

/**
 * Validation helper functions
 */
export function validateExchange(data: unknown) {
  return exchangeValidationSchema.parse(data);
}

export function validateSale(data: unknown) {
  return saleValidationSchema.parse(data);
}

export function validateCartItem(data: unknown) {
  return cartItemValidationSchema.parse(data);
}

export function validateCoupon(data: unknown) {
  return couponValidationSchema.parse(data);
}
