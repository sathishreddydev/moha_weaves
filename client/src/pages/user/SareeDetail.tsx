import { useParams, Link } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductCard } from "@/components/product/ProductCard";
import { Reviews } from "@/components/product/Reviews";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { CartItemWithSaree, SareeWithDetails } from "@shared/schema";
import { useCartStore } from "@/components/Store/useCartStore";
import { useWishlistStore } from "@/components/Store/useWishlistStore";

export default function SareeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

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
    (state) => state.isRemovingItem
  );

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
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
        <h2 className="text-2xl font-semibold mb-4">Product not found</h2>
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
    Boolean
  ) as string[];
  if (images.length === 0) {
    images.push(
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&fit=crop"
    );
  }

  const isOnlineAvailable =
    saree.distributionChannel === "online" ||
    saree.distributionChannel === "both";
  const hasStock = saree.onlineStock > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>
        <span>/</span>
        <Link to="/sarees" className="hover:text-primary">
          Sarees
        </Link>
        <span>/</span>
        <span className="text-foreground">{saree.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted">
            <img
              src={images[selectedImage]}
              alt={saree.name}
              className="w-full h-full object-cover"
              data-testid="img-product-main"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-20 h-24 rounded-md overflow-hidden flex-shrink-0 border-2 transition-colors ${
                    selectedImage === i
                      ? "border-primary"
                      : "border-transparent"
                  }`}
                  data-testid={`button-thumbnail-${i}`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            {saree.isFeatured && <Badge className="mb-2">Featured</Badge>}
            <h1
              className="font-serif text-2xl md:text-3xl font-semibold"
              data-testid="text-product-name"
            >
              {saree.name}
            </h1>
            {!saree.activeSale || !saree.discountedPrice ? (
              // Normal price
              <p
                className="text-2xl font-semibold text-primary mt-2"
                data-testid="text-product-price"
              >
                {formatPrice(saree.price)}
              </p>
            ) : (
              // Sale price + original price
              <div className="flex items-center gap-3 mt-2">
                <p
                  className="text-2xl font-semibold text-primary"
                  data-testid="text-product-price"
                >
                  {formatPrice(saree.discountedPrice)}
                </p>
                <p className="text-muted-foreground line-through text-lg">
                  {formatPrice(saree.price)}
                </p>
              </div>
            )}
          </div>

          {/* Attributes */}
          <div className="flex flex-wrap gap-4 text-sm">
            {saree.category && (
              <div>
                <span className="text-muted-foreground">Category:</span>{" "}
                <span className="font-medium">{saree.category.name}</span>
              </div>
            )}
            {saree.fabric && (
              <div>
                <span className="text-muted-foreground">Fabric:</span>{" "}
                <span className="font-medium">{saree.fabric.name}</span>
              </div>
            )}
            {saree.color && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Color:</span>
                <span
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: saree.color.hexCode }}
                />
                <span className="font-medium">{saree.color.name}</span>
              </div>
            )}
          </div>

          <div>
            {isOnlineAvailable ? (
              hasStock ? (
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                >
                  In Stock ({saree.onlineStock} available)
                </Badge>
              ) : (
                <Badge variant="secondary">Out of Stock</Badge>
              )
            ) : (
              <Badge variant="secondary">Store Exclusive</Badge>
            )}
          </div>

          <Separator />

          {user && user.role === "user" && isOnlineAvailable && hasStock && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Quantity:</span>
                {isInCart ? (
                  (() => {
                    const item = cartItems.find((c) => c.saree.id === saree.id);
                    if (!item) return null;
                    return (
                      <div className="flex items-center border rounded-md">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          disabled={
                            item.quantity <= 1 ||
                            isRemovingItem ||
                            isUpdatingItem
                          }
                          data-testid={`button-quantity-minus-${item.id}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span
                          className="w-8 text-center text-sm"
                          data-testid={`text-quantity-${item.id}`}
                        >
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          disabled={
                            item.quantity >= item.saree.onlineStock ||
                            isUpdatingItem ||
                            isRemovingItem
                          }
                          data-testid={`button-quantity-plus-${item.id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })()
                ) : (
                  <Button
                    className="flex-1"
                    onClick={() => addCartItem(saree.id, quantity)}
                    disabled={isAddingItem}
                    data-testid="button-add-to-cart"
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm"
                  onClick={() =>
                    isInWishlist
                      ? removeWishlistItem(saree.id)
                      : addWishlistItem(saree.id)
                  }
                  disabled={
                    isInWishlist ? isRemovingWishlistItem : isAddingWishlistItem
                  }
                  data-testid={`button-wishlist-${saree.id}`}
                >
                  <Heart
                    className={`h-4 w-4 ${
                      isInWishlist ? "fill-primary text-primary" : ""
                    }`}
                  />
                </Button>
              </div>
            </div>
          )}

          {!user && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">
                Please login to add items to cart or wishlist.
              </p>
              <Link to="/user/login">
                <Button data-testid="button-login-prompt">
                  Login to Continue
                </Button>
              </Link>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Truck className="h-5 w-5 mx-auto mb-1 text-primary" />
              <span className="text-xs">Free Shipping</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <RefreshCw className="h-5 w-5 mx-auto mb-1 text-primary" />
              <span className="text-xs">15-Day Returns</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
              <span className="text-xs">Secure Payment</span>
            </div>
          </div>
          <Tabs defaultValue="description" className="mt-12">
            <TabsList>
              <TabsTrigger value="description" data-testid="tab-description">
                Description
              </TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details">
                Details
              </TabsTrigger>
              <TabsTrigger value="reviews" data-testid="tab-reviews">
                <Star className="h-4 w-4 mr-1" />
                Reviews
              </TabsTrigger>
              <TabsTrigger value="shipping" data-testid="tab-shipping">
                Shipping
              </TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="mt-4">
              <div className="prose max-w-none dark:prose-invert">
                <p>
                  {saree.description ||
                    "This exquisite saree showcases the finest craftsmanship, blending traditional artistry with contemporary elegance. Perfect for special occasions and celebrations."}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="details" className="mt-4">
              <div className="space-y-2 text-sm">
                <p>
                  <strong>SKU:</strong> {saree.sku || "N/A"}
                </p>
                <p>
                  <strong>Category:</strong> {saree.category?.name || "N/A"}
                </p>
                <p>
                  <strong>Fabric:</strong> {saree.fabric?.name || "N/A"}
                </p>
                <p>
                  <strong>Color:</strong> {saree.color?.name || "N/A"}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="mt-4">
              {id && <Reviews sareeId={id} />}
            </TabsContent>
            <TabsContent value="shipping" className="mt-4">
              <div className="prose max-w-none dark:prose-invert text-sm">
                <ul>
                  <li>Free shipping on orders above ₹2,999</li>
                  <li>Standard delivery: 5-7 business days</li>
                  <li>Express delivery available at extra cost</li>
                  <li>15-day hassle-free returns</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {relatedSarees && relatedSarees.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl font-semibold mb-6">
            You May Also Like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedSarees.map((s) => (
              <ProductCard key={s.id} saree={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
