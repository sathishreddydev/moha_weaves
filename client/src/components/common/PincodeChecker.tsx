import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Check, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PincodeCheckerProps {
  onPincodeValid?: (pincode: string, data: any) => void;
  onPincodeInvalid?: (pincode: string) => void;
  className?: string;
  placeholder?: string;
  showLabel?: boolean;
  size?: "sm" | "default" | "lg";
}

export function PincodeChecker({
  onPincodeValid,
  onPincodeInvalid,
  className,
  placeholder = "Enter pincode",
  showLabel = true,
  size = "default"
}: PincodeCheckerProps) {
  const { toast } = useToast();
  const [pincode, setPincode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    available: boolean;
    city?: string;
    state?: string;
    deliveryDays?: number;
    message?: string;
  } | null>(null);

  const handlePincodeCheck = async () => {
    if (!pincode || pincode.length !== 6) {
      toast({
        title: "Invalid Pincode",
        description: "Please enter a valid 6-digit pincode",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("GET", `/api/shipping/pincode/${pincode}`);
      
      if (response.success && response.data && response.data.isServiceable) {
        const data = {
          available: true,
          city: response.data.city,
          state: response.data.state,
          deliveryDays: 5, // Default delivery days since API doesn't provide this
        };
        setCheckResult(data);
        toast({
          title: "Delivery Available!",
          description: `We deliver to ${data.city}, ${data.state}. Estimated delivery: ${data.deliveryDays} days`,
        });
        onPincodeValid?.(pincode, data);
      } else {
        const data = {
          available: false,
          message: response.message || "We do not deliver to this pincode"
        };
        setCheckResult(data);
        toast({
          title: "Delivery Not Available",
          description: data.message,
          variant: "destructive",
        });
        onPincodeInvalid?.(pincode);
      }
    } catch (error) {
      toast({
        title: "Check Failed",
        description: "Unable to verify delivery availability. Please try again.",
        variant: "destructive",
      });
      setCheckResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPincode(value);
    setCheckResult(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pincode.length === 6) {
      handlePincodeCheck();
    }
  };

  const sizeClasses = {
    sm: "text-sm h-9",
    default: "text-base h-10", 
    lg: "text-lg h-11"
  };

  return (
    <div className={className}>
      {showLabel && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Check Delivery Availability
        </label>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={pincode}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            maxLength={6}
            className={`pl-10 ${sizeClasses[size]} ${
              checkResult?.available 
                ? "border-green-500 bg-green-50" 
                : checkResult?.available === false 
                ? "border-red-500 bg-red-50" 
                : ""
            }`}
            disabled={isLoading}
          />
          {checkResult && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {checkResult.available ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-600" />
              )}
            </div>
          )}
        </div>
        <Button
          onClick={handlePincodeCheck}
          disabled={pincode.length !== 6 || isLoading}
          size={size === "sm" ? "sm" : "default"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Check"
          )}
        </Button>
      </div>
      
      {checkResult && (
        <div className={`text-xs p-2 rounded-md mt-2 ${
          checkResult.available 
            ? "bg-green-50 text-green-700 border border-green-200" 
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {checkResult.available ? (
            <div>
              <p className="font-medium">
                ✓ Delivery available in {checkResult.city}, {checkResult.state}
              </p>
              <p>Estimated delivery: {checkResult.deliveryDays} days</p>
            </div>
          ) : (
            <p className="font-medium">
              ✗ {checkResult.city ? `${checkResult.city}, ${checkResult.state} - ` : ""}Delivery not available
            </p>
          )}
        </div>
      )}
    </div>
  );
}
