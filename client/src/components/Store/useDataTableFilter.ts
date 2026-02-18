import { create } from "zustand";
import { devtools } from "zustand/middleware";
export type DateRangeFilter = {
  from?: Date;
  to?: Date;
};

export type FiltersState = {
  search: string;
  dateRange: DateRangeFilter | null;
  [key: string]: string[] | string | DateRangeFilter | null;
};

type FilterStore = FiltersState & {
  setSearch: (search: string) => void;
  setFilter: (key: string, values: string[]) => void;
  setDateRange: (range: DateRangeFilter | null) => void;

  resetFilters: () => void;
  hasActiveFilters: () => boolean;
};

const initialState: FiltersState = {
  search: "",
  dateRange: null,
};

export const useDataTableFilterStore = create<FilterStore>()(
  devtools((set, get) => ({
    ...initialState,

    setSearch: (search) => set({ search }),
    setFilter: (key, values) => set((state) => ({ ...state, [key]: values })),
    setDateRange: (dateRange) => set({ dateRange }),

    resetFilters: () => set((state) => {
      const newState = { ...initialState };
      Object.keys(state).forEach(key => {
        if (key !== 'search' && key !== 'dateRange' && 
            typeof state[key as keyof typeof state] !== 'function') {
          newState[key] = [];
        }
      });
      return newState;
    }),

    hasActiveFilters: () => {
      const state = get();
      return (
        state.search !== "" ||
        Object.entries(state).some(([key, value]) => 
          key !== 'search' && key !== 'dateRange' && Array.isArray(value) && value.length > 0
        ) ||
        Boolean(state.dateRange?.from || state.dateRange?.to)
      );
    },
  })),
);
