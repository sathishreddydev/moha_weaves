import { create } from "zustand";
import axios from "axios";
import { produce } from "immer";
import { toast } from "@/hooks/use-toast";

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  storeStock: number;
  product: {
    id: string;
    name: string;
    code: string;
    image: string;
  };
}

interface StoreCartState {
  storeId: string;
  items: CartItem[];

  loading: boolean;
  addCartLoading: Record<string, boolean>;
  updateCartLoading: Record<string, boolean>;
  removeLoading: Record<string, boolean>;
  itemLoading: Record<string, boolean>;

  setStoreId: (storeId: string) => void;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity: number, unitPrice: number) => Promise<void>;
  updateItems: (items: CartItem[], productId: string) => Promise<void>;
  deleteItem: (productId: string) => Promise<void>;
  clearCart: () => void;
}

export const useStoreCart = create<StoreCartState>((set, get) => ({
  storeId: "",
  items: [],

  loading: false,
  addCartLoading: {},
  updateCartLoading: {},
  removeLoading: {},
  itemLoading: {},

  setStoreId: (storeId) => set({ storeId }),

  fetchCart: async () => {
    const { storeId } = get();
    if (!storeId) return;

    set({ loading: true });
    try {
      const res = await axios.get(`/api/store/cart`);
      set({ items: res.data.items || [] });
    } catch (error) {
      console.error("Error fetching cart:", error);
      toast({
        title: "Failed to fetch cart",
        description: "Please try again later.",
      });
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (productId, quantity, unitPrice) => {
    const { storeId } = get();
    if (!storeId) return;

    set((state) => ({
      addCartLoading: { ...state.addCartLoading, [productId]: true },
    }));
    try {
      const res = await axios.post(`/api/store/cart`, { productId, quantity, unitPrice });
      set({ items: res.data.items || [] });

      toast({
        title: "Added to cart",
        description: res.data.message || "Item added to cart successfully",
      });
    } catch (error: any) {
      console.error("Error adding to cart:", error);

      toast({
        title: "Failed to add item",
        description: error.response?.data?.message || "Something went wrong",
      });
    } finally {
      set((state) => ({
        addCartLoading: { ...state.addCartLoading, [productId]: false },
      }));
    }
  },

  updateItems: async (items, productId) => {
    const { storeId } = get();
    if (!storeId) return;

    set(produce((state: StoreCartState) => {
      items.forEach(item => {
        state.itemLoading[item.productId] = true;
      });
      state.updateCartLoading[productId] = true;
    }));

    try {
      const res = await axios.put(`/api/store/cart`, { items });
      const updatedItems = res.data.items || [];

      set(produce((state: StoreCartState) => {
        updatedItems.forEach((updatedItem: CartItem) => {
          const existingItem = state.items.find(i => i.productId === updatedItem.productId);
          if (existingItem) {
            existingItem.quantity = updatedItem.quantity;
            existingItem.unitPrice = updatedItem.unitPrice;
            existingItem.lineAmount = updatedItem.lineAmount;
          } else {
            state.items.push(updatedItem);
          }
          state.itemLoading[updatedItem.productId] = false;
        });
      }));

      toast({
        title: "Cart updated",
        description: "Your cart items have been updated successfully",
      });
    } catch (error) {
      console.error("Error updating cart:", error);

      set(produce((state: StoreCartState) => {
        items.forEach(item => {
          state.itemLoading[item.productId] = false;
        });
        state.updateCartLoading[productId] = false;

      }));

      toast({
        title: "Failed to update cart",
        description: "Please try again.",
      });
    } finally {
      set((state) => ({
        updateCartLoading: { ...state.updateCartLoading, [productId]: false },
      }));
    }
  },

  deleteItem: async (productId) => {
    const { storeId } = get();
    if (!storeId) return;

    set((state) => ({
      addCartLoading: { ...state.removeLoading, [productId]: true },
    }));
    try {
      await axios.delete(`/api/store/cart/${productId}`);
      await get().fetchCart();

      toast({
        title: "Item removed",
        description: "Item has been removed from your cart",
      });
    } catch (error) {
      console.error("Error removing item:", error);

      toast({
        title: "Failed to remove item",
        description: "Please try again.",
      });
    } finally {
      set((state) => ({
        addCartLoading: { ...state.removeLoading, [productId]: false },
      }));
    }
  },

  clearCart: () => {
    set({ items: [] });
    // toast({
    //   title: "Cart cleared",
    //   description: "All items have been removed from your cart",
    // });

    set({ removeLoading: {} });
    set({ updateCartLoading: {} });
    set({ itemLoading: {} });
    set({ addCartLoading: {} });
    set({ loading: false });
  },
}));
