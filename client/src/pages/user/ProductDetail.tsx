import { useParams, Link, useNavigate } from "react-router-dom";
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
  ShieldCheck,
  RotateCcw,
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
import type { ProductWithDetails } from "@shared/schema";
import { useCartStore } from "@/components/Store/useCartStore";
import { useWishlistStore } from "@/components/Store/useWishlistStore";
import { CartQuantity } from "./common/CartQuantity";
import { ProductSharePopover } from "@/components/common/ProductSharePopover";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const { data: product, isLoading } = useQuery<ProductWithDetails>({
    queryKey: ["/api/products", id],
  });

  const { data: relatedProducts } = useQuery<ProductWithDetails[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/getProducts", {
        category: [product?.categoryId],
        limit: 4,
      });
      return response;
    },
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
  const isInCart = cartItems?.some((item) => item.product.id === id);
  const isInWishlist = wishlistItems?.some((item) => item.productId === id);
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
    queryKey: ["/api/products", id, "reviews"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/products/${id}/reviews`);
      return response;
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
  const reviewStats = reviewsData?.stats;
  const renderStars = (value: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={true}
            className={`cursor-default`}
          >
            <Star
              className={`h-4 w-4 ${
                star <= value
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

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Product not found</h2>
        <Link to="/products">
          <Button variant="outline" data-testid="button-back-to-shop">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shop
          </Button>
        </Link>
      </div>
    );
  }

  const images = [product.imageUrl, ...(product.images || [])].filter(
    Boolean,
  ) as string[];
  if (images.length === 0) {
    images.push("/banner.png");
  }

  const isOnlineAvailable =
    product.distributionChannel === "online" ||
    product.distributionChannel === "both";
  const hasStock = product.onlineStock > 0;
  const isButtonDisabled = (id: string) => {
    return Boolean(
      isAddingItem[id] || isUpdatingItem[id] || isRemovingItem[id],
    );
  };
  const Breadcrumb = (hideDeck?: boolean) => {
    return (
      <nav className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <Link to="/" className="hover:text-primary transition-colors">
          Home
        </Link>

        <ChevronRight size={12} />

        <Link to="/products" className="hover:text-primary transition-colors">
          Products
        </Link>

        {!hideDeck && (
          <>
            <ChevronRight size={12} />
            <span className="text-zinc-900">{product.name}</span>
          </>
        )}
      </nav>
    );
  };
  const ActionButtons = () => {
    return (
      <>
        {isInCart ? (
          <div className="flex-1">
            <CartQuantity
              product={product}
              cartItems={cartItems}
              updateQuantity={updateQuantity}
              isButtonDisabled={isButtonDisabled}
            />
          </div>
        ) : (
          <Button
            className="flex-1 h-12 text-sm font-semibold rounded-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
            onClick={() => addCartItem(product.id, 1)}
            disabled={isButtonDisabled(product.id)}
            data-testid="button-add-to-cart"
          >
            Add to Cart <ShoppingBag className="h-4 w-4 ml-2" />
          </Button>
        )}
      </>
    );
  };
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="lg:hidden mb-12">{Breadcrumb()}</div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16">
        {/* Image Section - 60% width */}
        <div className="lg:col-span-7">
          <ProductImageGallery
            product={product}
            images={images}
            selectedImage={selectedImage}
            onImageSelect={setSelectedImage}
          />
        </div>

        <div className="lg:col-span-5 lg:sticky lg:top-32 h-fit ">
          <div className="hidden lg:block mb-4">{Breadcrumb(true)}</div>
          {/* Product Title and Price Section */}
          <div className="mb-4">
            <h1 className="text-5xl font-serif tracking-tighter mb-4 leading-none first-letter:uppercase">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-2">
              {!product.activeSale || !product.discountedPrice ? (
                <p
                  className="text-3xl text-primary"
                  data-testid="text-product-price"
                >
                  {formatPrice(product.price)}
                </p>
              ) : (
                <>
                  <p
                    className="text-3xl text-primary"
                    data-testid="text-product-price"
                  >
                    {formatPrice(product.discountedPrice)}
                  </p>
                  <p className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.price)}
                  </p>
                  <Badge className="bg-red-500 text-white border-0 text-sm px-2 py-1">
                    {Math.round(
                      (1 -
                        parseFloat(product.discountedPrice.toString()) /
                          parseFloat(product.price)) *
                        100,
                    )}
                    % OFF
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Stock Status */}
          <div className="flex items-center mb-4">
            {isOnlineAvailable ? (
              hasStock ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {product.onlineStock} In Stock
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
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
              The Story
            </p>
            <p className="text-zinc-600 leading-relaxed text-sm font-serif">
              {product.description ||
                "This exquisite product showcases finest craftsmanship, blending traditional artistry with contemporary elegance."}
            </p>
          </div>

          {/* Action Buttons */}
          {user?.role === "user" && isOnlineAvailable && hasStock && (
            <div className="space-y-4 mb-4 hidden lg:block">
              <div className="flex flex-col sm:flex-row gap-3">
                <ActionButtons />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background hover:scale-110 transition-all duration-300 shadow-md hover:shadow-lg"
                    onClick={() =>
                      isInWishlist
                        ? removeWishlistItem(product.id)
                        : addWishlistItem(product.id)
                    }
                    disabled={
                      isInWishlist
                        ? isRemovingWishlistItem
                        : isAddingWishlistItem
                    }
                    data-testid={`button-wishlist-${product.id}`}
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
                  <ProductSharePopover
                    name={product.name}
                    price={formatPrice(
                      product.discountedPrice || product.price,
                    )}
                  />
                </div>
              </div>

              {/* Success Message for Cart */}
              {/* {isInCart && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Item added to your cart successfully!
                  </span>
                </div>
              )} */}
            </div>
          )}

          {/* Login Prompt */}
          {!user && (
            <div className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl mb-4">
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
          <div className="flex justify-between items-center py-6 bg-zinc-50 rounded-2xl px-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <ShieldCheck size={20} className="text-amber-600" />
              <span className="text-[9px] font-bold uppercase tracking-tighter">
                Authentic Certified
              </span>
            </div>
            <div className="w-px h-8 bg-zinc-200" />
            <div className="flex flex-col items-center gap-2 text-center">
              <Truck size={20} className="text-amber-600" />
              <span className="text-[9px] font-bold uppercase tracking-tighter">
                Free Shiping
              </span>
            </div>
            <div className="w-px h-8 bg-zinc-200" />
            <div className="flex flex-col items-center gap-2 text-center">
              <RotateCcw size={20} className="text-amber-600" />
              <span className="text-[9px] font-bold uppercase tracking-tighter">
                7 Day Returns
              </span>
            </div>
          </div>

          <Accordion
            type="single"
            collapsible
            className="w-full"
            defaultValue="details"
          >
            <AccordionItem value="details">
              <AccordionTrigger className="text-left">
                <span className="font-semibold text-xs uppercase tracking-[0.1em]">
                  Product Details
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-y-2 gap-x-10">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">
                      SKU
                    </p>
                    <p className="text-xs font-medium text-zinc-900">
                      {product.sku || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">
                      Type
                    </p>
                    <p className="text-xs font-medium text-zinc-900">
                      {product.subcategory?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">
                      Fabric
                    </p>
                    <p className="text-xs font-medium text-zinc-900">
                      {product.fabric?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">
                      Color
                    </p>
                    <p className="text-xs font-medium text-zinc-900">
                      {product.color?.name || "N/A"}
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="shipping">
              <AccordionTrigger className="text-left">
                <span className="font-semibold text-xs uppercase tracking-[0.1em]">
                  Shipping & Returns
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="prose max-w-none dark:prose-invert text-xs">
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
                  <span className="font-semibold text-xs uppercase tracking-[0.1em]">
                    Customer Reviews
                  </span>
                  <div className="flex items-center gap-2">
                    {renderStars(reviewStats?.averageRating || 0)}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
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
      {relatedProducts && relatedProducts.length > 0 && (
        <section className="mt-38 pt-24 border-zinc-100">
          <div className="flex justify-between items-end mb-16">
            <h2 className="text-5xl font-serif tracking-tighter italic font-light">
              Complete the <br />{" "}
              <span className="not-italic font-bold">Ensemble</span>
            </h2>
            <button
              onClick={() => {
                navigate("/products");
              }}
              className="text-[10px] font-bold uppercase tracking-[0.2em] border-b border-black pb-2 transition-all"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((s) => (
              <div key={s.id} className="group">
                <ProductCard product={s} />
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
                  {product.name}
                </h3>
                <p className="text-lg font-bold text-primary">
                  {formatPrice(product.discountedPrice || product.price)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() =>
                    isInWishlist
                      ? removeWishlistItem(product.id)
                      : addWishlistItem(product.id)
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
                <ActionButtons />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add bottom padding to account for sticky bar on mobile */}
      {user?.role === "user" && isOnlineAvailable && hasStock && (
        <div className="lg:hidden" />
      )}
    </div>
  );
}
