import { Link } from "react-router-dom";
import { ArrowLeftRight, Package, Clock, CheckCircle, XCircle, Truck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { returnStatusConfig } from "@/constants/statusConfig";
import type { ReturnRequestWithDetails } from "@shared/schema";

const exchangeOrderStatusConfig = {
  exchange_processing: {
    icon: Clock,
    label: "Processing Exchange",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  exchange_shipped: {
    icon: Truck,
    label: "Exchange Shipped",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  exchange_delivered: {
    icon: CheckCircle,
    label: "Exchange Delivered",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
};

export default function Exchanges() {
  const { user } = useAuth();

  const { data: exchanges, isLoading } = useQuery<ReturnRequestWithDetails[]>({
    queryKey: ["/api/user/exchanges"],
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

  const getExchangeOrderStatusDisplay = (orderStatus: string) => {
  const config = exchangeOrderStatusConfig[orderStatus as keyof typeof exchangeOrderStatusConfig];
  if (!config) return null;
  
  const StatusIcon = config.icon;
  return (
    <Badge className={config.color}>
      <StatusIcon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
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
        {exchanges.map((exchangeRequest) => {
          const status = returnStatusConfig[exchangeRequest.status] || returnStatusConfig.requested;
          const StatusIcon = status.icon;

          return (
            <Card key={exchangeRequest.id} className="overflow-hidden" data-testid={`card-exchange-${exchangeRequest.id}`}>
              <div className="p-4 bg-muted/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-primary" />
                    <span className="font-medium">Exchange Request</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div>
                    <span className="text-muted-foreground">Order:</span>{" "}
                    <Link to={`/user/orders/${exchangeRequest.orderId}`} className="font-medium hover:text-primary">
                      #{exchangeRequest.orderId.slice(0, 8).toUpperCase()}
                    </Link>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    <span className="font-medium">{formatDate(exchangeRequest.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Badge className={status.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                  {exchangeRequest.status === "completed" && exchangeRequest.order?.status && 
                    getExchangeOrderStatusDisplay(exchangeRequest.order.status)
                  }
                </div>
              </div>

              <div className="p-4">
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm font-medium capitalize">{exchangeRequest.reason.replace(/_/g, " ")}</p>
                  {exchangeRequest.reasonDetails && (
                    <p className="text-sm text-muted-foreground mt-1">{exchangeRequest.reasonDetails}</p>
                  )}
                </div>

                <div className="space-y-3">
                  {exchangeRequest.items.slice(0, 2).map((item) => (
                    <div key={item.id} className="flex gap-4 items-center">
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
                  {exchangeRequest.items.length > 2 && (
                    <p className="text-sm text-muted-foreground">+{exchangeRequest.items.length - 2} more item(s)</p>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground text-sm">Exchange Amount:</span>{" "}
                    <span className="font-semibold text-lg" data-testid={`text-exchange-amount-${exchangeRequest.id}`}>
                      {formatPrice(exchangeRequest.refundAmount || "0")}
                    </span>
                  </div>
                </div>

                {exchangeRequest.inspectionNotes && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-md">
                    <p className="text-sm font-medium">Inspection Notes:</p>
                    <p className="text-sm text-muted-foreground">{exchangeRequest.inspectionNotes}</p>
                  </div>
                )}

                {exchangeRequest.status === "completed" && exchangeRequest.order?.status && (
                  <div className="mt-4 p-3 bg-primary/5 rounded-md border border-primary/20">
                    <p className="text-sm font-medium mb-2">Exchange Progress</p>
                    <div className="flex items-center gap-2">
                      {getExchangeOrderStatusDisplay(exchangeRequest.order.status)}
                      <span className="text-xs text-muted-foreground">
                        Track your exchange shipment status
                      </span>
                    </div>
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
