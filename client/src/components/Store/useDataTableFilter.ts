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
  setSearch: (search: string, pageKey?: string) => void;
  setFilter: (key: string, values: string[], pageKey?: string) => void;
  setDateRange: (range: DateRangeFilter | null, pageKey?: string) => void;

  resetFilters: (pageKey?: string) => void;
  hasActiveFilters: (pageKey?: string) => boolean;
  getFilters: (pageKey: string) => FiltersState;
};

const initialState: FiltersState = {
  search: "",
  dateRange: null,
};

export const useDataTableFilterStore = create<FilterStore>()(
  devtools((set, get) => {
    const store: Record<string, FiltersState> = {
      default: { ...initialState }
    };

    return {
      // Backward compatibility - use default page
      get search() { return store.default.search; },
      get dateRange() { return store.default.dateRange; },
      
      setSearch: (search, pageKey = 'default') => {
        store[pageKey] = { ...store[pageKey], search };
        // Always trigger update for reactive subscriptions
        set({ [`search_${pageKey}`]: search });
      },
      
      setFilter: (key, values, pageKey = 'default') => {
        store[pageKey] = { ...store[pageKey], [key]: values };
        // Always trigger update for reactive subscriptions
        set({ [`${key}_${pageKey}`]: values });
      },
      
      setDateRange: (dateRange, pageKey = 'default') => {
        store[pageKey] = { ...store[pageKey], dateRange };
        // Always trigger update for reactive subscriptions
        set({ [`dateRange_${pageKey}`]: dateRange });
      },

      resetFilters: (pageKey = 'default') => {
        store[pageKey] = { ...initialState };
        if (pageKey === 'default') {
          set(initialState);
        }
      },

      hasActiveFilters: (pageKey = 'default') => {
        const state = store[pageKey] || initialState;
        return (
          state.search !== "" ||
          Object.entries(state).some(([key, value]) => 
            key !== 'search' && key !== 'dateRange' && Array.isArray(value) && value.length > 0
          ) ||
          Boolean(state.dateRange?.from || state.dateRange?.to)
        );
      },

      getFilters: (pageKey: string) => {
        return store[pageKey] || { ...initialState };
      },
    };
  }),
);
