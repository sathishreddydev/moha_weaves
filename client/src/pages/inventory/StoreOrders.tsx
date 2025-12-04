
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
  Store,
  TrendingUp,
  ShoppingBag,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { StoreSaleWithItems } from "@shared/schema";

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

export default function InventoryStoreOrders() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<StoreSaleWithItems | null>(null);

  const { data: storeSales, isLoading } = useQuery<StoreSaleWithItems[]>({
    queryKey: ["/api/inventory/store-sales"],
    enabled: !!user && user.role === "inventory",
  });

  const handleLogout = async () => {
    await logout();
    navigate("/inventory/login");
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
              variant={item.href === "/inventory/store-orders" ? "secondary" : "ghost"}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-semibold" data-testid="text-page-title">Store Orders</h1>
                <p className="text-muted-foreground">View all store sales and transactions</p>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : storeSales && storeSales.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sale ID</TableHead>
                          <TableHead>Store</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {storeSales.map((sale) => (
                          <TableRow
                            key={sale.id}
                            data-testid={`row-sale-${sale.id}`}
                            className="cursor-pointer"
                            onClick={() => setSelectedSale(sale)}
                          >
                            <TableCell className="font-mono text-sm">
                              #{sale.id.slice(0, 8).toUpperCase()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Store className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{sale.store.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(sale.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {(sale.items || []).slice(0, 2).map((item) => (
                                  <div
                                    key={item.id}
                                    className="w-10 h-12 rounded overflow-hidden bg-muted"
                                  >
                                    <img
                                      src={item.saree?.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                      alt={item.saree?.name || "Saree"}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                                {(sale.items?.length || 0) > 2 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{(sale.items?.length || 0) - 2}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium">{sale.customerName || "Walk-in"}</p>
                                {sale.customerPhone && (
                                  <p className="text-xs text-muted-foreground">{sale.customerPhone}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatPrice(sale.totalAmount)}
                            </TableCell>
                            <TableCell>
                              <span className="capitalize text-sm">
                                {sale.saleType.replace("_", " ")}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No store sales found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Store Sale Details</DialogTitle>
            <DialogDescription>
              Sale #{selectedSale?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <Store className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Store</p>
                  <p className="text-sm text-muted-foreground">{selectedSale.store.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedSale.store.address}</p>
                </div>
              </div>

              {selectedSale.customerName && (
                <div className="flex items-start gap-2">
                  <ShoppingBag className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Customer</p>
                    <p className="text-sm text-muted-foreground">{selectedSale.customerName}</p>
                    {selectedSale.customerPhone && (
                      <p className="text-xs text-muted-foreground">Phone: {selectedSale.customerPhone}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="font-medium text-sm mb-2">Items</p>
                <div className="space-y-2">
                  {(selectedSale.items || []).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 border rounded">
                      <img
                        src={item.saree?.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"}
                        alt={item.saree?.name || "Saree"}
                        className="w-12 h-16 rounded object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-1">{item.saree?.name || "Unknown Saree"}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} x {formatPrice(item.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="font-bold">{formatPrice(selectedSale.totalAmount)}</span>
              </div>

              <div className="text-sm">
                <p className="font-medium">Sale Type</p>
                <p className="text-muted-foreground capitalize">{selectedSale.saleType.replace("_", " ")}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
