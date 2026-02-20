import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Calendar, Download, Package, Eye } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { FilterItem } from "@/components/Type/type";
import { transformOptions } from "./components/common";
import { DamageSource, DamageCategory, DamageSeverity, SeverityColors, UserRole } from "./utils/enums";
import type { ProductDamage, DamageAnalytics } from "./utils/type";


const damageSources = [
  { value: DamageSource.STORE, label: "In-Store" },
  { value: DamageSource.WAREHOUSE, label: "Warehouse" },
  { value: DamageSource.ONLINE_RETURN, label: "Online Return" },
  { value: DamageSource.SHIPPING, label: "Shipping" },
  { value: DamageSource.MANUFACTURING, label: "Manufacturing" },
];

const damageCategories = [
  { value: DamageCategory.MANUFACTURING_DEFECT, label: "Manufacturing Defect" },
  { value: DamageCategory.SHIPPING_DAMAGE, label: "Shipping Damage" },
  { value: DamageCategory.STORAGE_DAMAGE, label: "Storage Damage" },
  { value: DamageCategory.HANDLING_DAMAGE, label: "Handling Damage" },
  { value: DamageCategory.CUSTOMER_DAMAGE, label: "Customer Damage" },
  { value: DamageCategory.EXPIRED, label: "Expired" },
  { value: DamageCategory.THEFT_LOSS, label: "Theft/Loss" },
  { value: DamageCategory.OTHER, label: "Other" },
];

const damageSeverities = [
  { value: DamageSeverity.MINOR, label: "Minor" },
  { value: DamageSeverity.MAJOR, label: "Major" },
  { value: DamageSeverity.TOTAL_LOSS, label: "Total Loss" },
];


export default function DamageHistory() {
  const { user } = useAuth();

  // Custom filters for damage history
  const damageFilters: FilterItem[] = [
    {
      key: "category",
      label: "Category",
      placeholder: "Filter by category",
      tree: transformOptions(damageCategories),
    },
    {
      key: "severity",
      label: "Severity",
      placeholder: "Filter by severity",
      tree: transformOptions(damageSeverities),
    },
    {
      key: "source",
      label: "Source",
      placeholder: "Filter by source",
      tree: transformOptions(damageSources),
    },
  ];

  const {
    data: damages,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
  } = useDataTable<ProductDamage>({
    queryKey: "/api/inventory/getDamages",
    initialPageSize: 10,
    pageKey:'inventoryDamageHistory'
  });

  // Get analytics
  const { data: analytics } = useQuery<DamageAnalytics>({
    queryKey: ["/api/inventory/damage-analytics"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/inventory/damage-analytics",
      );
      return response;
    },
    enabled: !!user && (user.role === UserRole.INVENTORY || user.role === UserRole.ADMIN),
  });

  const columns: ColumnDef<ProductDamage, any>[] = useMemo(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {format(new Date(row.getValue("createdAt")), "MMM dd, yyyy")}
          </div>
        ),
      },
      {
        accessorKey: "productId",
        header: "Product",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm">
              {row.getValue("productId")}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "variantId",
        header: "Variant",
        cell: ({ row }) =>
          row.getValue("variantId") ? (
            <Badge variant="secondary" className="text-xs">
              <Package className="h-3 w-3 mr-1" />
              Variant
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">Product</span>
          ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <Badge variant="outline">
            {damageSources.find((s) => s.value === row.getValue("source"))
              ?.label || row.getValue("source")}
          </Badge>
        ),
      },
      {
        accessorKey: "damageCategory",
        header: "Category",
        cell: ({ row }) => (
          <Badge variant="outline">
            {damageCategories.find(
              (c) => c.value === row.getValue("damageCategory"),
            )?.label || row.getValue("damageCategory")}
          </Badge>
        ),
      },
      {
        accessorKey: "damageSeverity",
        header: "Severity",
        cell: ({ row }) => {
          const severity = row.getValue("damageSeverity") as DamageSeverity;
          return (
            <Badge className={SeverityColors[severity] || ""}>
              {damageSeverities.find((s) => s.value === severity)?.label ||
                severity}
            </Badge>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("quantity")}</span>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <div className="max-w-xs truncate" title={row.getValue("reason")}>
            {row.getValue("reason")}
          </div>
        ),
      },
      {
        accessorKey: "imageUrls",
        header: "Evidence",
        cell: ({ row }) => {
          const imageUrls = row.getValue("imageUrls") as string[] || [];
          if (imageUrls.length === 0) {
            return <span className="text-muted-foreground text-sm">No images</span>;
          }
          
          return (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {imageUrls.slice(0, 3).map((url, index) => (
                  <div
                    key={index}
                    className="w-8 h-8 rounded-full overflow-hidden border-2 border-background"
                  >
                    <img
                      src={url}
                      alt={`Evidence ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              {imageUrls.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{imageUrls.length - 3} more
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  const exportData = () => {
    if (!damages || damages.length === 0) {
      alert("No data to export");
      return;
    }

    // Create CSV content
    const headers = [
      "Date",
      "Product ID",
      "Variant",
      "Source",
      "Category",
      "Severity",
      "Quantity",
      "Reason",
      "Status",
      "Cost Value",
      "Recovery Value",
      "Net Loss",
      "Reported By",
    ];

    const csvData = damages.map((damage: ProductDamage) => [
      format(new Date(damage.createdAt), "yyyy-MM-dd"),
      damage.productId,
      damage.variantId ? `Variant: ${damage.variantId}` : "Product",
      damageSources.find((s) => s.value === damage.source)?.label ||
        damage.source,
      damageCategories.find((c) => c.value === damage.damageCategory)?.label ||
        damage.damageCategory,
      damageSeverities.find((s) => s.value === damage.damageSeverity)?.label ||
        damage.damageSeverity,
      damage.quantity.toString(),
      `"${damage.reason.replace(/"/g, '""')}"`, // Escape quotes in reason
      damage.status,
      damage.costValue || "0",
      damage.recoveryValue || "0",
      (
        (Number(damage.costValue) || 0) - (Number(damage.recoveryValue) || 0)
      ).toString(),
      damage.reportedBy,
    ]);

    // Convert to CSV string
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `damage-history-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          Damage History
        </h1>
        <p className="text-muted-foreground">
          View and analyze product damage records
        </p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Damages</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.totalDamages || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{analytics?.totalCost?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{analytics?.totalRecovered?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹
              {(
                (analytics?.totalCost || 0) - (analytics?.totalRecovered || 0)
              ).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Damage List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Damage Records</CardTitle>
          <Button onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            pageKey="inventoryDamageHistory"
            columns={columns}
            data={damages || []}
            totalCount={totalCount || 0}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPaginationChange={handlePaginationChange}
            isLoading={isLoading}
            searchPlaceholder="Search damage records..."
            emptyMessage="No damage records found"
            filters={damageFilters}
          />
        </CardContent>
      </Card>
    </div>
  );
}
