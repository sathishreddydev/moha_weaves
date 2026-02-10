import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ReusableDialog } from "@/components/common/ReusableDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  OrderWithItems,
  ItemStatusHistory,
  ReturnRequestWithDetails,
  Refund,
  ProductWithDetails,
  OnlineExchangeWithDetails,
} from "@shared/schema";
import {
  itemStatusConfig,
  isItemDelivered,
  returnReasons,
  getItemStatusConfig,
} from "@/constants/itemStatusConfig";
import { WriteReview } from "@/components/product/WriteReview";

export default function ItemOrderDetails() {
  const { orderId, itemId } = useParams<{ orderId: string; itemId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [resolutionType, setResolutionType] = useState<"refund" | "exchange">(
    "refund",
  );

  const { data: order, isLoading } = useQuery<OrderWithItems>({
    queryKey: ["/api/user/orders", orderId],
    enabled: !!user && !!orderId,
  });

  const item = order?.items?.find((item) => item.id === itemId);

  const { data: userReturns } = useQuery<ReturnRequestWithDetails[]>({
    queryKey: ["/api/user/returns"],
    enabled: !!user,
  });

  const razorpayPaymentDetails = order?.paymentDetails;

  const createReturnMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.resolution === "exchange") {
        const response = await apiRequest(
          "POST",
          "/api/user/online-exchanges",
          data,
        );
        return response;
      } else {
        const response = await apiRequest("POST", "/api/user/returns", data);
        return response;
      }
    },
    onSuccess: (data, variables) => {
      toast({
        title: `${variables.resolution === "exchange" ? "Exchange" : "Return"} request submitted successfully`,
      });
      if (variables.resolution === "exchange") {
        queryClient.invalidateQueries({
          queryKey: ["/api/user/online-exchanges"],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/user/returns"] });
      }
      setShowReturnDialog(false);
      navigate(
        variables.resolution === "exchange"
          ? "/user/exchanges"
          : "/user/returns",
      );
    },
    onError: (error: any, variables) => {
      toast({
        title: `Failed to submit ${variables.resolution === "exchange" ? "exchange" : "return"} request`,
        description: error.message,
        variant: "destructive",
      });
    },
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownloadInvoice = async () => {
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
    } catch (e) {
      toast({
        title: "Error",
        description: "Unable to download invoice right now",
        variant: "destructive",
      });
    }
  };

  const handleReturnSubmit = () => {
    if (!item) return;

    if (resolutionType === "exchange") {
      if (item.product.onlineStock <= 0) {
        toast({
          title: "Item is out of stock and cannot be exchanged",
          description: "You can return it instead.",
          variant: "destructive",
        });
        return;
      }
    }

    createReturnMutation.mutate({
      orderId: orderId,
      reason: returnReason,
      reasonDetails: returnDescription,
      resolution: resolutionType,
      items: [
        {
          orderItemId: item.id,
          quantity: item.quantity,
          reason: returnReason,
          exchangeproductId:
            resolutionType === "exchange" ? item.product.id : null,
        },
      ],
    });
  };

  const isItemEligibleForReturn = (itemId: string): boolean => {
    const item = order?.items?.find((item) => item.id === itemId);
    return item?.returnEligibility?.eligible ?? false;
  };
  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">View item details</h2>
        <p className="text-muted-foreground mb-6">
          Please login to view this item details.
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
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!order || !item) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Item not found</h2>
        <Link to="/user/orders">
          <Button data-testid="button-back-orders">Back to Orders</Button>
        </Link>
      </div>
    );
  }

  const itemStatus = getItemStatusConfig(item.status);
  const fallback = {
    label: "No status",
    color: "bg-gray-100 text-gray-800",
    updatedAt: order.updatedAt,
  };
  const displayStatus = itemStatus || fallback;

  // Check if this item has a completed return with refund
  const itemReturn = userReturns?.find(
    (returnRequest) =>
      returnRequest.orderId === orderId &&
      returnRequest.items.some(
        (returnItem) => returnItem.orderItemId === item.id,
      ) &&
      returnRequest.status === "return_completed" &&
      returnRequest.resolution === "refund",
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <Link
        to="/user/orders"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Orders
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex gap-6 mb-6">
            <div className="flex-shrink-0 w-40 aspect-[4/5] overflow-hidden rounded-lg bg-muted">
              <img
                src={
                  item.product.imageUrl ||
                  "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=500&fit=crop"
                }
                alt={item.product.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1">
              <h1 className="font-serif text-2xl font-semibold mb-2">
                {item.product.name}
              </h1>

              <div className="space-y-1 mb-4">
                <p className="text-muted-foreground text-sm">
                  Order #{order.id} • Placed on {formatDate(order.createdAt)}
                </p>
                <p className="text-muted-foreground text-sm">
                  Item ID: {item.id}
                </p>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <Badge className={displayStatus.color}>
                  {displayStatus.label}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Quantity: {item.quantity}
                </p>
              </div>

              <p className="text-2xl font-semibold text-primary mb-4">
                {formatPrice(item.price)}
              </p>

              <WriteReview product={item.product} />
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            {item.status === "delivered" &&
              isItemEligibleForReturn(item.id) && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResolutionType("refund");
                      setShowReturnDialog(true);
                    }}
                  >
                    Return Item
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResolutionType("exchange");
                      setShowReturnDialog(true);
                    }}
                  >
                    Exchange Item
                  </Button>
                </div>
              )}

            {order.paymentStatus === "paid" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownloadInvoice}
              >
                Download Invoice
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Order Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID:</span>
                <span className="font-medium">#{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Date:</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item Status:</span>
                <Badge className={displayStatus.color}>
                  {displayStatus.label}
                </Badge>
              </div>
              {order.trackingNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Tracking Number:
                  </span>
                  <span className="font-medium">{order.trackingNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping Address:</span>
                <span className="text-right max-w-[60%]">
                  {order.shippingAddress}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Payment Information</h3>
            <div className="text-sm space-y-2">
              <p>
                <span className="text-muted-foreground">Method:</span>{" "}
                {order.paymentMethod?.toUpperCase()}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge
                  variant={
                    order.paymentStatus === "paid" ? "default" : "secondary"
                  }
                >
                  {order.paymentStatus}
                </Badge>
              </p>
              <p>
                <span className="text-muted-foreground">Item Price:</span>{" "}
                {formatPrice(item.price)}
              </p>
              {razorpayPaymentDetails?.available &&
                razorpayPaymentDetails.display && (
                  <p>
                    <span className="text-muted-foreground">Paid via:</span>{" "}
                    {razorpayPaymentDetails.display}
                    {razorpayPaymentDetails.subtype ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({razorpayPaymentDetails.subtype})
                      </span>
                    ) : null}
                  </p>
                )}
            </div>
          </Card>

          {itemReturn && (
            <Card className="p-4 border-green-200 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <h3 className="font-semibold text-green-800">
                  Refund Information
                </h3>
              </div>
              <div className="text-sm space-y-2">
                <p className="text-green-700">
                  <span className="font-medium">Refund Amount:</span>{" "}
                  {formatPrice(itemReturn.refundAmount || "0")}
                </p>
                <p className="text-green-600">
                  Your refund has been processed and will be credited to your
                  original payment method within 5-7 working days.
                </p>
                {itemReturn.refund && (
                  <div className="mt-2 pt-2 border-t border-green-200">
                    <p className="text-xs text-green-600">
                      Refund Status:{" "}
                      <Badge variant="secondary" className="text-xs">
                        {itemReturn.refund.status.replace(/_/g, " ")}
                      </Badge>
                    </p>
                    {itemReturn.refund.razorpayRefundId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Refund ID:{" "}
                        {itemReturn.refund.razorpayRefundId.slice(0, 12)}...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Need Help?</h3>
            {item.status === "delivered" ? (
              (() => {
                const eligible = isItemEligibleForReturn(item.id);
                if (eligible && item.returnEligibility) {
                  return (
                    <p className="text-sm text-muted-foreground mb-4">
                      {item.returnEligibility?.remainingDays !== undefined
                        ? `You can return or exchange this item within ${item.returnEligibility.remainingDays} day${item.returnEligibility.remainingDays !== 1 ? "s" : ""}.`
                        : "You can return or exchange this item within the return window."}
                    </p>
                  );
                } else {
                  return (
                    <p className="text-sm text-muted-foreground">
                      {item.returnEligibility?.reason ||
                        "Return window has expired for this item."}
                    </p>
                  );
                }
              })()
            ) : (
              <p className="text-sm text-muted-foreground">
                Returns and exchanges are available after your order is
                delivered.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Customer Support</h3>
            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">
                For any help, share this Order ID and Item ID with support.
              </p>
              <p>
                <span className="text-muted-foreground">Order ID:</span>{" "}
                {order.id}
              </p>
              <p>
                <span className="text-muted-foreground">Item ID:</span>{" "}
                {item.id}
              </p>
              <a className="text-primary underline block" href="/contact">
                Contact Us
              </a>
              <a className="text-primary underline block" href="/faq">
                FAQ
              </a>
            </div>
          </Card>

          {order.items && order.items.length > 1 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Other Items in This Order</h3>
              <div className="space-y-3">
                {order.items
                  .filter((orderItem) => orderItem.id !== item.id)
                  .map((orderItem) => {
                    const orderItemStatus = getItemStatusConfig(
                      orderItem.status,
                    );
                    const orderItemFallback = {
                      label: "No status",
                      color: "bg-gray-100 text-gray-800",
                      updatedAt: order.updatedAt,
                    };
                    const orderItemDisplayStatus =
                      orderItemStatus || orderItemFallback;

                    return (
                      <div
                        key={orderItem.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() =>
                          navigate(
                            `/user/orders/${orderId}/items/${orderItem.id}`,
                          )
                        }
                      >
                        <div className="w-12 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                          <img
                            src={
                              orderItem.product.imageUrl ||
                              "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50&h=70&fit=crop"
                            }
                            alt={orderItem.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm hover:text-primary line-clamp-1">
                            {orderItem.product.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Qty: {orderItem.quantity}
                            {(() => {
                              const variant = orderItem.variantId && orderItem.product.variants?.find((v: any) => v.id === orderItem.variantId);
                              return variant ? ` • Size: ${variant.size}` : '';
                            })()} •{" "}
                            {formatPrice(orderItem.price)}
                          </p>
                        </div>
                        <Badge
                          className={`${orderItemDisplayStatus.color} text-xs`}
                        >
                          {orderItemDisplayStatus.label}
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Return/Exchange Dialog */}
      <ReusableDialog
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        title={
          resolutionType === "exchange" ? "Exchange Request" : "Return Request"
        }
        description={`${resolutionType === "exchange" ? "Exchange this item for the same product." : "Return this item."}`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowReturnDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReturnSubmit}
              disabled={!returnReason || createReturnMutation.isPending}
            >
              {createReturnMutation.isPending
                ? "Submitting..."
                : "Submit Request"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Reason</Label>
            <Select value={returnReason} onValueChange={setReturnReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {returnReasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Additional Details</Label>
            <Textarea
              value={returnDescription}
              onChange={(e) => setReturnDescription(e.target.value)}
              placeholder="Please provide more details..."
            />
          </div>

          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium mb-1">Item Details:</p>
            <p className="text-sm text-muted-foreground">ID: {item.id}</p>
            <p className="text-sm text-muted-foreground">
              Name: {item.product.name}
            </p>
            {resolutionType === "exchange" && (
              <p className="text-sm text-muted-foreground mt-1">
                Exchange will be processed for the same product.
              </p>
            )}
          </div>
        </div>
      </ReusableDialog>
    </div>
  );
}
