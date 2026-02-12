import { create } from "zustand";
import { produce } from "immer";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { WishlistItemWithProduct } from "@shared/schema";

interface WishlistState {
  wishlist: WishlistItemWithProduct[];
  count: number;
  isLoadingWishlist: boolean;
  isAddingItem: boolean;
  isRemovingItem: boolean;
  getWishlist: () => Promise<void>;
  addItem: (productId: string) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
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
      const data = await apiRequest("GET", "/api/user/wishlist");
      set({ wishlist: data.wishlist, count: data.count });
    } catch  {
      toast({
        title: "Error",
        description: "Failed to fetch wishlist.",
        variant: "destructive",
      });
    } finally {
      set({ isLoadingWishlist: false });
    }
  },

  addItem: async (productId) => {
    set({ isAddingItem: true });
    try {
      const data = await apiRequest("POST", "/api/user/wishlist", { productId });
      set({ wishlist: data.wishlist, count: data.count });
      toast({ title: "Added", description: "Item added to wishlist." });
    } catch  {
      toast({
        title: "Error",
        description: "Failed to add item.",
        variant: "destructive",
      });
    } finally {
      set({ isAddingItem: false });
    }
  },

  removeItem: async (productId) => {
    set({ isRemovingItem: true });
    try {
      const data = await apiRequest("DELETE", `/api/user/wishlist/${productId}`);
      set(
        produce((state) => {
          state.wishlist = state.wishlist.filter(
            (item: WishlistItemWithProduct) => item.productId !== productId
          );
          state.count = data.count;
        })
      );
      toast({ title: "Removed", description: "Item removed from wishlist." });
    } catch  {
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
