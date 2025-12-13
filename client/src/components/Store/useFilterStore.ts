import { create } from "zustand";
import { produce } from "immer";
import { Category, Color, Fabric } from "@shared/schema";

type FilterState = {
  categories: Category[];
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

      const res = await fetch("/api/filters");
      if (!res.ok) throw new Error();

      const data = await res.json();

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
