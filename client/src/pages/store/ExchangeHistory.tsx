import { useState } from "react";
import {
  ArrowLeftRight,
  User,
  Phone,
  Calendar,
  Package,
  ArrowLeft,
  RefreshCw,
  Eye,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { DataTable } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { StoreExchangeWithDetails } from "@shared/schema";
import { useNavigate } from "react-router-dom";

export default function StoreExchangeHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    data: exchanges,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    isFetching,
    handlePaginationChange,
    handleSearchChange,
    handleDateFilterChange,
    refetch,
  } = useDataTable<StoreExchangeWithDetails>({
    queryKey: "/api/store/store-exchanges",
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

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const exchangesColumns: ColumnDef<StoreExchangeWithDetails>[] = [
    {
      accessorKey: "id",
      header: "Exchange ID",
      cell: ({ row }) => (
        <span className="font-mono text-sm">#{row.original.id}</span>
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
      cell: ({ row }) => {
        const exchange = row.original;
        return exchange.customerName ? (
          <div>
            <p className="font-medium">{exchange.customerName}</p>
            {exchange.customerPhone && (
              <p className="text-xs text-muted-foreground">
                {exchange.customerPhone}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">Walk-in Customer</span>
        );
      },
    },
    {
      accessorKey: "originalSale",
      header: "Original Sale",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          #{row.original.originalSale.id}
        </span>
      ),
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }) => {
        const exchange = row.original;
        const totalItems =
          exchange.returnItems.length + exchange.newItems.length;

        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {exchange.returnItems.length} returned
            </Badge>
            {exchange.newItems.length > 0 && (
              <Badge variant="outline">{exchange.newItems.length} new</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {totalItems} total
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "balanceDirection",
      header: "Balance",
      cell: ({ row }) => {
        const exchange = row.original;
        const balance = parseFloat(exchange.balanceAmount);

        if (exchange.balanceDirection === "refund_to_customer") {
          return (
            <Badge className="text-green-600 border-green-600">
              Refund {formatPrice(balance)}
            </Badge>
          );
        } else if (exchange.balanceDirection === "due_from_customer") {
          return (
            <Badge className="text-orange-600 border-orange-600">
              Due {formatPrice(balance)}
            </Badge>
          );
        } else {
          return <Badge variant="secondary">Even Exchange</Badge>;
        }
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "completed" ? "default" : "secondary"
          }
        >
          {row.original.status === "completed"
            ? "Completed"
            : row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground max-w-32 truncate">
          {row.original.reason || "Not specified"}
        </span>
      ),
    },
    {
      id: "invoice",
      header: "Invoice",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/store/invoice/${row.original.originalSale.id}`)
            }
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
        </div>
      ),
    },
  ];

  const renderAccordionContent = (exchange: StoreExchangeWithDetails) => {
    return (
      <div className="space-y-4">
        {/* Return Items Section */}
        {exchange.returnItems.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-red-600 mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Returned Items ({exchange.returnItems.length})
            </h4>
            <div className="space-y-2">
              {exchange.returnItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.product.category?.name} • {item.product.color?.name} •{" "}
                      {item.product.fabric?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} × {formatPrice(item.unitPrice)} ={" "}
                      {formatPrice(item.returnAmount)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    Return
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Items Section */}
        {exchange.newItems.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-green-600 mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Exchange Items ({exchange.newItems.length})
            </h4>
            <div className="space-y-2">
              {exchange.newItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.product.category?.name} • {item.product.color?.name} •{" "}
                      {item.product.fabric?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} × {formatPrice(item.unitPrice)} ={" "}
                      {formatPrice(item.lineAmount)}
                    </p>
                  </div>
                  <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
                    New
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exchange Summary */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Return Amount</p>
              <p className="font-medium text-red-600">
                {formatPrice(exchange.returnAmount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Exchange Amount</p>
              <p className="font-medium text-green-600">
                {formatPrice(exchange.newItemsAmount)}
              </p>
            </div>
          </div>
          {exchange.balanceAmount !== "0" && (
            <div className="mt-2 p-2 bg-muted rounded">
              <p className="text-sm font-medium">
                {exchange.balanceDirection === "due_from_customer"
                  ? `Customer pays: ${formatPrice(exchange.balanceAmount)}`
                  : exchange.balanceDirection === "refund_to_customer"
                    ? `Refund to customer: ${formatPrice(exchange.balanceAmount)}`
                    : "Even Exchange"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              Exchange History
            </h1>
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
          </div>
          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Fetching data...
            </div>
          )}
          <p className="text-muted-foreground">
            View all past store exchanges and returns
          </p>
        </div>

        <DataTable
          columns={exchangesColumns}
          data={exchanges}
          totalCount={totalCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPaginationChange={handlePaginationChange}
          onSearchChange={handleSearchChange}
          onDateFilterChange={handleDateFilterChange}
          isLoading={isLoading}
          searchPlaceholder="Search by exchange ID..."
          dateFilter={{ key: "date", label: "Filter by date" }}
          emptyMessage="No exchange history yet"
          accordion={true}
          accordionContent={renderAccordionContent}
          accordionPosition="inline"
        />
      </div>
    </div>
  );
}
