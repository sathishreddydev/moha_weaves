import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProductWithDetails, Store } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductForm } from "./ProductForm";
import { FiltersData, ProductFormData, StoreAllocation } from "./Types";
import { validateVariantStockConsistency, validateSimpleStockConsistency, calculateStockTotals } from "./stockCalculations";
import { DistributionChannel } from "../utils/enums";

export default function EditProduct() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

    distributionChannel: DistributionChannel.BOTH,

    isFeatured: false,

    isActive: true,

    // Care instructions
    careInstructions: "",

    // New variant fields

    hasVariants: false,

    variants: [],
    // SEO fields
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    metaTags: "",
    urlSlug: "",
  });

  const {
    data: productBySku,
    isLoading: productBySkuLoading,
    refetch: refetchProductBySku,
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

  const { data: stores,refetch:refetchStores } = useQuery<Store[]>({
    queryKey: ["/api/inventory/stores"],
  });

  const { data: filtersData,refetch:refetchFiltersData } = useQuery<FiltersData>({
    queryKey: ["/api/inventory/filters"],
  });

  const { data: productAllocations,refetch:refetchProductAllocations } = useQuery({
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

      const newFormData = {
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
        // Care instructions
        careInstructions: product.careInstructions || "",

        // New variant fields

        hasVariants: !!product?.variants?.length,

        variants: product.variants,
        // SEO fields
        seoTitle: product.seoTitle || "",
        seoDescription: product.seoDescription || "",
        seoKeywords: product.seoKeywords || "",
        metaTags: product.metaTags || "",
        urlSlug: product.urlSlug || "",
      };

      setFormData(newFormData);

      // For simple products, set store allocations

      // For variant products, store allocations are handled per variant

      const allocs = product.hasVariants
        ? stores?.map((s) => ({
            storeId: s.id,

            storeName: s.name,

            quantity: 0, // Start with 0 for variant products
          })) || []
        : stores?.map((s) => {
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

    // Validate images - at least one image is required
    if (!formData.images || formData.images.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one image is required",
        variant: "destructive",
      });
      return;
    }

    // Validate variant stocks if variants are enabled
    if (formData.hasVariants) {
      const issues = validateVariantStockConsistency(formData.variants, formData.distributionChannel);
      
      if (issues.length > 0) {
        toast({
          title: "Stock Validation Error",
          description: issues.join(", "),
          variant: "destructive",
        });
        return;
      }
    } else {
      // Simple product validation
      const issues = validateSimpleStockConsistency(
        formData.totalStock,
        formData.onlineStock,
        storeAllocations,
        formData.distributionChannel
      );
      
      if (issues.length > 0) {
        toast({
          title: "Stock Validation Error",
          description: issues.join(", "),
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
      // Use unified stock calculation for consistency
      const stockTotals = calculateStockTotals(
        data.hasVariants,
        data.variants,
        data.totalStock,
        data.onlineStock,
        data.hasVariants 
          ? [] // For variants, store allocations come from variants
          : allocations // Send all allocations including zero-quantity ones so backend can clear them
      );

      const response = await apiRequest(
        "PATCH",
        `/api/inventory/products/${id}`,
        {
          ...data,
          price: data.price,
          // Add calculated totals for both simple and variant products
          totalStock: stockTotals.totalStock,
          onlineStock: stockTotals.onlineStock,
          storeAllocations: stockTotals.storeAllocations,
          // Add SEO data nested as expected by backend
          seoData: {
            seoTitle: data.seoTitle,
            seoDescription: data.seoDescription,
            seoKeywords: data.seoKeywords,
            metaTags: data.metaTags,
            urlSlug: data.urlSlug,
          }
        },
      );

      return response;
    },

    onSuccess: () => {
      toast({ title: "Success", description: "product updated successfully" });
      refetchProductBySku()
      refetchFiltersData()
      refetchProductAllocations()
      refetchStores()
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/getProducts"] });
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
