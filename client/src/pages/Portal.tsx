import { BRAND_NAME } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Shield, Package, Store } from "lucide-react";

const portals = [
  {
    title: "Admin",
    description: "Products, orders, users & settings",
    path: "/admin/login",
    dashboardPath: "/admin/dashboard",
    role: "admin",
    icon: Shield,
  },
  {
    title: "Inventory",
    description: "Stock, distribution & analytics",
    path: "/inventory/login",
    dashboardPath: "/inventory/dashboard",
    role: "inventory",
    icon: Package,
  },
  {
    title: "Store",
    description: "Point of sale, billing & exchanges",
    path: "/store/login",
    dashboardPath: "/store/dashboard",
    role: "store",
    icon: Store,
  },
];

export default function Portal() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const portal = portals.find((p) => p.role === user.role);
      if (portal) {
        navigate(portal.dashboardPath, { replace: true });
      }
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center mb-12">
        <h1 className="font-serif text-3xl font-semibold tracking-tight mb-1">
          {BRAND_NAME}
        </h1>
        <p className="text-sm text-muted-foreground">Select portal</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
        {portals.map((portal) => {
          const Icon = portal.icon;
          return (
            <button
              key={portal.role}
              onClick={() => navigate(portal.path)}
              className="border rounded-lg p-6 flex flex-col items-center gap-3 transition-colors hover:bg-muted/50"
            >
              <Icon className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">{portal.title}</span>
              <span className="text-xs text-muted-foreground text-center">
                {portal.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
