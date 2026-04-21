import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SaleWithDetails } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function OffersBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const { data: featuredSales } = useQuery<SaleWithDetails[]>({
    queryKey: ["featured-sales"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sales?featured=true&current=true");
      return response;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Check if user has dismissed the banner
  useEffect(() => {
    const dismissed = localStorage.getItem('offers-banner-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const now = Date.now();
      // Show again after 24 hours
      if (now - dismissedTime < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      } else {
        localStorage.removeItem('offers-banner-dismissed');
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    localStorage.setItem('offers-banner-dismissed', Date.now().toString());
  };

  // Don't render if no featured sales, dismissed, or not visible
  if (!featuredSales || featuredSales.length === 0 || dismissed || !isVisible) {
    return null;
  }

  const getOfferText = (sale: SaleWithDetails) => {
    switch (sale.offerType) {
      case "percentage":
      case "category":
      case "flash_sale":
        return `${Math.round(parseFloat(sale.discountValue))}% OFF`;
      case "flat":
      case "product":
        return `FLAT ${sale.discountValue} OFF`;
      default:
        return "SPECIAL OFFER";
    }
  };

  // Get the first featured sale for the banner
  const featuredSale = featuredSales[0];

  return (
    <div className="relative bg-gradient-to-r from-amber-600 to-amber-700 text-white py-2 px-4 text-center text-sm font-medium overflow-hidden">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors z-10"
        aria-label="Close offers banner"
      >
        <X size={16} />
      </button>

      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center gap-4">
        <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          Limited Time
        </span>
        
        <span className="font-semibold">
          {featuredSale.name}
        </span>
        
        <span className="bg-white text-amber-700 px-2 py-1 rounded-full text-xs font-bold">
          {getOfferText(featuredSale)}
        </span>
        
        {featuredSale.offerType === "flash_sale" && (
          <span className="text-xs opacity-90">
            Ends Soon!
          </span>
        )}
      </div>

      {/* Subtle animation */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        div {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
