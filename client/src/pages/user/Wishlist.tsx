import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useCartStore } from "@/components/Store/useCartStore";
import { useWishlistStore } from "@/components/Store/useWishlistStore";
import { ProductCard } from "@/components/product/ProductCard";

export default function Wishlist() {
  const { user } = useAuth();
  const isLoadingCart = useCartStore((state) => state.isLoadingCart);
  const addCartItem = useCartStore((state) => state.addItem);
  const wishlistItems = useWishlistStore((state) => state.wishlist);
  const isLoadingWishlist = useWishlistStore(
    (state) => state.isLoadingWishlist
  );
  const removeWishlistItem = useWishlistStore((state) => state.removeItem);
  const isRemovingWishlistItem = useWishlistStore(
    (state) => state.isRemovingItem
  );
  console.log(wishlistItems);

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
        <h2 className="text-2xl font-semibold mb-2">
          Your wishlist is waiting
        </h2>
        <p className="text-muted-foreground mb-6">
          Please login to view your wishlist.
        </p>
        <Link to="/user/login">
          <Button data-testid="button-login">Login</Button>
        </Link>
      </div>
    );
  }

  if (isLoadingWishlist) {
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
        <p className="text-muted-foreground mb-6">
          Start adding items you love to your wishlist.
        </p>
        <Link to="/sarees">
          <Button data-testid="button-shop">Browse Sarees</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1
        className="font-serif text-xl font-semibold mb-8"
        data-testid="text-page-title"
      >
        My Wishlist ({wishlistItems.length} items)
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {wishlistItems.map((item) => (
          <ProductCard key={item.id} saree={item.saree} />
        ))}
      </div>
    </div>
  );
}
