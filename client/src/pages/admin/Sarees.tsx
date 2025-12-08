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
import { DataTable, FilterConfig } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { SareeWithDetails, Category } from "@shared/schema";

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

export default function AdminSarees() {
  const navigate = useNavigate();
  const [viewingSaree, setViewingSaree] = useState<SareeWithDetails | null>(
    null
  );

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
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
  } = useDataTable<SareeWithDetails>({
    queryKey: "/api/admin/sarees",
    initialPageSize: 10,
  });

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
            onClick={() => setViewingSaree(row.original)}
            data-testid={`button-view-${row.original.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
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
        key: "status",
        label: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
    [categories]
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
              Saree Stock Overview
            </h1>
            <p className="text-muted-foreground">
              View saree inventory details (read-only)
            </p>
          </div>
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

      <Dialog
        open={!!viewingSaree}
        onOpenChange={(open) => !open && setViewingSaree(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saree Details</DialogTitle>
          </DialogHeader>
          {viewingSaree && (
            <div className="space-y-4">
              <div className="flex gap-6">
                <div className="w-32 h-40 rounded overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={
                      viewingSaree.imageUrl ||
                      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200"
                    }
                    alt={viewingSaree.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-semibold">{viewingSaree.name}</h3>
                  <p className="text-2xl font-bold text-primary">
                    {formatPrice(viewingSaree.price)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {viewingSaree.sku || "No SKU"}
                    </Badge>
                    <Badge
                      variant={viewingSaree.isActive ? "default" : "secondary"}
                    >
                      {viewingSaree.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {viewingSaree.isFeatured && (
                      <Badge variant="secondary">Featured</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {viewingSaree.distributionChannel}
                    </Badge>
                  </div>
                </div>
              </div>

              {viewingSaree.description && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">
                    Description
                  </h4>
                  <p className="text-sm">{viewingSaree.description}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">
                    {viewingSaree.totalStock}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Stock</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {viewingSaree.onlineStock}
                  </p>
                  <p className="text-xs text-muted-foreground">Online Stock</p>
                </div>
                {viewingSaree?.storeAllocations?.map((item, index) => (
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
                    {viewingSaree.category?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Color:</span>
                  <span className="ml-2 font-medium flex items-center gap-1">
                    {viewingSaree.color?.hexCode && (
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: viewingSaree.color.hexCode }}
                      />
                    )}
                    {viewingSaree.color?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fabric:</span>
                  <span className="ml-2 font-medium">
                    {viewingSaree.fabric?.name || "N/A"}
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
