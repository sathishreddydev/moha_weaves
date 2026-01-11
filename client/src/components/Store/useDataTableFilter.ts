import { create } from "zustand";
import { devtools } from "zustand/middleware";
export type DateRangeFilter = {
  from?: Date;
  to?: Date;
};

export type FiltersState = {
  search: string;
  categoryIds: string[];
  colorIds: string[];
  fabricIds: string[];
  dateRange: DateRangeFilter | null;
};

type FilterStore = FiltersState & {
  setSearch: (search: string) => void;
  setCategoryIds: (ids: string[]) => void;
  setColorIds: (ids: string[]) => void;
  setFabricIds: (ids: string[]) => void;
  setDateRange: (range: DateRangeFilter | null) => void;

  resetFilters: () => void;
  hasActiveFilters: () => boolean;
};

const initialState: FiltersState = {
  search: "",
  categoryIds: [],
  colorIds: [],
  fabricIds: [],
  dateRange: null,
};

export const useDataTableFilterStore = create<FilterStore>()(
  devtools((set, get) => ({
    ...initialState,

    setSearch: (search) => set({ search }),
    setCategoryIds: (categoryIds) => set({ categoryIds }),
    setColorIds: (colorIds) => set({ colorIds }),
    setFabricIds: (fabricIds) => set({ fabricIds }),
    setDateRange: (dateRange) => set({ dateRange }),

    resetFilters: () => set({ ...initialState }),

    hasActiveFilters: () => {
      const state = get();
      return (
        state.search !== "" ||
        state.categoryIds.length > 0 ||
        state.colorIds.length > 0 ||
        state.fabricIds.length > 0 ||
        Boolean(state.dateRange?.from || state.dateRange?.to)
      );
    },
  })),
);
