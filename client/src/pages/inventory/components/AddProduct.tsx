import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import React, { useEffect, useState } from "react";
import { ProductFormData, StoreAllocation, FiltersData } from "./Types";
import { calculateStockTotals, validateVariantStockConsistency, validateSimpleStockConsistency } from "./stockCalculations";
import { ProductForm } from "./ProductForm";
import { Store } from "@shared/types";

export default function AddProduct() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
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

    const { data: filtersData } = useQuery<FiltersData>({
        queryKey: ["/api/inventory/filters"],
    });
    const { data: stores } = useQuery<Store[]>({
        queryKey: ["/api/inventory/stores"],
    });
    useEffect(() => {
        setStoreAllocations(
            stores?.map((s) => ({ storeId: s.id, storeName: s.name, quantity: 0 })) ||
            [],
        );

    }, [stores])
    const categories = filtersData?.categories || [];
    const colors = filtersData?.colors || [];
    const fabrics = filtersData?.fabrics || [];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

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

        createMutation.mutate({ formData: submissionData, allocations: storeAllocations });
    };
    const createMutation = useMutation({
        mutationFn: async (data: {
            formData: ProductFormData;
            allocations: StoreAllocation[];
        }) => {
            console.log(data.formData);
            
            // Use unified stock calculation utility
            const stockTotals = calculateStockTotals(
                data.formData.hasVariants,
                data.formData.variants,
                data.formData.totalStock,
                data.formData.onlineStock,
                data.formData.hasVariants 
                    ? [] // For variants, store allocations come from variants
                    : data.allocations.filter((a) => a.quantity > 0)
            );

            const response = await apiRequest("POST", "/api/inventory/products", {
                ...data.formData,
                price: data.formData.price,
                // Add calculated totals for both simple and variant products
                totalStock: stockTotals.totalStock,
                onlineStock: stockTotals.onlineStock,
                storeAllocations: stockTotals.storeAllocations,
                // Add SEO data nested as expected by backend
                seoData: {
                    seoTitle: data.formData.seoTitle,
                    seoDescription: data.formData.seoDescription,
                    seoKeywords: data.formData.seoKeywords,
                    metaTags: data.formData.metaTags,
                    urlSlug: data.formData.urlSlug,
                }
            });
            return response;
        },
        onSuccess: () => {
            toast({ title: "Success", description: "product created successfully" });
            queryClient.invalidateQueries({ queryKey: ["/api/inventory/getProducts"] });
            navigate("/inventory/products");
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to create product",
                variant: "destructive",
            });
        },
        onSettled: () => {
            // Reset submitting state regardless of success or error
            // This will be handled by the parent component
        },
    });

    return (
        <div className="space-y-6">
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
                    <h1 className="text-xl font-semibold tracking-tight">Add New Product</h1>
                    <p className="text-sm text-muted-foreground">
                        Create a new product and add it to your inventory
                    </p>
                </div>
            </div>
            <ProductForm
                formData={formData}
                setFormData={setFormData}
                categories={categories}
                colors={colors}
                fabrics={fabrics}
                storeAllocations={storeAllocations}
                setStoreAllocations={setStoreAllocations}
                createMutation={createMutation}
                handleSubmit={handleSubmit}
            />
        </div>
    );
};
