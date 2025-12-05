import { useState } from "react";
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  RefreshCcw,
  ArrowLeftRight,
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
import type { ReturnRequestWithDetails } from "@shared/schema";

const statusConfig: Record<
  string,
  { icon: typeof Clock; label: string; color: string }
> = {
  requested: {
    icon: Clock,
    label: "Requested",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  approved: {
    icon: CheckCircle,
    label: "Approved",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
  in_transit: {
    icon: Truck,
    label: "In Transit",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  inspection: {
    icon: Package,
    label: "Inspection",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    color:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  },
};

export default function InventoryReturns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [updateDialog, setUpdateDialog] = useState<{
    open: boolean;
    request: ReturnRequestWithDetails | null;
    status: string;
  }>({
    open: false,
    request: null,
    status: "",
  });
  const [adminNotes, setAdminNotes] = useState("");

  const { data: returns, isLoading } = useQuery<ReturnRequestWithDetails[]>({
    queryKey: ["/api/inventory/returns"],
    enabled: !!user && user.role === "inventory",
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
        `/api/inventory/returns/${id}/status`,
        {
          status,
          inspectionNotes: notes,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/returns"] });
      toast({ title: "Success", description: "Return status updated" });
      setUpdateDialog({ open: false, request: null, status: "" });
      setAdminNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update return status",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (
    request: ReturnRequestWithDetails,
    status: string
  ) => {
    setAdminNotes(request.inspectionNotes || "");
    setUpdateDialog({ open: true, request, status });
  };

  const handleConfirmUpdate = () => {
    if (updateDialog.request && updateDialog.status) {
      updateStatusMutation.mutate({
        id: updateDialog.request.id,
        status: updateDialog.status,
        notes: adminNotes,
      });
    }
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

  const filteredReturns = returns?.filter((ret) => {
    const matchesStatus = filterStatus === "all" || ret.status === filterStatus;
    const matchesType =
      filterType === "all" || ret.resolution === filterType;
    return matchesStatus && matchesType;
  });

  const getNextAction = (request: ReturnRequestWithDetails) => {
    switch (request.status) {
      case "requested":
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusUpdate(request, "rejected")}
              disabled={updateStatusMutation.isPending}
              data-testid={`button-reject-${request.id}`}
            >
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => handleStatusUpdate(request, "approved")}
              disabled={updateStatusMutation.isPending}
              data-testid={`button-approve-${request.id}`}
            >
              Approve
            </Button>
          </div>
        );
      case "approved":
        return (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate(request, "in_transit")}
            disabled={updateStatusMutation.isPending}
            data-testid={`button-mark-transit-${request.id}`}
          >
            Mark In Transit
          </Button>
        );
      case "in_transit":
        return (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate(request, "inspection")}
            disabled={updateStatusMutation.isPending}
            data-testid={`button-mark-inspection-${request.id}`}
          >
            Received for Inspection
          </Button>
        );
      case "inspection":
        return (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate(request, "completed")}
            disabled={updateStatusMutation.isPending}
            data-testid={`button-complete-${request.id}`}
          >
            Complete{" "}
            {request.resolution === "exchange" ? "Exchange" : "Return"}
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Returns & Exchanges
            </h1>
            <p className="text-muted-foreground">
              Manage customer return and exchange requests
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32" data-testid="select-filter-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="return">Returns</SelectItem>
                <SelectItem value="exchange">Exchanges</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
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
            ) : filteredReturns && filteredReturns.length > 0 ? (
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
                  {filteredReturns.map((request) => {
                    const status =
                      statusConfig[request.status] || statusConfig.requested;
                    const StatusIcon = status.icon;
                    const isExchange = request.resolution === "exchange";

                    return (
                      <TableRow
                        key={request.id}
                        data-testid={`row-return-${request.id}`}
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
                          {formatPrice(request.refundAmount || "0")}
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
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{getNextAction(request)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No return or exchange requests found</p>
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
              {updateDialog.request?.resolution === "exchange"
                ? "Exchange"
                : "Return"}{" "}
              Request
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
            <Label htmlFor="admin-notes">Admin Notes</Label>
            <Textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={
                updateDialog.status === "rejected"
                  ? "Enter reason for rejection..."
                  : "Add internal notes (optional)..."
              }
              className="mt-2"
              data-testid="input-admin-notes"
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
                updateDialog.status === "rejected" ? "destructive" : "default"
              }
              onClick={handleConfirmUpdate}
              disabled={updateStatusMutation.isPending}
              data-testid="button-confirm-status"
            >
              {updateDialog.status === "rejected"
                ? "Confirm Rejection"
                : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
