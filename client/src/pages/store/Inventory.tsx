import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Search,
  LogOut,
  Menu,
  LayoutDashboard,
  PackageSearch,
  ClipboardList,
  History,
  Globe,
  Store,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails } from "@shared/schema";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/store/dashboard" },
  { icon: ShoppingCart, label: "New Sale", href: "/store/sale" },
  { icon: PackageSearch, label: "Inventory", href: "/store/inventory" },
  { icon: ClipboardList, label: "Request Stock", href: "/store/requests" },
  { icon: History, label: "Sales History", href: "/store/history" },
];

type ShopProduct = {
  saree: SareeWithDetails;
  storeStock: number;
};

export default function StoreInventoryPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock">("all");

  const { data: products, isLoading } = useQuery<ShopProduct[]>({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store",
  });

  const handleLogout = async () => {
    await logout();
    navigate("/store/login");
  };

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const filteredProducts = products?.filter((item) => {
    const matchesSearch =
      item.saree.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.saree.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    if (stockFilter === "in-stock") {
      return matchesSearch && item.storeStock > 0;
    } else if (stockFilter === "out-of-stock") {
      return matchesSearch && item.storeStock === 0;
    }
    return matchesSearch;
  });

  const inStockCount = products?.filter((p) => p.storeStock > 0).length || 0;
  const outOfStockCount = products?.filter((p) => p.storeStock === 0).length || 0;

  if (!user || user.role !== "store") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <Link to="/store/login">
            <Button>Go to Store Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Link to="/" className="font-serif text-xl font-semibold text-primary">
          Moha Store
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} to={item.href}>
            <Button
              variant={item.href === "/store/inventory" ? "secondary" : "ghost"}
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

  const getDistributionBadge = (channel: string) => {
    switch (channel) {
      case "shop":
        return (
          <Badge variant="outline" className="gap-1">
            <Store className="h-3 w-3" />
            Shop Only
          </Badge>
        );
      case "online":
        return (
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" />
            Online
          </Badge>
        );
      case "both":
        return (
          <Badge variant="outline" className="gap-1">
            <ArrowLeftRight className="h-3 w-3" />
            Both
          </Badge>
        );
      default:
        return null;
    }
  };

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
        <span className="font-serif text-lg font-semibold text-primary">Moha Store</span>
        <div className="w-10" />
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-64 border-r bg-background h-screen sticky top-0">
          <Sidebar />
        </aside>

        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-semibold" data-testid="text-page-title">Shop Products</h1>
                <p className="text-muted-foreground">All products available for your store</p>
              </div>
              <Link to="/store/requests">
                <Button data-testid="button-request-stock">
                  <Package className="h-4 w-4 mr-2" />
                  Request Stock
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{products?.length || 0}</div>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{inStockCount}</div>
                  <p className="text-sm text-muted-foreground">In Stock</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-amber-600">{outOfStockCount}</div>
                  <p className="text-sm text-muted-foreground">Need to Request</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or SKU..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search"
                    />
                  </div>
                  <Select
                    value={stockFilter}
                    onValueChange={(value) => setStockFilter(value as typeof stockFilter)}
                  >
                    <SelectTrigger className="w-40" data-testid="select-stock-filter">
                      <SelectValue placeholder="Filter by stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      <SelectItem value="in-stock">In Stock</SelectItem>
                      <SelectItem value="out-of-stock">Need Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : filteredProducts && filteredProducts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Availability</TableHead>
                          <TableHead>Your Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map((item) => (
                          <TableRow key={item.saree.id} data-testid={`row-product-${item.saree.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <img
                                  src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                  alt=""
                                  className="w-10 h-12 rounded object-cover"
                                />
                                <span className="font-medium max-w-[200px] truncate">{item.saree.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono text-sm">
                              {item.saree.sku || "-"}
                            </TableCell>
                            <TableCell>{item.saree.category?.name || "-"}</TableCell>
                            <TableCell className="font-medium">{formatPrice(item.saree.price)}</TableCell>
                            <TableCell>
                              {getDistributionBadge(item.saree.distributionChannel)}
                            </TableCell>
                            <TableCell>
                              {item.storeStock > 0 ? (
                                <Badge
                                  variant={item.storeStock < 5 ? "secondary" : "default"}
                                  className={item.storeStock < 5 ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" : ""}
                                >
                                  {item.storeStock} in stock
                                </Badge>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">No stock</Badge>
                                  <Link to="/store/requests">
                                    <Button size="sm" variant="outline" data-testid={`button-request-${item.saree.id}`}>
                                      Request
                                    </Button>
                                  </Link>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No matching products found" : "No products available for shop"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
