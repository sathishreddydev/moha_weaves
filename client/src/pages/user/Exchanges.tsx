import { Link } from "react-router-dom";
import { ArrowLeftRight, Package, Clock, CheckCircle, XCircle, Truck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { OnlineExchangeWithDetails } from "@shared/schema";

const onlineExchangeStatusConfig = {
  requested: {
    icon: Clock,
    label: "Exchange Requested",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  approved: {
    icon: CheckCircle,
    label: "Exchange Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  pickup_scheduled: {
    icon: Package,
    label: "Pickup Scheduled",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  picked_up: {
    icon: Truck,
    label: "Item Picked Up",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  in_transit: {
    icon: Truck,
    label: "In Transit",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  },
  received: {
    icon: Package,
    label: "Item Received",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
  },
  inspected: {
    icon: CheckCircle,
    label: "Item Inspected",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
  },
  completed: {
    icon: CheckCircle,
    label: "Exchange Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Exchange Cancelled",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
};

export default function Exchanges() {
  const { user } = useAuth();

  const { data: exchanges, isLoading } = useQuery<OnlineExchangeWithDetails[]>({
    queryKey: ["/api/user/online-exchanges"],
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
        <ArrowLeftRight className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">View your exchanges</h2>
        <p className="text-muted-foreground mb-6">
          Please login to view your exchange requests.
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

  if (!exchanges || exchanges.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <ArrowLeftRight className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No exchange requests</h2>
        <p className="text-muted-foreground mb-6">
          You haven't made any exchange requests yet.
        </p>
        <Link to="/user/orders">
          <Button data-testid="button-view-orders">View Orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/user/returns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Returns
          </Button>
        </Link>
        <h1 className="font-serif text-xl font-semibold" data-testid="text-page-title">
          Exchanges
        </h1>
      </div>

      <div className="space-y-6">
        {exchanges.map((exchange) => {
          const status = onlineExchangeStatusConfig[exchange.status as keyof typeof onlineExchangeStatusConfig] || onlineExchangeStatusConfig.requested;
          const StatusIcon = status.icon;

          return (
            <Card key={exchange.orderId} className="overflow-hidden" data-testid={`card-exchange-${exchange.orderId}`}>
              <div className="p-4 bg-muted/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-primary" />
                    <span className="font-medium">Online Exchange</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div>
                    <span className="text-muted-foreground">Order:</span>{" "}
                    <Link to={`/user/orders/${exchange.orderId}`} className="font-medium hover:text-primary">
                      #{exchange.orderId}
                    </Link>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    <span className="font-medium">{formatDate(exchange.createdAt)}</span>
                  </div>
                </div>
                <Badge className={status.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              <div className="p-4">
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm font-medium capitalize">{exchange.reason.replace(/_/g, " ")}</p>
                  {exchange.reasonDetails && (
                    <p className="text-sm text-muted-foreground mt-1">{exchange.reasonDetails}</p>
                  )}
                </div>

                <div className="space-y-3">
                  {exchange.items.slice(0, 2).map((item: any) => (
                    <div key={item.orderItemId} className="flex gap-4 items-center">
                      <div className="w-12 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={item.orderItem.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&h=150&fit=crop"}
                          alt={item.orderItem.saree.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-1">{item.orderItem.saree.name}</h4>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        {item.exchangeSareeId && (
                          <p className="text-xs text-primary mt-1">Exchange for same product</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {exchange.items.length > 2 && (
                    <p className="text-sm text-muted-foreground">+{exchange.items.length - 2} more item(s)</p>
                  )}
                </div>

                <Separator className="my-4" />

                {exchange.inspectionNotes && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-md">
                    <p className="text-sm font-medium">Inspection Notes:</p>
                    <p className="text-sm text-muted-foreground">{exchange.inspectionNotes}</p>
                  </div>
                )}

                {exchange.status === "exchange_completed" && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Exchange Completed</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Your exchange has been successfully processed
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
