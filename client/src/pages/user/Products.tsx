import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Filter, SlidersHorizontal } from "lucide-react";
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
import type { ProductWithDetails } from "@shared/schema";
import { useFilterStore } from "@/components/Store/useFilterStore";
import { CheckedState } from "@radix-ui/react-checkbox";
import PriceRangeSlider from "@/components/product/PriceRangeSlider";
import { ReusableDrawer } from "@/components/common/ReusableDrawer";

type FilterItemProps = {
  id: string;
  checked: boolean;
  onChange: (checked: CheckedState) => void;
  label: React.ReactNode;
};
const parseFiltersFromURL = (search: string) => {
  const params = new URLSearchParams(search);

  return {
    search: params.get("search") || "",
    category: params.get("category")?.split(",").filter(Boolean) || [],
    subcategory: params.get("subcategory")?.split(",").filter(Boolean) || [],
    color: params.get("color")?.split(",").filter(Boolean) || [],
    fabric: params.get("fabric")?.split(",").filter(Boolean) || [],
    featured: params.get("featured") === "true",
    onSale: params.get("onSale") === "true",
    priceRange: {
      min: Number(params.get("minPrice")) || 0,
      max: Number(params.get("maxPrice")) || 100000,
    },
    sort: params.get("sort") || "newest",
  };
};

const serializeFiltersToURL = (filters: any) => {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.category.length)
    params.set("category", filters.category.join(","));
  if (filters.subcategory.length)
    params.set("subcategory", filters.subcategory.join(","));
  if (filters.color.length) params.set("color", filters.color.join(","));
  if (filters.fabric.length) params.set("fabric", filters.fabric.join(","));

  if (filters.priceRange.min)
    params.set("minPrice", String(filters.priceRange.min));
  if (filters.priceRange.max)
    params.set("maxPrice", String(filters.priceRange.max));

  if (filters.featured) params.set("featured", "true");
  if (filters.onSale) params.set("onSale", "true");
  if (filters.sort) params.set("sort", filters.sort);

  return params.toString();
};
export default function products() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialFilters = useMemo(
    () => parseFiltersFromURL(location.search),
    [location.search]
  );

  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    const query = serializeFiltersToURL(filters);

    navigate(
      {
        pathname: location.pathname,
        search: query,
      },
      { replace: true }
    );
  }, [filters, navigate, location.pathname]);
  // const [filters, setFilters] = useState({
  //   search: "",
  //   category: [] as string[],
  //   color: [] as string[],
  //   fabric: [] as string[],
  //   featured: false,
  //   onSale: false,
  //   priceRange: { min: 0, max: 100000 },
  //   sort: "newest",
  // });

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const updateFilter = (
    key: string,
    value: string | { min: number; max: number },
    checked?: boolean
  ) => {
    if (key === "priceRange" && typeof value !== "string") {
      setFilters((prev) => ({ ...prev, priceRange: value }));
    } else if (
      ["category", "subcategory", "color", "fabric"].includes(key) &&
      typeof value === "string"
    ) {
      setFilters((prev) => {
        const prevArray = (prev as any)[key] as string[];
        if (checked) {
          return { ...prev, [key]: [...prevArray, value] };
        } else {
          return { ...prev, [key]: prevArray.filter((v) => v !== value) };
        }
      });
    } else if (typeof value === "boolean" || typeof value === "string") {
      setFilters((prev) => ({ ...prev, [key]: value }));
    }
  };

  const clearFilters = () => {
    const params = new URLSearchParams(location.search);

    params.delete("category");
    params.delete("subcategory");
    params.delete("color");
    params.delete("fabric");
    params.delete("minPrice");
    params.delete("maxPrice");

    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
      },
      { replace: true }
    );
  };

  const hasActiveFilters =
    filters.category.length > 0 ||
    filters.subcategory.length > 0 ||
    filters.color.length > 0 ||
    filters.fabric.length > 0 ||
    filters.featured ||
    filters.onSale ||
    filters.priceRange.min !== 0 ||
    filters.priceRange.max !== 100000;

  const { data: products, isLoading } = useQuery<ProductWithDetails[]>({
    queryKey: ["products", filters],
    queryFn: async () => {
      const res = await fetch("/api/getProducts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      return res.json();
    },
    placeholderData: (previousData) => previousData,
  });

  const categories = useFilterStore((state) => state.categories);
  const subcategories = useFilterStore((state) => state.subcategories);
  const colors = useFilterStore((state) => state.colors);
  const fabrics = useFilterStore((state) => state.fabrics);
  const fetchFilters = useFilterStore((state) => state.fetchFilters);

  // Get subcategories for selected categories
  const selectedSubcategories = useMemo(() => {
    if (filters.category.length === 0) return [];
    const selectedCategoryIds = categories
      .filter(cat => filters.category.includes(cat.name))
      .map(cat => cat.id);
    
    return subcategories.filter(sub => 
      selectedCategoryIds.includes(sub.categoryId)
    );
  }, [filters.category, categories, subcategories]);

  useEffect(() => {
    if (!categories.length || !colors.length || !fabrics.length) {
      fetchFilters();
    }
  }, []);

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

  const FilterContent = () => (
    <div className="space-y-6 pb-8 pt-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm font-semibold">
          <Filter className="h-4 w-4" />
          Filters
        </span>

        {hasActiveFilters && (
          <span onClick={clearFilters} className="text-xs cursor-pointer">
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
              checked={filters.category.includes(cat.name)}
              onChange={(checked) =>
                updateFilter("category", cat.name, checked === true)
              }
              label={cat.name}
            />
          ))}
        </FilterSection>

        <FilterSection title="Subcategories">
          {filters.category.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Select a category first to see subcategories
            </div>
          ) : selectedSubcategories.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No subcategories available for selected categories
            </div>
          ) : (
            selectedSubcategories.map((sub) => (
              <FilterItem
                key={sub.id}
                id={`sub-${sub.id}`}
                checked={filters.subcategory.includes(sub.name)}
                onChange={(checked) =>
                  updateFilter("subcategory", sub.name, checked === true)
                }
                label={sub.name}
              />
            ))
          )}
        </FilterSection>

        <FilterSection title="Colors">
          {colors?.map((color) => (
            <FilterItem
              key={color.id}
              id={`color-${color.id}`}
              checked={filters.color.includes(color.name)}
              onChange={(checked) =>
                updateFilter("color", color.name, checked === true)
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
              checked={filters.fabric.includes(fab.name)}
              onChange={(checked) =>
                updateFilter("fabric", fab.name, checked === true)
              }
              label={fab.name}
            />
          ))}
        </FilterSection>

        <FilterSection title="Price Range">
          <PriceRangeSlider
            min={0}
            max={100000}
            step={500}
            value={[filters.priceRange.min, filters.priceRange.max]}
            onChange={({ min, max }) =>
              updateFilter("priceRange", { min, max })
            }
          />
        </FilterSection>
      </div>
    </div>
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
                placeholder="Search products..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
              />
            </div>
            <div className="flex px-6">
              <div className="md:ml-auto">
                <Select
                  value={filters.sort}
                  onValueChange={(v) => updateFilter("sort", v)}
                >
                  <SelectTrigger className="w-40">
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
              <div className="lg:hidden ml-auto">
                <Button
                  variant="ghost"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="relative"
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />

                  {hasActiveFilters && (
                    <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <ReusableDrawer
            open={mobileFiltersOpen}
            onOpenChange={setMobileFiltersOpen}
          >
            <FilterContent />
          </ReusableDrawer>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">
                No products found matching your criteria.
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear filters
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
