import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  Package,
  Globe,
  Store,
  Warehouse,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { ProductWithDetails, Store as StoreType, Category } from "@shared/schema";

interface StoreAllocation {
  storeId: string;
  storeName: string;
  quantity: number;
}

interface StockDistributionRow extends ProductWithDetails {
  unallocated: number;
  storeAllocations: StoreAllocation[];
}

export default function StockDistribution() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isInventoryUser = !!user && (user.role === "inventory" || user.role === "admin");

  // Fetch stores to build dynamic columns
  const { data: stores } = useQuery<StoreType[]>({
    queryKey: ["/api/inventory/stores"],
    enabled: isInventoryUser,
  });

  // Fetch categories for filtering
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
    refetch,
  } = useDataTable<ProductWithDetails>({
    queryKey: "/api/inventory/getProducts",
    initialPageSize: 10,
  });

  const productIdsKey = useMemo(() => {
    if (!products || products.length === 0) return "";
    return products.map((s) => s.id).join(",");
  }, [products]);

  // Fetch allocations for each product and calculate unallocated stock
  const { data: distributionData, isLoading: isLoadingAllocations } = useQuery({
    queryKey: ["/api/inventory/stock-distribution", productIdsKey],
    queryFn: async () => {
      if (!products || products.length === 0) return [];

      const results = await Promise.all(
        products.map(async (product) => {
          try {
            const response = await fetch(
              `/api/inventory/products/${product.id}/allocations`,
              { credentials: "include" }
            );
            if (!response.ok) {
              throw new Error(`${response.status}: ${await response.text()}`);
            }
            const allocations: StoreAllocation[] = await response.json();

            const totalStoreStock = allocations.reduce(
              (sum, a) => sum + a.quantity,
              0
            );
            const unallocated =
              product.totalStock - product.onlineStock - totalStoreStock;

            return {
              ...product,
              unallocated: Math.max(0, unallocated),
              storeAllocations: allocations,
            };
          } catch (error) {
            return {
              ...product,
              unallocated: 0,
              storeAllocations: [],
            };
          }
        })
      );

      return results;
    },
    enabled: !!products && products.length > 0 && !!productIdsKey,
  });

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  // Build dynamic columns including store columns
  const columns: ColumnDef<StockDistributionRow>[] = useMemo(() => {
    const baseColumns: ColumnDef<StockDistributionRow>[] = [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.sku || "-"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "product Name",
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <span className="font-medium line-clamp-1">{row.original.name}</span>
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
            <span className={row.original.unallocated > 0 ? "text-orange-600" : ""}>
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
    const storeColumns: ColumnDef<StockDistributionRow>[] = (stores || []).map(
      (store) => ({
        id: `store-${store.id}`,
        header: store.name,
        cell: ({ row }) => {
          const allocation = row.original.storeAllocations?.find(
            (a) => a.storeId === store.id
          );
          const quantity = allocation?.quantity || 0;
          return (
            <div className="flex items-center gap-1">
              <Store className="h-4 w-4 text-green-500" />
              <span className={quantity > 0 ? "text-green-600" : "text-muted-foreground"}>
                {quantity}
              </span>
            </div>
          );
        },
      })
    );

    return [...baseColumns, ...storeColumns];
  }, [stores]);

  // Calculate summary statistics
  const totalProducts = distributionData?.length || 0;
  const totalStock =
    distributionData?.reduce((sum, item) => sum + item.totalStock, 0) || 0;
  const totalOnline =
    distributionData?.reduce((sum, item) => sum + item.onlineStock, 0) || 0;
  const totalStoreAllocated =
    distributionData?.reduce(
      (sum, item) =>
        sum + item.storeAllocations.reduce((s, a) => s + a.quantity, 0),
      0
    ) || 0;
  const totalUnallocated =
    distributionData?.reduce((sum, item) => sum + item.unallocated, 0) || 0;


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
              {totalStock}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalProducts} products
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
              {totalOnline}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalStock > 0
                ? ((totalOnline / totalStock) * 100).toFixed(1)
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
              {totalStoreAllocated}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalStock > 0
                ? ((totalStoreAllocated / totalStock) * 100).toFixed(1)
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
              {totalUnallocated}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalStock > 0
                ? ((totalUnallocated / totalStock) * 100).toFixed(1)
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
            columns={columns}
            data={distributionData || []}
            totalCount={totalCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPaginationChange={handlePaginationChange}
            isLoading={isLoading || isLoadingAllocations}
            searchPlaceholder="Search by name or SKU..."
            emptyMessage="No products found"
          />
        </CardContent>
      </Card>
    </div>
  );
}