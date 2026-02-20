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

export const StoreNavGroups = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/store/dashboard" },
    ]
  },
  {
    title: "Sales Operations",
    items: [
      { icon: PlusCircle, label: "New Sale", href: "/store/sale" },
      { icon: ShoppingCart, label: "Cart", href: "/store/cart" },
      { icon: History, label: "Sales History", href: "/store/history" },
    ]
  },
  {
    title: "Inventory Management",
    items: [
      { icon: PackageSearch, label: "Inventory", href: "/store/inventory" },
      { icon: ClipboardList, label: "Stock Requests", href: "/store/requests" },
    ]
  },
  {
    title: "Exchanges",
    items: [
      { icon: RefreshCw, label: "New Exchange", href: "/store/exchange" },
      { icon: ArrowLeftRight, label: "Exchange History", href: "/store/exchanges" },
    ]
  }
];

// Keep the original StoreNavItems for backward compatibility
export const StoreNavItems = StoreNavGroups.flatMap(group => group.items);
