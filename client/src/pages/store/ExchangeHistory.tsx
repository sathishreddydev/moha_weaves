import { useState } from "react";
import { ArrowLeftRight, User, Phone, Calendar, Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { DataTable } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { StoreExchangeWithDetails } from "@shared/schema";

export default function StoreExchangeHistory() {
  const { user } = useAuth();

  const {
    data: exchanges,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    handleSearchChange,
    handleDateFilterChange,
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
        <span className="font-mono text-sm">
          #{row.original.id}
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
        const totalItems = exchange.returnItems.length + exchange.newItems.length;
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {exchange.returnItems.length} returned
            </Badge>
            {exchange.newItems.length > 0 && (
              <Badge variant="outline">
                {exchange.newItems.length} new
              </Badge>
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
          return (
            <Badge variant="secondary">
              Even Exchange
            </Badge>
          );
        }
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge 
          variant={row.original.status === "completed" ? "default" : "secondary"}
        >
          {row.original.status === "completed" ? "Completed" : row.original.status}
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
  ];

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              Exchange History
            </h1>
          </div>
          <p className="text-muted-foreground">
            View all past store exchanges and returns
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
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
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
