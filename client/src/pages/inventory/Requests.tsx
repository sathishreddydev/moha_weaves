import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { StockRequestWithDetails } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle,
  Clock,
  Package,
  Truck,
  XCircle
} from "lucide-react";
import { useState } from "react";
import { formatDate, formatPrice } from "@/lib/utils";


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
  dispatched: {
    icon: Truck,
    label: "Dispatched",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  received: {
    icon: Package,
    label: "Received",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
};

export default function InventoryRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");

  const isInventoryUser = !!user && (user.role === "inventory" || user.role === "admin");

  const { data: requests, isLoading } = useQuery<StockRequestWithDetails[]>({
    queryKey: ["/api/inventory/requests"],
    enabled: isInventoryUser,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/requests/${id}/status`,
        { status, rejectionReason }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/requests"] });
      toast({ title: "Success", description: "Request status updated" });
      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedRequestId("");
    },
    onError: (error: any) => {
      const errorData = error.data || {};
      if (errorData.availableStock !== undefined) {
        toast({
          title: "Insufficient Stock",
          description: errorData.message || "Not enough stock available to approve this request",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorData.message || "Failed to update request",
          variant: "destructive",
        });
      }
    },
  });


  const handleApprove = (id: string) => {
    if (!id) {
      toast({
        title: "Error",
        description: "No request selected",
        variant: "destructive",
      });
      return;
    }
    updateStatusMutation.mutate({ id, status: "approved" });
  };

  const handleReject = (id: string) => {
    setSelectedRequestId(id);
    setRejectDialogOpen(true);
  };

  const handleRejectSubmit = () => {
    if (!selectedRequestId) {
      toast({
        title: "Error",
        description: "No request selected",
        variant: "destructive",
      });
      return;
    }
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }
    updateStatusMutation.mutate({
      id: selectedRequestId,
      status: "rejected",
      rejectionReason,
    });
  };

  const filteredRequests = requests?.filter(
    (request) => filterStatus === "all" || request.status === filterStatus
  );



  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Store Requests
          </h1>
          <p className="text-muted-foreground">
            Manage stock requests from physical stores
          </p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40" data-testid="select-filter-status">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : filteredRequests && filteredRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => {
                  const status =
                    statusConfig[request.status] || statusConfig.pending;
                  const StatusIcon = status.icon;

                  return (
                    <TableRow
                      key={request.id}
                      data-testid={`row-request-${request.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              request.product.imageUrl ||
                              "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                            }
                            alt={request.product.name}
                            className="w-10 h-12 rounded object-cover"
                          />
                          <div>
                            <p className="font-medium line-clamp-1">
                              {request.product.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {request.product.sku}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {request.store.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {request.quantity} units
                        </Badge>
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
                      <TableCell>
                        {request.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(request.id)}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-reject-${request.id}`}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-approve-${request.id}`}
                            >
                              Approve
                            </Button>
                          </div>
                        )}
                        {request.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: request.id,
                                status: "dispatched",
                              })
                            }
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-dispatch-${request.id}`}
                          >
                            Mark Dispatched
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No requests found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Stock Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this stock request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason("");
                setSelectedRequestId("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
