import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  Circle,
  Clock,
  Package,
  Truck,
  Home,
  AlertCircle,
  MapPin,
} from "lucide-react";

interface ShippingEvent {
  status: string;
  label: string;
  timestamp?: string;
  location?: string;
  description?: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface ShippingTimelineProps {
  status?: string;
  estimatedDelivery?: string;
  events?: ShippingEvent[];
  compact?: boolean;
}

export function ShippingTimeline({
  status,
  estimatedDelivery,
  events,
  compact = false,
}: ShippingTimelineProps) {
  // Default events if not provided
  const defaultEvents: ShippingEvent[] = [
    {
      status: "processing",
      label: "Order Processing",
      description: "Your order is being prepared for shipment",
      isCompleted: ["dispatched", "in_transit", "out_for_delivery", "delivered"].includes(status || ""),
      isCurrent: status === "processing",
    },
    {
      status: "dispatched",
      label: "Dispatched",
      description: "Your order has been dispatched from our warehouse",
      isCompleted: ["in_transit", "out_for_delivery", "delivered"].includes(status || ""),
      isCurrent: status === "dispatched",
    },
    {
      status: "in_transit",
      label: "In Transit",
      description: "Your order is on the way and will reach you soon",
      isCompleted: ["out_for_delivery", "delivered"].includes(status || ""),
      isCurrent: status === "in_transit",
    },
    {
      status: "out_for_delivery",
      label: "Out for Delivery",
      description: "Your order is out for delivery today",
      isCompleted: status === "delivered",
      isCurrent: status === "out_for_delivery",
    },
    {
      status: "delivered",
      label: "Delivered",
      description: "Your order has been successfully delivered",
      isCompleted: status === "delivered",
      isCurrent: status === "delivered",
    },
  ];

  const timelineEvents = events || defaultEvents;

  const getEventIcon = (event: ShippingEvent) => {
    if (event.isCompleted) return CheckCircle;
    if (event.isCurrent) return Clock;
    return Circle;
  };

  const getEventColor = (event: ShippingEvent) => {
    if (event.isCompleted) return "text-green-500";
    if (event.isCurrent) return "text-blue-500";
    return "text-gray-300";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {timelineEvents.map((event, index) => {
          const Icon = getEventIcon(event);
          return (
            <div key={event.status} className="flex items-center gap-1">
              <Icon className={`h-3 w-3 ${getEventColor(event)}`} />
              {index < timelineEvents.length - 1 && (
                <div className="w-4 h-0.5 bg-gray-200" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Shipping Timeline</h3>
        {estimatedDelivery && (
          <Badge variant="secondary" className="text-xs">
            Est. {format(new Date(estimatedDelivery), "MMM dd")}
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {timelineEvents.map((event, index) => {
          const Icon = getEventIcon(event);
          const color = getEventColor(event);
          
          return (
            <div key={event.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Icon className={`h-5 w-5 ${color}`} />
                {index < timelineEvents.length - 1 && (
                  <div className={`w-0.5 h-8 mt-1 ${
                    event.isCompleted ? "bg-green-200" : "bg-gray-200"
                  }`} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p
                    className={`text-sm font-medium ${
                      event.isCurrent ? "text-primary" : ""
                    }`}
                  >
                    {event.label}
                  </p>
                  {event.isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground mb-1">
                  {event.description}
                </p>
                
                {event.location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{event.location}</span>
                  </div>
                )}
                
                {event.timestamp && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.timestamp), "MMM dd, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status === "rto_initiated" && (
        <>
          <Separator className="my-4" />
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Return to Origin Initiated
              </p>
              <p className="text-xs text-red-600">
                Your order is being returned to our warehouse. Our team will contact you soon.
              </p>
            </div>
          </div>
        </>
      )}

      {status === "ndr_pending" && (
        <>
          <Separator className="my-4" />
          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm font-medium text-orange-800">
                Delivery Attempted
              </p>
              <p className="text-xs text-orange-600">
                Delivery was attempted. Please contact customer support or ensure your address is correct.
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
