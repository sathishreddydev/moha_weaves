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
  Edit,
  Save,
  X,
  Globe,
  Store,
  ArrowLeftRight,
  BarChart3,
  Warehouse,
  Shirt,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SareeWithDetails } from "@shared/schema";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/inventory/dashboard" },
  { icon: Shirt, label: "Sarees", href: "/inventory/sarees" },
  { icon: Warehouse, label: "Stock Management", href: "/inventory/stock" },
  { icon: BarChart3, label: "Stock Distribution", href: "/inventory/distribution" },
  { icon: ClipboardList, label: "Store Requests", href: "/inventory/requests" },
  { icon: Truck, label: "Online Orders", href: "/inventory/orders" },
  { icon: RotateCcw, label: "Returns", href: "/inventory/returns" },
];

export default function InventoryStock() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSaree, setSelectedSaree] = useState<SareeWithDetails | null>(null);
  const [stockForm, setStockForm] = useState({ totalStock: 0, onlineStock: 0, distributionChannel: "both" as "shop" | "online" | "both" });

  const { data: sarees, isLoading } = useQuery<SareeWithDetails[]>({
    queryKey: ["/api/sarees"],
    enabled: !!user && user.role === "inventory",
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ sareeId, totalStock, onlineStock }: { sareeId: string; totalStock: number; onlineStock: number }) => {
      const response = await apiRequest("PATCH", `/api/inventory/sarees/${sareeId}/stock`, { totalStock, onlineStock });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sarees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({ title: "Success", description: "Stock updated successfully" });
      setEditDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update stock", variant: "destructive" });
    },
  });

  const updateDistributionMutation = useMutation({
    mutationFn: async ({ sareeId, channel }: { sareeId: string; channel: string }) => {
      const response = await apiRequest("PATCH", `/api/inventory/sarees/${sareeId}/distribution`, { channel });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sarees"] });
      toast({ title: "Success", description: "Distribution channel updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update distribution", variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/inventory/login");
  };

  const openEditDialog = (saree: SareeWithDetails) => {
    setSelectedSaree(saree);
    setStockForm({
      totalStock: saree.totalStock,
      onlineStock: saree.onlineStock,
      distributionChannel: saree.distributionChannel,
    });
    setEditDialogOpen(true);
  };

  const handleSaveStock = () => {
    if (selectedSaree) {
      updateStockMutation.mutate({
        sareeId: selectedSaree.id,
        totalStock: stockForm.totalStock,
        onlineStock: stockForm.onlineStock,
      });
    }
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const filteredSarees = sarees?.filter((saree) =>
    saree.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    saree.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              variant={item.href === "/inventory/stock" ? "secondary" : "ghost"}
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
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Stock Management</h1>
              <p className="text-muted-foreground">Update inventory levels and distribution channels</p>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or SKU..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Total Stock</TableHead>
                          <TableHead>Online Stock</TableHead>
                          <TableHead>Distribution</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSarees?.map((saree) => (
                          <TableRow key={saree.id} data-testid={`row-stock-${saree.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <img
                                  src={saree.imageUrl || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"}
                                  alt={saree.name}
                                  className="w-10 h-12 rounded object-cover"
                                />
                                <span className="font-medium max-w-[200px] truncate">{saree.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono text-sm">
                              {saree.sku || "-"}
                            </TableCell>
                            <TableCell>{formatPrice(saree.price)}</TableCell>
                            <TableCell>
                              <Badge variant={saree.totalStock < 10 ? "destructive" : saree.totalStock < 25 ? "secondary" : "default"}>
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
                                disabled={updateDistributionMutation.isPending}
                              >
                                <SelectTrigger className="w-32" data-testid={`select-channel-${saree.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="online">
                                    <div className="flex items-center gap-2">
                                      <Globe className="h-3 w-3" />
                                      Online Only
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="shop">
                                    <div className="flex items-center gap-2">
                                      <Store className="h-3 w-3" />
                                      Shop Only
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="both">
                                    <div className="flex items-center gap-2">
                                      <ArrowLeftRight className="h-3 w-3" />
                                      Both
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(saree)}
                                data-testid={`button-edit-stock-${saree.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
            <DialogDescription>
              {selectedSaree?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="totalStock">Total Stock</Label>
                <Input
                  id="totalStock"
                  type="number"
                  min="0"
                  value={stockForm.totalStock}
                  onChange={(e) => setStockForm({ ...stockForm, totalStock: parseInt(e.target.value) || 0 })}
                  data-testid="input-total-stock"
                />
              </div>
              <div>
                <Label htmlFor="onlineStock">Online Stock</Label>
                <Input
                  id="onlineStock"
                  type="number"
                  min="0"
                  max={stockForm.totalStock}
                  value={stockForm.onlineStock}
                  onChange={(e) => setStockForm({ ...stockForm, onlineStock: Math.min(parseInt(e.target.value) || 0, stockForm.totalStock) })}
                  data-testid="input-online-stock"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Shop stock: {stockForm.totalStock - stockForm.onlineStock}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveStock}
              disabled={updateStockMutation.isPending}
              data-testid="button-save-stock"
            >
              {updateStockMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
