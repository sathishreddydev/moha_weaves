import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, MapPin, Check, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/lib/auth";
import type { UserAddress } from "@shared/schema";
import { useAddressStore } from "@/components/Store/useAddressesStore";

/* ---------------- TYPES ---------------- */

type AddressFormData = {
  name: string;
  phone: string;
  locality: string;
  city: string;
  pincode: string;
  isDefault: boolean;
};

const defaultFormData: AddressFormData = {
  name: "",
  phone: "",
  locality: "",
  city: "",
  pincode: "",
  isDefault: false,
};

export default function Addresses() {
  const { user } = useAuth();

  const addresses = useAddressStore((state) => state.addresses);
  const loadingAddresses = useAddressStore((state) => state.fetchLoading);
  const getAddresses = useAddressStore((state) => state.fetchAddresses);

  const isAddNewAddress = useAddressStore((state) => state.addLoading);
  const isUpdateAddresses = useAddressStore((state) => state.updateLoading);
  const isDeletAddresses = useAddressStore((state) => state.deleteLoading);

  const createNewAddresses = useAddressStore((state) => state.addAddress);
  const updateAddresses = useAddressStore((state) => state.updateAddress);
  const deletAddresses = useAddressStore((state) => state.deleteAddress);
  const setDefaultAddress = useAddressStore((state) => state.setDefaultAddress);

  const pincodeInfo = useAddressStore((state) => state.pincodeInfo);
  const pincodeLoading = useAddressStore((state) => state.pincodeLoading);
  const checkPincode = useAddressStore((state) => state.checkPincode);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(
    null
  );
  const [addressToDelete, setAddressToDelete] = useState<UserAddress | null>(
    null
  );
  const [formData, setFormData] = useState<AddressFormData>(defaultFormData);

  useEffect(() => {
    if (user?.role === "user" && addresses.length === 0) {
      getAddresses();
    }
  }, [user]);

  const handleOpenDialog = (address?: UserAddress) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        name: address.name,
        phone: address.phone,
        locality: address.locality,
        city: address.city,
        pincode: address.pincode,
        isDefault: address.isDefault,
      });
    } else {
      setEditingAddress(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAddress(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const payload = {
      ...formData,
      userId: user.id,
    };
    if (editingAddress) {
      await updateAddresses(editingAddress.id, payload);
    } else {
      await createNewAddresses(payload);
    }

    handleCloseDialog();
  };

  const handleDelete = async () => {
    if (!addressToDelete) return;

    await deletAddresses(addressToDelete.id);
    setDeleteDialogOpen(false);
    setAddressToDelete(null);
  };

  if (!user || user.role !== "user") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold mb-4">
          Please log in to manage addresses
        </h2>
        <Link to="/user/login">
          <Button>Login</Button>
        </Link>
      </div>
    );
  }


  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold">My Addresses</h1>
          <p className="text-muted-foreground">
            Manage your delivery addresses
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Address
        </Button>
      </div>

      {loadingAddresses ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : addresses.length > 0 ? (
        <div className="grid gap-4">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardContent className="p-4 flex justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{address.name}</span>
                    {address.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {address.phone}
                  </p>
                  <p className="text-sm">
                    {address.locality}, {address.city} - {address.pincode}
                  </p>
                </div>

                <div className="flex gap-2">
                  {!address.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={false}
                      onClick={() => setDefaultAddress(address.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Set Default
                    </Button>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleOpenDialog(address)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isDeletAddresses}
                    onClick={() => {
                      setAddressToDelete(address);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No addresses saved</h3>
            <p className="text-muted-foreground mb-4">
              Add an address for faster checkout
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Address
            </Button>
          </CardContent>
        </Card>
      )}

      {/* -------- ADD / EDIT DIALOG -------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "Edit Address" : "Add Address"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress
                ? "Update your delivery address"
                : "Add a new delivery address"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
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
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
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
                    pincodeInfo.available
                      ? "text-green-600"
                      : "text-destructive"
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -------- DELETE CONFIRM -------- */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeletAddresses ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
