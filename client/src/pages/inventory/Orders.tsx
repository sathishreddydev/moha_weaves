import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Truck,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DataTable, FilterConfig } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { OrderWithItems } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { itemStatusConfig } from "@/constants/itemStatusConfig";


const itemStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

const getItemStatusFlow = (currentStatus: string) => {
  const flow: Record<string, string[]> = {
    pending: ["confirmed"],
    confirmed: ["processing"],
    processing: ["shipped"],
    shipped: ["delivered"],
    delivered: [],
  };
  return flow[currentStatus] || [];
};

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
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
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

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/orders/${orderId}/items/${itemId}/status`,
        { status }
      );
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Item status updated" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      const extracted = message.includes(":") ? message.split(":").slice(1).join(":").trim() : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update item status",
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
          <button
            type="button"
            className="font-mono text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => navigate(`/inventory/orders/${row.original.id}`)}
          >
            #{row.original.id}
          </button>
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
        cell: ({ row }) => {
          const order = row.original;
          const isExpanded = expandedOrders.has(order.id);
          
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {(order.items || []).slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      className="w-8 h-10 rounded overflow-hidden bg-muted border"
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
                  {(order.items?.length || 0) > 2 && (
                    <span className="text-xs text-muted-foreground font-medium">
                      +{(order.items?.length || 0) - 2}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newExpanded = new Set(expandedOrders);
                    if (isExpanded) {
                      newExpanded.delete(order.id);
                    } else {
                      newExpanded.add(order.id);
                    }
                    setExpandedOrders(newExpanded);
                  }}
                  className="h-6 w-6 p-0"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>
              
              {isExpanded && (
                <div className="space-y-2 mt-2 pl-2 border-l-2 border-muted">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs">
                      <img
                        src={
                          item.saree?.imageUrl ||
                          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=30"
                        }
                        alt={item.saree?.name || "Saree"}
                        className="w-6 h-8 rounded object-cover"
                      />
                      <span className="font-medium truncate max-w-32">
                        {item.saree?.name || "Unknown"}
                      </span>
                      <span className="text-muted-foreground">
                        Qty: {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        },
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
        header: "Item Statuses",
        cell: ({ row }) => {
          const order = row.original;
          const itemStatuses = order.items?.map(item => item.status) || [];
          const uniqueStatuses = Array.from(new Set(itemStatuses));
          
          if (uniqueStatuses.length === 0) {
            return (
              <Badge variant="outline" className="text-xs">
                No items
              </Badge>
            );
          }
          
          if (uniqueStatuses.length === 1) {
            const status = itemStatusConfig[uniqueStatuses[0]] || itemStatusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <Badge className={`${status.color} text-xs`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label} ({order.items?.length || 0})
              </Badge>
            );
          }

          const statusCounts = itemStatuses.reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <div className="flex flex-wrap gap-1 max-w-48">
              {Object.entries(statusCounts).map(([status, count]) => {
                const currentStatusConfig = itemStatusConfig[status] || itemStatusConfig.pending;
                const StatusIcon = currentStatusConfig.icon;
                return (
                  <Badge key={status} className={`${currentStatusConfig.color} text-xs`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {currentStatusConfig.label} ({count})
                  </Badge>
                );
              })}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const order = row.original;
          
          return (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => navigate(`/inventory/orders/${order.id}`)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Order Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/inventory/orders/${order.id}?print=1`)}>
                    <Package className="h-4 w-4 mr-2" />
                    Print Order
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {order.items?.map((item) => {
                    const currentStatusConfig = itemStatusConfig[item.status] || itemStatusConfig.pending;
                    const StatusIcon = currentStatusConfig.icon;
                    const nextStatuses = getItemStatusFlow(item.status);
                    
                    return (
                      <div key={item.id} className="px-2 py-1">
                        <div className="flex items-center gap-2 mb-1">
                          <img
                            src={
                              item.saree?.imageUrl ||
                              "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=20"
                            }
                            alt={item.saree?.name || "Saree"}
                            className="w-5 h-6 rounded object-cover"
                          />
                          <span className="text-xs font-medium truncate max-w-24">
                            {item.saree?.name || "Unknown"}
                          </span>
                          <Badge className={`${currentStatusConfig.color} text-xs`}>
                            <StatusIcon className="h-2 w-2 mr-1" />
                            {currentStatusConfig.label}
                          </Badge>
                        </div>
                        {nextStatuses.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {nextStatuses.map((nextStatus) => {
                              const nextStatusConfig = itemStatusConfig[nextStatus];
                              return (
                                <Button
                                  key={nextStatus}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => {
                                    updateItemStatusMutation.mutate({
                                      orderId: order.id,
                                      itemId: item.id,
                                      status: nextStatus,
                                    });
                                  }}
                                  disabled={updateItemStatusMutation.isPending}
                                >
                                  {nextStatusConfig.label}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [navigate, updateItemStatusMutation, expandedOrders]
  );

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Item Status",
      options: itemStatuses.map((status) => {
        const config = itemStatusConfig[status];
        return {
          label: config?.label || status,
          value: status,
        };
      }),
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
              Order #{selectedOrder?.id}
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
