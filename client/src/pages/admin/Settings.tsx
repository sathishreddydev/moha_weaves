import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  LayoutDashboard,
  Tags,
  Palette,
  Shirt,
  Users,
  UserCog,
  Building2,
  ShoppingCart,
  LogOut,
  Menu,
  Ticket,
  Star,
  Settings,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  updatedAt: Date | null;
}

export default function AdminSettings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [returnWindowDays, setReturnWindowDays] = useState("");

  const { data: settings, isLoading } = useQuery<AppSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description?: string }) => {
      return apiRequest("PUT", `/api/admin/settings/${key}`, { value, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Setting updated",
        description: "The setting has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive",
      });
    },
  });

  const handleSaveReturnWindow = () => {
    const days = parseInt(returnWindowDays);
    if (isNaN(days) || days < 0 || days > 60) {
      toast({
        title: "Invalid value",
        description: "Return window must be between 0 and 60 days",
        variant: "destructive",
      });
      return;
    }
    
    updateSettingMutation.mutate({
      key: "return_window_days",
      value: returnWindowDays,
      description: "Number of days customers have to initiate a return after delivery",
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const currentReturnWindow = settings?.find(s => s.key === "return_window_days")?.value || "7";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-primary" data-testid="text-sidebar-title">Moha Admin</h2>
        <p className="text-sm text-muted-foreground" data-testid="text-user-email">{user?.email}</p>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Button
              variant={item.href === "/admin/settings" ? "secondary" : "ghost"}
              className="w-full justify-start mb-1"
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block w-64 border-r border-border bg-card">
        <SidebarContent />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Settings</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Return Policy Settings</CardTitle>
                <CardDescription>
                  Configure the return and exchange policy for your store
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="return-window">Return Window (Days)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="return-window"
                          type="number"
                          min="0"
                          max="60"
                          placeholder={currentReturnWindow}
                          value={returnWindowDays}
                          onChange={(e) => setReturnWindowDays(e.target.value)}
                          className="max-w-[120px]"
                          data-testid="input-return-window"
                        />
                        <Button
                          onClick={handleSaveReturnWindow}
                          disabled={updateSettingMutation.isPending || !returnWindowDays}
                          data-testid="button-save-return-window"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {updateSettingMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Current setting: <span className="font-medium">{currentReturnWindow} days</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Customers can request returns or exchanges within this many days after their order is delivered.
                        Set to 0 to disable returns.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About Settings</CardTitle>
                <CardDescription>
                  How settings affect your store
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Return Window:</strong> When an order is marked as delivered, 
                    the system automatically calculates the return eligibility deadline based on this setting.
                    Customers will only be able to request returns or exchanges within this window.
                  </p>
                  <p>
                    <strong className="text-foreground">Existing Orders:</strong> For orders that were delivered 
                    before this setting was configured, the system will use the original delivery date plus this 
                    window to determine eligibility.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
