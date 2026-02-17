import { create } from "zustand";
import axios from "axios";
import { produce } from "immer";
import { toast } from "@/hooks/use-toast";

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: string | number;  // Accept both string and number from backend
  lineAmount: number;
  totalStock: number;
  product: {
    id: string;
    name: string;
    code: string;
    image: string;
    price?: string;
    activeSale?: {
      id: string;
      name: string;
      offerType: string;
      discountValue: string;
      maxDiscount?: string;
    } | null;
    discountedPrice?: number;
    variants?: {
      id: string;
      size: string;
      sku?: string;
      price?: string;
      stockQuantity: number;
    }[];
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
  addItem: (productId: string, quantity: number, unitPrice: number, variantId?: string) => Promise<void>;
  updateItems: (items: CartItem[], productId: string) => Promise<void>;
  deleteItem: (productId: string, variantId?: string) => Promise<void>;
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

  addItem: async (productId, quantity, unitPrice, variantId?: string) => {
    const { storeId } = get();
    if (!storeId) return;

    set((state) => ({
      addCartLoading: { ...state.addCartLoading, [productId]: true },
    }));
    try {
      const res = await axios.post(`/api/store/cart`, { 
        productId, 
        quantity, 
        unitPrice: typeof unitPrice === 'string' ? parseFloat(unitPrice) : unitPrice, 
        variantId 
      });
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
      // Convert unitPrice to number for backend compatibility
      const sanitizedItems = items.map(item => {
        const cleanItem = {
          ...item,
          unitPrice: typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : item.unitPrice
        };
        
        // Remove variantId if it's null or undefined - backend expects it to be omitted
        if (!cleanItem.variantId) {
          delete cleanItem.variantId;
        }
        
        return cleanItem;
      });
      
      const res = await axios.put(`/api/store/cart`, { items: sanitizedItems });
      const updatedItems = res.data.items || [];

      set(produce((state: StoreCartState) => {
        // Create a map of updated items for quick lookup
        const updatedItemsMap = new Map(
          updatedItems.map((item: CartItem) => [
            `${item.productId}_${item.variantId || 'no-variant'}`, 
            item
          ])
        );

        // Update existing items or add new ones
        state.items = state.items.map((existingItem: CartItem) => {
          const key = `${existingItem.productId}_${existingItem.variantId || 'no-variant'}`;
          const updatedItem = updatedItemsMap.get(key) as CartItem | undefined;
          return updatedItem || existingItem;
        });

        // Add any completely new items
        const existingKeys = new Set(
          state.items.map((item: CartItem) => `${item.productId}_${item.variantId || 'no-variant'}`)
        );
        
        updatedItems.forEach((updatedItem: CartItem) => {
          const key = `${updatedItem.productId}_${updatedItem.variantId || 'no-variant'}`;
          if (!existingKeys.has(key)) {
            state.items.push(updatedItem);
          }
        });

        // Clear loading states
        updatedItems.forEach((updatedItem: CartItem) => {
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

  deleteItem: async (productId, variantId?: string) => {
    const { storeId } = get();
    if (!storeId) return;

    set((state) => ({
      removeLoading: { ...state.removeLoading, [productId]: true },
    }));
    try {
      await axios.delete(`/api/store/cart/${productId}${variantId ? `/${variantId}` : ''}`);
      await get().fetchCart();

      toast({
        title: "Item removed",
        description: "Item has been removed from your cart",
      });
    } catch (error) {
      console.error("Error removing item:", error);

      toast({
        title: "Failed to remove item",
        description: "Failed to remove item from cart",
      });
    } finally {
      set((state) => ({
        removeLoading: { ...state.removeLoading, [productId]: false },
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
