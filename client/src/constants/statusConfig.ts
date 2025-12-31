import { Clock, CheckCircle, XCircle, Package, Truck, RotateCcw } from "lucide-react";

export const orderStatusConfig = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  confirmed: {
    icon: CheckCircle,
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  processing: {
    icon: Package,
    label: "Processing",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  shipped: {
    icon: Truck,
    label: "Shipped",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  delivered: {
    icon: CheckCircle,
    label: "Delivered",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
  // Exchange statuses (for orders that are in exchange flow)
  exchange_requested: {
    icon: RotateCcw,
    label: "Exchange Requested",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  },
  exchange_processing: {
    icon: Package,
    label: "Exchange Processing",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  exchange_packing: {
    icon: Package,
    label: "Exchange Packing",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  exchange_shipping: {
    icon: Truck,
    label: "Exchange Shipping",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  exchange_delivered: {
    icon: CheckCircle,
    label: "Exchange Delivered",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
} as const;

export const returnStatusConfig = {
  requested: {
    icon: RotateCcw,
    label: "Return Requested",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  approved: {
    icon: CheckCircle,
    label: "Return Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  rejected: {
    icon: XCircle,
    label: "Return Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
  pickup_scheduled: {
    icon: Clock,
    label: "Pickup Scheduled",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  picked_up: {
    icon: Package,
    label: "Picked Up",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  in_transit: {
    icon: Truck,
    label: "In Transit",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  received: {
    icon: Package,
    label: "Received",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
  },
  inspected: {
    icon: Package,
    label: "Under Inspection",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  completed: {
    icon: CheckCircle,
    label: "Return Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Return Cancelled",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  },
} as const;

export const refundStatusConfig = {
  pending: {
    icon: Clock,
    label: "Refund Pending",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  initiated: {
    icon: Clock,
    label: "Refund Initiated",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  processing: {
    icon: Clock,
    label: "Refund Processing",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  completed: {
    icon: CheckCircle,
    label: "Refund Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  failed: {
    icon: XCircle,
    label: "Refund Failed",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Refund Cancelled",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  },
} as const;

// Status arrays for business logic
export const inProgressReturnStatuses = [
  "requested",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "received",
  "inspected",
] as const;

export const activeAndCompletedStatuses = [
  "requested",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "received",
  "inspected",
  "completed",
] as const;

export const allReturnStatuses = [
  "requested",
  "approved",
  "rejected",
  "pickup_scheduled",
  "picked_up",
  "received",
  "inspected",
  "completed",
  "cancelled",
] as const;

export const refundSteps = ["pending", "initiated", "processing", "completed", "failed", "cancelled"] as const;

export const orderStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "exchange_requested",
  "exchange_processing",
  "exchange_packing",
  "exchange_shipping",
  "exchange_delivered",
] as const;
