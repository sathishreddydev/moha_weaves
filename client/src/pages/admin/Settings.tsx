import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  updatedAt: Date | null;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [returnWindowDays, setReturnWindowDays] = useState("");

  const { data: settings, isLoading } = useQuery<AppSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({
      key,
      value,
      description,
    }: {
      key: string;
      value: string;
      description?: string;
    }) => {
      return apiRequest("PUT", `/api/admin/settings/${key}`, {
        value,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Setting updated",
        description: "The setting has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive",
      });
    },
  });

  const handleSaveReturnWindow = () => {
    const days = parseInt(returnWindowDays);
    if (isNaN(days) || days < 0 || days > 60) {
      toast({
        title: "Invalid value",
        description: "Return window must be between 0 and 60 days",
        variant: "destructive",
      });
      return;
    }

    updateSettingMutation.mutate({
      key: "return_window_days",
      value: returnWindowDays,
      description:
        "Number of days customers have to initiate a return after delivery",
    });
  };

  const currentReturnWindow =
    settings?.find((s) => s.key === "return_window_days")?.value || "7";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Return Policy Settings</CardTitle>
          <CardDescription>
            Configure the return and exchange policy for your store
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="return-window">Return Window (Days)</Label>
                <div className="flex gap-2">
                  <Input
                    id="return-window"
                    type="number"
                    min="0"
                    max="60"
                    placeholder={currentReturnWindow}
                    value={returnWindowDays}
                    onChange={(e) => setReturnWindowDays(e.target.value)}
                    className="max-w-[120px]"
                    data-testid="input-return-window"
                  />
                  <Button
                    onClick={handleSaveReturnWindow}
                    disabled={
                      updateSettingMutation.isPending || !returnWindowDays
                    }
                    data-testid="button-save-return-window"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateSettingMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Current setting:{" "}
                  <span className="font-medium">
                    {currentReturnWindow} days
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Customers can request returns or exchanges within this many
                  days after their order is delivered. Set to 0 to disable
                  returns.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Settings</CardTitle>
          <CardDescription>How settings affect your store</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Return Window:</strong> When
              an order is marked as delivered, the system automatically
              calculates the return eligibility deadline based on this setting.
              Customers will only be able to request returns or exchanges within
              this window.
            </p>
            <p>
              <strong className="text-foreground">Existing Orders:</strong> For
              orders that were delivered before this setting was configured, the
              system will use the original delivery date plus this window to
              determine eligibility.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
