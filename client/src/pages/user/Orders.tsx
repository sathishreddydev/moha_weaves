import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  ChevronRight,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { OrderWithItems, ReturnRequestWithDetails, Refund } from "@shared/schema";
import { WriteReview } from "@/components/product/WriteReview";
import { useDebounce } from "@/components/common/useDebounceHook";
import { useToast } from "@/hooks/use-toast";

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
  confirmed: {
    icon: CheckCircle,
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  processing: {
    icon: Package,
    label: "Processing",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  shipped: {
    icon: Truck,
    label: "Shipped",
    color:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  delivered: {
    icon: CheckCircle,
    label: "Delivered",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
};

export default function Orders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("any");
  const [currentPage, setCurrentPage] = useState(1); // Pagination state
  const ordersPerPage = 5;
  const debouncedSearch = useDebounce(search, 300);

  const { data: orders, isLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/user/orders"],
    enabled: !!user,
  });

  const { data: userReturns } = useQuery<ReturnRequestWithDetails[]>({
    queryKey: ["/api/user/returns"],
    enabled: !!user,
  });

  const { data: userRefunds } = useQuery<Refund[]>({
    queryKey: ["/api/user/refunds"],
    enabled: !!user,
  });

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const response = await fetch(`/api/user/orders/${orderId}/invoice`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download invoice");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderId.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "Error",
        description: "Unable to download invoice right now",
        variant: "destructive",
      });
    }
  };

  const handleCopyTracking = async (trackingNumber: string) => {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      toast({ title: "Copied", description: "Tracking number copied" });
    } catch {
      toast({
        title: "Error",
        description: "Unable to copy tracking number",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const isWithinTimeRange = (date: string | Date) => {
    if (timeFilter === "any") return true;
    const orderDate = new Date(date);
    const now = new Date();
    const diffInDays =
      (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);

    if (timeFilter === "30") return diffInDays <= 30;
    if (timeFilter === "180") return diffInDays <= 180;
    if (timeFilter === "365") return diffInDays <= 365;

    return true;
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter((order) => {
        if (statusFilter !== "all") {
          const status = order.status;
          const inProgress = ["pending", "confirmed", "processing"].includes(status);
          if (statusFilter === "in_progress" && !inProgress) return false;
          if (statusFilter === "shipped" && status !== "shipped") return false;
          if (statusFilter === "delivered" && status !== "delivered") return false;
          if (statusFilter === "cancelled" && status !== "cancelled") return false;
        }
        if (!isWithinTimeRange(order.createdAt)) return false;

        if (debouncedSearch.trim()) {
          const s = debouncedSearch.toLowerCase();
          const matchesOrderId = order.id.toLowerCase().includes(s);
          const matchesProduct = order.items.some((item) =>
            item.saree.name.toLowerCase().includes(s)
          );
          if (!matchesOrderId && !matchesProduct) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, debouncedSearch, statusFilter, timeFilter]);

  const tabCounts = useMemo(() => {
    if (!orders) {
      return {
        all: 0,
        in_progress: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      };
    }

    const counts = {
      all: orders.length,
      in_progress: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const o of orders) {
      const status = o.status;
      if (["pending", "confirmed", "processing"].includes(status)) counts.in_progress++;
      if (status === "shipped") counts.shipped++;
      if (status === "delivered") counts.delivered++;
      if (status === "cancelled") counts.cancelled++;
    }

    return counts;
  }, [orders]);

  const displayMetaByOrderId = useMemo(() => {
    const map = new Map<
      string,
      {
        itemStatusByOrderItemId: Map<
          string,
          {
            label: string;
            color: string;
            updatedAt: string | Date;
          }
        >;
      }
    >();

    if (!orders) return map;

    const refundByReturnRequestId = new Map<string, Refund>();
    for (const rf of userRefunds || []) {
      if (rf.returnRequestId) refundByReturnRequestId.set(rf.returnRequestId, rf);
    }

    const getReturnLabelColor = (resolution: string, status: string) => {
      const isExchange = resolution === "exchange";
      const base = isExchange ? "Exchange" : "Return";
      const label =
        status === "completed"
          ? `${base} Completed`
          : status === "rejected"
            ? `${base} Rejected`
            : status === "pickup_scheduled"
              ? `${base} Pickup Scheduled`
              : status === "picked_up"
                ? `${base} Picked Up`
                : status === "received"
                  ? `${base} Received`
                  : status === "approved"
                    ? `${base} Approved`
                    : status === "cancelled"
                      ? `${base} Cancelled`
                      : `${base} Requested`;

      const color =
        status === "completed"
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
          : status === "rejected"
            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
            : isExchange
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100";

      return { label, color };
    };

    const getRefundLabelColor = (status: string) => {
      const label =
        status === "completed"
          ? "Refunded"
          : status === "failed"
            ? "Refund Failed"
            : "Refund Processing";
      const color =
        status === "completed"
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
          : status === "failed"
            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
            : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
      return { label, color };
    };

    for (const o of orders) {
      const itemStatusByOrderItemId = new Map<
        string,
        { label: string; color: string; updatedAt: string | Date }
      >();

      const returnsForOrder = (userReturns || [])
        .filter((r) => r.orderId === o.id)
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      for (const rr of returnsForOrder) {
        for (const ri of rr.items || []) {
          const existing = itemStatusByOrderItemId.get(ri.orderItemId);
          const rrUpdated = rr.updatedAt || rr.createdAt;
          if (!existing || new Date(rrUpdated).getTime() > new Date(existing.updatedAt).getTime()) {
            const { label, color } = getReturnLabelColor(rr.resolution, rr.status);
            itemStatusByOrderItemId.set(ri.orderItemId, { label, color, updatedAt: rrUpdated });

            const refund = rr.resolution !== "exchange" ? refundByReturnRequestId.get(rr.id) : undefined;
            if (refund) {
              const refundMeta = getRefundLabelColor(refund.status);
              const refundUpdated = refund.completedAt || refund.initiatedAt || refund.createdAt;
              if (refundUpdated && new Date(refundUpdated).getTime() >= new Date(rrUpdated).getTime()) {
                itemStatusByOrderItemId.set(ri.orderItemId, {
                  label: refundMeta.label,
                  color: refundMeta.color,
                  updatedAt: refundUpdated,
                });
              }
            }
          }
        }
      }

      map.set(o.id, { itemStatusByOrderItemId });
    }

    return map;
  }, [orders, userReturns, userRefunds]);

  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ordersPerPage,
    currentPage * ordersPerPage
  );

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">View your orders</h2>
        <p className="text-muted-foreground mb-6">
          Please login to view your order history.
        </p>
        <Link to="/user/login">
          <Button data-testid="button-login">Login</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No orders yet</h2>
        <p className="text-muted-foreground mb-6">
          Start shopping to place your first order.
        </p>
        <Link to="/sarees">
          <Button data-testid="button-shop">Browse Sarees</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <h1
        className="font-serif text-xl font-semibold mb-4"
        data-testid="text-page-title"
      >
        My Orders
      </h1>

      <div className="mb-4 flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => {
            setStatusFilter("all");
            setCurrentPage(1);
          }}
        >
          All ({tabCounts.all})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "in_progress" ? "default" : "outline"}
          onClick={() => {
            setStatusFilter("in_progress");
            setCurrentPage(1);
          }}
        >
          In Progress ({tabCounts.in_progress})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "shipped" ? "default" : "outline"}
          onClick={() => {
            setStatusFilter("shipped");
            setCurrentPage(1);
          }}
        >
          Shipped ({tabCounts.shipped})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "delivered" ? "default" : "outline"}
          onClick={() => {
            setStatusFilter("delivered");
            setCurrentPage(1);
          }}
        >
          Delivered ({tabCounts.delivered})
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "cancelled" ? "default" : "outline"}
          onClick={() => {
            setStatusFilter("cancelled");
            setCurrentPage(1);
          }}
        >
          Cancelled ({tabCounts.cancelled})
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by Order ID or Product name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1); // Reset page when search changes
          }}
          className="w-full sm:w-80 rounded-md border px-3 py-2 text-sm"
        />
        <div className="flex gap-2 sm:gap-3 flex-wrap">
          <select
            value={timeFilter}
            onChange={(e) => {
              setTimeFilter(e.target.value);
              setCurrentPage(1); // Reset page when filter changes
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="any">Any time</option>
            <option value="30">Last 30 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last 1 year</option>
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No orders match your search or filters.
        </p>
      )}

      <div className="space-y-6">
        {paginatedOrders.map((order) => {
          const status = statusConfig[order.status] || statusConfig.pending;
          const StatusIcon = status.icon;
          const meta = displayMetaByOrderId.get(order.id);
          const hasReturnOrExchange = (userReturns || []).some((r) => r.orderId === order.id);

          return (
            <Card
              key={order.id}
              className="overflow-hidden"
              data-testid={`card-order-${order.id}`}
            >
              <div className="p-4 bg-muted/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Order ID:</span>{" "}
                      <span
                        className="font-medium"
                        data-testid={`text-order-id-${order.id}`}
                      >
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <Separator orientation="vertical" className="h-4 hidden sm:block" />
                    <div>
                      <span className="text-muted-foreground">Date:</span>{" "}
                      <span className="font-medium">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {order.trackingNumber ? (
                    <div className="text-xs text-muted-foreground">
                      Tracking: <span className="font-medium">{order.trackingNumber}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {order.items.length} item(s)
                  </Badge>
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-3">
                  {order.items.slice(0, 2).map((item) => {
                    const itemStatus = meta?.itemStatusByOrderItemId?.get(item.id);
                    const deliveryBadge = {
                      label: status.label,
                      color: status.color,
                    };
                    const effective = itemStatus || deliveryBadge;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row gap-4"
                      >
                        <Link to={`/sarees/${item.saree.id}`} className="flex-shrink-0">
                          <div className="w-16 h-20 rounded-md overflow-hidden bg-muted">
                            <img
                              src={
                                item.saree.imageUrl ||
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&h=150&fit=crop"
                              }
                              alt={item.saree.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/sarees/${item.saree.id}`}>
                            <h4 className="font-medium text-sm line-clamp-1 hover:text-primary">
                              {item.saree.name}
                            </h4>
                          </Link>
                          <div className="mt-1">
                            <Badge className={effective.color}>{effective.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Qty: {item.quantity}
                          </p>
                        </div>
                        {order.status === "delivered" ? (
                          <div className="sm:self-center">
                            <WriteReview saree={item.saree} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {order.items.length > 2 ? (
                    <p className="text-sm text-muted-foreground">
                      +{order.items.length - 2} more item(s)
                    </p>
                  ) : null}
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-muted-foreground text-sm">Total:</span>{" "}
                    <span
                      className="font-semibold text-lg"
                      data-testid={`text-order-total-${order.id}`}
                    >
                      {formatPrice(order.finalAmount || order.totalAmount)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    {(() => {
                      const isReturnWindowOpen = order.returnEligibleUntil
                        ? new Date(order.returnEligibleUntil).getTime() >= Date.now()
                        : true;
                      const showReturnExchange =
                        order.status === "delivered" && isReturnWindowOpen && !hasReturnOrExchange;
                      return showReturnExchange ? (
                        <Link to={`/user/orders/${order.id}`} className="w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                          >
                            Return / Exchange
                          </Button>
                        </Link>
                      ) : null;
                    })()}

                    {order.trackingNumber ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleCopyTracking(order.trackingNumber!)}
                      >
                        Copy tracking
                      </Button>
                    ) : null}

                    {order.paymentStatus === "paid" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleDownloadInvoice(order.id)}
                      >
                        Download invoice
                      </Button>
                    ) : null}

                    <Link to={`/user/orders/${order.id}`} className="w-full sm:w-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full sm:w-auto"
                        data-testid={`button-view-order-${order.id}`}
                      >
                        View Details
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <Button
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
          >
            Previous
          </Button>
          {[...Array(totalPages)].map((_, i) => (
            <Button
              key={i}
              size="sm"
              variant={currentPage === i + 1 ? "default" : "outline"}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </Button>
          ))}
          <Button
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
