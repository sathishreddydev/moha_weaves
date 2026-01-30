import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { CloudinaryUploader } from "@/components/CloudinaryUploader";
import { Upload, ImageIcon, Video, X, GripVertical } from "lucide-react";
import { ProductFormData, StoreAllocation, FiltersData } from "./Types";
import { Category, Color, Fabric, Subcategory } from "@shared/types";

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

  const updateStoreAllocation = (storeId: string, quantity: number) => {
    setStoreAllocations((prev) =>
      prev.map((a) =>
        a.storeId === storeId ? { ...a, quantity: Math.max(0, quantity) } : a,
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

  const totalStoreAllocated = storeAllocations.reduce(
    (sum, a) => sum + a.quantity,
    0,
  );
  const remainingToAllocate =
    formData.distributionChannel === "shop"
      ? formData.totalStock - totalStoreAllocated
      : formData.totalStock - formData.onlineStock - totalStoreAllocated;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column (Left) - Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4 border p-4 rounded-lg">
            <h3 className="text-base font-semibold border-b pb-2">
              Basic Information
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  data-testid="input-name"
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
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
                  className="w-full"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="space-y-4 border p-4 rounded-lg">
            <h3 className="text-base font-semibold border-b pb-2">Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="actualPrice">Actual Price (INR)</Label>
                <Input
                  id="actualPrice"
                  type="number"
                  value={formData.actualPrice}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      actualPrice: e.target.value,
                    }))
                  }
                  required
                  data-testid="input-actual-price"
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="price">Selling Price (INR)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                  required
                  data-testid="input-price"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Stock Management Section */}
          <div className="space-y-4 border p-4 rounded-lg">
            <h3 className="text-base font-semibold border-b pb-2">
              Stock Management
            </h3>
            <div className="space-y-4">
              {/* Total Stock Input */}
              <div>
                <Label htmlFor="totalStock">Total Stock</Label>
                <Input
                  id="totalStock"
                  type="number"
                  value={formData.totalStock}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      totalStock: parseInt(e.target.value) || 0,
                    }))
                  }
                  data-testid="input-total-stock"
                  className="w-full"
                />
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
                    <Label htmlFor="onlineStock">Online Stock</Label>
                    <Input
                      id="onlineStock"
                      type="number"
                      value={formData.onlineStock}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          onlineStock: parseInt(e.target.value) || 0,
                        }))
                      }
                      data-testid="input-online-stock"
                      className="w-full"
                    />
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
          </div>

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
                                    description:
                                      "Failed to delete from Cloudinary",
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
              </div>
            </div>

            {/* Video Section */}
            <div className="space-y-4 flex-1 border p-4 rounded-lg">
              <div>
                {/* Video URL Input */}
                <div className="space-y-2">
                  <Label htmlFor="videoUrl">Video</Label>
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
              <h3 className="text-base font-semibold border-b pb-2">
                Product Settings
              </h3>
              <div className="space-y-4">
                {editingProduct && (
                  <div>
                    <Label htmlFor="sku">SKU</Label>
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
                  <Label htmlFor="category">Category</Label>

                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => {
                      if (value !== "") {
                        setFormData((prev) => ({ ...prev, categoryId: value }));
                      }
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-category"
                      className="w-full"
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
                </div>

                <div>
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Select
                    value={formData.subcategoryId || ""}
                    onValueChange={(value) => {
                      if (value !== "") {
                        setFormData((prev) => ({
                          ...prev,
                          subcategoryId: value,
                        }));
                      }
                    }}
                    disabled={!formData.categoryId}
                  >
                    <SelectTrigger
                      data-testid="select-subcategory"
                      className="w-full"
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
                </div>

                <div>
                  <Label htmlFor="color">Color</Label>
                  <Select
                    value={formData.colorId || ""}
                    onValueChange={(value) => {
                      if (value !== "") {
                        setFormData((prev) => ({ ...prev, colorId: value }));
                      }
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-color"
                      className="w-full"
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
                </div>

                <div>
                  <Label htmlFor="fabric">Fabric</Label>
                  <Select
                    value={formData.fabricId || ""}
                    onValueChange={(value) => {
                      if (value !== "") {
                        setFormData((prev) => ({ ...prev, fabricId: value }));
                      }
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-fabric"
                      className="w-full"
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
                </div>

                <div>
                  <Label htmlFor="channel">Distribution Channel</Label>
                  <Select
                    value={formData.distributionChannel}
                    onValueChange={(value: "shop" | "online" | "both") =>{
                      setFormData((prev) => ({
                        ...prev,
                        distributionChannel: value,
                      }))}
                    }
                  >
                    <SelectTrigger
                      data-testid="select-channel"
                      className="w-full"
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
                  <Label htmlFor="isFeatured" className="cursor-pointer">
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
                  <Label htmlFor="isActive" className="cursor-pointer">
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
