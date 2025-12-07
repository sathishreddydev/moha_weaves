import { Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";
import StoreHeader from "./Header";
import { StoreSidebar } from "./SideBar";

export default function StoreLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <StoreHeader>
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="p-0 w-64 lg:hidden">
            <StoreSidebar />
          </SheetContent>
        </Sheet>
      </StoreHeader>

      <div className="flex flex-1">
        <aside className="hidden lg:block w-64 border-r bg-background h-[calc(100vh-64px)] sticky top-16">
          <StoreSidebar />
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
