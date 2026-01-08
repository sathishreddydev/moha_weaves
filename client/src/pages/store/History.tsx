import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Receipt,
  User,
  Phone,
  ArrowLeftRight,
  Download,
  Clock,
  AlertCircle,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { StoreSaleWithItems } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";

export default function StoreHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSale, setSelectedSale] = useState<StoreSaleWithItems | null>(
    null,
  );

  const {
    data: sales,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    isFetching,
    handlePaginationChange,
    handleSearchChange,
    handleDateFilterChange,
    refetch,
  } = useDataTable<StoreSaleWithItems>({
    queryKey: "/api/store/sales/paginated",
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

  const exportToExcel = () => {
    if (!sales || sales.length === 0) {
      return;
    }

    // Prepare data for Excel export
    const excelData = sales.map((sale) => {
      const items = sale.items
        .map(
          (item: any) =>
            `${item.saree.name} (${item.quantity} x ${formatPrice(item.price)})`,
        )
        .join("; ");

      return {
        "Sale ID": `#${sale.id}`,
        Date: formatDate(sale.createdAt),
        "Customer Name": sale.customerName || "Walk-in Customer",
        "Customer Phone": sale.customerPhone || "-",
        Items: items,
        "Items Count": sale.items.length,
        "Sale Type": sale.saleType === "walk_in" ? "Walk-in" : "Reserved",
        "Total Amount": parseFloat(sale.totalAmount.toString()),
        "Payment Mode": sale.paymentMode || "-",
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales History");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileName = `sales_history_${new Date().toISOString().split("T")[0]}.xlsx`;
    saveAs(data, fileName);
  };

  const salesColumns: ColumnDef<StoreSaleWithItems>[] = [
    {
      accessorKey: "id",
      header: "Sale ID",
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
        const sale = row.original;
        return sale.customerName ? (
          <div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="font-medium truncate max-w-[150px]">
                    {sale.customerName.split(" ")[0]}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <span>{sale.customerName}</span> 
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {sale.customerPhone && (
              <p className="text-xs text-muted-foreground">
                {sale.customerPhone}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">Walk-in Customer</span>
        );
      },
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }) => {
        const sale = row.original;
        return (
          <div className="flex items-center gap-1">
            {sale.items.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="w-10 h-12 rounded overflow-hidden bg-muted"
              >
                <img
                  src={
                    item.saree.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                  }
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {sale.items.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{sale.items.length - 2}
              </span>
            )}
          </div>
        );
      },
    },

    {
      id: "exchangeEligibility",
      header: "Exchange",
      cell: ({ row }) => {
        const sale = row.original;
        const eligibility = sale.eligibilityData;

        if (!eligibility) {
          return (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Checking...</span>
            </div>
          );
        }

        if (!eligibility.eligible) {
          return (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span className="text-xs text-red-600">Not eligible</span>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-600">
              {eligibility.daysRemaining || 0} days left
            </span>
          </div>
        );
      },
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
    {
      id: "invoice",
      header: "Invoice",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size={"sm"}
            onClick={() => navigate(`/store/invoice/${row.original.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const sale = row.original;
        const eligibility = sale.eligibilityData;
        const isFullyReturned = sale.items.every(
          (item: any) => item.quantity === (item.returnedQuantity || 0),
        );

        if (isFullyReturned) {
          return (
            <Badge variant="secondary" className="text-xs">
              Fully Returned
            </Badge>
          );
        }

        const isExchangeDisabled = eligibility && !eligibility.eligible;

        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSale(sale)}
            >
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/store/exchange/${sale.id}`);
              }}
              disabled={isExchangeDisabled}
              title={
                isExchangeDisabled ? eligibility?.reason : "Process Exchange"
              }
            >
              <ArrowLeftRight className="h-4 w-4" />
              Exch
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Sales History
            </h1>
            {isFetching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Fetching data...
              </div>
            )}
            <p className="text-muted-foreground">
              View all past in-store transactions
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
            <Button
              size="sm"
              variant="outline"
              onClick={exportToExcel}
              disabled={!sales || sales.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Excel
            </Button>
          </div>
        </div>

        <DataTable
          columns={salesColumns}
          data={sales}
          totalCount={totalCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPaginationChange={handlePaginationChange}
          onSearchChange={handleSearchChange}
          onDateFilterChange={handleDateFilterChange}
          isLoading={isLoading}
          searchPlaceholder="Search by sale ID..."
          dateFilter={{ key: "date", label: "Filter by date" }}
          emptyMessage="No sales history yet"
        />
      </div>

      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Sale Details
            </DialogTitle>
            <DialogDescription>
              #{selectedSale?.id} -{" "}
              {selectedSale && formatDate(selectedSale.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              {(selectedSale.customerName || selectedSale.customerPhone) && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  {selectedSale.customerName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {selectedSale.customerName}
                    </div>
                  )}
                  {selectedSale.customerPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedSale.customerPhone}
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="font-medium text-sm mb-2">Items Sold</p>
                <div className="space-y-2">
                  {selectedSale.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 border rounded-lg"
                    >
                      <img
                        src={
                          item.saree.imageUrl ||
                          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                        }
                        alt=""
                        className="w-12 h-16 rounded object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-1">
                          {item.saree.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} x{" "}
                          {item.saree.activeSale &&
                          item.saree.discountedPrice ? (
                            <span className="flex items-center gap-1">
                              <span>
                                {formatPrice(item.saree.discountedPrice)}
                              </span>
                              <span className="text-xs line-through text-muted-foreground">
                                {formatPrice(item.price)}
                              </span>
                            </span>
                          ) : (
                            <span>{formatPrice(item.price)}</span>
                          )}
                        </p>
                        {(item.returnedQuantity || 0) > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs mt-1 text-orange-600 border-orange-600"
                          >
                            {item.returnedQuantity} returned
                          </Badge>
                        )}
                      </div>
                      <span className="font-medium">
                        {item.saree.activeSale && item.saree.discountedPrice ? (
                          <div className="flex items-center gap-2">
                            <span>
                              {formatPrice(
                                item.saree.discountedPrice * item.quantity,
                              )}
                            </span>
                            <span className="text-xs line-through text-muted-foreground">
                              {formatPrice(
                                parseFloat(item.price) * item.quantity,
                              )}
                            </span>
                          </div>
                        ) : (
                          <span>
                            {formatPrice(
                              parseFloat(item.price) * item.quantity,
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="font-bold">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(selectedSale.totalAmount)}
                </span>
              </div>

              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => navigate(`/store/exchange/${selectedSale.id}`)}
                disabled={selectedSale.eligibilityData?.eligible === false}
                title={
                  selectedSale.eligibilityData?.eligible === false
                    ? selectedSale.eligibilityData?.reason
                    : "Process Exchange"
                }
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Process Exchange
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
