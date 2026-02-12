import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar, Globe, Package, Store, TrendingDown, TrendingUp } from "lucide-react";

interface StockMovementStats {
  totalOnlineCleared: number;
  totalStoreCleared: number;
  onlineMovements: {
    productId: string;
    productName: string;
    quantity: number;
    orderRefId: string;
    createdAt: string;
  }[];
  storeMovements: {
    productId: string;
    productName: string;
    quantity: number;
    orderRefId: string;
    storeId: string | null;
    storeName: string | null;
    createdAt: string;
  }[];
}

interface InventoryTurnover {
  productId: string;
  productName: string;
  sku: string;
  totalStock: number;
  averageStock: number;
  costOfGoodsSold: number;
  turnoverRatio: number;
  daysOfSupply: number;
  category: string;
}

interface ABCAnalysis {
  class: 'A' | 'B' | 'C';
  productId: string;
  productName: string;
  sku: string;
  revenueContribution: number;
  cumulativeRevenue: number;
  revenuePercentage: number;
  quantitySold: number;
  currentStock: number;
  category: string;
}

interface SeasonalTrend {
  productId: string;
  productName: string;
  category: string;
  monthlyData: {
    month: string;
    year: number;
    quantity: number;
    revenue: number;
  }[];
  trend: 'increasing' | 'decreasing' | 'stable' | 'seasonal';
  seasonalityIndex: number;
  peakMonths: string[];
}

