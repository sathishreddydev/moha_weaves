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
import React, { useCallback, useState } from "react";
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
  accordion = false,
  accordionContent,
  accordionPosition = "below",
  defaultExpandedRows = [],
  onRowExpand,
  filters,
}: DataTableProps<TData, TValue>) {
  const {
    search,
    setSearch,
    dateRange,
    setDateRange,
    resetFilters,
    hasActiveFilters,
  } = useDataTableFilterStore();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    new Set(defaultExpandedRows),
  );

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
      setSearch(value);
    },
    [setSearch],
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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal w-[240px]",
                !dateRange && "text-muted-foreground",
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
                <span>Date range</span>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange as DateRange | undefined}
              onSelect={(range) => {
                const value =
                  range?.from || range?.to
                    ? { from: range?.from, to: range?.to }
                    : null;

                setDateRange(value);
              }}
              numberOfMonths={2}
            />

            {dateRange && (
              <div className="p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateRange(null);
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

      {hasActiveFilters() && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center">
            <Filter className="h-4 w-4 mr-1" />
            Active filters:
          </span>

          {search && (
            <Badge variant="secondary" className="gap-1">
              Search: {search}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleSearchChange("")}
              />
            </Badge>
          )}

          {dateRange?.from && (
            <Badge variant="secondary" className="gap-1">
              Date: {format(dateRange.from, "MMM dd")}
              {dateRange.to && ` - ${format(dateRange.to, "MMM dd")}`}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  setDateRange(null);
                }}
              />
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetFilters();
            }}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table className={className}>
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
      />
    </div>
  );
}
