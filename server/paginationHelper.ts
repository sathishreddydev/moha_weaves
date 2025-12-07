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
  const page = Math.max(parseInt(query.page as string) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize as string) || 10, 1), 100);
  const search = query.search as string | undefined;
  const dateFrom = query.dateFrom as string | undefined;
  const dateTo = query.dateTo as string | undefined;

  return { page, pageSize, search, dateFrom, dateTo };
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