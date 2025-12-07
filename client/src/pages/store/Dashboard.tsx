
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Plus,
  ClipboardList,
  Receipt,
  PackageSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { DataTable, FilterConfig } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SareeWithDetails, StoreSaleWithItems, Category, Color, Fabric } from "@shared/schema";

interface StoreStats {
  todaySales: number;
  todayRevenue: number;
  totalInventory: number;
  pendingRequests: number;
}

type ShopProduct = {
  saree: SareeWithDetails;
  storeStock: number;
};

const formatPrice = (price: number | string) => {
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

export default function StoreDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: loadingStats } = useQuery<StoreStats>({
    queryKey: ["/api/store/stats"],
    enabled: !!user && user.role === "store",
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

  // Sales History Table
  const {
    data: sales,
    totalCount: salesTotalCount,
    pageIndex: salesPageIndex,
    pageSize: salesPageSize,
    isLoading: salesLoading,
    handlePaginationChange: handleSalesPaginationChange,
    handleSearchChange: handleSalesSearchChange,
    handleDateFilterChange: handleSalesDateFilterChange,
  } = useDataTable<StoreSaleWithItems>({
    queryKey: "/api/store/sales/paginated",
    initialPageSize: 10,
  });

  // Inventory Table
  const {
    data: inventory,
    totalCount: inventoryTotalCount,
    pageIndex: inventoryPageIndex,
    pageSize: inventoryPageSize,
    isLoading: inventoryLoading,
    handlePaginationChange: handleInventoryPaginationChange,
    handleSearchChange: handleInventorySearchChange,
    handleFiltersChange: handleInventoryFiltersChange,
    handleDateFilterChange: handleInventoryDateFilterChange,
  } = useDataTable<ShopProduct>({
    queryKey: "/api/store/products/paginated",
    initialPageSize: 10,
  });

  // Sales History Columns
  const salesColumns: ColumnDef<StoreSaleWithItems>[] = [
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
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          {row.original.customerName ? (
            <>
              <p className="font-medium">{row.original.customerName}</p>
              {row.original.customerPhone && (
                <p className="text-xs text-muted-foreground">
                  {row.original.customerPhone}
                </p>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Walk-in Customer</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.items.length} items</span>
      ),
    },
    {
      accessorKey: "saleType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.saleType === "walk_in" ? "Walk-in" : "Reserved"}
        </Badge>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-bold text-primary">
          {formatPrice(row.original.totalAmount)}
        </span>
      ),
    },
  ];

  // Inventory Columns
  const inventoryColumns: ColumnDef<ShopProduct>[] = [
    {
      accessorKey: "saree.imageUrl",
      header: "Image",
      cell: ({ row }) => (
        <img
          src={
            row.original.saree.imageUrl ||
            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
          }
          alt=""
          className="w-10 h-12 rounded object-cover"
        />
      ),
    },
    {
      accessorKey: "saree.name",
      header: "Product",
      cell: ({ row }) => (
        <div>
          <p className="font-medium line-clamp-1">{row.original.saree.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.original.saree.sku || "-"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "saree.category.name",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.saree.category?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "saree.color.name",
      header: "Color",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.saree.color?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "saree.fabric.name",
      header: "Fabric",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.saree.fabric?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "saree.price",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-medium">{formatPrice(row.original.saree.price)}</span>
      ),
    },
    {
      accessorKey: "storeStock",
      header: "Stock",
      cell: ({ row }) => (
        <>
          {row.original.storeStock > 0 ? (
            <Badge
              variant={row.original.storeStock < 5 ? "secondary" : "default"}
            >
              {row.original.storeStock} in stock
            </Badge>
          ) : (
            <Badge variant="destructive">No stock</Badge>
          )}
        </>
      ),
    },
  ];

  const inventoryFilters: FilterConfig[] = [
    {
      key: "categoryId",
      label: "Category",
      options:
        categories?.map((cat) => ({
          label: cat.name,
          value: cat.id,
        })) || [],
    },
    {
      key: "colorId",
      label: "Color",
      options:
        colors?.map((color) => ({
          label: color.name,
          value: color.id,
        })) || [],
    },
    {
      key: "fabricId",
      label: "Fabric",
      options:
        fabrics?.map((fabric) => ({
          label: fabric.name,
          value: fabric.id,
        })) || [],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Store Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your store sales and inventory
          </p>
        </div>
        <Link to="/store/sale">
          <Button data-testid="button-new-sale">
            <Plus className="h-4 w-4 mr-2" />
            New Sale
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      {loadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-today-sales">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Sales
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.todaySales || 0}</div>
              <p className="text-xs text-muted-foreground">transactions</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-today-revenue">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(stats?.todayRevenue || 0)}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-inventory">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Store Inventory
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalInventory || 0}
              </div>
              <p className="text-xs text-muted-foreground">items in stock</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Requests
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.pendingRequests || 0}
              </div>
              <p className="text-xs text-muted-foreground">awaiting approval</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Tables */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales" className="gap-2">
            <Receipt className="h-4 w-4" />
            Sales History
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <PackageSearch className="h-4 w-4" />
            Inventory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <CardContent className="p-4">
              <DataTable
                columns={salesColumns}
                data={sales}
                totalCount={salesTotalCount}
                pageIndex={salesPageIndex}
                pageSize={salesPageSize}
                onPaginationChange={handleSalesPaginationChange}
                onSearchChange={handleSalesSearchChange}
                onDateFilterChange={handleSalesDateFilterChange}
                isLoading={salesLoading}
                searchPlaceholder="Search by sale ID..."
                dateFilter={{ key: "date", label: "Filter by date" }}
                emptyMessage="No sales found"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardContent className="p-4">
              <DataTable
                columns={inventoryColumns}
                data={inventory}
                totalCount={inventoryTotalCount}
                pageIndex={inventoryPageIndex}
                pageSize={inventoryPageSize}
                onPaginationChange={handleInventoryPaginationChange}
                onSearchChange={handleInventorySearchChange}
                onFiltersChange={handleInventoryFiltersChange}
                onDateFilterChange={handleInventoryDateFilterChange}
                isLoading={inventoryLoading}
                searchPlaceholder="Search products..."
                filters={inventoryFilters}
                dateFilter={{ key: "date", label: "Filter by date added" }}
                emptyMessage="No products found"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
