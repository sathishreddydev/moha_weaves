import { useState } from "react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Eye,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { OnlineExchangeWithDetails } from "@shared/schema";

const onlineExchangeStatusConfig = {
  requested: {
    icon: Clock,
    label: "Exchange Requested",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  approved: {
    icon: CheckCircle,
    label: "Exchange Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  pickup_scheduled: {
    icon: Package,
    label: "Pickup Scheduled",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  picked_up: {
    icon: Truck,
    label: "Item Picked Up",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  in_transit: {
    icon: Truck,
    label: "In Transit",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  },
  received: {
    icon: Package,
    label: "Item Received",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
  },
  inspected: {
    icon: CheckCircle,
    label: "Item Inspected",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
  },
  completed: {
    icon: CheckCircle,
    label: "Exchange Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Exchange Cancelled",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
};

export default function InventoryExchangesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isInventoryUser = !!user && (user.role === "inventory" || user.role === "admin");

  // State for status update dialog
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<OnlineExchangeWithDetails | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");

  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data: exchanges, isLoading: loadingExchanges, refetch: refetchExchanges } = useQuery<OnlineExchangeWithDetails[]>({
    queryKey: ["/api/inventory/online-exchanges"],
    enabled: isInventoryUser,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, inspectionNotes }: { 
      id: string; 
      status: string; 
      inspectionNotes?: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/inventory/online-exchanges/${id}/status`, {
        status,
        inspectionNotes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/online-exchanges"] });
      toast({ title: "Status updated successfully" });
      setShowStatusDialog(false);
      setSelectedExchange(null);
      setNewStatus("");
      setInspectionNotes("");
      refetchExchanges();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = () => {
    if (!selectedExchange || !newStatus) return;

    updateStatusMutation.mutate({
      id: selectedExchange.id, // Use exchange ID for status updates
      status: newStatus,
      inspectionNotes: inspectionNotes || undefined,
    });
  };

  const handlePaginationChange = (newPageIndex: number, newPageSize: number) => {
    setPageIndex(newPageIndex);
    setPageSize(newPageSize);
  };

  const getStatusDisplay = (status: string) => {
    const config = onlineExchangeStatusConfig[status as keyof typeof onlineExchangeStatusConfig];
    if (!config) return null;

    const StatusIcon = config.icon;
    return (
      <Badge className={config.color}>
        <StatusIcon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const columns: ColumnDef<OnlineExchangeWithDetails>[] = [
    {
      accessorKey: "orderId",
      header: "Order ID",
      cell: ({ row }) => (
        <Link
          to={`/admin/orders/${row.original.orderId}`}
          className="font-medium hover:text-primary"
        >
          #{row.original.orderId}
        </Link>
      ),
    },
    {
      accessorKey: "user",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.user.name}</p>
          <p className="text-sm text-muted-foreground">{row.original.user.phone}</p>
        </div>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => {
        const reason = row.getValue("reason");
        const reasonText = typeof reason === 'string' ? reason : '';
        return <span className="capitalize">{reasonText.replace(/_/g, " ")}</span>;
      },
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.items.length} item(s)</p>
          <p className="text-sm text-muted-foreground">
            Total qty: {row.original.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusDisplay(row.getValue("status")),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => formatDate(row.getValue("createdAt")),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/inventory/online-exchanges/${row.original.orderId}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedExchange(row.original);
              setNewStatus(row.original.status);
              setShowStatusDialog(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (!isInventoryUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Online Exchanges
          </h1>
          <p className="text-muted-foreground">
            Manage customer exchange requests and status updates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchExchanges()}>
            Refresh
          </Button>
        </div>
      </div>

      {loadingExchanges ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={exchanges || []}
          searchPlaceholder="Search by order ID or customer name..."
          totalCount={exchanges?.length || 0}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPaginationChange={handlePaginationChange}
        />
      )}

      {/* Status Update Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Exchange Status</DialogTitle>
            <DialogDescription>
              Update the status for exchange request #{selectedExchange?.orderId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(onlineExchangeStatusConfig).map((status) => (
                    <SelectItem key={status} value={status}>
                      {onlineExchangeStatusConfig[status as keyof typeof onlineExchangeStatusConfig].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(newStatus === "inspected" || newStatus === "completed" || newStatus === "cancelled") && (
              <div>
                <Label htmlFor="notes">Inspection Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add inspection notes..."
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {selectedExchange && (
              <div className="text-sm text-muted-foreground">
                <p><strong>Customer:</strong> {selectedExchange.user.name}</p>
                <p><strong>Items:</strong> {selectedExchange.items.length} item(s)</p>
                <p><strong>Current Status:</strong> {getStatusDisplay(selectedExchange.status)}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStatusUpdate}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
