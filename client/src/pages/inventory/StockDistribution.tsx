import { useMemo } from "react";
import { Globe, Package, Store, Warehouse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { ProductWithDetails, Store as StoreType } from "@shared/schema";
import { UserRole } from "./utils/enums";

export default function StockDistribution() {
  const { user } = useAuth();

  const isInventoryUser =
    !!user && (user.role === UserRole.INVENTORY || user.role === UserRole.ADMIN);
  const { data: stores } = useQuery<StoreType[]>({
    queryKey: ["/api/inventory/stores"],
    enabled: isInventoryUser,
  });
  const { data: distributionData } = useQuery<any>({
    queryKey: ["/api/inventory/stock-distribution"],
    enabled: isInventoryUser,
  });

  const {
    data: products,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
  } = useDataTable<ProductWithDetails>({
    queryKey: "/api/inventory/getProducts",
    initialPageSize: 10,
    pageKey:'inventoryStockDistribution'
  });

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const columns: ColumnDef<ProductWithDetails>[] = useMemo(() => {
    const baseColumns: ColumnDef<ProductWithDetails>[] = [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.sku || "-"}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "product Name",
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <span className="font-medium line-clamp-1">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => formatPrice(row.original.price),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => row.original.category?.name || "-",
      },
      {
        accessorKey: "totalStock",
        header: "Total Stock",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.totalStock}</span>
        ),
      },
      {
        accessorKey: "unallocated",
        header: "Unallocated",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Warehouse className="h-4 w-4 text-orange-500" />
            <span
              className={
                row?.original?.unallocated && row.original.unallocated > 0
                  ? "text-orange-600"
                  : ""
              }
            >
              {row.original.unallocated}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "onlineStock",
        header: "Online",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Globe className="h-4 w-4 text-blue-500" />
            <span className="text-blue-600">{row.original.onlineStock}</span>
          </div>
        ),
      },
    ];

    // Add dynamic store columns
    const storeColumns: ColumnDef<ProductWithDetails>[] = (stores || []).map(
      (store) => ({
        id: `store-${store.id}`,
        header: store.name,
        accessorFn: (row: any) => {
          const allocation = row.storeAllocations?.find(
            (a: any) => a.storeId === store.id,
          );
          return allocation?.quantity || 0;
        },
        cell: ({ row }) => {
          const allocation = row.original.storeAllocations?.find(
            (a) => a.storeId === store.id,
          );
          const quantity = allocation?.quantity || 0;
          return (
            <div className="flex items-center gap-1">
              <Store className="h-4 w-4 text-green-500" />
              <span
                className={
                  quantity > 0 ? "text-green-600" : "text-muted-foreground"
                }
              >
                {quantity}
              </span>
            </div>
          );
        },
      }),
    );

    return [...baseColumns, ...storeColumns];
  }, [stores]);

  return (
    <div className="max-w-full mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Stock Distribution
        </h1>
        <p className="text-muted-foreground">
          View how stock is distributed across channels and stores
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Stock
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-stock">
              {distributionData?.summary?.totalStock || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {distributionData?.summary?.totalProducts || 0} products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Online Stock
            </CardTitle>
            <Globe className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold text-blue-600"
              data-testid="text-online-stock"
            >
              {distributionData?.summary?.onlineStock || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {(distributionData?.summary?.totalStock || 0) > 0
                ? (
                    ((distributionData?.summary?.onlineStock || 0) /
                      (distributionData?.summary?.totalStock || 1)) *
                    100
                  ).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Store Allocated
            </CardTitle>
            <Store className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold text-green-600"
              data-testid="text-store-stock"
            >
              {distributionData?.summary?.storeAllocated || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {(distributionData?.summary?.totalStock || 0) > 0
                ? (
                    ((distributionData?.summary?.storeAllocated || 0) /
                      (distributionData?.summary?.totalStock || 1)) *
                    100
                  ).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unallocated
            </CardTitle>
            <Warehouse className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold text-orange-600"
              data-testid="text-unallocated-stock"
            >
              {distributionData?.summary?.unallocated || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {(distributionData?.summary?.totalStock || 0) > 0
                ? (
                    ((distributionData?.summary?.unallocated || 0) /
                      (distributionData?.summary?.totalStock || 1)) *
                    100
                  ).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-4">
          <DataTable
            pageKey="inventoryStockDistribution"
            columns={columns}
            data={products}
            totalCount={totalCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPaginationChange={handlePaginationChange}
            isLoading={isLoading}
            searchPlaceholder="Search by name or SKU..."
            emptyMessage="No products found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
