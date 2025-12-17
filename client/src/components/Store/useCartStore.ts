import { create } from "zustand";
import { produce } from "immer";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { CartItemWithSaree } from "@shared/schema";

interface CartState {
  cart: CartItemWithSaree[];
  count: number;
  isLoadingCart: boolean;
  isAddingItem: Record<string, boolean>;    // key = sareeId
  isUpdatingItem: Record<string, boolean>;  // key = cartItemId
  isRemovingItem: Record<string, boolean>;  // key = cartItemId
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
  isAddingItem: {},
  isUpdatingItem: {},
  isRemovingItem: {},

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
    // set loading only for this saree
    set((state) => ({
      isAddingItem: { ...state.isAddingItem, [sareeId]: true },
    }));

    try {
      const res = await apiRequest("POST", "/api/user/cart", { sareeId, quantity });
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
      set((state) => ({
        isAddingItem: { ...state.isAddingItem, [sareeId]: false },
      }));
    }
  },

  updateQuantity: async (id, quantity) => {
    // set loading only for this cart item
    set((state) => ({
      isUpdatingItem: { ...state.isUpdatingItem, [id]: true },
    }));

    try {
      const cartItem = get().cart.find((c) => c.id === id);
      if (!cartItem) return;

      // Remove item if quantity <= 0 or out of stock
      if (quantity <= 0 || cartItem.saree.onlineStock <= 0) {
        await get().removeItem(id);
        return;
      }

      // Prevent updating beyond stock
      if (quantity > cartItem.saree.onlineStock) return;

      const res = await apiRequest("PATCH", `/api/user/cart/${id}`, { quantity });
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
      set((state) => ({
        isUpdatingItem: { ...state.isUpdatingItem, [id]: false },
      }));
    }
  },

  removeItem: async (id) => {
    set((state) => ({
      isRemovingItem: { ...state.isRemovingItem, [id]: true },
    }));

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
      set((state) => ({
        isRemovingItem: { ...state.isRemovingItem, [id]: false },
      }));
    }
  },

  clearCart: () => {
    set({ cart: [], count: 0, isAddingItem: {}, isUpdatingItem: {}, isRemovingItem: {} });
  },
}));
