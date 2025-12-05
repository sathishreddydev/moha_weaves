import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { NavItems } from "./NavItems";

export function InventorySidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); 

  const handleNavigation = (href:string) => {
    navigate(href);
  };

  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 p-4 space-y-1">
        {NavItems.map((item) => {
          const isActive = location.pathname === item.href; // check if current page
          return (
            <Button
              key={item.href}
              variant={isActive ? "secondary" : "ghost"} // active style
              className="w-full justify-start gap-3"
              data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              onClick={() => handleNavigation(item.href)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
