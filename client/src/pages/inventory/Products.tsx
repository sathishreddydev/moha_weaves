import { useState, useMemo, useRef } from "react";
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
  Printer,
  Download,
} from "lucide-react";
import Barcode from "react-barcode";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
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
import { DataTable } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { CloudinaryUploader } from "@/components/CloudinaryUploader";
import type {
  ProductWithDetails,
  Category,
  Subcategory,
  Color,
  Fabric,
  Store,
} from "@shared/schema";

interface StoreAllocation {
  storeId: string;
  storeName: string;
  quantity: number;
}

interface ProductFormData {
  name: string;
  description: string;
  price: string;
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
}

interface FiltersData {
  categories: (Category & { subcategories: Subcategory[] })[];
  colors: Color[];
  fabrics: Fabric[];
}

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

export default function InventoryProducts() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingproductId, setDeletingproductId] = useState<string | null>(null);
  const [storeAllocations, setStoreAllocations] = useState<StoreAllocation[]>([]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingProduct, setPrintingProduct] = useState<ProductWithDetails | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkPrintDialogOpen, setBulkPrintDialogOpen] = useState(false);
  const bulkPrintRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    subcategoryId: "", // Added missing subcategoryId property
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

  const categories = filtersData?.categories || [];
  const colors = filtersData?.colors || [];
  const fabrics = filtersData?.fabrics || [];

  const { data: stores } = useQuery<Store[]>({
    queryKey: ["/api/inventory/stores"],
  });

  const {
    data: products,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    refetch,
  } = useDataTable<ProductWithDetails>({
    queryKey: "/api/inventory/products",
    initialPageSize: 10,
  });

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
      return response.json();
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
        }
      );
      return response.json();
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/inventory/products/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "product deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingproductId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => apiRequest("DELETE", `/api/inventory/products/${id}`))
      );
    },
    onSuccess: () => {
      refetch();
      toast({ 
        title: "Success", 
        description: `${selectedRows.size} product(s) deleted successfully` 
      });
      setBulkDeleteDialogOpen(false);
      setSelectedRows(new Set());
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete selected products",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      description: "",
      price: "",
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
    setStoreAllocations(
      stores?.map((s) => ({ storeId: s.id, storeName: s.name, quantity: 0 })) ||
        []
    );
    setDialogOpen(true);
  };

  const handleOpenEdit = async (product: ProductWithDetails) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      categoryId: product.categoryId || "",
      subcategoryId: product.subcategoryId || "",
      colorId: product.colorId || "",
      fabricId: product.fabricId || "",
      imageUrl: product.imageUrl || "",
      images: (product as any).images || [],
      videoUrl: (product as any).videoUrl || "",
      totalStock: product.totalStock,
      onlineStock: product.onlineStock,
      distributionChannel: product.distributionChannel,
      isFeatured: product.isFeatured,
      isActive: product.isActive,
    });

    try {
      const response = await fetch(
        `/api/inventory/products/${product.id}/allocations`,
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
    setEditingProduct(null);
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

  const handlePrintBarcode = (product: ProductWithDetails) => {
    setPrintingProduct(product);
    setPrintDialogOpen(true);
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Product Details</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .product-details { max-width: 800px; margin: 0 auto; }
              h1 { text-align: center; margin-bottom: 20px; }
              .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px; border-bottom: 1px solid #eee; }
              .label { font-weight: bold; }
              .barcode-container { text-align: center; margin: 20px 0; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const handleBulkDelete = () => {
    if (selectedRows.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedRows));
  };

  const handleBulkPrint = () => {
    if (selectedRows.size === 0) return;
    setBulkPrintDialogOpen(true);
  };

  const handleBulkPrintConfirm = () => {
    if (!bulkPrintRef.current) return;

    const printContent = bulkPrintRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Multiple Products</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .product-details { max-width: 800px; margin: 0 auto 40px; page-break-after: always; }
              .product-details:last-child { page-break-after: auto; }
              h1 { text-align: center; margin-bottom: 20px; }
              .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px; border-bottom: 1px solid #eee; }
              .label { font-weight: bold; }
              .barcode-container { text-align: center; margin: 20px 0; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setBulkPrintDialogOpen(false);
      }, 250);
    }
  };

  const handleRowSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(products.map((s) => s.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleDownloadExcel = () => {
    if (!products || products.length === 0) {
      toast({
        title: "No Data",
        description: "No products to download",
        variant: "destructive",
      });
      return;
    }

    const excelData = products.map((product) => ({
      SKU: product.sku || "-",
      Name: product.name,
      Category: product.category?.name || "-",
      Color: product.color?.name || "-",
      Fabric: product.fabric?.name || "-",
      Price: product.price,
      "Total Stock": product.totalStock,
      "Online Stock": product.onlineStock,
      "Distribution Channel": product.distributionChannel,
      Status: product.isActive ? "Active" : "Inactive",
      Featured: product.isFeatured ? "Yes" : "No",
      Description: product.description || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "products");

    // Set column widths
    const columnWidths = [
      { wch: 15 }, // SKU
      { wch: 30 }, // Name
      { wch: 15 }, // Category
      { wch: 15 }, // Color
      { wch: 15 }, // Fabric
      { wch: 10 }, // Price
      { wch: 12 }, // Total Stock
      { wch: 12 }, // Online Stock
      { wch: 18 }, // Distribution Channel
      { wch: 10 }, // Status
      { wch: 10 }, // Featured
      { wch: 40 }, // Description
    ];
    worksheet["!cols"] = columnWidths;

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(data, `products_inventory_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Success",
      description: "Excel file downloaded successfully",
    });
  };

  const columns: ColumnDef<ProductWithDetails>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const allOnPage = products.map((s) => s.id);
          const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selectedRows.has(id));
          return (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="cursor-pointer"
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedRows.has(row.original.id)}
            onChange={(e) => handleRowSelect(row.original.id, e.target.checked)}
            className="cursor-pointer"
          />
        ),
      },
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
        id: "print",
        header: "Print",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handlePrintBarcode(row.original)}
            data-testid={`button-print-${row.original.id}`}
            title="Print with Barcode"
          >
            <Printer className="h-4 w-4" />
          </Button>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link to={`/products/${row.original.id}`}>
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
                setDeletingproductId(row.original.id);
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
    [selectedRows, products]
  );

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              products
            </h1>
            <p className="text-muted-foreground">Manage product inventory</p>
            {selectedRows.size > 0 && (
              <p className="text-sm text-primary mt-1">
                {selectedRows.size} item(s) selected
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedRows.size > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={handleBulkPrint}
                  data-testid="button-bulk-print"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Selected ({selectedRows.size})
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedRows.size})
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={handleDownloadExcel}
              data-testid="button-download-excel"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
            <Button onClick={handleOpenCreate} data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Add product
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <DataTable
              columns={columns}
              data={products}
              totalCount={totalCount}
              pageIndex={pageIndex}
              pageSize={pageSize}
              onPaginationChange={handlePaginationChange}
              isLoading={isLoading}
              searchPlaceholder="Search products..."
              emptyMessage="No products found"
            />
          </CardContent>
        </Card>
      </div>

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
                      .find((cat: Category & { subcategories: Subcategory[] }) => cat.id === formData.categoryId)
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
                                await apiRequest("DELETE", "/api/uploads/cloudinary", { url: img });
                                toast({ title: "Success", description: "Image deleted from Cloudinary" });
                              } catch (error) {
                                console.error("Failed to delete from Cloudinary:", error);
                                toast({ title: "Warning", description: "Failed to delete from Cloudinary", variant: "destructive" });
                              }
                            }
                            // Remove from form state
                            setFormData({
                              ...formData,
                              images: formData.images.filter(
                                (_, i) => i !== index
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
                              await apiRequest("DELETE", "/api/uploads/cloudinary", { url: formData.videoUrl });
                              toast({ title: "Success", description: "Video deleted from Cloudinary" });
                            } catch (error) {
                              console.error("Failed to delete from Cloudinary:", error);
                              toast({ title: "Warning", description: "Failed to delete from Cloudinary", variant: "destructive" });
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
                  : editingProduct
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
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot be
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
                deletingproductId && deleteMutation.mutate(deletingproductId)
              }
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Multiple products</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedRows.size} product(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkPrintDialogOpen} onOpenChange={setBulkPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print Multiple Products with Barcodes</DialogTitle>
          </DialogHeader>
          <div ref={bulkPrintRef}>
            {products
              .filter((s) => selectedRows.has(s.id))
              .map((product) => (
                <div key={product.id} className="product-details">
                  <h1 className="text-xl font-bold text-center mb-4">
                    Product Details
                  </h1>
                  <div className="space-y-3">
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">SKU:</span>
                      <span>{product.sku || "-"}</span>
                    </div>
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">Name:</span>
                      <span>{product.name}</span>
                    </div>
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">Category:</span>
                      <span>{product.category?.name || "-"}</span>
                    </div>
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">Color:</span>
                      <span>{product.color?.name || "-"}</span>
                    </div>
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">Fabric:</span>
                      <span>{product.fabric?.name || "-"}</span>
                    </div>
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">Price:</span>
                      <span>{formatPrice(product.price)}</span>
                    </div>
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">Total Stock:</span>
                      <span>{product.totalStock}</span>
                    </div>
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">Online Stock:</span>
                      <span>{product.onlineStock}</span>
                    </div>
                    <div className="detail-row flex justify-between border-b pb-2">
                      <span className="label font-semibold">Distribution Channel:</span>
                      <span className="capitalize">{product.distributionChannel}</span>
                    </div>
                  </div>
                  <div className="barcode-container mt-6 flex justify-center">
                    <Barcode
                      value={product.sku || product.id}
                      width={2}
                      height={60}
                      displayValue={true}
                    />
                  </div>
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPrintDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkPrintConfirm}>
              <Printer className="h-4 w-4 mr-2" />
              Print All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print Product Details with Barcode</DialogTitle>
          </DialogHeader>
          {printingProduct && (
            <div ref={printRef} className="product-details">
              <h1 className="text-xl font-bold text-center mb-4">
                Product Details
              </h1>
              <div className="space-y-3">
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">SKU:</span>
                  <span>{printingProduct.sku || "-"}</span>
                </div>
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">Name:</span>
                  <span>{printingProduct.name}</span>
                </div>
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">Category:</span>
                  <span>{printingProduct.category?.name || "-"}</span>
                </div>
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">Color:</span>
                  <span>{printingProduct.color?.name || "-"}</span>
                </div>
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">Fabric:</span>
                  <span>{printingProduct.fabric?.name || "-"}</span>
                </div>
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">Price:</span>
                  <span>{formatPrice(printingProduct.price)}</span>
                </div>
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">Total Stock:</span>
                  <span>{printingProduct.totalStock}</span>
                </div>
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">Online Stock:</span>
                  <span>{printingProduct.onlineStock}</span>
                </div>
                <div className="detail-row flex justify-between border-b pb-2">
                  <span className="label font-semibold">Distribution Channel:</span>
                  <span className="capitalize">{printingProduct.distributionChannel}</span>
                </div>
                {printingProduct.description && (
                  <div className="detail-row flex justify-between border-b pb-2">
                    <span className="label font-semibold">Description:</span>
                    <span className="text-right max-w-md">{printingProduct.description}</span>
                  </div>
                )}
              </div>
              <div className="barcode-container mt-6 flex justify-center">
                <Barcode
                  value={printingProduct.sku || printingProduct.id}
                  width={2}
                  height={60}
                  displayValue={true}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}