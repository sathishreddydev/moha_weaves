import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataTableFilterStore } from "@/components/Store/useDataTableFilter";
import { apiRequest } from "@/lib/queryClient";

export interface TableParams {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
}

export interface UseDataTableOptions<T> {
  queryKey: string;
  initialPageSize?: number;
  buildUrl?: (params: TableParams) => string;
  method?: "GET" | "POST";
  pageKey?: string;
}

export function useDataTable<T>({
  queryKey,
  initialPageSize = 10,
  method = "POST",
  pageKey = 'default',
}: UseDataTableOptions<T>) {
  const queryClient = useQueryClient();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const filterStore = useDataTableFilterStore();
  const [filterUpdateTrigger, setFilterUpdateTrigger] = useState(0);
  const pageFilters = useMemo(() => {
    return filterStore.getFilters(pageKey);
  }, [filterStore, pageKey, filterUpdateTrigger]);

  useEffect(() => {
    let lastFilters = JSON.stringify(filterStore.getFilters(pageKey));

    const interval = setInterval(() => {
      const currentFilters = JSON.stringify(filterStore.getFilters(pageKey));
      if (currentFilters !== lastFilters) {
        lastFilters = currentFilters;
        setFilterUpdateTrigger(prev => prev + 1);
      }
    }, 300); // Check every 300ms

    return () => clearInterval(interval);
  }, [filterStore, pageKey]);

  const { search, dateRange, ...dynamicFilters } = pageFilters;

  const params: TableParams = useMemo(
    () => ({
      page: pageIndex + 1,
      pageSize,
      search: search || undefined,
      dateFrom: dateRange?.from?.toISOString(),
      dateTo: dateRange?.to?.toISOString(),
      ...dynamicFilters,
    }),
    [pageIndex, pageSize, search, dateRange, dynamicFilters, filterUpdateTrigger],
  );
  const queryParams = useMemo(
    () => ({
      page: pageIndex + 1,
      pageSize,
    }),
    [pageIndex, pageSize],
  );

  const requestBody = useMemo(
    () => ({
      ...(search && { search }),
      ...(dateRange?.from && {
        dateFrom: dateRange.from.toISOString(),
      }),
      ...(dateRange?.to && {
        dateTo: dateRange.to.toISOString(),
      }),
      ...Object.entries(dynamicFilters).reduce((acc, [key, value]) => {
        if (key === 'sort') {
          // Handle sort filter - could be array or string
          if (Array.isArray(value)) {
            if (value.length > 0) {
              acc[key] = value[0]; // Extract first element if array
            }
          } else if (value) {
            acc[key] = value; // Use as-is if string
          }
        } else if (Array.isArray(value) && value.length > 0) {
          acc[key] = value; // Send other filters as arrays
        }
        return acc;
      }, {} as Record<string, any>),
    }),
    [search, dateRange, dynamicFilters, filterUpdateTrigger],
  );

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(queryParams.page));
    params.set("pageSize", String(queryParams.pageSize));

    return `${queryKey}?${params.toString()}`;
  }, [queryKey, queryParams]);
  const queryFn = useCallback(async (): Promise<PaginatedResponse<T>> => {
    const res = await apiRequest(method, url, requestBody);
    return res;
  }, [url, requestBody]);

  const { data, isLoading, isFetching, error, refetch } = useQuery<
    PaginatedResponse<T>
  >({
    queryKey: [queryKey, params],
    queryFn,
  });

  const handlePaginationChange = useCallback(
    (newPageIndex: number, newPageSize: number) => {
      if (newPageSize !== pageSize) {
        setPageIndex(0);
        setPageSize(newPageSize);
      } else {
        setPageIndex(newPageIndex);
      }
    },
    [pageSize],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  }, [queryClient, queryKey]);
  return {
    data: data?.data ?? [],
    totalCount: data?.total ?? 0,

    totalProducts: data?.totalProducts ?? 0,
    inStockProducts: data?.inStockProducts ?? 0,
    outOfStockProducts: data?.outOfStockProducts ?? 0,

    pageIndex,
    pageSize,

    isLoading,
    isFetching,
    error,

    handlePaginationChange,
    refetch,
    invalidate,
  };
}
