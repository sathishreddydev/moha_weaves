import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  RotateCcw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OrderWithItems, OrderStatusHistory, ReturnRequestWithDetails, Refund, SareeWithDetails } from "@shared/schema";
import { orderStatusConfig, returnStatusConfig, refundStatusConfig, inProgressReturnStatuses, activeAndCompletedStatuses, allReturnStatuses, refundSteps } from "@/constants/statusConfig";

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

  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [resolutionType, setResolutionType] = useState<"refund" | "exchange">(
    "refund"
  );
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; quantity: number }>
  >({});

  const [modalItemId, setModalItemId] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery<OrderWithItems>({
    queryKey: ["/api/user/orders", id],
    enabled: !!user && !!id,
  });

  // Fetch stock for sarees in this order to enable/disable exchange
  const { data: sareesWithStock } = useQuery<
    Array<{ id: string; stock: number }>
  >({
    queryKey: ["order-sarees-stock", order?.items?.map((it) => it.saree.id)],
    queryFn: async () => {
      if (!order?.items) return [];
      const idsSet = new Set(order.items.map((it) => it.saree.id));
      const ids = Array.from(idsSet);
      const res = await fetch("/api/getSarees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to fetch stock");
      const data = await res.json();
      return data.map((s: any) => ({ id: s.id, stock: Number(s.onlineStock) || 0 }));
    },
    enabled: !!order?.items,
  });
  const stockBySareeId = new Map(sareesWithStock?.map((s) => [s.id, s.stock]) || []);

  const { data: eligibility } = useQuery<{
    eligible: boolean;
    reason?: string;
    remainingDays?: number;
  }>({
    queryKey: ["/api/user/orders", id, "return-eligibility"],
    enabled: !!user && !!id && order?.status === "delivered",
  });

  const { data: orderHistory } = useQuery<OrderStatusHistory[]>({
    queryKey: ["/api/user/orders", id, "history"],
    enabled: !!user && !!id,
  });

  const { data: razorpayPaymentDetails } = useQuery<{
    available: boolean;
    method?: string;
    display?: string;
    subtype?: string;
    razorpayPaymentId?: string;
  }>({
    queryKey: ["/api/user/orders", id, "payment-details"],
    enabled: !!user && !!id,
  });

  const { data: userReturns } = useQuery<ReturnRequestWithDetails[]>({
    queryKey: ["/api/user/returns"],
    enabled: !!user,
  });

  const { data: userExchanges } = useQuery<ReturnRequestWithDetails[]>({
    queryKey: ["/api/user/exchanges"],
    enabled: !!user,
  });

  const { data: userRefunds } = useQuery<Refund[]>({
    queryKey: ["/api/user/refunds"],
    enabled: !!user,
  });

  const syncRefundStatusMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const response = await apiRequest("POST", `/api/user/refunds/${id}/check-status`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/refunds"], exact: false });
      toast({ title: "Success", description: "Refund status refreshed" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to refresh refund status",
        variant: "destructive",
      });
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.resolution === "exchange") {
        const response = await apiRequest("POST", "/api/user/exchanges", data);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/user/returns", data);
        return response.json();
      }
    },
    onSuccess: (data, variables) => {
      toast({ title: `${variables.resolution === "exchange" ? "Exchange" : "Return"} request submitted successfully` });
      if (variables.resolution === "exchange") {
        queryClient.invalidateQueries({ queryKey: ["/api/user/exchanges"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/user/returns"] });
      }
      setShowReturnDialog(false);
      navigate(variables.resolution === "exchange" ? "/user/exchanges" : "/user/returns");
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

  const maskId = (value?: string | null) => {
    if (!value) return "—";
    const trimmed = value.trim();
    if (trimmed.length <= 8) return trimmed;
    return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
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

  const handleReturnSubmit = () => {
    const orderItemById = new Map(order?.items?.map((it) => [it.id, it]) || []);
    const items = Object.entries(selectedItems)
      .filter(([_, v]) => v.selected)
      .map(([orderItemId, v]) => ({
        orderItemId,
        quantity: v.quantity,
        reason: returnReason,
        exchangeSareeId:
          resolutionType === "exchange"
            ? orderItemById.get(orderItemId)?.saree?.id || null
            : null,
      }));

    if (items.length === 0) {
      toast({
        title: "Please select at least one item to return",
        variant: "destructive",
      });
      return;
    }

    if (resolutionType === "exchange") {
      const outOfStockItems = items.filter(
        (i) => (stockBySareeId.get(i.exchangeSareeId!) ?? 0) <= 0
      );
      if (outOfStockItems.length > 0) {
        toast({
          title: "Some selected items are out of stock and cannot be exchanged",
          description: "You can return them instead.",
          variant: "destructive",
        });
        return;
      }
    }

    createReturnMutation.mutate({
      orderId: id,
      reason: returnReason,
      reasonDetails: returnDescription,
      resolution: resolutionType,
      items,
    });
  };

  const openReturnExchangeModal = (
    mode: "refund" | "exchange",
    preselectOrderItemId?: string
  ) => {
    setResolutionType(mode);

    setReturnReason("");
    setReturnDescription("");
    setModalItemId(preselectOrderItemId || null);
    setSelectedItems({}); // Reset selection state

    if (order?.items) {
      setSelectedItems(() => {
        const next: Record<string, { selected: boolean; quantity: number }> = {};
        for (const item of order.items) {
          const remainingQty = Number(
            remainingQtyByOrderItemId.get(String(item.id)) ?? item.quantity
          );

          if (preselectOrderItemId) {
            const isTarget = item.id === preselectOrderItemId;
            next[item.id] = {
              selected: isTarget && remainingQty > 0,
              quantity: isTarget ? remainingQty : 0,
            };
            continue;
          }

          // If opened from CTA, start with no selection.
          next[item.id] = { selected: false, quantity: 0 };
        }
        return next;
      });
    }

    setShowReturnDialog(true);
  };

  const selectAllItemsForReturnExchange = () => {
    if (!order?.items) return;
    setSelectedItems(() => {
      const next: Record<string, { selected: boolean; quantity: number }> = {};
      for (const item of order.items) {
        const remainingQty = Number(
          remainingQtyByOrderItemId.get(String(item.id)) ?? item.quantity
        );
        const locked = activeOrderItemIds.has(String(item.id));
        next[item.id] = {
          selected: !locked && remainingQty > 0,
          quantity: !locked && remainingQty > 0 ? remainingQty : 0,
        };
      }
      return next;
    });
  };

  const toggleItemSelection = (itemId: string, maxQty: number) => {
    const locked = activeOrderItemIds.has(String(itemId));
    const remainingQty = Number(remainingQtyByOrderItemId.get(String(itemId)) ?? maxQty);
    if (locked || remainingQty <= 0) return;

    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: prev[itemId]?.selected
        ? { selected: false, quantity: 0 }
        : { selected: true, quantity: remainingQty },
    }));
  };

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">View order details</h2>
        <p className="text-muted-foreground mb-6">
          Please login to view this order.
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

  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Order not found</h2>
        <Link to="/user/orders">
          <Button data-testid="button-back-orders">Back to Orders</Button>
        </Link>
      </div>
    );
  }

  const status = orderStatusConfig[order.status as keyof typeof orderStatusConfig] || orderStatusConfig.pending;

  const returnsForThisOrder = (userReturns || []).filter(
    (r: ReturnRequestWithDetails) => r.orderId === id && r.resolution !== "exchange"
  );

  const exchangesForThisOrder = (userExchanges || []).filter(
    (r: ReturnRequestWithDetails) => r.orderId === id && r.resolution === "exchange"
  );

  const latestReturnForThisOrder = returnsForThisOrder.length > 0 ? returnsForThisOrder[0] : undefined;
  const latestExchangeForThisOrder = exchangesForThisOrder.length > 0 ? exchangesForThisOrder[0] : undefined;

  const hasAnyReturnOrExchange = returnsForThisOrder.length > 0 || exchangesForThisOrder.length > 0;

  const hasActiveExchange = exchangesForThisOrder.some(
    (r: ReturnRequestWithDetails) =>
      inProgressReturnStatuses.includes(r.status as any)
  );

  const activeOrderItemIds = new Set<string>();
  for (const rr of [...returnsForThisOrder, ...exchangesForThisOrder]) {
    if (!inProgressReturnStatuses.includes(rr.status as any)) continue;
    for (const item of rr.items || []) {
      activeOrderItemIds.add(String(item.orderItemId));
    }
  }

  const returnedQtyByOrderItemId = new Map<string, number>();
  for (const rr of [...returnsForThisOrder, ...exchangesForThisOrder]) {
    if (!activeAndCompletedStatuses.includes(rr.status as any)) continue;
    for (const ri of rr.items || []) {
      const key = String(ri.orderItemId);
      returnedQtyByOrderItemId.set(
        key,
        (returnedQtyByOrderItemId.get(key) || 0) + Number(ri.quantity || 0)
      );
    }
  }

  const remainingQtyByOrderItemId = new Map<string, number>();
  for (const item of order.items || []) {
    const purchasedQty = Number(item.quantity || 0);
    const returnedQty = Number(returnedQtyByOrderItemId.get(String(item.id)) || 0);
    remainingQtyByOrderItemId.set(String(item.id), Math.max(0, purchasedQty - returnedQty));
  }


  const returnedOrderItemIds = new Set<string>();
  for (const rr of [...returnsForThisOrder, ...exchangesForThisOrder]) {
    for (const ri of rr.items || []) {
      returnedOrderItemIds.add(ri.orderItemId);
    }
  }

  const orderTimeline = (orderHistory || [])
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((entry) => {
      const key = ((entry.newStatus || entry.status) as string) || "pending";
      const cfg = orderStatusConfig[key as keyof typeof orderStatusConfig] || orderStatusConfig.pending;
      return {
        id: entry.id,
        icon: cfg.icon,
        label: cfg.label,
        date: entry.createdAt,
        note: entry.note,
      };
    });

  const getReturnStatusDate = (status: string, request?: any) => {
    if (!request) return undefined;
    if (status === "pickup_scheduled") return request.pickupScheduledAt;
    if (status === "picked_up") return request.pickedUpAt;
    if (status === "received") return request.receivedAt;
    if (status === "requested") return request.createdAt;
    return request.updatedAt;
  };

  const returnTimeline = latestReturnForThisOrder
    ? allReturnStatuses
      .filter((s) => returnStatusConfig[s])
      .map((s) => {
        const cfg = returnStatusConfig[s];
        return {
          key: s,
          icon: cfg.icon,
          label: cfg.label,
          date: getReturnStatusDate(s, latestReturnForThisOrder),
        };
      })
    : [];

  const exchangeTimeline = latestExchangeForThisOrder
    ? allReturnStatuses
      .filter((s) => returnStatusConfig[s])
      .map((s) => {
        const cfg = returnStatusConfig[s];
        return {
          key: s,
          icon: cfg.icon,
          label: cfg.label,
          date: getReturnStatusDate(s, latestExchangeForThisOrder),
        };
      })
    : [];

  const refundByReturnRequestId = new Map<string, Refund>();
  for (const rf of userRefunds || []) {
    if (rf.returnRequestId) refundByReturnRequestId.set(rf.returnRequestId, rf);
  }

  const refundForThisOrder = latestReturnForThisOrder
    ? refundByReturnRequestId.get(latestReturnForThisOrder.id) || (userRefunds || []).find((rf) => rf.orderId === order.id)
    : (userRefunds || []).find((rf) => rf.orderId === order.id);

  const itemStatusByOrderItemId = new Map<string, { label: string; color: string; updatedAt: string | Date }>();
  for (const rr of [...returnsForThisOrder, ...exchangesForThisOrder]) {
    for (const ri of rr.items || []) {
      const existing = itemStatusByOrderItemId.get(ri.orderItemId);
      const rrUpdated = rr.updatedAt || rr.createdAt;
      if (!existing || new Date(rrUpdated).getTime() > new Date(existing.updatedAt).getTime()) {
        const isExchange = rr.resolution === "exchange";
        const base = isExchange ? "Exchange" : "Return";
        const label =
          rr.status === "completed"
            ? `${base} Completed`
            : rr.status === "rejected"
              ? `${base} Rejected`
              : rr.status === "pickup_scheduled"
                ? `${base} Pickup Scheduled`
                : rr.status === "picked_up"
                  ? `${base} Picked Up`
                  : rr.status === "received"
                    ? `${base} Received`
                    : rr.status === "approved"
                      ? `${base} Approved`
                      : rr.status === "cancelled"
                        ? `${base} Cancelled`
                        : `${base} Requested`;

        const color =
          rr.status === "completed"
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
            : rr.status === "rejected"
              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
              : isExchange
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100";

        itemStatusByOrderItemId.set(ri.orderItemId, { label, color, updatedAt: rrUpdated });

        const refund = !isExchange ? refundByReturnRequestId.get(rr.id) : undefined;
        if (refund) {
          const refundUpdated = refund.completedAt || refund.initiatedAt || refund.createdAt;
          if (refundUpdated && new Date(refundUpdated).getTime() >= new Date(rrUpdated).getTime()) {
            const refundLabel =
              refund.status === "completed"
                ? "Refunded"
                : refund.status === "failed"
                  ? "Refund Failed"
                  : "Refund Processing";
            const refundColor =
              refund.status === "completed"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                : refund.status === "failed"
                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                  : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
            itemStatusByOrderItemId.set(ri.orderItemId, { label: refundLabel, color: refundColor, updatedAt: refundUpdated });
          }
        }
      }
    }
  }

  const refundBadge = refundForThisOrder
    ? refundStatusConfig[refundForThisOrder.status] || refundStatusConfig.pending
    : null;
  const RefundBadgeIcon = refundBadge ? refundBadge.icon : Clock;

  const refundActiveIndex = refundForThisOrder
    ? Math.max(0, refundSteps.indexOf(refundForThisOrder.status as any))
    : 0;

  const handleDownloadInvoice = async () => {
    try {
      const response = await fetch(`/api/user/orders/${order.id}/invoice`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download invoice");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${order.id.slice(0, 8).toUpperCase()}.pdf`;
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <Link
        to="/user/orders"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Orders
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className="font-serif text-2xl font-semibold"
            data-testid="text-order-id"
          >
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Placed on {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setShowStatusDialog(true)}
          >
            View status
          </Button>
        </div>
      </div>

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Status details</DialogTitle>
            <DialogDescription>
              Track your order and return progress with timestamps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3">Order timeline</h4>
              {orderTimeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No timeline updates yet.</p>
              ) : (
                <div className="space-y-4">
                  {orderTimeline.map((t, idx) => {
                    const Icon = t.icon;
                    return (
                      <div key={t.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded-full border flex items-center justify-center">
                            <Icon className="h-4 w-4" />
                          </div>
                          {idx < orderTimeline.length - 1 ? (
                            <div className="w-px flex-1 bg-muted mt-2" />
                          ) : null}
                        </div>
                        <div className="flex-1 pb-1">
                          <p className="font-medium">{t.label}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(t.date)}</p>
                          {t.note ? <p className="text-sm mt-1">{t.note}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {latestReturnForThisOrder ? (
              <div>
                <h4 className="font-semibold mb-3">Return / Refund timeline</h4>
                <div className="space-y-4">
                  {returnTimeline.map((t, idx) => {
                    const Icon = t.icon;
                    const isCurrent = t.key === latestReturnForThisOrder.status;
                    return (
                      <div key={t.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={
                              "h-8 w-8 rounded-full border flex items-center justify-center " +
                              (isCurrent ? "border-primary text-primary" : "")
                            }
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          {idx < returnTimeline.length - 1 ? (
                            <div className="w-px flex-1 bg-muted mt-2" />
                          ) : null}
                        </div>
                        <div className="flex-1 pb-1">
                          <p className={"font-medium " + (isCurrent ? "text-primary" : "")}>{t.label}</p>
                          {t.date ? (
                            <p className="text-sm text-muted-foreground">{formatDate(t.date)}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Date not available</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {latestExchangeForThisOrder ? (
              <div>
                <h4 className="font-semibold mb-3">Exchange timeline</h4>
                <div className="space-y-4">
                  {exchangeTimeline.map((t, idx) => {
                    const Icon = t.icon;
                    const isCurrent = t.key === latestExchangeForThisOrder.status;
                    return (
                      <div key={t.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={
                              "h-8 w-8 rounded-full border flex items-center justify-center " +
                              (isCurrent ? "border-primary text-primary" : "")
                            }
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          {idx < exchangeTimeline.length - 1 ? (
                            <div className="w-px flex-1 bg-muted mt-2" />
                          ) : null}
                        </div>
                        <div className="flex-1 pb-1">
                          <p className={"font-medium " + (isCurrent ? "text-primary" : "")}>{t.label}</p>
                          {t.date ? (
                            <p className="text-sm text-muted-foreground">{formatDate(t.date)}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Date not available</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {refundForThisOrder && latestReturnForThisOrder?.resolution !== "exchange" ? (
              <div>
                <h4 className="font-semibold mb-3">Refund status</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Amount:</span> {formatPrice(refundForThisOrder.amount)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span> {refundForThisOrder.status}
                  </p>
                  {refundForThisOrder.razorpayRefundId ? (
                    <p>
                      <span className="text-muted-foreground">Razorpay refund:</span> {maskId(refundForThisOrder.razorpayRefundId)}
                    </p>
                  ) : null}
                  <p>
                    <span className="text-muted-foreground">Created:</span> {formatDate(refundForThisOrder.createdAt)}
                  </p>
                  {refundForThisOrder.initiatedAt ? (
                    <p>
                      <span className="text-muted-foreground">Initiated:</span> {formatDate(refundForThisOrder.initiatedAt)}
                    </p>
                  ) : null}
                  {refundForThisOrder.completedAt ? (
                    <p>
                      <span className="text-muted-foreground">Completed:</span> {formatDate(refundForThisOrder.completedAt)}
                    </p>
                  ) : null}
                  {refundForThisOrder.failureReason ? (
                    <p className="text-red-600">
                      <span className="text-muted-foreground">Failure:</span> {refundForThisOrder.failureReason}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    {refundSteps.map((step, idx) => {
                      const isDone = refundForThisOrder.status === "failed"
                        ? idx < refundSteps.indexOf("failed")
                        : idx < refundActiveIndex;
                      const isActive = idx === refundActiveIndex;
                      const isFailed = refundForThisOrder.status === "failed" && step === "failed";
                      return (
                        <div key={step} className="flex items-center flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={
                                "h-6 w-6 rounded-full flex items-center justify-center border " +
                                (isFailed
                                  ? "bg-red-600 border-red-600 text-white"
                                  : isDone
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : isActive
                                      ? "border-primary text-primary"
                                      : "border-muted-foreground/30 text-muted-foreground")
                              }
                            >
                              {isDone || isFailed ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <span className="text-xs">{idx + 1}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p
                                className={
                                  "text-xs sm:text-sm truncate capitalize " +
                                  (isFailed
                                    ? "text-red-600 font-medium"
                                    : isDone
                                      ? "text-foreground"
                                      : isActive
                                        ? "text-primary font-medium"
                                        : "text-muted-foreground")
                                }
                              >
                                {step.replace(/_/g, " ")}
                              </p>
                            </div>
                          </div>
                          {idx < refundSteps.length - 1 ? (
                            <div className={"h-[2px] flex-1 mx-3 " + (idx < refundActiveIndex ? "bg-primary" : "bg-muted")} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(() => {
        const orderSummaryCard = (
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
                <span className="text-primary">
                  {formatPrice(order.finalAmount || order.totalAmount)}
                </span>
              </div>
            </div>
          </Card>
        );

        const shippingDeliveryCard = (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Shipping & Delivery</h3>
            <div className="text-sm space-y-2">
              <p>
                <span className="text-muted-foreground">Deliver to:</span> {order.shippingAddress}
              </p>
              <p>
                <span className="text-muted-foreground">Phone:</span> {order.phone}
              </p>
              <p>
                <span className="text-muted-foreground">Tracking:</span> {order.trackingNumber || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Estimated delivery:</span>{" "}
                {order.estimatedDelivery ? formatDate(order.estimatedDelivery) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Delivered on:</span>{" "}
                {order.deliveredAt ? formatDate(order.deliveredAt) : "—"}
              </p>
            </div>
          </Card>
        );

        const paymentDetailsCard = (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Payment Details</h3>
            <div className="text-sm space-y-2">
              {razorpayPaymentDetails?.available && razorpayPaymentDetails.display ? (
                <p>
                  <span className="text-muted-foreground">Paid via:</span>{" "}
                  {razorpayPaymentDetails.display}
                  {razorpayPaymentDetails.subtype ? (
                    <span className="text-muted-foreground"> ({razorpayPaymentDetails.subtype})</span>
                  ) : null}
                </p>
              ) : null}
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
                <span className="text-muted-foreground">Razorpay payment:</span>{" "}
                {razorpayPaymentDetails?.razorpayPaymentId || maskId(order.razorpayPaymentId)}
              </p>
              <p>
                <span className="text-muted-foreground">Payment reference:</span>{" "}
                {maskId(order.paymentId)}
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadInvoice}>
                  Download invoice
                </Button>
              </div>
            </div>
          </Card>
        );

        const refundStatusCard =
          refundForThisOrder && latestReturnForThisOrder?.resolution !== "exchange" ? (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Refund Status</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Refund updates are synced from Razorpay.
                  </p>
                </div>
                {refundBadge ? (
                  <Badge className={refundBadge.color}>
                    <RefundBadgeIcon className="h-3 w-3 mr-1" />
                    {refundBadge.label}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Amount:</span> {formatPrice(refundForThisOrder.amount)}
                </p>
                {refundForThisOrder.razorpayRefundId ? (
                  <p>
                    <span className="text-muted-foreground">Razorpay refund:</span> {maskId(refundForThisOrder.razorpayRefundId)}
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Created:</span> {formatDate(refundForThisOrder.createdAt)}
                </p>
                {refundForThisOrder.initiatedAt ? (
                  <p>
                    <span className="text-muted-foreground">Initiated:</span> {formatDate(refundForThisOrder.initiatedAt)}
                  </p>
                ) : null}
                {refundForThisOrder.completedAt ? (
                  <p>
                    <span className="text-muted-foreground">Completed:</span> {formatDate(refundForThisOrder.completedAt)}
                  </p>
                ) : null}
                {refundForThisOrder.failureReason ? (
                  <p className="text-red-600">
                    <span className="text-muted-foreground">Failure:</span> {refundForThisOrder.failureReason}
                  </p>
                ) : null}
              </div>

              <div className="mt-4">
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => syncRefundStatusMutation.mutate({ id: refundForThisOrder.id })}
                    disabled={syncRefundStatusMutation.isPending}
                  >
                    Refresh refund status
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setShowStatusDialog(true)}>
                    View full status timeline
                  </Button>
                </div>
              </div>
            </Card>
          ) : null;

        const customerSupportCard = (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Customer Support</h3>
            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">
                For any help, share this Order ID with support.
              </p>
              <p>
                <span className="text-muted-foreground">Order ID:</span> {order.id}
              </p>
              <a className="text-primary underline" href="/contact">
                Contact Us
              </a>
              <a className="text-primary underline" href="/contact">
                FAQ
              </a>
            </div>
          </Card>
        );

        const securityTransparencyCard = (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Security & Transparency</h3>
            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">
                We display masked payment references to protect your privacy.
              </p>
              <a className="text-primary underline" href="/shipping-policy">
                Shipping Policy
              </a>
              <a className="text-primary underline" href="/returns-exchange-policy">
                Returns & Exchange Policy
              </a>
            </div>
          </Card>
        );

        const needHelpCard =
          order.status === "delivered" ? (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              {eligibility?.eligible ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {eligibility?.remainingDays !== undefined
                      ? `You can return or exchange eligible items within ${eligibility.remainingDays} day${eligibility.remainingDays !== 1 ? "s" : ""}.`
                      : "You can return or exchange eligible items within the return window."}
                  </p>
                  {hasAnyReturnOrExchange ? (
                    <div className="space-y-2">
                      {returnsForThisOrder.length > 0 && (
                        <Link to="/user/returns" className="w-full">
                          <Button variant="outline" className="w-full">
                            View return requests
                          </Button>
                        </Link>
                      )}
                      {exchangesForThisOrder.length > 0 && (
                        <Link to="/user/exchanges" className="w-full">
                          <Button variant="outline" className="w-full">
                            View exchange requests
                          </Button>
                        </Link>
                      )}
                    </div>
                  ) : null}

                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {eligibility?.reason || "Return window has expired for this order."}
                </p>
              )}
            </Card>
          ) : (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                Returns and exchanges are available after your order is delivered.
              </p>
            </Card>
          );

        return (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-4 sm:space-y-6">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="font-semibold">Ordered items</h3>
                </div>

                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <Link to={`/sarees/${item.saree.id}`} className="flex-shrink-0">
                        <div className="w-20 h-24 rounded-md overflow-hidden bg-muted">
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
                          <h4 className="font-medium hover:text-primary line-clamp-1">
                            {item.saree.name}
                          </h4>
                        </Link>

                        <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                          <p>Qty: {item.quantity}</p>
                        </div>
                        <p className="font-semibold text-primary mt-2">
                          {formatPrice(item.price)}
                        </p>
                      </div>
                      {(() => {
                        const itemStatus = itemStatusByOrderItemId.get(item.id);
                        const fallback = { label: status.label, color: status.color, updatedAt: order.updatedAt };
                        const displayStatus = itemStatus || fallback;
                        return (
                          <div >
                            <Badge className={displayStatus.color}>{displayStatus.label}</Badge>
                          </div>
                        );
                      })()}

                      {eligibility?.eligible ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReturnExchangeModal("refund", item.id)}
                            disabled={activeOrderItemIds.has(String(item.id))}
                            title={
                              (stockBySareeId.get(item.saree.id) ?? 0) <= 0
                                ? "You can return this item even if out of stock."
                                : undefined
                            }
                          >
                            Return
                          </Button>
                          {(() => {
                        const isLocked = activeOrderItemIds.has(String(item.id));
                        const stock = stockBySareeId.get(item.saree.id) ?? 0;
                        const disabled = hasActiveExchange || isLocked || stock <= 0;
                        if (id === "dbbfcea8-c88d-4f1b-832c-3ea128604e71") {
                          console.log("Exchange debug", {
                            itemId: item.id,
                            itemName: item.saree.name,
                            hasActiveExchange,
                            isLocked,
                            stock,
                            disabled,
                          });
                        }
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReturnExchangeModal("exchange", item.id)}
                            disabled={disabled}
                            title={
                              stock <= 0
                                ? "This product is out of stock. You can return it instead."
                                : undefined
                            }
                          >
                            Exchange
                          </Button>
                        );
                      })()}
                        </div>
                      ) : null}

                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-4">
              <div className="hidden lg:block lg:sticky lg:top-24 space-y-4">
                {orderSummaryCard}
                {shippingDeliveryCard}
                {paymentDetailsCard}
                {refundStatusCard}
                {needHelpCard}
                {customerSupportCard}
                {securityTransparencyCard}
              </div>

              <div className="lg:hidden">
                <Accordion type="multiple" defaultValue={["summary", "shipping", "payment"]}>
                  <AccordionItem value="summary">
                    <AccordionTrigger>Order Summary</AccordionTrigger>
                    <AccordionContent>{orderSummaryCard}</AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="shipping">
                    <AccordionTrigger>Shipping & Delivery</AccordionTrigger>
                    <AccordionContent>{shippingDeliveryCard}</AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="payment">
                    <AccordionTrigger>Payment Details</AccordionTrigger>
                    <AccordionContent>{paymentDetailsCard}</AccordionContent>
                  </AccordionItem>

                  {refundStatusCard ? (
                    <AccordionItem value="refund">
                      <AccordionTrigger>Refund Status</AccordionTrigger>
                      <AccordionContent>{refundStatusCard}</AccordionContent>
                    </AccordionItem>
                  ) : null}

                  {needHelpCard ? (
                    <AccordionItem value="returns">
                      <AccordionTrigger>Return / Exchange</AccordionTrigger>
                      <AccordionContent>{needHelpCard}</AccordionContent>
                    </AccordionItem>
                  ) : null}

                  <AccordionItem value="support">
                    <AccordionTrigger>Customer Support</AccordionTrigger>
                    <AccordionContent>{customerSupportCard}</AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="security">
                    <AccordionTrigger>Security & Policies</AccordionTrigger>
                    <AccordionContent>{securityTransparencyCard}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </div>
        );
      })()}

      <ReusableDialog
        open={showReturnDialog}
        onOpenChange={(open) => {
          setShowReturnDialog(open);
          if (!open) setModalItemId(null);
        }}
        title={resolutionType === "exchange" ? "Exchange Request" : "Return Request"}
        description={
          modalItemId
            ? resolutionType === "exchange"
              ? "Exchange this item for the same product."
              : "Return this item."
            : resolutionType === "exchange"
              ? "Select the items you want to exchange."
              : "Select the items you want to return."
        }
        footer={
          <>
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
          </>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <Label>Reason</Label>
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
              {(modalItemId
                ? order.items.filter((i) => i.id === modalItemId)
                : order.items
              ).map((item) => (
                (() => {
                  const locked = activeOrderItemIds.has(String(item.id));
                  const remainingQty = Number(
                    remainingQtyByOrderItemId.get(String(item.id)) ?? item.quantity
                  );
                  const disabled = locked || remainingQty <= 0;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 border rounded-md"
                    >
                      {modalItemId ? (
                        <div className="w-4" />
                      ) : (
                        <Checkbox
                          checked={selectedItems[item.id]?.selected || false}
                          disabled={disabled}
                          onCheckedChange={() =>
                            toggleItemSelection(item.id, item.quantity)
                          }
                          data-testid={`checkbox-item-${item.id}`}
                        />
                      )}
                      <div className="w-10 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={
                            item.saree.imageUrl ||
                            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50&h=60&fit=crop"
                          }
                          alt={item.saree.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">
                          {item.saree.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} {remainingQty < item.quantity ? `(Remaining: ${remainingQty})` : null}
                        </p>
                        {locked ? (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            This item already has a return/exchange in progress.
                          </p>
                        ) : remainingQty <= 0 ? (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            No remaining quantity eligible for return/exchange.
                          </p>
                        ) : null}
                        {resolutionType === "exchange" && selectedItems[item.id]?.selected ? (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Exchange will be processed for the same product.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ))}
            </div>
          </div>
        </div>
      </ReusableDialog>
    </div>
  );
}