export default function InventoryAnalytics() {
  const { user } = useAuth();

  const isInventoryUser = !!user && (user.role === "inventory" || user.role === "admin");

  const { data: stats, isLoading } = useQuery<StockMovementStats>({
    queryKey: ["/api/inventory/stock-stats"],
    enabled: isInventoryUser,
  });

  const { data: storeSales = [] } = useQuery({
    queryKey: ["/api/inventory/store-sales"],
  });

  // Advanced Analytics Queries
  const { data: turnoverResponse = { data: [], summary: {}, filters: {} }, isLoading: turnoverLoading } = useQuery<{data: InventoryTurnover[], summary: any, filters: any}>({
    queryKey: ["/api/inventory/analytics/turnover"],
    enabled: isInventoryUser,
  });

  const { data: abcResponse = { data: [], summary: {}, filters: {} }, isLoading: abcLoading } = useQuery<{data: ABCAnalysis[], summary: any, filters: any}>({
    queryKey: ["/api/inventory/analytics/abc-analysis"],
    enabled: isInventoryUser,
  });

  const { data: seasonalResponse = { data: [], summary: {}, filters: {} }, isLoading: seasonalLoading } = useQuery<{data: SeasonalTrend[], summary: any, filters: any}>({
    queryKey: ["/api/inventory/analytics/seasonal-trends"],
    enabled: isInventoryUser,
  });

  // Extract data arrays from responses
  const turnoverData = turnoverResponse.data || [];
  const abcData = abcResponse.data || [];
  const seasonalData = seasonalResponse.data || [];

  // Aggregate top products by quantity cleared
  const getTopProducts = (movements: any[], limit = 10) => {
    const productMap = new Map<string, { name: string; quantity: number }>();

    movements.forEach((movement) => {
      const existing = productMap.get(movement.productId);
      if (existing) {
        existing.quantity += movement.quantity;
      } else {
        productMap.set(movement.productId, {
          name: movement.productName,
          quantity: movement.quantity,
        });
      }
    });

    return Array.from(productMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  };

  // Aggregate movements by store
  const getStoreStats = (movements: any[]) => {
    const storeMap = new Map<string, { name: string; quantity: number }>();

    movements.forEach((movement) => {
      if (movement.storeName) {
        const existing = storeMap.get(movement.storeId);
        if (existing) {
          existing.quantity += movement.quantity;
        } else {
          storeMap.set(movement.storeId, {
            name: movement.storeName,
            quantity: movement.quantity,
          });
        }
      }
    });

    return Array.from(storeMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity);
  };

  const totalCleared =
    (stats?.totalOnlineCleared || 0) + (stats?.totalStoreCleared || 0);
  const onlinePercentage =
    totalCleared > 0
      ? ((stats?.totalOnlineCleared || 0) / totalCleared) * 100
      : 0;
  const storePercentage =
    totalCleared > 0
      ? ((stats?.totalStoreCleared || 0) / totalCleared) * 100
      : 0;

  const pieData = [
    { name: "Online", value: stats?.totalOnlineCleared || 0, color: "#3b82f6" },
    { name: "Store", value: stats?.totalStoreCleared || 0, color: "#22c55e" },
  ];
  const topOnlineProducts = stats
    ? getTopProducts(stats.onlineMovements, 10)
    : [];
  const topStoreProducts = stats
    ? getTopProducts(stats.storeMovements, 10)
    : [];
  const storeStats = stats ? getStoreStats(stats.storeMovements) : [];

  // Helper functions for new analytics
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getABCClassColor = (abcClass: string) => {
    switch (abcClass) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'B': return 'bg-yellow-100 text-yellow-800';
      case 'C': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable': return <BarChart3 className="h-4 w-4 text-blue-500" />;
      case 'seasonal': return <Calendar className="h-4 w-4 text-purple-500" />;
      default: return <BarChart3 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTurnoverHealth = (ratio: number) => {
    if (ratio >= 4) return { color: 'text-green-600', label: 'Excellent' };
    if (ratio >= 2) return { color: 'text-blue-600', label: 'Good' };
    if (ratio >= 1) return { color: 'text-yellow-600', label: 'Average' };
    return { color: 'text-red-600', label: 'Poor' };
  };

  // Prepare chart data
  const abcChartData = abcData.reduce((acc, item) => {
    const existing = acc.find(d => d.name === item.class);
    if (existing) {
      existing.value += item.revenueContribution;
    } else {
      acc.push({ name: item.class, value: item.revenueContribution });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const abcColors = {
    'A': '#22c55e',
    'B': '#eab308', 
    'C': '#ef4444'
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Advanced Inventory Analytics
        </h1>
        <p className="text-muted-foreground">
          Comprehensive insights into inventory performance, ABC analysis, and seasonal trends
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="turnover">Inventory Turnover</TabsTrigger>
          <TabsTrigger value="abc">ABC Analysis</TabsTrigger>
          <TabsTrigger value="seasonal">Seasonal Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card data-testid="stat-total-cleared">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Stock Cleared
                    </CardTitle>
                    <Package className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalCleared}</div>
                    <p className="text-xs text-muted-foreground">
                      All channels combined
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="stat-online-cleared">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Online Orders
                    </CardTitle>
                    <Globe className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {stats?.totalOnlineCleared || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {onlinePercentage.toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="stat-store-cleared">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Store Sales
                    </CardTitle>
                    <Store className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {stats?.totalStoreCleared || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {storePercentage.toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Store Performance */}
              {storeStats.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Store Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store Name</TableHead>
                          <TableHead className="text-right">Units Sold</TableHead>
                          <TableHead className="text-right">Percentage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {storeStats.map((store) => {
                          const percentage = (
                            (store.quantity / (stats?.totalStoreCleared || 1)) *
                            100
                          ).toFixed(1);
                          return (
                            <TableRow key={store.id}>
                              <TableCell className="font-medium">
                                {store.name}
                              </TableCell>
                              <TableCell className="text-right">
                                {store.quantity}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary">{percentage}%</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Inventory Turnover Tab */}
        <TabsContent value="turnover" className="space-y-6">
          {turnoverLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Inventory Turnover Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  How quickly your inventory is being sold and replenished
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Turnover Ratio</TableHead>
                      <TableHead className="text-right">Days of Supply</TableHead>
                      <TableHead className="text-right">Health</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {turnoverData && turnoverData.length > 0 ? turnoverData.slice(0, 20).map((item) => {
                      const health = getTurnoverHealth(item.turnoverRatio);
                      return (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {item.productName}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.sku || '-'}
                          </TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell className="text-right">{item.totalStock}</TableCell>
                          <TableCell className="text-right">{item.turnoverRatio}</TableCell>
                          <TableCell className="text-right">{item.daysOfSupply}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className={health.color}>
                              {health.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <p className="text-muted-foreground">No turnover data available</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABC Analysis Tab */}
        <TabsContent value="abc" className="space-y-6">
          {abcLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>ABC Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Products categorized by revenue contribution (A: Top 80%, B: 80-95%, C: Bottom 5%)
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Revenue %</TableHead>
                      <TableHead className="text-right">Quantity Sold</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abcData && abcData.length > 0 ? abcData.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <Badge className={getABCClassColor(item.class)}>
                            Class {item.class}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {item.productName}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.sku || '-'}
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.revenueContribution)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.revenuePercentage}%
                        </TableCell>
                        <TableCell className="text-right">{item.quantitySold}</TableCell>
                        <TableCell className="text-right">{item.currentStock}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <p className="text-muted-foreground">No ABC analysis data available</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Seasonal Trends Tab */}
        <TabsContent value="seasonal" className="space-y-6">
          {seasonalLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Seasonal Trends Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Product performance patterns and seasonal variations over time
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead className="text-right">Seasonality Index</TableHead>
                      <TableHead>Peak Months</TableHead>
                      <TableHead className="text-right">Data Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasonalData && seasonalData.length > 0 ? seasonalData.slice(0, 20).map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {item.productName}
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(item.trend)}
                            <span className="capitalize">{item.trend}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.seasonalityIndex > 30 ? "secondary" : "outline"}>
                            {item.seasonalityIndex}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.peakMonths.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {item.peakMonths.map((month) => (
                                <Badge key={month} variant="outline" className="text-xs">
                                  {month}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No clear peaks</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{item.monthlyData.length}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <p className="text-muted-foreground">No seasonal trends data available</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
