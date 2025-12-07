export interface PaginationParams {
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
}

export function parsePaginationParams(query: any): PaginationParams {
  return {
    page: Math.max(1, parseInt(query.page as string) || 1),
    pageSize: Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 10)),
    search: query.search as string | undefined,
    dateFrom: query.dateFrom as string | undefined,
    dateTo: query.dateTo as string | undefined,
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function getOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
