import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Plus,
  Search,
  LogOut,
  Menu,
  LayoutDashboard,
  PackageSearch,
  ClipboardList,
  History,
  Minus,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface CartItem {
  sareeId: string;
  saree: SareeWithDetails;
  quantity: number;
  price: string;
  maxQuantity: number;
}

export default function StoreSale() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleType, setSaleType] = useState<"walk_in" | "reserved">("walk_in");

  const { data: products, isLoading } = useQuery<ShopProduct[]>({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store",
  });

  const createSaleMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerPhone: string;
      items: { sareeId: string; quantity: number; price: string }[];
      saleType: "walk_in" | "reserved";
    }) => {
      const response = await apiRequest("POST", "/api/store/sales", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/inventory"] });
      toast({ title: "Success", description: "Sale completed successfully" });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setSaleType("walk_in");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete sale", variant: "destructive" });
    },
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

  const addToCart = (product: ShopProduct) => {
    if (product.storeStock === 0) {
      toast({ title: "Out of stock", description: "This product is not available in your store", variant: "destructive" });
      return;
    }
    const existing = cart.find((item) => item.sareeId === product.saree.id);
    if (existing) {
      if (existing.quantity < product.storeStock) {
        setCart(
          cart.map((item) =>
            item.sareeId === product.saree.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      } else {
        toast({ title: "Limit reached", description: "Cannot add more than available stock" });
      }
    } else {
      setCart([
        ...cart,
        {
          sareeId: product.saree.id,
          saree: product.saree,
          quantity: 1,
          price: product.saree.price,
          maxQuantity: product.storeStock,
        },
      ]);
    }
  };

  const updateQuantity = (sareeId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.sareeId !== sareeId) return item;
          const newQty = item.quantity + delta;
          if (newQty < 1) return item;
          if (newQty > item.maxQuantity) {
            toast({ title: "Limit reached", description: "Cannot exceed available stock" });
            return item;
          }
          return { ...item, quantity: newQty };
        })
    );
  };

  const removeFromCart = (sareeId: string) => {
    setCart(cart.filter((item) => item.sareeId !== sareeId));
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = typeof item.price === "string" ? parseFloat(item.price) : item.price;
    return sum + price * item.quantity;
  }, 0);

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast({ title: "Empty cart", description: "Add items to the cart first" });
      return;
    }

    createSaleMutation.mutate({
      customerName,
      customerPhone,
      saleType,
      items: cart.map((item) => ({
        sareeId: item.sareeId,
        quantity: item.quantity,
        price: item.price,
      })),
    });
  };

  const filteredProducts = products?.filter(
    (item) =>
      item.storeStock > 0 &&
      (item.saree.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.saree.sku?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
              variant={item.href === "/store/sale" ? "secondary" : "ghost"}
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
        <span className="font-serif text-lg font-semibold text-primary">Moha Store</span>
        <div className="w-10" />
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-64 border-r bg-background h-screen sticky top-0">
          <Sidebar />
        </aside>

        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">New Sale</h1>
              <p className="text-muted-foreground">Process a new in-store sale</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Product Selection */}
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Select Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-products"
                    />
                  </div>

                  {isLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {filteredProducts?.map((item) => {
                        const inCart = cart.find((c) => c.sareeId === item.saree.id);
                        return (
                          <div
                            key={item.saree.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                            onClick={() => addToCart(item)}
                            data-testid={`product-${item.saree.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                alt=""
                                className="w-12 h-16 rounded object-cover"
                              />
                              <div>
                                <p className="font-medium text-sm line-clamp-1">{item.saree.name}</p>
                                <p className="text-sm text-primary font-semibold">{formatPrice(item.saree.price)}</p>
                                <Badge variant="secondary" className="text-xs">
                                  {item.storeStock} in stock
                                </Badge>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon">
                              {inCart ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                      {filteredProducts?.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No products in stock
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cart and Checkout */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Cart ({cart.length} items)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cart.length > 0 ? (
                      <div className="space-y-3 mb-4">
                        {cart.map((item) => (
                          <div key={item.sareeId} className="flex items-center gap-3 p-2 border rounded-lg">
                            <img
                              src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                              alt=""
                              className="w-12 h-16 rounded object-cover"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm line-clamp-1">{item.saree.name}</p>
                              <p className="text-sm text-muted-foreground">{formatPrice(item.price)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.sareeId, -1)}
                                data-testid={`button-decrease-${item.sareeId}`}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.sareeId, 1)}
                                data-testid={`button-increase-${item.sareeId}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeFromCart(item.sareeId)}
                                data-testid={`button-remove-${item.sareeId}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-6">
                        No items in cart. Select products to add.
                      </p>
                    )}

                    {cart.length > 0 && (
                      <div className="flex justify-between items-center py-3 border-t font-bold">
                        <span>Total</span>
                        <span className="text-primary text-lg">{formatPrice(cartTotal)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {cart.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Customer Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="saleType">Sale Type</Label>
                        <Select value={saleType} onValueChange={(v: "walk_in" | "reserved") => setSaleType(v)}>
                          <SelectTrigger data-testid="select-sale-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="walk_in">Walk-in Customer</SelectItem>
                            <SelectItem value="reserved">Reserved / Pre-ordered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="customerName">Customer Name (Optional)</Label>
                        <Input
                          id="customerName"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter customer name"
                          data-testid="input-customer-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customerPhone">Phone Number (Optional)</Label>
                        <Input
                          id="customerPhone"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="+91 XXXXX XXXXX"
                          data-testid="input-customer-phone"
                        />
                      </div>
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleCompleteSale}
                        disabled={createSaleMutation.isPending}
                        data-testid="button-complete-sale"
                      >
                        {createSaleMutation.isPending ? "Processing..." : `Complete Sale - ${formatPrice(cartTotal)}`}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
