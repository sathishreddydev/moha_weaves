import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Eye, Minus, Plus } from "lucide-react";
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
  const {
    addItem,
    updateQuantity,
    cart: cartItems,
    isAddingItem,
    isUpdatingItem,
    isRemovingItem,
    isLoadingCart,
  } = useCartStore();

  const {
    wishlist,
    addItem: addWishlistItem,
    removeItem: removeWishlistItem,
    isAddingItem: isAddingWishlistItem,
  } = useWishlistStore();

  const isInCart = cartItems.some((i) => i.saree.id === saree.id);
  const cartItem = cartItems.find((i) => i.saree.id === saree.id);
  const isInWishlist = wishlist?.some((i) => i.sareeId === saree.id);

  const isOnlineAvailable =
    saree.distributionChannel === "online" ||
    saree.distributionChannel === "both";

  const hasStock = saree.onlineStock > 0;
  const disabledButton =
    isAddingItem[saree.id] ||
    isUpdatingItem[saree.id] ||
    isRemovingItem[saree.id] ||
    isLoadingCart;
  const formatPrice = (price: number | string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(price));

  const handleUpdateQuantity = (newQuantity: number) => {
    if (!cartItem) return;

    if (newQuantity <= 0 || cartItem.saree.onlineStock <= 0) {
      updateQuantity(cartItem.id, 0);
      return;
    }

    if (newQuantity > cartItem.saree.onlineStock) return;

    updateQuantity(cartItem.id, newQuantity);
  };

  return (
    <Card className="group border-0 shadow-none bg-transparent">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted">
        <Link to={`/sarees/${saree.id}`}>
          <img
            src={saree.imageUrl || ""}
            alt={saree.name}
            className="w-full h-full object-cover transition-transform duration-500 md:group-hover:scale-105"
          />
        </Link>

        {/* Badges */}
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

        <div className="absolute top-2 right-2 hidden md:flex flex-col gap-2 opacity-0 md:group-hover:opacity-100 transition-opacity">
          {user?.role === "user" && (
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-full bg-background/90"
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
              className="h-7 w-7 rounded-full bg-background/90"
            >
              <Eye className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {user?.role === "user" && isOnlineAvailable && (
          <div
            className="absolute bottom-3 right-3 z-10
              opacity-100 md:opacity-0 md:group-hover:opacity-100
              transition-opacity"
          >
            {isInCart && cartItem ? (
              <div className="flex items-center bg-primary rounded-md shadow">
                <Button
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleUpdateQuantity(cartItem.quantity - 1)}
                  disabled={disabledButton}
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <span className="w-8 text-center text-white text-sm">
                  {cartItem.quantity}
                </span>

                <Button
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleUpdateQuantity(cartItem.quantity + 1)}
                  disabled={
                    cartItem.quantity >= cartItem.saree.onlineStock ||
                    cartItem.saree.onlineStock === 0 ||
                    disabledButton
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="px-4 h-9 shadow"
                onClick={() => addItem(saree.id, 1)}
                disabled={!hasStock || disabledButton}
              >
                {hasStock ? (
                  <>
                    <ShoppingBag className="h-4 w-4 mr-1" />
                    Add
                  </>
                ) : (
                  "Out"
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="pt-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/sarees/${saree.id}`} className="flex-1">
            <h3 className="font-medium text-sm line-clamp-2 hover:text-primary">
              {saree.name}
            </h3>
          </Link>

          {/* Mobile Wishlist */}
          {user?.role === "user" && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 shrink-0"
              onClick={() =>
                isInWishlist
                  ? removeWishlistItem(saree.id)
                  : addWishlistItem(saree.id)
              }
              disabled={isAddingWishlistItem}
            >
              <Heart
                className={`h-4 w-4 ${
                  isInWishlist ? "fill-primary text-primary" : ""
                }`}
              />
            </Button>
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
