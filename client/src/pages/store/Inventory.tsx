import { DataTable } from "@/components/DataTable/DataTable";
import { useFilterStore } from "@/components/Store/useFilterStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDataTable } from "@/hooks/use-data-table";
import type { ProductWithDetails } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeftRight, Globe, Package, RefreshCw, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RequestDialog } from "./utils/RequestDialog";
import { formatPrice } from "./utils/cartUtils";
import { FilterItem, ShopProduct, StoreTreeNode } from "./utils/types";

export default function StoreInventoryPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productData, setProductData] = useState<ProductWithDetails>();
  const { categories, colors, fabrics, fetchFilters } = useFilterStore();

  const colorTree = useMemo(
    () =>
      colors.map((color) => ({
        id: color.id,
        label: color.name,
        data: color,
      })),
    [colors],
  );

  const categoryTree: StoreTreeNode[] = useMemo(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        label: cat.name,
        type: "category" as const,
        children:
          cat?.subcategories?.map((sub) => ({
            id: sub.id,
            label: sub.name,
            type: "subcategory" as const,
          })) || [],
      })),
    [categories],
  );

  useEffect(() => {
    if (!categories.length || !colors.length || !fabrics.length) {
      fetchFilters();
    }
  }, [categories.length, colors.length, fabrics.length, fetchFilters]);

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
    queryKey: "/api/store/getProducts",
    initialPageSize: 10,
  });

  const getRequestStatusBadge = useCallback((status: string) => {
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
  }, []);

  const getDistributionBadge = useCallback((channel: string) => {
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
  }, []);

  const requestDialog = useCallback((item: ShopProduct) => {
    setDialogOpen(true);
    setProductData(item);
  }, []);
  const inventoryColumns: ColumnDef<ShopProduct>[] = [
    {
      accessorKey: "imageUrl",
      header: "Product",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={
                item.imageUrl ||
                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
              }
              alt=""
              className="w-10 h-12 rounded object-cover"
            />
            <span className="font-medium max-w-[200px] truncate">
              {item.name}
            </span>
          </div>
        );
      },
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
      accessorKey: "category.name",
      header: "Category",
      cell: ({ row }) => <span>{row.original.category?.name || "-"}</span>,
    },
    {
      accessorKey: "color.name",
      header: "Color",
      cell: ({ row }) => <span>{row.original.color?.name || "-"}</span>,
    },
    {
      accessorKey: "fabric.name",
      header: "Fabric",
      cell: ({ row }) => <span>{row.original.fabric?.name || "-"}</span>,
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            {item.activeSale && item.discountedPrice ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">
                  {formatPrice(item.discountedPrice)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(item.price)}
                </span>
              </div>
            ) : (
              <span className="font-medium">{formatPrice(item.price)}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "distributionChannel",
      header: "Availability",
      cell: ({ row }) => getDistributionBadge(row.original.distributionChannel),
    },
    {
      accessorKey: "totalStock",
      header: "Your Stock",
      cell: ({ row }) => {
        const item = row.original;
        return item.totalStock > 0 ? (
          <Badge
            variant={item.totalStock < 5 ? "secondary" : "default"}
            className={
              item.totalStock < 5
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                : ""
            }
          >
            {item.totalStock} in stock
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

        // For now, enable all request buttons since we don't have stock request data
        const isDisabled = false;
        const disabledReason = "";

        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => requestDialog(item)}
            disabled={isDisabled}
            title={disabledReason}
            aria-label={`Request stock for ${item.name}`}
          >
            Request
          </Button>
        );
      },
    },
  ];

  const filters: FilterItem[] = useMemo(
    () => [
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
    ],
    [categoryTree, colorTree],
  );
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
            aria-label="Refresh product list"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refetch
          </Button>
          <Link to="/store/requests">
            <Button
              size="sm"
              data-testid="button-request-stock"
              aria-label="View stock requests page"
            >
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
        className="[&_table]:text-xs [&_th]:h-8 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1"
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
