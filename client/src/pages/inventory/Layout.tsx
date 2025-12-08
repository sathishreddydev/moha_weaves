import { Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";
import { InventorySidebar } from "./SideBar";
import InventoryHeader from "./Header";

export default function InventoryLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="scale-[0.8] origin-top-left w-[125%]">
        <div className="min-h-screen flex flex-col">
          <InventoryHeader>
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
          </InventoryHeader>

          <div className="flex flex-1">
            <aside className="hidden lg:block w-64 border-r bg-white fixed left-0 top-16 bottom-0 overflow-y-auto">
              <InventorySidebar />
            </aside>

            <main className="flex-1 p-6 overflow-auto lg:ml-64">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
