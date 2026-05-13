import {
  Clock,
  CheckCircle,
  Package,
  Truck,
  XCircle,
  RotateCcw
} from "lucide-react";


export const itemStatusConfig: Record<
  string,
  { icon: typeof Clock; label: string; color: string }
> = {
  // -------- Order flow --------
  pending: {
    icon: Clock,
    label: "Pending",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  },
  confirmed: {
    icon: CheckCircle,
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  processing: {
    icon: Package,
    label: "Processing",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  },
  shipped: {
    icon: Truck,
    label: "Shipped",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
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
  returned: {
    icon: RotateCcw,
    label: "Returned",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
  },

  // -------- Return flow --------
  return_requested: {
    icon: RotateCcw,
    label: "Return Requested",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  },
  return_approved: {
    icon: CheckCircle,
    label: "Return Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  return_rejected: {
    icon: XCircle,
    label: "Return Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
  return_pickup_scheduled: {
    icon: Clock,
    label: "Return Pickup Scheduled",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  },
  return_picked_up: {
    icon: Truck,
    label: "Return Picked Up",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  return_in_transit: {
    icon: Truck,
    label: "Return In Transit",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  return_received: {
    icon: Package,
    label: "Return Received",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  },
  return_inspected: {
    icon: CheckCircle,
    label: "Return Inspected",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  return_completed: {
    icon: CheckCircle,
    label: "Return Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  return_cancelled: {
    icon: XCircle,
    label: "Return Cancelled",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },

  // -------- Exchange flow --------
  exchange_requested: {
    icon: RotateCcw,
    label: "Exchange Requested",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  },
  exchange_approved: {
    icon: CheckCircle,
    label: "Exchange Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  exchange_processing: {
    icon: Package,
    label: "Exchange Processing",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  },
  exchange_pickup_scheduled: {
    icon: Clock,
    label: "Exchange Pickup Scheduled",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  },
  exchange_picked_up: {
    icon: Truck,
    label: "Exchange Picked Up",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  exchange_in_transit: {
    icon: Truck,
    label: "Exchange In Transit",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  exchange_received: {
    icon: Package,
    label: "Exchange Received",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  },
  exchange_inspected: {
    icon: CheckCircle,
    label: "Exchange Inspected",
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
  exchange_completed: {
    icon: CheckCircle,
    label: "Exchange Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  exchange_cancelled: {
    icon: XCircle,
    label: "Exchange Cancelled",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },

  // -------- Refund flow --------
  refund_requested: {
    icon: RotateCcw,
    label: "Refund Requested",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  },
  refund_approved: {
    icon: CheckCircle,
    label: "Refund Approved",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  refund_completed: {
    icon: CheckCircle,
    label: "Refund Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  refund_rejected: {
    icon: XCircle,
    label: "Refund Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
};


// Helper function to get status configuration
export const getItemStatusConfig = (status: string) => {
  return itemStatusConfig[status] || itemStatusConfig.pending;
};

// Helper function to check if item is in a delivered state
export const isItemDelivered = (status: string) => {
  return status === "delivered"
};

// Helper function to check if item is in progress
export const isItemInProgress = (status: string) => {
  return ["pending", "confirmed", "processing"].includes(status) ||
    ["exchange_processing", "exchange_shipped"].includes(status);
};

// Helper function to check if item is shipped
export const isItemShipped = (status: string) => {
  return ["shipped", "exchange_shipped"].includes(status);
};

// Helper function to check if item is cancelled
export const isItemCancelled = (status: string) => {
  return status === "cancelled";
};

export const returnReasons = [
  { value: "defective", label: "Product is defective" },
  { value: "wrong_item", label: "Received wrong item" },
  { value: "not_as_described", label: "Not as described" },
  { value: "quality_issue", label: "Quality issue" },
  { value: "size_issue", label: "Size doesn't fit" },
  { value: "changed_mind", label: "Changed my mind" },
  { value: "other", label: "Other reason" },
];

export const returnStatusConfig: Record<string, { icon: typeof Clock; label: string; color: string }> = {
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
  rejected: {
    icon: XCircle,
    label: "Rejected",
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
    color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100",
  },
  in_transit: {
    icon: Truck,
    label: "Items in Transit",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
  received: {
    icon: Package,
    label: "Received at Warehouse",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
  },
  inspected: {
    icon: Package,
    label: "Under Inspection",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  },
};