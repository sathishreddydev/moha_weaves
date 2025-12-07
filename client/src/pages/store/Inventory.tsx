
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  Globe,
  Store,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { DataTable, FilterConfig } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { SareeWithDetails, Category, Color, Fabric } from "@shared/schema";

type ShopProduct = {
  saree: SareeWithDetails;
  storeStock: number;
};

export default function StoreInventoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: colors } = useQuery<Color[]>({
    queryKey: ["/api/colors"],
  });

  const { data: fabrics } = useQuery<Fabric[]>({
    queryKey: ["/api/fabrics"],
  });

  const {
    data: products,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    handleSearchChange,
    handleFiltersChange,
    handleDateFilterChange,
  } = useDataTable<ShopProduct>({
    queryKey: "/api/store/products/paginated",
    initialPageSize: 10,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store",
    select: (data: ShopProduct[]) => ({
      total: data.length,
      inStock: data.filter((p) => p.storeStock > 0).length,
      outOfStock: data.filter((p) => p.storeStock === 0).length,
    }),
  });

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const getDistributionBadge = (channel: string) => {
    switch (channel) {
      case "shop":
        return (
          <Badge variant="outline" className="gap-1">
            <Store className="h-3 w-3" />
            Shop Only
          </Badge>
        );
      case "online":
        return (
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" />
            Online
          </Badge>
        );
      case "both":
        return (
          <Badge variant="outline" className="gap-1">
            <ArrowLeftRight className="h-3 w-3" />
            Both
          </Badge>
        );
      default:
        return null;
    }
  };

  const inventoryColumns: ColumnDef<ShopProduct>[] = [
    {
      accessorKey: "saree.imageUrl",
      header: "Product",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={
                item.saree.imageUrl ||
                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
              }
              alt=""
              className="w-10 h-12 rounded object-cover"
            />
            <span className="font-medium max-w-[200px] truncate">
              {item.saree.name}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "saree.sku",
      header: "SKU",
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-sm">
          {row.original.saree.sku || "-"}
        </span>
      ),
    },
    {
      accessorKey: "saree.category.name",
      header: "Category",
      cell: ({ row }) => (
        <span>{row.original.saree.category?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "saree.color.name",
      header: "Color",
      cell: ({ row }) => (
        <span>{row.original.saree.color?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "saree.fabric.name",
      header: "Fabric",
      cell: ({ row }) => (
        <span>{row.original.saree.fabric?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "saree.price",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-medium">
          {formatPrice(row.original.saree.price)}
        </span>
      ),
    },
    {
      accessorKey: "saree.distributionChannel",
      header: "Availability",
      cell: ({ row }) => getDistributionBadge(row.original.saree.distributionChannel),
    },
    {
      accessorKey: "storeStock",
      header: "Your Stock",
      cell: ({ row }) => {
        const item = row.original;
        return item.storeStock > 0 ? (
          <Badge
            variant={item.storeStock < 5 ? "secondary" : "default"}
            className={
              item.storeStock < 5
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                : ""
            }
          >
            {item.storeStock} in stock
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="destructive">No stock</Badge>
            <Link to="/store/requests">
              <Button
                size="sm"
                variant="outline"
                data-testid={`button-request-${item.saree.id}`}
              >
                Request
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];

  const filters: FilterConfig[] = useMemo(
    () => [
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
    ],
    [categories, colors, fabrics]
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Shop Products
          </h1>
          <p className="text-muted-foreground">
            All products available for your store
          </p>
        </div>
        <Link to="/store/requests">
          <Button data-testid="button-request-stock">
            <Package className="h-4 w-4 mr-2" />
            Request Stock
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-sm text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {stats?.inStock || 0}
            </div>
            <p className="text-sm text-muted-foreground">In Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">
              {stats?.outOfStock || 0}
            </div>
            <p className="text-sm text-muted-foreground">Need to Request</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <DataTable
            columns={inventoryColumns}
            data={products}
            totalCount={totalCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPaginationChange={handlePaginationChange}
            onSearchChange={handleSearchChange}
            onFiltersChange={handleFiltersChange}
            onDateFilterChange={handleDateFilterChange}
            isLoading={isLoading}
            searchPlaceholder="Search by name or SKU..."
            filters={filters}
            dateFilter={{ key: "date", label: "Filter by date added" }}
            emptyMessage="No products available for shop"
          />
        </CardContent>
      </Card>
    </div>
  );
}
