import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, CreditCard, CheckCircle, MapPin, Plus, Check, AlertCircle, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { CartItemWithSaree, UserAddress, Coupon } from "@shared/schema";

const addressFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone must be a 10-digit number"),
  locality: z.string().min(5, "Locality must be at least 5 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  pincode: z.string().regex(/^[0-9]{6}$/, "Pincode must be a 6-digit number"),
});

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<{ available: boolean; message: string; deliveryDays?: number } | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");

  const [newAddress, setNewAddress] = useState({
    name: "",
    phone: "",
    locality: "",
    city: "",
    pincode: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: cartItems, isLoading } = useQuery<CartItemWithSaree[]>({
    queryKey: ["/api/user/cart"],
    enabled: !!user,
  });

  const { data: addresses, isLoading: loadingAddresses } = useQuery<UserAddress[]>({
    queryKey: ["/api/user/addresses"],
    enabled: !!user && user.role === "user",
  });

  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      const defaultAddress = addresses.find((a) => a.isDefault);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        checkPincodeForAddress(defaultAddress.pincode);
      } else {
        setSelectedAddressId(addresses[0].id);
        checkPincodeForAddress(addresses[0].pincode);
      }
    }
  }, [addresses]);

  const checkPincodeForAddress = async (pincode: string) => {
    if (pincode.length !== 6) {
      setPincodeStatus(null);
      return;
    }
    setCheckingPincode(true);
    try {
      const response = await fetch(`/api/pincodes/${pincode}/check`);
      const data = await response.json();
      setPincodeStatus({
        available: data.available,
        message: data.available
          ? `Delivery available in ${data.deliveryDays} days`
          : "Delivery not available in this area",
        deliveryDays: data.deliveryDays,
      });
    } catch {
      setPincodeStatus({ available: false, message: "Unable to check delivery availability" });
    } finally {
      setCheckingPincode(false);
    }
  };

  const createAddressMutation = useMutation({
    mutationFn: (data: typeof newAddress) => apiRequest("POST", "/api/user/addresses", data),
    onSuccess: async (response) => {
      const newAddr = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      setSelectedAddressId(newAddr.id);
      setShowNewAddressForm(false);
      setNewAddress({ name: "", phone: "", locality: "", city: "", pincode: "" });
      toast({ title: "Address added", description: "New address saved successfully" });
      checkPincodeForAddress(newAddr.pincode);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add address", variant: "destructive" });
    },
  });

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/user/coupons/validate", { code, orderAmount: subtotal });
      return response.json();
    },
    onSuccess: (data: { valid: boolean; coupon?: any; discountAmount?: string; message?: string }) => {
      if (data.valid && data.coupon) {
        setAppliedCoupon(data.coupon);
        setCouponError("");
        setCouponCode("");
        toast({ title: "Coupon applied!", description: `You saved ${formatPrice(parseFloat(data.discountAmount || "0"))}` });
      } else {
        setCouponError(data.message || "Invalid coupon");
      }
    },
    onError: (error: any) => {
      setCouponError(error.message || "Failed to validate coupon");
    },
  });

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const selectedAddress = addresses?.find((a) => a.id === selectedAddressId);
      if (!selectedAddress) {
        throw new Error("Please select a delivery address");
      }

      const shippingAddress = `${selectedAddress.name}\n${selectedAddress.phone}\n${selectedAddress.locality}\n${selectedAddress.city} - ${selectedAddress.pincode}`;

      const response = await apiRequest("POST", "/api/user/orders", {
        shippingAddress,
        phone: selectedAddress.phone,
        notes,
        couponId: appliedCoupon?.id,
      });
      return response.json();
    },
    onSuccess: (data: { orderId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
      setOrderId(data.orderId);
      setOrderSuccess(true);
    },
    onError: (error: Error) => {
      toast({ title: "Order failed", description: error.message || "Failed to place order.", variant: "destructive" });
    },
  });

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    setShowNewAddressForm(false);
    const address = addresses?.find((a) => a.id === addressId);
    if (address) {
      checkPincodeForAddress(address.pincode);
    }
  };

  const handleNewAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    const result = addressFormSchema.safeParse(newAddress);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFormErrors(errors);
      return;
    }
    
    createAddressMutation.mutate(newAddress);
  };

  const handlePlaceOrder = () => {
    if (!pincodeStatus?.available) {
      toast({
        title: "Delivery not available",
        description: "Please select an address with a serviceable pincode",
        variant: "destructive",
      });
      return;
    }
    placeOrderMutation.mutate();
  };

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Please login to checkout</h2>
        <Link to="/user/login">
          <Button data-testid="button-login">Login</Button>
        </Link>
      </div>
    );
  }

  if (isLoading || loadingAddresses) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid lg:grid-cols-2 gap-8">
          <Skeleton className="h-96" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
        <Link to="/sarees">
          <Button data-testid="button-shop">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-semibold mb-2" data-testid="text-order-success">Order Placed Successfully!</h2>
        <p className="text-muted-foreground mb-2">Thank you for shopping with Moha.</p>
        <p className="text-sm text-muted-foreground mb-6">
          Order ID: <span className="font-medium" data-testid="text-order-id">#{orderId.slice(0, 8).toUpperCase()}</span>
        </p>
        <div className="flex flex-col gap-3">
          <Link to={`/user/orders/${orderId}`}>
            <Button className="w-full" data-testid="button-view-order">View Order</Button>
          </Link>
          <Link to="/sarees">
            <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum, item) => {
    const price = typeof item.saree.price === "string" ? parseFloat(item.saree.price) : item.saree.price;
    return sum + price * item.quantity;
  }, 0);

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === "percentage") {
      const discountVal = (subtotal * parseFloat(appliedCoupon.value)) / 100;
      const maxDiscount = appliedCoupon.maxDiscount ? parseFloat(appliedCoupon.maxDiscount) : Infinity;
      return Math.min(discountVal, maxDiscount);
    }
    return parseFloat(appliedCoupon.value);
  };

  const discount = calculateDiscount();
  const shipping = subtotal >= 2999 ? 0 : 199;
  const total = subtotal - discount + shipping;

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }
    applyCouponMutation.mutate(couponCode.trim().toUpperCase());
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/user/cart">
        <Button variant="ghost" className="mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cart
        </Button>
      </Link>

      <h1 className="font-serif text-3xl font-semibold mb-8" data-testid="text-page-title">Checkout</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Shipping Address Selection */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Delivery Address</span>
                <Link to="/user/addresses">
                  <Button variant="ghost" size="sm" data-testid="link-manage-addresses">
                    Manage
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {addresses && addresses.length > 0 ? (
                <RadioGroup
                  value={selectedAddressId}
                  onValueChange={handleAddressSelect}
                  className="space-y-3"
                >
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedAddressId === address.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => handleAddressSelect(address.id)}
                      data-testid={`radio-address-${address.id}`}
                    >
                      <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{address.name}</span>
                          {address.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{address.phone}</p>
                        <p className="text-sm">
                          {address.locality}, {address.city} - {address.pincode}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              ) : !showNewAddressForm ? (
                <div className="text-center py-6">
                  <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">No saved addresses</p>
                  <p className="text-sm text-muted-foreground mb-4">Add an address to continue with your order</p>
                  <Button
                    onClick={() => setShowNewAddressForm(true)}
                    data-testid="button-add-first-address"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Delivery Address
                  </Button>
                </div>
              ) : null}

              {/* Add New Address Button/Form */}
              {!showNewAddressForm && addresses && addresses.length > 0 ? (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setShowNewAddressForm(true)}
                  data-testid="button-add-new-address"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Address
                </Button>
              ) : null}
              
              {showNewAddressForm && (
                <form onSubmit={handleNewAddressSubmit} className="mt-4 p-4 border rounded-lg space-y-4">
                  <h4 className="font-medium">New Delivery Address</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={newAddress.name}
                        onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                        className={formErrors.name ? "border-destructive" : ""}
                        data-testid="input-new-name"
                      />
                      {formErrors.name && (
                        <p className="text-xs text-destructive mt-1" data-testid="error-name">{formErrors.name}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone (10 digits)</Label>
                      <Input
                        id="phone"
                        type="tel"
                        maxLength={10}
                        value={newAddress.phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setNewAddress({ ...newAddress, phone: value });
                        }}
                        className={formErrors.phone ? "border-destructive" : ""}
                        data-testid="input-new-phone"
                      />
                      {formErrors.phone && (
                        <p className="text-xs text-destructive mt-1" data-testid="error-phone">{formErrors.phone}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="locality">Locality / Street</Label>
                    <Input
                      id="locality"
                      value={newAddress.locality}
                      onChange={(e) => setNewAddress({ ...newAddress, locality: e.target.value })}
                      className={formErrors.locality ? "border-destructive" : ""}
                      data-testid="input-new-locality"
                    />
                    {formErrors.locality && (
                      <p className="text-xs text-destructive mt-1" data-testid="error-locality">{formErrors.locality}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className={formErrors.city ? "border-destructive" : ""}
                        data-testid="input-new-city"
                      />
                      {formErrors.city && (
                        <p className="text-xs text-destructive mt-1" data-testid="error-city">{formErrors.city}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="pincode">Pincode (6 digits)</Label>
                      <Input
                        id="pincode"
                        maxLength={6}
                        value={newAddress.pincode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setNewAddress({ ...newAddress, pincode: value });
                        }}
                        className={formErrors.pincode ? "border-destructive" : ""}
                        data-testid="input-new-pincode"
                      />
                      {formErrors.pincode && (
                        <p className="text-xs text-destructive mt-1" data-testid="error-pincode">{formErrors.pincode}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowNewAddressForm(false);
                        setFormErrors({});
                      }}
                      data-testid="button-cancel-address"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createAddressMutation.isPending}
                      data-testid="button-save-new-address"
                    >
                      {createAddressMutation.isPending ? "Saving..." : "Save Address"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Pincode Status */}
              {selectedAddressId && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  {checkingPincode ? (
                    <p className="text-sm text-muted-foreground">Checking delivery availability...</p>
                  ) : pincodeStatus ? (
                    <div className={`flex items-center gap-2 text-sm ${pincodeStatus.available ? "text-green-600" : "text-destructive"}`}>
                      {pincodeStatus.available ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span data-testid="text-delivery-status">{pincodeStatus.message}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Order Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Any special instructions for delivery"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-notes"
              />
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-16 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&h=150&fit=crop"}
                        alt={item.saree.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">{item.saree.name}</h4>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      <p className="text-sm font-medium text-primary">{formatPrice(item.saree.price)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              {/* Coupon Section */}
              <div className="mb-4">
                <Label className="text-sm font-medium mb-2 block">Have a coupon?</Label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-600">{appliedCoupon.code}</span>
                      <Badge variant="secondary" className="text-xs">
                        {appliedCoupon.type === "percentage" 
                          ? `${appliedCoupon.value}% off` 
                          : `₹${appliedCoupon.value} off`}
                      </Badge>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleRemoveCoupon}
                      className="h-8 w-8"
                      data-testid="button-remove-coupon"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponError("");
                        }}
                        className={couponError ? "border-destructive" : ""}
                        data-testid="input-coupon-code"
                      />
                      <Button 
                        variant="outline" 
                        onClick={handleApplyCoupon}
                        disabled={applyCouponMutation.isPending}
                        data-testid="button-apply-coupon"
                      >
                        {applyCouponMutation.isPending ? "..." : "Apply"}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-destructive" data-testid="error-coupon">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {shipping === 0 ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      formatPrice(shipping)
                    )}
                  </span>
                </div>
                {pincodeStatus?.available && pincodeStatus.deliveryDays && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated Delivery</span>
                    <span>{pincodeStatus.deliveryDays} days</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span data-testid="text-total">{formatPrice(total)}</span>
              </div>

              <Button
                className="w-full mt-6"
                disabled={!selectedAddressId || !pincodeStatus?.available || placeOrderMutation.isPending}
                onClick={handlePlaceOrder}
                data-testid="button-place-order"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {placeOrderMutation.isPending ? "Placing Order..." : `Pay ${formatPrice(total)}`}
              </Button>

              {!pincodeStatus?.available && selectedAddressId && (
                <p className="text-sm text-destructive text-center mt-2">
                  Delivery is not available to the selected address
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
