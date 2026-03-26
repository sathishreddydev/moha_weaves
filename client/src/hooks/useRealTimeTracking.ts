import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface TrackingUpdate {
  delhiveryStatus?: string;
  delhiveryWaybill?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  updatedAt: string;
}

export function useRealTimeTracking(orderId: string, enabled = true) {
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  // Poll for tracking updates every 30 seconds
  const { data: order, refetch } = useQuery({
    queryKey: ["/api/user/orders", orderId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/user/orders/${orderId}`);
      return response.json();
    },
    enabled: enabled && !!orderId,
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: true,
  });

  // Check for updates
  useEffect(() => {
    if (order && order.updatedAt !== lastUpdate) {
      setLastUpdate(order.updatedAt);
      
      // Show notification for status changes
      if (order.delhiveryStatus) {
        const statusMessages = {
          dispatched: "Your order has been dispatched! 📦",
          in_transit: "Your order is in transit! 🚚",
          out_for_delivery: "Your order is out for delivery today! 🏠",
          delivered: "Your order has been delivered! 🎉",
          rto_initiated: "Your order is being returned to our warehouse 📦",
          ndr_pending: "Delivery attempt failed. Please contact support 📞",
        };

        const message = statusMessages[order.delhiveryStatus as keyof typeof statusMessages];
        if (message) {
          // Show browser notification if permission granted
          if (Notification.permission === "granted") {
            new Notification("Order Update", {
              body: message,
              icon: "/favicon.ico",
              tag: orderId,
            });
          }

          // Show toast notification
          if (window.orderToast) {
            window.orderToast({
              title: "Order Update",
              description: message,
              duration: 5000,
            });
          }
        }
      }
    }
  }, [order, lastUpdate, orderId]);

  // Request notification permission
  useEffect(() => {
    if (enabled && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [enabled]);

  // Manual refresh function
  const refreshTracking = async () => {
    await refetch();
  };

  return {
    order,
    refreshTracking,
    isTracking: enabled,
    lastUpdate,
  };
}

// Extend Window interface for global toast
declare global {
  interface Window {
    orderToast?: (options: { title: string; description: string; duration?: number }) => void;
  }
}
