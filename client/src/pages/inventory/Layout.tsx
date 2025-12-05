import { Link, Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";
import { InventorySidebar } from "./SideBar";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import InventoryHeader from "./Header";

export default function InventoryLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();

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

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col"> 
      <InventoryHeader>
        {isMobile && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="p-0 w-64">
              <InventorySidebar />
            </SheetContent>
          </Sheet>
        )}
      </InventoryHeader>

      <div className="flex flex-1">
        <aside className="hidden lg:block w-64 border-r bg-background h-[calc(100vh-64px)] sticky top-16">
          <InventorySidebar />
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
