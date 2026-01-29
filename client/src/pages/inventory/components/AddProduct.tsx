import React, { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    FiltersData,
    ProductFormData,
    StoreAllocation,
    ProductDialogProps,
} from "./Types";
import { Store } from "@shared/types";
import { ProductForm } from "./ProductForm";

export default function AddProduct() {
    const navigate = useNavigate();
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

        createMutation.mutate({ formData: submissionData, allocations: storeAllocations });
    };
    const createMutation = useMutation({
        mutationFn: async (data: {
            formData: ProductFormData;
            allocations: StoreAllocation[];
        }) => {
            console.log(data.formData);
            const response = await apiRequest("POST", "/api/inventory/products", {
                ...data.formData,
                price: data.formData.price,
                storeAllocations: data.allocations
                    .filter((a) => a.quantity > 0)
                    .map((a) => ({
                        storeId: a.storeId,
                        quantity: a.quantity,
                    })),
            });
            return response;
        },
        onSuccess: () => {
            toast({ title: "Success", description: "product created successfully" });
            navigate("/inventory/products");
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to create product",
                variant: "destructive",
            });
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
