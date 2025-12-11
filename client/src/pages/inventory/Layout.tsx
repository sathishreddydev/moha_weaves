import { Outlet } from "react-router-dom";
import { InventorySidebar } from "./SideBar";
import InventoryHeader from "./Header";

export default function InventoryLayout() {
  return (
    <div className="h-screen flex flex-col">
      <InventoryHeader />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden lg:block w-64 border-r bg-white h-full overflow-y-auto sticky top-16">
          <InventorySidebar />
        </aside>

        <main className="flex-1 p-6 overflow-y-auto bg-muted/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
