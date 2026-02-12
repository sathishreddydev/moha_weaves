import { CloudinaryUploader } from "@/components/CloudinaryUploader";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { ImageIcon, Upload, Video, X } from "lucide-react";
import React from "react";
import { FiltersData, ProductDialogProps, ProductFormData, StoreAllocation } from "./Types";

export const ProductDialog = ({
    refetch,
    setEditingProduct,
    dialogOpen,
    setDialogOpen,
    editingProduct,
    formData,
    setFormData,
    setStoreAllocations,
    storeAllocations,
}: ProductDialogProps) => {
    const { data: filtersData } = useQuery<FiltersData>({
        queryKey: ["/api/inventory/filters"],
    });

    const categories = filtersData?.categories || [];
    const colors = filtersData?.colors || [];
    const fabrics = filtersData?.fabrics || [];

    const updateStoreAllocation = (storeId: string, quantity: number) => {
        setStoreAllocations((prev) =>
            prev.map((a) =>
                a.storeId === storeId ? { ...a, quantity: Math.max(0, quantity) } : a,
            ),
        );
    };

    const totalStoreAllocated = storeAllocations.reduce(
        (sum, a) => sum + a.quantity,
        0,
    );
    const remainingToAllocate =
        formData.distributionChannel === "shop"
            ? formData.totalStock - totalStoreAllocated
            : formData.totalStock - formData.onlineStock - totalStoreAllocated;

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

        if (editingProduct) {
            updateMutation.mutate({
                id: editingProduct.id,
                data: formData,
                allocations: storeAllocations,
            });
        } else {
            createMutation.mutate({ formData, allocations: storeAllocations });
        }
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
            refetch();
            toast({ title: "Success", description: "product created successfully" });
            handleCloseDialog();
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to create product",
                variant: "destructive",
            });
        },
    });

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
            refetch();
            toast({ title: "Success", description: "product updated successfully" });
            handleCloseDialog();
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to update product",
                variant: "destructive",
            });
        },
    });

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingProduct(null);
        setStoreAllocations([]);
    };
    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {editingProduct ? "Edit product" : "Add New product"}
                    </DialogTitle>
                    <DialogDescription>
                        {editingProduct
                            ? "Update the product details below"
                            : "Fill in the details to create a new product"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                required
                                data-testid="input-name"
                            />
                        </div>

                        <div className="col-span-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                data-testid="input-description"
                            />
                        </div>
                        <div>
                            <Label htmlFor="price">Actual Price (INR)</Label>
                            <Input
                                id="actualPrice"
                                type="number"
                                value={formData.actualPrice}
                                onChange={(e) =>
                                    setFormData({ ...formData, actualPrice: e.target.value })
                                }
                                required
                                data-testid="input-price"
                            />
                        </div>
                        <div>
                            <Label htmlFor="price">Price (INR)</Label>
                            <Input
                                id="price"
                                type="number"
                                value={formData.price}
                                onChange={(e) =>
                                    setFormData({ ...formData, price: e.target.value })
                                }
                                required
                                data-testid="input-price"
                            />
                        </div>

                        {editingProduct && (
                            <div>
                                <Label htmlFor="sku">SKU</Label>
                                <Input
                                    id="sku"
                                    value={editingProduct.sku || ""}
                                    disabled
                                    className="bg-muted cursor-not-allowed"
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
                                onValueChange={(value) =>
                                    setFormData({ ...formData, categoryId: value })
                                }
                            >
                                <SelectTrigger data-testid="select-category">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories?.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="subcategory">Subcategory</Label>
                            <Select
                                value={formData.subcategoryId}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, subcategoryId: value })
                                }
                                disabled={!formData.categoryId}
                            >
                                <SelectTrigger data-testid="select-subcategory">
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
                                value={formData.colorId}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, colorId: value })
                                }
                            >
                                <SelectTrigger data-testid="select-color">
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
                                value={formData.fabricId}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, fabricId: value })
                                }
                            >
                                <SelectTrigger data-testid="select-fabric">
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
                                onValueChange={(value: "shop" | "online" | "both") =>
                                    setFormData({ ...formData, distributionChannel: value })
                                }
                            >
                                <SelectTrigger data-testid="select-channel">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="shop">Shop Only</SelectItem>
                                    <SelectItem value="online">Online Only</SelectItem>
                                    <SelectItem value="both">Both</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-2">
                            <Label htmlFor="totalStock">Total Stock</Label>
                            <Input
                                id="totalStock"
                                type="number"
                                value={formData.totalStock}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        totalStock: parseInt(e.target.value) || 0,
                                    })
                                }
                                data-testid="input-total-stock"
                            />
                        </div>

                        {formData.distributionChannel === "online" && (
                            <div className="col-span-2 p-3 bg-muted rounded-md">
                                <p className="text-sm text-muted-foreground">
                                    All {formData.totalStock} units will be allocated to online
                                    sales.
                                </p>
                            </div>
                        )}

                        {formData.distributionChannel === "both" && (
                            <div className="col-span-2 space-y-3">
                                <div>
                                    <Label htmlFor="onlineStock">Online Stock</Label>
                                    <Input
                                        id="onlineStock"
                                        type="number"
                                        value={formData.onlineStock}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                onlineStock: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        data-testid="input-online-stock"
                                    />
                                </div>

                                <div className="border rounded-md p-3">
                                    <Label className="mb-2 block">Store Allocations</Label>
                                    {storeAllocations.length > 0 ? (
                                        <div className="space-y-2">
                                            {storeAllocations.map((alloc) => (
                                                <div
                                                    key={alloc.storeId}
                                                    className="flex items-center gap-3"
                                                >
                                                    <span className="flex-1 text-sm">
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
                                            <div className="pt-2 border-t flex justify-between text-sm">
                                                <span>Remaining to allocate:</span>
                                                <span
                                                    className={
                                                        remainingToAllocate !== 0
                                                            ? "text-destructive font-medium"
                                                            : "text-green-600 font-medium"
                                                    }
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

                        {formData.distributionChannel === "shop" && (
                            <div className="col-span-2 border rounded-md p-3">
                                <Label className="mb-2 block">Distribute to Stores</Label>
                                {storeAllocations.length > 0 ? (
                                    <div className="space-y-2">
                                        {storeAllocations.map((alloc) => (
                                            <div
                                                key={alloc.storeId}
                                                className="flex items-center gap-3"
                                            >
                                                <span className="flex-1 text-sm">
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
                                        <div className="pt-2 border-t flex justify-between text-sm">
                                            <span>Remaining to allocate:</span>
                                            <span
                                                className={
                                                    remainingToAllocate !== 0
                                                        ? "text-destructive font-medium"
                                                        : "text-green-600 font-medium"
                                                }
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

                        <div className="col-span-2 space-y-4">
                            <div>
                                <Label htmlFor="imageUrl">Main Image URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="imageUrl"
                                        value={formData.imageUrl}
                                        onChange={(e) =>
                                            setFormData({ ...formData, imageUrl: e.target.value })
                                        }
                                        placeholder="https://... or upload below"
                                        data-testid="input-image-url"
                                    />
                                    <CloudinaryUploader
                                        maxNumberOfFiles={1}
                                        maxFileSize={10485760}
                                        fileType="image"
                                        onComplete={(urls) => {
                                            if (urls.length > 0) {
                                                setFormData({ ...formData, imageUrl: urls[0] });
                                            }
                                        }}
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload
                                    </CloudinaryUploader>
                                </div>
                            </div>

                            <div>
                                <Label>Additional Images</Label>
                                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                                    {formData.images.map((img, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={img.startsWith("/objects/") ? img : img}
                                                alt={`Image ${index + 1}`}
                                                className="w-16 h-20 object-cover rounded border"
                                            />
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    // Delete from Cloudinary if it's a Cloudinary URL
                                                    if (img.includes("cloudinary.com")) {
                                                        try {
                                                            await apiRequest(
                                                                "DELETE",
                                                                "/api/uploads/cloudinary",
                                                                { url: img },
                                                            );
                                                            toast({
                                                                title: "Success",
                                                                description: "Image deleted from Cloudinary",
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
                                                    // Remove from form state
                                                    setFormData({
                                                        ...formData,
                                                        images: formData.images.filter(
                                                            (_, i) => i !== index,
                                                        ),
                                                    });
                                                }}
                                                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <CloudinaryUploader
                                    maxNumberOfFiles={5}
                                    maxFileSize={10485760}
                                    fileType="image"
                                    onComplete={(urls) => {
                                        setFormData({
                                            ...formData,
                                            images: [...formData.images, ...urls],
                                        });
                                    }}
                                >
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    Upload Images (Max 5)
                                </CloudinaryUploader>
                            </div>

                            <div>
                                <Label htmlFor="videoUrl">Video URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="videoUrl"
                                        value={formData.videoUrl}
                                        onChange={(e) =>
                                            setFormData({ ...formData, videoUrl: e.target.value })
                                        }
                                        placeholder="https://... or upload below"
                                        data-testid="input-video-url"
                                    />
                                    <CloudinaryUploader
                                        maxNumberOfFiles={1}
                                        maxFileSize={104857600}
                                        fileType="video"
                                        onComplete={(urls) => {
                                            if (urls.length > 0) {
                                                setFormData({ ...formData, videoUrl: urls[0] });
                                            }
                                        }}
                                    >
                                        <Video className="h-4 w-4 mr-2" />
                                        Upload Video
                                    </CloudinaryUploader>
                                </div>
                                {formData.videoUrl && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <Video className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                                            {formData.videoUrl}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                // Delete from Cloudinary if it's a Cloudinary URL
                                                if (formData.videoUrl.includes("cloudinary.com")) {
                                                    try {
                                                        await apiRequest(
                                                            "DELETE",
                                                            "/api/uploads/cloudinary",
                                                            { url: formData.videoUrl },
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
                                                setFormData({ ...formData, videoUrl: "" });
                                            }}
                                            className="text-destructive"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="isFeatured"
                                checked={formData.isFeatured}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, isFeatured: checked })
                                }
                                data-testid="switch-featured"
                            />
                            <Label htmlFor="isFeatured">Featured</Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, isActive: checked })
                                }
                                data-testid="switch-active"
                            />
                            <Label htmlFor="isActive">Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleCloseDialog}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                            data-testid="button-submit"
                        >
                            {createMutation.isPending || updateMutation.isPending
                                ? "Saving..."
                                : editingProduct
                                    ? "Update"
                                    : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
