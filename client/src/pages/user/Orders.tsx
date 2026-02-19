import { useDebounce } from "@/components/common/useDebounceHook";
import { WriteReview } from "@/components/product/WriteReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getItemStatusConfig, isItemCancelled, isItemDelivered, isItemInProgress, isItemShipped } from "@/constants/itemStatusConfig";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { OrderWithItems } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Package,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDate, formatPrice } from "@/lib/utils";

export default function Orders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("any");
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 5;
  const debouncedSearch = useDebounce(search, 300);

  const { data: orders, isLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/user/orders"],
    enabled: !!user,
  });


  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const response = await apiRequest("GET", `/api/user/orders/${orderId}/invoice`);

      if (!response.ok) {
        throw new Error("Failed to download invoice");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
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

  const handleItemClick = (orderId: string, itemId: string) => {
    navigate(`/user/orders/${orderId}/items/${itemId}`);
  };


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
          // Check item-level statuses instead of order status
          const itemStatuses = order.items.map(item => item.status as any);
          const inProgress = itemStatuses.some(isItemInProgress);
          const hasShipped = itemStatuses.some(isItemShipped);
          const hasDelivered = itemStatuses.some(isItemDelivered);
          const hasCancelled = itemStatuses.some(isItemCancelled);

          if (statusFilter === "in_progress" && !inProgress) return false;
          if (statusFilter === "shipped" && !hasShipped) return false;
          if (statusFilter === "delivered" && !hasDelivered) return false;
          if (statusFilter === "cancelled" && !hasCancelled) return false;
        }
        if (!isWithinTimeRange(order.createdAt)) return false;

        if (debouncedSearch.trim()) {
          const s = debouncedSearch.toLowerCase();
          const matchesOrderId = order.id.toLowerCase().includes(s);
          const matchesProduct = order.items.some((item) =>
            item.product.name.toLowerCase().includes(s)
          );
          if (!matchesOrderId && !matchesProduct) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, debouncedSearch, statusFilter, timeFilter, isWithinTimeRange]);

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
      // Count based on item-level statuses
      const itemStatuses = o.items.map(item => item.status as any);

      if (["pending", "confirmed", "processing"].some(s => itemStatuses.includes(s))) counts.in_progress++;
      if (["exchange_processing", "exchange_shipped"].some(s => itemStatuses.includes(s))) counts.in_progress++;
      if (["shipped", "exchange_shipped"].some(s => itemStatuses.includes(s))) counts.shipped++;
      if (["delivered", "exchange_delivered", "exchange_completed", "return_completed"].some(s => itemStatuses.includes(s))) counts.delivered++;
      if (itemStatuses.includes("cancelled")) counts.cancelled++;
    }

    return counts;
  }, [orders]);

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
        <Link to="/products">
          <Button data-testid="button-shop">Browse products</Button>
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
                        #{order.id}
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
                <div className="space-y-2">
                  {order.items.map((item) => {
                    const itemStatus = getItemStatusConfig(item.status);
                    const fallback = {
                      label: "No status",
                      color: "bg-gray-100 text-gray-800",
                      updatedAt: order.updatedAt,
                    };
                    const displayStatus = itemStatus || fallback;
                    return (
                      <>
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors p-2 rounded-md"
                          onClick={() => handleItemClick(order.id, item.id)}
                        >
                          <div className="w-16 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            <img
                              src={
                                item.product.imageUrl ||
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&h=150&fit=crop"
                              }
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm line-clamp-1 hover:text-primary">
                                {item.product.name}
                              </h4>
                              <Badge className={displayStatus.color}>
                                {displayStatus.label}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">
                                  Qty: {item.quantity}
                                  {(() => {
                                    const variant = item.variantId && item.product.variants?.find((v: any) => v.id === item.variantId);
                                    return variant ? ` • Size: ${variant.size}` : '';
                                  })()}
                                </p>
                                {item.status === "delivered" && (
                                  <WriteReview product={item.product} />
                                )}
                              </div>
                              <div 
                                className="mt-3 p-1 hover:bg-muted rounded-md transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemClick(order.id, item.id);
                                }}
                              >
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </div>

                          </div>


                        </div>
                      </>

                    );
                  })}

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
