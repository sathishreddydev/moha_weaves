import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { AdaptiveModal } from "../../../components/common/AdaptiveModal";
import { RequestDialogProps } from "./types";

export const RequestDialog = ({
  dialogOpen,
  setDialogOpen,
  productData,
}: RequestDialogProps) => {
  const [formData, setFormData] = useState({
    quantity: 1,
    notes: "",
  });
  const productId = productData?.id;
  const createRequestMutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      quantity: number;
      notes: string;
    }) => {
      const response = await apiRequest("POST", "/api/store/requests", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
      toast({
        title: "Success",
        description: "Stock request submitted successfully",
      });
      setDialogOpen(false);
      setFormData({ quantity: 1, notes: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit request",
        variant: "destructive",
      });
    },
  });
  const handleSubmitRequest = (e: FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast({ title: "Error", description: "Please select a product" });
      return;
    }
    createRequestMutation.mutate({
      productId,
      quantity: formData.quantity,
      notes: formData.notes,
    });
  };

  return (
    <>
      <AdaptiveModal
        title={"Request Stock"}
        description="Request inventory from the central warehouse"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmitRequest}
              disabled={createRequestMutation.isPending}
              data-testid="button-submit-request"
            >
              {createRequestMutation.isPending
                ? "Submitting..."
                : "Submit Request"}
            </Button>
          </>
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          {productData && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <img
                  src={
                    productData.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                  }
                  alt=""
                  className="w-12 h-14 rounded object-cover"
                />
                <div>
                  <h3 className="font-medium text-sm text-gray-900">Product Details</h3>
                  <p className="text-sm font-medium mt-1">{productData.name}</p>
                  <p className="text-xs text-gray-500">SKU: {productData.sku || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  quantity: parseInt(e.target.value) || 1,
                })
              }
              data-testid="input-quantity"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any additional notes for the request..."
              data-testid="input-notes"
            />
          </div>
        </form>
      </AdaptiveModal>
    </>
  );
};
