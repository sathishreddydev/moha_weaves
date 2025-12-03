import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WishlistItemWithSaree } from "@shared/schema";

export default function Wishlist() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wishlistItems, isLoading } = useQuery<WishlistItemWithSaree[]>({
    queryKey: ["/api/user/wishlist"],
    enabled: !!user,
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: (sareeId: string) => apiRequest("DELETE", `/api/user/wishlist/${sareeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/wishlist/count"] });
      toast({ title: "Removed", description: "Item removed from wishlist." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove item.", variant: "destructive" });
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: (sareeId: string) => apiRequest("POST", "/api/user/cart", { sareeId, quantity: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart/count"] });
      toast({ title: "Added to cart", description: "Item added to your cart." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add to cart.", variant: "destructive" });
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
        <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Your wishlist is waiting</h2>
        <p className="text-muted-foreground mb-6">Please login to view your wishlist.</p>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!wishlistItems || wishlistItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Your wishlist is empty</h2>
        <p className="text-muted-foreground mb-6">Start adding items you love to your wishlist.</p>
        <Link to="/sarees">
          <Button data-testid="button-shop">Browse Sarees</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-serif text-3xl font-semibold mb-8" data-testid="text-page-title">
        My Wishlist ({wishlistItems.length} items)
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {wishlistItems.map((item) => {
          const saree = item.saree;
          const isOnlineAvailable = saree.distributionChannel === "online" || saree.distributionChannel === "both";
          const hasStock = saree.onlineStock > 0;

          return (
            <Card key={item.id} className="group overflow-visible border-0 shadow-none bg-transparent" data-testid={`card-wishlist-item-${item.id}`}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted">
                <Link to={`/sarees/${saree.id}`}>
                  <img
                    src={saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=600&fit=crop"}
                    alt={saree.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </Link>

                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm"
                  onClick={() => removeFromWishlistMutation.mutate(saree.id)}
                  disabled={removeFromWishlistMutation.isPending}
                  data-testid={`button-remove-${item.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>

                {isOnlineAvailable && hasStock && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      className="w-full"
                      onClick={() => addToCartMutation.mutate(saree.id)}
                      disabled={addToCartMutation.isPending}
                      data-testid={`button-add-cart-${item.id}`}
                    >
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Add to Cart
                    </Button>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-1">
                <Link to={`/sarees/${saree.id}`}>
                  <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors">
                    {saree.name}
                  </h3>
                </Link>
                <div className="flex items-center gap-2">
                  {saree.category && (
                    <span className="text-xs text-muted-foreground">{saree.category.name}</span>
                  )}
                </div>
                <p className="font-semibold text-primary">{formatPrice(saree.price)}</p>
                {!hasStock && isOnlineAvailable && (
                  <p className="text-xs text-muted-foreground">Out of Stock</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
