import { Button } from "@/components/ui/button";
import { DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { refundSteps, returnStatusConfig, allReturnStatuses } from "@/constants/statusConfig";
import { itemStatusConfig } from "@/constants/itemStatusConfig";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import { CheckCircle } from "lucide-react";
import type { OrderWithItems, ItemStatusHistory, ReturnRequestWithDetails, Refund } from "@shared/schema";

interface StatusDialogProps {
    showStatusDialog: boolean;
    setShowStatusDialog: (show: boolean) => void;
    order: OrderWithItems;
    orderHistory: ItemStatusHistory[];
    latestReturnForThisOrder?: ReturnRequestWithDetails;
    latestExchangeForThisOrder?: ReturnRequestWithDetails;
    refundForThisOrder?: Refund;
    formatPrice: (price: string | number) => string;
    maskId: (value?: string | null) => string;
}

export const StatusDialog = ({
    showStatusDialog,
    setShowStatusDialog,
    orderHistory,
    latestReturnForThisOrder,
    latestExchangeForThisOrder,
    refundForThisOrder,
    formatPrice,
    maskId
}: StatusDialogProps) => {


    const formatDateLocal = (date: string | Date) => {
        return new Date(date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getReturnStatusDate = (status: string, request?: any) => {
        if (!request) return undefined;
        if (status === "pickup_scheduled") return request.pickupScheduledAt;
        if (status === "picked_up") return request.pickedUpAt;
        if (status === "received") return request.receivedAt;
        if (status === "requested") return request.createdAt;
        return request.updatedAt;
    };

    const orderTimeline = (orderHistory || [])
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((entry) => {
            const key = ((entry.newStatus || entry.status) as string) || "pending";
            const cfg = itemStatusConfig[key as keyof typeof itemStatusConfig] || itemStatusConfig.pending;
            return {
                id: entry.id,
                icon: cfg.icon,
                label: cfg.label,
                date: entry.createdAt,
                note: entry.note,
            };
        });

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

    const refundActiveIndex = refundForThisOrder
        ? Math.max(0, refundSteps.indexOf(refundForThisOrder.status as any))
        : 0;

    return <>

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
                                                <p className="text-sm text-muted-foreground">{formatDateLocal(t.date)}</p>
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
                                                    <p className="text-sm text-muted-foreground">{formatDateLocal(t.date)}</p>
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
                                                    <p className="text-sm text-muted-foreground">{formatDateLocal(t.date)}</p>
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
                                    <span className="text-muted-foreground">Created:</span> {formatDateLocal(refundForThisOrder.createdAt)}
                                </p>
                                {refundForThisOrder.initiatedAt ? (
                                    <p>
                                        <span className="text-muted-foreground">Initiated:</span> {formatDateLocal(refundForThisOrder.initiatedAt)}
                                    </p>
                                ) : null}
                                {refundForThisOrder.completedAt ? (
                                    <p>
                                        <span className="text-muted-foreground">Completed:</span> {formatDateLocal(refundForThisOrder.completedAt)}
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
        </Dialog></>
}