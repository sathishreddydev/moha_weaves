import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Package,
  MapPin,
  CreditCard,
  Printer,
  Tag,
  ReceiptText,
  Truck,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type {
  ItemStatusHistory,
  OrderWithItems,
  ShippingAddress,
} from "@shared/schema";
import { getItemStatusConfig } from "@/constants/itemStatusConfig";
import { formatDate, formatPrice } from "@/lib/utils";
import { BRAND_FULL } from "@/lib/brand";

/** Normalise shippingAddress — it can be a JSON string, a plain object, or a legacy string. */
export function parseShippingAddress(
  raw: string | ShippingAddress | undefined | null,
): ShippingAddress | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as ShippingAddress;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null)
      return parsed as ShippingAddress;
  } catch {
    return { address: raw } as ShippingAddress;
  }
  return null;
}

export function ShippingAddressBlock({
  raw,
}: {
  raw: string | ShippingAddress | undefined | null;
}) {
  const addr = parseShippingAddress(raw);
  if (!addr)
    return (
      <div className="text-sm text-muted-foreground">No address on file</div>
    );

  const lines: string[] = [];
  if (addr.name) lines.push(addr.name);
  const street = [addr.address, addr.locality].filter(Boolean).join(", ");
  if (street) lines.push(street);
  const cityPin = [addr.city, addr.pincode].filter(Boolean).join(" – ");
  if (cityPin) lines.push(cityPin);

  return (
    <div className="text-sm space-y-0.5">
      {lines.map((l, i) => (
        <div
          key={i}
          className={i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

export function ShippingAddressText(
  raw: string | ShippingAddress | undefined | null,
): string {
  const addr = parseShippingAddress(raw);
  if (!addr) return "No address";
  return [addr.name, addr.address, addr.locality, addr.city, addr.pincode]
    .filter(Boolean)
    .join(", ");
}

/** Small labelled field used throughout the detail sections */
function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

/** Payment status badge */
function PaymentBadge({ status }: { status: string | undefined | null }) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;
  const s = status.toLowerCase();
  const cls =
    s === "paid"
      ? "border-green-500 text-green-700 bg-green-50"
      : s === "pending"
        ? "border-yellow-500 text-yellow-700 bg-yellow-50"
        : "border-red-400 text-red-700 bg-red-50";
  return (
    <Badge variant="outline" className={cls}>
      {status.toUpperCase()}
    </Badge>
  );
}

/** Flag chip — green tick / grey dash */
function FlagChip({
  label,
  value,
}: {
  label: string;
  value: boolean | undefined | null;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {value ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
      )}
      <span className={value ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
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

  const safeShortId = useMemo(() => (id ? String(id) : ""), [id]);
  const order = orderQuery.data;

  useEffect(() => {
    if (!order) return;
    setTrackingNumber(order.trackingNumber ? String(order.trackingNumber) : "");
  }, [order]);

  const updateTrackingMutation = useMutation({
    mutationFn: async ({ orderId, value }: { orderId: string; value: string }) => {
      return await apiRequest("PATCH", `/api/inventory/orders/${orderId}/tracking`, {
        trackingNumber: value,
      });
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
      toast({ title: "Error", description: "Nothing to print", variant: "destructive" });
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
    if (!shouldPrint || !orderQuery.data) return;
    const next = new URLSearchParams(searchParams);
    next.delete("print");
    setSearchParams(next, { replace: true });
    const t = window.setTimeout(() => printOrder(), 100);
    return () => window.clearTimeout(t);
  }, [orderQuery.data, printOrder, searchParams, setSearchParams]);

  /* ─── Loading / error states ─── */
  if (orderQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <Button variant="outline" onClick={() => navigate("/inventory/orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="mt-6 text-sm text-muted-foreground">Failed to load order.</div>
      </div>
    );
  }

  const history = historyQuery.data || [];

  /* ─── Derived values ─── */
  const subtotal = order.items.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0,
  );
  const itemSavings = order.items.reduce((total, item) => {
    if (item.productPrice && item.discountedPrice) {
      return (
        total +
        (parseFloat(item.productPrice) - parseFloat(item.discountedPrice)) *
          item.quantity
      );
    }
    return total;
  }, 0);
  const couponDiscount = parseFloat(order.discountAmount || "0");
  const totalSavings = itemSavings + couponDiscount;

  /* ─── Render ─── */
  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/inventory/orders")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              #{order.id}
            </span>
          </div>
          <h1 className="text-xl font-semibold">Order Details</h1>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Placed on {formatDate(order.createdAt)}
            {order.updatedAt && order.updatedAt !== order.createdAt && (
              <span className="ml-2">· Updated {formatDate(order.updatedAt)}</span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={printOrder}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* ══════════════════════════════════════════
          SECTION 1 — Order Items
      ══════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Order Items
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {(order.items || []).map((item) => {
            const itemStatus = getItemStatusConfig(item.status);
            const displayStatus = itemStatus || {
              label: "No status",
              color: "bg-gray-100 text-gray-800",
            };
            const returnElig = item.returnEligibility;
            const variant =
              item.variantId &&
              item.product?.variants?.find((v: any) => v.id === item.variantId);

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                {/* Product image */}
                <div className="w-14 flex-shrink-0 rounded overflow-hidden border bg-muted">
                  <img
                    src={
                      item.product?.imageUrl ||
                      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                    }
                    alt={item.product?.name || "product"}
                    className="w-14 object-cover"
                    style={{ height: "72px" }}
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="font-medium text-sm leading-tight">
                    {item.product?.name || "Unknown Product"}
                  </div>

                  {/* Tags row */}
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {item.product?.category?.name && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full">
                        {item.product.category.name}
                      </span>
                    )}
                    {item.product?.color?.name && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                        {item.product.color.name}
                      </span>
                    )}
                    {variant && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full">
                        Size: {variant.size}
                      </span>
                    )}
                  </div>

                  {/* Qty × price */}
                  <div className="text-xs text-muted-foreground">
                    Qty:{" "}
                    <span className="text-foreground font-medium">{item.quantity}</span>
                    {" × "}
                    <span className="text-foreground">{formatPrice(item.price)}</span>
                    {item.productPrice && item.discountedPrice &&
                      item.productPrice !== item.discountedPrice && (
                        <span className="ml-1 line-through text-muted-foreground/60">
                          {formatPrice(item.productPrice)}
                        </span>
                      )}
                  </div>

                  {/* Status + return eligibility */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${displayStatus.color}`}>
                      {displayStatus.label}
                    </Badge>
                    {returnElig && !returnElig.eligible ? (
                      <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {returnElig.reason}
                      </span>
                    ) : returnElig?.eligible ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Return eligible
                        {returnElig.remainingDays != null
                          ? ` (${returnElig.remainingDays}d left)`
                          : ""}
                      </span>
                    ) : null}
                  </div>

                  {/* Offer details per item */}
                  {item.offerDetails && (
                    <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded">
                      Offer: {typeof item.offerDetails === "object"
                        ? JSON.stringify(item.offerDetails)
                        : String(item.offerDetails)}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground font-mono">
                    Item ID: {item.id}
                  </div>
                </div>

                {/* Line total */}
                <div className="text-sm font-semibold flex-shrink-0 pt-0.5">
                  {formatPrice(Number(item.quantity) * Number(item.price))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════
          SECTION 2 — Order Summary (price breakdown)
      ══════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
            Order Summary
            {/* Order-level status badge */}
            {order.status && (
              <span className="ml-auto">
                <Badge
                  variant="outline"
                  className={
                    order.status === "completed"
                      ? "border-green-500 text-green-700 bg-green-50"
                      : order.status === "cancelled"
                        ? "border-red-400 text-red-700 bg-red-50"
                        : order.status === "processing"
                          ? "border-blue-500 text-blue-700 bg-blue-50"
                          : "border-yellow-500 text-yellow-700 bg-yellow-50"
                  }
                >
                  {String(order.status).replace(/_/g, " ").toUpperCase()}
                </Badge>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="space-y-2 text-sm">

            {/* Subtotal */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Subtotal ({order.items.length} item{order.items.length !== 1 ? "s" : ""})
              </span>
              <span className="font-medium">₹{subtotal.toFixed(2)}</span>
            </div>

            {/* Discount amount — always shown */}
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                Discount
                {order.couponCode ? (
                  <span className="font-mono text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded ml-1">
                    {order.couponCode}
                    {order.couponType && order.couponValue
                      ? ` · ${order.couponType === "percentage"
                          ? `${order.couponValue}%`
                          : `₹${order.couponValue}`} off`
                      : ""}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/60 ml-1">(no coupon)</span>
                )}
              </span>
              <span className={couponDiscount > 0 ? "font-medium text-green-600" : "font-medium text-muted-foreground"}>
                {couponDiscount > 0 ? `−₹${couponDiscount.toFixed(2)}` : "₹0.00"}
              </span>
            </div>

            {/* Item-level savings — always shown */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item savings</span>
              <span className={itemSavings > 0 ? "font-medium text-green-600" : "font-medium text-muted-foreground"}>
                {itemSavings > 0 ? `−₹${itemSavings.toFixed(2)}` : "₹0.00"}
              </span>
            </div>

            {/* Offer details — shown when present */}
            {order.items.some((i) => i.offerDetails) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Offer applied</span>
                <span className="text-xs text-blue-600 font-medium">Yes</span>
              </div>
            )}

            {/* Shipping */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium text-green-600">FREE</span>
            </div>

            {/* Tax */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">₹0.00</span>
            </div>

            <Separator className="my-2" />

            {/* Total amount (pre-discount) */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Amount (MRP)</span>
              <span className="font-medium">₹{parseFloat(order.totalAmount).toFixed(2)}</span>
            </div>

            {/* Discount amount line */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount Amount</span>
              <span className={couponDiscount > 0 ? "font-medium text-green-600" : "font-medium text-muted-foreground"}>
                {couponDiscount > 0 ? `−₹${parseFloat(order.discountAmount || "0").toFixed(2)}` : `₹${parseFloat(order.discountAmount || "0").toFixed(2)}`}
              </span>
            </div>

            {/* Final payable */}
            <div className="flex justify-between text-base font-bold pt-1 border-t">
              <span>Final Amount (Payable)</span>
              <span>₹{parseFloat(order.finalAmount).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════
          SECTION 3 — Payment Info
      ══════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Payment Info
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {/* Primary payment fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field
              label="Payment Method"
              value={
                order.paymentDetails?.display ||
                String(order.paymentMethod || "—").toUpperCase()
              }
            />
            <Field
              label="Payment Status"
              value={<PaymentBadge status={order.paymentStatus} />}
            />
            {(order.paymentDetails?.razorpayPaymentId || order.razorpayPaymentId) && (
              <Field
                label="Payment ID"
                mono
                value={
                  order.paymentDetails?.razorpayPaymentId || order.razorpayPaymentId
                }
              />
            )}
          </div>

          {/* Coupon — always shown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field
              label="Coupon Code"
              value={
                order.couponCode ? (
                  <span className="font-mono text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded text-xs">
                    {order.couponCode}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">None</span>
                )
              }
            />
            <Field
              label="Coupon Type"
              value={order.couponType ?? <span className="text-muted-foreground text-xs">None</span>}
            />
            <Field
              label="Coupon Value"
              value={
                order.couponValue != null
                  ? order.couponType === "percentage"
                    ? `${order.couponValue}%`
                    : formatPrice(order.couponValue)
                  : <span className="text-muted-foreground text-xs">None</span>
              }
            />
            <Field
              label="Coupon ID"
              mono
              value={order.couponId ?? <span className="text-muted-foreground text-xs">None</span>}
            />
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="p-2.5 rounded-lg bg-muted/40 border text-sm">
              <span className="text-xs text-muted-foreground block mb-0.5">Notes</span>
              {order.notes}
            </div>
          )}

          <Separator />

          {/* Operational flags */}
          <div>
            <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
              Processing Flags
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <FlagChip label="Auto-processed" value={order.autoProcessed} />
              <FlagChip label="Address validated" value={order.addressValidated} />
              <FlagChip label="Customer notified" value={order.customerNotified} />
              <FlagChip label="Pickup scheduled" value={order.pickupScheduled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════
          SECTION 4 — Shipment Info
      ══════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Shipment Info
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {/* Delivery address */}
          <div>
            <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Delivery Address
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <ShippingAddressBlock raw={order.shippingAddress} />
              {order.phone && (
                <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {order.phone}
                </div>
              )}
            </div>
          </div>

          {/* Shipping details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field
              label="Shipping Method"
              value={
                order.shippingMethod
                  ? String(order.shippingMethod).replace(/_/g, " ")
                  : undefined
              }
            />
            <Field
              label="Shipment Type"
              value={
                order.shipmentType
                  ? String(order.shipmentType).replace(/_/g, " ")
                  : undefined
              }
            />
            <Field
              label="Shipments"
              value={`${order.completedShipments ?? 0} / ${order.totalShipments ?? 1}`}
            />
            {order.trackingNumber && (
              <Field label="Tracking Number" mono value={order.trackingNumber} />
            )}
            {order.delhiveryWaybill && (
              <Field label="Delhivery Waybill" mono value={order.delhiveryWaybill} />
            )}
            {order.delhiveryStatus && (
              <Field label="Delhivery Status" value={order.delhiveryStatus} />
            )}
            {order.estimatedDelivery && (
              <Field label="Estimated Delivery" value={formatDate(order.estimatedDelivery)} />
            )}
            {order.deliveredAt && (
              <Field label="Delivered At" value={formatDate(order.deliveredAt)} />
            )}
          </div>

          {/* Update tracking number */}
          <div className="pt-1">
            <div className="text-xs text-muted-foreground mb-1.5">Update Tracking Number</div>
            <div className="flex items-center gap-2 max-w-sm">
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
                className="h-9"
              />
              <Button
                size="sm"
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

      {/* ══════════════════════════════════════════
          SECTION 5 — Status History
      ══════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Status History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {historyQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground">No status history yet.</div>
          ) : (
            <ol className="relative border-l border-muted ml-2 space-y-4">
              {history.map((h) => (
                <li key={h.id} className="ml-4">
                  <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {String(h.status).replace(/_/g, " ")}
                      </div>
                      {h.note && (
                        <div className="text-xs text-muted-foreground mt-0.5">{h.note}</div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(h.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* ── Hidden print template ── */}
      <div className="hidden">
        <div ref={printRootRef}>
          <div className="row">
            <div className="col">
              <div className="h1">{BRAND_FULL.toUpperCase()}</div>
              <div className="muted">Courier Dispatch Slip</div>
            </div>
            <div className="col right">
              <div className="mono">Order: {order.id}</div>
              <div className="muted">Date: {formatDate(order.createdAt)}</div>
              <div className="muted">
                Status: {order.items?.map((item) => String(item.status)).join(", ")}
              </div>
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
              <div className="muted">
                Method: {String(order.paymentMethod || "—").toUpperCase()}
              </div>
              <div className="muted">
                Status: {String(order.paymentStatus || "—")}
              </div>
              <div className="muted">
                Amount: {formatPrice(order.finalAmount || order.totalAmount)}
              </div>
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
                    <td className="right">
                      {formatPrice(Number(item.quantity) * Number(item.price))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="divider" />
            <div className="row">
              <div className="col" />
              <div className="col">
                <div className="row">
                  <div className="muted">Subtotal</div>
                  <div>{formatPrice(order.totalAmount)}</div>
                </div>
                {Number(order.discountAmount || 0) > 0 && (
                  <div className="row">
                    <div className="muted">Discount</div>
                    <div>-{formatPrice(order.discountAmount || 0)}</div>
                  </div>
                )}
                <div className="row">
                  <div className="h2" style={{ margin: 0 }}>Grand Total</div>
                  <div style={{ fontWeight: 700 }}>
                    {formatPrice(order.finalAmount || order.totalAmount)}
                  </div>
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
