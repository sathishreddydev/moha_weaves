import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Store as StoreIcon, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { DataTable, FilterConfig } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { StoreSaleWithItems, Store } from "@shared/schema";

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function InventoryStoreOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: stores } = useQuery<Store[]>({
    queryKey: ["/api/inventory/stores"],
  });

  const {
    data: storeSales,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    handleSearchChange,
    handleFiltersChange,
    handleDateFilterChange,
  } = useDataTable<StoreSaleWithItems>({
    queryKey: "/api/inventory/store-sales",
    initialPageSize: 10,
  });

  const filters: FilterConfig[] = useMemo(
    () => [
      {
        key: "storeId",
        label: "Store",
        options: (stores || []).map((store) => ({
          label: store.name,
          value: store.id,
        })),
      },
    ],
    [stores]
  );

  const columns: ColumnDef<StoreSaleWithItems>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "Sale ID",
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            #{row.original.id.slice(0, 8).toUpperCase()}
          </span>
        ),
      },
      {
        accessorKey: "store",
        header: "Store",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <StoreIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.original.store.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "items",
        header: "Items",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {(row.original.items || []).slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="w-10 h-12 rounded overflow-hidden bg-muted"
              >
                <img
                  src={
                    item.saree?.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                  }
                  alt={item.saree?.name || "Saree"}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {(row.original.items?.length || 0) > 3 && (
              <span className="text-xs text-muted-foreground ml-1">
                +{(row.original.items?.length || 0) - 3}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatPrice(row.original.totalAmount)}
          </span>
        ),
      },
      {
        accessorKey: "paymentMethod",
        header: "Payment",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.paymentMethod}
          </Badge>
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
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Store Sales
            </h1>
            <p className="text-muted-foreground">
              View all store sales across locations
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <DataTable
              columns={columns}
              data={storeSales}
              totalCount={totalCount}
              pageIndex={pageIndex}
              pageSize={pageSize}
              onPaginationChange={handlePaginationChange}
              onSearchChange={handleSearchChange}
              onFiltersChange={handleFiltersChange}
              onDateFilterChange={handleDateFilterChange}
              isLoading={isLoading}
              searchPlaceholder="Search by sale ID..."
              filters={filters}
              dateFilter={{ key: "date", label: "Filter by date" }}
              emptyMessage="No store sales found"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}