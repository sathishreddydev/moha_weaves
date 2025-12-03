import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Clock, CheckCircle, Truck, XCircle, RotateCcw, Star, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OrderWithItems, OrderStatusHistory } from "@shared/schema";

const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
  pending: { icon: Clock, label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" },
  confirmed: { icon: CheckCircle, label: "Confirmed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" },
  processing: { icon: Package, label: "Processing", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100" },
  shipped: { icon: Truck, label: "Shipped", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100" },
  delivered: { icon: CheckCircle, label: "Delivered", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" },
  cancelled: { icon: XCircle, label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" },
};

const returnReasons = [
  { value: "defective", label: "Product is defective" },
  { value: "wrong_item", label: "Received wrong item" },
  { value: "not_as_described", label: "Not as described" },
  { value: "quality_issue", label: "Quality issue" },
  { value: "size_issue", label: "Size doesn't fit" },
  { value: "changed_mind", label: "Changed my mind" },
  { value: "other", label: "Other reason" },
];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [resolutionType, setResolutionType] = useState<"refund" | "exchange">("refund");
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; quantity: number }>>({});

  const { data: order, isLoading } = useQuery<OrderWithItems>({
    queryKey: ["/api/user/orders", id],
    enabled: !!user && !!id,
  });

  const { data: orderHistory } = useQuery<OrderStatusHistory[]>({
    queryKey: ["/api/user/orders", id, "history"],
    enabled: !!user && !!id,
  });

  const { data: eligibility } = useQuery<{ eligible: boolean; reason?: string }>({
    queryKey: ["/api/user/orders", id, "return-eligibility"],
    enabled: !!user && !!id && order?.status === "delivered",
  });

  const createReturnMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/user/returns", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Return request submitted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/returns"] });
      setShowReturnDialog(false);
      navigate("/user/returns");
    },
    onError: (error: any) => {
      toast({ title: "Failed to submit return request", description: error.message, variant: "destructive" });
    },
  });

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(numPrice);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const handleReturnSubmit = () => {
    const items = Object.entries(selectedItems)
      .filter(([_, v]) => v.selected)
      .map(([orderItemId, v]) => ({
        orderItemId,
        quantity: v.quantity,
        reason: returnReason,
      }));

    if (items.length === 0) {
      toast({ title: "Please select at least one item to return", variant: "destructive" });
      return;
    }

    createReturnMutation.mutate({
      orderId: id,
      reason: returnReason,
      description: returnDescription,
      resolutionType,
      items,
    });
  };

  const toggleItemSelection = (itemId: string, maxQty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: prev[itemId]?.selected
        ? { selected: false, quantity: 0 }
        : { selected: true, quantity: maxQty },
    }));
  };

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">View order details</h2>
        <p className="text-muted-foreground mb-6">Please login to view this order.</p>
        <Link to="/user/login"><Button data-testid="button-login">Login</Button></Link>
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

  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Order not found</h2>
        <Link to="/user/orders"><Button data-testid="button-back-orders">Back to Orders</Button></Link>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/user/orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold" data-testid="text-order-id">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <Badge className={status.color}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {status.label}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Order Items</h3>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <Link to={`/sarees/${item.saree.id}`}>
                    <div className="w-20 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&h=150&fit=crop"}
                        alt={item.saree.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </Link>
                  <div className="flex-1">
                    <Link to={`/sarees/${item.saree.id}`}>
                      <h4 className="font-medium hover:text-primary">{item.saree.name}</h4>
                    </Link>
                    {item.saree.color && (
                      <p className="text-sm text-muted-foreground">Color: {item.saree.color.name}</p>
                    )}
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    <p className="font-medium text-primary mt-1">{formatPrice(item.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {orderHistory && orderHistory.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Order Timeline</h3>
              <div className="space-y-4">
                {orderHistory.map((entry, index) => (
                  <div key={entry.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${index === orderHistory.length - 1 ? "bg-primary" : "bg-muted-foreground"}`} />
                      {index < orderHistory.length - 1 && <div className="w-0.5 h-full bg-muted" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium capitalize">{entry.newStatus.replace(/_/g, " ")}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(entry.createdAt)}</p>
                      {entry.notes && <p className="text-sm mt-1">{entry.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
              {order.discountAmount && parseFloat(order.discountAmount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(order.finalAmount || order.totalAmount)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Shipping Address</h3>
            <p className="text-sm">{order.shippingAddress}</p>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Payment</h3>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Method:</span> {order.paymentMethod?.toUpperCase() || "COD"}</p>
              <p><span className="text-muted-foreground">Status:</span>{" "}
                <Badge variant={order.paymentStatus === "completed" ? "default" : "secondary"}>
                  {order.paymentStatus}
                </Badge>
              </p>
            </div>
          </Card>

          {order.status === "delivered" && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              {eligibility?.eligible ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    You can return or exchange items within the return window.
                  </p>
                  <Button onClick={() => setShowReturnDialog(true)} className="w-full" data-testid="button-return-exchange">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Return / Exchange
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {eligibility?.reason || "Return window has expired for this order."}
                </p>
              )}
            </Card>
          )}

          {order.status === "delivered" && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Rate your purchase</h3>
              <p className="text-sm text-muted-foreground mb-4">Share your experience with others.</p>
              <Link to={`/sarees/${order.items[0]?.saree.id}`}>
                <Button variant="outline" className="w-full" data-testid="button-write-review">
                  <Star className="h-4 w-4 mr-2" />
                  Write a Review
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return / Exchange Request</DialogTitle>
            <DialogDescription>
              Select the items you want to return or exchange.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Resolution Type</Label>
              <Select value={resolutionType} onValueChange={(v) => setResolutionType(v as any)}>
                <SelectTrigger data-testid="select-resolution-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refund">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Refund
                    </div>
                  </SelectItem>
                  <SelectItem value="exchange">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      Exchange
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason for Return</Label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger data-testid="select-return-reason">
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
                data-testid="input-return-description"
              />
            </div>

            <div>
              <Label className="mb-2 block">Select Items</Label>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 border rounded-md">
                    <Checkbox
                      checked={selectedItems[item.id]?.selected || false}
                      onCheckedChange={() => toggleItemSelection(item.id, item.quantity)}
                      data-testid={`checkbox-item-${item.id}`}
                    />
                    <div className="w-10 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50&h=60&fit=crop"}
                        alt={item.saree.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{item.saree.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReturnSubmit}
              disabled={!returnReason || createReturnMutation.isPending}
              data-testid="button-submit-return"
            >
              {createReturnMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
