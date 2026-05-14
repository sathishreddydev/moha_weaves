import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, MapPin, CreditCard, Printer, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ItemStatusHistory, OrderWithItems, ShippingAddress } from "@shared/schema";
import { getItemStatusConfig } from "@/constants/itemStatusConfig";
import { formatDate, formatPrice } from "@/lib/utils";

/** Normalise shippingAddress — it can be a JSON string, a plain object, or a legacy string. */
function parseShippingAddress(raw: string | ShippingAddress | undefined | null): ShippingAddress | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as ShippingAddress;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed as ShippingAddress;
  } catch {
    // not JSON — treat as a plain address string
    return { address: raw } as ShippingAddress;
  }
  return null;
}

function ShippingAddressBlock({ raw }: { raw: string | ShippingAddress | undefined | null }) {
  const addr = parseShippingAddress(raw);
  if (!addr) return <div className="text-sm text-muted-foreground">No address on file</div>;

  const lines: string[] = [];
  if (addr.name) lines.push(addr.name);
  const street = [addr.address, addr.locality].filter(Boolean).join(", ");
  if (street) lines.push(street);
  const cityPin = [addr.city, addr.pincode].filter(Boolean).join(" – ");
  if (cityPin) lines.push(cityPin);

  return (
    <div className="text-sm space-y-0.5">
      {lines.map((l, i) => (
        <div key={i} className={i === 0 ? "font-medium" : "text-muted-foreground"}>{l}</div>
      ))}
    </div>
  );
}

