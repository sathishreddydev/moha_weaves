import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Package, Globe, Store, ArrowLeftRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type {
  ProductWithDetails,
  StockRequestWithDetails,
} from "@shared/schema";
import { RequestDialog } from "./Utils/RequestDialog";
import { useFilterStore } from "@/components/Store/useFilterStore";
import { TreeNode } from "@/lib/type";
import { FilterItem } from "@/components/Type/type";

type ShopProduct = {
  product: ProductWithDetails & {
    activeSale?: {
      id: string;
      name: string;
      offerType: string;
      discountValue: string;
      maxDiscount?: string;
    } | null;
    discountedPrice?: number;
  };
  storeStock: number;
  stockRequests: StockRequestWithDetails[];
};

export default function StoreInventoryPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productData, setProductData] = useState<ProductWithDetails>();
  const { categories, colors, fabrics, fetchFilters } = useFilterStore();

  const colorTree = colors.map((color) => ({
    id: color.id,
    label: color.name,
    data: color,
  }));

  const categoryTree: TreeNode[] = categories.map((cat) => ({
    id: cat.id,
    label: cat.name,
    children:
      cat?.subcategories?.map((sub) => ({
        id: sub.id,
        label: sub.name,
      })) || [],
  }));

  useEffect(() => {
    if (!categories.length || !colors.length || !fabrics.length) {
      fetchFilters();
    }
  }, [categories, colors, fabrics]);

  const {
    data: products,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    isFetching,
    totalProducts,
    inStockProducts,
    outOfStockProducts,
    handlePaginationChange,
    refetch,
  } = useDataTable<any>({
    queryKey: "/api/store/products/paginated",
    initialPageSize: 10,
  });

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
          >
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
          >
            Approved
          </Badge>
        );
      case "dispatched":
        return (
          <Badge
            variant="secondary"
            className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
          >
            Dispatched
          </Badge>
        );
      case "received":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
          >
            Received
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
  const requestDailog = (item: ShopProduct) => {
    setDialogOpen(true);
    setProductData(item.product);
  };
  const inventoryColumns: ColumnDef<ShopProduct>[] = [
    {
      accessorKey: "product.imageUrl",
      header: "Product",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={
                item.product.imageUrl ||
                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
              }
              alt=""
              className="w-10 h-12 rounded object-cover"
            />
            <span className="font-medium max-w-[200px] truncate">
              {item.product.name}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "product.sku",
      header: "SKU",
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-sm">
          {row.original.product.sku || "-"}
        </span>
      ),
    },
    {
      accessorKey: "product.category.name",
      header: "Category",
      cell: ({ row }) => (
        <span>{row.original.product.category?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "product.color.name",
      header: "Color",
      cell: ({ row }) => <span>{row.original.product.color?.name || "-"}</span>,
    },
    {
      accessorKey: "product.fabric.name",
      header: "Fabric",
      cell: ({ row }) => (
        <span>{row.original.product.fabric?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "product.price",
      header: "Price",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            {item.product.activeSale && item.product.discountedPrice ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">
                  {formatPrice(item.product.discountedPrice)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(item.product.price)}
                </span>
              </div>
            ) : (
              <span className="font-medium">
                {formatPrice(item.product.price)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "product.distributionChannel",
      header: "Availability",
      cell: ({ row }) =>
        getDistributionBadge(row.original.product.distributionChannel),
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
          </div>
        );
      },
    },
    {
      id: "stockRequests",
      header: "Stock Requests",
      cell: ({ row }) => {
        const item = row.original;
        const requests = item.stockRequests || [];

        if (requests.length === 0) {
          return (
            <span className="text-muted-foreground text-sm">No requests</span>
          );
        }

        const latestRequest = requests[0];
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {latestRequest.quantity} units
            </div>
            {getRequestStatusBadge(latestRequest.status)}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original;
        const requests = item.stockRequests || [];
        const latestRequest = requests[0];

        // Disable button if there's a pending, approved, or dispatched request
        const isDisabled =
          latestRequest &&
          ["pending", "approved", "dispatched"].includes(latestRequest.status);

        const disabledReason =
          latestRequest?.status === "pending"
            ? "Request pending"
            : latestRequest?.status === "approved"
              ? "Request approved"
              : latestRequest?.status === "dispatched"
                ? "Request dispatched"
                : "";

        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => requestDailog(item)}
            disabled={isDisabled}
            title={disabledReason}
          >
            Request
          </Button>
        );
      },
    },
  ];

  const filters: FilterItem[] = [
    {
      key: "categoryIds",
      label: "Categories",
      tree: categoryTree,
      placeholder: "Search categories...",
    },
    {
      key: "colorIds",
      label: "Colors",
      tree: colorTree,
      placeholder: "Search colors...",
    },
  ];
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Shop Products
          </h1>
          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Fetching data...
            </div>
          )}
          <p className="text-muted-foreground">
            All products available for your store
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refetch
          </Button>
          <Link to="/store/requests">
            <Button size="sm" data-testid="button-request-stock">
              <Package className="h-4 w-4 mr-2" />
              Stock Requests
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalProducts || 0}</div>
            <p className="text-sm text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {inStockProducts || 0}
            </div>
            <p className="text-sm text-muted-foreground">In Stock Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">
              {outOfStockProducts || 0}
            </div>
            <p className="text-sm text-muted-foreground">
              Out of Stock Products
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={inventoryColumns}
        data={products}
        totalCount={totalCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPaginationChange={handlePaginationChange}
        isLoading={isLoading}
        searchPlaceholder="Search by name or SKU..."
        emptyMessage="No products available for shop"
        filters={filters}
      />
      {dialogOpen && (
        <RequestDialog
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
          productData={productData}
        />
      )}
    </div>
  );
}
