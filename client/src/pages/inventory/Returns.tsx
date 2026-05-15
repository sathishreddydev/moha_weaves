import { DataTable } from "@/components/DataTable/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { ReturnRequestWithDetails } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  Calendar,
  ExternalLink,
  RotateCcw,
  User,
  MapPin,
  Package,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate, formatPrice } from "@/lib/utils";
import { ReturnStatus } from "./utils/enums";
import type { StatusBadgeProps } from "./utils/type";
import { useSocket } from "@/stores/socketStore";

// ─── Status flow ────────────────────────────────────────────────────────────

const getReturnStatusFlow = (currentStatus: string): ReturnStatus[] => {
  const flow: Record<ReturnStatus, ReturnStatus[]> = {
    [ReturnStatus.RETURN_REQUESTED]:        [ReturnStatus.RETURN_APPROVED, ReturnStatus.RETURN_REJECTED],
    [ReturnStatus.RETURN_APPROVED]:         [ReturnStatus.RETURN_PICKUP_SCHEDULED, ReturnStatus.RETURN_CANCELLED],
    [ReturnStatus.RETURN_PICKUP_SCHEDULED]: [ReturnStatus.RETURN_PICKED_UP, ReturnStatus.RETURN_CANCELLED],
    [ReturnStatus.RETURN_PICKED_UP]:        [ReturnStatus.RETURN_IN_TRANSIT, ReturnStatus.RETURN_CANCELLED],
    [ReturnStatus.RETURN_IN_TRANSIT]:       [ReturnStatus.RETURN_RECEIVED, ReturnStatus.RETURN_CANCELLED],
    [ReturnStatus.RETURN_RECEIVED]:         [ReturnStatus.RETURN_INSPECTED, ReturnStatus.RETURN_CANCELLED],
    [ReturnStatus.RETURN_INSPECTED]:        [ReturnStatus.RETURN_COMPLETED, ReturnStatus.RETURN_CANCELLED],
    [ReturnStatus.RETURN_COMPLETED]:        [],
    [ReturnStatus.RETURN_REJECTED]:         [],
    [ReturnStatus.RETURN_CANCELLED]:        [],
  };
  return flow[currentStatus as ReturnStatus] || [];
};

// ─── Status badge ────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = itemStatusConfig[status] ?? itemStatusConfig[ReturnStatus.RETURN_REQUESTED];
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

// ─── Resolution badge ────────────────────────────────────────────────────────

