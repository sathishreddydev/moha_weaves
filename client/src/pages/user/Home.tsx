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
import type { ProductWithDetails, Category } from "@shared/schema";
import { useFilterStore } from "@/components/Store/useFilterStore";
import { useEffect } from "react";
import { VisualCategoryHero } from "./common/VisualCategoryHero";

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
  const { data: featuredProducts, isLoading: loadingFeatured } = useQuery<
    ProductWithDetails[]
  >({
    queryKey: ["/api/products?sort=featured&limit=8"],
  });

  const { data: newArrivals, isLoading: loadingNew } = useQuery<
    ProductWithDetails[]
  >({
    queryKey: ["/api/products?sort=newest&limit=4"],
  });

  const categories = useFilterStore((state) => state.categories);
  const fetchFilters = useFilterStore((state) => state.fetchFilters);
  const loadingCategories = useFilterStore((state) => state.loading);
  useEffect(() => {
    if (categories.length === 0) {
      fetchFilters();
    }
  }, []);

  return (
    <div className="min-h-screen">
      <VisualCategoryHero categoriesData={categories} />

      <TrendingSalesBanner />

      <section className="py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p
                className="font-serif font-semibold
               text-xl"
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
              {categories?.slice(0, 8).map((category) => {
                const subcategoryNames = category.subcategories?.map(sub => sub.name).join(',') || '';
                const categoryUrl = `/products?category=${category.name}${subcategoryNames ? `&subcategory=${subcategoryNames}` : ''}`;
                
                return (
                  <Link key={category.id} to={categoryUrl}>
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
                );
              })}
            </div>
          )}
        </div>
      </section>

      {(featuredProducts?.length ?? 0) > 0 && (
        <section className="py-4 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p
                  className="font-serif font-semibold
               text-xl"
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
              <Link to="/products?sort=featured">
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
                {featuredProducts?.map((product) => (
                  <ProductCard key={product.id} product={product} />
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
               text-xl"
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
            <Link to="/products?sort=newest">
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
              {newArrivals?.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
