import { DataTable } from "@/components/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDataTable } from "@/hooks/use-data-table";
import type { StoreExchangeWithDetails } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeftRight, Eye, Package, RefreshCw, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDate, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function InventoryStoreExchanges() {
  const {
    data: exchanges,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    isFetching,
    handlePaginationChange,
    refetch,
  } = useDataTable<StoreExchangeWithDetails>({
    queryKey: "/api/inventory/store-exchanges",
    initialPageSize: 10,
    pageKey: "inventoryStoreExchanges",
  });

  const parseImages = (value: string) => {
    try {
      const firstParse = JSON.parse(value || "[]");
      return typeof firstParse === "string"
        ? JSON.parse(firstParse)
        : firstParse;
    } catch {
      return [];
    }
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
      accessorKey: "store",
      header: "Store",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.store?.name}</span>
        </div>
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
          #{row.original.originalSale?.id}
        </span>
      ),
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }) => {
        const exchange = row.original;
        const totalItems =
          exchange.returnItems?.length + exchange.newItems?.length;

        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {exchange.returnItems?.length || 0} returned
            </Badge>
            {exchange.newItems?.length > 0 && (
              <Badge variant="outline">
                {exchange.newItems?.length || 0} new
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
      accessorKey: "balanceAmount",
      header: "Balance",
      cell: ({ row }) => {
        const exchange = row.original;
        const balance = parseFloat(exchange.balanceAmount || "0");

        if (exchange.balanceDirection === "due_from_customer") {
          return (
            <Badge>
              Paid {formatPrice(balance)}
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
      accessorKey: "processor",
      header: "Processed By",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.processor?.name || "System"}
        </span>
      ),
    },
  
  ];

  const renderAccordionContent = (exchange: StoreExchangeWithDetails) => {
    return (
      <div className="space-y-4">
        {/* Return Items Section */}
        {exchange.returnItems && exchange.returnItems.length > 0 && (
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
                    <p className="font-medium text-sm">{item.product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.product?.category?.name} • {item.product?.color?.name}{" "}
                      • {item.product?.fabric?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} × {formatPrice(item.unitPrice)} ={" "}
                      {formatPrice(item.returnAmount)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {item.exchangeType === "damage" ? "Damage" : "Normal"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.specificReason?.replace(/_/g, " ")}
                      </span>
                    </div>
                    {item.exchangeType === "damage" &&
                      item.damageImages &&
                      parseImages(item.damageImages).length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-red-600 mb-1">
                            Damage Photos:
                          </p>
                          <div className="flex gap-1">
                            {parseImages(item.damageImages).map(
                              (url: string, index: number) => (
                                <img
                                  key={index}
                                  src={url}
                                  alt={`Damage ${index + 1}`}
                                  className="w-12 h-12 rounded object-cover border cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => window.open(url, "_blank")}
                                />
                              ),
                            )}
                          </div>
                        </div>
                      )}
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
        {exchange.newItems && exchange.newItems.length > 0 && (
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
                    <p className="font-medium text-sm">{item.product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.product?.category?.name} • {item.product?.color?.name}{" "}
                      • {item.product?.fabric?.name}
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
                {formatPrice(exchange.returnAmount || "0")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Exchange Amount</p>
              <p className="font-medium text-green-600">
                {formatPrice(exchange.newItemsAmount || "0")}
              </p>
            </div>
          </div>
          {exchange.balanceAmount && exchange.balanceAmount !== "0" && (
            <div className="mt-2 p-2 bg-muted rounded">
              <p className="text-sm font-medium">
                {exchange.balanceDirection === "due_from_customer"
                  ? `Customer paid: ${formatPrice(exchange.balanceAmount)}`
                  : "Even Exchange"}
              </p>
            </div>
          )}
        </div>

        {/* Exchange Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Processed By</p>
            <p className="font-medium">{exchange.processor?.name || "System"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Exchange Notes</p>
            <p className="font-medium">{exchange.notes || "No notes"}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              Store Exchanges
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
          <p className="text-xs text-muted-foreground">
            View all store exchange orders and returns across locations
          </p>
        </div>

         <DataTable
              pageKey="inventoryStoreExchanges"
              columns={exchangesColumns}
              data={exchanges || []}
              totalCount={totalCount || 0}
              pageIndex={pageIndex}
              pageSize={pageSize}
              onPaginationChange={handlePaginationChange}
              isLoading={isLoading}
              searchPlaceholder="Search by exchange ID, store, or customer..."
              emptyMessage="No store exchanges found"
              accordion={true}
              accordionContent={renderAccordionContent}
              accordionPosition="inline"
            />
      </div>
    </div>
  );
}
