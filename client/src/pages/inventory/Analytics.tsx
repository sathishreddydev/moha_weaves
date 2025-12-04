import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut,
  Menu,
  LayoutDashboard,
  ClipboardList,
  Truck,
  BarChart3,
  Warehouse,
  Shirt,
  RotateCcw,
  Globe,
  Store,
  TrendingUp,
  Package,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/inventory/dashboard" },
  { icon: Shirt, label: "Sarees", href: "/inventory/sarees" },
  { icon: Warehouse, label: "Stock Management", href: "/inventory/stock" },
  { icon: BarChart3, label: "Stock Distribution", href: "/inventory/distribution" },
  { icon: TrendingUp, label: "Analytics", href: "/inventory/analytics" },
  { icon: ClipboardList, label: "Store Requests", href: "/inventory/requests" },
  { icon: Truck, label: "Online Orders", href: "/inventory/orders" },
  { icon: Store, label: "Store Orders", href: "/inventory/store-orders" },
  { icon: RotateCcw, label: "Returns", href: "/inventory/returns" },
];

interface StockMovementStats {
  totalOnlineCleared: number;
  totalStoreCleared: number;
  onlineMovements: {
    sareeId: string;
    sareeName: string;
    quantity: number;
    orderRefId: string;
    createdAt: string;
  }[];
  storeMovements: {
    sareeId: string;
    sareeName: string;
    quantity: number;
    orderRefId: string;
    storeId: string | null;
    storeName: string | null;
    createdAt: string;
  }[];
}

export default function InventoryAnalytics() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: stats, isLoading } = useQuery<StockMovementStats>({
    queryKey: ["/api/inventory/stock-movement-stats"],
    enabled: !!user && user.role === "inventory",
  });

  const { data: storeSales = [] } = useQuery({
    queryKey: ['/api/inventory/store-sales'],
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
              variant={item.href === "/inventory/analytics" ? "secondary" : "ghost"}
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

  // Aggregate top products by quantity cleared
  const getTopProducts = (movements: any[], limit = 10) => {
    const productMap = new Map<string, { name: string; quantity: number }>();

    movements.forEach((movement) => {
      const existing = productMap.get(movement.sareeId);
      if (existing) {
        existing.quantity += movement.quantity;
      } else {
        productMap.set(movement.sareeId, {
          name: movement.sareeName,
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

  const totalCleared = (stats?.totalOnlineCleared || 0) + (stats?.totalStoreCleared || 0);
  const onlinePercentage = totalCleared > 0 ? ((stats?.totalOnlineCleared || 0) / totalCleared) * 100 : 0;
  const storePercentage = totalCleared > 0 ? ((stats?.totalStoreCleared || 0) / totalCleared) * 100 : 0;

  const pieData = [
    { name: "Online", value: stats?.totalOnlineCleared || 0, color: "#3b82f6" },
    { name: "Store", value: stats?.totalStoreCleared || 0, color: "#22c55e" },
  ];

  const topOnlineProducts = stats ? getTopProducts(stats.onlineMovements, 10) : [];
  const topStoreProducts = stats ? getTopProducts(stats.storeMovements, 10) : [];
  const storeStats = stats ? getStoreStats(stats.storeMovements) : [];

  return (
    <div className="min-h-screen bg-muted/30">
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
        <aside className="hidden lg:block w-64 border-r bg-background h-screen sticky top-0">
          <Sidebar />
        </aside>

        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Stock Movement Analytics</h1>
              <p className="text-muted-foreground">Track inventory movements across online and store channels</p>
            </div>

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
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock Cleared</CardTitle>
                      <Package className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalCleared}</div>
                      <p className="text-xs text-muted-foreground">All channels combined</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="stat-online-cleared">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Online Orders</CardTitle>
                      <Globe className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.totalOnlineCleared || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {onlinePercentage.toFixed(1)}% of total
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="stat-store-cleared">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Store Sales</CardTitle>
                      <Store className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.totalStoreCleared || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {storePercentage.toFixed(1)}% of total
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Distribution Chart */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Channel Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="h-64 flex items-center justify-center">
                        <ChartContainer
                          config={{
                            online: { label: "Online", color: "#3b82f6" },
                            store: { label: "Store", color: "#22c55e" },
                          }}
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </div>
                      <div className="flex flex-col justify-center space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded bg-blue-500" />
                            <span className="font-medium">Online Orders</span>
                          </div>
                          <span className="text-2xl font-bold">{stats?.totalOnlineCleared || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded bg-green-500" />
                            <span className="font-medium">Store Sales</span>
                          </div>
                          <span className="text-2xl font-bold">{stats?.totalStoreCleared || 0}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Products */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Top Selling Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="online">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="online">
                          <Globe className="h-4 w-4 mr-2" />
                          Online
                        </TabsTrigger>
                        <TabsTrigger value="store">
                          <Store className="h-4 w-4 mr-2" />
                          Store
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="online">
                        {topOnlineProducts.length > 0 ? (
                          <div className="h-64">
                            <ChartContainer
                              config={{
                                quantity: { label: "Quantity Sold", color: "#3b82f6" },
                              }}
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topOnlineProducts}>
                                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={10} />
                                  <YAxis />
                                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Bar dataKey="quantity" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </ChartContainer>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">No online sales data</p>
                        )}
                      </TabsContent>

                      <TabsContent value="store">
                        {topStoreProducts.length > 0 ? (
                          <div className="h-64">
                            <ChartContainer
                              config={{
                                quantity: { label: "Quantity Sold", color: "#22c55e" },
                              }}
                            >
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topStoreProducts}>
                                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={10} />
                                  <YAxis />
                                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <Bar dataKey="quantity" fill="#22c55e" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </ChartContainer>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">No store sales data</p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Store Performance */}
                {storeStats.length > 0 && (
                  <Card className="mb-8">
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
                            const percentage = ((store.quantity / (stats?.totalStoreCleared || 1)) * 100).toFixed(1);
                            return (
                              <TableRow key={store.id}>
                                <TableCell className="font-medium">{store.name}</TableCell>
                                <TableCell className="text-right">{store.quantity}</TableCell>
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

                {/* Recent Movements */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Recent Online Orders</CardTitle>
                      <Globe className="h-5 w-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      {stats?.onlineMovements && stats.onlineMovements.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {stats.onlineMovements.slice(0, 10).map((movement, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <p className="font-medium text-sm line-clamp-1">{movement.sareeName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Order: {movement.orderRefId.slice(0, 8)}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <Badge variant="secondary">Qty: {movement.quantity}</Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(movement.createdAt), "MMM dd, HH:mm")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No online movements</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Recent Store Sales</CardTitle>
                      <Store className="h-5 w-5 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      {stats?.storeMovements && stats.storeMovements.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {stats.storeMovements.slice(0, 10).map((movement, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <p className="font-medium text-sm line-clamp-1">{movement.sareeName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {movement.storeName || "Unknown Store"}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <Badge variant="secondary">Qty: {movement.quantity}</Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(movement.createdAt), "MMM dd, HH:mm")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No store movements</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}