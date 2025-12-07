import { LayoutDashboard, ShoppingCart, PackageSearch, ClipboardList, History } from "lucide-react";


export const StoreNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/store/dashboard" },
  { icon: ShoppingCart, label: "New Sale", href: "/store/sale" },
  { icon: PackageSearch, label: "Inventory", href: "/store/inventory" },
  { icon: ClipboardList, label: "Request Stock", href: "/store/requests" },
  { icon: History, label: "Sales History", href: "/store/history" },
];