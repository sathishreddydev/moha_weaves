import { FilterItem } from "@/pages/store/utils/types";
import type { CategoryWithSubcategories, Color, Fabric, Subcategory } from "@shared/schema";

export const createSaleFilters = (
  categories: CategoryWithSubcategories[],
  colors: Color[],
  fabrics: Fabric[]
): FilterItem[] => [
  {
    key: "categoryIds",
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
    key: "colorIds",
    label: "Colors",
    tree: colors.map((color) => ({
      id: color.id, 
      label: color.name,
      data: color,
    })),
    placeholder: "Search colors...",
  },
  {
    key: "fabricIds",
    label: "Fabrics",
    tree: fabrics.map((fabric) => ({
      id: fabric.id, 
      label: fabric.name,
      data: fabric,
    })),
    placeholder: "Search fabrics...",
  },
  {
    key: "sizes",
    label: "Sizes",
    tree: [
      { id: "XS", label: "XS" },
      { id: "S", label: "S" },
      { id: "M", label: "M" },
      { id: "L", label: "L" },
      { id: "XL", label: "XL" },
      { id: "XXL", label: "XXL" },
      { id: "3XL", label: "3XL" },
    ],
    placeholder: "Select sizes...",
  },
  {
    key: "featured",
    label: "Featured",
    tree: [
      { id: "true", label: "Featured Only" },
    ],
    placeholder: "Select featured status...",
  },
  {
    key: "onSale",
    label: "Sale Status",
    tree: [
      { id: "true", label: "On Sale Only" },
    ],
    placeholder: "Select sale status...",
  },
  {
    key: "inStock",
    label: "Stock Status",
    tree: [
      { id: "true", label: "In Stock Only" },
    ],
    placeholder: "Select stock status...",
  },
  {
    key: "sort",
    label: "Sort By",
    tree: [
      { id: "price-low", label: "Price: Low to High" },
      { id: "price-high", label: "Price: High to Low" },
      { id: "name", label: "Name: A to Z" },
      { id: "created-desc", label: "Newest First" },
    ],
    placeholder: "Select sort order...",
  },
];

export const createInventoryFilters = (
  categories: CategoryWithSubcategories[],
  colors: Color[],
  fabrics: Fabric[]
): FilterItem[] => [
  {
    key: "categoryIds",
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
    key: "colorIds",
    label: "Colors",
    tree: colors.map((color) => ({
      id: color.id, 
      label: color.name,
      data: color,
    })),
    placeholder: "Search colors...",
  },
  {
    key: "fabricIds",
    label: "Fabrics",
    tree: fabrics.map((fabric) => ({
      id: fabric.id, 
      label: fabric.name,
      data: fabric,
    })),
    placeholder: "Search fabrics...",
  },
  {
    key: "stockStatus",
    label: "Stock Status",
    tree: [
      { id: "in-stock", label: "In Stock" },
      { id: "low-stock", label: "Low Stock (≤10)" },
      { id: "out-of-stock", label: "Out of Stock" },
    ],
    placeholder: "Filter by stock status...",
  },
  {
    key: "featured",
    label: "Featured",
    tree: [
      { id: "true", label: "Featured Only" },
      { id: "false", label: "Not Featured" },
    ],
    placeholder: "Select featured status...",
  },
  {
    key: "sort",
    label: "Sort By",
    tree: [
      { id: "stock-asc", label: "Stock: Low to High" },
      { id: "stock-desc", label: "Stock: High to Low" },
      { id: "name", label: "Name: A to Z" },
      { id: "created-desc", label: "Newest First" },
    ],
    placeholder: "Select sort order...",
  },
];

export const createHistoryFilters = (): FilterItem[] => [
  {
    key: "sort",
    label: "Sort By",
    tree: [
      { id: "date-desc", label: "Newest First" },
      { id: "date-asc", label: "Oldest First" },
      { id: "amount-desc", label: "Highest Amount First" },
      { id: "amount-asc", label: "Lowest Amount First" },
    ],
    placeholder: "Select sort order...",
  },
];

export const createExchangeFilters = (): FilterItem[] => [
  {
    key: "exchangeType",
    label: "Exchange Type",
    tree: [
      { id: "exchange", label: "Exchange Only" },
      { id: "return", label: "Return Only" },
      { id: "both", label: "Exchange & Return" },
    ],
    placeholder: "Filter by exchange type...",
  },
  {
    key: "reason",
    label: "Reason",
    tree: [
      { id: "size", label: "Size Issue" },
      { id: "quality", label: "Quality Issue" },
      { id: "damage", label: "Damage" },
      { id: "wrong-item", label: "Wrong Item" },
      { id: "other", label: "Other" },
    ],
    placeholder: "Filter by reason...",
  },
  {
    key: "sort",
    label: "Sort By",
    tree: [
      { id: "date-desc", label: "Newest First" },
      { id: "date-asc", label: "Oldest First" },
    ],
    placeholder: "Select sort order...",
  },
];

export const createRequestFilters = (): FilterItem[] => [
  {
    key: "status",
    label: "Request Status",
    tree: [
      { id: "pending", label: "Pending" },
      { id: "approved", label: "Approved" },
      { id: "rejected", label: "Rejected" },
      { id: "completed", label: "Completed" },
    ],
    placeholder: "Filter by status...",
  },
  {
    key: "priority",
    label: "Priority",
    tree: [
      { id: "urgent", label: "Urgent" },
      { id: "high", label: "High" },
      { id: "normal", label: "Normal" },
      { id: "low", label: "Low" },
    ],
    placeholder: "Filter by priority...",
  },
  {
    key: "sort",
    label: "Sort By",
    tree: [
      { id: "date-desc", label: "Newest First" },
      { id: "date-asc", label: "Oldest First" },
      { id: "priority-desc", label: "Highest Priority First" },
    ],
    placeholder: "Select sort order...",
  },
];
