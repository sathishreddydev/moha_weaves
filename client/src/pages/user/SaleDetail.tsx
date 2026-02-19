import { ProductCard } from "@/components/product/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductWithDetails, SaleWithProducts } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, ShoppingBag, Tag } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { formatDate, formatPrice } from "@/lib/utils";

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: sale, isLoading: loadingSale } = useQuery<SaleWithProducts>({
    queryKey: ["/api/sales", id],
    enabled: !!id,
  });

  const { data: saleProducts } = useQuery<ProductWithDetails[]>({
    queryKey: sale?.offerType === "category" && sale?.categoryId
      ? [`/api/products?category=${sale.categoryId}&onSale=true`]
      : [`/api/sales/${id}/products`],
    enabled: !!sale,
  });



  const getDiscountBadgeText = () => {
    if (!sale) return "";
    
    switch (sale.offerType) {
      case "percentage":
      case "category":
      case "flash_sale":
        return `${Math.round(parseFloat(sale.discountValue))}% OFF`;
      case "flat":
      case "product":
        return `${formatPrice(sale.discountValue)} OFF`;
      default:
        return "";
    }
  };

  if (loadingSale) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-64 mb-8 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Tag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Sale not found</h2>
        <Link to="/sales">
          <Button>Back to Sales</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link to="/sales" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Sales
      </Link>

      {/* Sale Header */}
      <div className="mb-12">
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="relative aspect-[16/9] md:aspect-auto">
              <img
                src={sale.bannerImage || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&h=600&fit=crop"}
                alt={sale.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-8 flex flex-col justify-center">
              <Badge className="w-fit mb-4 bg-red-500 text-white">
                {getDiscountBadgeText()}
              </Badge>
              <h1 className="font-serif text-xl font-semibold mb-4" data-testid="text-sale-name">
                {sale.name}
              </h1>
              <p className="text-muted-foreground text-lg mb-6">{sale.description}</p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                  <span>Valid from {formatDate(sale.validFrom)} to {formatDate(sale.validUntil)}</span>
                </div>
                {sale.minOrderAmount && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShoppingBag className="h-5 w-5" />
                    <span>Minimum order: {formatPrice(sale.minOrderAmount)}</span>
                  </div>
                )}
                {sale.maxDiscount && (sale.offerType === "percentage" || sale.offerType === "category" || sale.offerType === "flash_sale") && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tag className="h-5 w-5" />
                    <span>Maximum discount: {formatPrice(sale.maxDiscount)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                {saleProducts && saleProducts.length > 0 && (
                  <a href="#products">
                    <Button size="lg">
                      Shop Sale Items
                      <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                    </Button>
                  </a>
                )}
                {sale.categoryId && (
                  <Link to={`/products?category=${sale.categoryId}`}>
                    <Button size="lg" variant="outline">
                      Browse Category
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Products */}
      {(saleProducts && saleProducts.length > 0) && (
        <section id="products">
          <h2 className="font-serif text-2xl font-semibold mb-6">
            Sale Items ({saleProducts.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {saleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}