import React, { useState, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import {
  Package,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DataTable, FilterConfig } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import type { OrderWithItems } from "@shared/schema";
import { itemStatusConfig } from "@/constants/itemStatusConfig";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

// Status options provided by user
const itemStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

const getItemStatusFlow = (currentStatus: string) => {
  const flow: Record<string, string[]> = {
    pending: ["confirmed"],
    confirmed: ["processing"],
    processing: ["shipped"],
    shipped: ["delivered"],
    delivered: [],
  };
  return flow[currentStatus] || [];
};

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = itemStatusConfig[status] || itemStatusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center w-fit capitalize ${config.color}`}>
      <StatusIcon size={12} className="mr-1" />
      {config.label}
    </span>
  );
};

export default function InventoryOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const {
    data: orders,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    handleSearchChange,
    handleFiltersChange,
    handleDateFilterChange,
    refetch,
  } = useDataTable<OrderWithItems>({
    queryKey: "/api/inventory/orders",
    initialPageSize: 10,
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/orders/${orderId}/items/${itemId}/status`,
        { status }
      );
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Item status updated" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      const extracted = message.includes(":") ? message.split(":").slice(1).join(":").trim() : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update item status",
        variant: "destructive",
      });
    },
  });

  const updateAllItemsStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/inventory/orders/${orderId}/status`,
        { status }
      );
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "All items status updated" });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      const extracted = message.includes(":") ? message.split(":").slice(1).join(":").trim() : "";
      toast({
        title: "Error",
        description: extracted || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const updateItemStatus = (orderId: string, itemId: string, newStatus: string) => {
    updateItemStatusMutation.mutate({ orderId, itemId, status: newStatus });
  };

  const updateAllItemsStatus = (orderId: string, newStatus: string) => {
    updateAllItemsStatusMutation.mutate({ orderId, status: newStatus });
  };

  const columns: ColumnDef<OrderWithItems>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "Order",
        cell: ({ row }) => (
          <div>
            <div className="font-bold text-primary flex items-center gap-1 cursor-pointer hover:underline" onClick={() => navigate(`/inventory/orders/${row.original.id}`)}>
              #{row.original.id}
              <ExternalLink size={12} className="opacity-40" />
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Calendar size={12} />
              {formatDate(row.original.createdAt)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
              <User size={16} />
            </div>
            <div>
              <div className="font-medium text-sm text-slate-800">
                {row.original.customerName || 'Unknown Customer'}
              </div>
              <div className="text-xs text-slate-500">{row.original.phone || 'No phone'}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "items",
        header: "Items",
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div>
              <div className="flex -space-x-2">
                {(order.items || []).slice(0, 3).map((item, idx) => (
                  <div key={idx} className="h-7 w-7 rounded border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 overflow-hidden">
                    <img
                      src={item.product?.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=20"}
                      alt={item.product?.name || "Item"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {(order.items?.length || 0) > 3 && (
                  <div className="h-7 w-7 rounded border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    +{(order.items?.length || 0) - 3}
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">{(order.items?.length || 0)} product(s)</div>
            </div>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        cell: ({ row }) => (
          <div className="font-bold text-slate-900">
            {formatPrice(row.original.totalAmount)}
          </div>
        ),
      },
      
    ],
    [navigate, updateAllItemsStatus, updateItemStatus, updateItemStatusMutation.isPending]
  );

  const accordionContent = (order: OrderWithItems) => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Package size={20} className="text-slate-400" />
          Order Details
        </h3>
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 px-2 uppercase tracking-wider">Bulk Update Order:</span>
          <div className="flex gap-1">
            {itemStatuses.map(status => (
              <Button
                variant={'ghost'}
                key={status}
                onClick={() => updateAllItemsStatus(order.id, status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {(order.items || []).map((item) => (
          <div
            key={item.id}
            className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                <img
                  src={item.product?.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=40"}
                  alt={item.product?.name || "Item"}
                  className="w-8 h-8 object-cover rounded"
                />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">{item.product?.name || 'Unknown Item'}</h4>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span>SKU: {item.id}</span>
                  <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                  <span>Qty: {item.quantity}</span>
                  <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                  <span>{formatPrice(item.price)} each</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex flex-col items-start md:items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Current Status</span>
                <StatusBadge status={item.status} />
              </div>

              <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

              <div className="w-full md:w-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block md:text-right">Change Status</span>
                <select
                  value={item.status}
                  onChange={(e) => updateItemStatus(order.id, item.id, e.target.value)}
                  className="w-full md:w-auto text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  disabled={updateItemStatusMutation.isPending}
                >
                  {itemStatuses.map(status => {
                    const config = itemStatusConfig[status];
                    return (
                      <option key={status} value={status} className="capitalize">{config?.label || status}</option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Item Status",
      options: itemStatuses.map(status => ({
        value: status,
        label: itemStatusConfig[status]?.label || status,
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        <DataTable
          columns={columns}
          data={orders || []}
          totalCount={totalCount || 0}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPaginationChange={handlePaginationChange}
          onSearchChange={handleSearchChange}
          onFiltersChange={handleFiltersChange}
          onDateFilterChange={handleDateFilterChange}
          isLoading={isLoading}
          searchPlaceholder="Search by Order ID or Customer..."
          filters={filters}
          emptyMessage="No orders found"
          accordion={true}
          accordionContent={accordionContent}
          accordionPosition="inline"
        />
      </div>
    </div>
  );
}