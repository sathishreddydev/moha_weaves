import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Wallet, FileText, Download } from "lucide-react";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { generateInvoicePDF, type InvoiceData } from "@/utils/invoiceGenerator";
import { testInvoiceGeneration } from "@/utils/invoiceTest";

interface CartItem {
  id: string;
  sareeId: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  saree: {
    id: string;
    name: string;
    code: string;
    image: string;
  };
}

interface Discount {
  type: "percentage" | "fixed" | "coupon";
  value: number;
  code?: string;
  couponId?: string;
  description: string;
  minOrderAmount?: number;
  maxDiscount?: number;
}

interface TaxRule {
  name: string;
  rate: number;
  type: "percentage" | "fixed";
}
const formatPrice = (price: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price));
export default function Cart() {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [taxRules] = useState<TaxRule[]>([
    { name: "GST", rate: 18, type: "percentage" },
    { name: "Service Charge", rate: 10, type: "percentage" }
  ]);
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "upi">("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [lastOrder, setLastOrder] = useState<any>(null);

  const { data: cartData, isLoading } = useQuery<any>({
    queryKey: ["/api/store/cart"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user?.storeId,
  });

  // Update cart mutation
  const updateCartMutation = useMutation({
    mutationFn: async (data: { items: CartItem[] }) => {
      const res = await apiRequest("PUT", "/api/store/cart", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Cart Updated",
        description: "Your cart has been updated successfully",
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

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/store/apply-coupon", { code });
      return await res.json();
    },
    onSuccess: (data) => {
      setDiscount(data.discount);
      toast({
        title: "Coupon Applied",
        description: `${data.discount.description} - ${formatPrice(data.discount.value)}`,
      });
      setCouponCode("");
    },
    onError: (error: Error) => {
      toast({
        title: "Invalid Coupon",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: {
      items: CartItem[];
      discount: Discount | null;
      tax: number;
      total: number;
      paymentMode: string;
      customerName: string;
      customerPhone: string;
    }) => {
      const res = await apiRequest("POST", "/api/store/checkout", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order Completed",
        description: `Order #${data.orderId} completed successfully`,
      });
      setLastOrder({
        orderId: data.orderId,
        items: cartItems,
        customerName,
        customerPhone,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paymentMode,
        createdAt: new Date()
      });
      setCartItems([]);
      setDiscount(null);
      if (data.receiptUrl) {
        window.open(data.receiptUrl, "_blank");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (cartData?.items) {
      setCartItems(cartData.items);
    }
  }, [cartData]);

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    const updatedItems = cartItems.map(item =>
      item.id === itemId
        ? { ...item, quantity: newQuantity, lineAmount: newQuantity * item.unitPrice }
        : item
    );
    setCartItems(updatedItems);
    updateCartMutation.mutate({ items: updatedItems });
  };

  const removeItem = (itemId: string) => {
    const updatedItems = cartItems.filter(item => item.id !== itemId);
    setCartItems(updatedItems);
    updateCartMutation.mutate({ items: updatedItems });
  };

  const applyCoupon = () => {
    if (!couponCode.trim()) {
      toast({
        title: "Invalid Coupon",
        description: "Please enter a coupon code",
        variant: "destructive",
      });
      return;
    }
    applyCouponMutation.mutate(couponCode);
  };

  const removeDiscount = () => {
    setDiscount(null);
    toast({
      title: "Discount Removed",
      description: "Discount has been removed from cart",
    });
  };

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.lineAmount, 0);
  const discountAmount = discount
    ? discount.type === "percentage"
      ? (discount.value / 100) * subtotal
      : discount.value
    : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const taxAmount = taxRules.reduce((sum, tax) => {
    return sum + (tax.type === "percentage" ? (tax.rate / 100) * discountedSubtotal : tax.rate);
  }, 0);
  const totalAmount = discountedSubtotal + taxAmount;

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to cart before checkout",
        variant: "destructive",
      });
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      if (!customerName.trim() && !customerPhone.trim()) {
        toast({
          title: "Customer Information Required",
          description: "Please enter customer name and phone number",
          variant: "destructive",
        });
      } else if (!customerName.trim()) {
        toast({
          title: "Customer Name Required",
          description: "Please enter customer name",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Phone Number Required",
          description: "Please enter phone number",
          variant: "destructive",
        });
      }
      return;
    }

    checkoutMutation.mutate({
      items: cartItems,
      discount,
      tax: taxAmount,
      total: totalAmount,
      paymentMode,
      customerName,
      customerPhone,
    });
  };

  const generateInvoice = async () => {
    if (!lastOrder) {
      toast({
        title: "No Order Available",
        description: "Please complete an order first",
        variant: "destructive",
      });
      return;
    }

    try {
      const invoiceData: InvoiceData = {
        orderId: lastOrder.orderId,
        customerName: lastOrder.customerName,
        customerPhone: lastOrder.customerPhone,
        items: lastOrder.items.map((item: CartItem) => ({
          name: item.saree.name,
          code: item.saree.code,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineAmount: item.lineAmount,
        })),
        subtotal: lastOrder.subtotal,
        discountAmount: lastOrder.discountAmount,
        taxAmount: lastOrder.taxAmount,
        totalAmount: lastOrder.totalAmount,
        paymentMode: lastOrder.paymentMode,
        createdAt: lastOrder.createdAt,
        store: {
          name: "MOHA WEAVES",
          address: "123 Fashion Street, Textile Market",
          phone: "+91 98765 43210",
          email: "info@mohaweaves.com"
        }
      };

      await generateInvoicePDF(invoiceData);
      toast({
        title: "Invoice Generated",
        description: "Invoice has been downloaded successfully",
      });
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({
        title: "Invoice Generation Failed",
        description: "Failed to generate invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const testInvoice = async () => {
    try {
      const success = await testInvoiceGeneration();
      if (success) {
        toast({
          title: "Test Invoice Generated",
          description: "Test invoice has been downloaded successfully",
        });
      }
    } catch (error) {
      console.error("Error generating test invoice:", error);
      toast({
        title: "Test Invoice Failed",
        description: "Failed to generate test invoice.",
        variant: "destructive",
      });
    }
  };

  const getPaymentIcon = (mode: string) => {
    switch (mode) {
      case "cash": return <Wallet className="h-4 w-4" />;
      case "card": return <CreditCard className="h-4 w-4" />;
      case "upi": return <Smartphone className="h-4 w-4" />;
      default: return <Wallet className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          <h1 className="text-xl font-bold">Shopping Cart</h1>
          <Badge variant="secondary">{cartItems.length} items</Badge>
        </div>
        
        {/* Development Test Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={testInvoice}
          className="text-xs"
        >
          <FileText className="h-4 w-4 mr-1" />
          Test Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Your cart is empty</h3>
                <p className="text-gray-500">Add items to get started</p>
              </CardContent>
            </Card>
          ) : (
            cartItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={item.saree.image}
                      alt={item.saree.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-sm ">{item.saree.name}</h3>
                      <p className="text-xs text-gray-500">{item.saree.code}</p>
                      <p className="font-sm text-green-600">{formatPrice(item.unitPrice)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatPrice(item.lineAmount)}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>

              {discount && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({discount.description})</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}

              {taxRules.map((tax, index) => (
                <div key={index} className="flex justify-between">
                  <span>{tax.name} ({tax.rate}%)</span>
                  <span>{formatPrice((tax.rate / 100) * discountedSubtotal)}</span>
                </div>
              ))}

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-green-600">{formatPrice(totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Discount Section */}
          <Card>
            <CardHeader>
              <CardTitle>Discount & Offers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {discount ? (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <div>
                    <p className="font-sm text-green-800">{discount.description}</p>
                    <p className="text-xs text-green-600">Saved: {formatPrice(discountAmount)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={removeDiscount}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && applyCoupon()}
                  />
                  <Button onClick={applyCoupon} disabled={applyCouponMutation.isPending}>
                    Apply
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { value: "cash", label: "Cash", icon: <Wallet className="h-4 w-4" /> },
                { value: "card", label: "Card", icon: <CreditCard className="h-4 w-4" /> },
                { value: "upi", label: "UPI/Digital Wallet", icon: <Smartphone className="h-4 w-4" /> },
              ].map((mode) => (
                <Button
                  key={mode.value}
                  variant={paymentMode === mode.value ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setPaymentMode(mode.value as any)}
                >
                  {mode.icon}
                  <span className="ml-2">{mode.label}</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">Phone Number *</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Checkout Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleCheckout}
            disabled={cartItems.length === 0 || checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? "Processing..." : `Complete Order ${formatPrice(totalAmount)}`}
          </Button>

          {/* Invoice Generation Button */}
          {lastOrder && (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={generateInvoice}
              disabled={!lastOrder}
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Invoice
            </Button>
          )}

          {/* Order Success Message */}
          {lastOrder && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-green-600 font-medium mb-2">
                    Order #{lastOrder.orderId} Completed Successfully!
                  </div>
                  <div className="text-sm text-gray-600">
                    Customer: {lastOrder.customerName}
                  </div>
                  <div className="text-sm text-gray-600">
                    Total: {formatPrice(lastOrder.totalAmount)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={generateInvoice}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Invoice
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
