import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Star, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProductReview, User, SareeWithDetails } from "@shared/schema";

type ReviewWithDetails = ProductReview & {
  user: User;
  saree: SareeWithDetails;
};

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
};

export default function AdminReviews() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewDialog, setViewDialog] = useState<{
    open: boolean;
    review: ReviewWithDetails | null;
  }>({
    open: false,
    review: null,
  });

  const { data: reviews, isLoading } = useQuery<ReviewWithDetails[]>({
    queryKey: ["/api/admin/reviews"],
    enabled: !!user && user.role === "admin",
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/reviews/${id}/status`,
        { status }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "Success", description: "Review status updated" });
      setViewDialog({ open: false, review: null });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update review status",
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  const filteredReviews = reviews?.filter(
    (review) => filterStatus === "all" || review.status === filterStatus
  );

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Reviews
            </h1>
            <p className="text-muted-foreground">
              Manage and moderate product reviews
            </p>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40" data-testid="select-filter-status">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
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
            ) : filteredReviews && filteredReviews.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.map((review) => {
                    const status =
                      statusConfig[review.status] || statusConfig.pending;
                    const StatusIcon = status.icon;

                    return (
                      <TableRow
                        key={review.id}
                        data-testid={`row-review-${review.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                review.saree.imageUrl ||
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                              }
                              alt={review.saree.name}
                              className="w-10 h-12 rounded object-cover"
                            />
                            <span className="font-medium line-clamp-1">
                              {review.saree.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{review.user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {review.user.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{renderStars(review.rating)}</TableCell>
                        <TableCell>
                          <span className="line-clamp-1">
                            {review.title || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(review.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setViewDialog({ open: true, review })
                              }
                              data-testid={`button-view-${review.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {review.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: review.id,
                                      status: "rejected",
                                    })
                                  }
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-reject-${review.id}`}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: review.id,
                                      status: "approved",
                                    })
                                  }
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-approve-${review.id}`}
                                >
                                  Approve
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No reviews found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={viewDialog.open}
        onOpenChange={(open) => setViewDialog({ ...viewDialog, open })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              Review for {viewDialog.review?.saree.name}
            </DialogDescription>
          </DialogHeader>
          {viewDialog.review && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <img
                  src={
                    viewDialog.review.saree.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100"
                  }
                  alt={viewDialog.review.saree.name}
                  className="w-16 h-20 rounded object-cover"
                />
                <div>
                  <p className="font-medium">{viewDialog.review.saree.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {renderStars(viewDialog.review.rating)}
                    <span className="text-sm text-muted-foreground">
                      {viewDialog.review.rating}/5
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">{viewDialog.review.user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {viewDialog.review.user.email}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(viewDialog.review.createdAt)}
                  </span>
                </div>
                {viewDialog.review.title && (
                  <p className="font-medium mb-2">{viewDialog.review.title}</p>
                )}
                <p className="text-sm">
                  {viewDialog.review.comment || "No comment provided"}
                </p>
                {viewDialog.review.isVerifiedPurchase && (
                  <Badge variant="secondary" className="mt-2">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified Purchase
                  </Badge>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewDialog({ open: false, review: null })}
            >
              Close
            </Button>
            {viewDialog.review?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (viewDialog.review) {
                      updateStatusMutation.mutate({
                        id: viewDialog.review.id,
                        status: "rejected",
                      });
                      setViewDialog({ open: false, review: null });
                    }
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    if (viewDialog.review) {
                      updateStatusMutation.mutate({
                        id: viewDialog.review.id,
                        status: "approved",
                      });
                      setViewDialog({ open: false, review: null });
                    }
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
