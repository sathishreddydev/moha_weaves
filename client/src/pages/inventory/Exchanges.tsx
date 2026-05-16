import { DataTable } from "@/components/DataTable/DataTable";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { itemStatusConfig } from "@/constants/itemStatusConfig";
import { useDataTable } from "@/hooks/use-data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { OnlineExchangeWithDetails } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Package,
  RotateCcw,
  User,
} from "lucide-react";
// Fix 22: import useCallback and useEffect
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate, formatPrice } from "@/lib/utils";
import { ExchangeStatus } from "./utils/enums";
import type { StatusBadgeProps } from "./utils/type";
import { useSocket } from "@/stores/socketStore";
import { ShippingAddressBlock } from "./OrderDetail";

// ─── Status flow ─────────────────────────────────────────────────────────────

const getExchangeStatusFlow = (currentStatus: string): ExchangeStatus[] => {
  const flow: Record<ExchangeStatus, ExchangeStatus[]> = {
    [ExchangeStatus.EXCHANGE_REQUESTED]: [
      ExchangeStatus.EXCHANGE_APPROVED,
      ExchangeStatus.EXCHANGE_CANCELLED,
    ],
    [ExchangeStatus.EXCHANGE_APPROVED]: [
      ExchangeStatus.EXCHANGE_PROCESSING,
      ExchangeStatus.EXCHANGE_CANCELLED,
    ],
    [ExchangeStatus.EXCHANGE_PROCESSING]: [
      ExchangeStatus.EXCHANGE_PICKUP_SCHEDULED,
      ExchangeStatus.EXCHANGE_CANCELLED,
    ],
    [ExchangeStatus.EXCHANGE_PICKUP_SCHEDULED]: [
      ExchangeStatus.EXCHANGE_PICKED_UP,
      ExchangeStatus.EXCHANGE_CANCELLED,
    ],
    [ExchangeStatus.EXCHANGE_PICKED_UP]: [
      ExchangeStatus.EXCHANGE_IN_TRANSIT,
      ExchangeStatus.EXCHANGE_CANCELLED,
    ],
    [ExchangeStatus.EXCHANGE_IN_TRANSIT]: [
      ExchangeStatus.EXCHANGE_RECEIVED,
      ExchangeStatus.EXCHANGE_CANCELLED,
    ],
    [ExchangeStatus.EXCHANGE_RECEIVED]: [
      ExchangeStatus.EXCHANGE_INSPECTED,
      ExchangeStatus.EXCHANGE_CANCELLED,
    ],
    [ExchangeStatus.EXCHANGE_INSPECTED]: [
      ExchangeStatus.EXCHANGE_SHIPPED,
      ExchangeStatus.EXCHANGE_CANCELLED,
    ],
    [ExchangeStatus.EXCHANGE_SHIPPED]: [ExchangeStatus.EXCHANGE_DELIVERED],
    [ExchangeStatus.EXCHANGE_DELIVERED]: [ExchangeStatus.EXCHANGE_COMPLETED],
    [ExchangeStatus.EXCHANGE_COMPLETED]: [],
    [ExchangeStatus.EXCHANGE_CANCELLED]: [],
  };
  return flow[currentStatus as ExchangeStatus] || [];
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config =
    itemStatusConfig[status] ??
    itemStatusConfig[ExchangeStatus.EXCHANGE_REQUESTED];
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function InventoryExchanges() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { socket } = useSocket();

  const [updateDialog, setUpdateDialog] = useState<{
    open: boolean;
    request: OnlineExchangeWithDetails | null;
    status: string;
  }>({ open: false, request: null, status: "" });

  const [inspectionNotes, setInspectionNotes] = useState("");

  const {
    data: exchanges,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    refetch,
  } = useDataTable<OnlineExchangeWithDetails>({
    queryKey: "/api/inventory/online-exchanges",
    initialPageSize: 10,
    pageKey: "inventoryOnlineExchanges",
  });

  // Fix 17: Socket listener for auto-refresh
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => refetch();
    socket.on("product_exchanged", handleRefresh);
    socket.on("exchange_status_updated", handleRefresh);
    return () => {
      socket.off("product_exchanged", handleRefresh);
      socket.off("exchange_status_updated", handleRefresh);
    };
  }, [socket, refetch]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: string;
      notes?: string;
    }) => {
      return await apiRequest(
        "PATCH",
        `/api/inventory/online-exchanges/${id}/status`,
        {
          status,
          inspectionNotes: notes,
        },
      );
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Exchange status updated" });
      setUpdateDialog({ open: false, request: null, status: "" });
      setInspectionNotes("");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      const extracted = message.includes(":")
        ? message.split(":").slice(1).join(":").trim()
        : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update exchange status",
        variant: "destructive",
      });
    },
  });

  // Fix 13: Wrap handleStatusUpdate in useCallback
  const handleStatusUpdate = useCallback(
    (request: OnlineExchangeWithDetails, status: string) => {
      setInspectionNotes(request.inspectionNotes || "");
      setUpdateDialog({ open: true, request, status });
    },
    [],
  );

  const handleConfirmUpdate = useCallback(() => {
    if (updateDialog.request && updateDialog.status) {
      updateStatusMutation.mutate({
        id: updateDialog.request.id,
        status: updateDialog.status,
        notes: inspectionNotes,
      });
    }
  }, [updateDialog, inspectionNotes, updateStatusMutation]);

  // ─── Table columns ────────────────────────────────────────────────────────────

  // Fix 15: Add handleStatusUpdate and updateStatusMutation.isPending to deps
  const columns: ColumnDef<OnlineExchangeWithDetails>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "Exchange",
        cell: ({ row }) => (
          <div>
            <div
              className="font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline"
              onClick={() =>
                navigate(`/inventory/exchanges/${row.original.id}`)
              }
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
        accessorKey: "user",
        header: "Customer",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
              <User size={16} />
            </div>
            <div>
              <div className="font-medium text-sm text-slate-800">
                {row.original.user?.name || "Unknown Customer"}
              </div>
              <div className="text-xs text-slate-500">
                {row.original.user?.email || "No email"}
              </div>
            </div>
          </div>
        ),
      },
      {
        // Fix 19: Make Order ID clickable
        accessorKey: "orderId",
        header: "Order",
        cell: ({ row }) => (
          <div
            className="font-mono text-sm text-primary cursor-pointer hover:underline flex items-center gap-1"
            onClick={() =>
              navigate(`/inventory/orders/${row.original.orderId}`)
            }
          >
            #{row.original.orderId}
            <ExternalLink size={11} className="opacity-40" />
          </div>
        ),
      },
      {
        accessorKey: "items",
        header: "Items",
        cell: ({ row }) => {
          const exchange = row.original;
          return (
            <div>
              <div className="flex -space-x-2">
                {(exchange.items || []).slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className="h-7 w-7 rounded border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 overflow-hidden"
                  >
                    <img
                      src={
                        item.orderItem?.product?.imageUrl ||
                        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=20"
                      }
                      alt={item.orderItem?.product?.name || "Item"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {(exchange.items?.length || 0) > 3 && (
                  <div className="h-7 w-7 rounded border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    +{(exchange.items?.length || 0) - 3}
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {exchange.items?.length || 0} product(s)
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    // Fix 15: include handleStatusUpdate and isPending
    [navigate, handleStatusUpdate, updateStatusMutation.isPending],
  );

  // ─── Accordion detail ─────────────────────────────────────────────────────────

  // Fix 16: Wrap accordionContent in useCallback
  const accordionContent = useCallback(
    (exchange: OnlineExchangeWithDetails) => {
      const nextStatuses = getExchangeStatusFlow(exchange.status);

      return (
        <div className="space-y-5">
          {/* Header row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <ArrowLeftRight size={20} className="text-slate-400" />
              Exchange Details
            </h3>
            {nextStatuses.length > 0 && (
              <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 px-2 uppercase tracking-wider">
                  Quick Actions:
                </span>
                <div className="flex gap-1">
                  {nextStatuses.map((status) => (
                    <Button
                      // Fix 14: cancel uses "destructive", others use "ghost"
                      variant={
                        status === ExchangeStatus.EXCHANGE_CANCELLED
                          ? "destructive"
                          : "ghost"
                      }
                      key={status}
                      size="sm"
                      onClick={() => handleStatusUpdate(exchange, status)}
                      disabled={updateStatusMutation.isPending}
                    >
                      {itemStatusConfig[status]?.label ?? status}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info grid — 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <User size={14} className="text-slate-400" />
                <h4 className="font-semibold text-sm text-slate-700">
                  Customer
                </h4>
              </div>
              <p className="text-sm font-medium">
                {exchange.user?.name || "—"}
              </p>
              <p className="text-xs text-slate-500">
                {exchange.user?.email || "—"}
              </p>
              <p className="text-xs text-slate-500">
                Order:{" "}
                <span
                  className="text-primary cursor-pointer hover:underline font-mono"
                  onClick={() =>
                    navigate(`/inventory/orders/${exchange.orderId}`)
                  }
                >
                  #{exchange.orderId}
                </span>
              </p>
            </div>

            {/* Exchange info */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowLeftRight size={14} className="text-slate-400" />
                <h4 className="font-semibold text-sm text-slate-700">
                  Exchange Info
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status:</span>
                <StatusBadge status={exchange.status} />
              </div>
              <p className="text-sm">
                <span className="text-slate-500 text-xs">Reason: </span>
                <span className="capitalize">
                  {exchange.reason?.replace(/_/g, " ") || "—"}
                </span>
              </p>
              {exchange.processedBy ? (
                <p className="text-xs text-slate-500">
                  Processed by:{" "}
                  <span className="text-slate-700">{exchange.processedBy}</span>
                </p>
              ) : null}
              {exchange.exchangeOrderId ? (
                <p className="text-xs text-slate-500">
                  Exchange order:{" "}
                  <span
                    className="text-primary cursor-pointer hover:underline font-mono"
                    onClick={() =>
                      navigate(`/inventory/orders/${exchange.exchangeOrderId}`)
                    }
                  >
                    #{exchange.exchangeOrderId}
                  </span>
                </p>
              ) : null}
            </div>

            {/* Fix 21: Logistics card */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin size={14} className="text-slate-400" />
                <h4 className="font-semibold text-sm text-slate-700">
                  Logistics
                </h4>
              </div>
              {exchange.order.shippingAddress ? (
                <ShippingAddressBlock raw={exchange.order.shippingAddress} />
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No pickup address set
                </p>
              )}
              {exchange.pickupScheduledAt ? (
                <p className="text-xs text-slate-500">
                  Pickup scheduled: {formatDate(exchange.pickupScheduledAt)}
                </p>
              ) : null}
              {exchange.pickedUpAt ? (
                <p className="text-xs text-slate-500">
                  Picked up: {formatDate(exchange.pickedUpAt)}
                </p>
              ) : null}
              {exchange.receivedAt ? (
                <p className="text-xs text-slate-500">
                  Received: {formatDate(exchange.receivedAt)}
                </p>
              ) : null}
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-1.5">
              <Package size={14} className="text-slate-400" />
              Items Being Exchanged
            </h4>
            {(exchange.items || []).map((item, idx) => (
              <div
                key={`item-${idx}`}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 mb-3 md:mb-0">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden flex-shrink-0">
                    <img
                      src={
                        item.orderItem?.product?.imageUrl ||
                        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=40"
                      }
                      alt={item.orderItem?.product?.name || "Item"}
                      className="w-10 h-10 object-cover rounded"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      {item.orderItem?.product?.name || "Unknown Item"}
                    </h4>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                      <span>SKU: {item.orderItemId}</span>
                      <span className="h-1 w-1 bg-slate-300 rounded-full" />
                      <span>Qty: {item.quantity}</span>
                      {(() => {
                        const oi = item.orderItem as any;
                        const variant =
                          oi?.variantId &&
                          oi?.product?.variants?.find(
                            (v: any) => v.id === oi?.variantId,
                          );
                        return variant ? (
                          <>
                            <span className="h-1 w-1 bg-slate-300 rounded-full" />
                            <span>Size: {variant.size}</span>
                          </>
                        ) : null;
                      })()}
                      <span className="h-1 w-1 bg-slate-300 rounded-full" />
                      {/* Fix 20: price is on orderItem, not product */}
                      <span>
                        {formatPrice((item.orderItem as any)?.price || 0)} each
                      </span>
                    </div>

                    {/* Condition & restockable */}
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {item.condition ? (
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                          Condition: {item.condition}
                        </span>
                      ) : null}
                      {item.isRestockable != null ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            item.isRestockable
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          <CheckCircle2 size={10} />
                          {item.isRestockable
                            ? "Restockable"
                            : "Not restockable"}
                        </span>
                      ) : null}
                    </div>

                    {item.exchangeproductId && (
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                        <span className="font-medium">Exchange for:</span>{" "}
                        Product ID: {item.exchangeproductId}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Status
                  </span>
                  <StatusBadge status={exchange.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {(exchange.reasonDetails || exchange.inspectionNotes) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exchange.reasonDetails ? (
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">
                    Customer Notes
                  </h4>
                  <p className="text-sm text-slate-600">
                    {exchange.reasonDetails}
                  </p>
                </div>
              ) : null}
              {exchange.inspectionNotes ? (
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">
                    Inspection Notes
                  </h4>
                  <p className="text-sm text-slate-600">
                    {exchange.inspectionNotes}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      );
    },
    [handleStatusUpdate, updateStatusMutation.isPending, navigate],
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  // Fix 18: Layout matches Orders/Returns pattern
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Exchanges</h1>
          <p className="text-xs text-muted-foreground">
            Manage customer exchange requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/inventory/returns")}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            View Returns
          </Button>
        </div>
      </div>

      <DataTable
        pageKey="inventoryOnlineExchanges"
        columns={columns}
        data={exchanges || []}
        totalCount={totalCount || 0}
        pageSize={pageSize}
        pageIndex={pageIndex}
        onPaginationChange={handlePaginationChange}
        isLoading={isLoading}
        searchPlaceholder="Search by Exchange ID, Customer, or Order..."
        emptyMessage="No exchange requests found"
        accordion={true}
        accordionContent={accordionContent}
        accordionPosition="inline"
      />

      {/* Status update dialog */}
      <Dialog
        open={updateDialog.open}
        onOpenChange={(open) => setUpdateDialog((d) => ({ ...d, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {updateDialog.status === ExchangeStatus.EXCHANGE_CANCELLED
                ? "Cancel Exchange Request"
                : "Update Exchange Request"}
            </DialogTitle>
            <DialogDescription>
              {updateDialog.status === ExchangeStatus.EXCHANGE_CANCELLED
                ? "Provide a reason for cancellation — this will be shared with the customer."
                : `Change status to "${itemStatusConfig[updateDialog.status]?.label ?? updateDialog.status}". Add notes if needed.`}
            </DialogDescription>
          </DialogHeader>

          {updateDialog.request && (
            <div className="py-2 border-b space-y-2">
              <div className="flex items-center gap-3">
                <img
                  src={
                    updateDialog.request.items[0]?.orderItem?.product
                      ?.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                  }
                  alt=""
                  className="w-12 h-12 rounded object-cover"
                />
                <div>
                  <p className="font-medium">
                    {updateDialog.request.user?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {updateDialog.request.user?.email}
                  </p>
                </div>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Reason: </span>
                <span className="capitalize">
                  {updateDialog.request.reason?.replace(/_/g, " ")}
                </span>
              </p>
              {updateDialog.request.reasonDetails && (
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    Customer Notes:{" "}
                  </span>
                  {updateDialog.request.reasonDetails}
                </p>
              )}
            </div>
          )}

          <div className="py-4">
            <Label htmlFor="inspection-notes">Inspection Notes</Label>
            <Textarea
              id="inspection-notes"
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              placeholder={
                updateDialog.status === ExchangeStatus.EXCHANGE_CANCELLED
                  ? "Enter reason for cancellation..."
                  : "Add inspection notes (optional)..."
              }
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setUpdateDialog({ open: false, request: null, status: "" })
              }
            >
              Cancel
            </Button>
            <Button
              variant={
                updateDialog.status === ExchangeStatus.EXCHANGE_CANCELLED
                  ? "destructive"
                  : "default"
              }
              onClick={handleConfirmUpdate}
              disabled={updateStatusMutation.isPending}
            >
              {updateDialog.status === ExchangeStatus.EXCHANGE_CANCELLED
                ? "Confirm Cancellation"
                : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
