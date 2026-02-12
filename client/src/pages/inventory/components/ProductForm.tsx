import { CloudinaryUploader } from "@/components/CloudinaryUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Category, Color, Fabric, Subcategory } from "@shared/types";
import { GripVertical, ImageIcon, Video, X } from "lucide-react";
import React, { useState } from "react";
import { ProductFormData, ProductVariant, StoreAllocation } from "./Types";

interface ProductFormProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  editingProduct?: any | null;
  categories: (Category & { subcategories: Subcategory[] })[];
  colors: Color[];
  fabrics: Fabric[];
  storeAllocations: StoreAllocation[];
  setStoreAllocations: (
    allocations:
      | StoreAllocation[]
      | ((prev: StoreAllocation[]) => StoreAllocation[]),
  ) => void;
  createMutation?: any;
  updateMutation?: any;
  handleSubmit: (e: React.FormEvent) => void;
}

export const ProductForm = ({
  formData,
  setFormData,
  editingProduct,
  categories,
  colors,
  fabrics,
  storeAllocations,
  setStoreAllocations,
  createMutation,
  updateMutation,
  handleSubmit,
}: ProductFormProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation functions
  const validateField = (field: string, value: any) => {
    let error = '';
    
    switch (field) {
      case 'name':
        if (!value || value.trim().length < 2) {
          error = 'Product name must be at least 2 characters';
        } else if (value.trim().length > 100) {
          error = 'Product name must be less than 100 characters';
        } else if (!/^[a-zA-Z0-9\s\-]+$/.test(value.trim())) {
          error = 'Product name can only contain letters, numbers, spaces, and hyphens';
        }
        break;
      case 'price':
        const price = parseFloat(value);
        if (!value || isNaN(price) || price < 0) {
          error = 'Selling price must be a positive number';
        } else if (price > 999999) {
          error = 'Price cannot exceed 999,999';
        }
        break;
      case 'actualPrice':
        const actualPrice = parseFloat(value);
        if (!value || isNaN(actualPrice) || actualPrice < 0) {
          error = 'Actual price must be a positive number';
        } else if (actualPrice > 999999) {
          error = 'Price cannot exceed 999,999';
        }
        break;
      case 'totalStock':
        const totalStock = parseInt(value);
        if (isNaN(totalStock) || totalStock < 0) {
          error = 'Total stock must be a non-negative number';
        } else if (totalStock > 99999) {
          error = 'Stock cannot exceed 99,999';
        }
        break;
      case 'onlineStock':
        const onlineStock = parseInt(value);
        if (isNaN(onlineStock) || onlineStock < 0) {
          error = 'Online stock must be a non-negative number';
        } else if (onlineStock > 99999) {
          error = 'Stock cannot exceed 99,999';
        }
        break;
      case 'categoryId':
        if (!value) {
          error = 'Category is required';
        }
        break;
      case 'colorId':
        if (!value) {
          error = 'Color is required';
        }
        break;
      case 'fabricId':
        if (!value) {
          error = 'Fabric is required';
        }
        break;
      case 'subcategoryId':
        if (!value || value === "") {
          error = 'Subcategory is required';
        }
        break;
      case 'images':
        if (!value || value.length === 0) {
          error = 'At least one image is required';
        }
        break;
    }
    
    setErrors(prev => ({ ...prev, [field]: error }));
    return !error;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Basic field validations
    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Product name must be at least 2 characters';
    }
    if (!formData.categoryId) {
      newErrors.categoryId = 'Category is required';
    }
    if (!formData.colorId) {
      newErrors.colorId = 'Color is required';
    }
    if (!formData.fabricId) {
      newErrors.fabricId = 'Fabric is required';
    }
    if (!formData.subcategoryId || formData.subcategoryId === "") {
      newErrors.subcategoryId = 'Subcategory is required';
    }
    if (!formData.images || formData.images.length === 0) {
      newErrors.images = 'At least one image is required';
    }
    
    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price < 0) {
      newErrors.price = 'Selling price must be a positive number';
    }
    
    const actualPrice = parseFloat(formData.actualPrice);
    if (!formData.actualPrice || isNaN(actualPrice) || actualPrice < 0) {
      newErrors.actualPrice = 'Actual price must be a positive number';
    }
    
    // Price relationship validation
    if (price && actualPrice && price < actualPrice) {
      newErrors.price = 'Selling price must be greater than or equal to actual price';
    }
    
    // Stock validation for non-variant products
    if (!formData.hasVariants) {
      const totalStock = parseInt(formData.totalStock.toString());
      const onlineStock = parseInt(formData.onlineStock.toString());
      
      if (isNaN(totalStock) || totalStock < 0) {
        newErrors.totalStock = 'Total stock must be a non-negative number';
      }
      if (isNaN(onlineStock) || onlineStock < 0) {
        newErrors.onlineStock = 'Online stock must be a non-negative number';
      }
    }
    
    // Variant validation
    if (formData.hasVariants) {
      formData.variants.forEach((variant, index) => {
        const stockQuantity = parseInt(variant.stockQuantity.toString());
        const onlineStock = parseInt(variant.onlineStock.toString());
        
        if (isNaN(stockQuantity) || stockQuantity < 0) {
          newErrors[`variants.${index}.stockQuantity`] = 'Stock must be a non-negative number';
        }
        if (isNaN(onlineStock) || onlineStock < 0) {
          newErrors[`variants.${index}.onlineStock`] = 'Online stock must be a non-negative number';
        }
        
        // Validate variant store allocations
        const variantStoreTotal = variant.storeAllocations.reduce((sum, a) => sum + a.quantity, 0);
        const variantExpectedTotal = stockQuantity;
        const variantOnlinePlusStore = onlineStock + variantStoreTotal;
        
        if (variantOnlinePlusStore !== variantExpectedTotal) {
          newErrors[`variants.${index}.allocations`] = `Online (${onlineStock}) + Store allocations (${variantStoreTotal}) must equal total stock (${variantExpectedTotal})`;
        }
        
        // Check distribution channel constraints
        if (formData.distributionChannel === "online" && variantStoreTotal > 0) {
          newErrors[`variants.${index}.channel`] = `Distribution channel is 'Online Only' but has store allocations (${variantStoreTotal})`;
        }
        if (formData.distributionChannel === "shop" && onlineStock > 0) {
          newErrors[`variants.${index}.channel`] = `Distribution channel is 'Shop Only' but has online stock (${onlineStock})`;
        }
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateStoreAllocation = (storeId: string, quantity: number) => {
    const validQuantity = Math.max(0, parseInt(quantity.toString()) || 0);
    setStoreAllocations((prev) =>
      prev.map((a) =>
        a.storeId === storeId ? { ...a, quantity: validQuantity } : a,
      ),
    );
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const draggedImage = formData.images[draggedIndex];
    const newImages = [...formData.images];

    // Remove dragged image from old position
    newImages.splice(draggedIndex, 1);
    // Insert dragged image at new position
    newImages.splice(dropIndex, 0, draggedImage);

    setFormData((prev) => ({ ...prev, images: newImages }));
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Variant management functions
  const getSelectedCategory = () => {
    return categories.find((cat) => cat.id === formData.categoryId);
  };

  const getCategorySizes = () => {
    const category = getSelectedCategory();
    return category?.sizes || [];
  };

  const handleVariantsToggle = (enabled: boolean) => {
    if (enabled && getCategorySizes().length === 0) {
      toast({
        title: "Cannot Enable Variants",
        description:
          "No sizes available for this category. Please select a category with sizes first.",
        variant: "destructive",
      });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      hasVariants: enabled,
      variants: enabled
        ? editingProduct && prev.variants.length > 0
          ? prev.variants // Keep existing variants when editing
          : getCategorySizes().map((size) => ({
              sku: "", // Backend will generate
              size,
              stockQuantity: 0,
              onlineStock: 0,
              storeAllocations: storeAllocations.map((store) => ({
                storeId: store.storeId,
                storeName: store.storeName,
                quantity: 0,
              })),
              isActive: true,
            }))
        : [],
    }));
  };

  const updateVariant = (
    index: number,
    field: keyof ProductVariant,
    value: any,
  ) => {
    // Validate numeric fields
    if (field === 'stockQuantity' || field === 'onlineStock') {
      const numValue = parseInt(value.toString()) || 0;
      if (numValue < 0) return; // Don't allow negative values
      value = numValue;
    }
    
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  };

  const updateVariantStoreAllocation = (
    variantIndex: number,
    storeId: string,
    quantity: number,
  ) => {
    const validQuantity = Math.max(0, parseInt(quantity.toString()) || 0);
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === variantIndex
          ? {
              ...variant,
              storeAllocations: variant.storeAllocations.map((alloc) =>
                alloc.storeId === storeId
                  ? { ...alloc, quantity: validQuantity }
                  : alloc,
              ),
            }
          : variant,
      ),
    }));
  };

  const addVariant = (size: string) => {
    const existingVariant = formData.variants.find((v) => v.size === size);
    if (!existingVariant) {
      setFormData((prev) => ({
        ...prev,
        variants: [
          ...prev.variants,
          {
            sku: "", // Backend will generate
            size,
            stockQuantity: 0,
            onlineStock: 0,
            storeAllocations: storeAllocations.map((store) => ({
              ...store,
              quantity: 0,
            })),
            isActive: true,
          },
        ],
      }));
    }
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  // Stock calculation functions for variants
  const calculateStockTotals = () => {
    if (!formData.hasVariants || formData.variants.length === 0) {
      return {
        totalStock: formData.totalStock,
        onlineStock: formData.onlineStock,
        storeAllocations: storeAllocations,
      };
    }

    // Calculate from variants
    const totalStock = formData.variants.reduce(
      (sum, v) => sum + v.stockQuantity,
      0,
    );
    const onlineStock = formData.variants.reduce(
      (sum, v) => sum + v.onlineStock,
      0,
    );

    // Aggregate store allocations across variants
    const storeAllocationsMap = new Map<string, number>();
    formData.variants.forEach((variant) => {
      variant.storeAllocations.forEach((alloc) => {
        const current = storeAllocationsMap.get(alloc.storeId) || 0;
        storeAllocationsMap.set(alloc.storeId, current + alloc.quantity);
      });
    });

    const aggregatedStoreAllocations: StoreAllocation[] = Array.from(
      storeAllocationsMap.entries(),
    ).map(([storeId, quantity]) => ({
      storeId,
      storeName:
        storeAllocations.find((s: StoreAllocation) => s.storeId === storeId)
          ?.storeName || "",
      quantity,
    }));

    return {
      totalStock,
      onlineStock,
      storeAllocations: aggregatedStoreAllocations,
    };
  };

  const totalStoreAllocated = storeAllocations.reduce(
    (sum, a) => sum + a.quantity,
    0,
  );
  const remainingToAllocate =
    formData.distributionChannel === "shop"
      ? formData.totalStock - totalStoreAllocated
      : formData.totalStock - formData.onlineStock - totalStoreAllocated;

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix all errors before submitting",
        variant: "destructive",
      });
      return;
    }
    
    // Call original handleSubmit passed from parent
    handleSubmit(e);
  };
      return (
    <form onSubmit={validateAndSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column (Left) - Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4 border p-4 rounded-lg">
            <h3 className="text-sm font-semibold border-b pb-2">
              Basic Information
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-xs">Product Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, name: e.target.value }));
                    validateField('name', e.target.value);
                  }}
                  required
                  data-testid="input-name"
                  className={`w-full text-sm ${errors.name ? 'border-red-500' : ''}`}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  data-testid="input-description"
                  className="w-full text-sm"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="space-y-4 border p-4 rounded-lg">
            <h3 className="text-sm font-semibold border-b pb-2">Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="actualPrice" className="text-xs">Actual Price (INR)</Label>
                <Input
                  id="actualPrice"
                  type="number"
                  value={formData.actualPrice}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      actualPrice: e.target.value,
                    }));
                    validateField('actualPrice', e.target.value);
                  }}
                  required
                  data-testid="input-actual-price"
                  className={`w-full text-sm ${errors.actualPrice ? 'border-red-500' : ''}`}
                />
                {errors.actualPrice && (
                  <p className="text-xs text-red-500 mt-1">{errors.actualPrice}</p>
                )}
              </div>
              <div>
                <Label htmlFor="price" className="text-xs">Selling Price (INR)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, price: e.target.value }));
                    validateField('price', e.target.value);
                  }}
                  required
                  data-testid="input-price"
                  className={`w-full text-sm ${errors.price ? 'border-red-500' : ''}`}
                />
                {errors.price && (
                  <p className="text-xs text-red-500 mt-1">{errors.price}</p>
                )}
              </div>
            </div>
          </div>

          {/* Stock Management Section */}
          {!formData.hasVariants && (
            <div className="space-y-4 border p-4 rounded-lg">
              <h3 className="text-sm font-semibold border-b pb-2">
                Stock Management
              </h3>
              {/* Total Stock Input */}
              <div>
                <Label htmlFor="totalStock" className="text-xs">Total Stock</Label>
                <Input
                  id="totalStock"
                  type="number"
                  value={formData.totalStock}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      totalStock: parseInt(e.target.value) || 0,
                    }));
                    validateField('totalStock', e.target.value);
                  }}
                  data-testid="input-total-stock"
                  className={`w-full text-sm ${errors.totalStock ? 'border-red-500' : ''}`}
                />
                {errors.totalStock && (
                  <p className="text-xs text-red-500 mt-1">{errors.totalStock}</p>
                )}
              </div>

              {/* Distribution Channel Info */}
              {formData.distributionChannel === "online" && (
                <div className="p-4 border border-primary/20 rounded-md">
                  <p className="text-sm text-primary">
                    <strong>Online Only:</strong> All {formData.totalStock}{" "}
                    units will be allocated to online sales.
                  </p>
                </div>
              )}

              {/* Both Channels - Online Stock + Store Allocations */}
              {formData.distributionChannel === "both" && (
                <div className="space-y-4">
                  {/* Online Stock */}
                  <div>
                    <Label htmlFor="onlineStock" className="text-xs">Online Stock</Label>
                    <Input
                      id="onlineStock"
                      type="number"
                      value={formData.onlineStock}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          onlineStock: parseInt(e.target.value) || 0,
                        }));
                        validateField('onlineStock', e.target.value);
                      }}
                      data-testid="input-online-stock"
                      className={`w-full text-sm ${errors.onlineStock ? 'border-red-500' : ''}`}
                    />
                    {errors.onlineStock && (
                      <p className="text-xs text-red-500 mt-1">{errors.onlineStock}</p>
                    )}
                  </div>

                  {/* Store Allocations */}
                  <div className="space-y-3">
                    <Label className="font-medium">Store Allocations</Label>
                    {storeAllocations.length > 0 ? (
                      <div className="space-y-3">
                        {storeAllocations.map((alloc) => (
                          <div
                            key={alloc.storeId}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                          >
                            <span className="font-medium">
                              {alloc.storeName}
                            </span>
                            <Input
                              type="number"
                              className="w-24 text-sm"
                              value={alloc.quantity}
                              onChange={(e) =>
                                updateStoreAllocation(
                                  alloc.storeId,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              data-testid={`input-store-${alloc.storeId}`}
                            />
                          </div>
                        ))}
                        <div className="pt-3 border-t flex justify-between items-center">
                          <span className="font-medium">
                            Remaining to allocate:
                          </span>
                          <span
                            className={`font-bold ${
                              remainingToAllocate !== 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {remainingToAllocate}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No stores available
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Shop Only - Store Allocations */}
              {formData.distributionChannel === "shop" && (
                <div className="space-y-3">
                  <Label className="font-medium">Store Allocations</Label>
                  {storeAllocations.length > 0 ? (
                    <div className="space-y-3">
                      {storeAllocations.map((alloc) => (
                        <div
                          key={alloc.storeId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                        >
                          <span className="font-medium">{alloc.storeName}</span>
                          <Input
                            type="number"
                            className="w-24"
                            value={alloc.quantity}
                            onChange={(e) =>
                              updateStoreAllocation(
                                alloc.storeId,
                                parseInt(e.target.value) || 0,
                              )
                            }
                            data-testid={`input-store-${alloc.storeId}`}
                          />
                        </div>
                      ))}
                      <div className="pt-3 border-t flex justify-between items-center">
                        <span className="font-medium">
                          Remaining to allocate:
                        </span>
                        <span
                          className={`font-bold ${
                            remainingToAllocate !== 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {remainingToAllocate}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No stores available
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Product Variants Section */}
          {getCategorySizes().length > 0 && (
            <div className="space-y-4 border p-4 rounded-lg">
              <h3 className="text-sm font-semibold border-b pb-2">
                Product Variants (Sizes)
              </h3>

              {/* Enable Variants Toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  id="hasVariants"
                  checked={formData.hasVariants}
                  onCheckedChange={handleVariantsToggle}
                />
                <Label htmlFor="hasVariants" className="cursor-pointer">
                  Enable Size Variants
                </Label>
              </div>

              {/* Variants Management */}
              {formData.hasVariants && (
                <div className="space-y-4">
                  {/* Available Sizes */}
                  <div>
                <Label className="text-xs font-medium">
                  Available Sizes
                </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getCategorySizes().map((size) => {
                        const hasVariant = formData.variants.some(
                          (v) => v.size === size,
                        );
                        return (
                          <Button
                            key={size}
                            type="button"
                            variant={hasVariant ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              hasVariant
                                ? removeVariant(
                                    formData.variants.findIndex(
                                      (v) => v.size === size,
                                    ),
                                  )
                                : addVariant(size)
                            }
                            className="text-xs"
                          >
                            {size}
                            {hasVariant && <X className="h-3 w-3 ml-1" />}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Variants List */}
                  {formData.variants.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-xs font-medium">
                        Variant Details
                      </Label>
                      {formData.variants.map((variant, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">
                              Size: {variant.size}
                            </h4>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={variant.isActive}
                                onCheckedChange={(checked) =>
                                  updateVariant(index, "isActive", checked)
                                }
                              />
                              <Label className="text-xs">Active</Label>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <Label>SKU</Label>
                              <Input
                                value={variant.sku || "Auto-generated"}
                                onChange={(e) =>
                                  updateVariant(index, "sku", e.target.value)
                                }
                                placeholder="Auto-generated by backend"
                                disabled
                                className="bg-muted"
                              />
                            </div>
                          </div>

                          {/* Variant Stock Management */}
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">
                              Stock Management
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Total Stock</Label>
                                <Input
                                  type="number"
                                  value={variant.stockQuantity}
                                  onChange={(e) =>
                                    updateVariant(
                                      index,
                                      "stockQuantity",
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  className={`w-full text-sm ${errors[`variants.${index}.stockQuantity`] ? 'border-red-500' : ''}`}
                                />
                                {errors[`variants.${index}.stockQuantity`] && (
                                  <p className="text-sm text-red-500 mt-1">{errors[`variants.${index}.stockQuantity`]}</p>
                                )}
                              </div>
                              <div>
                                <Label className="text-xs">Online Stock</Label>
                                <Input
                                  type="number"
                                  value={variant.onlineStock}
                                  onChange={(e) =>
                                    updateVariant(
                                      index,
                                      "onlineStock",
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  className={`w-full text-sm ${errors[`variants.${index}.onlineStock`] ? 'border-red-500' : ''}`}
                                />
                                {errors[`variants.${index}.onlineStock`] && (
                                  <p className="text-sm text-red-500 mt-1">{errors[`variants.${index}.onlineStock`]}</p>
                                )}
                              </div>
                            </div>

                            {/* Variant Store Allocations */}
                            {formData.distributionChannel !== "online" &&
                              variant.storeAllocations && (
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium">
                                    Store Allocations
                                  </Label>
                                  {variant.storeAllocations.map((alloc) => (
                                    <div
                                      key={alloc.storeId}
                                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                    >
                                      <span className="text-xs">
                                        {alloc.storeName}
                                      </span>
                                      <Input
                                        type="number"
                                        className="w-20"
                                        value={alloc.quantity}
                                        onChange={(e) =>
                                          updateVariantStoreAllocation(
                                            index,
                                            alloc.storeId,
                                            parseInt(e.target.value) || 0,
                                          )
                                        }
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Variant Error Display - Below Store Allocations */}
                              {errors[`variants.${index}.allocations`] && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                  <p className="text-xs text-red-600">{errors[`variants.${index}.allocations`]}</p>
                                </div>
                              )}
                              {errors[`variants.${index}.stockQuantity`] && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                  <p className="text-xs text-red-600">{errors[`variants.${index}.stockQuantity`]}</p>
                                </div>
                              )}
                              {errors[`variants.${index}.onlineStock`] && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                  <p className="text-xs text-red-600">{errors[`variants.${index}.onlineStock`]}</p>
                                </div>
                              )}
                              {errors[`variants.${index}.channel`] && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                  <p className="text-xs text-red-600">{errors[`variants.${index}.channel`]}</p>
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stock Summary for Variants */}
          {formData.hasVariants && (
            <div className="space-y-4 border p-4 rounded-lg bg-blue-50">
              <h3 className="text-sm font-semibold border-b pb-2">
                Stock Summary (Calculated)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Total Stock</Label>
                  <p className="text-lg font-bold">
                    {calculateStockTotals().totalStock}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Online Stock</Label>
                  <p className="text-lg font-bold">
                    {calculateStockTotals().onlineStock}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Store Stock</Label>
                  <p className="text-lg font-bold">
                    {calculateStockTotals().storeAllocations.reduce(
                      (sum, a) => sum + a.quantity,
                      0,
                    )}
                  </p>
                </div>
              </div>
              {/* Store-wise breakdown */}
              <div className="mt-4">
                <Label className="text-xs font-medium">
                  Store-wise Breakdown
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {calculateStockTotals().storeAllocations.map((alloc) => (
                    <div
                      key={alloc.storeId}
                      className="flex justify-between p-2 bg-white rounded border"
                    >
                      <span className="text-xs font-medium">
                        {alloc.storeName}
                      </span>
                      <span className="text-xs font-bold">
                        {alloc.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Media Section */}
          <div className="flex gap-2">
            {/* Images Section */}
            <div className="space-y-4 w-3/4 border p-4 rounded-lg">
              <Label htmlFor="videoUrl">Image</Label>

              <div>
                {/* Multiple Images Upload */}
                <div className="space-y-2">
                  <CloudinaryUploader
                    maxNumberOfFiles={5}
                    maxFileSize={10485760}
                    fileType="image"
                    onComplete={(urls) => {
                      setFormData((prev) => ({
                        ...prev,
                        images: [...prev.images, ...urls],
                      }));
                    }}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Upload Images (Max 5)
                  </CloudinaryUploader>
                </div>

                {/* All Images Display */}
                {formData.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-md">
                      {formData.images.map((img, index) => (
                        <div key={index} className="relative group">
                          <div
                            className={`relative cursor-move transition-all ${
                              draggedIndex === index ? "opacity-50" : ""
                            }`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="absolute top-1 left-1 z-10 bg-white rounded p-1 shadow-sm">
                              <GripVertical className="h-3 w-3 text-gray-400" />
                            </div>
                            <img
                              src={img.startsWith("/objects/") ? img : img}
                              alt={`Image ${index + 1}`}
                              className="w-16 h-20 object-cover rounded border"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (img.includes("cloudinary.com")) {
                                try {
                                  await apiRequest(
                                    "DELETE",
                                    "/api/uploads/cloudinary",
                                    { url: img },
                                  );
                                  toast({
                                    title: "Success",
                                    description:
                                      "Image deleted from Cloudinary",
                                  });
                                } catch (error) {
                                  console.error(
                                    "Failed to delete from Cloudinary:",
                                    error,
                                  );
                                  toast({
                                    title: "Warning",
                                    description: "Failed to delete from Cloudinary",
                                    variant: "destructive",
                                  });
                                }
                              }
                              setFormData((prev) => ({
                                ...prev,
                                images: prev.images.filter(
                                  (_, i) => i !== index,
                                ),
                              }));
                            }}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Drag images to reorder
                    </p>
                  </div>
                )}
                {errors.images && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-600">{errors.images}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Video Section */}
            <div className="space-y-4 flex-1 border p-4 rounded-lg">
              <div>
                {/* Video URL Input */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Video</Label>
                  <div className="flex gap-2">
                    <CloudinaryUploader
                      maxNumberOfFiles={1}
                      maxFileSize={104857600}
                      fileType="video"
                      onComplete={(urls) => {
                        if (urls.length > 0) {
                          setFormData((prev) => ({
                            ...prev,
                            videoUrl: urls[0],
                          }));
                        }
                      }}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Upload Video
                    </CloudinaryUploader>
                  </div>
                </div>

                {/* Uploaded Video Display */}
                {formData.videoUrl && (
                  <div className="space-y-2">
                    <Label>Uploaded Video</Label>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                      <Video className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">
                          {formData.videoUrl}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Video uploaded successfully
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (formData.videoUrl.includes("cloudinary.com")) {
                            try {
                              await apiRequest(
                                "DELETE",
                                "/api/uploads/cloudinary",
                                {
                                  url: formData.videoUrl,
                                },
                              );
                              toast({
                                title: "Success",
                                description: "Video deleted from Cloudinary",
                              });
                            } catch (error) {
                              console.error(
                                "Failed to delete from Cloudinary:",
                                error,
                              );
                              toast({
                                title: "Warning",
                                description: "Failed to delete from Cloudinary",
                                variant: "destructive",
                              });
                            }
                          }
                          setFormData((prev) => ({ ...prev, videoUrl: "" }));
                        }}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar (Right) - Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="sticky top-6 space-y-6">
            {/* Product Details Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">
                Product Settings
              </h3>
              <div className="space-y-4">
                {editingProduct && (
                  <div>
                    <Label htmlFor="sku" className="text-xs">SKU</Label>
                    <Input
                      id="sku"
                      value={editingProduct.sku || ""}
                      disabled
                      className="bg-muted cursor-not-allowed w-full"
                      data-testid="input-sku"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      SKU is auto-generated and cannot be changed
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="category" className="text-xs">Category</Label>

                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => {
                      if (value !== "") {
                        const newCategory = categories.find(
                          (cat) => cat.id === value,
                        );
                        const newSizes = newCategory?.sizes || [];

                        setFormData((prev) => {
                          const updatedData = { ...prev, categoryId: value };

                          // Handle variants when category changes
                          if (prev.hasVariants) {
                            if (newSizes.length === 0) {
                              // New category has no sizes, disable variants
                              updatedData.hasVariants = false;
                              updatedData.variants = [];
                            } else if (
                              editingProduct &&
                              prev.variants.length > 0
                            ) {
                              // Editing: keep existing variants but update sizes if needed
                              updatedData.variants = prev.variants.map(
                                (variant) => ({
                                  ...variant,
                                  size: newSizes.includes(variant.size)
                                    ? variant.size
                                    : newSizes[0], // Fallback to first available size
                                }),
                              );
                            } else {
                              // Creating new variants
                              updatedData.variants = newSizes.map((size) => ({
                                sku: "",
                                size,
                                stockQuantity: 0,
                                onlineStock: 0,
                                storeAllocations: storeAllocations.map(
                                  (store) => ({
                                    storeId: store.storeId,
                                    storeName: store.storeName,
                                    quantity: 0,
                                  }),
                                ),
                                isActive: true,
                              }));
                            }
                          }

                          return updatedData;
                        });
                      }
                      validateField('categoryId', value);
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-category"
                      className={`w-full text-sm ${errors.categoryId ? 'border-red-500' : ''}`}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>

                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="text-sm text-red-500 mt-1">{errors.categoryId}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="subcategory" className="text-xs">Subcategory</Label>
                  <Select
                    value={formData.subcategoryId || ""}
                    onValueChange={(value) => {
                      if (value !== "") {
                        setFormData((prev) => ({
                          ...prev,
                          subcategoryId: value,
                        }));
                      }
                      validateField('subcategoryId', value);
                    }}
                    disabled={!formData.categoryId}
                  >
                    <SelectTrigger
                      data-testid="select-subcategory"
                      className={`w-full text-sm ${errors.subcategoryId ? 'border-red-500' : ''}`}
                    >
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .find(
                          (cat: Category & { subcategories: Subcategory[] }) =>
                            cat.id === formData.categoryId,
                        )
                        ?.subcategories.map((sub: Subcategory) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {errors.subcategoryId && (
                    <p className="text-xs text-red-500 mt-1">{errors.subcategoryId}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="color" className="text-xs">Color</Label>
                  <Select
                    value={formData.colorId || ""}
                    onValueChange={(value) => {
                      if (value !== "") {
                        setFormData((prev) => ({ ...prev, colorId: value }));
                      }
                      validateField('colorId', value);
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-color"
                      className={`w-full text-sm ${errors.colorId ? 'border-red-500' : ''}`}
                    >
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      {colors?.map((col: Color) => (
                        <SelectItem key={col.id} value={col.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: col.hexCode }}
                            />
                            {col.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.colorId && (
                    <p className="text-xs text-red-500 mt-1">{errors.colorId}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="fabric" className="text-xs">Fabric</Label>
                  <Select
                    value={formData.fabricId || ""}
                    onValueChange={(value) => {
                      if (value !== "") {
                        setFormData((prev) => ({ ...prev, fabricId: value }));
                      }
                      validateField('fabricId', value);
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-fabric"
                      className={`w-full text-sm ${errors.fabricId ? 'border-red-500' : ''}`}
                    >
                      <SelectValue placeholder="Select fabric" />
                    </SelectTrigger>
                    <SelectContent>
                      {fabrics?.map((fab: Fabric) => (
                        <SelectItem key={fab.id} value={fab.id}>
                          {fab.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.fabricId && (
                    <p className="text-xs text-red-500 mt-1">{errors.fabricId}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="channel" className="text-xs">Distribution Channel</Label>
                  <Select
                    value={formData.distributionChannel}
                    onValueChange={(value: "shop" | "online" | "both") => {
                      setFormData((prev) => ({
                        ...prev,
                        distributionChannel: value,
                      }));
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-channel"
                      className="w-full text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shop">Shop Only</SelectItem>
                      <SelectItem value="online">Online Only</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Product Status Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold border-b pb-2">
                Product Status
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="isFeatured"
                    checked={formData.isFeatured}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isFeatured: checked }))
                    }
                    data-testid="switch-featured"
                  />
                  <Label htmlFor="isFeatured" className="text-xs cursor-pointer">
                    Featured Product
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isActive: checked }))
                    }
                    data-testid="switch-active"
                  />
                  <Label htmlFor="isActive" className="text-xs cursor-pointer">
                    Active
                  </Label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={
                  createMutation?.isPending || updateMutation?.isPending
                }
                data-testid="button-submit"
                size="lg"
                className="w-full"
              >
                {createMutation?.isPending || updateMutation?.isPending
                  ? "Saving..."
                  : editingProduct
                    ? "Update Product"
                    : "Create Product"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
