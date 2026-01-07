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
  Tag,
  X,
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
    price?: string;
    activeSale?: {
      id: string;
      name: string;
      offerType: string;
      discountValue: string;
      maxDiscount?: string;
    } | null;
    discountedPrice?: number;
  };
}
interface Discount {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  type: "percentage" | "fixed" | "coupon";
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  categoryId: string | null;
  createdAt: string;
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
    { name: "GST", rate: 0, type: "percentage" },
    { name: "Service Charge", rate: 10, type: "percentage" },
  ]);
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "upi">(
    "cash",
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [disabledCompBtn, setDisabledCompBtn] = useState(false);
  const [loyaltyData, setLoyaltyData] = useState<any>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
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
        description: `${data.discount.name} - ${formatPrice(data.discount.value)}`,
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
  
  // Calculate loyalty points discount
  const discountedSubtotal = subtotal - discountAmount;
  const loyaltyDiscount = redeemPoints && loyaltyData ? Math.min(loyaltyData.redeemableValue, discountedSubtotal) : 0;
  const finalDiscountedSubtotal = subtotal - discountAmount - loyaltyDiscount;
  
  const taxAmount = taxRules.reduce((sum, tax) => {
    return (
      sum +
      (tax.type === "percentage"
        ? (tax.rate / 100) * finalDiscountedSubtotal
        : tax.rate)
    );
  }, 0);
  const totalAmount = finalDiscountedSubtotal + taxAmount;

  const handlePaginationChange = (pageIndex: number, pageSize: number) => {
    setPagination({ pageIndex, pageSize });
  };
  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setDiscount(null);
    setPaymentMode("cash");
    setCouponCode("");
  };
  const validatePhone = (phone: string) => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
  };

  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, "");
    setCustomerPhone(numericValue);
    
    // Validate if exactly 10 digits
    if (numericValue.length > 0 && numericValue.length !== 10) {
      setPhoneError("Phone number must be exactly 10 digits");
      setLoyaltyData(null);
      setRedeemPoints(false);
    } else if (numericValue.length === 10) {
      setPhoneError("");
      // Fetch loyalty points when phone is valid
      await fetchLoyaltyPoints(numericValue);
    } else {
      setPhoneError("");
      setLoyaltyData(null);
      setRedeemPoints(false);
    }
  };

  const fetchLoyaltyPoints = async (phone: string) => {
    try {
      setLoyaltyLoading(true);
      const res = await apiRequest("GET", `/api/store_customers/${phone}/loyalty-points`);
      const data = await res.json();
      setLoyaltyData(data);
    } catch (error) {
      console.error("Error fetching loyalty points:", error);
      setLoyaltyData(null);
    } finally {
      setLoyaltyLoading(false);
    }
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

    if (!validatePhone(customerPhone)) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be exactly 10 digits",
        variant: "destructive",
      });
      return;
    }

    // Calculate loyalty points to redeem
    let pointsToRedeem = 0;
    if (redeemPoints && loyaltyData && loyaltyData.loyaltyPoints > 0) {
      // Maximum points that can be used based on order total (1 point = ₹0.05)
      const maxPointsForOrder = Math.ceil(totalAmount / 0.05);
      pointsToRedeem = Math.min(loyaltyData.loyaltyPoints, maxPointsForOrder);
    }

    setDisabledCompBtn(true);

    try {
      const res = await apiRequest("POST", "/api/store/checkout", {
        items: cartItems,
        discount,
        loyaltyDiscount: pointsToRedeem > 0 ? {
          pointsRedeemed: pointsToRedeem,
          discountValue: pointsToRedeem * 0.05 // 100 points = ₹5, so 1 point = ₹0.05
        } : null,
        tax: taxAmount,
        total: totalAmount,
        paymentMode,
        customerName,
        customerPhone,
      });
      const data = await res.json();

      toast({
        title: "Order Completed",
        description: `Order #${data.orderId} completed successfully${data.pointsRedeemed ? ` - ${data.pointsRedeemed} points redeemed` : ''}`,
      });

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/store/products"] }),
        queryClient.refetchQueries({
          queryKey: ["/api/store/products/paginated"],
        }),
        queryClient.refetchQueries({
          queryKey: ["/api/store/sales/paginated"],
        }),
        queryClient.refetchQueries({ queryKey: ["/api/store/sales/recent"] }),
        queryClient.refetchQueries({ queryKey: ["/api/store/stats"] }),
      ]);

      clearCart();
      resetForm();
      setLoyaltyData(null);
      setRedeemPoints(false);
      setDisabledCompBtn(false);
      navigate(`/store/invoice/${data.orderId}`);
    } catch (err: any) {
      setDisabledCompBtn(false);
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
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            {item.saree.activeSale && item.saree.discountedPrice ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">
                  {formatPrice(item.saree.discountedPrice)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(item.saree.price || "0")}
                </span>
              </div>
            ) : (
              <span>{formatPrice(item.unitPrice)}</span>
            )}
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
          <div>
            {item.saree.activeSale && item.saree.discountedPrice ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">
                  {formatPrice(item.saree.discountedPrice * item.quantity)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(
                    parseFloat(item.saree.price || "0") * item.quantity,
                  )}
                </span>
              </div>
            ) : (
              <span>{formatPrice(item.lineAmount)}</span>
            )}
          </div>
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

      {cartItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No items in cart</h2>
          <p className="text-muted-foreground mb-6">
            Add items to cart to continue with checkout.
          </p>
          <Button
            onClick={() => navigate("/store/sale")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Items to Cart
          </Button>
        </div>
      ) : (
        <>
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
                <div className="w-full md:flex-1">
                <Input
                  placeholder="Customer Phone"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  className={`${phoneError ? "border-red-500" : ""}`}
                  required
                  maxLength={10}
                />
                {phoneError && (
                  <p className="text-red-500 text-xs mt-1">{phoneError}</p>
                )}
                {loyaltyData && loyaltyData.exists && loyaltyData.loyaltyPoints > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={redeemPoints}
                          onChange={(e) => setRedeemPoints(e.target.checked)}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-amber-800">
                          Redeem Loyalty Points ({loyaltyData.loyaltyPoints} points = ₹{loyaltyData.redeemableValue})
                        </span>
                      </label>
                    </div>
                    {redeemPoints && (
                      <p className="text-xs text-amber-600 mt-1">
                        You'll use {Math.min(loyaltyData.loyaltyPoints, Math.ceil(totalAmount / 0.05))} points for ₹{Math.min(loyaltyData.redeemableValue, totalAmount)} discount
                      </p>
                    )}
                  </div>
                )}
                {loyaltyLoading && (
                  <p className="text-xs text-gray-500 mt-1">Checking loyalty points...</p>
                )}
              </div>
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
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                      <span>
                        Coupon applied: {discount?.name} (-₹
                        {discountAmount?.toLocaleString()})
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setDiscount(null);
                          toast({
                            title: "Coupon Removed",
                            description: "Coupon has been removed from cart",
                          });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
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
                <span>₹{subtotal?.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Discount</span>
                <span>-₹{discountAmount?.toLocaleString()}</span>
              </div>

              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-xs text-amber-600">
                  <span>Loyalty Points Discount</span>
                  <span>-₹{loyaltyDiscount?.toLocaleString()}</span>
                </div>
              )}

              {/* <div className="flex justify-between text-xs text-slate-600">
            <span>Tax</span>
            <span>
              ₹
              {taxAmount?.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div> */}

              <div className="pt-2 mt-1 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-bold">Total Amount</span>
                <span className="text-sm font-bold">
                  ₹{totalAmount?.toLocaleString()}
                </span>
              </div>

              <Button
                onClick={handleCheckout}
                className="w-full mt-4"
                disabled={!!phoneError || loading || disabledCompBtn}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Complete Checkout
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
