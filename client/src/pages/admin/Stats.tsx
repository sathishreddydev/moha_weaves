import {
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  Store,
  Globe,
} from "lucide-react";

interface DashboardStatsProps {
  stats: {
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
  };
  formatPrice: (price: number) => string;
}

import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  accent = "bg-muted",
  to,
}: {
  title: string;
  value: React.ReactNode;
  icon: any;
  subtitle?: React.ReactNode;
  accent?: string;
  to?: string;
}) {
  return (
    <Link to={to ?? ""} className="block focus:outline-none">
      <Card className="h-full transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer">
        <CardContent className="flex items-start gap-4 p-5">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="text-2xl font-semibold leading-tight">{value}</div>
            {subtitle && (
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardStats({ stats, formatPrice }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total Users"
        value={stats.totalUsers}
        icon={Users}
        to="/admin/users"
        accent="bg-blue-100 text-blue-700"
      />

      <StatCard
        title="Total products"
        value={stats.totalProducts}
        icon={Package}
        to="/admin/products"
        accent="bg-purple-100 text-purple-700"
        subtitle={`${stats.lowStockItems} low stock`}
      />

      <StatCard
        title="Total Orders"
        value={stats.totalOrders}
        icon={ShoppingCart}
        accent="bg-orange-100 text-orange-700"
        subtitle={`${stats.pendingOrders} pending`}
      />

      <StatCard
        title="Total Revenue"
        value={formatPrice(stats.totalRevenue)}
        icon={TrendingUp}
        accent="bg-green-100 text-green-700"
      />

      <StatCard
        title="Online Sales"
        value={stats.totalOnlineOrders}
        icon={Globe}
        to="/admin/orders"
        accent="bg-sky-100 text-sky-700"
        subtitle={`Revenue: ${formatPrice(stats.totalOnlineOrdersRevenue)}`}
      />

      <StatCard
        title="Store Sales"
        value={stats.totalStoreSales}
        icon={Store}
        to="/admin/store-orders"
        accent="bg-emerald-100 text-emerald-700"
        subtitle={`Revenue: ${formatPrice(stats.totalStoresSalesRevenue)}`}
      />
    </div>
  );
}
