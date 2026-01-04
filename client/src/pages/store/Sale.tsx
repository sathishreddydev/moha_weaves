import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Package,
  Plus,
  Search,
  Minus,
  Trash2,
  Check,
  CreditCard,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SareeWithDetails } from "@shared/schema";

type ShopProduct = {
  saree: SareeWithDetails;
  storeStock: number;
};

interface CartItem {
  sareeId: string;
  saree: SareeWithDetails;
  quantity: number;
  price: string;
  maxQuantity: number;
}

interface Discount {
  type: "percentage" | "fixed" | "coupon";
  value: number;
  description: string;
  code?: string;
}

interface TaxRule {
  name: string;
  rate: number;
}

export default function StoreSale() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleType, setSaleType] = useState<"walk_in" | "reserved">("walk_in");
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "upi">("cash");
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [couponCode, setCouponCode] = useState("");

  // Tax rules (can be made configurable)
  const taxRules: TaxRule[] = [
    { name: "GST", rate: 18 },
    { name: "Service Charge", rate: 10 },
  ];

  const { data: products, isLoading } = useQuery<ShopProduct[]>({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store",
  });

  const { data: cartData } = useQuery<any>({
    queryKey: ["/api/store/cart"],
    enabled: !!user?.storeId,
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (item: { sareeId: string; quantity: number; unitPrice: number }) => {
      const res = await apiRequest("POST", "/api/store/cart", item);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/cart"] });
      toast({
        title: "Added to cart",
        description: data.message || "Item added to cart successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update cart mutation
  const updateCartMutation = useMutation({
    mutationFn: async (items: CartItem[]) => {
      const res = await apiRequest("PUT", "/api/store/cart", { 
        items: items.map(item => ({
          id: item.sareeId,
          sareeId: item.sareeId,
          quantity: item.quantity,
          unitPrice: parseFloat(item.price),
          lineAmount: item.quantity * parseFloat(item.price),
        }))
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/cart"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (cartData?.items) {
      const mappedCart = cartData.items.map((item: any) => ({
        sareeId: item.sareeId,
        saree: item.saree,
        quantity: item.quantity,
        price: item.unitPrice.toString(),
        maxQuantity: item.saree.totalStock || 999, // Fallback max quantity
      }));
      setCart(mappedCart);
    }
  }, [cartData]);

  const createSaleMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerPhone: string;
      items: { sareeId: string; quantity: number; unitPrice: number; lineAmount: number }[];
      total: number;
      tax: number;
      discount?: Discount;
      paymentMode: "cash" | "card" | "upi";
    }) => {
      const response = await apiRequest("POST", "/api/store/checkout", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sale completed",
        description: `Order #${data.orderId} completed successfully`
      });
      // Clear local cart
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setSaleType("walk_in");
      setPaymentMode("cash");
      setDiscount(null);
      setCouponCode("");
      
      // Clear persistent cart
      updateCartMutation.mutate([]);
      
      // Open receipt in new window
      if (data.receiptUrl) {
        window.open(data.receiptUrl, "_blank");
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete sale",
        variant: "destructive",
      });
    },
  });

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const addToCart = (product: ShopProduct) => {
    if (product.storeStock === 0) {
      toast({
        title: "Out of stock",
        description: "This product is not available in your store",
        variant: "destructive",
      });
      return;
    }
    
    const existing = cart.find((item) => item.sareeId === product.saree.id);
    
    if (existing) {
      if (existing.quantity < product.storeStock) {
        // Use the add to cart mutation to increment quantity
        addToCartMutation.mutate({
          sareeId: product.saree.id,
          quantity: 1,
          unitPrice: parseFloat(product.saree.price),
        });
      } else {
        toast({
          title: "Limit reached",
          description: "Cannot add more than available stock",
        });
      }
    } else {
      // Add new item to cart
      addToCartMutation.mutate({
        sareeId: product.saree.id,
        quantity: 1,
        unitPrice: parseFloat(product.saree.price),
      });
    }
  };

  const updateQuantity = (sareeId: string, delta: number) => {
    const updatedCart = cart.map((item) => {
      if (item.sareeId !== sareeId) return item;
      const newQty = item.quantity + delta;
      if (newQty < 1) return item;
      if (newQty > item.maxQuantity) {
        toast({
          title: "Limit reached",
          description: "Cannot exceed available stock",
        });
        return item;
      }
      return { ...item, quantity: newQty };
    });
    setCart(updatedCart);
    updateCartMutation.mutate(updatedCart);
  };

  const removeFromCart = (sareeId: string) => {
    const updatedCart = cart.filter((item) => item.sareeId !== sareeId);
    setCart(updatedCart);
    updateCartMutation.mutate(updatedCart);
    
    toast({
      title: "Removed from cart",
      description: "Item removed from cart",
    });
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price =
      typeof item.price === "string" ? parseFloat(item.price) : item.price;
    return sum + price * item.quantity;
  }, 0);

  // Calculate final total with discounts and taxes
  const subtotal = cartTotal;
  const discountAmount = discount
    ? discount.type === "percentage"
      ? (discount.value / 100) * subtotal
      : discount.value
    : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const taxAmount = taxRules.reduce((sum, tax) => sum + (tax.rate / 100) * discountedSubtotal, 0);
  const finalTotal = discountedSubtotal + taxAmount;

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast({
        title: "Empty cart",
        description: "Add items to the cart first",
      });
      return;
    }

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => {
      const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
      return sum + price * item.quantity;
    }, 0);

    const discountAmount = discount
      ? discount.type === "percentage"
        ? (discount.value / 100) * subtotal
        : discount.value
      : 0;

    const discountedSubtotal = subtotal - discountAmount;
    const taxAmount = taxRules.reduce((sum, tax) => sum + (tax.rate / 100) * discountedSubtotal, 0);
    const totalAmount = discountedSubtotal + taxAmount;

    createSaleMutation.mutate({
      customerName,
      customerPhone,
      items: cart.map((item) => ({
        sareeId: item.sareeId,
        quantity: item.quantity,
        unitPrice: typeof item.price === "string" ? parseFloat(item.price) : item.price,
        lineAmount: (typeof item.price === "string" ? parseFloat(item.price) : item.price) * item.quantity,
      })),
      total: totalAmount,
      tax: taxAmount,
      discount: discount || undefined,
      paymentMode,
    });
  };

  const filteredProducts = products?.filter(
    (item) =>
      item.storeStock > 0 &&
      (item.saree.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.saree.sku?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          New Sale
        </h1>
        <p className="text-muted-foreground">Process a new in-store sale</p>
      </div>

      <div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Select Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-products"
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredProducts?.map((item) => {
                  const inCart = cart.some(c => c.sareeId === item.saree.id);
                  const outOfStock = item.storeStock === 0;

                  return (
                    <div
                      key={item.saree.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition
          ${outOfStock ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm"}`}
                      data-testid={`product-${item.saree.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                          alt={item.saree.name}
                          className="w-12 h-16 rounded object-cover"
                        />

                        <div>
                          <p className="font-medium text-sm line-clamp-1">
                            {item.saree.name}
                          </p>

                          <p className="text-sm font-semibold text-primary">
                            {formatPrice(item.saree.price)}
                          </p>

                          {outOfStock ? (
                            <Badge variant="destructive" className="text-xs">
                              Out of stock
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {item.storeStock} in stock
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      <Button
                        variant={inCart ? "secondary" : "ghost"}
                        size="icon"
                        disabled={outOfStock}
                        aria-label={inCart ? "Added to cart" : "Add to cart"}
                        onClick={() => addToCart(item)}
                      >
                        {inCart ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}

                {filteredProducts?.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No products in stock
                  </p>
                )}
              </div>

            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