function ResolutionBadge({ resolution }: { resolution?: string | null }) {
  if (!resolution) return null;
  const label = resolution.replace(/_/g, " ");
  const color =
    resolution === "refund"
      ? "border-green-400 text-green-700 bg-green-50"
      : resolution === "exchange"
      ? "border-blue-400 text-blue-700 bg-blue-50"
      : "border-slate-300 text-slate-600 bg-slate-50";
  return (
    <Badge variant="outline" className={`capitalize text-xs ${color}`}>
      {label}
    </Badge>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function InventoryReturns() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { socket } = useSocket();

  const [updateDialog, setUpdateDialog] = useState<{
    open: boolean;
    request: ReturnRequestWithDetails | null;
    status: string;
  }>({ open: false, request: null, status: "" });

  const [inspectionNotes, setInspectionNotes] = useState("");

  const {
    data: returns,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    refetch,
  } = useDataTable<ReturnRequestWithDetails>({
    queryKey: "/api/inventory/returnRequests",
    initialPageSize: 10,
    pageKey: "inventoryReturns",
  });

  // Auto-refresh when a return is created or its status changes
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => refetch();
    socket.on("product_returned", handleRefresh);
    socket.on("return_status_updated", handleRefresh);
    return () => {
      socket.off("product_returned", handleRefresh);
      socket.off("return_status_updated", handleRefresh);
    };
  }, [socket, refetch]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/inventory/returns/${id}/status`, {
        status,
        inspectionNotes: notes,
      });
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Return status updated" });
      setUpdateDialog({ open: false, request: null, status: "" });
      setInspectionNotes("");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      const extracted = message.includes(":") ? message.split(":").slice(1).join(":").trim() : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update return status",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = useCallback(
    (request: ReturnRequestWithDetails, status: string) => {
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

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columns: ColumnDef<ReturnRequestWithDetails>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "Return",
        cell: ({ row }) => (
          <div>
            <div
              className="font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline"
              onClick={() => navigate(`/inventory/returns/${row.original.id}`)}
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
        accessorKey: "orderId",
        header: "Order",
        cell: ({ row }) => (
          <div
            className="font-mono text-sm text-primary cursor-pointer hover:underline flex items-center gap-1"
            onClick={() => navigate(`/inventory/orders/${row.original.orderId}`)}
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
          const req = row.original;
          return (
            <div>
              <div className="flex -space-x-2">
                {(req.items || []).slice(0, 3).map((item, idx) => (
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
                {(req.items?.length || 0) > 3 && (
                  <div className="h-7 w-7 rounded border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    +{(req.items?.length || 0) - 3}
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {req.items?.length || 0} product(s)
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "resolution",
        header: "Resolution",
        cell: ({ row }) => <ResolutionBadge resolution={row.original.resolution} />,
      },
      {
        accessorKey: "refundAmount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="font-bold text-slate-900">
            {formatPrice(row.original.refundAmount || 0)}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [navigate],
  );

  // ─── Accordion detail ───────────────────────────────────────────────────────

  const accordionContent = useCallback(
    (req: ReturnRequestWithDetails) => {
      const nextStatuses = getReturnStatusFlow(req.status);

      return (
        <div className="space-y-5">
          {/* Header row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <RotateCcw size={20} className="text-slate-400" />
              Return Details
            </h3>
            {nextStatuses.length > 0 && (
              <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 px-2 uppercase tracking-wider">
                  Quick Actions:
                </span>
                <div className="flex gap-1">
                  {nextStatuses.map((status) => (
                    <Button
                      variant={
                        status === ReturnStatus.RETURN_REJECTED || status === ReturnStatus.RETURN_CANCELLED
                          ? "destructive"
                          : "ghost"
                      }
                      key={status}
                      size="sm"
                      onClick={() => handleStatusUpdate(req, status)}
                      disabled={updateStatusMutation.isPending}
                    >
                      {itemStatusConfig[status]?.label ?? status}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <User size={14} className="text-slate-400" />
                <h4 className="font-semibold text-sm text-slate-700">Customer</h4>
              </div>
              <p className="text-sm font-medium">{req.user?.name || "—"}</p>
              <p className="text-xs text-slate-500">{req.user?.email || "—"}</p>
              <p className="text-xs text-slate-500">
                Order:{" "}
                <span
                  className="text-primary cursor-pointer hover:underline font-mono"
                  onClick={() => navigate(`/inventory/orders/${req.orderId}`)}
                >
                  #{req.orderId}
                </span>
              </p>
            </div>

            {/* Return info */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <RotateCcw size={14} className="text-slate-400" />
                <h4 className="font-semibold text-sm text-slate-700">Return Info</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status:</span>
                <StatusBadge status={req.status} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Resolution:</span>
                <ResolutionBadge resolution={req.resolution} />
              </div>
              <p className="text-sm">
                <span className="text-slate-500 text-xs">Reason: </span>
                <span className="capitalize">{req.reason?.replace(/_/g, " ") || "—"}</span>
              </p>
              <p className="text-sm">
                <span className="text-slate-500 text-xs">Amount: </span>
                <span className="font-semibold">{formatPrice(req.refundAmount || 0)}</span>
              </p>
              {req.processedBy ? (
                <p className="text-xs text-slate-500">
                  Processed by: <span className="text-slate-700">{req.processedBy}</span>
                </p>
              ) : null}
              {req.exchangeOrderId ? (
                <p className="text-xs text-slate-500">
                  Exchange order:{" "}
                  <span
                    className="text-primary cursor-pointer hover:underline font-mono"
                    onClick={() => navigate(`/inventory/orders/${req.exchangeOrderId}`)}
                  >
                    #{req.exchangeOrderId}
                  </span>
                </p>
              ) : null}
            </div>

            {/* Pickup / logistics */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin size={14} className="text-slate-400" />
                <h4 className="font-semibold text-sm text-slate-700">Logistics</h4>
              </div>
              {req.pickupAddress ? (
                <p className="text-sm text-slate-700">{req.pickupAddress}</p>
              ) : (
                <p className="text-xs text-slate-400 italic">No pickup address set</p>
              )}
              {req.pickupScheduledAt ? (
                <p className="text-xs text-slate-500">
                  Pickup scheduled: {formatDate(req.pickupScheduledAt)}
                </p>
              ) : null}
              {req.pickedUpAt ? (
                <p className="text-xs text-slate-500">
                  Picked up: {formatDate(req.pickedUpAt)}
                </p>
              ) : null}
              {req.receivedAt ? (
                <p className="text-xs text-slate-500">
                  Received: {formatDate(req.receivedAt)}
                </p>
              ) : null}
            </div>
          </div>

          {/* Refund info */}
          {req.refund ? (
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 mb-3">
                <CreditCard size={14} className="text-slate-400" />
                <h4 className="font-semibold text-sm text-slate-700">Refund</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Amount</div>
                  <div className="font-semibold">{formatPrice(req.refund.amount || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Status</div>
                  <div className="capitalize">{String(req.refund.status || "—").replace(/_/g, " ")}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Method</div>
                  <div className="capitalize">{String(req.refund.refundMethod || "—").replace(/_/g, " ")}</div>
                </div>
                {req.refund.razorpayRefundId ? (
                  <div>
                    <div className="text-xs text-slate-500">Razorpay Ref</div>
                    <div className="font-mono text-xs">{req.refund.razorpayRefundId}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-1.5">
              <Package size={14} className="text-slate-400" />
              Items Being Returned
            </h4>
            {(req.items || []).map((item) => (
              <div
                key={item.id}
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
                      <span>SKU: {item.id}</span>
                      <span className="h-1 w-1 bg-slate-300 rounded-full" />
                      <span>Qty: {item.quantity}</span>
                      {(() => {
                        const variant =
                          item.orderItem?.variantId &&
                          item.orderItem?.product?.variants?.find(
                            (v: any) => v.id === item.orderItem?.variantId,
                          );
                        return variant ? (
                          <>
                            <span className="h-1 w-1 bg-slate-300 rounded-full" />
                            <span>Size: {variant.size}</span>
                          </>
                        ) : null;
                      })()}
                      <span className="h-1 w-1 bg-slate-300 rounded-full" />
                      <span>{formatPrice(item.orderItem?.price || 0)} each</span>
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
                          {item.isRestockable ? "Restockable" : "Not restockable"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <StatusBadge status={req.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {(req.reasonDetails || req.inspectionNotes) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {req.reasonDetails ? (
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">Customer Notes</h4>
                  <p className="text-sm text-slate-600">{req.reasonDetails}</p>
                </div>
              ) : null}
              {req.inspectionNotes ? (
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">Inspection Notes</h4>
                  <p className="text-sm text-slate-600">{req.inspectionNotes}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      );
    },
    [handleStatusUpdate, updateStatusMutation.isPending, navigate],
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Returns</h1>
          <p className="text-xs text-muted-foreground">Manage customer return requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/inventory/exchanges")}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            View Exchanges
          </Button>
        </div>
      </div>

      <DataTable
        pageKey="inventoryReturns"
        columns={columns}
        data={returns || []}
        totalCount={totalCount || 0}
        pageSize={pageSize}
        pageIndex={pageIndex}
        onPaginationChange={handlePaginationChange}
        isLoading={isLoading}
        searchPlaceholder="Search by Return ID, Customer, or Order..."
        emptyMessage="No return requests found"
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
              {updateDialog.status === ReturnStatus.RETURN_REJECTED
                ? "Reject Return Request"
                : updateDialog.status === ReturnStatus.RETURN_CANCELLED
                ? "Cancel Return Request"
                : "Update Return Request"}
            </DialogTitle>
            <DialogDescription>
              {updateDialog.status === ReturnStatus.RETURN_REJECTED
                ? "Provide a reason for rejection — this will be shared with the customer."
                : updateDialog.status === ReturnStatus.RETURN_CANCELLED
                ? "Provide a reason for cancellation — this will be shared with the customer."
                : `Change status to "${itemStatusConfig[updateDialog.status]?.label ?? updateDialog.status}". Add notes if needed.`}
            </DialogDescription>
          </DialogHeader>

          {updateDialog.request && (
            <div className="py-2 border-b space-y-2">
              <div className="flex items-center gap-3">
                <img
                  src={
                    updateDialog.request.items[0]?.orderItem?.product?.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                  }
                  alt=""
                  className="w-12 h-12 rounded object-cover"
                />
                <div>
                  <p className="font-medium">{updateDialog.request.user?.name}</p>
                  <p className="text-sm text-muted-foreground">{updateDialog.request.user?.email}</p>
                </div>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Reason: </span>
                <span className="capitalize">
                  {updateDialog.request.reason?.replace(/_/g, " ")}
                </span>
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Resolution: </span>
                <ResolutionBadge resolution={updateDialog.request.resolution} />
              </div>
              {updateDialog.request.reasonDetails && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Customer Notes: </span>
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
                updateDialog.status === ReturnStatus.RETURN_REJECTED
                  ? "Enter reason for rejection..."
                  : "Add inspection notes (optional)..."
              }
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpdateDialog({ open: false, request: null, status: "" })}
            >
              Cancel
            </Button>
            <Button
              variant={
                updateDialog.status === ReturnStatus.RETURN_REJECTED ||
                updateDialog.status === ReturnStatus.RETURN_CANCELLED
                  ? "destructive"
                  : "default"
              }
              onClick={handleConfirmUpdate}
              disabled={updateStatusMutation.isPending}
            >
              {updateDialog.status === ReturnStatus.RETURN_REJECTED
                ? "Confirm Rejection"
                : updateDialog.status === ReturnStatus.RETURN_CANCELLED
                ? "Confirm Cancellation"
                : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
