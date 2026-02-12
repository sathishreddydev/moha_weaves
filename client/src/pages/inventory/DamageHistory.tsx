import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Calendar, Download, Filter, Package } from "lucide-react";
import { useState } from "react";

// Type definitions
interface ProductDamage {
  id: string;
  productId: string;
  source: string;
  quantity: number;
  damageCategory: string;
  damageSeverity: string;
  reason: string;
  reportedBy: string;
  approvedBy?: string;
  costValue?: string;
  recoveryValue?: string;
  disposalMethod?: string;
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DamageAnalytics {
  totalDamages: number;
  totalCost: number;
  totalRecovered: number;
  damagesBySource: Array<{
    source: string;
    count: number;
    cost: number;
  }>;
  damagesByCategory: Array<{
    category: string;
    count: number;
    cost: number;
  }>;
  recentDamages: ProductDamage[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  totalStock: number;
}

const damageSources = [
  { value: "store", label: "In-Store" },
  { value: "warehouse", label: "Warehouse" },
  { value: "online_return", label: "Online Return" },
  { value: "shipping", label: "Shipping" },
  { value: "manufacturing", label: "Manufacturing" },
];

const damageCategories = [
  { value: "manufacturing_defect", label: "Manufacturing Defect" },
  { value: "shipping_damage", label: "Shipping Damage" },
  { value: "storage_damage", label: "Storage Damage" },
  { value: "handling_damage", label: "Handling Damage" },
  { value: "customer_damage", label: "Customer Damage" },
  { value: "expired", label: "Expired" },
  { value: "theft_loss", label: "Theft/Loss" },
  { value: "other", label: "Other" },
];

const damageSeverities = [
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "total_loss", label: "Total Loss" },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const severityColors: Record<string, string> = {
  minor: "bg-blue-100 text-blue-800",
  major: "bg-orange-100 text-orange-800",
  total_loss: "bg-red-100 text-red-800",
};

export default function DamageHistory() {
  const { user } = useAuth();

  const [filters, setFilters] = useState({
    productId: "",
    source: "",
    status: "",
    limit: "50",
  });

  // Get damages with filters
  const { data: damages = [], isLoading, refetch } = useQuery<ProductDamage[]>({
    queryKey: ["/api/inventory/damages", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.productId && filters.productId !== "all") params.append('productId', filters.productId);
      if (filters.source && filters.source !== "all") params.append('source', filters.source);
      if (filters.status && filters.status !== "all") params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await apiRequest("GET", `/api/inventory/damages?${params}`);
      return response;
    },
    enabled: !!user && (user.role === "inventory" || user.role === "admin"),
  });

  // Get products for filter
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/inventory/getProducts"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/inventory/getProducts", {});
      return response.data;
    },
    enabled: !!user && (user.role === "inventory"),
  });

  // Get analytics
  const { data: analytics } = useQuery<DamageAnalytics>({
    queryKey: ["/api/inventory/damage-analytics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/damage-history");
      return response;
    },
    enabled: !!user && (user.role === "inventory" || user.role === "admin"),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const getSourceLabel = (source: string) => {
    return damageSources.find(s => s.value === source)?.label || source;
  };

  const getCategoryLabel = (category: string) => {
    return damageCategories.find(c => c.value === category)?.label || category;
  };

  const getSeverityLabel = (severity: string) => {
    return damageSeverities.find(s => s.value === severity)?.label || severity;
  };

  const exportData = () => {
    // Simple CSV export
    const csv = [
      ["Date", "Product", "Source", "Category", "Severity", "Quantity", "Reason", "Status"],
      ...damages.map((damage: any) => [
        format(new Date(damage.createdAt), "yyyy-MM-dd"),
        damage.productId,
        getSourceLabel(damage.source),
        getCategoryLabel(damage.damageCategory),
        getSeverityLabel(damage.damageSeverity),
        damage.quantity,
        damage.reason,
        damage.status,
      ]),
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `damage-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          Damage History
        </h1>
        <p className="text-muted-foreground">
          View and filter all reported product damages
        </p>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Damages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalDamages}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{analytics.totalCost.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recovered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{analytics.totalRecovered.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ₹{(analytics.totalCost - analytics.totalRecovered).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productId">Product</Label>
              <Select
                value={filters.productId}
                onValueChange={(value) => handleFilterChange("productId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((product: any) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={filters.source}
                onValueChange={(value) => handleFilterChange("source", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {damageSources.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">Show</Label>
              <Select
                value={filters.limit}
                onValueChange={(value) => handleFilterChange("limit", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              onClick={() => setFilters({ productId: "", source: "", status: "", limit: "50" })}
            >
              Clear Filters
            </Button>
            <Button onClick={exportData}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Damage List */}
      <Card>
        <CardHeader>
          <CardTitle>Damage Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : damages.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No damage records found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {damages.map((damage: any) => (
                  <TableRow key={damage.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(damage.createdAt), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{damage.productId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getSourceLabel(damage.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getCategoryLabel(damage.damageCategory)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={severityColors[damage.damageSeverity]}>
                        {getSeverityLabel(damage.damageSeverity)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{damage.quantity}</TableCell>
                    <TableCell className="max-w-xs truncate" title={damage.reason}>
                      {damage.reason}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[damage.status]}>
                        {damage.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
