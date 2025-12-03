import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SareeWithDetails } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  saree: SareeWithDetails;
  isInWishlist?: boolean;
}

export function ProductCard({ saree, isInWishlist = false }: ProductCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addToCartMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/cart", { sareeId: saree.id, quantity: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cart/count"] });
      toast({ title: "Added to cart", description: `${saree.name} has been added to your cart.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add to cart.", variant: "destructive" });
    },
  });

  const toggleWishlistMutation = useMutation({
    mutationFn: () =>
      isInWishlist
        ? apiRequest("DELETE", `/api/user/wishlist/${saree.id}`)
        : apiRequest("POST", "/api/user/wishlist", { sareeId: saree.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/wishlist/count"] });
      toast({
        title: isInWishlist ? "Removed from wishlist" : "Added to wishlist",
        description: `${saree.name} has been ${isInWishlist ? "removed from" : "added to"} your wishlist.`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update wishlist.", variant: "destructive" });
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

  const isOnlineAvailable = saree.distributionChannel === "online" || saree.distributionChannel === "both";
  const hasStock = saree.onlineStock > 0;

  return (
    <Card className="group overflow-visible border-0 shadow-none bg-transparent" data-testid={`card-product-${saree.id}`}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted">
        {/* Product image */}
        <Link to={`/sarees/${saree.id}`}>
          <img
            src={saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=600&fit=crop"}
            alt={saree.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {saree.isFeatured && (
            <Badge variant="default" className="bg-primary text-primary-foreground">
              Featured
            </Badge>
          )}
          {!hasStock && isOnlineAvailable && (
            <Badge variant="secondary">Out of Stock</Badge>
          )}
        </div>

        {/* Quick actions */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {user && user.role === "user" && (
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm"
              onClick={() => toggleWishlistMutation.mutate()}
              disabled={toggleWishlistMutation.isPending}
              data-testid={`button-wishlist-${saree.id}`}
            >
              <Heart className={`h-4 w-4 ${isInWishlist ? "fill-primary text-primary" : ""}`} />
            </Button>
          )}
          <Link to={`/sarees/${saree.id}`}>
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm"
              data-testid={`button-view-${saree.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Add to cart overlay */}
        {user && user.role === "user" && hasStock && isOnlineAvailable && (
          <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              className="w-full"
              onClick={() => addToCartMutation.mutate()}
              disabled={addToCartMutation.isPending}
              data-testid={`button-add-cart-${saree.id}`}
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Add to Cart
            </Button>
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="pt-4 space-y-1">
        <Link to={`/sarees/${saree.id}`}>
          <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors" data-testid={`text-name-${saree.id}`}>
            {saree.name}
          </h3>
        </Link>
        <div className="flex items-center gap-2">
          {saree.category && (
            <span className="text-xs text-muted-foreground">{saree.category.name}</span>
          )}
          {saree.fabric && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{saree.fabric.name}</span>
            </>
          )}
        </div>
        <p className="font-semibold text-primary" data-testid={`text-price-${saree.id}`}>
          {formatPrice(saree.price)}
        </p>
        {saree.color && (
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border"
              style={{ backgroundColor: saree.color.hexCode }}
            />
            <span className="text-xs text-muted-foreground">{saree.color.name}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
