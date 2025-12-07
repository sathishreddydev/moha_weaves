import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Upload,
  X,
  Video,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DataTable, FilterConfig } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { ObjectUploader } from "@/components/ObjectUploader";
import type {
  SareeWithDetails,
  Category,
  Color,
  Fabric,
  Store,
} from "@shared/schema";

interface StoreAllocation {
  storeId: string;
  storeName: string;
  quantity: number;
}

interface SareeFormData {
  name: string;
  description: string;
  price: string;
  categoryId: string;
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
}

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

export default function InventorySarees() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSaree, setEditingSaree] = useState<SareeWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSareeId, setDeletingSareeId] = useState<string | null>(null);
  const [storeAllocations, setStoreAllocations] = useState<StoreAllocation[]>([]);

  const [formData, setFormData] = useState<SareeFormData>({
    name: "",
    description: "",
    price: "",
    categoryId: "",
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

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: colors } = useQuery<Color[]>({
    queryKey: ["/api/colors"],
  });

  const { data: fabrics } = useQuery<Fabric[]>({
    queryKey: ["/api/fabrics"],
  });

  const { data: stores } = useQuery<Store[]>({
    queryKey: ["/api/inventory/stores"],
  });

  const {
    data: sarees,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    handleSearchChange,
    handleFiltersChange,
    handleDateFilterChange,
    refetch,
  } = useDataTable<SareeWithDetails>({
    queryKey: "/api/inventory/sarees",
    initialPageSize: 10,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      formData: SareeFormData;
      allocations: StoreAllocation[];
    }) => {
      const response = await apiRequest("POST", "/api/inventory/sarees", {
        ...data.formData,
        price: data.formData.price,
        storeAllocations: data.allocations
          .filter((a) => a.quantity > 0)
          .map((a) => ({
            storeId: a.storeId,
            quantity: a.quantity,
          })),
      });
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Saree created successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create saree",
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
      data: SareeFormData;
      allocations: StoreAllocation[];
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/sarees/${id}`,
        {
          ...data,
          price: data.price,
          storeAllocations: allocations
            .filter((a) => a.quantity > 0)
            .map((a) => ({
              storeId: a.storeId,
              quantity: a.quantity,
            })),
        }
      );
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Saree updated successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update saree",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/inventory/sarees/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Saree deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingSareeId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete saree",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingSaree(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      categoryId: "",
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
    setStoreAllocations(
      stores?.map((s) => ({ storeId: s.id, storeName: s.name, quantity: 0 })) ||
        []
    );
    setDialogOpen(true);
  };

  const handleOpenEdit = async (saree: SareeWithDetails) => {
    setEditingSaree(saree);
    setFormData({
      name: saree.name,
      description: saree.description || "",
      price: saree.price.toString(),
      categoryId: saree.categoryId || "",
      colorId: saree.colorId || "",
      fabricId: saree.fabricId || "",
      imageUrl: saree.imageUrl || "",
      images: (saree as any).images || [],
      videoUrl: (saree as any).videoUrl || "",
      totalStock: saree.totalStock,
      onlineStock: saree.onlineStock,
      distributionChannel: saree.distributionChannel,
      isFeatured: saree.isFeatured,
      isActive: saree.isActive,
    });

    try {
      const response = await fetch(
        `/api/inventory/sarees/${saree.id}/allocations`,
        { credentials: "include" }
      );
      const existingAllocations = await response.json();

      const allocs =
        stores?.map((s) => {
          const existing = existingAllocations.find(
            (a: StoreAllocation) => a.storeId === s.id
          );
          return {
            storeId: s.id,
            storeName: s.name,
            quantity: existing?.quantity || 0,
          };
        }) || [];
      setStoreAllocations(allocs);
    } catch {
      setStoreAllocations(
        stores?.map((s) => ({
          storeId: s.id,
          storeName: s.name,
          quantity: 0,
        })) || []
      );
    }

    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSaree(null);
    setStoreAllocations([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const totalAllocated = storeAllocations.reduce(
      (sum, a) => sum + a.quantity,
      0
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

    if (editingSaree) {
      updateMutation.mutate({
        id: editingSaree.id,
        data: formData,
        allocations: storeAllocations,
      });
    } else {
      createMutation.mutate({ formData, allocations: storeAllocations });
    }
  };

  const updateStoreAllocation = (storeId: string, quantity: number) => {
    setStoreAllocations((prev) =>
      prev.map((a) =>
        a.storeId === storeId ? { ...a, quantity: Math.max(0, quantity) } : a
      )
    );
  };

  const totalStoreAllocated = storeAllocations.reduce(
    (sum, a) => sum + a.quantity,
    0
  );
  const remainingToAllocate =
    formData.distributionChannel === "shop"
      ? formData.totalStock - totalStoreAllocated
      : formData.totalStock - formData.onlineStock - totalStoreAllocated;

  const columns: ColumnDef<SareeWithDetails>[] = useMemo(
    () => [
      {
        accessorKey: "imageUrl",
        header: "Image",
        cell: ({ row }) => (
          <div className="w-12 h-16 rounded overflow-hidden bg-muted">
            <img
              src={
                row.original.imageUrl ||
                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100"
              }
              alt={row.original.name}
              className="w-full h-full object-cover"
            />
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <span className="font-medium line-clamp-1">{row.original.name}</span>
            {row.original.isFeatured && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Featured
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-sm">
            {row.original.sku || "-"}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => row.original.category?.name || "-",
      },
      {
        accessorKey: "color",
        header: "Color",
        cell: ({ row }) => row.original.color?.name || "-",
      },
      {
        accessorKey: "fabric",
        header: "Fabric",
        cell: ({ row }) => row.original.fabric?.name || "-",
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => formatPrice(row.original.price),
      },
      {
        accessorKey: "totalStock",
        header: "Stock",
        cell: ({ row }) => (
          <div className="text-sm">
            <span
              className={
                row.original.totalStock < 10 ? "text-destructive" : ""
              }
            >
              {row.original.totalStock} total
            </span>
            <br />
            <span className="text-muted-foreground">
              {row.original.onlineStock} online
            </span>
          </div>
        ),
      },
      {
        accessorKey: "distributionChannel",
        header: "Channel",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.distributionChannel}
          </Badge>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link to={`/sarees/${row.original.id}`}>
              <Button
                variant="ghost"
                size="icon"
                data-testid={`button-view-${row.original.id}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenEdit(row.original)}
              data-testid={`button-edit-${row.original.id}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => {
                setDeletingSareeId(row.original.id);
                setDeleteDialogOpen(true);
              }}
              data-testid={`button-delete-${row.original.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const filters: FilterConfig[] = useMemo(
    () => [
      {
        key: "category",
        label: "Category",
        options: (categories || []).map((cat) => ({
          label: cat.name,
          value: cat.id,
        })),
      },
      {
        key: "color",
        label: "Color",
        options: (colors || []).map((col) => ({
          label: col.name,
          value: col.id,
        })),
      },
      {
        key: "fabric",
        label: "Fabric",
        options: (fabrics || []).map((fab) => ({
          label: fab.name,
          value: fab.id,
        })),
      },
      {
        key: "status",
        label: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
    [categories, colors, fabrics]
  );

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Sarees
            </h1>
            <p className="text-muted-foreground">Manage saree inventory</p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-saree">
            <Plus className="h-4 w-4 mr-2" />
            Add Saree
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <DataTable
              columns={columns}
              data={sarees}
              totalCount={totalCount}
              pageIndex={pageIndex}
              pageSize={pageSize}
              onPaginationChange={handlePaginationChange}
              onSearchChange={handleSearchChange}
              onFiltersChange={handleFiltersChange}
              onDateFilterChange={handleDateFilterChange}
              isLoading={isLoading}
              searchPlaceholder="Search sarees..."
              filters={filters}
              dateFilter={{ key: "date", label: "Filter by date" }}
              emptyMessage="No sarees found"
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSaree ? "Edit Saree" : "Add New Saree"}
            </DialogTitle>
            <DialogDescription>
              {editingSaree
                ? "Update the saree details below"
                : "Fill in the details to create a new saree"}
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

              {editingSaree && (
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={editingSaree.sku || ""}
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
                    {colors?.map((col) => (
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
                    {fabrics?.map((fab) => (
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
                                  parseInt(e.target.value) || 0
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
                                parseInt(e.target.value) || 0
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
                    <ObjectUploader
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
                    </ObjectUploader>
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
                          onClick={() =>
                            setFormData({
                              ...formData,
                              images: formData.images.filter(
                                (_, i) => i !== index
                              ),
                            })
                          }
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <ObjectUploader
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
                  </ObjectUploader>
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
                    <ObjectUploader
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
                    </ObjectUploader>
                  </div>
                  {formData.videoUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <Video className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {formData.videoUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, videoUrl: "" })
                        }
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
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingSaree
                  ? "Update"
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Saree</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this saree? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deletingSareeId && deleteMutation.mutate(deletingSareeId)
              }
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}