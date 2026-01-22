


import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Package, ShoppingCart, TrendingUp, Plus, AlertTriangle, DollarSign, PackageOpen } from "lucide-react";
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
        <Icon className={`h-4 w-4 ${
          color === "destructive" ? "text-red-500" : 
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
          <div className={`text-xs ${
            trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-gray-600"
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
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Products"
          value={formatNumber(stats?.totalProducts || 0)}
          icon={Package}
          description="Active products in inventory"
        />
        <StatCard
          title="Total Stock"
          value={formatNumber(stats?.totalStock || 0)}
          icon={PackageOpen}
          description="Total stock across all products"
        />
        <StatCard
          title="Out of Stock"
          value={formatNumber(stats?.outOfStockCount ?? 0)}
          icon={AlertTriangle}
          description="Products with zero stock"
          color={(stats?.outOfStockCount ?? 0) > 0 ? "destructive" : "default"}
        />
        <StatCard
          title="Low Stock Items"
          value={formatNumber(stats?.lowStockItems ?? 0)}
          icon={AlertTriangle}
          description="Products with ≤10 items"
          color={(stats?.lowStockItems ?? 0) > 0 ? "warning" : "default"}
        />
      </div>

      {/* Orders and Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Orders"
          value={formatNumber(stats?.totalOrders || 0)}
          icon={ShoppingCart}
          description="Online + Store orders"
        />
        <StatCard
          title="Online Orders"
          value={formatNumber(stats?.totalOnlineOrders || 0)}
          icon={ShoppingCart}
          description="Website orders"
        />
        <StatCard
          title="Store Sales"
          value={formatNumber(stats?.totalStoreSales || 0)}
          icon={ShoppingCart}
          description="In-store purchases"
        />
        <StatCard
          title="Pending Orders"
          value={formatNumber(stats?.pendingOrders ?? 0)}
          icon={AlertTriangle}
          description="Orders awaiting processing"
          color={(stats?.pendingOrders ?? 0) > 0 ? "warning" : "default"}
        />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Revenue"
          value={formatPrice(stats?.totalRevenue || 0)}
          icon={DollarSign}
          description="Total sales revenue"
        />
        <StatCard
          title="Online Revenue"
          value={formatPrice(stats?.totalOnlineOrdersRevenue || 0)}
          icon={DollarSign}
          description="Website sales revenue"
        />
        <StatCard
          title="Store Revenue"
          value={formatPrice(stats?.totalStoresSalesRevenue || 0)}
          icon={DollarSign}
          description="In-store sales revenue"
        />
        <StatCard
          title="Total Profit"
          value={formatPrice(stats?.totalProfit || 0)}
          icon={TrendingUp}
          description="Profit from completed orders"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
          </CardHeader>
          <CardContent>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Order Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Online</span>
                <span className="text-sm font-medium">
                  {formatNumber(stats?.totalOnlineOrders || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Store</span>
                <span className="text-sm font-medium">
                  {formatNumber(stats?.totalStoreSales || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Online</span>
                <span className="text-sm font-medium">
                  {formatPrice(stats?.totalOnlineOrdersRevenue || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Store</span>
                <span className="text-sm font-medium">
                  {formatPrice(stats?.totalStoresSalesRevenue || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
