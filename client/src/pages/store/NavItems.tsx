import {
  ArrowLeftRight,
  ClipboardList,
  History,
  LayoutDashboard,
  PackageSearch,
  PlusCircle,
  RefreshCw,
  ShoppingCart
} from "lucide-react";

export const StoreNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/store/dashboard" },
  { icon: PlusCircle, label: "New Sale", href: "/store/sale" },
  { icon: ShoppingCart, label: "Cart", href: "/store/cart" },
  { icon: PackageSearch, label: "Inventory", href: "/store/inventory" },
  { icon: ClipboardList, label: "Stock Requests", href: "/store/requests" },
  { icon: RefreshCw, label: "New Exchange", href: "/store/exchange" },
  { icon: History, label: "Sales History", href: "/store/history" },
  { icon: ArrowLeftRight, label: "Exchange History", href: "/store/exchanges" },
];
