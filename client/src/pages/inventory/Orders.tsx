import { DataTable } from "@/components/DataTable/DataTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { itemStatusConfig } from "@/constants/itemStatusConfig";
import { useDataTable } from "@/hooks/use-data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { OrderWithItems } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Calendar, ExternalLink, Package, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate, formatPrice } from "@/lib/utils";
import { useSocket } from "@/stores/socketStore";
const VALID_ITEM_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
] as const;

type ItemStatus = (typeof VALID_ITEM_STATUSES)[number];

// Statuses the inventory team can manually set — must match VALID_ITEM_STATUSES on the server
// Inventory can only move items up to "delivered".
// return_requested and returned are customer/admin actions — shown as read-only.
const ALLOWED_TRANSITIONS: Record<string, ItemStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  return_requested: [],
  returned: [],
};

/** Returns the statuses that can be transitioned to from `currentStatus`. */
function getAllowedNext(currentStatus: string): ItemStatus[] {
  return ALLOWED_TRANSITIONS[currentStatus] ?? [];
}

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = itemStatusConfig[status] || itemStatusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center w-fit capitalize ${config.color}`}
    >
      <StatusIcon size={12} className="mr-1" />
      {config.label}
    </span>
  );
};

/** Shadcn Select that resets to placeholder after each selection. */
function StatusSelect({
  allowedNext,
  disabled,
  onSelect,
}: {
  allowedNext: ItemStatus[];
  disabled: boolean;
  onSelect: (status: string) => void;
}) {
  const [key, setKey] = useState(0);
  return (
    <Select
      key={key}
      disabled={disabled}
      onValueChange={(value) => {
        onSelect(value);
        // Reset to placeholder by remounting
        setKey((k) => k + 1);
      }}
    >
      <SelectTrigger className="w-[160px] text-sm h-9">
        <SelectValue placeholder="Move to…" />
      </SelectTrigger>
      <SelectContent>
        {allowedNext.map((status) => {
          const config = itemStatusConfig[status];
          const Icon = config?.icon;
          return (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                {Icon && <Icon size={13} />}
                {config?.label ?? status}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default function InventoryOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { socket } = useSocket();

  const {
    data: orders,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    refetch,
  } = useDataTable<OrderWithItems>({
    queryKey: "/api/inventory/orders",
    initialPageSize: 10,
    pageKey: "inventoryOnlineOrders",
  });

  // Track which specific item is currently being updated so we can disable
  // only that item's dropdown, not every dropdown on the page.
  const pendingItemIdRef = useRef<string | null>(null);

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      itemId,
      status,
    }: {
      orderId: string;
      itemId: string;
      status: string;
    }) => {
      pendingItemIdRef.current = itemId;
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/orders/${orderId}/items/${itemId}/status`,
        { status },
      );
      return response;
    },
    onSuccess: () => {
      pendingItemIdRef.current = null;
      refetch();
      toast({ title: "Success", description: "Item status updated" });
    },
    onError: (err: unknown) => {
      pendingItemIdRef.current = null;
      const message = err instanceof Error ? err.message : "";
      // Server sends "INVALID_STATUS_TRANSITION: <reason>" — extract the reason
      const extracted = message.includes(":")
        ? message.split(":").slice(1).join(":").trim()
        : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update item status",
        variant: "destructive",
      });
    },
  });

  const updateAllItemsStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/orders/${orderId}/status`,
        { status },
      );
      return response;
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "All items status updated" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      const extracted = message.includes(":")
        ? message.split(":").slice(1).join(":").trim()
        : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!socket) return;
    const handleOrderEvent = () => {
      refetch();
    };
    socket.on("product_purchased", handleOrderEvent);
    return () => {
      socket.off("product_purchased", handleOrderEvent);
    };
  }, [socket, refetch]);

  const updateItemStatus = useCallback(
    (orderId: string, itemId: string, newStatus: string) => {
      updateItemStatusMutation.mutate({ orderId, itemId, status: newStatus });
    },
    [updateItemStatusMutation],
  );

  const updateAllItemsStatus = useCallback(
    (orderId: string, newStatus: string) => {
      updateAllItemsStatusMutation.mutate({ orderId, status: newStatus });
    },
    [updateAllItemsStatusMutation],
  );

  const columns: ColumnDef<OrderWithItems>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "Order",
        cell: ({ row }) => (
          <div>
            <div
              className="font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline"
              onClick={() => navigate(`/inventory/orders/${row.original.id}`)}
            >
              #{row.original.id}
              <ExternalLink size={12} className="opacity-40" />
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Calendar size={12} />
              {formatDate(row.original.createdAt)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
              <User size={16} />
            </div>
            <div>
              <div className="font-medium text-sm text-slate-800">
                {row.original.customerName || "Unknown Customer"}
              </div>
              <div className="text-xs text-slate-500">
                {row.original.phone || "No phone"}
              </div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "items",
        header: "Items",
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div>
              <div className="flex -space-x-2">
                {(order.items || []).slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="h-7 w-7 rounded border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 overflow-hidden"
                  >
                    <img
                      src={
                        item.product?.imageUrl ||
                        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=20"
                      }
                      alt={item.product?.name || "Item"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {(order.items?.length || 0) > 3 && (
                  <div className="h-7 w-7 rounded border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    +{(order.items?.length || 0) - 3}
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {order.items?.length || 0} product(s)
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        cell: ({ row }) => (
          <div className="font-bold text-slate-900">
            {formatPrice(row.original.totalAmount)}
          </div>
        ),
      },
    ],
    [navigate],
  );

  const accordionContent = useCallback(
    (order: OrderWithItems) => {
      // Compute the intersection of allowed next statuses across all items
      // to determine which bulk-update buttons are safe to show.
      const allAllowed = order.items.reduce<ItemStatus[]>((acc, item) => {
        const next = getAllowedNext(item.currentStatus || item.status);
        if (acc.length === 0) return next;
        return acc.filter((s) => next.includes(s));
      }, []);

      return (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Package size={20} className="text-slate-400" />
              Order Details
            </h3>
            {allAllowed.length > 0 && (
              <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 px-2 uppercase tracking-wider">
                  Bulk Update Order:
                </span>
                <div className="flex gap-1">
                  {allAllowed.map((status) => (
                    <Button
                      variant="ghost"
                      key={status}
                      onClick={() => updateAllItemsStatus(order.id, status)}
                      disabled={updateAllItemsStatusMutation.isPending}
                    >
                      {itemStatusConfig[status]?.label ?? status}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {(order.items || []).map((item) => {
              // Use currentStatus (from itemStatusHistory) as the source of truth
              const effectiveStatus = item.currentStatus || item.status;
              const allowedNext = getAllowedNext(effectiveStatus);
              const isThisItemPending =
                updateItemStatusMutation.isPending &&
                pendingItemIdRef.current === item.id;

              return (
                <div
                  key={item.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                      <img
                        src={
                          item.product?.imageUrl ||
                          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=40"
                        }
                        alt={item.product?.name || "Item"}
                        className="w-8 h-8 object-cover rounded"
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">
                        {item.product?.name || "Unknown Item"}
                      </h4>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>SKU: {item.id}</span>
                        <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                        <span>Qty: {item.quantity}</span>
                        {(() => {
                          const variant =
                            item.variantId &&
                            item.product?.variants?.find(
                              (v: any) => v.id === item.variantId,
                            );
                          return variant ? (
                            <>
                              <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                              <span>Size: {variant.size}</span>
                            </>
                          ) : null;
                        })()}
                        <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                        <span>{formatPrice(item.price)} each</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="flex flex-col items-start md:items-end">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Current Status
                      </span>
                      {/* Show currentStatus (history-based) as the badge */}
                      <StatusBadge status={effectiveStatus} />
                    </div>

                    <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

                    {allowedNext.length > 0 && (
                      <div className="w-full md:w-auto">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block md:text-right">
                          Change Status
                        </span>
                        <StatusSelect
                          allowedNext={allowedNext}
                          disabled={isThisItemPending}
                          onSelect={(newStatus) =>
                            updateItemStatus(order.id, item.id, newStatus)
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [
      updateItemStatus,
      updateAllItemsStatus,
      updateItemStatusMutation.isPending,
      updateAllItemsStatusMutation.isPending,
    ],
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            Online Orders
          </h1>
          <p className="text-xs text-muted-foreground">
            View all online orders
          </p>
        </div>
      </div>
      <DataTable
        pageKey="inventoryOnlineOrders"
        columns={columns}
        data={orders || []}
        totalCount={totalCount || 0}
        pageSize={pageSize}
        pageIndex={pageIndex}
        onPaginationChange={handlePaginationChange}
        isLoading={isLoading}
        searchPlaceholder="Search by Order ID or Customer..."
        emptyMessage="No orders found"
        accordion={true}
        accordionContent={accordionContent}
        accordionPosition="inline"
      />
    </div>
  );
}
