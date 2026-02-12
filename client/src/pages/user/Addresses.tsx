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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, MapPin, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAddressStore } from "@/components/Store/useAddressesStore";
import { useAuth } from "@/lib/auth";
import type { UserAddress } from "@shared/schema";
import { AddressDialog } from "./common/AddressDialog";

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
  }, [user, addresses.length, getAddresses]);

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

  const handleSubmit = async (e: FormEvent) => {
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
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">My Addresses</h1>
          <Button
            variant="ghost"
            onClick={() => handleOpenDialog()}
            className="text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Address
          </Button>
        </div>

        <p className="text-muted-foreground text-sm sm:text-base">
          Manage your delivery addresses
        </p>
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
                  {/* {!address.isDefault && (
                    <Button
                      className="pr-6"
                      size="icon"
                      variant="ghost"
                      disabled={false}
                      onClick={() => setDefaultAddress(address.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Set Default
                    </Button>
                  )} */}

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
      <AddressDialog
        formData={formData}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        editingAddress={editingAddress}
        handleSubmit={handleSubmit}
        setFormData={setFormData}
        pincodeLoading={pincodeLoading}
        pincodeInfo={pincodeInfo}
        isAddNewAddress={isAddNewAddress}
        isUpdateAddresses={isUpdateAddresses}
        handleCloseDialog={handleCloseDialog}
        checkPincode={checkPincode}
      />

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
