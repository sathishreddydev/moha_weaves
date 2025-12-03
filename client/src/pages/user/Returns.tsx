import { Link } from "react-router-dom";
import { RotateCcw, Package, Clock, CheckCircle, XCircle, Truck, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { ReturnRequestWithDetails } from "@shared/schema";

const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  requested: {
    icon: Clock,
    label: "Pending Review",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  approved: {
    icon: CheckCircle,
    label: "Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  in_transit: {
    icon: Truck,
    label: "Items in Transit",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  inspection: {
    icon: Package,
    label: "Under Inspection",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
};

export default function Returns() {
  const { user } = useAuth();

  const { data: returns, isLoading } = useQuery<ReturnRequestWithDetails[]>({
    queryKey: ["/api/user/returns"],
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
        <RotateCcw className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">View your returns</h2>
        <p className="text-muted-foreground mb-6">
          Please login to view your return requests.
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

  if (!returns || returns.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <RotateCcw className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No return requests</h2>
        <p className="text-muted-foreground mb-6">
          You haven't made any return or exchange requests yet.
        </p>
        <Link to="/user/orders">
          <Button data-testid="button-view-orders">View Orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-serif text-3xl font-semibold mb-8" data-testid="text-page-title">
        Returns & Exchanges
      </h1>

      <div className="space-y-6">
        {returns.map((returnRequest) => {
          const status = statusConfig[returnRequest.status] || statusConfig.requested;
          const StatusIcon = status.icon;
          const isExchange = returnRequest.resolutionType === "exchange";

          return (
            <Card key={returnRequest.id} className="overflow-hidden" data-testid={`card-return-${returnRequest.id}`}>
              <div className="p-4 bg-muted/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    {isExchange ? (
                      <ArrowLeftRight className="h-4 w-4 text-primary" />
                    ) : (
                      <RotateCcw className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-medium">
                      {isExchange ? "Exchange" : "Return"} Request
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div>
                    <span className="text-muted-foreground">Order:</span>{" "}
                    <Link to={`/user/orders/${returnRequest.orderId}`} className="font-medium hover:text-primary">
                      #{returnRequest.orderId.slice(0, 8).toUpperCase()}
                    </Link>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    <span className="font-medium">{formatDate(returnRequest.createdAt)}</span>
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
                  <p className="text-sm font-medium capitalize">{returnRequest.reason.replace(/_/g, " ")}</p>
                  {returnRequest.description && (
                    <p className="text-sm text-muted-foreground mt-1">{returnRequest.description}</p>
                  )}
                </div>

                <div className="space-y-3">
                  {returnRequest.items.slice(0, 2).map((item) => (
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
                      </div>
                    </div>
                  ))}
                  {returnRequest.items.length > 2 && (
                    <p className="text-sm text-muted-foreground">+{returnRequest.items.length - 2} more item(s)</p>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground text-sm">
                      {isExchange ? "Exchange" : "Return"} Amount:
                    </span>{" "}
                    <span className="font-semibold text-lg" data-testid={`text-return-amount-${returnRequest.id}`}>
                      {formatPrice(returnRequest.returnAmount)}
                    </span>
                  </div>

                  {returnRequest.refund && (
                    <Badge variant={returnRequest.refund.status === "completed" ? "default" : "secondary"}>
                      Refund: {returnRequest.refund.status}
                    </Badge>
                  )}
                </div>

                {returnRequest.adminNotes && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-md">
                    <p className="text-sm font-medium">Admin Notes:</p>
                    <p className="text-sm text-muted-foreground">{returnRequest.adminNotes}</p>
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
