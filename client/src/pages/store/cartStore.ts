import { create } from "zustand";
import { produce } from "immer";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export interface CartItem {
  id: string;
  sareeId: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  storeStock: number;
  saree: {
    id: string;
    name: string;
    code: string;
    image: string;
  };
}

export interface Discount {
  type: "percentage" | "fixed" | "coupon";
  value: number;
  code?: string;
  couponId?: string;
  description: string;
  minOrderAmount?: number;
  maxDiscount?: number;
}

export interface TaxRule {
  name: string;
  rate: number;
  type: "percentage" | "fixed";
}

export interface OrderSummary {
  orderId: string;
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMode: string;
  createdAt: Date;
}

interface CartState {
  // State
  cartItems: CartItem[];
  discount: Discount | null;
  couponCode: string;
  taxRules: TaxRule[];
  paymentMode: "cash" | "card" | "upi";
  customerName: string;
  customerPhone: string;
  lastOrder: OrderSummary | null;
  
  // Loading states
  isLoadingCart: boolean;
  isUpdatingCart: boolean;
  isApplyingCoupon: boolean;
  isCheckingOut: boolean;
  isAddingItem: Record<string, boolean>; // key = sareeId
  isUpdatingItem: Record<string, boolean>; // key = cartItemId
  isRemovingItem: Record<string, boolean>; // key = cartItemId

  // Actions
  getCart: () => Promise<void>;
  addToCart: (sareeId: string, quantity: number, unitPrice: number) => Promise<void>;
  updateQuantity: (itemId: string, newQuantity: number, sareeId: string, storeStock: number) => Promise<void>;
  removeFromCart: (itemId: string, sareeId: string) => Promise<void>;
  updateCartItems: (items: CartItem[]) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeDiscount: () => void;
  checkout: () => Promise<void>;
  clearCart: () => void;
  setPaymentMode: (mode: "cash" | "card" | "upi") => void;
  setCustomerInfo: (name: string, phone: string) => void;
  setCouponCode: (code: string) => void;
  
  // Computed getters
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getDiscountedSubtotal: () => number;
  getTaxAmount: () => number;
  getTotalAmount: () => number;
}

const formatPrice = (price: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price));

