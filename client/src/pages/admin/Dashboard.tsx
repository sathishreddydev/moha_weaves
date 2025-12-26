import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Package, ShoppingCart, TrendingUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { DashboardStats } from "./Stats";

interface DashboardStats {
  totalUsers: number;
  totalSarees: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockItems: number;
  totalOnlineOrders: number;
  totalStoreSales: number;
  totalOnlineOrdersRevenue: number;
  totalStoresSalesRevenue: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user && user.role === "admin",
  });

  const [orderPeriod, setOrderPeriod] = useState<"weekly" | "monthly">(
    "weekly"
  );

  const getDateRange = (period: "weekly" | "monthly") => {
    const now = new Date();
    let start = new Date();

    if (period === "weekly") start.setDate(now.getDate() - 7);
    else if (period === "monthly") start.setMonth(now.getMonth() - 1);

    return {
      dateFrom: start.toISOString().split("T")[0],
      dateTo: now.toISOString().split("T")[0],
    };
  };

  const { dateFrom, dateTo } = getDateRange(orderPeriod);

  const { data: periodOrders, isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/orders", dateFrom, dateTo],
    queryFn: () =>
      fetch(`/api/admin/orders?dateFrom=${dateFrom}&dateTo=${dateTo}`).then(
        (res) => res.json()
      ),
    enabled: !!user && user.role === "admin",
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const totalPeriodOrders = periodOrders ? periodOrders.length : 0;
  const totalPeriodRevenue = periodOrders
    ? periodOrders.reduce(
        (sum, order) => sum + parseFloat(order.totalAmount),
        0
      )
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        stats && <DashboardStats stats={stats} formatPrice={formatPrice} />
      )}
    </div>
  );
}
