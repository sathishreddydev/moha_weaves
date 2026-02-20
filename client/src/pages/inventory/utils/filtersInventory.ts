import type { CategoryWithSubcategories, Color, Fabric, Subcategory } from "@shared/schema";
import { FilterItem } from "./type";
import { FilterKey, StockStatus, FeaturedStatus, SortOption } from "./enums";

export const createInventoryFilters = (
  categories: CategoryWithSubcategories[],
  colors: Color[],
  fabrics: Fabric[]
): FilterItem[] => [
  {
    key: FilterKey.CATEGORY_IDS,
    label: "Categories",
    tree: categories.map((cat) => ({
      id: cat.id, 
      label: cat.name,
      data: cat,
      children: cat?.subcategories?.map((sub: Subcategory) => ({
        id: sub.id, 
        label: sub.name,
      })) || [],
    })),
    placeholder: "Search categories...",
  },
  {
    key: FilterKey.COLOR_IDS,
    label: "Colors",
    tree: colors.map((color) => ({
      id: color.id, 
      label: color.name,
      data: color,
    })),
    placeholder: "Search colors...",
  },
  {
    key: FilterKey.FABRIC_IDS,
    label: "Fabrics",
    tree: fabrics.map((fabric) => ({
      id: fabric.id, 
      label: fabric.name,
      data: fabric,
    })),
    placeholder: "Search fabrics...",
  },
  {
    key: FilterKey.STOCK_STATUS,
    label: "Stock Status",
    tree: [
      { id: StockStatus.IN_STOCK, label: "In Stock" },
      { id: StockStatus.LOW_STOCK, label: "Low Stock (≤10)" },
      { id: StockStatus.OUT_OF_STOCK, label: "Out of Stock" },
    ],
    placeholder: "Filter by stock status...",
  },
  {
    key: FilterKey.FEATURED,
    label: "Featured",
    tree: [
      { id: FeaturedStatus.FEATURED, label: "Featured Only" },
      { id: FeaturedStatus.NOT_FEATURED, label: "Not Featured" },
    ],
    placeholder: "Select featured status...",
  },
  {
    key: FilterKey.SORT,
    label: "Sort By",
    tree: [
      { id: SortOption.STOCK_ASC, label: "Stock: Low to High" },
      { id: SortOption.STOCK_DESC, label: "Stock: High to Low" },
      { id: SortOption.NAME_ASC, label: "Name: A to Z" },
      { id: SortOption.CREATED_DESC, label: "Newest First" },
    ],
    placeholder: "Select sort order...",
  },
];