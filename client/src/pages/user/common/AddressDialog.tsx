import { Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AddressDialogProps } from "./Type";
import { AdaptiveModal } from "../../../components/common/AdaptiveModal";

export const AddressDialog = ({
  formData,
  dialogOpen,
  setDialogOpen,
  editingAddress,
  handleSubmit,
  setFormData,
  pincodeLoading,
  pincodeInfo,
  isAddNewAddress,
  isUpdateAddresses,
  handleCloseDialog,
  checkPincode,
}: AddressDialogProps) => {
  return (
    <>
      <AdaptiveModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingAddress ? "Edit Address" : "Add Address"}
        description="Add your delivery address"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isAddNewAddress || isUpdateAddresses}
            >
              {isAddNewAddress || isUpdateAddresses
                ? "Saving..."
                : editingAddress
                ? "Update Address"
                : "Add Address"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            placeholder="Phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            required
          />

          <Input
            placeholder="Locality"
            value={formData.locality}
            onChange={(e) =>
              setFormData({ ...formData, locality: e.target.value })
            }
            required
          />

          <Input
            placeholder="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            required
          />

          <div>
            <Input
              placeholder="Pincode"
              maxLength={6}
              value={formData.pincode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setFormData({ ...formData, pincode: value });
                if (value.length === 6) checkPincode(value);
              }}
              required
            />

            {pincodeLoading && (
              <p className="text-xs text-muted-foreground mt-1">
                Checking availability...
              </p>
            )}

            {pincodeInfo && (
              <p
                className={`text-xs mt-1 flex items-center gap-1 ${
                  pincodeInfo.available ? "text-green-600" : "text-destructive"
                }`}
              >
                {pincodeInfo.available ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                {pincodeInfo.available
                  ? `Delivery in ${pincodeInfo.deliveryDays} days`
                  : pincodeInfo.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.isDefault}
              onCheckedChange={(v) =>
                setFormData({ ...formData, isDefault: v === true })
              }
            />
            <Label>Set as default</Label>
          </div>
        </form>
      </AdaptiveModal>
    </>
  );
};
