import { DataTable } from "@/components/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDataTable } from "@/hooks/use-data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProductWithDetails } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { saveAs } from "file-saver";
import {
  AlertTriangle,
  Download,
  Edit,
  Eye,
  MapPin,
  Package,
  Plus,
  Printer,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { ProductPrintDetails } from "./ProductPrintDetails";
import { DistributionChannel } from "./utils/enums";

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

const ProductAccordionContent = ({
  product,
}: {
  product: ProductWithDetails;
}) => {
  const hasVariants = product.variants && product.variants.length > 0;

  return (
    <div className="space-y-4 p-3 text-xs">
      {/* Product Details */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Product Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <span className="text-xs text-muted-foreground">SKU:</span>
            <p className="font-medium text-xs">{product.sku || "N/A"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Description:</span>
            <p className="font-medium text-xs">
              {product.description || "No description"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">
              Distribution Channel:
            </span>
            <p className="font-medium text-xs capitalize">
              {DistributionChannel[product.distributionChannel as keyof typeof DistributionChannel] || product.distributionChannel}
            </p>
          </div>
        </div>
      </div>

      {/* Show Variants if they exist */}
      {hasVariants ? (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Variants ({product.variants!.length})
          </h3>
          <div className="space-y-2">
            {product.variants!.map((variant) => (
              <Card key={variant.id} className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-xs">
                      Size: {variant.size}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      SKU: {variant.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={variant.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {variant.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Stock:
                    </span>
                    <p className="font-medium text-xs">
                      {variant.stockQuantity}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Online Stock:
                    </span>
                    <p className="font-medium text-xs">{variant.onlineStock}</p>
                  </div>
                  {variant.price && (
                    <div>
                      <span className="text-muted-foreground text-xs">
                        Price:
                      </span>
                      <p className="font-medium text-xs">
                        {formatPrice(variant.price)}
                      </p>
                    </div>
                  )}
                  {variant.actualPrice && (
                    <div>
                      <span className="text-muted-foreground text-xs">
                        Actual Price:
                      </span>
                      <p className="font-medium text-xs">
                        {formatPrice(variant.actualPrice)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Variant Store Allocations */}
                {variant.storeAllocations &&
                  variant.storeAllocations.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <h5 className="text-xs font-medium mb-2 flex items-center gap-1">
                        <StoreIcon className="h-3 w-3" />
                        Store Allocations
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {variant.storeAllocations.map((allocation) => (
                          <div
                            key={allocation.storeId}
                            className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded"
                          >
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-xs">
                              {allocation.storeName}:
                            </span>
                            <span className="text-xs">
                              {allocation.quantity} units
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* Show stock and store details for main product if no variants */
        <>
          {/* Stock Details */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="text-center">
                  <h4 className="text-lg font-bold text-primary">
                    {product.totalStock}
                  </h4>
                  <p className="text-xs text-muted-foreground">Total Stock</p>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <h4 className="text-lg font-bold text-green-600">
                    {product.onlineStock}
                  </h4>
                  <p className="text-xs text-muted-foreground">Online Stock</p>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <h4 className="text-lg font-bold text-orange-600">
                    {product.totalStock - product.onlineStock}
                  </h4>
                  <p className="text-xs text-muted-foreground">Offline Stock</p>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <h4 className="text-lg font-bold">
                    {formatPrice(product.price)}
                  </h4>
                  <p className="text-xs text-muted-foreground">Price</p>
                </div>
              </Card>
            </div>
          </div>

          {/* Store Allocations for main product */}
          {product.storeAllocations && product.storeAllocations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <StoreIcon className="h-4 w-4" />
                Store Locations ({product.storeAllocations.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {product.storeAllocations.map((allocation) => (
                  <Card key={allocation.storeId} className="p-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium text-xs">
                          {allocation.storeName}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {allocation.quantity} units
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div>
          <span>
            Created: {new Date(product.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div>
          <span>
            Last Updated: {new Date(product.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function InventoryProducts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingproductId, setDeletingproductId] = useState<string | null>(
    null,
  );
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingProduct, setPrintingProduct] =
    useState<ProductWithDetails | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

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
    pageKey:'inventoryProducts'
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("DELETE", "/api/inventory/products", {
        ids,
      });
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
        header: () => {
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
        header: "Product",
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <div className="font-medium line-clamp-1">{row.original.name}</div>
            <div
              className={`font-mono text-xs ${row.original.isActive ? "text-green-600" : "text-red-600"}`}
            >
              {row.original.sku || "-"}
            </div>
            {row.original.isFeatured && (
              <Badge variant="secondary" className="ml-2 text-xs mt-1">
                Featured
              </Badge>
            )}
          </div>
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
              {row.original.totalStock}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "distributionChannel",
        header: "Channel",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {DistributionChannel[row.original.distributionChannel as keyof typeof DistributionChannel] || row.original.distributionChannel}
          </Badge>
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
              onClick={() => handlePrintBarcode(row.original)}
              data-testid={`button-print-${row.original.id}`}
              title="Print with Barcode"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                navigate(`/inventory/products/editProduct/${row.original.sku}`)
              }
              data-testid={`button-edit-${row.original.id}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
             <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(`/inventory/damage-report/${row.original.sku}`)
            }
            data-testid={`button-report-damage-${row.original.id}`}
            title="Report Damage"
          >
            <AlertTriangle className="h-4 w-4 text-orange-500" />
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
    [selectedRows, products, handleRowSelect, handleSelectAll, navigate],
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
            <Button
              onClick={() => {
                navigate("/inventory/products/addProduct");
              }}
              data-testid="button-add-product"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add product
            </Button>
          </div>
        </div>

        <DataTable
          pageKey="inventoryProducts"
          columns={columns}
          data={products}
          totalCount={totalCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPaginationChange={handlePaginationChange}
          isLoading={isLoading}
          searchPlaceholder="Search products..."
          emptyMessage="No products found"
          accordion={true}
          accordionContent={(product) => (
            <ProductAccordionContent product={product} />
          )}
          accordionPosition="inline"
          className="[&_table]:text-xs [&_th]:h-8 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1"
        />
      </div>

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
