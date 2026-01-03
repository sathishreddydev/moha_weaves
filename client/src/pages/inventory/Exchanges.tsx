import { useState } from "react";
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeftRight,
  RefreshCcw,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ReturnRequestWithDetails, OnlineExchangeWithDetails } from "@shared/schema";
import { Link } from "react-router-dom";

const statusConfig: Record<
  string,
  { icon: typeof Clock; label: string; color: string }
> = {
  requested: {
    icon: Clock,
    label: "Pending Review",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  approved: {
    icon: CheckCircle,
    label: "Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  pickup_scheduled: {
    icon: Clock,
    label: "Pickup Scheduled",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  picked_up: {
    icon: Package,
    label: "Picked Up",
    color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100",
  },
  in_transit: {
    icon: Truck,
    label: "Items in Transit",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  received: {
    icon: Package,
    label: "Received at Warehouse",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
  },
  inspected: {
    icon: Package,
    label: "Under Inspection",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  },
};

export default function InventoryExchanges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isInventoryUser = !!user && (user.role === "inventory" || user.role === "admin");
  const [filterStatus, setFilterStatus] = useState<string>("all");
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

  const { data: exchanges, isLoading } = useQuery<OnlineExchangeWithDetails[]>({
    queryKey: ["/api/inventory/online-exchanges"],
    enabled: isInventoryUser,
  });

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
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/online-exchanges/${id}/status`,
        {
          status,
          inspectionNotes: notes,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/online-exchanges"] });
      toast({ title: "Success", description: "Exchange status updated" });
      setUpdateDialog({ open: false, request: null, status: "" });
      setInspectionNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update exchange status",
        variant: "destructive",
      });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/online-exchanges/${id}/status`,
        {
          status,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/online-exchanges"] });
      toast({ title: "Success", description: "Exchange item status updated" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update exchange item status",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (
    request: OnlineExchangeWithDetails,
    status: string
  ) => {
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

  const handleOrderStatusUpdate = (
    request: OnlineExchangeWithDetails,
    orderStatus: string
  ) => {
    updateOrderStatusMutation.mutate({
      id: request.id,
      status: orderStatus,
    });
  };


  const getOrderStatusActions = (request: OnlineExchangeWithDetails) => {
    const currentExchangeStatus = request.status;
    
    switch (currentExchangeStatus) {
      case "exchange_completed":
        return null;
      case "exchange_requested":
        return (
          <Button
            size="sm"
            onClick={() => handleOrderStatusUpdate(request, "approved")}
            disabled={updateOrderStatusMutation.isPending}
            data-testid={`button-start-processing-${request.orderId}`}
          >
            Start Processing
          </Button>
        );
      case "exchange_approved":
        return (
          <Button
            size="sm"
            onClick={() => handleOrderStatusUpdate(request, "exchange_pickup_scheduled")}
            disabled={updateOrderStatusMutation.isPending}
            data-testid={`button-ship-${request.orderId}`}
          >
            Mark Shipped
          </Button>
        );
      case "exchange_pickup_scheduled":
        return (
          <Button
            size="sm"
            onClick={() => handleOrderStatusUpdate(request, "exchange_picked_up")}
            disabled={updateOrderStatusMutation.isPending}
            data-testid={`button-deliver-${request.orderId}`}
          >
            Mark Delivered
          </Button>
        );
      case "exchange_picked_up":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Exchange Delivered
          </Badge>
        );
      default:
        return (
          <Button
            size="sm"
            onClick={() => handleOrderStatusUpdate(request, "approved")}
            disabled={updateOrderStatusMutation.isPending}
            data-testid={`button-start-processing-${request.orderId}`}
          >
            Start Processing
          </Button>
        );
    }
  };

  const getOrderStatusDisplay = (orderStatus: string) => {
    const statusMap = {
      approved: { label: "Processing", color: "bg-blue-100 text-blue-800" },
      pickup_scheduled: { label: "Shipped", color: "bg-purple-100 text-purple-800" },
      picked_up: { label: "Delivered", color: "bg-green-100 text-green-800" },
    };
    
    const config = statusMap[orderStatus as keyof typeof statusMap];
    return config ? (
      <Badge className={config.color}>
        <Truck className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    ) : null;
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return `₹${numPrice.toLocaleString("en-IN")}`;
  };

  const filteredExchanges = exchanges?.filter((ret) => {
    return filterStatus === "all" || ret.status === filterStatus;
  });

  if (!isInventoryUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6">
          You don't have permission to access this page.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Exchanges
            </h1>
            <p className="text-muted-foreground">
              Manage customer exchange requests
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/inventory/returns">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Returns
              </Button>
            </Link>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger
                className="w-40"
                data-testid="select-filter-status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pickup_scheduled">Pickup Scheduled</SelectItem>
                <SelectItem value="picked_up">Picked Up</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="inspected">Inspected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : filteredExchanges && filteredExchanges.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExchanges.map((request) => {
                    const status =
                      statusConfig[request.status] || statusConfig.requested;
                    const StatusIcon = status.icon;
                    // Online exchanges don't have resolution field, so all are exchanges
                    const isExchange = true;

                    return (
                      <TableRow
                        key={request.orderId}
                        data-testid={`row-return-${request.orderId}`}
                      >
                        <TableCell>
                          <Badge variant={isExchange ? "secondary" : "outline"}>
                            {isExchange ? (
                              <>
                                <ArrowLeftRight className="h-3 w-3 mr-1" />{" "}
                                Exchange
                              </>
                            ) : (
                              <>
                                <RefreshCcw className="h-3 w-3 mr-1" /> Return
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {request.user.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            #{request.orderId.slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {request.items.slice(0, 2).map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2"
                              >
                                <img
                                  src={
                                    item.orderItem.saree.imageUrl ||
                                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=40"
                                  }
                                  alt={item.orderItem.saree.name}
                                  className="w-8 h-10 rounded object-cover"
                                />
                                <span className="text-sm line-clamp-1">
                                  {item.orderItem.saree.name} x{item.quantity}
                                </span>
                              </div>
                            ))}
                            {request.items.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{request.items.length - 2} more items
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          N/A
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">
                            {request.reason.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(request.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={status.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                            {request.status === "exchange_completed" && request.order?.status && (
                              getOrderStatusDisplay(request.order.status)
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getOrderStatusActions(request)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No exchange requests found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={updateDialog.open}
        onOpenChange={(open) => setUpdateDialog({ ...updateDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {updateDialog.status === "rejected" ? "Reject" : "Update"}{" "}
              Exchange Request
            </DialogTitle>
            <DialogDescription>
              {updateDialog.status === "rejected"
                ? "Please provide a reason for rejection. This will be shared with the customer."
                : `Change status to "${
                    statusConfig[updateDialog.status]?.label ||
                    updateDialog.status
                  }". Add notes if needed.`}
            </DialogDescription>
          </DialogHeader>
          {updateDialog.request && (
            <div className="py-2 border-b">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={
                    updateDialog.request.items[0]?.orderItem.saree.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                  }
                  alt=""
                  className="w-12 h-15 rounded object-cover"
                />
                <div>
                  <p className="font-medium">
                    {updateDialog.request.user.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {updateDialog.request.user.email}
                  </p>
                </div>
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Reason:</span>{" "}
                {updateDialog.request.reason.replace(/_/g, " ")}
              </p>
              {updateDialog.request.reasonDetails && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Customer Notes:</span>{" "}
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
                updateDialog.status === "rejected"
                  ? "Enter reason for rejection..."
                  : "Add inspection notes (optional)..."
              }
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
              onClick={handleConfirmUpdate}
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
