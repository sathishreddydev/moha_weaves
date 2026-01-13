import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, Eye, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProductWithDetails } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useCartStore } from "../Store/useCartStore";
import { useWishlistStore } from "../Store/useWishlistStore";

interface ProductCardProps {
  product: ProductWithDetails;
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const guestUser = ["admin", "inventory", "store"]?.includes(user?.role ?? "");
  const navigate = useNavigate();

  const {
    cart: cartItems,
    addItem,
    updateQuantity,
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

  const cartItem = cartItems?.find((item) => item.product.id === product.id);
  const isInCart = !!cartItem;

  const isInWishlist = wishlist?.some((item) => item.productId === product.id);

  const isOnlineAvailable =
    product.distributionChannel === "online" ||
    product.distributionChannel === "both";

  const hasStock = product.onlineStock > 0;
  const disabledButton =
    isAddingItem[product.id] ||
    isUpdatingItem[product.id] ||
    isRemovingItem[product.id] ||
    isLoadingCart;
  const formatPrice = (price: number | string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(price));

  const handleUpdateQuantity = (newQuantity: number) => {
    if (!cartItem || disabledButton) return;

    if (newQuantity <= 0) {
      updateQuantity(cartItem.id, 0);
      return;
    }

    if (newQuantity > cartItem.product.onlineStock) return;

    updateQuantity(cartItem.id, newQuantity);
  };

  return (
    <Card className="group border-0 shadow-none bg-transparent">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <Link to={`/products/${product.id}`}>
          <img
            src={product.imageUrl ?? "/placeholder.png"}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 md:group-hover:scale-105"
          />
        </Link>

        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.activeSale && (
            <Badge className="bg-red-500 text-white">
              {Math.round(Number(product.activeSale.discountValue))}% OFF
            </Badge>
          )}
          {product.isFeatured && (
            <Badge className="bg-primary text-primary-foreground">
              Featured
            </Badge>
          )}
        </div>

        <div className="absolute top-2 right-2 hidden md:flex flex-col gap-2 opacity-0 md:group-hover:opacity-100 transition-opacity">
          {!guestUser && (
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-full bg-background/90"
              onClick={() => {
                if (!user) {
                  navigate("/user/login");
                  return;
                }
                isInWishlist
                  ? removeWishlistItem(product.id)
                  : addWishlistItem(product.id);
              }}
              disabled={isAddingWishlistItem}
              aria-label="Wishlist"
            >
              <Heart
                className={`h-3 w-3 ${
                  isInWishlist ? "fill-primary text-primary" : ""
                }`}
              />
            </Button>
          )}

          <Button
            asChild
            variant="secondary"
            size="icon"
            className="h-7 w-7 rounded-full bg-background/90"
          >
            <Link to={`/products/${product.id}`} aria-label="View product">
              <Eye className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {!guestUser && isOnlineAvailable && (
          <div
            className="absolute bottom-3 right-3 z-10
              opacity-100 md:opacity-0 md:group-hover:opacity-100
              transition-opacity"
          >
            {isInCart && cartItem ? (
              <div className="flex items-center text-white bg-primary rounded-md shadow">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleUpdateQuantity(cartItem.quantity - 1)}
                  disabled={disabledButton}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <span className="w-8 text-center text-sm">
                  {cartItem.quantity}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleUpdateQuantity(cartItem.quantity + 1)}
                  disabled={
                    disabledButton ||
                    cartItem.quantity >= cartItem.product.onlineStock
                  }
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className={`px-4 h-9 shadow ${
                  !hasStock ? "cursor-default" : ""
                }`}
                onClick={() => {
                  if (!user) {
                    navigate("/user/login");
                    return;
                  }
                  if (!hasStock) return;
                  !disabledButton && addItem(product.id, 1);
                }}
                disabled={disabledButton}
              >
                {hasStock ? (
                  <>
                    <ShoppingBag className="h-4 w-4 mr-1" />
                    Add
                  </>
                ) : (
                  "Sold Out"
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="pt-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/products/${product.id}`} className="flex-1">
            <h3 className="text-xs font-medium uppercase tracking-[0.1em]">
              {product.name}
            </h3>
          </Link>

          {!guestUser && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 shrink-0"
              onClick={() => {
                if (!user) {
                  navigate("/user/login");
                  return;
                }
                isInWishlist
                  ? removeWishlistItem(product.id)
                  : addWishlistItem(product.id);
              }}
              disabled={isAddingWishlistItem}
              aria-label="Wishlist"
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
          {product.activeSale && product.discountedPrice ? (
            <>
              <p className="font-semibold text-primary">
                {formatPrice(product.discountedPrice)}
              </p>
              <p className="text-sm text-muted-foreground line-through">
                {formatPrice(product.price)}
              </p>
            </>
          ) : (
            <p className="font-semibold text-primary text-sm">
              {formatPrice(product.price)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
