import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@shared/schema";

export default function Categories() {
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="font-serif text-4xl font-semibold mb-4" data-testid="text-page-title">
          Shop by Category
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Explore our curated collections of handcrafted sarees, each category representing a unique tradition and artistry.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
          ))}
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link key={category.id} to={`/sarees?category=${category.id}`}>
              <Card
                className="group relative aspect-[4/3] overflow-hidden hover-elevate cursor-pointer"
                data-testid={`card-category-${category.id}`}
              >
                <img
                  src={category.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=400&fit=crop"}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="font-serif text-2xl font-semibold text-white mb-2" data-testid={`text-category-name-${category.id}`}>
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="text-sm text-white/80 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                  <span className="inline-flex items-center text-sm text-white/90 mt-3 group-hover:text-white transition-colors">
                    Explore Collection
                    <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No categories available yet.</p>
        </div>
      )}
    </div>
  );
}
