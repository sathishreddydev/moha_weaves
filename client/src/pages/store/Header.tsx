// InventoryHeader.tsx

import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

export default function StoreHeader({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const handleLogout = () => logout();

  return (
    <header className="w-full h-16 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-20">
      
      <div className="flex items-center gap-2">
        {children}
        {<h1 className="font-serif text-lg font-semibold text-primary">Moha Store</h1>}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {!isMobile &&  <span className="text-sm">{user?.name ?? "User"}</span>}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
