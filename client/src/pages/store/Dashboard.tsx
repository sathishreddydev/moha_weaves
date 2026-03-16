import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { apiRequest } from "@/lib/queryClient";
import { formatDate, formatPrice } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Clock,
  Eye,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  RepeatIcon,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardData } from "./Utils/types";

export default function StoreDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const buildStatsUrl = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return `/api/store/stats${params.toString() ? `?${params}` : ""}`;
  };

  const {
    data,
    isLoading: isDashboardLoading,
    isFetching,
    refetch: refetchDashboard,
  } = useQuery<DashboardData>({
    queryKey: ["/api/store/dashboard", dateFrom, dateTo],
    enabled: !!user && user.role === "store",
    queryFn: async () => {
      const [stats, recentSales, lowStockProducts] = await Promise.all([
        apiRequest("GET", buildStatsUrl()),
        apiRequest("GET", "/api/store/sales/recent"),
        apiRequest("GET", "/api/store/products/low-stock"),
      ]);
      return { stats, recentSales, lowStockProducts };
    },
  });

  const { stats, recentSales, lowStockProducts } = data || {};
  const isDateFiltered = !!(dateFrom || dateTo);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            Store Dashboard
          </h1>
          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Fetching data...
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Manage your store sales and inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDashboard()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Link to="/store/sale">
            <Button size={"sm"} data-testid="button-new-sale">
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          </Link>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 border rounded-lg bg-muted/30">
        <span className="text-sm font-medium">Filter by Date:</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-background"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-background"
          />
        </div>
        {isDateFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear
          </Button>
        )}
        {isDateFiltered && (
          <Badge variant="secondary" className="text-xs">
            Showing results for selected range
          </Badge>
        )}
      </div>

      {isDashboardLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card
            data-testid="stat-today-sales"
            className="cursor-pointer hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isDateFiltered ? "Period Sales" : "Today's Sales"}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.todaySales || 0}</div>
              <div className="text-muted-foreground">
                <div className="flex items-center gap-2 text-xs">
                  {stats?.totalSales !== undefined && (
                    <p>Total Sales: {stats.totalSales}</p>
                  )}

                  <p>Total Exch: {stats?.totalExchanges}</p>
                </div>
              </div>

              {stats?.weeklySalesGrowth !== undefined && (
                <div className="flex items-center mt-2">
                  {stats.weeklySalesGrowth >= 0 ? (
                    <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  <span
                    className={`text-xs ${stats.weeklySalesGrowth >= 0 ? "text-green-500" : "text-red-500"}`}
                  >
                    {Math.abs(stats.weeklySalesGrowth)}% vs last week
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card
            data-testid="stat-today-revenue"
            className="cursor-pointer hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isDateFiltered ? "Period Revenue" : "Today's Revenue"}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(stats?.todayRevenue || 0)}
              </div>

              {stats?.totalRevenue !== undefined && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    TSR: {formatPrice(stats.totalRevenue)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    TER: {formatPrice(stats?.exchangeBalanceRevenue ?? 0)}
                  </span>

                  {stats?.netRevenue !== undefined && (
                    <span className="text-xs font-medium text-green-600">
                      Net: {formatPrice(stats.netRevenue)}
                    </span>
                  )}
                </div>
              )}
              {stats?.monthlyRevenueGrowth !== undefined && (
                <div className="flex items-center mt-2">
                  {stats.monthlyRevenueGrowth >= 0 ? (
                    <ArrowUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  <span
                    className={`text-xs ${stats.monthlyRevenueGrowth >= 0 ? "text-green-500" : "text-red-500"}`}
                  >
                    {Math.abs(stats.monthlyRevenueGrowth)}% vs last month
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card
            data-testid="stat-inventory"
            className="cursor-pointer hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Store Inventory
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalInventory || 0}
              </div>
              <p className="text-xs text-muted-foreground">items in stock</p>
              {lowStockProducts && lowStockProducts.length > 0 && (
                <div className="flex items-center mt-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mr-1" />
                  <span className="text-xs text-amber-500">
                    {lowStockProducts.length} low stock
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card
            data-testid="stat-requests"
            className="cursor-pointer hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Requests
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.pendingRequests || 0}
              </div>
              <p className="text-xs text-muted-foreground">awaiting approval</p>
              {stats?.requestStats && (
                <div className="flex gap-1 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {stats.requestStats.approved} approved
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {stats.requestStats.dispatched} dispatched
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Recent Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/store/sale">
                    <Button variant="outline" className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      New Sale
                    </Button>
                  </Link>
                  <Link to="/store/requests">
                    <Button variant="outline" className="w-full justify-start">
                      <Package className="h-4 w-4 mr-2" />
                      Request Stock
                    </Button>
                  </Link>
                  <Link to="/store/exchange">
                    <Button variant="outline" className="w-full justify-start">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      New Exchange
                    </Button>
                  </Link>
                  <Link to="/store/inventory">
                    <Button variant="outline" className="w-full justify-start">
                      <Eye className="h-4 w-4 mr-2" />
                      View Inventory
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Top Selling Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Selling Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.topSellingProducts &&
                stats.topSellingProducts.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topSellingProducts
                      .slice(0, 5)
                      .map((product, index) => (
                        <div
                          key={product.product.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-6">
                              #{index + 1}
                            </span>
                            <img
                              src={
                                product.product.imageUrl ||
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                              }
                              alt=""
                              className="w-8 h-10 rounded object-cover"
                            />
                            <div>
                              <p className="text-sm font-medium line-clamp-1">
                                {product.product.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.quantity} sold
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {formatPrice(product.revenue)}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No sales data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alerts */}
          {lowStockProducts && lowStockProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Alerts
                  <Badge variant="secondary" className="ml-2">
                    {lowStockProducts.length} items
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <div
                      key={product.product.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            product.product.imageUrl ||
                            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                          }
                          alt=""
                          className="w-8 h-10 rounded object-cover"
                        />
                        <div>
                          <p className="text-sm font-medium line-clamp-1">
                            {product.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {product.product.sku}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-medium text-amber-600">
                            {product.currentStock} left
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Reorder at {product.reorderLevel}
                          </p>
                        </div>
                        <Link to="/store/requests">
                          <Button size="sm" variant="outline">
                            Request
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {lowStockProducts.length > 5 && (
                    <div className="text-center pt-2">
                      <Link to="/store/inventory">
                        <Button variant="outline" size="sm">
                          View all {lowStockProducts.length} low stock items
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Recent Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSales && recentSales.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">
                          #{sale.id.slice(-8)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {sale.items.length} items
                            </span>
                            <div className="flex -space-x-2">
                              {sale.items.slice(0, 3).map((item, idx) => (
                                <img
                                  key={idx}
                                  src={
                                    item.product.imageUrl ||
                                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                                  }
                                  alt=""
                                  className="w-6 h-8 rounded object-cover border-2 border-background"
                                />
                              ))}
                              {sale.items.length > 3 && (
                                <div className="w-6 h-8 rounded bg-muted border-2 border-background flex items-center justify-center">
                                  <span className="text-xs">
                                    +{sale.items.length - 3}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(sale.totalAmount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(sale.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link to={`/store/history`}>
                            <Button size="sm" variant="outline">
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No sales recorded today. Start making sales to see them here!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Request Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats?.requestStats ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Pending</span>
                        <Badge variant="secondary">
                          {stats.requestStats.pending}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Approved</span>
                        <Badge className="bg-green-100 text-green-800">
                          {stats.requestStats.approved}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Dispatched</span>
                        <Badge className="bg-blue-100 text-blue-800">
                          {stats.requestStats.dispatched}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Received</span>
                        <Badge className="bg-purple-100 text-purple-800">
                          {stats.requestStats.received}
                        </Badge>
                      </div>
                    </div>
                    <div className="pt-2">
                      <Link to="/store/requests">
                        <Button variant="outline" className="w-full">
                          View All Requests
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No request data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inventory Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Inventory Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Total Items</span>
                      <span className="text-sm font-medium">
                        {stats?.totalInventory || 0}
                      </span>
                    </div>
                  </div>
                  {lowStockProducts && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Low Stock Items</span>
                        <span className="text-sm font-medium text-amber-600">
                          {lowStockProducts.length}
                        </span>
                      </div>
                      <Progress
                        value={
                          (lowStockProducts.length /
                            (stats?.totalInventory || 1)) *
                          100
                        }
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
                <div className="pt-2 space-y-2">
                  <Link to="/store/inventory">
                    <Button variant="outline" className="w-full">
                      <Eye className="h-4 w-4 mr-2" />
                      Manage Inventory
                    </Button>
                  </Link>
                  <Link to="/store/requests">
                    <Button variant="outline" className="w-full">
                      <Package className="h-4 w-4 mr-2" />
                      Request Stock
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Recent Sales Activity */}
                {recentSales && recentSales.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Recent Sales</h4>
                    <div className="space-y-2">
                      {recentSales.slice(0, 3).map((sale) => (
                        <div
                          key={sale.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-green-500" />
                            <span>Sale #{sale.id.slice(-8)}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {formatPrice(sale.totalAmount)} •{" "}
                            {formatDate(sale.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Requests Activity */}
                {stats?.recentRequests && stats.recentRequests.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">
                      Recent Requests
                    </h4>
                    <div className="space-y-2">
                      {stats.recentRequests.slice(0, 3).map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-500" />
                            <span>Request for {request.product.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {request.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Exchanges Activity */}
                {stats?.recentExchanges && stats.recentExchanges.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">
                      Recent Exchanges
                    </h4>
                    <div className="space-y-2">
                      {stats.recentExchanges.slice(0, 3).map((exchange) => (
                        <div
                          key={exchange.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 text-amber-500" />
                            <span>Exchange #{exchange.id.slice(-8)}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {exchange.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!recentSales || recentSales.length === 0) &&
                  (!stats?.recentRequests ||
                    stats.recentRequests.length === 0) &&
                  (!stats?.recentExchanges ||
                    stats.recentExchanges.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent activity to display
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
