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

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

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
        className="font-serif text-3xl font-semibold mb-8"
        data-testid="text-page-title"
      >
        My Orders
      </h1>

      <div className="space-y-6">
        {orders.map((order) => {
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
                    <div key={item.id} className="flex gap-4">
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
                    </div>
                  ))}

                  {order.items.length > 3 && (
                    <p className="text-sm text-muted-foreground">
                      +{order.items.length - 3} more item(s)
                    </p>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
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
    </div>
  );
}
