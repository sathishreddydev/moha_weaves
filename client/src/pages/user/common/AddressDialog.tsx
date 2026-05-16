import { Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AddressDialogProps } from "./Type";
import { AdaptiveModal } from "../../../components/common/AdaptiveModal";
import { Home, Briefcase, MapPin } from "lucide-react";
import { useEffect } from "react";

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
  // Auto-fill city and state when pincode check returns a result
  useEffect(() => {
    if (pincodeInfo?.available && pincodeInfo.city && pincodeInfo.state) {
      setFormData((prev) => ({
        ...prev,
        city: pincodeInfo.city!,
        state: pincodeInfo.state!,
      }));
    }
  }, [pincodeInfo]);

  const isPincodeInvalid =
    pincodeInfo !== null && !pincodeInfo.available;

  return (
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
            form="address-form"
            disabled={isAddNewAddress || isUpdateAddresses || isPincodeInvalid || pincodeLoading}
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
      <form id="address-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Name + Phone side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="addr-name">Full Name</Label>
            <Input
              id="addr-name"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="addr-phone">Phone Number</Label>
            <Input
              id="addr-phone"
              placeholder="10-digit mobile"
              type="tel"
              maxLength={10}
              value={formData.phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setFormData({ ...formData, phone: value });
              }}
              required
            />
            <p className="text-xs text-muted-foreground">Starts with 6–9</p>
          </div>
        </div>

        {/* Address Line 1 */}
        <div className="space-y-1">
          <Label htmlFor="addr-line1">Address Line 1</Label>
          <Input
            id="addr-line1"
            placeholder="House no., Building, Street"
            value={formData.addressLine1}
            onChange={(e) =>
              setFormData({ ...formData, addressLine1: e.target.value })
            }
            required
          />
        </div>

        {/* Locality */}
        <div className="space-y-1">
          <Label htmlFor="addr-locality">Locality / Area</Label>
          <Input
            id="addr-locality"
            placeholder="Locality / Area / Colony"
            value={formData.locality}
            onChange={(e) =>
              setFormData({ ...formData, locality: e.target.value })
            }
            required
          />
        </div>

        {/* Pincode — triggers auto-fill */}
        <div className="space-y-1">
          <Label htmlFor="addr-pincode">Pincode</Label>
          <Input
            id="addr-pincode"
            placeholder="6-digit pincode"
            maxLength={6}
            value={formData.pincode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              setFormData({ ...formData, pincode: value });
              if (value.length === 6) checkPincode(value);
            }}
            className={isPincodeInvalid ? "border-destructive" : ""}
            required
          />

          {pincodeLoading && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
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
                ? `Delivery available — ${pincodeInfo.city}, ${pincodeInfo.state} (${pincodeInfo.deliveryDays} days)`
                : (pincodeInfo.message ?? "Delivery not available in this area")}
            </p>
          )}
        </div>

        {/* City + State — auto-filled from pincode, disabled */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="addr-city">City</Label>
            <Input
              id="addr-city"
              placeholder="Auto-filled"
              value={formData.city}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="addr-state">State</Label>
            <Input
              id="addr-state"
              placeholder="Auto-filled"
              value={formData.state}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>

        {/* Default checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="addr-default"
            checked={formData.isDefault}
            onCheckedChange={(v) =>
              setFormData({ ...formData, isDefault: v === true })
            }
          />
          <Label htmlFor="addr-default">Set as default address</Label>
        </div>

        {/* Address Type */}
        <div className="space-y-2">
          <Label>Address Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "home" as const, label: "Home", icon: Home },
              { value: "work" as const, label: "Work", icon: Briefcase },
              { value: "other" as const, label: "Other", icon: MapPin },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() =>
                  setFormData({ ...formData, addressType: type.value })
                }
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  formData.addressType === type.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <type.icon className="h-5 w-5" />
                <span className="text-xs">{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </AdaptiveModal>
  );
};
