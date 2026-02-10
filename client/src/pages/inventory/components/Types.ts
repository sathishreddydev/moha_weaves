import { Category, Subcategory, Color, Fabric } from "@shared/types";

export interface FiltersData {
    categories: (Category & { subcategories: Subcategory[] })[];
    colors: Color[];
    fabrics: Fabric[];
}

export interface ProductVariant {
  id?: string;
  sku: string;
  size: string;
  stockQuantity: number;
  onlineStock: number;
  storeAllocations: StoreAllocation[];
  isActive: boolean;
  // Backend-only fields (hidden in frontend)
  price?: string;
  actualPrice?: string;
}

export interface ProductFormData {
    name: string;
    description: string;
    price: string;
    actualPrice: string;
    categoryId: string;
    subcategoryId: string;
    colorId: string;
    fabricId: string;
    imageUrl: string;
    images: string[];
    videoUrl: string;
    totalStock: number;
    onlineStock: number;
    distributionChannel: "shop" | "online" | "both";
    isFeatured: boolean;
    isActive: boolean;
    // New variant fields
    hasVariants: boolean;
    variants: ProductVariant[];
}

export interface StoreAllocation {
  storeId: string;
  storeName: string;
  quantity: number;
}

export interface ProductDialogProps {
  refetch: () => void;
  setEditingProduct: (product: any | null) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  editingProduct: any | null;
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  setStoreAllocations: (allocations: StoreAllocation[] | ((prev: StoreAllocation[]) => StoreAllocation[])) => void;
  storeAllocations: StoreAllocation[];
}