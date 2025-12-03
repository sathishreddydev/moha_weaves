import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Plus,
  Edit,
  Truck,
  LogOut,
  Menu,
  LayoutDashboard,
  PackageSearch,
  ClipboardList,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Store,
  ArrowLeftRight,
  BarChart3,
  Warehouse,
  Shirt,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SareeWithDetails, Order, StockRequestWithDetails } from "@shared/schema";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/inventory/dashboard" },
  { icon: Shirt, label: "Sarees", href: "/inventory/sarees" },
  { icon: Warehouse, label: "Stock Management", href: "/inventory/stock" },
  { icon: BarChart3, label: "Stock Distribution", href: "/inventory/distribution" },
  { icon: ClipboardList, label: "Store Requests", href: "/inventory/requests" },
  { icon: Truck, label: "Online Orders", href: "/inventory/orders" },
  { icon: RotateCcw, label: "Returns", href: "/inventory/returns" },
];

const distributionLabels: Record<string, { label: string; icon: typeof Globe }> = {
  online: { label: "Online Only", icon: Globe },
  shop: { label: "Shop Only", icon: Store },
  both: { label: "Shop & Online", icon: ArrowLeftRight },
};

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: lowStockItems, isLoading: loadingStock } = useQuery<SareeWithDetails[]>({
    queryKey: ["/api/inventory/low-stock"],
    enabled: !!user && user.role === "inventory",
  });

  const { data: pendingRequests } = useQuery<StockRequestWithDetails[]>({
    queryKey: ["/api/inventory/requests", { status: "pending" }],
    enabled: !!user && user.role === "inventory",
  });

  const { data: pendingOrders } = useQuery<Order[]>({
    queryKey: ["/api/inventory/orders", { status: "confirmed" }],
    enabled: !!user && user.role === "inventory",
  });

  const updateDistributionMutation = useMutation({
    mutationFn: ({ sareeId, channel }: { sareeId: string; channel: string }) =>
      apiRequest("PATCH", `/api/inventory/sarees/${sareeId}/distribution`, { channel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Updated", description: "Distribution channel updated." });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/inventory/login");
  };

  if (!user || user.role !== "inventory") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to access this page.</p>
          <Link to="/inventory/login">
            <Button>Go to Inventory Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Link to="/" className="font-serif text-xl font-semibold text-primary">
          Moha Inventory
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} to={item.href}>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <div className="mb-3">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" className="w-full" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-50 bg-background border-b p-4 flex items-center justify-between">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <span className="font-serif text-lg font-semibold text-primary">Moha Inventory</span>
        <div className="w-10" />
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 border-r bg-background h-screen sticky top-0">
          <Sidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Inventory Dashboard</h1>
              <p className="text-muted-foreground">Manage stock, requests, and online orders</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card data-testid="stat-low-stock">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{lowStockItems?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Items below threshold</p>
                </CardContent>
              </Card>

              <Card data-testid="stat-pending-requests">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingRequests?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">From stores</p>
                </CardContent>
              </Card>

              <Card data-testid="stat-pending-orders">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Orders to Ship</CardTitle>
                  <Truck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingOrders?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Ready for dispatch</p>
                </CardContent>
              </Card>
            </div>

            {/* Low Stock Items */}
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Low Stock Items</CardTitle>
                <Link to="/inventory/stock">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {loadingStock ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : lowStockItems && lowStockItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Total Stock</TableHead>
                        <TableHead>Online Stock</TableHead>
                        <TableHead>Distribution</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockItems.slice(0, 5).map((saree) => (
                        <TableRow key={saree.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <img
                                src={saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50&h=50&fit=crop"}
                                alt={saree.name}
                                className="w-10 h-10 rounded object-cover"
                              />
                              <div>
                                <p className="font-medium text-sm line-clamp-1">{saree.name}</p>
                                <p className="text-xs text-muted-foreground">{saree.sku}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={saree.totalStock < 5 ? "destructive" : "secondary"}>
                              {saree.totalStock}
                            </Badge>
                          </TableCell>
                          <TableCell>{saree.onlineStock}</TableCell>
                          <TableCell>
                            <Select
                              value={saree.distributionChannel}
                              onValueChange={(value) =>
                                updateDistributionMutation.mutate({ sareeId: saree.id, channel: value })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="online">Online Only</SelectItem>
                                <SelectItem value="shop">Shop Only</SelectItem>
                                <SelectItem value="both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Link to={`/inventory/stock/${saree.id}`}>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No low stock items
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Pending Store Requests */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pending Store Requests</CardTitle>
                <Link to="/inventory/requests">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {pendingRequests && pendingRequests.length > 0 ? (
                  <div className="space-y-3">
                    {pendingRequests.slice(0, 5).map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{request.saree.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {request.store.name} • Qty: {request.quantity}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Reject</Button>
                          <Button size="sm">Approve</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pending requests
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
