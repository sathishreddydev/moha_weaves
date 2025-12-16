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
    queryKey: ["/api/sarees?sort=featured&limit=8"],
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
    if (categories.length === 0) {
      fetchFilters();
    }
  }, [categories]);

  return (
    <div className="min-h-screen">
      <section className="relative flex items-center justify-center min-h-[40vh] sm:min-h-[55vh] lg:min-h-[75vh] px-4 sm:px-6 lg:px-12">
        <div className="absolute inset-0 z-0">
          <img
            src="/banner1.png"
            alt="Elegant saree collection"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl w-full mx-auto py-12 sm:py-16 lg:py-24">
          <div className="max-w-xl text-center sm:text-left">
            <h1
              className="font-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-white"
              data-testid="text-hero-title"
            >
              Celebrate Tradition with Elegance
            </h1>

            <p className="text-sm sm:text-base text-white/90 mb-6 leading-relaxed">
              Discover our exquisite collection of handcrafted sarees, woven
              with stories of heritage and artistry.
            </p>

            <div className="flex gap-4 sm:gap-6">
              <Link to="/sarees" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-white text-primary hover:bg-white/90"
                  data-testid="button-shop-now"
                >
                  Shop Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <Link to="/categories" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full sm:w-auto text-white backdrop-blur-sm"
                  data-testid="button-explore"
                >
                  Explore Collections
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <TrendingSalesBanner />

      <section className="py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p
                className="font-serif font-semibold
               text-xl sm:text-2xl lg:text-3xl"
                data-testid="text-categories-title"
              >
                Shop by Category
              </p>

              <p
                className="text-muted-foreground
               text-sm sm:text-base"
              >
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

      {(featuredSarees?.length ?? 0) > 0 && (
        <section className="py-4 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p
                  className="font-serif font-semibold
               text-xl sm:text-2xl lg:text-3xl"
                  data-testid="text-featured-title"
                >
                  Featured Collection
                </p>
                <p
                  className="text-muted-foreground
               text-sm sm:text-base"
                >
                  Handpicked favorites from our collection
                </p>
              </div>
              <Link to="/sarees?sort=featured">
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
      )}

      <section className="py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p
                className="font-serif font-semibold
               text-xl sm:text-2xl lg:text-3xl"
                data-testid="text-new-arrivals-title"
              >
                New Arrivals
              </p>
              <p
                className="text-muted-foreground
               text-sm sm:text-base"
              >
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
    </div>
  );
}
