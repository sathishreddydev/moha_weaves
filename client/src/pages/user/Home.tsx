import { Link } from "react-router-dom";
import {
  ArrowRight,
  Sparkles,
  Truck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product/ProductCard";
import { TrendingSalesBanner } from "./TrendingSales";
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails, Category } from "@shared/schema";
import { useFilterStore } from "@/components/Store/useFilterStore";
import { useEffect } from "react";
import { s } from "node_modules/vite/dist/node/types.d-aGj9QkWt";

const features = [
  {
    icon: Sparkles,
    title: "Handcrafted",
    description: "Each piece made with care",
  },
  {
    icon: Truck,
    title: "Free Shipping",
    description: "On orders above ₹2,999",
  },
  {
    icon: RefreshCw,
    title: "Easy Returns",
    description: "15-day hassle-free returns",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payment",
    description: "100% secure checkout",
  },
];

export default function Home() {
  const { data: featuredSarees, isLoading: loadingFeatured } = useQuery<
    SareeWithDetails[]
  >({
    queryKey: ["/api/sarees?featured=true&limit=8"],
  });

  const { data: newArrivals, isLoading: loadingNew } = useQuery<
    SareeWithDetails[]
  >({
    queryKey: ["/api/sarees?sort=newest&limit=4"],
  });

  const categories = useFilterStore((state) => state.categories);
  const fetchFilters = useFilterStore((state) => state.fetchFilters);
  const loadingCategories = useFilterStore((state) => state.loading);
  useEffect(() => {
    fetchFilters();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section - Dynamic based on active sales */}
      {(() => {
        const { data: heroSale } = useQuery<any>({
          queryKey: ["/api/sales?current=true&limit=1"],
        });

        const activeSale = heroSale && heroSale.length > 0 ? heroSale[0] : null;

        return (
          <section className="relative min-h-[70vh] flex items-center">
            <div className="absolute inset-0 z-0">
              <img
                src={
                  activeSale?.bannerImage ||
                  "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=1600&h=900&fit=crop"
                }
                alt={activeSale?.name || "Elegant saree collection"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 py-20">
              <div className="max-w-xl">
                {activeSale ? (
                  <>
                    <Badge className="mb-4 bg-red-500 text-white text-lg px-4 py-2">
                      {["percentage", "category", "flash_sale"].includes(
                        activeSale.offerType
                      )
                        ? `${Math.round(
                            parseFloat(activeSale.discountValue)
                          )}% OFF`
                        : `FLAT ₹${Math.round(
                            parseFloat(activeSale.discountValue)
                          )} OFF`}
                    </Badge>
                    <h1
                      className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-4"
                      data-testid="text-hero-title"
                    >
                      {activeSale.name}
                    </h1>
                    <p className="text-lg text-white/90 mb-8 leading-relaxed">
                      {activeSale.description ||
                        "Exclusive deals on our handcrafted collection"}
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <Link to={`/sales/${activeSale.id}`}>
                        <Button
                          size="lg"
                          className="bg-white text-primary hover:bg-white/90"
                          data-testid="button-shop-now"
                        >
                          Shop Sale
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      <Link to="/sales">
                        <Button
                          size="lg"
                          variant="outline"
                          className="border-white text-white hover:bg-white/10 backdrop-blur-sm"
                          data-testid="button-explore"
                        >
                          View All Offers
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h1
                      className="font-serif text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-4"
                      data-testid="text-hero-title"
                    >
                      Celebrate Tradition with Elegance
                    </h1>
                    <p className="text-lg text-white/90 mb-8 leading-relaxed">
                      Discover our exquisite collection of handcrafted sarees,
                      woven with stories of heritage and artistry.
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <Link to="/sarees">
                        <Button
                          size="lg"
                          className="bg-white text-primary hover:bg-white/90"
                          data-testid="button-shop-now"
                        >
                          Shop Now
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      <Link to="/categories">
                        <Button
                          size="lg"
                          variant="outline"
                          className="border-white text-white hover:bg-white/10 backdrop-blur-sm"
                          data-testid="button-explore"
                        >
                          Explore Collections
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Features */}
      <section className="py-12 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col items-center text-center gap-2"
              >
                <feature.icon className="h-8 w-8 text-primary" />
                <h3 className="font-medium">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Sales Banner */}
      <TrendingSalesBanner />

      {/* Categories */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                className="font-serif text-3xl font-semibold"
                data-testid="text-categories-title"
              >
                Shop by Category
              </h2>
              <p className="text-muted-foreground mt-1">
                Explore our curated collections
              </p>
            </div>
            <Link to="/categories">
              <Button variant="ghost" data-testid="button-view-all-categories">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingCategories ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories?.slice(0, 8).map((category) => (
                <Link key={category.id} to={`/sarees?category=${category.id}`}>
                  <Card
                    className="group relative aspect-square overflow-hidden hover-elevate cursor-pointer"
                    data-testid={`card-category-${category.id}`}
                  >
                    <img
                      src={
                        category.imageUrl ||
                        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=400&fit=crop"
                      }
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-serif text-lg font-medium text-white">
                        {category.name}
                      </h3>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                className="font-serif text-3xl font-semibold"
                data-testid="text-featured-title"
              >
                Featured Collection
              </h2>
              <p className="text-muted-foreground mt-1">
                Handpicked favorites from our collection
              </p>
            </div>
            <Link to="/sarees?featured=true">
              <Button variant="ghost" data-testid="button-view-all-featured">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingFeatured ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredSarees?.map((saree) => (
                <ProductCard key={saree.id} saree={saree} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Active Sales */}
      {/* <section className="py-16 bg-red-50 dark:bg-red-950/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                className="font-serif text-3xl font-semibold"
                data-testid="text-sales-title"
              >
                🔥 Hot Deals
              </h2>
              <p className="text-muted-foreground mt-1">
                Limited time offers on selected items
              </p>
            </div>
            <Link to="/sales">
              <Button variant="ghost" data-testid="button-view-all-sales">
                View All Offers <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {(() => {
            const { data: activeSales, isLoading: loadingSales } = useQuery<
              any[]
            >({
              queryKey: ["/api/sales?featured=true&current=true&limit=3"],
            });

            if (loadingSales) {
              return (
                <div className="grid md:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-[16/9] rounded-md" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              );
            }

            if (!activeSales || activeSales.length === 0) return null;

            return (
              <div className="grid md:grid-cols-3 gap-6">
                {activeSales.map((sale) => (
                  <Link key={sale.id} to={`/sales/${sale.id}`}>
                    <Card className="group overflow-hidden hover-elevate cursor-pointer">
                      <div className="relative aspect-[16/9] overflow-hidden">
                        <img
                          src={
                            sale.bannerImage ||
                            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=225&fit=crop"
                          }
                          alt={sale.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute top-2 right-2">
                          <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            {sale.offerType === "percentage"
                              ? `${sale.discountValue}% OFF`
                              : "SALE"}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold mb-1 line-clamp-1">
                          {sale.name}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {sale.description}
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            );
          })()}
        </div>
      </section> */}

      {/* New Arrivals */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                className="font-serif text-3xl font-semibold"
                data-testid="text-new-arrivals-title"
              >
                New Arrivals
              </h2>
              <p className="text-muted-foreground mt-1">
                Fresh additions to our collection
              </p>
            </div>
            <Link to="/sarees?sort=newest">
              <Button variant="ghost" data-testid="button-view-all-new">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingNew ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {newArrivals?.map((saree) => (
                <ProductCard key={saree.id} saree={saree} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-primary">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-white mb-4">
            Join the Moha Family
          </h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Sign up for exclusive offers, new arrivals, and styling tips
            delivered straight to your inbox.
          </p>
          <Link to="/user/register">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
              data-testid="button-join"
            >
              Create Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
