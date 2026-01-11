import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataTableFilterStore } from "@/components/Store/useDataTableFilter";
import { apiRequest } from "@/lib/queryClient";

export interface TableParams {
  page: number;
  pageSize: number;
  search?: string;

  categoryIds?: string[];
  colorIds?: string[];
  fabricIds?: string[];

  dateFrom?: string;
  dateTo?: string;
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
}

export function useDataTable<T>({
  queryKey,
  initialPageSize = 10,
  buildUrl,
}: UseDataTableOptions<T>) {
  const queryClient = useQueryClient();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const { search, categoryIds, colorIds, fabricIds, dateRange } =
    useDataTableFilterStore();

  const params: TableParams = useMemo(
    () => ({
      page: pageIndex + 1,
      pageSize,

      search: search || undefined,

      categoryIds: categoryIds.length ? categoryIds : undefined,
      colorIds: colorIds.length ? colorIds : undefined,
      fabricIds: fabricIds.length ? fabricIds : undefined,

      dateFrom: dateRange?.from?.toISOString(),
      dateTo: dateRange?.to?.toISOString(),
    }),
    [pageIndex, pageSize, search, categoryIds, colorIds, fabricIds, dateRange],
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

      ...(categoryIds.length && { categoryIds }),
      ...(colorIds.length && { colorIds }),
      ...(fabricIds.length && { fabricIds }),

      ...(dateRange?.from && {
        dateFrom: dateRange.from.toISOString(),
      }),
      ...(dateRange?.to && {
        dateTo: dateRange.to.toISOString(),
      }),
    }),
    [search, categoryIds, colorIds, fabricIds, dateRange],
  );

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(queryParams.page));
    params.set("pageSize", String(queryParams.pageSize));

    return `${queryKey}?${params.toString()}`;
  }, [queryKey, queryParams]);
  const queryFn = useCallback(async (): Promise<PaginatedResponse<T>> => {
    console.log(requestBody);

    const res = await apiRequest("POST", url, requestBody);
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
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
