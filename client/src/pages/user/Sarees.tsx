import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Filter, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCard } from "@/components/product/ProductCard";
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails } from "@shared/schema";
import { useFilterStore } from "@/components/Store/useFilterStore";
import { CheckedState } from "@radix-ui/react-checkbox";

type FilterItemProps = {
  id: string;
  checked: boolean;
  onChange: (checked: CheckedState) => void;
  label: React.ReactNode;
};
export default function Sarees() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    color: searchParams.get("color") || "",
    fabric: searchParams.get("fabric") || "",
    featured: searchParams.get("featured") === "true",
    onSale: searchParams.get("onSale") === "true",
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
    if (filters.onSale) params.append("onSale", "true");
    if (filters.minPrice) params.append("minPrice", filters.minPrice);
    if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
    if (filters.sort) params.append("sort", filters.sort);
    const qs = params.toString();
    return qs ? `/api/sarees?${qs}` : "/api/sarees";
  };

  const { data: sarees, isLoading } = useQuery<SareeWithDetails[]>({
    queryKey: [buildQueryString()],
  });
  const categories = useFilterStore((state) => state.categories);
  const colors = useFilterStore((state) => state.colors);
  const fabrics = useFilterStore((state) => state.fabrics);
  const fetchFilters = useFilterStore((state) => state.fetchFilters);
  useEffect(() => {
    if (!categories.length || !colors.length || !fabrics.length) {
      fetchFilters();
    }
  }, [categories, colors, fabrics]);
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
      onSale: false,
      minPrice: "",
      maxPrice: "",
      sort: "newest",
    });
  };

  const hasActiveFilters =
    filters.category ||
    filters.color ||
    filters.fabric ||
    filters.featured ||
    filters.onSale ||
    filters.minPrice ||
    filters.maxPrice;

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm font-semibold">
          <Filter className="h-4 w-4" />
          Filters
        </span>

        {hasActiveFilters && (
          <span
            onClick={clearFilters}
            className="text-xs cursor-pointer"
            data-testid="text-clear-filters-desktop"
          >
            Reset
          </span>
        )}
      </div>

      <div className="space-y-6">
        <FilterSection title="Categories">
          {categories?.map((cat) => (
            <FilterItem
              key={cat.id}
              id={`cat-${cat.id}`}
              checked={filters.category === cat.id}
              onChange={(checked) =>
                updateFilter("category", checked ? cat.id : "")
              }
              label={cat.name}
            />
          ))}
        </FilterSection>

        <FilterSection title="Colors">
          {colors?.map((color) => (
            <FilterItem
              key={color.id}
              id={`color-${color.id}`}
              checked={filters.color === color.id}
              onChange={(checked) =>
                updateFilter("color", checked ? color.id : "")
              }
              label={
                <span className="flex items-center gap-1">
                  {color.name.charAt(0).toUpperCase() + color.name.slice(1)}
                  <span
                    className="h-2 w-5 rounded-lg border"
                    style={{ backgroundColor: color.hexCode }}
                  />
                </span>
              }
            />
          ))}
        </FilterSection>

        <FilterSection title="Fabrics">
          {fabrics?.map((fab) => (
            <FilterItem
              key={fab.id}
              id={`fab-${fab.id}`}
              checked={filters.fabric === fab.id}
              onChange={(checked) =>
                updateFilter("fabric", checked ? fab.id : "")
              }
              label={fab.name}
            />
          ))}
        </FilterSection>

        <FilterSection title="Price Range">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              placeholder="Min ₹"
              value={filters.minPrice}
              onChange={(e) => updateFilter("minPrice", e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max ₹"
              value={filters.maxPrice}
              onChange={(e) => updateFilter("maxPrice", e.target.value)}
            />
          </div>
        </FilterSection>
      </div>
    </div>
  );

  const FilterSection = ({ title, children }: any) => (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );

  const FilterItem: React.FC<FilterItemProps> = ({
    id,
    checked,
    onChange,
    label,
  }) => (
    <label
      htmlFor={id}
      className="flex items-center gap-3 px-2 py-1.5 cursor-pointer"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <span className="text-xs leading-snug">{label}</span>
    </label>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex">
        <aside className="hidden lg:block w-64 flex-shrink-0 pb-8 pl-6 border-r border-gray-200">
          <div className="sticky top-16 pr-4 pt-4">
            <FilterContent />
          </div>
        </aside>

        <main className="flex-1 pb-8">
          <div className="flex flex-col sticky top-16 z-20 bg-white gap-4 py-4">
            <div className="px-6 lg:hidden">
              <Input
                type="search"
                placeholder="Search sarees..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                data-testid="input-search-mobile"
              />
            </div>
            <div className="flex px-6">
              <div className="md:ml-auto">
                <Select
                  value={filters.sort}
                  onValueChange={(v) => updateFilter("sort", v)}
                >
                  <SelectTrigger className="w-40" data-testid="select-sort">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="price-low">
                      Price: Low to High
                    </SelectItem>
                    <SelectItem value="price-high">
                      Price: High to Low
                    </SelectItem>
                    <SelectItem value="name">Name: A to Z</SelectItem>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="onSale">Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Sheet
                open={mobileFiltersOpen}
                onOpenChange={setMobileFiltersOpen}
              >
                <SheetTrigger asChild className="lg:hidden ml-auto">
                  <Button variant="outline" data-testid="button-mobile-filters">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    {hasActiveFilters && (
                      <span className="ml-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        !
                      </span>
                    )}
                  </Button>
                </SheetTrigger>

                <SheetContent side="right" className="w-80">
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
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : sarees && sarees.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-6">
              {sarees.map((saree) => (
                <ProductCard key={saree.id} saree={saree} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">
                No sarees found matching your criteria.
              </p>
              <Button
                onClick={clearFilters}
                variant="outline"
                data-testid="button-clear-search"
              >
                Clear filters
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
