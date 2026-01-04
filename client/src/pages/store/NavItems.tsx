import { LayoutDashboard, ShoppingCart, PackageSearch, ClipboardList, History, ArrowLeftRight, Users, BarChart3 } from "lucide-react";

export const StoreNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/store/dashboard" },
  { icon: ShoppingCart, label: "New Sale", href: "/store/sale" },
  { icon: PackageSearch, label: "Inventory", href: "/store/inventory" },
  { icon: ClipboardList, label: "Request Stock", href: "/store/requests" },
  { icon: ShoppingCart, label: "Cart", href: "/store/cart" },
  { icon: History, label: "Sales History", href: "/store/history" },
  { icon: ArrowLeftRight, label: "Exchange History", href: "/store/exchanges" },
];