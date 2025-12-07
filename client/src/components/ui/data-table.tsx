import { useState, useEffect, useCallback } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Calendar as CalendarIcon,
  X,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface DateFilterConfig {
  key: string;
  label: string;
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount: number;
  pageSize: number;
  pageIndex: number;
  onPaginationChange: (pageIndex: number, pageSize: number) => void;
  onSearchChange?: (search: string) => void;
  onFiltersChange?: (filters: Record<string, string>) => void;
  onDateFilterChange?: (dateRange: { from?: Date; to?: Date } | null) => void;
  isLoading?: boolean;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  dateFilter?: DateFilterConfig;
  emptyMessage?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  totalCount,
  pageSize,
  pageIndex,
  onPaginationChange,
  onSearchChange,
  onFiltersChange,
  onDateFilterChange,
  isLoading = false,
  searchPlaceholder = "Search...",
  filters = [],
  dateFilter,
  emptyMessage = "No results found.",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [searchValue, setSearchValue] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const pageCount = Math.ceil(totalCount / pageSize);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
  });

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      const timeout = setTimeout(() => {
        onSearchChange?.(value);
      }, 300);
      setSearchTimeout(timeout);
    },
    [onSearchChange, searchTimeout]
  );

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      const newFilters = { ...activeFilters };
      if (value === "all" || value === "") {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      setActiveFilters(newFilters);
      onFiltersChange?.(newFilters);
    },
    [activeFilters, onFiltersChange]
  );

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      setDateRange(range);
      if (range?.from || range?.to) {
        onDateFilterChange?.({ from: range.from, to: range.to });
      } else {
        onDateFilterChange?.(null);
      }
    },
    [onDateFilterChange]
  );

  const clearDateFilter = useCallback(() => {
    setDateRange(undefined);
    onDateFilterChange?.(null);
  }, [onDateFilterChange]);

  const clearAllFilters = useCallback(() => {
    setSearchValue("");
    setActiveFilters({});
    setDateRange(undefined);
    onSearchChange?.("");
    onFiltersChange?.({});
    onDateFilterChange?.(null);
  }, [onSearchChange, onFiltersChange, onDateFilterChange]);

  const hasActiveFilters =
    searchValue !== "" ||
    Object.keys(activeFilters).length > 0 ||
    dateRange?.from ||
    dateRange?.to;

  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {onSearchChange && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <Select
                key={filter.key}
                value={activeFilters[filter.key] || "all"}
                onValueChange={(value) => handleFilterChange(filter.key, value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {filter.label}</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}

            {dateFilter && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal w-[240px]",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>{dateFilter.label}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={handleDateRangeChange}
                    numberOfMonths={2}
                  />
                  {dateRange && (
                    <div className="p-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearDateFilter}
                        className="w-full"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Clear date filter
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground flex items-center">
              <Filter className="h-4 w-4 mr-1" />
              Active filters:
            </span>
            {searchValue && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchValue}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleSearchChange("")}
                />
              </Badge>
            )}
            {Object.entries(activeFilters).map(([key, value]) => {
              const filter = filters.find((f) => f.key === key);
              const option = filter?.options.find((o) => o.value === value);
              return (
                <Badge key={key} variant="secondary" className="gap-1">
                  {filter?.label}: {option?.label || value}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleFilterChange(key, "all")}
                  />
                </Badge>
              );
            })}
            {dateRange?.from && (
              <Badge variant="secondary" className="gap-1">
                Date: {format(dateRange.from, "MMM dd")}
                {dateRange.to && ` - ${format(dateRange.to, "MMM dd")}`}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={clearDateFilter}
                />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(pageSize)].map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Showing {pageIndex * pageSize + 1} to{" "}
          {Math.min((pageIndex + 1) * pageSize, totalCount)} of {totalCount}{" "}
          results
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPaginationChange(0, Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPaginationChange(0, pageSize)}
              disabled={pageIndex === 0}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPaginationChange(pageIndex - 1, pageSize)}
              disabled={pageIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {pageIndex + 1} of {pageCount || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPaginationChange(pageIndex + 1, pageSize)}
              disabled={pageIndex >= pageCount - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPaginationChange(pageCount - 1, pageSize)}
              disabled={pageIndex >= pageCount - 1}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
