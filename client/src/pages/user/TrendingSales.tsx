
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { SaleWithDetails } from "@shared/schema";

export function TrendingSalesBanner() {
  const { data: sales, isLoading } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/sales?current=true&limit=2"],
  });

  if (isLoading || !sales || sales.length === 0) {
    return null;
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <section className="py-8 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-red-500" />
            <h2 className="font-serif text-2xl font-semibold">🔥 Limited Time Offers</h2>
          </div>
          <Link to="/sales">
            <Button variant="ghost" className="text-red-600 hover:text-red-700">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {sales.map((sale) => (
            <Link key={sale.id} to={`/sales/${sale.id}`}>
              <Card className="group overflow-hidden hover-elevate cursor-pointer bg-white dark:bg-card">
                <div className="flex gap-4 p-4">
                  <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden">
                    <img
                      src={sale.bannerImage || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=300&fit=crop"}
                      alt={sale.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <Badge className="absolute top-2 left-2 bg-red-500 text-white">
                      {sale.offerType === "percentage" ? `${sale.discountValue}% OFF` : `₹${sale.discountValue} OFF`}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1">{sale.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{sale.description}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Ends {formatDate(sale.validUntil)}</span>
                    </div>
                    <Button variant="link" className="p-0 h-auto mt-2 text-red-600 hover:text-red-700">
                      Shop Now <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
