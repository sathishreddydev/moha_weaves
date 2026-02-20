import { DataTable } from "@/components/DataTable/DataTable";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  ArrowLeftRight,
  Calendar,
  ExternalLink,
  User
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { formatDate, formatPrice } from "@/lib/utils";


const getExchangeStatusFlow = (currentStatus: string) => {
  const flow: Record<string, string[]> = {
    exchange_requested: ["exchange_approved", "exchange_cancelled"],
    exchange_approved: ["exchange_processing"],
    exchange_processing: ["exchange_pickup_scheduled"],
    exchange_pickup_scheduled: ["exchange_picked_up"],
    exchange_picked_up: ["exchange_in_transit"],
    exchange_in_transit: ["exchange_received"],
    exchange_received: ["exchange_inspected"],
    exchange_inspected: ["exchange_shipped"],
    exchange_shipped: ["exchange_delivered"],
    exchange_delivered: ["exchange_completed"],
    exchange_completed: [],
    exchange_cancelled: [],
  };
  return flow[currentStatus] || [];
};


interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = itemStatusConfig[status] || itemStatusConfig.exchange_requested;
  const StatusIcon = config.icon;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center w-fit capitalize ${config.color}`}>
      <StatusIcon size={12} className="mr-1" />
      {config.label}
    </span>
  );
};

export default function InventoryExchanges() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [updateDialog, setUpdateDialog] = useState<{
    open: boolean;
    request: OnlineExchangeWithDetails | null;
    status: string;
  }>({
    open: false,
    request: null,
    status: "",
  });
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
    pageKey:'inventoryOnlineExchanges'
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/online-exchanges/${id}/status`,
        { status, inspectionNotes: notes }
      );
      return response;
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Exchange status updated" });
      setUpdateDialog({ open: false, request: null, status: "" });
      setInspectionNotes("");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      const extracted = message.includes(":") ? message.split(":").slice(1).join(":").trim() : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update exchange status",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (request: OnlineExchangeWithDetails, status: string) => {
    setInspectionNotes(request.inspectionNotes || "");
    setUpdateDialog({ open: true, request, status });
  };

  const handleConfirmUpdate = () => {
    if (updateDialog.request && updateDialog.status) {
      updateStatusMutation.mutate({
        id: updateDialog.request.id,
        status: updateDialog.status,
        notes: inspectionNotes,
      });
    }
  };

  const getNextAction = (request: OnlineExchangeWithDetails) => {
    const nextStatuses = getExchangeStatusFlow(request.status);
    
    if (nextStatuses.length === 0) return null;
    
    if (nextStatuses.length === 1) {
      const status = nextStatuses[0];
      return (
        <Button
          size="sm"
          onClick={() => handleStatusUpdate(request, status)}
          disabled={updateStatusMutation.isPending}
        >
          {itemStatusConfig[status]?.label || status}
        </Button>
      );
    }
    
    return (
      <div className="flex gap-2">
        {nextStatuses.map(status => (
          <Button
            key={status}
            size="sm"
            variant={status === "exchange_cancelled" ? "destructive" : "default"}
            onClick={() => handleStatusUpdate(request, status)}
            disabled={updateStatusMutation.isPending}
          >
            {itemStatusConfig[status]?.label || status}
          </Button>
        ))}
      </div>
    );
  };

  const columns: ColumnDef<OnlineExchangeWithDetails>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "Exchange",
        cell: ({ row }) => (
          <div>
            <div className="font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline" onClick={() => navigate(`/inventory/exchanges/${row.original.id}`)}>
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
                {row.original.user?.name || 'Unknown Customer'}
              </div>
              <div className="text-xs text-slate-500">{row.original.user?.email || 'No email'}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "orderId",
        header: "Order",
        cell: ({ row }) => (
          <div className="font-mono text-sm text-slate-700">
            #{row.original.orderId}
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
                  <div key={idx} className="h-7 w-7 rounded border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 overflow-hidden">
                    <img
                      src={item.orderItem?.product?.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=20"}
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
              <div className="mt-1 text-xs text-slate-500">{(exchange.items?.length || 0)} product(s)</div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} />
        ),
      },
      {
        accessorKey: "actions",
        header: "Actions",
        cell: ({ row }) => getNextAction(row.original),
      },
    ],
    [navigate, handleStatusUpdate, updateStatusMutation.isPending]
  );

  const accordionContent = (exchange: OnlineExchangeWithDetails) => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <ArrowLeftRight size={20} className="text-slate-400" />
          Exchange Details
        </h3>
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 px-2 uppercase tracking-wider">Quick Actions:</span>
          <div className="flex gap-1">
            {getExchangeStatusFlow(exchange.status).map(status => (
              <Button
                variant={'ghost'}
                key={status}
                size="sm"
                onClick={() => handleStatusUpdate(exchange, status)}
              >
                {itemStatusConfig[status]?.label || status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700 mb-2">Customer Information</h4>
          <div className="space-y-1">
            <p className="text-sm"><span className="font-medium">Name:</span> {exchange.user?.name}</p>
            <p className="text-sm"><span className="font-medium">Email:</span> {exchange.user?.email}</p>
            <p className="text-sm"><span className="font-medium">Order:</span> #{exchange.orderId}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700 mb-2">Exchange Information</h4>
          <div className="space-y-1">
            <p className="text-sm"><span className="font-medium">Reason:</span> {exchange.reason.replace(/_/g, " ")}</p>
            <p className="text-sm"><span className="font-medium">Type:</span> Exchange</p>
            <p className="text-sm"><span className="font-medium">Status:</span> <StatusBadge status={exchange.status} /></p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-slate-700">Items Being Exchanged</h4>
        {(exchange.items || []).map((item, idx) => (
          <div
            key={`item-${idx}`}
            className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                <img
                  src={item.orderItem?.product?.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=40"}
                  alt={item.orderItem?.product?.name || "Item"}
                  className="w-8 h-8 object-cover rounded"
                />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">{item.orderItem?.product?.name || 'Unknown Item'}</h4>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span>SKU: {item.orderItemId}</span>
                  <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                  <span>Qty: {item.quantity}</span>
                  {item.orderItem?.product?.variants && item.orderItem.product.variants.length > 0 && (
                    <>
                      <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                      <span>Size: {item.orderItem.product.variants[0].size}</span>
                    </>
                  )}
                  <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                  <span>{formatPrice(item.orderItem?.product?.price || 0)} each</span>
                </div>
                {item.exchangeproductId && (
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                    <span className="font-medium">Exchange for:</span> New Item ID: {item.exchangeproductId}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
              <div className="flex flex-col items-start md:items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Current Status</span>
                <StatusBadge status={exchange.status} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {exchange.reasonDetails && (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700 mb-2">Customer Notes</h4>
          <p className="text-sm text-slate-600">{exchange.reasonDetails}</p>
        </div>
      )}

      {exchange.inspectionNotes && (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700 mb-2">Inspection Notes</h4>
          <p className="text-sm text-slate-600">{exchange.inspectionNotes}</p>
        </div>
      )}

      {exchange.pickupAddress && (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700 mb-2">Pickup Address</h4>
          <p className="text-sm text-slate-600">{exchange.pickupAddress}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Exchanges</h1>
            <p className="text-muted-foreground">Manage customer exchange requests</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/inventory/returns')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
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
      </div>

      <Dialog
        open={updateDialog.open}
        onOpenChange={(open) => setUpdateDialog({ ...updateDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {updateDialog.status === "exchange_cancelled" ? "Cancel" : "Update"} Exchange Request
            </DialogTitle>
            <DialogDescription>
              {updateDialog.status === "exchange_cancelled"
                ? "Please provide a reason for cancellation. This will be shared with the customer."
                : `Change status to "${itemStatusConfig[updateDialog.status]?.label || updateDialog.status}". Add notes if needed.`}
            </DialogDescription>
          </DialogHeader>
          {updateDialog.request && (
            <div className="py-2 border-b">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={updateDialog.request.items[0]?.orderItem?.product?.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"}
                  alt=""
                  className="w-12 h-15 rounded object-cover"
                />
                <div>
                  <p className="font-medium">{updateDialog.request.user?.name}</p>
                  <p className="text-sm text-muted-foreground">{updateDialog.request.user?.email}</p>
                </div>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Reason:</span> {updateDialog.request.reason.replace(/_/g, " ")}
              </p>
              {updateDialog.request.reasonDetails && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Customer Notes:</span> {updateDialog.request.reasonDetails}
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
                updateDialog.status === "exchange_cancelled"
                  ? "Enter reason for cancellation..."
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
              variant={updateDialog.status === "exchange_cancelled" ? "destructive" : "default"}
              onClick={handleConfirmUpdate}
              disabled={updateStatusMutation.isPending}
            >
              {updateDialog.status === "exchange_cancelled" ? "Confirm Cancellation" : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