export const useCartStore = create<CartState>((set, get) => ({
  // Initial state
  cartItems: [],
  discount: null,
  couponCode: "",
  taxRules: [
    { name: "GST", rate: 18, type: "percentage" },
    { name: "Service Charge", rate: 10, type: "percentage" }
  ],
  paymentMode: "cash",
  customerName: "",
  customerPhone: "",
  lastOrder: null,
  
  // Loading states
  isLoadingCart: false,
  isUpdatingCart: false,
  isApplyingCoupon: false,
  isCheckingOut: false,
  isAddingItem: {},
  isUpdatingItem: {},
  isRemovingItem: {},

  // Computed getters
  getSubtotal: () => get().cartItems.reduce((sum, item) => sum + item.lineAmount, 0),

  getDiscountAmount: () => {
    const { discount } = get();
    const subtotal = get().getSubtotal();
    return discount
      ? discount.type === "percentage"
        ? (discount.value / 100) * subtotal
        : discount.value
      : 0;
  },

  getDiscountedSubtotal: () => {
    const subtotal = get().getSubtotal();
    const discountAmount = get().getDiscountAmount();
    return subtotal - discountAmount;
  },

  getTaxAmount: () => {
    const { taxRules } = get();
    const discountedSubtotal = get().getDiscountedSubtotal();
    return taxRules.reduce((sum, tax) => {
      return sum + (tax.type === "percentage" ? (tax.rate / 100) * discountedSubtotal : tax.rate);
    }, 0);
  },

  getTotalAmount: () => {
    const discountedSubtotal = get().getDiscountedSubtotal();
    const taxAmount = get().getTaxAmount();
    return discountedSubtotal + taxAmount;
  },

  // Actions
  getCart: async () => {
    set({ isLoadingCart: true });
    try {
      const res = await apiRequest("GET", "/api/store/cart");
      const data = await res.json();
      set({ cartItems: data.items || [] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch cart",
        variant: "destructive",
      });
    } finally {
      set({ isLoadingCart: false });
    }
  },

  addToCart: async (sareeId: string, quantity: number, unitPrice: number) => {
    set((state) => ({
      isAddingItem: { ...state.isAddingItem, [sareeId]: true },
    }));

    try {
      const res = await apiRequest("POST", "/api/store/cart", {
        sareeId,
        quantity,
        unitPrice,
      });
      const data = await res.json();
      
      // Refresh cart after adding
      await get().getCart();

      toast({
        title: "Item Added",
        description: "Item added to cart successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add item to cart",
        variant: "destructive",
      });
    } finally {
      set((state) => ({
        isAddingItem: { ...state.isAddingItem, [sareeId]: false },
      }));
    }
  },

  updateQuantity: async (itemId: string, newQuantity: number, sareeId: string, storeStock: number) => {
    if (newQuantity <= 0) {
      await get().removeFromCart(itemId, sareeId);
      return;
    }

    if (newQuantity > storeStock) {
      toast({
        title: "Stock Limit",
        description: `Cannot add more than ${storeStock} items`,
        variant: "destructive",
      });
      return;
    }

    set((state) => ({
      isUpdatingItem: { ...state.isUpdatingItem, [itemId]: true },
    }));

    try {
      const updatedItems = get().cartItems.map((item: CartItem) =>
        item.id === itemId
          ? {
              ...item,
              quantity: newQuantity,
              lineAmount: newQuantity * item.unitPrice
            }
          : item
      );

      const res = await apiRequest("PUT", "/api/store/cart", { items: updatedItems });
      await res.json();
      
      set({ cartItems: updatedItems });

      toast({
        title: "Cart Updated",
        description: "Your cart has been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update cart",
        variant: "destructive",
      });
    } finally {
      set((state) => ({
        isUpdatingItem: { ...state.isUpdatingItem, [itemId]: false },
      }));
    }
  },

  removeFromCart: async (itemId: string, sareeId: string) => {
    set((state) => ({
      isRemovingItem: { ...state.isRemovingItem, [itemId]: true },
    }));

    try {
      const res = await apiRequest("DELETE", `/api/store/cart/${sareeId}`);
      await res.json();
      
      set(
        produce((state) => {
          state.cartItems = state.cartItems.filter((item: CartItem) => item.id !== itemId);
        })
      );

      toast({
        title: "Item removed",
        description: "Item removed from cart successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove item",
        variant: "destructive",
      });
    } finally {
      set((state) => ({
        isRemovingItem: { ...state.isRemovingItem, [itemId]: false },
      }));
    }
  },

  updateCartItems: async (items: CartItem[]) => {
    set({ isUpdatingCart: true });
    try {
      const res = await apiRequest("PUT", "/api/store/cart", { items });
      await res.json();
      set({ cartItems: items });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update cart",
        variant: "destructive",
      });
    } finally {
      set({ isUpdatingCart: false });
    }
  },

  applyCoupon: async (code: string) => {
    if (!code.trim()) {
      toast({
        title: "Invalid Coupon",
        description: "Please enter a coupon code",
        variant: "destructive",
      });
      return;
    }

    set({ isApplyingCoupon: true });

    try {
      const res = await apiRequest("POST", "/api/store/apply-coupon", { code });
      const data = await res.json();
      
      set({ discount: data.discount, couponCode: "" });

      toast({
        title: "Coupon Applied",
        description: `${data.discount.description} - ${formatPrice(data.discount.value)}`,
      });
    } catch (error: any) {
      toast({
        title: "Invalid Coupon",
        description: error.message || "Failed to apply coupon",
        variant: "destructive",
      });
    } finally {
      set({ isApplyingCoupon: false });
    }
  },

  removeDiscount: () => {
    set({ discount: null });
    toast({
      title: "Discount Removed",
      description: "Discount has been removed from cart",
    });
  },

  checkout: async () => {
    const { cartItems, discount } = get();
    const taxAmount = get().getTaxAmount();
    const totalAmount = get().getTotalAmount();
    const { paymentMode, customerName, customerPhone } = get();

    if (cartItems.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to cart before checkout",
        variant: "destructive",
      });
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: "Customer Information Required",
        description: "Please enter customer name and phone number",
        variant: "destructive",
      });
      return;
    }

    set({ isCheckingOut: true });

    try {
      const res = await apiRequest("POST", "/api/store/checkout", {
        items: cartItems,
        discount,
        tax: taxAmount,
        total: totalAmount,
        paymentMode,
        customerName,
        customerPhone,
      });
      const data = await res.json();

      set({
        lastOrder: {
          orderId: data.orderId,
          items: cartItems,
          customerName,
          customerPhone,
          subtotal: get().getSubtotal(),
          discountAmount: get().getDiscountAmount(),
          taxAmount,
          totalAmount,
          paymentMode,
          createdAt: new Date()
        },
        cartItems: [],
        discount: null,
      });

      toast({
        title: "Order Completed",
        description: `Order #${data.orderId} completed successfully`,
      });

      if (data.receiptUrl) {
        window.open(data.receiptUrl, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Checkout Failed",
        description: error.message || "Failed to complete checkout",
        variant: "destructive",
      });
    } finally {
      set({ isCheckingOut: false });
    }
  },

  clearCart: () => {
    set({
      cartItems: [],
      discount: null,
      couponCode: "",
      lastOrder: null,
    });
  },

  setPaymentMode: (mode: "cash" | "card" | "upi") => {
    set({ paymentMode: mode });
  },

  setCustomerInfo: (name: string, phone: string) => {
    set({ customerName: name, customerPhone: phone });
  },

  setCouponCode: (code: string) => {
    set({ couponCode: code });
  },
}));
