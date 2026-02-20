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
import { BarChart3, Calendar, Globe, Package, Store, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { ABCClass, TrendType, AnalyticsTab, UserRole, TurnoverHealth } from "./utils/enums";
import type { StockMovementStats, InventoryTurnover, ABCAnalysis, SeasonalTrend } from "./utils/type";


export default function InventoryAnalytics() {
  const { user } = useAuth();

  const isInventoryUser = !!user && (user.role === UserRole.INVENTORY || user.role === UserRole.ADMIN);

  const { data: stats, isLoading } = useQuery<StockMovementStats>({
    queryKey: ["/api/inventory/stock-stats"],
    enabled: isInventoryUser,
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

  // Inventory Valuation Query
  const { data: valuation, isLoading: valuationLoading } = useQuery<{
    summary: {
      totalValue: number;
      totalCostValue: number;
      profitPotential: number;
      profitMargin: number;
      totalStock: number;
      totalProducts: number;
      lowStockValue: number;
      lowStockCount: number;
      deadStockCount: number;
      avgValuePerProduct: number;
    };
    categoryBreakdown: Array<{
      category: string;
      value: number;
      costValue: number;
      stock: number;
      count: number;
      avgPricePerUnit: number;
      profitPotential: number;
    }>;
    topValuedProducts: Array<{
      id: string;
      name: string;
      sku: string;
      price: number;
      totalStock: number;
      totalValue: number;
      categoryName: string;
    }>;
  }>({
    queryKey: ["/api/inventory/valuation"],
    enabled: isInventoryUser,
  });

  // Extract data arrays from responses
  const turnoverData = turnoverResponse.data || [];
  const abcData = abcResponse.data || [];
  const seasonalData = seasonalResponse.data || [];

  const getStoreStats = (movements: any[]) => {
    if (!movements || !Array.isArray(movements)) {
      return [];
    }
    
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

  const storeStats = stats && stats.storeMovements ? getStoreStats(stats.storeMovements) : [];

  // Helper functions for new analytics
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getABCClassColor = (abcClass: ABCClass) => {
    switch (abcClass) {
      case ABCClass.A: return 'bg-green-100 text-green-800';
      case ABCClass.B: return 'bg-yellow-100 text-yellow-800';
      case ABCClass.C: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: TrendType) => {
    switch (trend) {
      case TrendType.INCREASING: return <TrendingUp className="h-4 w-4 text-green-500" />;
      case TrendType.DECREASING: return <TrendingDown className="h-4 w-4 text-red-500" />;
      case TrendType.STABLE: return <BarChart3 className="h-4 w-4 text-blue-500" />;
      case TrendType.SEASONAL: return <Calendar className="h-4 w-4 text-purple-500" />;
      default: return <BarChart3 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTurnoverHealth = (ratio: number) => {
    if (ratio >= 4) return { color: 'text-green-600', label: TurnoverHealth.EXCELLENT };
    if (ratio >= 2) return { color: 'text-blue-600', label: TurnoverHealth.GOOD };
    if (ratio >= 1) return { color: 'text-yellow-600', label: TurnoverHealth.AVERAGE };
    return { color: 'text-red-600', label: TurnoverHealth.POOR };
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

      <Tabs defaultValue={AnalyticsTab.OVERVIEW} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value={AnalyticsTab.OVERVIEW}>Overview</TabsTrigger>
          <TabsTrigger value={AnalyticsTab.TURNOVER}>Inventory Turnover</TabsTrigger>
          <TabsTrigger value={AnalyticsTab.ABC}>ABC Analysis</TabsTrigger>
          <TabsTrigger value={AnalyticsTab.SEASONAL}>Seasonal Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value={AnalyticsTab.OVERVIEW} className="space-y-6">
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
        <TabsContent value={AnalyticsTab.TURNOVER} className="space-y-6">
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
        <TabsContent value={AnalyticsTab.ABC} className="space-y-6">
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
        <TabsContent value={AnalyticsTab.SEASONAL} className="space-y-6">
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
