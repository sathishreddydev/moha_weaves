import React, { useEffect, useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FiltersData,
  ProductFormData,
  StoreAllocation,
  ProductDialogProps,
} from "./Types";
import { ProductForm } from "./ProductForm";
import { ProductWithDetails, Store } from "@shared/types";
import { useAuth } from "@/lib/auth";

export default function EditProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { sku } = useParams();
  const [editingProduct, setEditingProduct] =
    useState<ProductWithDetails | null>(null);
  const [storeAllocations, setStoreAllocations] = useState<StoreAllocation[]>(
    [],
  );
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    price: "",
    actualPrice: "",
    categoryId: "",
    subcategoryId: "",
    colorId: "",
    fabricId: "",
    imageUrl: "",
    images: [],
    videoUrl: "",
    totalStock: 0,
    onlineStock: 0,
    distributionChannel: "both",
    isFeatured: false,
    isActive: true,
  });
  const {
    data: productBySku,
    isLoading: productBySkuLoading,
    error: productBySkuError,
  } = useQuery({
    queryKey: ["/api/inventory/product-by-sku", sku],
    queryFn: async () => {
      if (!sku) return null;
      const response = await apiRequest(
        "GET",
        `/api/inventory/product-by-sku/${sku}`,
      );
      return response;
    },
  });

  const { data: stores } = useQuery<Store[]>({
    queryKey: ["/api/inventory/stores"],
  });

  const { data: filtersData } = useQuery<FiltersData>({
    queryKey: ["/api/inventory/filters"],
  });

  const { data: productAllocations } = useQuery({
    queryKey: ["/api/inventory/products", productBySku?.id, "allocations"],
    queryFn: async () => {
      if (!productBySku?.id) return null;
      const response = await apiRequest(
        "GET",
        `/api/inventory/products/${productBySku.id}/allocations`,
      );
      return response;
    },
    enabled: !!productBySku?.id,
  });

  const categories = filtersData?.categories || [];
  const colors = filtersData?.colors || [];
  const fabrics = filtersData?.fabrics || [];

  useEffect(() => {
    if (productBySku && stores && productAllocations) {
      const product = productBySku;

      setEditingProduct(product);

      // Handle images: combine imageUrl and images array, remove duplicates
      let allImages = product.images || [];
      if (product.imageUrl && !allImages.includes(product.imageUrl)) {
        allImages = [product.imageUrl, ...allImages];
      }

      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price.toString(),
        actualPrice: product.actualPrice?.toString() || "",
        categoryId: product.categoryId || "",
        subcategoryId: product.subcategoryId || "",
        colorId: product.colorId || "",
        fabricId: product.fabricId || "",
        imageUrl: product.imageUrl || "",
        images: allImages,
        videoUrl: product.videoUrl || "",
        totalStock: product.totalStock,
        onlineStock: product.onlineStock,
        distributionChannel: product.distributionChannel,
        isFeatured: product.isFeatured,
        isActive: product.isActive,
      });

      const allocs =
        stores?.map((s) => {
          const existing = productAllocations.find(
            (a: StoreAllocation) => a.storeId === s.id,
          );
          return {
            storeId: s.id,
            storeName: s.name,
            quantity: existing?.quantity || 0,
          };
        }) || [];
      setStoreAllocations(allocs);
    }
  }, [productBySku, stores, productAllocations]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const totalAllocated = storeAllocations.reduce(
      (sum, a) => sum + a.quantity,
      0,
    );

    if (formData.distributionChannel === "shop") {
      if (totalAllocated !== formData.totalStock) {
        toast({
          title: "Allocation Error",
          description: `Store allocations (${totalAllocated}) must equal total stock (${formData.totalStock})`,
          variant: "destructive",
        });
        return;
      }
    } else if (formData.distributionChannel === "both") {
      if (totalAllocated + formData.onlineStock !== formData.totalStock) {
        toast({
          title: "Allocation Error",
          description: `Online (${formData.onlineStock}) + Store allocations (${totalAllocated}) must equal total stock (${formData.totalStock})`,
          variant: "destructive",
        });
        return;
      }
    }

    // Set first image as main image
    const submissionData = {
      ...formData,
      imageUrl: formData.images.length > 0 ? formData.images[0] : "",
    };

    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        data: submissionData,
        allocations: storeAllocations,
      });
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      allocations,
    }: {
      id: string;
      data: ProductFormData;
      allocations: StoreAllocation[];
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/products/${id}`,
        {
          ...data,
          price: data.price,
          storeAllocations: allocations
            .filter((a) => a.quantity > 0)
            .map((a) => ({
              storeId: a.storeId,
              quantity: a.quantity,
            })),
        },
      );
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "product updated successfully" });
      navigate("/inventory/products");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });
  return (
    <div className="space-y-6">
      {productBySkuLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/inventory/products")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Edit Product
              </h1>
              <p className="text-sm text-muted-foreground">
                Update product information and inventory allocations
              </p>
            </div>
          </div>
          <ProductForm
            formData={formData}
            setFormData={setFormData}
            editingProduct={editingProduct}
            categories={categories}
            colors={colors}
            fabrics={fabrics}
            storeAllocations={storeAllocations}
            setStoreAllocations={setStoreAllocations}
            updateMutation={updateMutation}
            handleSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  );
}
