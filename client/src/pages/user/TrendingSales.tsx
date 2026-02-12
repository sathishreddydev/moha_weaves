import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, Tag } from "lucide-react";
import { Link } from "react-router-dom";

interface Sale {
  id: string;
  name: string;
  description: string;
  offerType: string;
  discountValue: string;
  validFrom: Date;
  validUntil: Date;
  isFeatured: boolean;
  bannerImage?: string;
  products: Array<{
    id: string;
    productId: string;
    product?: {
      id: string;
      name: string;
      imageUrl?: string;
      price: string;
    };
  }>;
}

export function TrendingSalesBanner() {
  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales?sort=featured&limit=3"],
  });

  if (isLoading) {
    return (
      <section className="py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!sales || sales.length === 0) {
    return null;
  }

  return (
    <section className="py-4 pt-6 bg-gradient-to-b from-primary/5 to-transparent">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="font-serif tracking-tighter transition-colors
               text-2xl flex items-center gap-1"
              data-testid="text-categories-title"
            >
              {/* <Tag className="h-6 w-6 text-primary" /> */}
              Trending Sales & Offers{" "}
            </h1>

            <p
              className="text-muted-foreground
               text-xs"
            >
              Do not miss out on our exclusive deals
            </p>
          </div>

          <Link
            to="/sales"
            className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.2em] border-b border-black pb-2 transition-all"
          >
            <span>View All</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {sales.map((sale) => {
            const timeRemaining =
              new Date(sale.validUntil).getTime() - Date.now();
            const daysLeft = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

            return (
              <Link key={sale.id} to={`/sales/${sale.id}`}>
                <Card className="group overflow-hidden hover:shadow-lg transition-all cursor-pointer">
                  <div className="aspect-[16/9] relative overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
                    {sale.bannerImage ? (
                      <img
                        src={sale.bannerImage}
                        alt={sale.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag className="h-16 w-16 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute top-4 right-4">
                      <Badge
                        variant="secondary"
                        className="bg-white/90 backdrop-blur-sm"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {daysLeft > 0 ? `${daysLeft} days left` : "Ending soon"}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-medium uppercase text-sm tracking-wider mb-2 group-hover:text-primary transition-colors">
                      {sale.name}
                    </h3>
                    {/* <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {sale.description}
                    </p> */}
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-primary border-primary"
                      >
                        {sale.offerType === "percentage"
                          ? `${sale.discountValue}% OFF`
                          : `₹${sale.discountValue} OFF`}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {sale.products.length} Products
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
