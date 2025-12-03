import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Filter, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ProductCard } from "@/components/product/ProductCard";
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails, Category, Color, Fabric } from "@shared/schema";

export default function Sarees() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    color: searchParams.get("color") || "",
    fabric: searchParams.get("fabric") || "",
    featured: searchParams.get("featured") === "true",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    sort: searchParams.get("sort") || "newest",
  });

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.search) params.append("search", filters.search);
    if (filters.category) params.append("category", filters.category);
    if (filters.color) params.append("color", filters.color);
    if (filters.fabric) params.append("fabric", filters.fabric);
    if (filters.featured) params.append("featured", "true");
    if (filters.minPrice) params.append("minPrice", filters.minPrice);
    if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
    if (filters.sort) params.append("sort", filters.sort);
    const qs = params.toString();
    return qs ? `/api/sarees?${qs}` : "/api/sarees";
  };

  const { data: sarees, isLoading } = useQuery<SareeWithDetails[]>({
    queryKey: [buildQueryString()],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: colors } = useQuery<Color[]>({
    queryKey: ["/api/colors"],
  });

  const { data: fabrics } = useQuery<Fabric[]>({
    queryKey: ["/api/fabrics"],
  });

  const updateFilter = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      category: "",
      color: "",
      fabric: "",
      featured: false,
      minPrice: "",
      maxPrice: "",
      sort: "newest",
    });
  };

  const hasActiveFilters = filters.category || filters.color || filters.fabric || filters.featured || filters.minPrice || filters.maxPrice;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
          Categories
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-3">
          {categories?.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat.id}`}
                checked={filters.category === cat.id}
                onCheckedChange={(checked) => updateFilter("category", checked ? cat.id : "")}
                data-testid={`checkbox-category-${cat.id}`}
              />
              <Label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer">
                {cat.name}
              </Label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Colors */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
          Colors
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            {colors?.map((color) => (
              <button
                key={color.id}
                onClick={() => updateFilter("color", filters.color === color.id ? "" : color.id)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  filters.color === color.id ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
                style={{ backgroundColor: color.hexCode }}
                title={color.name}
                data-testid={`button-color-${color.id}`}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Fabrics */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
          Fabrics
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-3">
          {fabrics?.map((fab) => (
            <div key={fab.id} className="flex items-center gap-2">
              <Checkbox
                id={`fab-${fab.id}`}
                checked={filters.fabric === fab.id}
                onCheckedChange={(checked) => updateFilter("fabric", checked ? fab.id : "")}
                data-testid={`checkbox-fabric-${fab.id}`}
              />
              <Label htmlFor={`fab-${fab.id}`} className="text-sm cursor-pointer">
                {fab.name}
              </Label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Price Range */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium">
          Price Range
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-3">
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              placeholder="Min"
              value={filters.minPrice}
              onChange={(e) => updateFilter("minPrice", e.target.value)}
              className="w-full"
              data-testid="input-min-price"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.maxPrice}
              onChange={(e) => updateFilter("maxPrice", e.target.value)}
              className="w-full"
              data-testid="input-max-price"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Featured */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="featured"
          checked={filters.featured}
          onCheckedChange={(checked) => updateFilter("featured", !!checked)}
          data-testid="checkbox-featured"
        />
        <Label htmlFor="featured" className="text-sm cursor-pointer">
          Featured Only
        </Label>
      </div>

      {hasActiveFilters && (
        <Button variant="outline" onClick={clearFilters} className="w-full" data-testid="button-clear-filters">
          <X className="h-4 w-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold" data-testid="text-page-title">
          {filters.search ? `Search: "${filters.search}"` : "All Sarees"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {sarees?.length || 0} products found
        </p>
      </div>

      <div className="flex gap-8">
        {/* Desktop Filters */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </h2>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters-desktop">
                  Clear
                </Button>
              )}
            </div>
            <FilterContent />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-6">
            {/* Mobile filter button */}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="outline" data-testid="button-mobile-filters">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      !
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>

            {/* Search (mobile) */}
            <Input
              type="search"
              placeholder="Search sarees..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="max-w-xs lg:hidden"
              data-testid="input-search-mobile"
            />

            {/* Sort */}
            <Select value={filters.sort} onValueChange={(v) => updateFilter("sort", v)}>
              <SelectTrigger className="w-40" data-testid="select-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="name">Name: A to Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : sarees && sarees.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {sarees.map((saree) => (
                <ProductCard key={saree.id} saree={saree} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No sarees found matching your criteria.</p>
              <Button onClick={clearFilters} variant="outline" data-testid="button-clear-search">
                Clear filters
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
