import { useState, useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Filter,
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { formatDate } from "@/lib/utils";

interface StockReconciliationData {
  productId: string;
  productName?: string;
  sku?: string;
  totalStock: number;
  onlineStock: number;
  calculatedStoreStock: number;
  calculatedVariantStock: number;
  discrepancy: number;
  variantDiscrepancies: {
    variantId: string;
    size: string;
    expectedStock: number;
    actualStock: number;
  }[];
}

interface StockValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  discrepancies: {
    productId: string;
    productName?: string;
    expectedTotal: number;
    actualTotal: number;
    onlineStock: number;
    storeStock: number;
    unallocated: number;
  }[];
}

export default function StockReconciliation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<"all" | "has-discrepancy" | "no-discrepancy">("all");

  // Fetch reconciliation data
  const { data: reconciliationData, isLoading, refetch } = useQuery<StockReconciliationData[]>({
    queryKey: ["/api/inventory/stock-reconciliation"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/validate-all-stock");
      return response.json();
    },
    onSuccess: (data: StockValidationResult) => {
      toast({
        title: "Validation Complete",
        description: `Found ${data.errors.length} errors and ${data.warnings.length} warnings`,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Validation Failed",
        description: "Failed to validate stock data",
        variant: "destructive",
      });
    },
  });

  // Fix discrepancies mutation
  const fixDiscrepanciesMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await apiRequest("POST", "/api/inventory/fix-stock-discrepancies", {
        productIds,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Discrepancies Fixed",
        description: `Fixed ${data.fixed.length} products, ${data.failed.length} failed`,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Fix Failed",
        description: "Failed to fix stock discrepancies",
        variant: "destructive",
      });
    },
  });

  // Filter data
  const filteredData = useMemo(() => {
    if (!reconciliationData) return [];

    return reconciliationData.filter((item) => {
      const matchesSearch = 
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDiscrepancy = 
        discrepancyFilter === "all" ||
        (discrepancyFilter === "has-discrepancy" && item.discrepancy !== 0) ||
        (discrepancyFilter === "no-discrepancy" && item.discrepancy === 0);

      return matchesSearch && matchesDiscrepancy;
    });
  }, [reconciliationData, searchTerm, discrepancyFilter]);

  // Statistics
  const stats = useMemo(() => {
    if (!reconciliationData) return { total: 0, withDiscrepancies: 0, totalDiscrepancy: 0 };

    const withDiscrepancies = reconciliationData.filter(item => item.discrepancy !== 0);
    const totalDiscrepancy = reconciliationData.reduce((sum, item) => sum + Math.abs(item.discrepancy), 0);

    return {
      total: reconciliationData.length,
      withDiscrepancies: withDiscrepancies.length,
      totalDiscrepancy,
    };
  }, [reconciliationData]);

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredData.length) return;

    const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
      'Product ID': item.productId,
      'Product Name': item.productName,
      'SKU': item.sku,
      'Total Stock': item.totalStock,
      'Online Stock': item.onlineStock,
      'Calculated Store Stock': item.calculatedStoreStock,
      'Calculated Variant Stock': item.calculatedVariantStock,
      'Discrepancy': item.discrepancy,
      'Has Variant Discrepancies': item.variantDiscrepancies.length > 0 ? 'Yes' : 'No',
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Reconciliation");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(data, `stock-reconciliation-${formatDate(new Date())}.xlsx`);
  };

  // Fix selected discrepancies
  const fixSelectedDiscrepancies = () => {
    const productsWithDiscrepancies = filteredData
      .filter(item => item.discrepancy !== 0)
      .map(item => item.productId);

    if (productsWithDiscrepancies.length === 0) {
      toast({
        title: "No Discrepancies",
        description: "No products with discrepancies found in current filter",
      });
      return;
    }

    fixDiscrepanciesMutation.mutate(productsWithDiscrepancies);
  };

  const getDiscrepancyBadge = (discrepancy: number) => {
    if (discrepancy === 0) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Balanced</Badge>;
    } else if (discrepancy > 0) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">+{discrepancy}</Badge>;
    } else {
      return <Badge variant="destructive">{discrepancy}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Reconciliation</h1>
          <p className="text-muted-foreground">Identify and fix stock discrepancies across your inventory</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${validateMutation.isPending ? 'animate-spin' : ''}`} />
            Validate All
          </Button>
          <Button onClick={exportToExcel} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={fixSelectedDiscrepancies}
            disabled={fixDiscrepanciesMutation.isPending}
          >
            <Settings className="h-4 w-4 mr-2" />
            Fix Discrepancies
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Discrepancies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.withDiscrepancies}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Discrepancy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDiscrepancy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.total > 0 ? Math.round(((stats.total - stats.withDiscrepancies) / stats.total) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={discrepancyFilter} onValueChange={(value: any) => setDiscrepancyFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by discrepancy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="has-discrepancy">Has Discrepancies</SelectItem>
                <SelectItem value="no-discrepancy">No Discrepancies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Data ({filteredData.length} products)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Total Stock</TableHead>
                  <TableHead>Online Stock</TableHead>
                  <TableHead>Store Stock</TableHead>
                  <TableHead>Variant Stock</TableHead>
                  <TableHead>Discrepancy</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.productId}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>{item.totalStock}</TableCell>
                    <TableCell>{item.onlineStock}</TableCell>
                    <TableCell>{item.calculatedStoreStock}</TableCell>
                    <TableCell>{item.calculatedVariantStock}</TableCell>
                    <TableCell>{item.discrepancy}</TableCell>
                    <TableCell>{getDiscrepancyBadge(item.discrepancy)}</TableCell>
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
