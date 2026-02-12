import type { Dispatch, SetStateAction } from "react";
import type { UserAddress } from "@shared/schema";
import React from "react";
export type AddressFormData = {
  name: string;
  phone: string;
  locality: string;
  city: string;
  pincode: string;
  isDefault: boolean;
};

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
  pincodeInfo: any; 
  checkPincode: (pincode: string) => void;
}
