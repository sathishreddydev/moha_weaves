import {
  LayoutDashboard,
  Shirt,
  Warehouse,
  BarChart3,
  ClipboardList,
  Truck,
  RotateCcw,
  TrendingUp,
  Store,
} from "lucide-react";

export const NavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/inventory/dashboard" },
  { icon: Shirt, label: "Sarees", href: "/inventory/sarees" },
  // { icon: Warehouse, label: "Stock Management", href: "/inventory/stock" },
  {
    icon: BarChart3,
    label: "Stock Distribution",
    href: "/inventory/distribution",
  },
  { icon: TrendingUp, label: "Analytics", href: "/inventory/analytics" },
  { icon: ClipboardList, label: "Store Requests", href: "/inventory/requests" },
  { icon: Truck, label: "Online Orders", href: "/inventory/orders" },
  { icon: Store, label: "Store Orders", href: "/inventory/store-orders" },
  { icon: RotateCcw, label: "Returns", href: "/inventory/returns" },
];
