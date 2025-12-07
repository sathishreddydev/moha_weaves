import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Truck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DataTable, FilterConfig } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { OrderWithItems } from "@shared/schema";

const statusConfig: Record<
  string,
  { icon: typeof Clock; label: string; color: string }
> = {
  pending: {
    icon: Clock,
    label: "Pending",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  confirmed: {
    icon: CheckCircle,
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  processing: {
    icon: Package,
    label: "Processing",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  shipped: {
    icon: Truck,
    label: "Shipped",
    color:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  delivered: {
    icon: CheckCircle,
    label: "Delivered",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
};

const orderStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const formatPrice = (price: string | number) => {
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

export default function InventoryOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(
    null
  );

  const {
    data: orders,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    handleSearchChange,
    handleFiltersChange,
    handleDateFilterChange,
    refetch,
  } = useDataTable<OrderWithItems>({
    queryKey: "/api/inventory/orders",
    initialPageSize: 10,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/orders/${id}/status`,
        { status }
      );
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Order status updated" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      });
    },
  });

  const columns: ColumnDef<OrderWithItems>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "Order ID",
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
        accessorKey: "items",
        header: "Items",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {(row.original.items || []).slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="w-10 h-12 rounded overflow-hidden bg-muted"
              >
                <img
                  src={
                    item.saree?.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                  }
                  alt={item.saree?.name || "Saree"}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {(row.original.items?.length || 0) > 2 && (
              <span className="text-xs text-muted-foreground">
                +{(row.original.items?.length || 0) - 2}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatPrice(row.original.totalAmount)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status =
            statusConfig[row.original.status] || statusConfig.pending;
          const StatusIcon = status.icon;
          return (
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Select
            value={row.original.status}
            onValueChange={(value) =>
              updateStatusMutation.mutate({
                id: row.original.id,
                status: value,
              })
            }
            disabled={updateStatusMutation.isPending}
          >
            <SelectTrigger
              className="w-36"
              data-testid={`select-status-${row.original.id}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orderStatuses.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
    ],
    [updateStatusMutation]
  );

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      options: orderStatuses.map((status) => ({
        label: status.charAt(0).toUpperCase() + status.slice(1),
        value: status,
      })),
    },
  ];

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Online Orders
            </h1>
            <p className="text-muted-foreground">
              Process and dispatch online orders
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <DataTable
              columns={columns}
              data={orders}
              totalCount={totalCount}
              pageIndex={pageIndex}
              pageSize={pageSize}
              onPaginationChange={handlePaginationChange}
              onSearchChange={handleSearchChange}
              onFiltersChange={handleFiltersChange}
              onDateFilterChange={handleDateFilterChange}
              isLoading={isLoading}
              searchPlaceholder="Search orders..."
              filters={filters}
              dateFilter={{ key: "date", label: "Filter by date" }}
              emptyMessage="No orders found"
            />
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={!!selectedOrder}
        onOpenChange={() => setSelectedOrder(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Order #{selectedOrder?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Shipping Address</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.shippingAddress}
                  </p>
                  {selectedOrder.phone && (
                    <p className="text-sm text-muted-foreground">
                      Phone: {selectedOrder.phone}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="font-medium text-sm mb-2">Items</p>
                <div className="space-y-2">
                  {(selectedOrder.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 border rounded"
                    >
                      <img
                        src={
                          item.saree?.imageUrl ||
                          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                        }
                        alt={item.saree?.name || "Saree"}
                        className="w-12 h-16 rounded object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-1">
                          {item.saree?.name || "Unknown Saree"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} x {formatPrice(item.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="font-bold">
                  {formatPrice(selectedOrder.totalAmount)}
                </span>
              </div>

              {selectedOrder.notes && (
                <div className="text-sm">
                  <p className="font-medium">Notes</p>
                  <p className="text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
