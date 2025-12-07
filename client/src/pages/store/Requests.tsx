import { useState } from "react";
import { Package, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SareeWithDetails, StockRequestWithDetails } from "@shared/schema";

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
    icon: Package,
    label: "Dispatched",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  received: {
    icon: CheckCircle,
    label: "Received",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
};

export default function StoreRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    sareeId: "",
    quantity: 1,
    notes: "",
  });

  const { data: requests, isLoading: loadingRequests } = useQuery<
    StockRequestWithDetails[]
  >({
    queryKey: ["/api/store/requests"],
    enabled: !!user && user.role === "store",
  });

  const { data: sarees } = useQuery<SareeWithDetails[]>({
    queryKey: ["/api/sarees"],
    enabled: !!user && user.role === "store",
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: {
      sareeId: string;
      quantity: number;
      notes: string;
    }) => {
      const response = await apiRequest("POST", "/api/store/requests", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
      toast({
        title: "Success",
        description: "Stock request submitted successfully",
      });
      setDialogOpen(false);
      setFormData({ sareeId: "", quantity: 1, notes: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit request",
        variant: "destructive",
      });
    },
  });

  const markReceivedMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(
        "PATCH",
        `/api/store/requests/${id}/received`
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
      toast({ title: "Success", description: "Stock marked as received" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark as received",
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sareeId) {
      toast({ title: "Error", description: "Please select a product" });
      return;
    }
    createRequestMutation.mutate(formData);
  };

  return (
    <div>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Stock Requests
            </h1>
            <p className="text-muted-foreground">
              Request inventory from central warehouse
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            data-testid="button-new-request"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            {loadingRequests ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : requests && requests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
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
                                request.saree.imageUrl ||
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                              }
                              alt=""
                              className="w-10 h-12 rounded object-cover"
                            />
                            <div>
                              <p className="font-medium line-clamp-1">
                                {request.saree.name}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {request.saree.sku}
                              </p>
                            </div>
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
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {request.notes || "-"}
                        </TableCell>
                        <TableCell>
                          {request.status === "dispatched" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                markReceivedMutation.mutate(request.id)
                              }
                              disabled={markReceivedMutation.isPending}
                              data-testid={`button-received-${request.id}`}
                            >
                              Mark Received
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
                No stock requests yet. Create your first request.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Stock</DialogTitle>
            <DialogDescription>
              Request inventory from the central warehouse
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div>
              <Label htmlFor="product">Product</Label>
              <Select
                value={formData.sareeId}
                onValueChange={(value) =>
                  setFormData({ ...formData, sareeId: value })
                }
              >
                <SelectTrigger data-testid="select-product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {sarees?.map((saree) => (
                    <SelectItem key={saree.id} value={saree.id}>
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            saree.imageUrl ||
                            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=30"
                          }
                          alt=""
                          className="w-6 h-8 rounded object-cover"
                        />
                        <span className="line-clamp-1">{saree.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity: parseInt(e.target.value) || 1,
                  })
                }
                data-testid="input-quantity"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Any additional notes for the request..."
                data-testid="input-notes"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRequestMutation.isPending}
                data-testid="button-submit-request"
              >
                {createRequestMutation.isPending
                  ? "Submitting..."
                  : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
