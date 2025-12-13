import { create } from "zustand";
import { produce } from "immer";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { CartItemWithSaree } from "@shared/schema";

interface CartState {
  cart: CartItemWithSaree[];
  count: number;
  isLoadingCart: boolean;
  isAddingItem: boolean;
  isUpdatingItem: boolean;
  isRemovingItem: boolean;
  getCart: () => Promise<void>;
  addItem: (sareeId: string, quantity: number) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: [],
  count: 0,
  isLoadingCart: false,
  isAddingItem: false,
  isUpdatingItem: false,
  isRemovingItem: false,

  getCart: async () => {
    set({ isLoadingCart: true });
    try {
      const res = await apiRequest("GET", "/api/user/cart");
      const data = await res.json();
      set({ cart: data.cart, count: data.count });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to fetch cart.",
        variant: "destructive",
      });
    } finally {
      set({ isLoadingCart: false });
    }
  },

  addItem: async (sareeId, quantity) => {
    set({ isAddingItem: true });

    try {
      const res = await apiRequest("POST", "/api/user/cart", {
        sareeId,
        quantity,
      });
      const data = await res.json();
      set({ cart: data.cart, count: data.count });
      toast({ title: "Added", description: "Item added to cart." });
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

  updateQuantity: async (id, quantity) => {
    set({ isUpdatingItem: true });

    try {
      const res = await apiRequest("PATCH", `/api/user/cart/${id}`, {
        quantity,
      });
      const data = await res.json();

      set(
        produce((state) => {
          const item = state.cart.find((c: CartItemWithSaree) => c.id === id);
          if (item) item.quantity = quantity;
          state.count = data.count;
        })
      );
      toast({ title: "Updated", description: "Cart updated successfully." });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update item.",
        variant: "destructive",
      });
    } finally {
      set({ isUpdatingItem: false });
    }
  },

  removeItem: async (id) => {
    set({ isRemovingItem: true });

    try {
      const res = await apiRequest("DELETE", `/api/user/cart/${id}`);
      const data = await res.json();

      set(
        produce((state) => {
          state.cart = state.cart.filter((c: CartItemWithSaree) => c.id !== id);
          state.count = data.count;
        })
      );
      toast({ title: "Removed", description: "Item removed from cart." });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to remove item.",
        variant: "destructive",
      });
    } finally {
      set({ isAddingItem: false });
    }
  },

  clearCart: () => {
    set({ cart: [], count: 0 });
  },
}));
