import type {
  CategoryWithSubcategories,
  Color,
  Fabric,
  Subcategory,
} from "@shared/schema";
import { FilterItem } from "./type";
import {
  FilterKey,
  StockStatus,
  FeaturedStatus,
  SortOption,
  DamageCategory,
  DamageSeverity,
  DamageSource,
} from "./enums";
import { transformOptions } from "../components/common";

export const damageSources = [
  { value: DamageSource.STORE, label: "In-Store" },
  { value: DamageSource.WAREHOUSE, label: "Warehouse" },
  { value: DamageSource.ONLINE_RETURN, label: "Online Return" },
  { value: DamageSource.SHIPPING, label: "Shipping" },
  { value: DamageSource.MANUFACTURING, label: "Manufacturing" },
];

export const damageCategories = [
  { value: DamageCategory.MANUFACTURING_DEFECT, label: "Manufacturing Defect" },
  { value: DamageCategory.SHIPPING_DAMAGE, label: "Shipping Damage" },
  { value: DamageCategory.STORAGE_DAMAGE, label: "Storage Damage" },
  { value: DamageCategory.HANDLING_DAMAGE, label: "Handling Damage" },
  { value: DamageCategory.CUSTOMER_DAMAGE, label: "Customer Damage" },
  { value: DamageCategory.EXPIRED, label: "Expired" },
  { value: DamageCategory.THEFT_LOSS, label: "Theft/Loss" },
  { value: DamageCategory.OTHER, label: "Other" },
];

export const damageSeverities = [
  { value: DamageSeverity.MINOR, label: "Minor" },
  { value: DamageSeverity.MAJOR, label: "Major" },
  { value: DamageSeverity.TOTAL_LOSS, label: "Total Loss" },
];
export const inventoryFilters = (
  categories: CategoryWithSubcategories[],
  colors: Color[],
  fabrics: Fabric[],
): FilterItem[] => [
    {
      key: FilterKey.CATEGORY_IDS,
      label: "Categories",
      tree: categories.map((cat) => ({
        id: cat.id,
        label: cat.name,
        data: cat,
        children:
          cat?.subcategories?.map((sub: Subcategory) => ({
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

export const DamageFilters = (): FilterItem[] => [
  {
    key: "category",
    label: "Category",
    placeholder: "Filter by category",
    tree: transformOptions(damageCategories),
  },
  {
    key: "severity",
    label: "Severity",
    placeholder: "Filter by severity",
    tree: transformOptions(damageSeverities),
  },
  {
    key: "source",
    label: "Source",
    placeholder: "Filter by source",
    tree: transformOptions(damageSources),
  },
];
