import { create } from "zustand";
import { produce } from "immer";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { WishlistItemWithSaree } from "@shared/schema";

interface WishlistState {
  wishlist: WishlistItemWithSaree[];
  count: number;
  isLoadingWishlist: boolean;
  isAddingItem: boolean;
  isRemovingItem: boolean;
  getWishlist: () => Promise<void>;
  addItem: (sareeId: string) => Promise<void>;
  removeItem: (sareeId: string) => Promise<void>;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  wishlist: [],
  count: 0,
  isLoadingWishlist: false,
  isAddingItem: false,
  isRemovingItem: false,

  getWishlist: async () => {
    set({ isLoadingWishlist: true });
    try {
      const res = await apiRequest("GET", "/api/user/wishlist");
      const data = await res.json();
      set({ wishlist: data.wishlist, count: data.count });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to fetch wishlist.",
        variant: "destructive",
      });
    } finally {
      set({ isLoadingWishlist: false });
    }
  },

  addItem: async (sareeId) => {
    set({ isAddingItem: true });
    try {
      const res = await apiRequest("POST", "/api/user/wishlist", { sareeId });
      const data = await res.json();
      set({ wishlist: data.wishlist, count: data.count });
      toast({ title: "Added", description: "Item added to wishlist." });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to add item.",
        variant: "destructive",
      });
    } finally {
      set({ isAddingItem: false });
    }
  },

  removeItem: async (sareeId) => {
    set({ isRemovingItem: true });
    try {
      const res = await apiRequest("DELETE", `/api/user/wishlist/${sareeId}`);
      const data = await res.json();
      set(
        produce((state) => {
          state.wishlist = state.wishlist.filter(
            (item: WishlistItemWithSaree) => item.sareeId !== sareeId
          );
          state.count = data.count;
        })
      );
      toast({ title: "Removed", description: "Item removed from wishlist." });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to remove item.",
        variant: "destructive",
      });
    } finally {
      set({ isRemovingItem: false });
    }
  },

  clearWishlist: () => {
    set({ wishlist: [], count: 0 });
  },
}));
