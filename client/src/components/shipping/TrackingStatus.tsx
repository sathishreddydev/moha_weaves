import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  Circle,
  Clock,
  Package,
  Truck,
  Home,
  AlertCircle,
  ExternalLink,
  Copy,
} from "lucide-react";

interface TrackingStatusProps {
  waybill?: string;
  status?: string;
  estimatedDelivery?: string;
  shippingMethod?: string;
  showTimeline?: boolean;
  compact?: boolean;
}

export function TrackingStatus({
  waybill,
  status,
  estimatedDelivery,
  shippingMethod,
  showTimeline = true,
  compact = false,
}: TrackingStatusProps) {
  const { toast } = useToast();

  const statusConfig = {
    processing: {
      label: "Order Processing",
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      icon: Clock,
      description: "Your order is being prepared for shipment",
    },
    dispatched: {
      label: "Dispatched",
      color: "bg-blue-100 text-blue-800 border-blue-200",
      icon: Package,
      description: "Your order has been dispatched from our warehouse",
    },
    in_transit: {
      label: "In Transit",
      color: "bg-purple-100 text-purple-800 border-purple-200",
      icon: Truck,
      description: "Your order is on the way and will reach you soon",
    },
    out_for_delivery: {
      label: "Out for Delivery",
      color: "bg-orange-100 text-orange-800 border-orange-200",
      icon: Truck,
      description: "Your order is out for delivery today",
    },
    delivered: {
      label: "Delivered",
      color: "bg-green-100 text-green-800 border-green-200",
      icon: CheckCircle,
      description: "Your order has been successfully delivered",
    },
    rto_initiated: {
      label: "Return to Origin",
      color: "bg-red-100 text-red-800 border-red-200",
      icon: AlertCircle,
      description: "Your order is being returned to our warehouse",
    },
    ndr_pending: {
      label: "Delivery Attempted",
      color: "bg-orange-100 text-orange-800 border-orange-200",
      icon: AlertCircle,
      description: "Delivery was attempted. Please contact support",
    },
    cancelled: {
      label: "Cancelled",
      color: "bg-gray-100 text-gray-800 border-gray-200",
      icon: AlertCircle,
      description: "Your order has been cancelled",
    },
    default: {
      label: "Order Placed",
      color: "bg-gray-100 text-gray-800 border-gray-200",
      icon: Circle,
      description: "Your order has been placed successfully",
    },
  };

  const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.default;

  const handleCopyTracking = async () => {
    if (!waybill) return;
    try {
      await navigator.clipboard.writeText(waybill);
      toast({ title: "Copied", description: "Tracking number copied" });
    } catch {
      toast({
        title: "Error",
        description: "Unable to copy tracking number",
        variant: "destructive",
      });
    }
  };

  const handleTrackOnDelhivery = () => {
    if (!waybill) return;
    window.open(`https://delhivery.com/track/#/${waybill}`, "_blank");
  };

  const shippingSteps = [
    { key: "processing", label: "Order Processing" },
    { key: "dispatched", label: "Dispatched" },
    { key: "in_transit", label: "In Transit" },
    { key: "out_for_delivery", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
  ];

  const getCurrentStepIndex = () => {
    if (!status) return 0;
    const index = shippingSteps.findIndex((step) => step.key === status);
    return index >= 0 ? index : 0;
  };

  const currentStepIndex = getCurrentStepIndex();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <currentStatus.icon className="h-4 w-4" />
        <Badge className={currentStatus.color}>
          {currentStatus.label}
        </Badge>
        {waybill && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyTracking}
            className="h-6 px-2"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <currentStatus.icon className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Shipping Status</h3>
            <Badge className={currentStatus.color}>
              {currentStatus.label}
            </Badge>
          </div>
        </div>
        {shippingMethod && (
          <Badge variant="outline" className="text-xs">
            {shippingMethod.toUpperCase()}
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {currentStatus.description}
      </p>

      {waybill && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tracking Number</p>
              <p className="text-xs text-muted-foreground">{waybill}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyTracking}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTrackOnDelhivery}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Track
              </Button>
            </div>
          </div>

          {estimatedDelivery && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Estimated Delivery</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(estimatedDelivery), "MMM dd, yyyy")}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {formatDistanceToNow(new Date(estimatedDelivery), { addSuffix: true })}
              </Badge>
            </div>
          )}
        </div>
      )}

      {showTimeline && (
        <>
          <Separator className="my-4" />
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Shipping Timeline</h4>
            <div className="flex items-center justify-between relative">
              {/* Progress Line */}
              <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
              <div
                className="absolute left-0 top-1/2 h-0.5 bg-primary -translate-y-1/2 z-0"
                style={{
                  width: `${(currentStepIndex / (shippingSteps.length - 1)) * 100}%`,
                }}
              />

              {/* Steps */}
              {shippingSteps.map((step, index) => {
                const Icon = index <= currentStepIndex ? CheckCircle : Circle;
                const isActive = step.key === status;
                
                return (
                  <div
                    key={step.key}
                    className="flex flex-col items-center z-10 relative"
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        index <= currentStepIndex
                          ? "text-primary fill-primary"
                          : "text-gray-300"
                      }`}
                    />
                    <span
                      className={`text-xs mt-1 text-center max-w-20 ${
                        isActive ? "font-medium text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
