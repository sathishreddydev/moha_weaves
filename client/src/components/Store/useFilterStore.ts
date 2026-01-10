import { create } from "zustand";
import { produce } from "immer";
import { Category, Color, Fabric, Subcategory, CategoryWithSubcategories } from "@shared/schema";

type FilterState = {
  categories: CategoryWithSubcategories[];
  subcategories: Subcategory[];
  colors: Color[];
  fabrics: Fabric[];
  loading: boolean;
  error: string | null;

  fetchFilters: () => Promise<void>;
};

export const useFilterStore = create<FilterState>((set) => ({
  categories: [],
  subcategories: [],
  colors: [],
  fabrics: [],
  loading: false,
  error: null,

  fetchFilters: async () => {
    try {
      set(
        produce((state: FilterState) => {
          state.loading = true;
          state.error = null;
        })
      );

      const res = await fetch("/api/filters");
      if (!res.ok) throw new Error();

      const data = await res.json();

      // Extract subcategories from categories
      const allSubcategories = data.categories.flatMap((cat: CategoryWithSubcategories) => cat.subcategories || []);

      set(
        produce((state: FilterState) => {
          state.categories = data.categories;
          state.subcategories = allSubcategories;
          state.colors = data.colors;
          state.fabrics = data.fabrics;
        })
      );
    } catch {
      set(
        produce((state: FilterState) => {
          state.error = "Failed to load filters";
        })
      );
    } finally {
      set(
        produce((state: FilterState) => {
          state.loading = false;
        })
      );
    }
  },
}));
