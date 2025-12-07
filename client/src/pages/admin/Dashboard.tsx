import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  Store,
  Palette,
  Shirt,
  Tags,
  LogOut,
  Menu,
  LayoutDashboard,
  UserCog,
  Warehouse,
  Building2,
  Ticket,
  Star,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  totalUsers: number;
  totalSarees: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockItems: number;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: Package, label: "Sarees", href: "/admin/sarees" },
  { icon: Tags, label: "Categories", href: "/admin/categories" },
  { icon: Palette, label: "Colors", href: "/admin/colors" },
  { icon: Shirt, label: "Fabrics", href: "/admin/fabrics" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: UserCog, label: "Staff", href: "/admin/staff" },
  { icon: Building2, label: "Stores", href: "/admin/stores" },
  { icon: ShoppingCart, label: "Orders", href: "/admin/orders" },
  { icon: Ticket, label: "Coupons", href: "/admin/coupons" },
  { icon: Star, label: "Reviews", href: "/admin/reviews" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user && user.role === "admin",
  });

  const { data: recentOrders } = useQuery<any[]>({
    queryKey: ["/api/admin/orders?limit=5"],
    enabled: !!user && user.role === "admin",
  });
  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-users">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="stat-products">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sarees
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalSarees || 0}
              </div>
              {stats?.lowStockItems ? (
                <p className="text-xs text-destructive mt-1">
                  {stats.lowStockItems} low stock
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card data-testid="stat-orders">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Orders
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalOrders || 0}
              </div>
              {stats?.pendingOrders ? (
                <p className="text-xs text-yellow-600 mt-1">
                  {stats.pendingOrders} pending
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card data-testid="stat-revenue">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(stats?.totalRevenue || 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link to="/admin/sarees">
              <Button data-testid="button-add-saree">
                <Plus className="h-4 w-4 mr-2" />
                Add Saree
              </Button>
            </Link>
            <Link to="/admin/categories">
              <Button variant="outline" data-testid="button-add-category">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </Link>
            <Link to="/admin/staff">
              <Button variant="outline" data-testid="button-add-staff">
                <Plus className="h-4 w-4 mr-2" />
                Add Staff
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        #{order.id.slice(0, 8)}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {formatPrice(parseFloat(order.totalAmount))}
                      </span>
                    </div>
                    <Badge
                      variant={
                        order.status === "pending" ? "secondary" : "default"
                      }
                    >
                      {order.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent orders</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
