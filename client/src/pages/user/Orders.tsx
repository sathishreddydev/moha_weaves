import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  ChevronRight,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { OrderWithItems } from "@shared/schema";
import { WriteReview } from "@/components/product/WriteReview";
import { useDebounce } from "@/components/common/useDebounceHook";

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
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
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
    });
  }, [orders, debouncedSearch, statusFilter, timeFilter]);

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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1
        className="font-serif text-xl font-semibold mb-4"
        data-testid="text-page-title"
      >
        My Orders
      </h1>

      {/* Search & Filters */}
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
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1); // Reset page when filter changes
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
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

          return (
            <Card
              key={order.id}
              className="overflow-hidden"
              data-testid={`card-order-${order.id}`}
            >
              <div className="p-4 bg-muted/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Order ID:</span>{" "}
                    <span
                      className="font-medium"
                      data-testid={`text-order-id-${order.id}`}
                    >
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    <span className="font-medium">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                </div>
                <Badge className={status.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              <div className="p-4">
                <div className="space-y-4">
                  {order.items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 flex-wrap sm:flex-nowrap"
                    >
                      <Link to={`/sarees/${item.saree.id}`}>
                        <div className="w-16 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
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
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity}
                        </p>
                        <p className="text-sm font-medium text-primary">
                          {formatPrice(item.price)}
                        </p>
                      </div>
                      {order.status === "delivered" && (
                        <WriteReview saree={item.saree} />
                      )}
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-sm text-muted-foreground">
                      +{order.items.length - 3} more item(s)
                    </p>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-0">
                  <div>
                    <span className="text-muted-foreground text-sm">
                      Total:
                    </span>{" "}
                    <span
                      className="font-semibold text-lg"
                      data-testid={`text-order-total-${order.id}`}
                    >
                      {formatPrice(order.totalAmount)}
                    </span>
                  </div>

                  <Link to={`/user/orders/${order.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-view-order-${order.id}`}
                    >
                      View Details
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
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
