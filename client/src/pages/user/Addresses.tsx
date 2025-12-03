import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserAddress } from "@shared/schema";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<UserAddress | null>(null);
  const [formData, setFormData] = useState<AddressFormData>(defaultFormData);
  const [pincodeStatus, setPincodeStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);

  const { data: addresses, isLoading } = useQuery<UserAddress[]>({
    queryKey: ["/api/user/addresses"],
    enabled: !!user && user.role === "user",
  });

  const createMutation = useMutation({
    mutationFn: (data: AddressFormData) => apiRequest("POST", "/api/user/addresses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      toast({ title: "Success", description: "Address added successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add address", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddressFormData }) =>
      apiRequest("PATCH", `/api/user/addresses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      toast({ title: "Success", description: "Address updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update address", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/user/addresses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      toast({ title: "Success", description: "Address deleted successfully" });
      setDeleteDialogOpen(false);
      setAddressToDelete(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete address", variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/user/addresses/${id}/default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      toast({ title: "Success", description: "Default address updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set default address", variant: "destructive" });
    },
  });

  const checkPincodeAvailability = async (pincode: string) => {
    if (pincode.length !== 6) {
      setPincodeStatus(null);
      return;
    }
    setCheckingPincode(true);
    try {
      const response = await fetch(`/api/pincodes/${pincode}/check`);
      const data = await response.json();
      setPincodeStatus({
        available: data.available,
        message: data.available
          ? `Delivery available in ${data.deliveryDays} days`
          : "Delivery not available in this area",
      });
    } catch {
      setPincodeStatus({ available: false, message: "Unable to check pincode" });
    } finally {
      setCheckingPincode(false);
    }
  };

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
    setPincodeStatus(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAddress(null);
    setFormData(defaultFormData);
    setPincodeStatus(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (address: UserAddress) => {
    setAddressToDelete(address);
    setDeleteDialogOpen(true);
  };

  if (!user || user.role !== "user") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold mb-4">Please log in to manage addresses</h2>
        <Link to="/user/login">
          <Button>Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold" data-testid="text-page-title">
            My Addresses
          </h1>
          <p className="text-muted-foreground mt-1">Manage your delivery addresses</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-address">
          <Plus className="h-4 w-4 mr-2" />
          Add Address
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : addresses && addresses.length > 0 ? (
        <div className="grid gap-4">
          {addresses.map((address) => (
            <Card key={address.id} data-testid={`card-address-${address.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium" data-testid={`text-address-name-${address.id}`}>
                        {address.name}
                      </span>
                      {address.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{address.phone}</p>
                    <p className="text-sm">
                      {address.locality}, {address.city} - {address.pincode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!address.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(address.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-${address.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(address)}
                      data-testid={`button-edit-address-${address.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(address)}
                      data-testid={`button-delete-address-${address.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
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
            <p className="text-muted-foreground mb-4">Add an address for faster checkout</p>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-address">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Address
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Address Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAddress ? "Edit Address" : "Add New Address"}</DialogTitle>
            <DialogDescription>
              {editingAddress ? "Update your delivery address" : "Add a new delivery address"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="input-address-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  data-testid="input-address-phone"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locality">Locality / Street Address</Label>
              <Input
                id="locality"
                value={formData.locality}
                onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                required
                data-testid="input-address-locality"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                  data-testid="input-address-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  maxLength={6}
                  value={formData.pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setFormData({ ...formData, pincode: value });
                    if (value.length === 6) {
                      checkPincodeAvailability(value);
                    } else {
                      setPincodeStatus(null);
                    }
                  }}
                  required
                  data-testid="input-address-pincode"
                />
                {checkingPincode && (
                  <p className="text-xs text-muted-foreground">Checking availability...</p>
                )}
                {pincodeStatus && (
                  <p
                    className={`text-xs flex items-center gap-1 ${
                      pincodeStatus.available ? "text-green-600" : "text-destructive"
                    }`}
                    data-testid="text-pincode-status"
                  >
                    {pincodeStatus.available ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {pincodeStatus.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked === true })
                }
                data-testid="checkbox-is-default"
              />
              <Label htmlFor="isDefault" className="text-sm font-normal">
                Set as default address
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-address"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingAddress
                  ? "Update Address"
                  : "Add Address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => addressToDelete && deleteMutation.mutate(addressToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
