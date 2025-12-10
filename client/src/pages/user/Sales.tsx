
import { Link } from "react-router-dom";
import { Tag, Clock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { SaleWithDetails } from "@shared/schema";

export default function Sales() {
  const { data: sales, isLoading } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/sales?current=true"],
  });

  const { data: featuredSales, isLoading: loadingFeatured } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/sales?featured=true&current=true"],
  });

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const calculateDiscount = (sale: SaleWithDetails, originalPrice: number) => {
    if (sale.offerType === "percentage") {
      return originalPrice * (parseFloat(sale.discountValue) / 100);
    }
    return parseFloat(sale.discountValue);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
          <Tag className="h-4 w-4" />
          <span className="text-sm font-medium">Special Offers</span>
        </div>
        <h1 className="font-serif text-4xl font-semibold mb-4" data-testid="text-page-title">
          Sales & Offers
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
          Discover amazing deals on our exquisite collection of sarees. Limited time offers you don't want to miss!
        </p>
        <Link to="/sarees?onSale=true">
          <Button size="lg" data-testid="button-shop-all-sale">
            <Tag className="h-4 w-4 mr-2" />
            Shop All Sale Products
          </Button>
        </Link>
      </section>

      {/* Featured Sales */}
      {featuredSales && featuredSales.length > 0 && (
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6">Featured Deals</h2>
          {loadingFeatured ? (
            <div className="grid md:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {featuredSales.map((sale) => (
                <Card key={sale.id} className="overflow-hidden group hover-elevate" data-testid={`card-featured-sale-${sale.id}`}>
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <img
                      src={sale.bannerImage || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&h=450&fit=crop"}
                      alt={sale.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <Badge className="mb-2 bg-primary">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                      <h3 className="font-serif text-2xl font-semibold mb-2">{sale.name}</h3>
                      <p className="text-sm text-white/90 mb-4">{sale.description}</p>
                      <Link to={`/sales/${sale.id}`}>
                        <Button variant="secondary">
                          Shop Now
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* All Active Sales */}
      <section>
        <h2 className="font-serif text-2xl font-semibold mb-6">All Active Offers</h2>
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-lg" />
            ))}
          </div>
        ) : sales && sales.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sales.map((sale) => (
              <Card key={sale.id} className="overflow-hidden group hover-elevate" data-testid={`card-sale-${sale.id}`}>
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={sale.bannerImage || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=450&fit=crop"}
                    alt={sale.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-red-500 text-white">
                      {sale.offerType === "percentage" ? `${sale.discountValue}% OFF` : `Save ${formatPrice(sale.discountValue)}`}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-1">{sale.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{sale.description}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Clock className="h-4 w-4" />
                    <span>Valid until {formatDate(sale.validUntil)}</span>
                  </div>
                  <Link to={`/sales/${sale.id}`}>
                    <Button className="w-full">
                      View Offer
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Tag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No active offers</h3>
            <p className="text-muted-foreground mb-6">Check back soon for amazing deals!</p>
            <Link to="/sarees">
              <Button>Browse All Sarees</Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
