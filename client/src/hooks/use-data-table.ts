import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface TableParams {
  page: number;
  pageSize: number;
  search?: string;
  filters?: Record<string, string>;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UseDataTableOptions<T> {
  queryKey: string;
  initialPageSize?: number;
  buildUrl?: (params: TableParams) => string;
}

export function useDataTable<T>({
  queryKey,
  initialPageSize = 10,
  buildUrl,
}: UseDataTableOptions<T>) {
  const queryClient = useQueryClient();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | null>(null);

  const params: TableParams = useMemo(
    () => ({
      page: pageIndex + 1,
      pageSize,
      search: search || undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      dateFrom: dateRange?.from?.toISOString(),
      dateTo: dateRange?.to?.toISOString(),
    }),
    [pageIndex, pageSize, search, filters, dateRange]
  );

  const url = useMemo(() => {
    if (buildUrl) return buildUrl(params);

    const searchParams = new URLSearchParams();
    searchParams.set("page", String(params.page));
    searchParams.set("pageSize", String(params.pageSize));

    if (params.search) searchParams.set("search", params.search);
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        searchParams.set(key, value);
      });
    }
    if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
    if (params.dateTo) searchParams.set("dateTo", params.dateTo);

    return `${queryKey}?${searchParams.toString()}`;
  }, [queryKey, params, buildUrl]);

  const queryFn = useCallback(async (): Promise<PaginatedResponse<T>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
  }, [url]);

  const { data, isLoading, error, refetch,isFetching } = useQuery<PaginatedResponse<T>>({
    queryKey: [queryKey, params],
    queryFn,
    placeholderData: (previousData) => previousData,
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
    [pageSize]
  );

  const handleSearchChange = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setPageIndex(0);
  }, []);

  const handleFiltersChange = useCallback((newFilters: Record<string, string>) => {
    setFilters(newFilters);
    setPageIndex(0);
  }, []);

  const handleDateFilterChange = useCallback(
    (newDateRange: { from?: Date; to?: Date } | null) => {
      setDateRange(newDateRange);
      setPageIndex(0);
    },
    []
  );

  const resetFilters = useCallback(() => {
    setSearch("");
    setFilters({});
    setDateRange(null);
    setPageIndex(0);
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [queryKey],
    });
  }, [queryClient, queryKey]);

  return {
    data: data?.data ?? [],
    totalCount: data?.total ?? 0,
    pageIndex,
    pageSize,
    isLoading,
    isFetching,
    error,
    search,
    filters,
    dateRange,
    handlePaginationChange,
    handleSearchChange,
    handleFiltersChange,
    handleDateFilterChange,
    resetFilters,
    refetch,
    invalidate,
  };
}
