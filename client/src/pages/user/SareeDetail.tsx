import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import {
  Heart,
  ShoppingBag,
  Minus,
  Plus,
  ArrowLeft,
  Truck,
  RefreshCw,
  Shield,
  Star,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sparkles,
  Eye,
  Camera,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { Reviews } from "@/components/product/Reviews";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails } from "@shared/schema";
import { useCartStore } from "@/components/Store/useCartStore";
import { useWishlistStore } from "@/components/Store/useWishlistStore";
import { CartQuantity } from "./common/CartQuantity";
import { ProductSharePopover } from "@/components/common/ProductSharePopover";
import { cn } from "@/lib/utils";

export default function SareeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState(0);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const { data: saree, isLoading } = useQuery<SareeWithDetails>({
    queryKey: ["/api/sarees", id],
  });

  const relatedQueryString = saree?.categoryId
    ? `/api/sarees?category=${saree.categoryId}&limit=4`
    : null;

  const { data: relatedSarees } = useQuery<SareeWithDetails[]>({
    queryKey: [relatedQueryString],
    enabled: !!relatedQueryString,
  });
  const cartItems = useCartStore((state) => state.cart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const addCartItem = useCartStore((state) => state.addItem);
  const isAddingItem = useCartStore((state) => state.isAddingItem);
  const isUpdatingItem = useCartStore((state) => state.isUpdatingItem);
  const isRemovingItem = useCartStore((state) => state.isRemovingItem);
  const wishlistItems = useWishlistStore((state) => state.wishlist);
  const addWishlistItem = useWishlistStore((state) => state.addItem);
  const removeWishlistItem = useWishlistStore((state) => state.removeItem);
  const isAddingWishlistItem = useWishlistStore((state) => state.isAddingItem);
  const isInCart = cartItems?.some((item) => item.saree.id === id);
  const isInWishlist = wishlistItems?.some((item) => item.sareeId === id);
  const isRemovingWishlistItem = useWishlistStore(
    (state) => state.isRemovingItem,
  );
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<{
    reviews: any[];
    stats: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: Record<number, number>;
    };
  }>({
    queryKey: ["/api/sarees", id, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/sarees/${id}/reviews`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
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
  const reviews = reviewsData?.reviews;
  const reviewStats = reviewsData?.stats;
  const renderStars = (value: number, interactive = false) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setRating(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`${interactive ? "cursor-pointer" : "cursor-default"}`}
            data-testid={interactive ? `star-rating-${star}` : undefined}
          >
            <Star
              className={`h-5 w-5 ${
                star <= (interactive ? hoverRating || rating : value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    );
  };
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-[3/4] rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!saree) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Product not found</h2>
        <Link to="/sarees">
          <Button variant="outline" data-testid="button-back-to-shop">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shop
          </Button>
        </Link>
      </div>
    );
  }

  const images = [saree.imageUrl, ...(saree.images || [])].filter(
    Boolean,
  ) as string[];
  if (images.length === 0) {
    images.push("/banner.png");
  }

  const isOnlineAvailable =
    saree.distributionChannel === "online" ||
    saree.distributionChannel === "both";
  const hasStock = saree.onlineStock > 0;
  const isButtonDisabled = (id: string) => {
    return Boolean(
      isAddingItem[id] || isUpdatingItem[id] || isRemovingItem[id],
    );
  };
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link to="/sarees" className="hover:text-primary transition-colors">
          Sarees
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{saree.name}</span>
      </nav>

      <div className="grid lg:grid-cols-5 gap-4 lg:gap-6">
        {/* Image Section - 60% width */}
        <div className="lg:col-span-3">
          <ProductImageGallery
            saree={saree}
            images={images}
            selectedImage={selectedImage}
            onImageSelect={setSelectedImage}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Product Title and Price Section */}
          <div className="space-y-3">
            <h1
              className="text-xl font-bold"
              data-testid="text-product-name"
            >
              {saree.name}
            </h1>
            <div className="flex items-baseline gap-2">
              {!saree.activeSale || !saree.discountedPrice ? (
                <p
                  className="text-2xl font-bold text-primary"
                  data-testid="text-product-price"
                >
                  {formatPrice(saree.price)}
                </p>
              ) : (
                <>
                  <p
                    className="text-2xl font-bold text-primary"
                    data-testid="text-product-price"
                  >
                    {formatPrice(saree.discountedPrice)}
                  </p>
                  <p className="text-lg text-muted-foreground line-through">
                    {formatPrice(saree.price)}
                  </p>
                  <Badge className="bg-red-500 text-white border-0 text-sm px-2 py-1">
                    {Math.round(
                      (1 -
                        parseFloat(saree.discountedPrice.toString()) /
                          parseFloat(saree.price)) *
                        100,
                    )}
                    % OFF
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Stock Status */}
          <div className="flex items-center">
            {isOnlineAvailable ? (
              hasStock ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {saree.onlineStock} In Stock
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    Out of Stock
                  </span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Store Exclusive
                </span>
              </div>
            )}
          </div>

          {/* Product Description */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="prose max-w-none dark:prose-invert">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                {saree.description ||
                  "This exquisite saree showcases finest craftsmanship, blending traditional artistry with contemporary elegance."}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          {user?.role === "user" && isOnlineAvailable && hasStock && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {isInCart ? (
                  <div className="flex-1">
                    <CartQuantity
                      saree={saree}
                      cartItems={cartItems}
                      updateQuantity={updateQuantity}
                      isButtonDisabled={isButtonDisabled}
                    />
                  </div>
                ) : (
                  <Button
                    className="flex-1 h-12 text-sm font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                    onClick={() => addCartItem(saree.id, 1)}
                    disabled={isButtonDisabled(saree.id)}
                    data-testid="button-add-to-cart"
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-background/90 backdrop-blur-sm border-2 hover:bg-background hover:scale-110 transition-all duration-300 shadow-md hover:shadow-lg"
                    onClick={() =>
                      isInWishlist
                        ? removeWishlistItem(saree.id)
                        : addWishlistItem(saree.id)
                    }
                    disabled={
                      isInWishlist
                        ? isRemovingWishlistItem
                        : isAddingWishlistItem
                    }
                    data-testid={`button-wishlist-${saree.id}`}
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4 transition-all duration-300",
                        isInWishlist
                          ? "fill-red-500 text-red-500 scale-110"
                          : "hover:scale-110",
                      )}
                    />
                  </Button>
                  <div className="h-12 w-12 rounded-full bg-background/90 backdrop-blur-sm border-2 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center">
                    <ProductSharePopover
                      name={saree.name}
                      price={formatPrice(saree.discountedPrice || saree.price)}
                    />
                  </div>
                </div>
              </div>

              {/* Success Message for Cart */}
              {isInCart && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Item added to your cart successfully!
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Login Prompt */}
          {!user && (
            <div className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Sign in to Purchase
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Login to add items to cart and wishlist for a seamless
                  shopping experience.
                </p>
                <Link to="/user/login">
                  <Button
                    className="shadow-md hover:shadow-lg transition-all duration-300"
                    data-testid="button-login-prompt"
                  >
                    Login to Continue
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-4 py-6 border-y border-border/50">
            <div className="flex items-center gap-2 text-center">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-medium text-foreground">Free Shipping</span>
            </div>
            <div className="flex items-center gap-2 text-center">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                <RefreshCw className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs font-medium text-foreground">7-Day Returns</span>
            </div>
            <div className="flex items-center gap-2 text-center">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-xs font-medium text-foreground">Secure Payment</span>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details">
              <AccordionTrigger className="text-left">
                <span className="font-semibold text-sm">Product Details</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">
                      SKU
                    </span>
                    <span className="text-foreground">
                      {saree.sku || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">
                      Category
                    </span>
                    <span className="text-foreground">
                      {saree.category?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">
                      Fabric
                    </span>
                    <span className="text-foreground">
                      {saree.fabric?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">
                      Color
                    </span>
                    <span className="text-foreground">
                      {saree.color?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">
                      Stock
                    </span>
                    <span className="text-foreground">
                      {saree.onlineStock} units
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">
                      Availability
                    </span>
                    <span className="text-foreground">
                      {saree.distributionChannel}
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="shipping">
              <AccordionTrigger className="text-left">
                <span className="font-semibold text-sm">
                  Shipping & Returns
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="prose max-w-none dark:prose-invert text-xs pt-2">
                  <ul className="space-y-1">
                    <li className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full mt-1 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">
                        Free shipping above ₹2,999
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full mt-1 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">
                        Standard: 5-7 days
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full mt-1 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">
                        Express available
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-primary rounded-full mt-1 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">
                        7-day returns
                      </span>
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="reviews">
              <AccordionTrigger className="text-left hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-semibold text-sm">Customer Reviews</span>
                  <div className="flex items-center gap-2">
                    {renderStars(reviewStats?.averageRating || 0)}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ({reviewStats?.totalReviews || 0})
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2">
                  {id && (
                    <Reviews
                      reviewsData={reviewsData}
                      reviewLoading={reviewsLoading}
                    />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Enhanced Related Products */}
      {relatedSarees && relatedSarees.length > 0 && (
        <section className="mt-20">
          <div className="text-center mb-5">
            <h2 className="font-serif text-xl font-bold text-gray-900 dark:text-white">
              You May Also Like
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              Discover more exquisite sarees that complement your style and
              preferences
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedSarees.map((s) => (
              <div key={s.id} className="group">
                <ProductCard saree={s} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sticky Add to Cart Bar */}
      {user?.role === "user" && isOnlineAvailable && hasStock && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border shadow-2xl z-40 lg:hidden">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
                  {saree.name}
                </h3>
                <p className="text-lg font-bold text-primary">
                  {formatPrice(saree.discountedPrice || saree.price)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() =>
                    isInWishlist
                      ? removeWishlistItem(saree.id)
                      : addWishlistItem(saree.id)
                  }
                  disabled={
                    isInWishlist ? isRemovingWishlistItem : isAddingWishlistItem
                  }
                >
                  <Heart
                    className={cn(
                      "h-5 w-5",
                      isInWishlist ? "fill-red-500 text-red-500" : "",
                    )}
                  />
                </Button>
                {isInCart ? (
                  <CartQuantity
                    saree={saree}
                    cartItems={cartItems}
                    updateQuantity={updateQuantity}
                    isButtonDisabled={isButtonDisabled}
                  />
                ) : (
                  <Button
                    className="h-12 px-6 font-semibold"
                    onClick={() => addCartItem(saree.id, 1)}
                    disabled={isButtonDisabled(saree.id)}
                  >
                    <ShoppingBag className="h-5 w-5 mr-2" />
                    Add to Cart
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add bottom padding to account for sticky bar on mobile */}
      {user?.role === "user" && isOnlineAvailable && hasStock && (
        <div className="h-20 lg:hidden" />
      )}
    </div>
  );
}
