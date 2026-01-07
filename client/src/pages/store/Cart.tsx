import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useStoreCart } from "./Hook/cartStore";
import { useAuth } from "@/lib/auth";

interface CartItem {
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const storeId = user?.storeId;
  const {
    items: cartItems,
    fetchCart,
    updateItems,
    deleteItem,
    loading,
    updateCartLoading,
    removeLoading,
    setStoreId,
    clearCart,
  } = useStoreCart();

  const [discount, setDiscount] = useState<Discount | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [taxRules] = useState<TaxRule[]>([
    { name: "GST", rate: 18, type: "percentage" },
    { name: "Service Charge", rate: 10, type: "percentage" },
  ]);
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "upi">(
    "cash",
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const disabledBtn = (sareeId: string) => {
    return loading || updateCartLoading[sareeId] || removeLoading[sareeId];
  };
  useEffect(() => {
    if (!storeId) return;
    setStoreId(storeId);
    if (cartItems.length === 0) fetchCart();
  }, []);

  const updateQuantity = (
    itemId: string,
    newQuantity: number,
    sareeId: string,
    storeStock: number,
  ) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId, sareeId);
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

    const updatedItems = cartItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            quantity: newQuantity,
            lineAmount: newQuantity * item.unitPrice,
          }
        : item,
    );

    updateItems(updatedItems, sareeId);
  };

  const removeFromCart = (itemId: string, sareeId: string) => {
    deleteItem(sareeId);
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "Invalid Coupon",
        description: "Please enter a coupon code",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await apiRequest("POST", "/api/store/apply-coupon", {
        code: couponCode,
      });
      const data = await res.json();
      setDiscount(data.discount);
      toast({
        title: "Coupon Applied",
        description: `${data.discount.description} - ${formatPrice(data.discount.value)}`,
      });
      setCouponCode("");
    } catch (err: any) {
      toast({
        title: "Invalid Coupon",
        description: err.message,
        variant: "destructive",
      });
    }
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
    return (
      sum +
      (tax.type === "percentage"
        ? (tax.rate / 100) * discountedSubtotal
        : tax.rate)
    );
  }, 0);
  const totalAmount = discountedSubtotal + taxAmount;

  const handlePaginationChange = (pageIndex: number, pageSize: number) => {
    setPagination({ pageIndex, pageSize });
  };
  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setDiscount(null);
    setPaymentMode("cash");
    setCouponCode('')
  };
  const handleCheckout = async () => {
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

      toast({
        title: "Order Completed",
        description: `Order #${data.orderId} completed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"]});
      queryClient.invalidateQueries({ queryKey: ["/api/store/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });

      clearCart();
      resetForm();
      navigate(`/store/invoice/${data.orderId}`);
    } catch (err: any) {
      toast({
        title: "Checkout Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const columns: ColumnDef<CartItem>[] = [
    {
      accessorKey: "saree.code",
      header: "Item Code",
      cell: ({ row }) => row.original.saree?.code || row.original.sareeId,
    },
    {
      accessorKey: "saree.name",
      header: "Description",
      cell: ({ row }) => row.original.saree?.name || "Product",
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
              onClick={() =>
                updateQuantity(
                  item.id,
                  item.quantity - 1,
                  item.sareeId,
                  item.storeStock,
                )
              }
              disabled={disabledBtn(item.sareeId) || item.quantity <= 1}
              className="h-6 w-6"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-xs text-center">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                updateQuantity(
                  item.id,
                  item.quantity + 1,
                  item.sareeId,
                  item.storeStock,
                )
              }
              disabled={
                disabledBtn(item.sareeId) || item.quantity >= item.storeStock
              }
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
      cell: ({ row }) => <span>₹{row.original.unitPrice}</span>,
    },
    {
      accessorKey: "lineAmount",
      header: "Total",
      cell: ({ row }) => <span>₹{row.original.lineAmount}</span>,
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
            disabled={disabledBtn(item.sareeId)}
          >
            <Trash2 size={14} />
          </Button>
        );
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart /> Cart
        </h1>
        <Button onClick={() => navigate("/store/sale")} variant="outline">
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
        emptyMessage="No items in cart"
      />

      <div className="flex mt-8 flex-col lg:flex-row gap-8">
        {/* Customer Info */}
        <div className="flex-1 space-y-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
            Customer Information
          </h4>

          <div className="flex flex-col md:flex-row gap-3">
            <Input
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full md:flex-1"
              required
            />

            <Input
              placeholder="Customer Phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full md:flex-1"
              required
            />
          </div>

          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            <div className="w-full md:w-1/2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 mt-2 flex items-center gap-2">
                <CreditCard size={16} className="text-slate-400" />
                Payment Mode
              </h4>

              <div className="flex flex-wrap gap-2">
                {(["cash", "card", "upi"] as const).map((mode) => (
                  <Button
                    key={mode}
                    variant={paymentMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPaymentMode(mode)}
                    className="capitalize flex-1 sm:flex-none"
                  >
                    {mode}
                  </Button>
                ))}
              </div>
            </div>

            <div className="w-full md:w-1/2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 mt-2">
                Coupon Code
              </h4>

              <div className="flex gap-2">
                <Input
                  className="w-3/4 sm:w-auto"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                />
                <Button onClick={applyCoupon} className="w-1/4 sm:w-auto">
                  Apply
                </Button>
              </div>

              {discount && (
                <div className="mt-2 text-sm text-green-600">
                  Coupon applied: {discount.description} (-₹
                  {discountAmount.toLocaleString()})
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
            Order Summary
          </h4>

          <div className="flex justify-between text-xs text-slate-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-xs text-slate-600">
            <span>Discount</span>
            <span>-₹{discountAmount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-xs text-slate-600">
            <span>Tax</span>
            <span>
              ₹
              {taxAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="pt-2 mt-1 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm font-bold">Total Amount</span>
            <span className="text-sm font-bold">
              ₹{totalAmount.toLocaleString()}
            </span>
          </div>

          <Button onClick={handleCheckout} className="w-full mt-4">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Complete Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
