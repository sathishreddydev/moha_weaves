import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Loader2, ShoppingBag } from "lucide-react";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

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

  const updateQuantity = (itemId: string, newQuantity: number, sareeId: string) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId, sareeId);
      return;
    }

    const updatedItems = cartItems.map(item =>
      item.id === itemId
        ? {
          ...item,
          quantity: newQuantity,
          lineAmount: newQuantity * item.unitPrice
        }
        : item
    );
    setCartItems(updatedItems);
    updateCartMutation.mutate({ items: updatedItems });
  };
  // Delete cart item mutation
  const deleteCartMutation = useMutation({
    mutationFn: async (sareeId: string) => {
      const res = await apiRequest("DELETE", `/api/store/cart/${sareeId}`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/cart"] });
      toast({
        title: "Item removed",
        description: data.message || "Item removed from cart successfully",
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

  const removeFromCart = (itemId: string, sareeId: string) => {
    const updatedItems = cartItems.filter(item => item.id !== itemId);
    setCartItems(updatedItems);
    deleteCartMutation.mutate(sareeId);
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

  const columns: ColumnDef<CartItem>[] = [
    {
      accessorKey: "saree.code",
      header: "Item Code",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="text-sm font-medium text-slate-700">
            {item.saree?.code || item.sareeId}
          </span>
        );
      },
    },
    {
      accessorKey: "saree.name",
      header: "Description",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="text-sm text-slate-600">
            {item.saree?.name || 'Product'}
          </span>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateQuantity(item.id, item.quantity - 1, item.sareeId)}
              disabled={item.quantity <= 1}
              className="h-6 w-6"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-xs text-center">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateQuantity(item.id, item.quantity + 1, item.sareeId)}
              className="h-6 w-6"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: "unitPrice",
      header: "Price",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end">
            <span className="text-xs text-slate-400 mr-1">₹</span>
            {item.unitPrice}
          </div>
        );
      },
    },
    {
      accessorKey: "lineAmount",
      header: "Total",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="text-sm font-semibold text-slate-800">
            ₹{item.lineAmount}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Button
            onClick={() => removeFromCart(item.id, item.sareeId)}
            variant="ghost"
            size="sm"
            className="text-red-600 h-6 w-6 p-0"
          >
            <Trash2 size={14} />
          </Button>
        );
      },
    },
  ];

  const handlePaginationChange = (pageIndex: number, pageSize: number) => {
    setPagination({ pageIndex, pageSize });
  };

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
    <div className="max-w-6xl mx-auto">

      <div className="mb-6 flex justify-between items-center print:hidden">
        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart />
          Cart
        </h1>
      </div>

      <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200 print:shadow-none print:border-none">
        <div className="p-8">
          <div className="flex justify-end">
            <Button
              onClick={() => { navigate('/store/sale') }}
              disabled={applyCouponMutation.isPending}
              variant="outline"
            >
              <Plus /> Add Item
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={cartItems}
            totalCount={cartItems.length}
            pageSize={pagination.pageSize}
            pageIndex={pagination.pageIndex}
            onPaginationChange={handlePaginationChange}
            isLoading={isLoading}
            emptyMessage="No items in cart"
          />



          <div className="mt-12 flex flex-col md:flex-row justify-between gap-8 border-t border-slate-100 pt-8">

            <div className="flex-1 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2">Customer Information</h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full"
                  />
                  <Input
                    placeholder="Customer Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <CreditCard size={16} className="text-slate-400" />
                  Payment Mode
                </h4>
                <div className="flex gap-2">
                  {(['cash', 'card', 'upi'] as const).map((mode) => (
                    <Button
                      key={mode}
                      variant={paymentMode === mode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMode(mode)}
                      className="capitalize"
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2">Coupon Code</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={applyCoupon}
                    disabled={applyCouponMutation.isPending}
                    variant="outline"
                  >
                    {applyCouponMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
                {discount && (
                  <div className="mt-2 text-sm text-green-600">
                    Coupon applied: {discount.description} (-₹{discountAmount.toLocaleString()})
                  </div>
                )}
              </div>

              <Button
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending}
                className="w-full"
                size="lg"
              >
                {checkoutMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
                ) : (
                  <><ShoppingBag className="h-4 w-4 mr-2" /> Complete Checkout</>
                )}
              </Button>

              <div className="text-[11px] text-slate-500 leading-relaxed max-w-sm">
                <h4 className="font-bold text-slate-700 mb-1 uppercase tracking-tighter">Return Policy</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Items must be in unused condition with all tags attached.</li>
                  <li>Exchanges are subject to availability of stock.</li>
                  <li>No exchanges on customized orders.</li>
                  <li>Store management reserves the right to refuse exchanges that don't meet policy criteria.</li>
                </ul>
              </div>
            </div>

            <div className="w-full md:w-80 space-y-3 bg-slate-50 p-6 rounded-xl print:bg-white print:border print:border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3">Order Summary</h4>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-600 items-center">
                <span>Discount</span>
                <div className="flex items-center print:hidden">
                  <span className="text-xs mr-1">-₹</span>
                  {discountAmount.toLocaleString()}
                </div>
                <span className="hidden print:block">-₹{discountAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Tax (GST 18%)</span>
                <span>₹{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className="pt-2 mt-1 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-bold">Total Amount</span>
                <span className="text-sm font-bold">₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}
