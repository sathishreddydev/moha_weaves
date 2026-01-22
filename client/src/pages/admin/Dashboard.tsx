


import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Package, ShoppingCart, TrendingUp, Plus, AlertTriangle, DollarSign, PackageOpen, Activity, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockItems: number;
  totalOnlineOrders: number;
  totalStoreSales: number;
  totalOnlineOrdersRevenue: number;
  totalStoresSalesRevenue: number;
  totalStock: number;
  outOfStockCount: number;
  totalProfit: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user && user.role === "admin",
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat("en-IN").format(num);

  const getPercentage = (part: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  };

  const getMargin = (revenue: number, profit: number) => {
    if (revenue === 0) return 0;
    return Math.round((profit / revenue) * 100);
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
    trend,
    color = "default"
  }: {
    title: string;
    value: string | number;
    icon: any;
    description?: string;
    trend?: number;
    color?: "default" | "destructive" | "warning";
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color === "destructive" ? "text-red-500" :
            color === "warning" ? "text-yellow-500" :
              "text-muted-foreground"
          }`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend !== undefined && (
          <div className={`text-xs ${trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-gray-600"
            }`}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}%
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (statsLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>
      {/* Comprehensive Dashboard Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Inventory Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{formatNumber(stats?.totalProducts || 0)}</div>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{formatNumber(stats?.totalStock || 0)}</div>
                <p className="text-sm text-muted-foreground">Total Stock</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Out of Stock</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatNumber(stats?.outOfStockCount ?? 0)}</span>
                  <Badge variant={(stats?.outOfStockCount ?? 0) > 0 ? "destructive" : "default"}>
                    {(stats?.outOfStockCount ?? 0) > 0 ? "Alert" : "Good"}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Low Stock (≤10)</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatNumber(stats?.lowStockItems ?? 0)}</span>
                  <Badge variant={(stats?.lowStockItems ?? 0) > 0 ? "secondary" : "default"}>
                    {(stats?.lowStockItems ?? 0) > 0 ? "Warning" : "Good"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Sales Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{formatNumber(stats?.totalOrders || 0)}</div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{formatPrice(stats?.totalRevenue || 0)}</div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Online Orders</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatNumber(stats?.totalOnlineOrders || 0)}</span>
                  <Badge variant="outline">
                    {getPercentage(stats?.totalOnlineOrders || 0, stats?.totalOrders || 0)}%
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Store Sales</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatNumber(stats?.totalStoreSales || 0)}</span>
                  <Badge variant="outline">
                    {getPercentage(stats?.totalStoreSales || 0, stats?.totalOrders || 0)}%
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Pending Orders</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatNumber(stats?.pendingOrders ?? 0)}</span>
                  <Badge variant={(stats?.pendingOrders ?? 0) > 0 ? "secondary" : "default"}>
                    {(stats?.pendingOrders ?? 0) > 0 ? "Action" : "Clear"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Financial Health Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Financial Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{formatPrice(stats?.totalRevenue || 0)}</div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{formatPrice(stats?.totalProfit || 0)}</div>
                <p className="text-sm text-muted-foreground">Total Profit</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Online Revenue</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatPrice(stats?.totalOnlineOrdersRevenue || 0)}</span>
                  <Badge variant="outline">
                    {getPercentage(stats?.totalOnlineOrdersRevenue || 0, stats?.totalRevenue || 0)}%
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Store Revenue</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatPrice(stats?.totalStoresSalesRevenue || 0)}</span>
                  <Badge variant="outline">
                    {getPercentage(stats?.totalStoresSalesRevenue || 0, stats?.totalRevenue || 0)}%
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Profit Margin</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getMargin(stats?.totalRevenue || 0, stats?.totalProfit || 0)}%</span>
                  <Badge variant={getMargin(stats?.totalRevenue || 0, stats?.totalProfit || 0) >= 20 ? "default" : "secondary"}>
                    {getMargin(stats?.totalRevenue || 0, stats?.totalProfit || 0) >= 20 ? "Good" : "Low"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Center Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Action Center
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Quick Actions</h4>
              <div className="grid grid-cols-1 gap-2">
                <Link to="/admin/products">
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="h-4 w-4 mr-2" />
                    Manage Products
                  </Button>
                </Link>
                <Link to="/admin/orders">
                  <Button variant="outline" className="w-full justify-start">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    View Orders
                  </Button>
                </Link>
                <Link to="/admin/users">
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </Button>
                </Link>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">System Health</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Stock Status</span>
                  <Badge variant={(stats?.outOfStockCount ?? 0) > 0 ? "destructive" : "default"}>
                    {(stats?.outOfStockCount ?? 0) > 0 ? "Issues" : "Good"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Pending Orders</span>
                  <Badge variant={(stats?.pendingOrders ?? 0) > 0 ? "secondary" : "default"}>
                    {stats?.pendingOrders ?? 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Low Stock Items</span>
                  <Badge variant={(stats?.lowStockItems ?? 0) > 0 ? "secondary" : "default"}>
                    {stats?.lowStockItems ?? 0}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