function ShippingAddressText(raw: string | ShippingAddress | undefined | null): string {
  const addr = parseShippingAddress(raw);
  if (!addr) return "No address";
  return [addr.name, addr.address, addr.locality, addr.city, addr.pincode].filter(Boolean).join(", ");
}

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
      return response;
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
          <Button variant="outline" onClick={printOrder}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shipping Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div className="font-medium">Shipping Info</div>
            </div>

            <ShippingAddressBlock raw={order.shippingAddress} />

            <div className="text-sm text-muted-foreground">
              Phone: <span className="text-foreground font-medium">{order.phone || "—"}</span>
            </div>

            {order.shippingMethod ? (
              <div className="text-sm text-muted-foreground">
                Method:{" "}
                <span className="text-foreground capitalize">{String(order.shippingMethod).replace(/_/g, " ")}</span>
              </div>
            ) : null}

            {order.trackingNumber ? (
              <div className="text-sm text-muted-foreground">
                Tracking: <span className="font-mono text-foreground">{order.trackingNumber}</span>
              </div>
            ) : null}

            {order.delhiveryWaybill ? (
              <div className="text-sm text-muted-foreground">
                Waybill: <span className="font-mono text-foreground">{order.delhiveryWaybill}</span>
              </div>
            ) : null}

            {order.estimatedDelivery ? (
              <div className="text-sm text-muted-foreground">
                ETA: {formatDate(order.estimatedDelivery)}
              </div>
            ) : null}

            {order.deliveredAt ? (
              <div className="text-sm text-muted-foreground">
                Delivered: {formatDate(order.deliveredAt)}
              </div>
            ) : null}

            <div className="pt-1">
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

        {/* Payment Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div className="font-medium">Payment Info</div>
            </div>

            <div className="text-sm text-muted-foreground">
              Method:{" "}
              <span className="text-foreground font-medium">
                {order.paymentDetails?.display ||
                  String(order.paymentMethod || "—").toUpperCase()}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              Status:{" "}
              <Badge
                variant="outline"
                className={
                  order.paymentStatus === "paid"
                    ? "border-green-500 text-green-700 bg-green-50"
                    : order.paymentStatus === "pending"
                    ? "border-yellow-500 text-yellow-700 bg-yellow-50"
                    : "border-red-400 text-red-700 bg-red-50"
                }
              >
                {String(order.paymentStatus || "—").toUpperCase()}
              </Badge>
            </div>

            {order.paymentDetails?.razorpayPaymentId ? (
              <div className="text-sm text-muted-foreground">
                Payment ID:{" "}
                <span className="font-mono text-foreground">{order.paymentDetails.razorpayPaymentId}</span>
              </div>
            ) : order.razorpayPaymentId ? (
              <div className="text-sm text-muted-foreground">
                Payment ID:{" "}
                <span className="font-mono text-foreground">{order.razorpayPaymentId}</span>
              </div>
            ) : null}

            {order.couponCode ? (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                Coupon:{" "}
                <span className="font-mono text-foreground">{order.couponCode}</span>
                {order.couponValue ? (
                  <span className="text-green-600 font-medium ml-1">
                    ({order.couponType === "percentage" ? `${order.couponValue}%` : formatPrice(order.couponValue)} off)
                  </span>
                ) : null}
              </div>
            ) : null}

            {order.notes ? (
              <div className="text-sm text-muted-foreground">
                Notes: <span className="text-foreground">{order.notes}</span>
              </div>
            ) : null}

            <Separator />

            {/* Shipment flags */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div>
                Shipment:{" "}
                <span className="text-foreground capitalize">
                  {String(order.shipmentType || "—").replace(/_/g, " ")}
                </span>
              </div>
              <div>
                Shipments:{" "}
                <span className="text-foreground">
                  {order.completedShipments ?? 0}/{order.totalShipments ?? 1}
                </span>
              </div>
              <div>
                Auto-processed:{" "}
                <span className={order.autoProcessed ? "text-green-600" : "text-muted-foreground"}>
                  {order.autoProcessed ? "Yes" : "No"}
                </span>
              </div>
              <div>
                Addr validated:{" "}
                <span className={order.addressValidated ? "text-green-600" : "text-yellow-600"}>
                  {order.addressValidated ? "Yes" : "No"}
                </span>
              </div>
              <div>
                Customer notified:{" "}
                <span className={order.customerNotified ? "text-green-600" : "text-muted-foreground"}>
                  {order.customerNotified ? "Yes" : "No"}
                </span>
              </div>
              <div>
                Pickup scheduled:{" "}
                <span className={order.pickupScheduled ? "text-green-600" : "text-muted-foreground"}>
                  {order.pickupScheduled ? "Yes" : "No"}
                </span>
              </div>
            </div>
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
            {(order.items || []).map((item) => {
              const itemStatus = getItemStatusConfig(item.status);
              const fallback = {
                label: "No status",
                color: "bg-gray-100 text-gray-800",
                updatedAt: order.updatedAt,
              };
              const displayStatus = itemStatus || fallback;
              const returnElig = item.returnEligibility;
              return (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="w-14 h-18 rounded overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={
                        item.product?.imageUrl ||
                        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                      }
                      alt={item.product?.name || "product"}
                      className="w-14 h-18 object-cover"
                      style={{ height: "72px" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-medium text-sm">{item.product?.name || "Unknown"}</div>

                    {/* Category & Color */}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.product?.category?.name ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full">
                          {item.product.category.name}
                        </span>
                      ) : null}
                      {item.product?.color?.name ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                          {item.product.color.name}
                        </span>
                      ) : null}
                      {(() => {
                        const variant = item.variantId && item.product?.variants?.find((v: any) => v.id === item.variantId);
                        return variant ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full">Size: {variant.size}</span>
                        ) : null;
                      })()}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Qty: <span className="text-foreground font-medium">{item.quantity}</span>
                      {" × "}
                      <span className="text-foreground">{formatPrice(item.price)}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={displayStatus.color}>{displayStatus.label}</Badge>
                      {returnElig && !returnElig.eligible ? (
                        <span className="text-xs text-muted-foreground italic">{returnElig.reason}</span>
                      ) : returnElig?.eligible ? (
                        <span className="text-xs text-green-600">
                          Return eligible{returnElig.remainingDays != null ? ` (${returnElig.remainingDays}d left)` : ""}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs text-muted-foreground">Item ID: <span className="font-mono">{item.id}</span></div>
                  </div>
                  <div className="text-sm font-semibold flex-shrink-0">
                    {formatPrice(Number(item.quantity) * Number(item.price))}
                  </div>
                </div>
              )
            })}

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
              <div>{ShippingAddressText(order.shippingAddress)}</div>
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
                    <td>{item.product?.name || "Item"}</td>
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
