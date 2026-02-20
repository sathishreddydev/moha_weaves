import { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Store,
  Filter,
  Download,
  RefreshCw,
  Package,
  ArrowUpDown,
  AlertTriangle,
  ArrowLeftRight,
  User,
  FileText,
  Search,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/DataTable/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { StockMovement } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { DistributionChannel } from "./utils/enums";
import { useDataTable } from "@/hooks/use-data-table";

interface StockStats {
  totalOnlineCleared: number;
  totalStoreCleared: number;
  onlineMovements: StockMovement[];
  storeMovements: StockMovement[];
}

interface StockMovementWithDetails extends StockMovement {
  productName?: string;
  storeName?: string;
  userName?: string; // Added for audit trail
}

interface AuditLogEntry {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType: "product" | "stock_request" | "order" | "stock_movement";
  entityId: string;
  oldValues?: any;
  newValues?: any;
  timestamp: Date;
  notes?: string;
}

export default function StockMovements() {
  const { toast } = useToast();

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<StockStats>({
    queryKey: ["/api/inventory/stock-stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Use useDataTable for paginated stock movements
  const {
    data: movements,
    totalCount,
    isLoading: movementsLoading,
    pageIndex,
    pageSize,
    handlePaginationChange,
    refetch: refetchMovements,
  } = useDataTable<StockMovementWithDetails>({
    queryKey: "/api/inventory/stock-movements",
    initialPageSize: 10,
    pageKey: "inventoryStockmovments",
  });

  const handleRefresh = () => {
    refetchStats();
    refetchMovements();
  };

  const handleDownloadExcel = () => {
    if (!movements || movements.length === 0) {
      toast({
        title: "No Data",
        description: "No movements to download",
        variant: "destructive",
      });
      return;
    }

    const excelData = movements.map((movement: StockMovementWithDetails) => ({
      Date: formatDate(movement.createdAt),
      "Product Name": movement.productName || "Unknown",
      Quantity: Math.abs(movement.quantity),
      Type: movement.movementType,
      Source: movement.source,
      Store: movement.storeName || "-",
      "Order Reference": movement.orderRefId,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Movements");

    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Date
      { wch: 30 }, // Product Name
      { wch: 10 }, // Quantity
      { wch: 10 }, // Type
      { wch: 10 }, // Source
      { wch: 15 }, // Store
      { wch: 20 }, // Order Reference
    ];
    worksheet["!cols"] = columnWidths;

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(
      data,
      `stock_movements_${new Date().toISOString().split("T")[0]}.xlsx`,
    );

    toast({
      title: "Success",
      description: "Excel file downloaded successfully",
    });
  };

  const columns: ColumnDef<StockMovementWithDetails>[] = useMemo(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date & Time",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: "productName",
        header: "Product",
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <span className="font-medium line-clamp-1">
              {row.original.productName || "Unknown Product"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => {
          const quantity = Math.abs(row.original.quantity);
          const type = row.original.movementType;

          return (
            <div className="flex items-center gap-2">
              <span
                className={`font-medium ${
                  type === "sale"
                    ? "text-red-600"
                    : type === "return"
                      ? "text-orange-600"
                      : type === "adjustment"
                        ? "text-orange-600"
                        : "text-green-600"
                }`}
              >
                {type === "sale"
                  ? "-"
                  : type === "return"
                    ? "+"
                    : type === "adjustment"
                      ? "-"
                      : "+"}
                {quantity}
              </span>
              {type === "sale" && (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              {type === "return" && (
                <ArrowUpDown className="h-4 w-4 text-orange-600" />
              )}
              {type === "restock" && (
                <TrendingUp className="h-4 w-4 text-green-600" />
              )}
              {type === "adjustment" && (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              )}
              {type === "exchange" && (
                <ArrowLeftRight className="h-4 w-4 text-green-600" />
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "movementType",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.movementType;
          const variants = {
            sale: "destructive",
            return: "secondary",
            restock: "default",
            transfer: "outline",
            adjustment: "secondary",
            exchange: "default",
          } as const;

          return (
            <Badge variant={variants[type]} className="capitalize">
              {type}
            </Badge>
          );
        },
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => {
          const source = row.original.source;
          return (
            <div className="flex items-center gap-2">
              {source === DistributionChannel.ONLINE ? (
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              ) : (
                <Store className="h-4 w-4 text-green-600" />
              )}
              <Badge variant="outline" className="capitalize">
                {source}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "storeName",
        header: "Store",
        cell: ({ row }) => row.original.storeName || "-",
      },
      {
        accessorKey: "orderRefId",
        header: "Order Reference",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.orderRefId}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Stock Movements</h1>
            <p className="text-muted-foreground">
              Track inventory movements across all channels
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={statsLoading || movementsLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${statsLoading || movementsLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadExcel}
              disabled={!movements || movements.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Online Sales
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats?.totalOnlineCleared || 0}
              </div>
              <p className="text-xs text-muted-foreground">Items sold online</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Store Sales</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.totalStoreCleared || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Items sold in stores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {(stats?.totalOnlineCleared || 0) +
                  (stats?.totalStoreCleared || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Combined sales volume
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Filtered Results
              </CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                Total movements found
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Movements Table */}
        <DataTable
          pageKey="inventoryStockmovments"
          columns={columns}
          data={movements}
          totalCount={totalCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPaginationChange={handlePaginationChange}
          isLoading={movementsLoading}
          searchPlaceholder="Search movements..."
          emptyMessage="No stock movements found"
        />
      </div>
    </div>
  );
}
