import React from "react";
import { useAddressStore } from "@/components/Store/useAddressesStore";
import { useCartStore } from "@/components/Store/useCartStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { Coupon } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CreditCard,
  MapPin,
  Plus,
  ShoppingBag,
  Tag,
  Truck,
  X,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import OrderSuccess from "./OrderSuccess";

// 🆕 Address validation interface
interface AddressForValidation {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

interface AddressValidationResult {
  isValid: boolean;
  isServiceable: boolean;
  originalAddress?: AddressForValidation;
  suggestedAddress?: AddressForValidation;
  requiresCustomerConfirmation?: boolean;
  validationErrors?: string[];
  serviceabilityDetails?: {
    prepaid: boolean;
    cod: boolean;
    city: string;
    state: string;
    country: string;
  };
}

interface ShippingEstimate {
  canShip: boolean;
  estimatedCost: number;
  estimatedDays: number;
  availableCouriers: string[];
}

const addressFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .regex(
      /^(\+91[\-\s]?)?[6-9]\d{9}$/,
      "Enter a valid 10-digit Indian mobile number"
    ),
  addressLine1: z.string().min(5, "Address line 1 must be at least 5 characters"),
  locality: z.string().min(2, "Locality must be at least 2 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
});

export default function Checkout() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [, setCheckingPincode] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [addressValidation, setAddressValidation] = useState<AddressValidationResult | null>(null);
  const [shippingEstimate, setShippingEstimate] = useState<ShippingEstimate | null>(null);

  const [newAddress, setNewAddress] = useState({
    name: "",
    phone: "",
    addressLine1: "",
    locality: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [checkoutPincodeInfo, setCheckoutPincodeInfo] = useState<{
    available: boolean;
    city?: string;
    state?: string;
    deliveryDays?: number;
    message?: string;
  } | null>(null);
  const [checkoutPincodeLoading, setCheckoutPincodeLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const cartItems = useCartStore((state) => state.cart);
  const isLoadingCart = useCartStore((state) => state.isLoadingCart);
  const clearCart = useCartStore((state) => state.clearCart);
  const addresses = useAddressStore((state) => state.addresses);
  const addAddressLoading = useAddressStore((state) => state.addLoading);
  const getAddresses = useAddressStore((state) => state.fetchAddresses);
  const createNewAddresses = useAddressStore((state) => state.addAddress);

  useEffect(() => {
    if (user && user.role === "user" && addresses.length === 0) {
      getAddresses();
    }
  }, [user]);

  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      const defaultAddress = addresses.find((a) => a.isDefault);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else {
        setSelectedAddressId(addresses[0].id);
      }
    }
  }, [addresses]);

  // 🆕 Address validation function
  const validateAddress = async (address: AddressForValidation) => {
    try {
      const validation = await apiRequest(
        "POST", 
        "/api/shipping/validate-address", 
        address
      ) as AddressValidationResult;
      
      setAddressValidation(validation);
      
      if (validation.suggestedAddress) {
        toast({
          title: "Address Suggestion",
          description: "We've suggested a better address format for faster delivery",
          variant: "default"
        });
      }
      
      // Get shipping estimate
      try {
        const estimate = await apiRequest(
          "POST", 
          "/api/shipping/estimate", 
          { address, method: "delhivery" }
        ) as ShippingEstimate;
        setShippingEstimate(estimate);
      } catch (error) {
        console.log("Shipping estimate failed:", error);
      }
      
    } catch (error) {
      toast({
        title: "Address Issue",
        description: "We couldn't validate this address. Please check and try again.",
        variant: "destructive"
      });
      setAddressValidation({ 
        isValid: false, 
        isServiceable: false, 
        validationErrors: ["Validation failed"] 
      });
    }
  };

  // Validate address when selected
  useEffect(() => {
    if (selectedAddressId && addresses.length > 0) {
      const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
      if (selectedAddress) {
        validateAddress({
          name: selectedAddress.name,
          addressLine1: selectedAddress.locality,
          city: selectedAddress.city,
          state: "", // Will be filled by validation
          pincode: selectedAddress.pincode,
          phone: selectedAddress.phone
        });
      }
    }
  }, [selectedAddressId, addresses]);

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/user/coupons/validate", {
        code,
        orderAmount: subtotal,
      });
      return response;
    },
    onSuccess: (data: {
      valid: boolean;
      coupon?: any;
      discountAmount?: string;
      message?: string;
    }) => {
      if (data.valid && data.coupon) {
        setAppliedCoupon(data.coupon);
        setCouponError("");
        setCouponCode("");
        toast({
          title: "Coupon applied!",
          description: `You saved ${formatPrice(
            parseFloat(data.discountAmount || "0")
          )}`,
        });
      } else {
        setCouponError(data.message || "Invalid coupon");
      }
    },
    onError: (error: any) => {
      setCouponError(error.message || "Failed to validate coupon");
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
  };

  const checkCheckoutPincode = async (pincode: string) => {
    setCheckoutPincodeLoading(true);
    setCheckoutPincodeInfo(null);
    try {
      const response = await apiRequest("GET", `/api/pincodes/${pincode}/check`);
      setCheckoutPincodeInfo(response);
      if (response.available) {
        setNewAddress((prev) => ({
          ...prev,
          city: response.city ?? prev.city,
          state: response.state ?? prev.state,
        }));
      }
    } catch {
      setCheckoutPincodeInfo({ available: false, message: "Could not check pincode" });
    } finally {
      setCheckoutPincodeLoading(false);
    }
  };

  const handleNewAddressSubmit = async (e: React.FormEvent) => {
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

    try {
      await createNewAddresses({ ...newAddress, userId: user!.id });
      setShowNewAddressForm(false);
      setNewAddress({
        name: "",
        phone: "",
        addressLine1: "",
        locality: "",
        city: "",
        state: "",
        pincode: "",
      });
      setCheckoutPincodeInfo(null);
    } catch {
      //
    }
  };

  const openRazorpayCheckout = ({
    razorpayOrderId,
    amount,
    currency,
    shippingAddress,
    phone,
    email, // 🆕 Add email parameter
    notes,
    couponId,
  }: {
    razorpayOrderId: string;
    amount: number;
    currency: string;
    shippingAddress: string;
    phone: string;
    email?: string; // 🆕 Make email optional
    notes: string;
    couponId?: string;
  }) => {
    const options = {
      key: "rzp_test_UxXBzl98ySixq7",
      amount: amount,
      currency: currency,
      name: "Moha Weaves",
      description: "Order Payment",
      order_id: razorpayOrderId,

      handler: async function (response: any) {
        const res = await apiRequest("POST", "/api/user/verify-payment", {
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
          shippingAddress: shippingAddress,
          phone: phone,
          email: email, // 🆕 Add email to verification
          notes: notes,
          couponId: couponId,
        });

        const data = res;

        toast({
          title: "Payment Success!",
          description: "Your order has been placed.",
        });

        // Update UI
        clearCart();
        queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });

        setOrderId(data.orderId);
        setOrderSuccess(true);
      },

      theme: {
        color: "#3399cc",
      },
    };

    const rzp = new (window as any).Razorpay(options);

    rzp.on("payment.failed", function () {
      toast({
        title: "Payment Failed",
        description: "Transaction was cancelled or failed",
        variant: "destructive",
      });
    });

    rzp.open();
  };

  const initiateRazorpayPayment = async () => {
    const selectedAddress = addresses?.find((a) => a.id === selectedAddressId);
    if (!selectedAddress) {
      toast({
        title: "No Address Selected",
        description: "Please select a delivery address",
        variant: "destructive",
      });
      return;
    }

    // 🆕 Check address validation before payment
    if (addressValidation && !addressValidation.isServiceable) {
      toast({
        title: "Delivery Not Available",
        description: "This address is not serviceable by our shipping partners",
        variant: "destructive",
      });
      return;
    }

    const shippingAddress = [
      selectedAddress.name,
      selectedAddress.phone,
      selectedAddress.addressLine1,
      selectedAddress.locality,
      `${selectedAddress.city}${selectedAddress.state ? `, ${selectedAddress.state}` : ""} - ${selectedAddress.pincode}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const razorpayOrder = await apiRequest("POST", "/api/user/create-razorpay-order", {
        couponId: appliedCoupon?.id,
      });

      openRazorpayCheckout({
        razorpayOrderId: razorpayOrder.razorpayOrderId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        shippingAddress,
        phone: selectedAddress.phone,
        email: user?.email, // 🆕 Add email for notifications
        notes,
        couponId: appliedCoupon?.id,
      });
    } catch (err: any) {
      toast({
        title: "Order Failed",
        description: err.message || "Failed to initiate Razorpay",
        variant: "destructive",
      });
    }
  };

  const handlePlaceOrder = () => {
    initiateRazorpayPayment();
  };

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">
          Please login to checkout
        </h2>
        <Link to="/user/login">
          <Button data-testid="button-login">Login</Button>
        </Link>
      </div>
    );
  }

  if (isLoadingCart) {
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
        <Link to="/products">
          <Button data-testid="button-shop">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  if (orderSuccess) {
    return <OrderSuccess orderId={orderId} />;
  }

  // Get variant info and pricing for cart item
  const getItemVariant = (item: any) => {
    if (item.variantId && item.product.variants) {
      return item.product.variants.find((v: any) => v.id === item.variantId);
    }
    return null;
  };

  const getItemPrice = (item: any) => {
    const variant = getItemVariant(item);
    const basePrice = variant?.price || item.product.price;
    
    if (item.product.activeSale && item.product.discountedPrice) {
      // Calculate discount for variant price
      const discountRatio = parseFloat(item.product.discountedPrice.toString()) / parseFloat(item.product.price.toString());
      return basePrice * discountRatio;
    }
    return basePrice;
  };

  const subtotal = cartItems.reduce((sum, item) => {
    const itemPrice = getItemPrice(item);
    return sum + itemPrice * item.quantity;
  }, 0);

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === "percentage") {
      const discountVal = (subtotal * parseFloat(appliedCoupon.value)) / 100;
      const maxDiscount = appliedCoupon.maxDiscount
        ? parseFloat(appliedCoupon.maxDiscount)
        : Infinity;
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
  console.log(selectedAddressId);
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/user/cart">
        <Button variant="ghost" className="mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cart
        </Button>
      </Link>

      <h1
        className="font-serif text-xl font-semibold mb-8"
        data-testid="text-page-title"
      >
        Checkout
      </h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Shipping Address Selection */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Delivery Address</span>
                <Link to="/user/addresses">
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="link-manage-addresses"
                  >
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
                      <RadioGroupItem
                        value={address.id}
                        id={address.id}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{address.name}</span>
                          {address.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {address.phone}
                        </p>
                        <p className="text-sm">
                          {address.addressLine1 ? `${address.addressLine1}, ` : ""}
                          {address.locality}, {address.city}
                          {address.state ? `, ${address.state}` : ""} — {address.pincode}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              ) : !showNewAddressForm ? (
                <div className="text-center py-6">
                  <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">
                    No saved addresses
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add an address to continue with your order
                  </p>
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
                <form
                  onSubmit={handleNewAddressSubmit}
                  className="mt-4 p-4 border rounded-lg space-y-4"
                >
                  <h4 className="font-medium">New Delivery Address</h4>
                  {/* Name + Phone side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={newAddress.name}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, name: e.target.value })
                        }
                        className={formErrors.name ? "border-destructive" : ""}
                        data-testid="input-new-name"
                      />
                      {formErrors.name && (
                        <p className="text-xs text-destructive mt-1" data-testid="error-name">
                          {formErrors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        maxLength={10}
                        placeholder="Starts with 6–9"
                        value={newAddress.phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setNewAddress({ ...newAddress, phone: value });
                        }}
                        className={formErrors.phone ? "border-destructive" : ""}
                        data-testid="input-new-phone"
                      />
                      {formErrors.phone && (
                        <p className="text-xs text-destructive mt-1" data-testid="error-phone">
                          {formErrors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Address Line 1 */}
                  <div>
                    <Label htmlFor="addressLine1">Address Line 1</Label>
                    <Input
                      id="addressLine1"
                      placeholder="House no., Building, Street"
                      value={newAddress.addressLine1}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, addressLine1: e.target.value })
                      }
                      className={formErrors.addressLine1 ? "border-destructive" : ""}
                      data-testid="input-new-addressLine1"
                    />
                    {formErrors.addressLine1 && (
                      <p className="text-xs text-destructive mt-1">{formErrors.addressLine1}</p>
                    )}
                  </div>

                  {/* Locality */}
                  <div>
                    <Label htmlFor="locality">Locality / Area</Label>
                    <Input
                      id="locality"
                      placeholder="Locality / Colony / Area"
                      value={newAddress.locality}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, locality: e.target.value })
                      }
                      className={formErrors.locality ? "border-destructive" : ""}
                      data-testid="input-new-locality"
                    />
                    {formErrors.locality && (
                      <p className="text-xs text-destructive mt-1" data-testid="error-locality">
                        {formErrors.locality}
                      </p>
                    )}
                  </div>

                  {/* Pincode — auto-fills city + state */}
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      maxLength={6}
                      placeholder="6-digit pincode"
                      value={newAddress.pincode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        setNewAddress({ ...newAddress, pincode: value });
                        if (value.length === 6) checkCheckoutPincode(value);
                      }}
                      className={
                        formErrors.pincode || (checkoutPincodeInfo && !checkoutPincodeInfo.available)
                          ? "border-destructive"
                          : ""
                      }
                      data-testid="input-new-pincode"
                    />
                    {checkoutPincodeLoading && (
                      <p className="text-xs text-muted-foreground mt-1">Checking availability...</p>
                    )}
                    {checkoutPincodeInfo && (
                      <p className={`text-xs mt-1 ${checkoutPincodeInfo.available ? "text-green-600" : "text-destructive"}`}>
                        {checkoutPincodeInfo.available
                          ? `✓ Delivery available — ${checkoutPincodeInfo.city}, ${checkoutPincodeInfo.state}`
                          : `✗ ${checkoutPincodeInfo.message ?? "Delivery not available"}`}
                      </p>
                    )}
                    {formErrors.pincode && (
                      <p className="text-xs text-destructive mt-1" data-testid="error-pincode">
                        {formErrors.pincode}
                      </p>
                    )}
                  </div>

                  {/* City + State — auto-filled, disabled */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={newAddress.city}
                        placeholder="Auto-filled"
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                        data-testid="input-new-city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={newAddress.state}
                        placeholder="Auto-filled"
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                        data-testid="input-new-state"
                      />
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
                      disabled={addAddressLoading}
                      data-testid="button-save-new-address"
                    >
                      {addAddressLoading ? "Saving..." : "Save Address"}
                    </Button>
                  </div>
                </form>
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

          {/* 🆕 Shipping Validation */}
          {addressValidation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Shipping Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {addressValidation.isServiceable ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">Delivery Available</p>
                        <p className="text-sm text-green-600">
                          Your address is serviceable by Delhivery Express
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="font-medium text-red-800">Delivery Not Available</p>
                        <p className="text-sm text-red-600">
                          This address is not serviceable by our shipping partners
                        </p>
                      </div>
                    </div>
                  )}

                  {shippingEstimate && shippingEstimate.canShip && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-800">Estimated Delivery</p>
                          <p className="text-sm text-blue-600">
                            {shippingEstimate.estimatedDays} business days
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-blue-800">Shipping Cost</p>
                          <p className="text-sm text-blue-600">
                            {formatPrice(shippingEstimate.estimatedCost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {addressValidation.suggestedAddress && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="font-medium text-yellow-800 mb-2">Address Suggestion</p>
                      <p className="text-sm text-yellow-700">
                        We've suggested an optimized address format for faster delivery:
                      </p>
                      <div className="mt-2 p-2 bg-white rounded border text-sm">
                        <p>{addressValidation.suggestedAddress.name}</p>
                        <p>{addressValidation.suggestedAddress.addressLine1}</p>
                        <p>
                          {addressValidation.suggestedAddress.city}, {addressValidation.suggestedAddress.state} - {addressValidation.suggestedAddress.pincode}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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
                        src={
                          item.product.imageUrl ||
                          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&h=150&fit=crop"
                        }
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">
                        {item.product.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                        {(() => {
                          const variant = getItemVariant(item);
                          return variant ? ` • Size: ${variant.size}` : '';
                        })()}
                      </p>
                      <div className="mt-2">
                        {(() => {
                          const itemPrice = getItemPrice(item);
                          const originalPrice = getItemVariant(item)?.price || item.product.price;
                          const hasDiscount = item.product.activeSale && item.product.discountedPrice && itemPrice < originalPrice;
                          
                          return hasDiscount ? (
                            <div className="flex items-center gap-2">
                              <p
                                className="font-semibold text-primary"
                                data-testid={`text-item-price-${item.id}`}
                              >
                                {formatPrice(itemPrice)}
                              </p>
                              <p className="text-xs text-muted-foreground line-through">
                                {formatPrice(originalPrice)}
                              </p>
                            </div>
                          ) : (
                            <p
                              className="font-semibold text-primary"
                              data-testid={`text-item-price-${item.id}`}
                            >
                              {formatPrice(itemPrice)}
                            </p>
                          );
                        })()}
                      </div>{" "}
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              {/* Coupon Section */}
              <div className="mb-4">
                <Label className="text-sm font-medium mb-2 block">
                  Have a coupon?
                </Label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-600">
                        {appliedCoupon.code}
                      </span>
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
                      <p
                        className="text-xs text-destructive"
                        data-testid="error-coupon"
                      >
                        {couponError}
                      </p>
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
                
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span data-testid="text-total">{formatPrice(total)}</span>
              </div>

              <Button
                className="w-full mt-6"
                disabled={!selectedAddressId}
                onClick={handlePlaceOrder}
                data-testid="button-place-order"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {`Pay ${formatPrice(total)}`}
              </Button>

             
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
