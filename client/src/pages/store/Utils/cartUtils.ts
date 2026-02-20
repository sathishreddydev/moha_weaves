import { CartItem } from "@/pages/store/Hook/cartForStore";
import { toast } from "@/hooks/use-toast";

// Safe price parsing with validation
export const safeParseFloat = (value: any): number => {
  try {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
};

// Calculate variant price with fallback logic
export const calculateVariantPrice = (
  product: any,
  variantId?: string,
  quantity: number = 1
) => {
  const selectedVariant = product.variants?.find((v: any) => v.id === variantId);
  const variantPrice = selectedVariant?.price ? safeParseFloat(selectedVariant.price) : null;
  const productPrice = safeParseFloat(product.price);
  
  const unitPrice = selectedVariant
    ? (variantPrice || productPrice || 0)
    : product.activeSale && product.discountedPrice
      ? product.discountedPrice
      : productPrice;

  return {
    unitPrice,
    lineAmount: unitPrice * quantity,
  };
};

// Find cart item by product and variant
export const findCartItem = (
  cartItems: CartItem[],
  productId: string,
  variantId?: string
) => {
  return cartItems.find(
    (item) =>
      item.productId === productId &&
      (variantId ? item.variantId === variantId : !item.variantId)
  );
};

// Find cart item by variant ID specifically
export const getCartItemByVariant = (
  cartItems: CartItem[],
  productId: string,
  variantId: string
) => {
  return cartItems.find(c => c.productId === productId && c.variantId === variantId);
};

// Check if product has items in cart
export const hasItemsInCart = (
  cartItems: CartItem[],
  productId: string
) => {
  return cartItems.some((c) => c.productId === productId);
};

// Get available stock for variant or product
export const getAvailableStock = (product: any, variantId?: string) => {
  if (variantId) {
    const variant = product.variants?.find((v: any) => v.id === variantId);
    return variant ? variant.stockQuantity : 0;
  }
  return product.totalStock || 0;
};

// Validate stock limits
export const validateStockLimit = (
  currentQuantity: number,
  requestedDelta: number,
  availableStock: number
) => {
  const newQuantity = currentQuantity + requestedDelta;
  
  if (newQuantity < 1) {
    return { valid: false, message: "Quantity cannot be less than 1" };
  }
  
  if (newQuantity > availableStock) {
    return { 
      valid: false, 
      message: "Cannot exceed available stock" 
    };
  }
  
  return { valid: true, newQuantity };
};

// Update cart item quantity with validation
export const updateCartItemQuantity = (
  cartItems: CartItem[],
  productId: string,
  delta: number,
  variantId?: string
) => {
  return cartItems.map((item) => {
    // Match both productId and variantId
    if (item.productId !== productId || (variantId && item.variantId !== variantId)) {
      return item;
    }

    const availableStock = variantId 
      ? getAvailableStock(item.product, variantId)
      : item.totalStock;

    const validation = validateStockLimit(item.quantity, delta, availableStock);
    
    if (!validation.valid) {
      toast({
        title: "Stock Limit",
        description: validation.message,
        variant: "destructive",
      });
      return item;
    }

    const unitPrice = safeParseFloat(item.unitPrice);
    
    return {
      ...item,
      quantity: validation.newQuantity!,
      lineAmount: validation.newQuantity! * unitPrice,
      // Ensure variantId is properly set (undefined instead of null)
      variantId: variantId || undefined,
    };
  });
};

// Group cart items by product for display
export const groupCartItemsByProduct = (cartItems: CartItem[]) => {
  return cartItems.reduce((groups, item) => {
    const key = item.productId;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, CartItem[]>);
};

// Calculate cart totals
export const calculateCartTotals = (cartItems: CartItem[]) => {
  const subtotal = cartItems.reduce((sum, item) => {
    const price = safeParseFloat(item.unitPrice);
    return sum + (price * item.quantity);
  }, 0);

  return { subtotal };
};

// Check if product is out of stock
export const isOutOfStock = (product: any, variantId?: string) => {
  const stock = getAvailableStock(product, variantId);
  return stock === 0;
};

// Get display stock text
export const getStockDisplayText = (product: any, variantId?: string, cartQuantity: number = 0) => {
  const stock = getAvailableStock(product, variantId);
  
  if (stock === 0) {
    return "Out of stock";
  }
  
  const available = stock - cartQuantity;
  return `${available} available`;
};
