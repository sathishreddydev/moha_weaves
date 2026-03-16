import { DataTable } from "@/components/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDataTable } from "@/hooks/use-data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { StockRequestWithDetails } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, Clock, Package, XCircle } from "lucide-react";
import { createRequestFilters } from "./Utils/filterUtils";
import { useMemo } from "react";
const statusConfig: Record<
  string,
  { icon: typeof Clock; label: string; color: string }
> = {
  pending: {
    icon: Clock,
    label: "Pending",
    color:
      "text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  },
  approved: {
    icon: CheckCircle,
    label: "Approved",
    color: "text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    color: "text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  },
  dispatched: {
    icon: Package,
    label: "Dispatched",
    color: "text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  },
  received: {
    icon: CheckCircle,
    label: "Received",
    color:
      "text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  },
};

export default function StoreRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const filters = useMemo(() => createRequestFilters(), []);
  const {
    data: requests,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    refetch,
  } = useDataTable<StockRequestWithDetails>({
    queryKey: "/api/store/requestsPaginated",
    initialPageSize: 10,
    pageKey:"storeRequest"
  });

  const markReceivedMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(
        "PATCH",
        `/api/store/requests/${id}/received`,
      );
      return response;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/store/products/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
      toast({ title: "Success", description: "Stock marked as received" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark as received",
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns: ColumnDef<StockRequestWithDetails>[] = [
    {
      accessorKey: "product.name",
      header: "Product",
      cell: ({ row }) => {
        const request = row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={
                request.product.imageUrl ||
                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
              }
              alt=""
              className="w-8 h-10 rounded object-cover"
            />
            <div>
              <p className="text-xs font-medium line-clamp-1">
                {request.product.name}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {request.product.sku}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.quantity} units
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Requested",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const request = row.original;
        const status = statusConfig[request.status] || statusConfig.pending;
        const StatusIcon = status.icon;
        return (
          <Badge className={status.color}>
            <StatusIcon className="text-xs h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <span className="text-xs max-w-[200px] truncate text-muted-foreground">
          {row.original.notes || "-"}
        </span>
      ),
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const request = row.original;
        return (
          <>
            {request.status === "dispatched" && (
              <Button
                size="sm"
                onClick={() =>
                  markReceivedMutation.mutate(request.id)
                }
                disabled={markReceivedMutation.isPending}
                data-testid={`button-received-${request.id}`}
                className="text-xs"
              >
                Mark Received
              </Button>
            )}
          </>
        );
      },
    },
  ];


  return (
    <div>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-xl font-semibold"
              data-testid="text-page-title"
            >
              Stock Requests
            </h1>
            <p className="text-sm text-muted-foreground">
              Request inventory from central warehouse
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <DataTable
              pageKey="storeRequest"
              columns={columns}
              data={requests}
              totalCount={totalCount}
              pageIndex={pageIndex}
              pageSize={pageSize}
              isLoading={isLoading}
              onPaginationChange={handlePaginationChange}
              searchPlaceholder="Search requests..."
              emptyMessage="No stock requests found"
              filters={filters} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
