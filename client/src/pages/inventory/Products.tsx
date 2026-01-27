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
  AlertTriangle,
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
import type {
  ProductWithDetails,
  Store,
} from "@shared/schema";
import { ProductPrintDetails } from "./ProductPrintDetails";
import { ProductFormData, StoreAllocation } from "./components/Types";
import { ProductDialog } from "./components/ProductDialog";


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
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingproductId, setDeletingproductId] = useState<string | null>(
    null,
  );
  const [storeAllocations, setStoreAllocations] = useState<StoreAllocation[]>(
    [],
  );
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingProduct, setPrintingProduct] =
    useState<ProductWithDetails | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

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
    queryKey: "/api/inventory/getProducts",
    initialPageSize: 10,
  });


  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("DELETE", "/api/inventory/products", { ids });
      return res.ids as string[];
    },
    onSuccess: (deletedIds) => {
      refetch();

      const count = deletedIds.length;
      const label = count === 1 ? "product" : "products";

      toast({
        title: "Success",
        description: `${count} ${label} deleted successfully`,
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
    setStoreAllocations(
      stores?.map((s) => ({ storeId: s.id, storeName: s.name, quantity: 0 })) ||
      [],
    );
    setDialogOpen(true);
  };

  const handleOpenEdit = async (product: ProductWithDetails) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      actualPrice: (product as any).actualPrice?.toString() || "",
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
      const existingAllocations = await apiRequest(
        "GET",
        `/api/inventory/products/${product.id}/allocations`
      );

      const allocs =
        stores?.map((s) => {
          const existing = existingAllocations.find(
            (a: StoreAllocation) => a.storeId === s.id,
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
        })) || [],
      );
    }

    setDialogOpen(true);
  };


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
    deleteMutation.mutate(Array.from(selectedRows));
  };

  const handleBulkPrint = () => {
    if (selectedRows.size === 0) return;
    setPrintDialogOpen(true);
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
    saveAs(
      data,
      `products_inventory_${new Date().toISOString().split("T")[0]}.xlsx`,
    );

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
          const allSelected =
            allOnPage.length > 0 &&
            allOnPage.every((id) => selectedRows.has(id));
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
            <span className="font-medium line-clamp-1">
              {row.original.name}
            </span>
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
              className={row.original.totalStock < 10 ? "text-destructive" : ""}
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
        id: "reportDamage",
        header: "Report Damage",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/inventory/damage-report/${row.original.sku}`)}
            data-testid={`button-report-damage-${row.original.id}`}
            title="Report Damage"
          >
            <AlertTriangle className="h-4 w-4 text-orange-500" />
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
    [selectedRows, products],
  );

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Products
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
      </div>

      <ProductDialog
        refetch={refetch}
        setEditingProduct={setEditingProduct}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        editingProduct={editingProduct}
        formData={formData}
        setFormData={setFormData}
        setStoreAllocations={setStoreAllocations}
        storeAllocations={storeAllocations}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot
              be undone.
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
                deletingproductId && deleteMutation.mutate([deletingproductId])
              }
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Multiple products</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedRows.size} product(s)?
              This action cannot be undone.
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
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Print Product Details with Barcode</DialogTitle>
          </DialogHeader>
          <ProductPrintDetails
            products={products}
            selectedRows={
              printingProduct ? new Set([printingProduct.id]) : selectedRows
            }
            printRef={printRef}
          />

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
