/**
 * Type definitions for store module to reduce 'any' usage
 */

import type { ProductWithDetails } from "@shared/schema";

export interface StoreCartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: string;
  lineAmount: number;
  totalStock: number;
  product?: ProductWithDetails;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoreCartResponse {
  items: StoreCartItem[];
}

export interface StoreInventoryItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  updatedAt: Date;
}

export interface ExchangeValidationItem {
  saleItemId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: string;
  returnAmount: string;
  exchangeType: "normal" | "damage";
  specificReason: string;
  damageImages?: string[];
}

export interface ExchangeNewItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: string;
  lineAmount: string;
}

export interface StoreExchangeData {
  originalSaleId: string;
  returnItems: ExchangeValidationItem[];
  newItems?: ExchangeNewItem[];
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
}
