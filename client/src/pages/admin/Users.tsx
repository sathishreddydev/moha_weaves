import { useMemo } from "react";
import { Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import type { User } from "@shared/schema";

type SafeUser = Omit<User, "password">;

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function AdminUsers() {
  const {
    data: users,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    handleSearchChange,
    handleDateFilterChange,
  } = useDataTable<SafeUser>({
    queryKey: "/api/admin/users",
    initialPageSize: 10,
    buildUrl: (params) => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(params.page));
      searchParams.set("pageSize", String(params.pageSize));
      searchParams.set("role", "user");
      
      if (params.search) {
        searchParams.set("search", params.search);
      }
      if (params.dateFrom) {
        searchParams.set("dateFrom", params.dateFrom);
      }
      if (params.dateTo) {
        searchParams.set("dateTo", params.dateTo);
      }
      return `/api/admin/users?${searchParams.toString()}`;
    },
  });

  const columns: ColumnDef<SafeUser>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            {row.original.email}
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) =>
          row.original.phone ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              {row.original.phone}
            </div>
          ) : (
            "-"
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Joined",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    []
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Users
        </h1>
        <p className="text-muted-foreground">
          View registered customer accounts
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <DataTable
            columns={columns}
            data={users}
            totalCount={totalCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPaginationChange={handlePaginationChange}
            onSearchChange={handleSearchChange}
            onDateFilterChange={handleDateFilterChange}
            isLoading={isLoading}
            searchPlaceholder="Search users..."
            dateFilter={{ key: "date", label: "Filter by join date" }}
            emptyMessage="No users found"
          />
        </CardContent>
      </Card>
    </div>
  );
}
