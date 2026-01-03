import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, MapPin, CreditCard, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ItemStatusHistory, OrderWithItems } from "@shared/schema";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  processing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  shipped: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  // Return statuses
  return_requested: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  return_approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  return_completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  // Exchange statuses
  exchange_requested: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  exchange_approved: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  exchange_processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  exchange_shipped: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  exchange_delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  exchange_completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
};

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

export default function InventoryOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const printRootRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [trackingNumber, setTrackingNumber] = useState("");

  const orderQuery = useQuery<OrderWithItems>({
    queryKey: ["/api/inventory/orders", id],
    enabled: !!id,
  });

  const historyQuery = useQuery<ItemStatusHistory[]>({
    queryKey: ["/api/inventory/orders", id, "history"],
    enabled: !!id,
  });

  const safeShortId = useMemo(() => {
    if (!id) return "";
    return String(id);
  }, [id]);

  const order = orderQuery.data;

  useEffect(() => {
    if (!order) return;
    setTrackingNumber(order.trackingNumber ? String(order.trackingNumber) : "");
  }, [order]);

  const updateTrackingMutation = useMutation({
    mutationFn: async ({ orderId, value }: { orderId: string; value: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/orders/${orderId}/tracking`,
        { trackingNumber: value }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/orders", id] });
      toast({ title: "Success", description: "Tracking number updated" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      const extracted = message.includes(":")
        ? message.split(":").slice(1).join(":").trim()
        : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update tracking number",
        variant: "destructive",
      });
    },
  });

  const printOrder = useCallback(() => {
    const root = printRootRef.current;
    if (!root) {
      toast({
        title: "Error",
        description: "Nothing to print",
        variant: "destructive",
      });
      return;
    }

    const html = root.innerHTML;
    const win = window.open("", "PRINT", "height=700,width=900");
    if (!win) {
      toast({
        title: "Error",
        description: "Popup blocked. Please allow popups to print.",
        variant: "destructive",
      });
      return;
    }

    win.document.write(`<!doctype html><html><head><title>Order ${safeShortId}</title>`);
    win.document.write(`
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #111827; }
        .muted { color: #6b7280; }
        .row { display:flex; justify-content: space-between; gap: 12px; }
        .col { flex:1; }
        .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
        .h1 { font-size: 18px; font-weight: 700; margin: 0; }
        .h2 { font-size: 12px; font-weight: 700; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.03em; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; font-size: 12px; }
        th { text-align: left; background: #f9fafb; }
        .right { text-align: right; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .divider { height: 1px; background: #e5e7eb; margin: 10px 0; }
      </style>
    `);
    win.document.write(`</head><body>`);
    win.document.write(html);
    win.document.write(`</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }, [safeShortId, toast]);

  useEffect(() => {
    const shouldPrint = searchParams.get("print") === "1";
    if (!shouldPrint) return;
    if (!orderQuery.data) return;

    // Remove the query param so refresh doesn't keep printing.
    const next = new URLSearchParams(searchParams);
    next.delete("print");
    setSearchParams(next, { replace: true });

    const t = window.setTimeout(() => {
      printOrder();
    }, 100);

    return () => window.clearTimeout(t);
  }, [orderQuery.data, printOrder, searchParams, setSearchParams]);

  if (orderQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="max-w-5xl mx-auto">
        <Button variant="outline" onClick={() => navigate("/inventory/orders")}> 
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="mt-6 text-sm text-muted-foreground">Failed to load order.</div>
      </div>
    );
  }

  const history = historyQuery.data || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/inventory/orders")}> 
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <span className="font-mono text-sm text-muted-foreground">#{order.id}</span>
          </div>
          <h1 className="text-2xl font-semibold">Order Details</h1>
          <div className="text-sm text-muted-foreground">Placed on {formatDate(order.createdAt)}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Show item-level statuses */}
          {order.items?.length === 1 ? (
            <Badge className={statusColor[order.items[0].status as string] || statusColor.pending}>
              {String(order.items[0].status).charAt(0).toUpperCase() + String(order.items[0].status).slice(1)}
            </Badge>
          ) : (
            <div className="flex flex-col gap-1">
              {order.items?.map((item, index) => (
                <Badge key={item.id} className={statusColor[item.status as string] || statusColor.pending}>
                  Item {index + 1}: {String(item.status).charAt(0).toUpperCase() + String(item.status).slice(1)}
                </Badge>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={printOrder}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div className="font-medium">Shipping Info</div>
            </div>
            <div className="text-sm">{order.shippingAddress}</div>
            <div className="text-sm text-muted-foreground">Phone: {order.phone}</div>
            {order.trackingNumber ? (
              <div className="text-sm text-muted-foreground">Tracking: {order.trackingNumber}</div>
            ) : null}
            {order.estimatedDelivery ? (
              <div className="text-sm text-muted-foreground">
                ETA: {formatDate(order.estimatedDelivery)}
              </div>
            ) : null}

            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-1">Update Tracking Number</div>
              <div className="flex items-center gap-2">
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
                <Button
                  onClick={() => {
                    if (!id) return;
                    updateTrackingMutation.mutate({ orderId: id, value: trackingNumber });
                  }}
                  disabled={!id || updateTrackingMutation.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div className="font-medium">Payment Info</div>
            </div>
            <div className="text-sm text-muted-foreground">
              Method: {String(order.paymentMethod || "—").toUpperCase()}
            </div>
            <div className="text-sm text-muted-foreground">Status: {String(order.paymentStatus || "—")}</div>
            {order.razorpayPaymentId ? (
              <div className="text-sm text-muted-foreground">Razorpay: {order.razorpayPaymentId}</div>
            ) : null}
            {order.paymentId ? (
              <div className="text-sm text-muted-foreground">Payment Ref: {order.paymentId}</div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div className="font-medium">Order Items</div>
          </div>

          <div className="space-y-3">
            {(order.items || []).map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-12 h-16 rounded overflow-hidden bg-muted">
                  <img
                    src={
                      item.saree?.imageUrl ||
                      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                    }
                    alt={item.saree?.name || "Saree"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.saree?.name || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">
                    Qty: {item.quantity} x {formatPrice(item.price)}
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {formatPrice(Number(item.quantity) * Number(item.price))}
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatPrice(order.totalAmount)}</span>
            </div>
            {Number(order.discountAmount || 0) > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">-{formatPrice(order.discountAmount || 0)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="font-medium">Total</span>
              <span className="font-bold">{formatPrice(order.finalAmount || order.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="font-medium mb-3">Status History</div>
          {historyQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground">No status history yet.</div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <span className="font-medium capitalize">{String(h.status).replace(/_/g, " ")}</span>
                    {h.note ? (
                      <div className="text-xs text-muted-foreground">{h.note}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(h.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="hidden">
        <div ref={printRootRef}>
          <div className="row">
            <div className="col">
              <div className="h1">MOHA WEAVES</div>
              <div className="muted">Courier Dispatch Slip</div>
            </div>
            <div className="col right">
              <div className="mono">Order: {order.id}</div>
              <div className="muted">Date: {formatDate(order.createdAt)}</div>
              <div className="muted">Status: {order.items?.map(item => String(item.status)).join(", ")}</div>
            </div>
          </div>

          <div className="divider" />

          <div className="row">
            <div className="col box">
              <div className="h2">Ship To</div>
              <div>{order.shippingAddress}</div>
              <div className="muted">Phone: {order.phone}</div>
            </div>
            <div className="col box">
              <div className="h2">Payment</div>
              <div className="muted">Method: {String(order.paymentMethod || "—").toUpperCase()}</div>
              <div className="muted">Status: {String(order.paymentStatus || "—")}</div>
              <div className="muted">Amount: {formatPrice(order.finalAmount || order.totalAmount)}</div>
            </div>
          </div>

          <div className="divider" />

          <div className="box">
            <div className="h2">Items</div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="right">Qty</th>
                  <th className="right">Price</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.saree?.name || "Item"}</td>
                    <td className="right">{item.quantity}</td>
                    <td className="right">{formatPrice(item.price)}</td>
                    <td className="right">{formatPrice(Number(item.quantity) * Number(item.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divider" />

            <div className="row">
              <div className="col"></div>
              <div className="col">
                <div className="row">
                  <div className="muted">Subtotal</div>
                  <div>{formatPrice(order.totalAmount)}</div>
                </div>
                {Number(order.discountAmount || 0) > 0 ? (
                  <div className="row">
                    <div className="muted">Discount</div>
                    <div>-{formatPrice(order.discountAmount || 0)}</div>
                  </div>
                ) : null}
                <div className="row">
                  <div className="h2" style={{ margin: 0 }}>Grand Total</div>
                  <div style={{ fontWeight: 700 }}>{formatPrice(order.finalAmount || order.totalAmount)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="muted" style={{ fontSize: 11 }}>
            Notes: Handle with care. This is a system generated dispatch slip.
          </div>
        </div>
      </div>
    </div>
  );
}
