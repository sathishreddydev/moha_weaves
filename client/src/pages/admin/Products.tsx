import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { ProductWithDetails, Category } from "@shared/schema";

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

export default function AdminProducts() {
  const navigate = useNavigate();
  const [viewingProduct, setViewingProduct] = useState<ProductWithDetails | null>(
    null
  );

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const {
    data: products,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
  } = useDataTable<ProductWithDetails>({
    queryKey: "/api/admin/products",
    initialPageSize: 10,
  });

  const columns: ColumnDef<ProductWithDetails>[] = useMemo(
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
          <div className="max-w-[200px] truncate">
            <span className="font-medium">{row.original.name}</span>
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
          <span className="text-muted-foreground">
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
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => formatPrice(row.original.price),
      },
      {
        accessorKey: "totalStock",
        header: "Total Stock",
        cell: ({ row }) => (
          <span
            className={
              row.original.totalStock < 10 ? "text-destructive font-medium" : ""
            }
          >
            {row.original.totalStock}
          </span>
        ),
      },
      {
        accessorKey: "onlineStock",
        header: "Online Stock",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.onlineStock}
          </span>
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
        header: "View",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewingProduct(row.original)}
            data-testid={`button-view-${row.original.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
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
              product Stock Overview
            </h1>
            <p className="text-muted-foreground">
              View product inventory details (read-only)
            </p>
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

      <Dialog
        open={!!viewingProduct}
        onOpenChange={(open) => !open && setViewingProduct(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>product Details</DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-4">
              <div className="flex gap-6">
                <div className="w-32 h-40 rounded overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={
                      viewingProduct.imageUrl ||
                      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200"
                    }
                    alt={viewingProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-semibold">{viewingProduct.name}</h3>
                  <p className="text-2xl font-bold text-primary">
                    {formatPrice(viewingProduct.price)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {viewingProduct.sku || "No SKU"}
                    </Badge>
                    <Badge
                      variant={viewingProduct.isActive ? "default" : "secondary"}
                    >
                      {viewingProduct.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {viewingProduct.isFeatured && (
                      <Badge variant="secondary">Featured</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {viewingProduct.distributionChannel}
                    </Badge>
                  </div>
                </div>
              </div>

              {viewingProduct.description && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">
                    Description
                  </h4>
                  <p className="text-sm">{viewingProduct.description}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">
                    {viewingProduct.totalStock}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Stock</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {viewingProduct.onlineStock}
                  </p>
                  <p className="text-xs text-muted-foreground">Online Stock</p>
                </div>
                {viewingProduct?.storeAllocations?.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 bg-muted rounded-lg text-center"
                  >
                    <p className="text-2xl font-bold text-green-600">
                      {item.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.storeName ? item.storeName : "Store/Warehouse"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <span className="ml-2 font-medium">
                    {viewingProduct.category?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Color:</span>
                  <span className="ml-2 font-medium flex items-center gap-1">
                    {viewingProduct.color?.hexCode && (
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: viewingProduct.color.hexCode }}
                      />
                    )}
                    {viewingProduct.color?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fabric:</span>
                  <span className="ml-2 font-medium">
                    {viewingProduct.fabric?.name || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
