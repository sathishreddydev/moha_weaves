import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftRight,
  Package,
  Plus,
  Search,
  LogOut,
  Menu,
  LayoutDashboard,
  ShoppingCart,
  PackageSearch,
  ClipboardList,
  History,
  Minus,
  Trash2,
  ArrowLeft,
  Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SareeWithDetails, StoreSaleWithItems } from "@shared/schema";

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

interface ReturnItem {
  saleItemId: string;
  sareeId: string;
  saree: SareeWithDetails;
  quantity: number;
  maxQuantity: number;
  unitPrice: string;
  returnAmount: string;
}

interface NewCartItem {
  sareeId: string;
  saree: SareeWithDetails;
  quantity: number;
  maxQuantity: number;
  unitPrice: string;
  lineAmount: string;
}

interface SaleItemWithAvailable {
  id: string;
  sareeId: string;
  quantity: number;
  returnedQuantity: number;
  price: string;
  saree: SareeWithDetails;
  availableQuantity: number;
}

export default function StoreExchange() {
  const navigate = useNavigate();
  const { saleId: urlSaleId } = useParams();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saleIdInput, setSaleIdInput] = useState(urlSaleId || "");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(urlSaleId || null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [newItems, setNewItems] = useState<NewCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showNewItemsSection, setShowNewItemsSection] = useState(false);

  const { data: saleData, isLoading: saleLoading, refetch: refetchSale } = useQuery<StoreSaleWithItems>({
    queryKey: ["/api/store/sales", selectedSaleId],
    queryFn: async () => {
      const response = await fetch(`/api/store/sales/${selectedSaleId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Sale not found");
      return response.json();
    },
    enabled: !!selectedSaleId && !!user && user.role === "store",
  });

  const { data: products, isLoading: productsLoading } = useQuery<ShopProduct[]>({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store" && showNewItemsSection,
  });

  useEffect(() => {
    if (saleData) {
      setCustomerName(saleData.customerName || "");
      setCustomerPhone(saleData.customerPhone || "");
    }
  }, [saleData]);

  const createExchangeMutation = useMutation({
    mutationFn: async (data: {
      originalSaleId: string;
      returnItems: { saleItemId: string; sareeId: string; quantity: number; unitPrice: string; returnAmount: string }[];
      newItems: { sareeId: string; quantity: number; unitPrice: string; lineAmount: string }[];
      reason: string;
      notes: string;
      customerName: string;
      customerPhone: string;
    }) => {
      const response = await apiRequest("POST", "/api/store/exchanges", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/exchanges"] });
      toast({ title: "Success", description: "Exchange completed successfully" });
      navigate("/store/history");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to complete exchange", 
        variant: "destructive" 
      });
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

  const handleLookupSale = () => {
    if (saleIdInput.trim()) {
      setSelectedSaleId(saleIdInput.trim());
      setReturnItems([]);
      setNewItems([]);
    }
  };

  const saleItems: SaleItemWithAvailable[] = saleData?.items?.map((item: any) => ({
    ...item,
    availableQuantity: item.quantity - (item.returnedQuantity || 0),
  })) || [];

  const addReturnItem = (saleItem: SaleItemWithAvailable) => {
    if (saleItem.availableQuantity <= 0) {
      toast({ title: "Not available", description: "This item has already been fully returned", variant: "destructive" });
      return;
    }
    const existing = returnItems.find((item) => item.saleItemId === saleItem.id);
    if (existing) {
      if (existing.quantity < saleItem.availableQuantity) {
        setReturnItems(
          returnItems.map((item) =>
            item.saleItemId === saleItem.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  returnAmount: ((item.quantity + 1) * parseFloat(item.unitPrice)).toString(),
                }
              : item
          )
        );
      } else {
        toast({ title: "Limit reached", description: "Cannot return more than available quantity" });
      }
    } else {
      setReturnItems([
        ...returnItems,
        {
          saleItemId: saleItem.id,
          sareeId: saleItem.sareeId,
          saree: saleItem.saree,
          quantity: 1,
          maxQuantity: saleItem.availableQuantity,
          unitPrice: saleItem.price,
          returnAmount: saleItem.price,
        },
      ]);
    }
  };

  const updateReturnQuantity = (saleItemId: string, delta: number) => {
    setReturnItems(
      returnItems
        .map((item) => {
          if (item.saleItemId !== saleItemId) return item;
          const newQty = item.quantity + delta;
          if (newQty < 1) return null;
          if (newQty > item.maxQuantity) {
            toast({ title: "Limit reached", description: "Cannot exceed available quantity" });
            return item;
          }
          return {
            ...item,
            quantity: newQty,
            returnAmount: (newQty * parseFloat(item.unitPrice)).toString(),
          };
        })
        .filter(Boolean) as ReturnItem[]
    );
  };

  const removeReturnItem = (saleItemId: string) => {
    setReturnItems(returnItems.filter((item) => item.saleItemId !== saleItemId));
  };

  const addNewItem = (product: ShopProduct) => {
    if (product.storeStock === 0) {
      toast({ title: "Out of stock", description: "This product is not available", variant: "destructive" });
      return;
    }
    const existing = newItems.find((item) => item.sareeId === product.saree.id);
    if (existing) {
      if (existing.quantity < product.storeStock) {
        setNewItems(
          newItems.map((item) =>
            item.sareeId === product.saree.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  lineAmount: ((item.quantity + 1) * parseFloat(item.unitPrice)).toString(),
                }
              : item
          )
        );
      } else {
        toast({ title: "Limit reached", description: "Cannot add more than available stock" });
      }
    } else {
      setNewItems([
        ...newItems,
        {
          sareeId: product.saree.id,
          saree: product.saree,
          quantity: 1,
          maxQuantity: product.storeStock,
          unitPrice: product.saree.price,
          lineAmount: product.saree.price,
        },
      ]);
    }
  };

  const updateNewItemQuantity = (sareeId: string, delta: number) => {
    setNewItems(
      newItems
        .map((item) => {
          if (item.sareeId !== sareeId) return item;
          const newQty = item.quantity + delta;
          if (newQty < 1) return null;
          if (newQty > item.maxQuantity) {
            toast({ title: "Limit reached", description: "Cannot exceed available stock" });
            return item;
          }
          return {
            ...item,
            quantity: newQty,
            lineAmount: (newQty * parseFloat(item.unitPrice)).toString(),
          };
        })
        .filter(Boolean) as NewCartItem[]
    );
  };

  const removeNewItem = (sareeId: string) => {
    setNewItems(newItems.filter((item) => item.sareeId !== sareeId));
  };

  const returnTotal = returnItems.reduce((sum, item) => sum + parseFloat(item.returnAmount), 0);
  const newItemsTotal = newItems.reduce((sum, item) => sum + parseFloat(item.lineAmount), 0);
  const balanceAmount = Math.abs(returnTotal - newItemsTotal);
  const balanceDirection = returnTotal > newItemsTotal ? "refund" : returnTotal < newItemsTotal ? "due" : "even";

  const handleCompleteExchange = () => {
    if (returnItems.length === 0) {
      toast({ title: "No return items", description: "Select at least one item to return" });
      return;
    }

    createExchangeMutation.mutate({
      originalSaleId: selectedSaleId!,
      returnItems: returnItems.map((item) => ({
        saleItemId: item.saleItemId,
        sareeId: item.sareeId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        returnAmount: item.returnAmount,
      })),
      newItems: newItems.map((item) => ({
        sareeId: item.sareeId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineAmount: item.lineAmount,
      })),
      reason,
      notes,
      customerName,
      customerPhone,
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
              variant="ghost"
              className="w-full justify-start gap-3"
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
        <Button variant="outline" className="w-full" onClick={handleLogout}>
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
            <Button variant="ghost" size="icon">
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
              <div className="flex items-center gap-4 mb-2">
                <Link to="/store/history">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-semibold flex items-center gap-2">
                    <ArrowLeftRight className="h-6 w-6" />
                    Process Exchange
                  </h1>
                  <p className="text-muted-foreground">Return items from a sale and optionally add new items</p>
                </div>
              </div>
            </div>

            {!selectedSaleId ? (
              <Card className="max-w-md mx-auto">
                <CardHeader>
                  <CardTitle>Find Original Sale</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="saleId">Sale ID</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="saleId"
                        placeholder="Enter sale ID..."
                        value={saleIdInput}
                        onChange={(e) => setSaleIdInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLookupSale()}
                      />
                      <Button onClick={handleLookupSale}>
                        <Search className="h-4 w-4 mr-2" />
                        Find
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Or go to Sales History and click "Exchange" on a sale
                  </p>
                </CardContent>
              </Card>
            ) : saleLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
            ) : !saleData ? (
              <Card className="max-w-md mx-auto">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">Sale not found</p>
                  <Button variant="outline" onClick={() => setSelectedSaleId(null)}>
                    Try Another
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <RefreshCw className="h-5 w-5" />
                          Items to Return
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSaleId(null)}>
                          Change Sale
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Sale #{selectedSaleId?.slice(0, 8).toUpperCase()}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm font-medium mb-3">Original Sale Items</p>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {saleItems.map((item) => {
                          const inReturn = returnItems.find((r) => r.saleItemId === item.id);
                          const isUnavailable = item.availableQuantity <= 0;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                isUnavailable ? "opacity-50" : "hover-elevate cursor-pointer"
                              }`}
                              onClick={() => !isUnavailable && addReturnItem(item)}
                            >
                              <div className="flex items-center gap-3">
                                <img
                                  src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                  alt=""
                                  className="w-12 h-16 rounded object-cover"
                                />
                                <div>
                                  <p className="font-medium text-sm line-clamp-1">{item.saree.name}</p>
                                  <p className="text-sm text-primary font-semibold">{formatPrice(item.price)}</p>
                                  <Badge variant={isUnavailable ? "destructive" : "secondary"} className="text-xs">
                                    {item.availableQuantity} available
                                  </Badge>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" disabled={isUnavailable}>
                                {inReturn ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>

                      {returnItems.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <p className="text-sm font-medium mb-3">Selected Returns</p>
                          <div className="space-y-2">
                            {returnItems.map((item) => (
                              <div key={item.saleItemId} className="flex items-center gap-3 p-2 border rounded-lg bg-red-50 dark:bg-red-950/20">
                                <img
                                  src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                  alt=""
                                  className="w-10 h-12 rounded object-cover"
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-sm line-clamp-1">{item.saree.name}</p>
                                  <p className="text-xs text-muted-foreground">{formatPrice(item.unitPrice)} each</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); updateReturnQuantity(item.saleItemId, -1); }}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); updateReturnQuantity(item.saleItemId, 1); }}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={(e) => { e.stopPropagation(); removeReturnItem(item.saleItemId); }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-center py-3 mt-2 border-t font-bold text-red-600">
                            <span>Return Amount</span>
                            <span>{formatPrice(returnTotal)}</span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          New Items (Optional)
                        </CardTitle>
                        <Button
                          variant={showNewItemsSection ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setShowNewItemsSection(!showNewItemsSection)}
                        >
                          {showNewItemsSection ? "Hide" : "Add Items"}
                        </Button>
                      </div>
                    </CardHeader>
                    {showNewItemsSection && (
                      <CardContent>
                        <div className="relative mb-4">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search products..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>

                        {productsLoading ? (
                          <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                              <Skeleton key={i} className="h-16" />
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {filteredProducts?.map((item) => {
                              const inNew = newItems.find((c) => c.sareeId === item.saree.id);
                              return (
                                <div
                                  key={item.saree.id}
                                  className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                                  onClick={() => addNewItem(item)}
                                >
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                      alt=""
                                      className="w-10 h-12 rounded object-cover"
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
                                    {inNew ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Plus className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {newItems.length > 0 && (
                          <>
                            <Separator className="my-4" />
                            <p className="text-sm font-medium mb-3">New Items</p>
                            <div className="space-y-2">
                              {newItems.map((item) => (
                                <div key={item.sareeId} className="flex items-center gap-3 p-2 border rounded-lg bg-green-50 dark:bg-green-950/20">
                                  <img
                                    src={item.saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                    alt=""
                                    className="w-10 h-12 rounded object-cover"
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium text-sm line-clamp-1">{item.saree.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatPrice(item.unitPrice)} each</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={(e) => { e.stopPropagation(); updateNewItemQuantity(item.sareeId, -1); }}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={(e) => { e.stopPropagation(); updateNewItemQuantity(item.sareeId, 1); }}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={(e) => { e.stopPropagation(); removeNewItem(item.sareeId); }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center py-3 mt-2 border-t font-bold text-green-600">
                              <span>New Items Total</span>
                              <span>{formatPrice(newItemsTotal)}</span>
                            </div>
                          </>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Exchange Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Return Items ({returnItems.length})</span>
                          <span className="text-red-600 font-medium">-{formatPrice(returnTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">New Items ({newItems.length})</span>
                          <span className="text-green-600 font-medium">+{formatPrice(newItemsTotal)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Balance</span>
                          <span className={
                            balanceDirection === "refund" ? "text-red-600" :
                            balanceDirection === "due" ? "text-green-600" :
                            "text-muted-foreground"
                          }>
                            {balanceDirection === "refund" && `Refund ${formatPrice(balanceAmount)}`}
                            {balanceDirection === "due" && `Customer Pays ${formatPrice(balanceAmount)}`}
                            {balanceDirection === "even" && "Even Exchange"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Exchange Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="customerName">Customer Name</Label>
                        <Input
                          id="customerName"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter customer name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customerPhone">Phone Number</Label>
                        <Input
                          id="customerPhone"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="+91 XXXXX XXXXX"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reason">Reason for Exchange</Label>
                        <Input
                          id="reason"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g., Size issue, Color preference, Defect"
                        />
                      </div>
                      <div>
                        <Label htmlFor="notes">Additional Notes</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any additional information..."
                          rows={3}
                        />
                      </div>
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleCompleteExchange}
                        disabled={returnItems.length === 0 || createExchangeMutation.isPending}
                      >
                        {createExchangeMutation.isPending ? "Processing..." : "Complete Exchange"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
