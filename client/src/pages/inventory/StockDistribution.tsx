import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  Search,
  LogOut,
  Menu,
  LayoutDashboard,
  ClipboardList,
  Truck,
  Globe,
  Store,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Warehouse,
  Shirt,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails, Store as StoreType } from "@shared/schema";

interface StockDistributionItem {
  saree: SareeWithDetails;
  totalStock: number;
  onlineStock: number;
  storeAllocations: { store: StoreType; quantity: number }[];
  unallocated: number;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/inventory/dashboard" },
  { icon: Shirt, label: "Sarees", href: "/inventory/sarees" },
  { icon: Warehouse, label: "Stock Management", href: "/inventory/stock" },
  { icon: BarChart3, label: "Stock Distribution", href: "/inventory/distribution" },
  { icon: ClipboardList, label: "Store Requests", href: "/inventory/requests" },
  { icon: Truck, label: "Online Orders", href: "/inventory/orders" },
  { icon: RotateCcw, label: "Returns", href: "/inventory/returns" },
];

export default function StockDistribution() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: distribution, isLoading } = useQuery<StockDistributionItem[]>({
    queryKey: ["/api/inventory/stock-distribution"],
    enabled: !!user && user.role === "inventory",
  });

  const handleLogout = async () => {
    await logout();
    navigate("/inventory/login");
  };

  const toggleExpand = (sareeId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(sareeId)) {
      newExpanded.delete(sareeId);
    } else {
      newExpanded.add(sareeId);
    }
    setExpandedItems(newExpanded);
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const filteredDistribution = distribution?.filter((item) =>
    item.saree.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.saree.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProducts = distribution?.length || 0;
  const totalStock = distribution?.reduce((sum, item) => sum + item.totalStock, 0) || 0;
  const totalOnline = distribution?.reduce((sum, item) => sum + item.onlineStock, 0) || 0;
  const totalStoreAllocated = distribution?.reduce(
    (sum, item) => sum + item.storeAllocations.reduce((s, a) => s + a.quantity, 0),
    0
  ) || 0;
  const totalUnallocated = distribution?.reduce((sum, item) => sum + item.unallocated, 0) || 0;

  if (!user || user.role !== "inventory") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
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
              variant={item.href === "/inventory/distribution" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <div className="mb-3">
          <p className="text-sm font-medium" data-testid="text-user-name">{user.name}</p>
          <p className="text-xs text-muted-foreground" data-testid="text-user-email">{user.email}</p>
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
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Stock Distribution</h1>
              <p className="text-muted-foreground">View how stock is distributed across channels and stores</p>
            </div>

            {/* Summary Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-stock">{totalStock}</div>
                  <p className="text-xs text-muted-foreground">{totalProducts} products</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Online Stock</CardTitle>
                  <Globe className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-online-stock">{totalOnline}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalStock > 0 ? ((totalOnline / totalStock) * 100).toFixed(1) : 0}% of total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Store Allocated</CardTitle>
                  <Store className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-store-stock">{totalStoreAllocated}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalStock > 0 ? ((totalStoreAllocated / totalStock) * 100).toFixed(1) : 0}% of total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Unallocated</CardTitle>
                  <Warehouse className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600" data-testid="text-unallocated-stock">{totalUnallocated}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalStock > 0 ? ((totalUnallocated / totalStock) * 100).toFixed(1) : 0}% of total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-distribution"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Distribution List */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : filteredDistribution && filteredDistribution.length > 0 ? (
              <div className="space-y-4">
                {filteredDistribution.map((item) => (
                  <Card key={item.saree.id} data-testid={`card-distribution-${item.saree.id}`}>
                    <Collapsible
                      open={expandedItems.has(item.saree.id)}
                      onOpenChange={() => toggleExpand(item.saree.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <CardContent className="p-4 cursor-pointer hover-elevate">
                          <div className="flex items-center gap-4">
                            <img
                              src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=80"}
                              alt={item.saree.name}
                              className="w-16 h-20 rounded object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">{item.saree.name}</h3>
                                <Badge variant="secondary" className="text-xs">
                                  {item.saree.sku || "No SKU"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {formatPrice(item.saree.price)} | {item.saree.category?.name || "Uncategorized"}
                              </p>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="font-medium">Total: {item.totalStock}</span>
                                <span className="text-blue-600">Online: {item.onlineStock}</span>
                                <span className="text-green-600">
                                  Stores: {item.storeAllocations.reduce((s, a) => s + a.quantity, 0)}
                                </span>
                                {item.unallocated > 0 && (
                                  <span className="text-orange-600">Warehouse: {item.unallocated}</span>
                                )}
                              </div>
                              {/* Progress bar showing distribution */}
                              {item.totalStock > 0 ? (
                                <div className="mt-2 flex gap-0.5 h-2 bg-muted rounded overflow-hidden">
                                  {item.onlineStock > 0 && (
                                    <div
                                      className="bg-blue-500"
                                      style={{ width: `${Math.min((item.onlineStock / item.totalStock) * 100, 100)}%` }}
                                      title={`Online: ${item.onlineStock}`}
                                    />
                                  )}
                                  {item.storeAllocations.map((alloc, idx) => (
                                    <div
                                      key={alloc.store.id}
                                      style={{ 
                                        width: `${Math.min((alloc.quantity / item.totalStock) * 100, 100)}%`,
                                        backgroundColor: `hsl(142, 76%, ${45 + idx * 10}%)`
                                      }}
                                      title={`${alloc.store.name}: ${alloc.quantity}`}
                                    />
                                  ))}
                                  {item.unallocated > 0 && (
                                    <div
                                      className="bg-orange-400"
                                      style={{ width: `${Math.min((item.unallocated / item.totalStock) * 100, 100)}%` }}
                                      title={`Unallocated: ${item.unallocated}`}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="mt-2 h-2 bg-muted rounded" title="No stock" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {expandedItems.has(item.saree.id) ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-4 py-4 bg-muted/30">
                          <h4 className="text-sm font-medium mb-3">Stock Breakdown</h4>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {/* Online Stock */}
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                                <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Online</p>
                                <p className="font-semibold">{item.onlineStock} units</p>
                              </div>
                            </div>

                            {/* Store Allocations */}
                            {item.storeAllocations.map((alloc) => (
                              <div
                                key={alloc.store.id}
                                className="flex items-center gap-3 p-3 rounded-lg border bg-background"
                                data-testid={`allocation-${item.saree.id}-${alloc.store.id}`}
                              >
                                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                                  <Store className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">{alloc.store.name}</p>
                                  <p className="font-semibold">{alloc.quantity} units</p>
                                </div>
                              </div>
                            ))}

                            {/* Unallocated */}
                            {item.unallocated > 0 && (
                              <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                                  <Warehouse className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Warehouse (Unallocated)</p>
                                  <p className="font-semibold">{item.unallocated} units</p>
                                </div>
                              </div>
                            )}

                            {item.storeAllocations.length === 0 && item.unallocated === 0 && item.onlineStock === 0 && (
                              <div className="col-span-full text-center py-4 text-sm text-muted-foreground">
                                No stock allocated yet
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Products Found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? "No products match your search" : "No products available"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
