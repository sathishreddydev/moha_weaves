import { create } from "zustand";
import { produce } from "immer";
import { apiRequest } from "@/lib/queryClient";
import type { CartItemWithSaree } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

interface CartState {
  cart: CartItemWithSaree[];
  count: number;
  isLoadingCart: boolean;
  isAddingItem: Record<string, boolean>; // key = sareeId
  isUpdatingItem: Record<string, boolean>; // key = cartItemId
  isRemovingItem: Record<string, boolean>; // key = cartItemId
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
    } catch {
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
    set((state) => ({
      isAddingItem: { ...state.isAddingItem, [sareeId]: true },
    }));

    try {
      const res = await apiRequest("POST", "/api/user/cart", {
        sareeId,
        quantity,
      });
      const data = await res.json();
      set({ cart: data.cart, count: data.count });

      const addedItem = data.cart.find(
        (c: CartItemWithSaree) => c.saree.id === sareeId
      );

      toast({
        title: "Added to Cart",
        description: addedItem ? (
          <div className="flex items-center gap-3">
            <img
              src={addedItem.saree.imageUrl ?? ""}
              alt={addedItem.saree.name}
              className="h-14 w-14 rounded-lg object-cover border border-gray-200"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {addedItem.saree.name}
              </span>
              <span className="text-xs text-gray-500">
                Successfully added to your cart
              </span>
            </div>
          </div>
        ) : (
          <span className="text-sm">Item added to cart</span>
        ),
      });
    } catch {
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
    set((state) => ({
      isUpdatingItem: { ...state.isUpdatingItem, [id]: true },
    }));

    try {
      const cartItem = get().cart.find((c) => c.id === id);
      if (!cartItem) return;

      if (quantity <= 0 || cartItem.saree.onlineStock <= 0) {
        await get().removeItem(id);
        return;
      }

      if (quantity > cartItem.saree.onlineStock) return;

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

      toast({
        title: "Cart Updated",
        description: cartItem ? (
          <div className="flex items-center gap-3">
            <img
              src={cartItem.saree.imageUrl ?? ""}
              alt={cartItem.saree.name}
              className="h-14 w-14 rounded-lg object-cover border border-gray-200"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {cartItem.saree.name}
              </span>
              <span className="text-xs text-gray-500">Quantity updated</span>
            </div>
          </div>
        ) : (
          <span className="text-sm">Cart item updated</span>
        ),
      });
    } catch {
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
      const cartItem = get().cart.find((c) => c.id === id);

      const res = await apiRequest("DELETE", `/api/user/cart/${id}`);
      const data = await res.json();

      set(
        produce((state) => {
          state.cart = state.cart.filter((c: CartItemWithSaree) => c.id !== id);
          state.count = data.count;
        })
      );

      toast({
        title: "Removed from cart",
        description: cartItem ? (
          <div className="flex items-center gap-3">
            <img
              src={cartItem.saree.imageUrl ?? ""}
              alt={cartItem.saree.name}
              className="h-14 w-14 rounded-lg object-cover border border-gray-200"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {cartItem.saree.name}
              </span>
              <span className="text-xs text-gray-500">
                Successfully removed
              </span>
            </div>
          </div>
        ) : (
          <span className="text-sm">Item removed</span>
        ),
      });
    } catch {
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
    set({
      cart: [],
      count: 0,
      isAddingItem: {},
      isUpdatingItem: {},
      isRemovingItem: {},
    });
  },
}));
