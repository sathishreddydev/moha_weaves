import { Link, useNavigate } from "react-router-dom";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CartItemWithSaree } from "@shared/schema";

export default function Cart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cartItems, isLoading } = useQuery<CartItemWithSaree[]>({
    queryKey: ["/api/user/cart"],
    enabled: !!user,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      apiRequest("PATCH", `/api/user/cart/${id}`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart/count"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update quantity.", variant: "destructive" });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/user/cart/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart/count"] });
      toast({ title: "Removed", description: "Item removed from cart." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove item.", variant: "destructive" });
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

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Your cart is waiting</h2>
        <p className="text-muted-foreground mb-6">Please login to view your cart.</p>
        <Link to="/user/login">
          <Button data-testid="button-login">Login</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
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
        <p className="text-muted-foreground mb-6">Start shopping to add items to your cart.</p>
        <Link to="/sarees">
          <Button data-testid="button-shop">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Continue Shopping
          </Button>
        </Link>
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum, item) => {
    const price = typeof item.saree.price === "string" ? parseFloat(item.saree.price) : item.saree.price;
    return sum + price * item.quantity;
  }, 0);

  const shipping = subtotal >= 2999 ? 0 : 199;
  const total = subtotal + shipping;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-serif text-3xl font-semibold mb-8" data-testid="text-page-title">
        Shopping Cart ({cartItems.length} items)
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <Card key={item.id} className="p-4" data-testid={`card-cart-item-${item.id}`}>
              <div className="flex gap-4">
                <Link to={`/sarees/${item.saree.id}`}>
                  <div className="w-24 h-32 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200&h=300&fit=crop"}
                      alt={item.saree.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </Link>

                <div className="flex-1 min-w-0">
                  <Link to={`/sarees/${item.saree.id}`}>
                    <h3 className="font-medium hover:text-primary line-clamp-2" data-testid={`text-item-name-${item.id}`}>
                      {item.saree.name}
                    </h3>
                  </Link>
                  <div className="text-sm text-muted-foreground mt-1">
                    {item.saree.category?.name}
                    {item.saree.color && ` • ${item.saree.color.name}`}
                  </div>
                  <p className="font-semibold text-primary mt-2" data-testid={`text-item-price-${item.id}`}>
                    {formatPrice(item.saree.price)}
                  </p>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center border rounded-md">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateQuantityMutation.mutate({
                            id: item.id,
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                        disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                        data-testid={`button-quantity-minus-${item.id}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateQuantityMutation.mutate({
                            id: item.id,
                            quantity: item.quantity + 1,
                          })
                        }
                        disabled={item.quantity >= item.saree.onlineStock || updateQuantityMutation.isPending}
                        data-testid={`button-quantity-plus-${item.id}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeItemMutation.mutate(item.id)}
                      disabled={removeItemMutation.isPending}
                      data-testid={`button-remove-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div>
          <Card className="p-6 sticky top-24">
            <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span data-testid="text-subtotal">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span data-testid="text-shipping">
                  {shipping === 0 ? (
                    <span className="text-green-600">Free</span>
                  ) : (
                    formatPrice(shipping)
                  )}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-muted-foreground">
                  Add {formatPrice(2999 - subtotal)} more for free shipping
                </p>
              )}
            </div>

            <Separator className="my-4" />

            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span data-testid="text-total">{formatPrice(total)}</span>
            </div>

            <Button
              className="w-full mt-6"
              onClick={() => navigate("/user/checkout")}
              data-testid="button-checkout"
            >
              Proceed to Checkout
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <Link to="/sarees">
              <Button variant="ghost" className="w-full mt-2" data-testid="button-continue-shopping">
                Continue Shopping
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
