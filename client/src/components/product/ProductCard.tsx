import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SareeWithDetails } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useCartStore } from "../Store/useCartStore";
import { useWishlistStore } from "../Store/useWishlistStore";

interface ProductCardProps {
  saree: SareeWithDetails;
}

export function ProductCard({ saree }: ProductCardProps) {
  const { user } = useAuth();

  const addItem = useCartStore((s) => s.addItem);
  const isAddingItem = useCartStore((s) => s.isAddingItem);

  const wishlist = useWishlistStore((s) => s.wishlist);
  const addWishlistItem = useWishlistStore((s) => s.addItem);
  const removeWishlistItem = useWishlistStore((s) => s.removeItem);
  const isAddingWishlistItem = useWishlistStore((s) => s.isAddingItem);

  const isInWishlist = wishlist?.some((item) => item.sareeId === saree.id);

  const formatPrice = (price: string | number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(typeof price === "string" ? Number(price) : price);

  const isOnlineAvailable =
    saree.distributionChannel === "online" ||
    saree.distributionChannel === "both";

  const hasStock = saree.onlineStock > 0;

  return (
    <Card className="group border-0 shadow-none bg-transparent">
      {/* IMAGE */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted">
        <Link to={`/sarees/${saree.id}`}>
          <img
            src={saree.imageUrl || ""}
            alt={saree.name}
            className="w-full h-full object-cover transition-transform duration-500 md:group-hover:scale-105"
          />
        </Link>

        {/* BADGES */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {saree.activeSale && (
            <Badge className="bg-red-500 text-white">
              {`${Math.round(parseFloat(saree.activeSale.discountValue))}% OFF`}
            </Badge>
          )}
          {saree.isFeatured && (
            <Badge className="bg-primary text-primary-foreground">
              Featured
            </Badge>
          )}
        </div>

        <div
          className="
    absolute top-2 right-2 hidden md:flex flex-col gap-2
    opacity-0 md:group-hover:opacity-100
    transition-opacity
          "
        >
          {user?.role === "user" && (
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-full bg-background/90 backdrop-blur-sm"
              onClick={() =>
                isInWishlist
                  ? removeWishlistItem(saree.id)
                  : addWishlistItem(saree.id)
              }
              disabled={isAddingWishlistItem}
            >
              <Heart
                className={`h-3 w-3 ${
                  isInWishlist ? "fill-primary text-primary" : ""
                }`}
              />
            </Button>
          )}

          <Link to={`/sarees/${saree.id}`}>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-full bg-background/90 backdrop-blur-sm"
            >
              <Eye className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {/* ADD TO CART */}
        {user?.role === "user" && isOnlineAvailable && (
          <div
            className="
              absolute bottom-0 left-0 right-0 p-2
              opacity-100
              md:opacity-0
              md:group-hover:opacity-100
              transition-opacity
            "
          >
            {hasStock ? (
              <Button
                className="w-full"
                onClick={() => addItem(saree.id, 1)}
                disabled={isAddingItem}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
            ) : (
              <Button className="w-full bg-primary text-white">
                Out of Stock
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="pt-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/sarees/${saree.id}`} className="flex-1">
            <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors">
              {saree.name}
            </h3>
          </Link>

          {user?.role === "user" && (
            <button
              className="md:hidden shrink-0"
              onClick={() =>
                isInWishlist
                  ? removeWishlistItem(saree.id)
                  : addWishlistItem(saree.id)
              }
              disabled={isAddingWishlistItem}
            >
              <Heart
                className={`h-5 w-5 ${
                  isInWishlist
                    ? "fill-primary text-primary"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saree.activeSale && saree.discountedPrice ? (
            <>
              <p className="font-semibold text-primary">
                {formatPrice(saree.discountedPrice)}
              </p>
              <p className="text-sm text-muted-foreground line-through">
                {formatPrice(saree.price)}
              </p>
            </>
          ) : (
            <p className="font-semibold text-primary">
              {formatPrice(saree.price)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
