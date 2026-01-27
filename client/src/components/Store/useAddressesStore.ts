import { create } from "zustand";
import { toast } from "@/hooks/use-toast";
import type { UserAddress, InsertUserAddress } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { produce } from "immer";

interface PincodeInfo {
  available: boolean;
  city?: string;
  state?: string;
  deliveryDays?: number;
  message?: string;
}

interface AddressStore {
  addresses: UserAddress[];

  fetchLoading: boolean;
  addLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  defaultLoading: boolean;

  pincodeInfo: PincodeInfo | null;
  pincodeLoading: boolean;
  pincodeError: string | null;

  fetchAddresses: () => Promise<void>;
  addAddress: (address: InsertUserAddress) => Promise<void>;
  updateAddress: (
    id: string,
    data: Partial<InsertUserAddress>
  ) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  checkPincode: (pincode: string) => Promise<void>;
}

export const useAddressStore = create<AddressStore>((set, get) => ({
  addresses: [],

  fetchLoading: false,
  addLoading: false,
  updateLoading: false,
  deleteLoading: false,
  defaultLoading: false,

  pincodeInfo: null,
  pincodeLoading: false,
  pincodeError: null,

  fetchAddresses: async () => {
    set({ fetchLoading: true });
    try {
      const data = await apiRequest("GET", "/api/user/addresses");
      set({ addresses: data });
    } catch (err: any) {
      toast({ title: "Error", description: err.message });
    } finally {
      set({ fetchLoading: false });
    }
  },

  addAddress: async (address) => {
    set({ addLoading: true });
    try {
      const data = await apiRequest("POST", "/api/user/addresses", address);
      set({ addresses: data });
      toast({ title: "Success", description: "Address added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message });
    } finally {
      set({ addLoading: false });
    }
  },

  updateAddress: async (id, data) => {
    set({ updateLoading: true });
    try {
      const updated = await apiRequest("PATCH", `/api/user/addresses/${id}`, data);
      set({ addresses: updated });
      toast({ title: "Success", description: "Address updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message });
    } finally {
      set({ updateLoading: false });
    }
  },

  deleteAddress: async (id) => {
    set({ deleteLoading: true });
    try {
      const res = await apiRequest("DELETE", `/api/user/addresses/${id}`);
      if (!res.ok) throw new Error("Failed to delete address");

      set(
        produce((state) => {
          state.addresses = state.addresses.filter(
            (addr: any) => addr.id !== id
          );
        })
      );
      toast({ title: "Success", description: "Address deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message });
    } finally {
      set({ deleteLoading: false });
    }
  },

  setDefaultAddress: async (id) => {
    set({ defaultLoading: true });
    try {
      const updated = await apiRequest(
        "PATCH",
        `/api/user/addresses/${id}/default`
      );
      set({ addresses: updated });
      toast({ title: "Success", description: "Default address updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message });
    } finally {
      set({ defaultLoading: false });
    }
  },

  checkPincode: async (pincode) => {
    set({ pincodeLoading: true, pincodeError: null, pincodeInfo: null });
    try {
      const data = await apiRequest("GET", `/api/pincodes/${pincode}/check`);
      set({ pincodeInfo: data });

      if (!data.available) {
        toast({
          title: "Delivery Unavailable",
          description: data.message,
        });
      }
    } catch (err: any) {
      set({ pincodeError: err.message });
      toast({ title: "Error", description: err.message });
    } finally {
      set({ pincodeLoading: false });
    }
  },
}));
