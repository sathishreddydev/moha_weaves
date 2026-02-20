import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Filter,
  Search,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { DateRange } from "react-day-picker";

import { TreeNode } from "@/lib/type";
import { useDataTableFilterStore } from "../Store/useDataTableFilter";
import { FilterItem } from "../Type/type";
import { RightFilterPanel } from "./RightFilterPanel";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount: number;
  pageSize: number;
  pageIndex: number;
  onPaginationChange: (pageIndex: number, pageSize: number) => void;
  onSearchChange?: (search: string) => void;
  onDateFilterChange?: (dateRange: { from?: Date; to?: Date } | null) => void;
  isLoading?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  hideSearch?: boolean;
  hideDateRange?: boolean;
  pageKey?: string;

  accordion?: boolean;
  accordionContent?: (row: TData) => React.ReactNode;
  accordionPosition?: "below" | "inline";
  defaultExpandedRows?: string[];
  onRowExpand?: (rowId: string, isExpanded: boolean) => void;

  categoryTree?: TreeNode[];
  filters?: FilterItem[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  totalCount,
  pageSize,
  pageIndex,
  onPaginationChange,
  isLoading = false,
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  hideSearch = false,
  hideDateRange = false,
  pageKey = 'default',
  accordion = false,
  accordionContent,
  accordionPosition = "below",
  defaultExpandedRows = [],
  onRowExpand,
  filters,
}: DataTableProps<TData, TValue>) {
  const filterStore = useDataTableFilterStore();
  const pageFilters = filterStore.getFilters(pageKey);
  
  const {
    setSearch,
    setDateRange,
    resetFilters,
    hasActiveFilters,
    setFilter,
  } = filterStore;

  // Get page-specific dynamic filters
  const dynamicFilters: Record<string, string[]> = {};
  Object.keys(pageFilters).forEach(key => {
    if (key !== 'search' && key !== 'dateRange' && Array.isArray(pageFilters[key])) {
      dynamicFilters[key] = pageFilters[key] as string[];
    }
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    new Set(defaultExpandedRows),
  );
  const [localSearch, setLocalSearch] = useState(pageFilters.search);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const pageCount = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearch(localSearch, pageKey);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [localSearch, setSearch, pageKey]);

  useEffect(() => {
    setLocalSearch(pageFilters.search);
  }, [pageFilters.search]);

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
      setLocalSearch(value);
    },
    [],
  );

  const toggleRowExpansion = useCallback(
    (rowId: string) => {
      const newExpanded = new Set(expandedRows);
      newExpanded.has(rowId)
        ? newExpanded.delete(rowId)
        : newExpanded.add(rowId);

      setExpandedRows(newExpanded);
      onRowExpand?.(rowId, newExpanded.has(rowId));
    },
    [expandedRows, onRowExpand],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {!hideSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {!hideDateRange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal w-[240px]",
                  !pageFilters.dateRange && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {pageFilters.dateRange?.from ? (
                  pageFilters.dateRange.to ? (
                    <>
                      {format(pageFilters.dateRange.from, "LLL dd, y")} -{" "}
                      {format(pageFilters.dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(pageFilters.dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Date range</span>
                )}
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={pageFilters.dateRange as DateRange | undefined}
                onSelect={(range) => {
                  const value =
                    range?.from || range?.to
                      ? { from: range?.from, to: range?.to }
                      : null;

                  setDateRange(value, pageKey);
                }}
                numberOfMonths={2}
              />

              {pageFilters.dateRange && (
                <div className="p-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateRange(null, pageKey);
                    }}
                    className="w-full"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {filters?.length && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFilterOpen(true)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        )}
      </div>

      {hasActiveFilters(pageKey) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center">
            <Filter className="h-4 w-4 mr-1" />
            Active filters:
          </span>

          {!hideSearch && localSearch && (
            <Badge variant="secondary" className="gap-1">
              Search: {localSearch}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleSearchChange("")}
              />
            </Badge>
          )}

          {!hideDateRange && pageFilters.dateRange?.from && (
            <Badge variant="secondary" className="gap-1">
              Date: {format(pageFilters.dateRange.from, "MMM dd")}
              {pageFilters.dateRange.to && ` - ${format(pageFilters.dateRange.to, "MMM dd")}`}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  setDateRange(null, pageKey);
                }}
              />
            </Badge>
          )}

          {/* Display dynamic filters */}
          {Object.entries(dynamicFilters).map(([key, values]) => {
            if (Array.isArray(values) && values.length > 0) {
              const filterConfig = filters?.find(f => f.key === key);
              const label = filterConfig?.label || key;
              return (
                <Badge key={key} variant="secondary" className="gap-1">
                  {label}: {values.length} selected
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      setFilter(key, [], pageKey);
                    }}
                  />
                </Badge>
              );
            }
            return null;
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetFilters(pageKey);
            }}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table className="[&_table]:text-xs [&_th]:h-12 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
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
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const rowId = String(row.id);
                const isExpanded = expandedRows.has(rowId);

                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className={
                        accordion && accordionPosition === "inline"
                          ? "cursor-pointer hover:bg-muted/50"
                          : ""
                      }
                      onClick={() =>
                        accordion &&
                        accordionPosition === "inline" &&
                        toggleRowExpansion(rowId)
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                      {accordion && accordionPosition === "inline" && (
                        <TableCell className="w-12">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(rowId);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>

                    {accordion && isExpanded && accordionContent && (
                      <TableRow>
                        <TableCell colSpan={columns.length + 1}>
                          <div className="p-4 bg-muted/30 border-b">
                            {accordionContent(row.original)}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
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
          {Math.min((pageIndex + 1) * pageSize, totalCount)} of {totalCount}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPaginationChange(0, Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPaginationChange(0, pageSize)}
            disabled={pageIndex === 0}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPaginationChange(pageIndex - 1, pageSize)}
            disabled={pageIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPaginationChange(pageIndex + 1, pageSize)}
            disabled={pageIndex >= pageCount - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPaginationChange(pageCount - 1, pageSize)}
            disabled={pageIndex >= pageCount - 1}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <RightFilterPanel
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        filters={filters}
        pageKey={pageKey}
      />
    </div>
  );
}
