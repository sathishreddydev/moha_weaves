import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  RotateCcw,
  Shirt,
  Store,
  Truck
} from "lucide-react";

export const NavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/inventory/dashboard" },
  { icon: Shirt, label: "Products", href: "/inventory/products" },
  {
    icon: BarChart3,
    label: "Stock Distribution",
    href: "/inventory/distribution",
  },
  // { icon: TrendingUp, label: "Analytics", href: "/inventory/analytics" },
  // { icon: Package, label: "Stock Movements", href: "/inventory/stock-movements" },
  { icon: ClipboardList, label: "Store Requests", href: "/inventory/requests" },
  { icon: Truck, label: "Online Orders", href: "/inventory/orders" },
  { icon: Store, label: "Store Orders", href: "/inventory/store-orders" },
  { icon: RotateCcw, label: "Returns", href: "/inventory/returns" },
  { icon: ArrowLeftRight, label: "Exchanges", href: "/inventory/exchanges" },
  { icon: CreditCard, label: "Refunds", href: "/inventory/refunds" },
  { icon: FileText, label: "Damage History", href: "/inventory/damage-history" },
];
