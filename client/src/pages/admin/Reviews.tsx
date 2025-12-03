import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  LayoutDashboard,
  Tags,
  Palette,
  Shirt,
  Users,
  UserCog,
  Building2,
  ShoppingCart,
  LogOut,
  Menu,
  Ticket,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: Package, label: "Sarees", href: "/admin/sarees" },
  { icon: Tags, label: "Categories", href: "/admin/categories" },
  { icon: Palette, label: "Colors", href: "/admin/colors" },
  { icon: Shirt, label: "Fabrics", href: "/admin/fabrics" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: UserCog, label: "Staff", href: "/admin/staff" },
  { icon: Building2, label: "Stores", href: "/admin/stores" },
  { icon: ShoppingCart, label: "Orders", href: "/admin/orders" },
  { icon: Ticket, label: "Coupons", href: "/admin/coupons" },
  { icon: Star, label: "Reviews", href: "/admin/reviews" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

type ReviewWithDetails = ProductReview & {
  user: User;
  saree: SareeWithDetails;
};

const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  pending: { icon: Clock, label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" },
  approved: { icon: CheckCircle, label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" },
  rejected: { icon: XCircle, label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" },
};

export default function AdminReviews() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewDialog, setViewDialog] = useState<{ open: boolean; review: ReviewWithDetails | null }>({
    open: false,
    review: null,
  });

  const { data: reviews, isLoading } = useQuery<ReviewWithDetails[]>({
    queryKey: ["/api/admin/reviews"],
    enabled: !!user && user.role === "admin",
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/reviews/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "Success", description: "Review status updated" });
      setViewDialog({ open: false, review: null });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update review status", variant: "destructive" });
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
            className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
          />
        ))}
      </div>
    );
  };

  const filteredReviews = reviews?.filter(
    (review) => filterStatus === "all" || review.status === filterStatus
  );

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <Link to="/admin/login">
            <Button>Go to Admin Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Link to="/" className="font-serif text-xl font-semibold text-primary">
          Moha Admin
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} to={item.href}>
            <Button
              variant={item.href === "/admin/reviews" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <div className="mb-3">
          <p className="text-sm font-medium" data-testid="text-user-name">{user.name}</p>
          <p className="text-xs text-muted-foreground" data-testid="text-user-email">{user.email}</p>
        </div>
        <Button variant="outline" className="w-full" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="lg:hidden sticky top-0 z-50 bg-background border-b p-4 flex items-center justify-between">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <span className="font-serif text-lg font-semibold text-primary">Moha Admin</span>
        <div className="w-10" />
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-64 border-r bg-background h-screen sticky top-0">
          <Sidebar />
        </aside>

        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-semibold" data-testid="text-page-title">Reviews</h1>
                <p className="text-muted-foreground">Manage and moderate product reviews</p>
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
                        const status = statusConfig[review.status] || statusConfig.pending;
                        const StatusIcon = status.icon;

                        return (
                          <TableRow key={review.id} data-testid={`row-review-${review.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <img
                                  src={review.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                  alt={review.saree.name}
                                  className="w-10 h-12 rounded object-cover"
                                />
                                <span className="font-medium line-clamp-1">{review.saree.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{review.user.name}</p>
                                <p className="text-xs text-muted-foreground">{review.user.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{renderStars(review.rating)}</TableCell>
                            <TableCell>
                              <span className="line-clamp-1">{review.title || "-"}</span>
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
                                  onClick={() => setViewDialog({ open: true, review })}
                                  data-testid={`button-view-${review.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {review.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateStatusMutation.mutate({ id: review.id, status: "rejected" })}
                                      disabled={updateStatusMutation.isPending}
                                      data-testid={`button-reject-${review.id}`}
                                    >
                                      Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => updateStatusMutation.mutate({ id: review.id, status: "approved" })}
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
        </main>
      </div>

      <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ ...viewDialog, open })}>
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
                  src={viewDialog.review.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100"}
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
                    <p className="text-sm text-muted-foreground">{viewDialog.review.user.email}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(viewDialog.review.createdAt)}
                  </span>
                </div>
                {viewDialog.review.title && (
                  <p className="font-medium mb-2">{viewDialog.review.title}</p>
                )}
                <p className="text-sm">{viewDialog.review.comment || "No comment provided"}</p>
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
            <Button variant="outline" onClick={() => setViewDialog({ open: false, review: null })}>
              Close
            </Button>
            {viewDialog.review?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (viewDialog.review) {
                      updateStatusMutation.mutate({ id: viewDialog.review.id, status: "rejected" });
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
                      updateStatusMutation.mutate({ id: viewDialog.review.id, status: "approved" });
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
