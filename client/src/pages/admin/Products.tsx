import { DataTable } from "@/components/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { useDataTable } from "@/hooks/use-data-table";
import { formatPrice } from "@/lib/utils";
import type { ProductWithDetails } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { Link } from "react-router-dom";

export default function AdminProducts() {
  const {
    data: products,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
  } = useDataTable<ProductWithDetails>({
    queryKey: "/api/admin/getProducts",
    initialPageSize: 10,
    pageKey:'adminProductsPage'
  });

  const columns: ColumnDef<ProductWithDetails>[] = useMemo(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <Link 
            to={`/admin/products/${row.original.id}`}
            className="text-medium text-primary hover:underline cursor-pointer"
          >
            {row.original.sku || "-"}
          </Link>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="max-w-[200px] truncate">
            <span >{row.original.name}</span>
            {row.original.isFeatured && (
              <Badge variant="secondary" className="ml-2 text-xs">
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
        accessorKey: "distributionChannel",
        header: "Channel",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.distributionChannel}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Product Stock Overview
        </h1>
      </div>

      <DataTable
        pageKey="adminProductsPage"
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
    </div>
  );
}
