import type { Dispatch, SetStateAction } from "react";
import type { UserAddress } from "@shared/schema";
import React from "react";

export type AddressFormData = {
  name: string;
  phone: string;
  addressLine1: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  addressType: "home" | "work" | "other";
  isDefault: boolean;
};

export interface PincodeInfo {
  available: boolean;
  city?: string;
  state?: string;
  deliveryDays?: number;
  message?: string;
}

export interface AddressDialogProps {
  formData: AddressFormData;
  setFormData: Dispatch<SetStateAction<AddressFormData>>;
  dialogOpen: boolean;
  setDialogOpen: Dispatch<SetStateAction<boolean>>;
  handleCloseDialog: () => void;
  editingAddress: UserAddress | null;
  handleSubmit: (e: React.FormEvent) => void;
  isAddNewAddress: boolean;
  isUpdateAddresses: boolean;
  pincodeLoading: boolean;
  pincodeInfo: PincodeInfo | null;
  checkPincode: (pincode: string) => void;
}
