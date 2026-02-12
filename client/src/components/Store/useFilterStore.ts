import { apiRequest } from "@/lib/queryClient";
import { CategoryWithSubcategories, Color, Fabric } from "@shared/schema";
import { produce } from "immer";
import { create } from "zustand";

type FilterState = {
  categories: CategoryWithSubcategories[];
  colors: Color[];
  fabrics: Fabric[];
  loading: boolean;
  error: string | null;

  fetchFilters: () => Promise<void>;
};

export const useFilterStore = create<FilterState>((set) => ({
  categories: [],
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

      const data = await apiRequest("GET", "/api/filters");

      set(
        produce((state: FilterState) => {
          state.categories = data.categories;
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
