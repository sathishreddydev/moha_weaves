import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  RotateCcw,
  Shirt,
  Store,
  Truck,
  TrendingUp,
  AlertTriangle,
  Settings,
  CheckCircle,
  Users,
  Activity
} from "lucide-react";

export const NavGroups = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/inventory/dashboard" },
      // { icon: BarChart3, label: "Analytics", href: "/inventory/analytics" },
    ]
  },
  {
    title: "Inventory Management",
    items: [
      { icon: Shirt, label: "Products", href: "/inventory/products" },
      { icon: BarChart3, label: "Stock Distribution", href: "/inventory/distribution" },
      { icon: TrendingUp, label: "Stock Movements", href: "/inventory/stock-movements" },
      { icon: CheckCircle, label: "Stock Reconciliation", href: "/inventory/stock-reconciliation" },
      { icon: Settings, label: "Batch Operations", href: "/inventory/batch-stock-operations" },
    ]
  },
  {
    title: "Orders & Requests",
    items: [
      { icon: Truck, label: "Online Orders", href: "/inventory/orders" },
      { icon: Store, label: "Store Orders", href: "/inventory/store-orders" },
      { icon: ClipboardList, label: "Store Requests", href: "/inventory/requests" },
    ]
  },
  {
    title: "Returns & Exchanges",
    items: [
      { icon: RotateCcw, label: "Returns", href: "/inventory/returns" },
      { icon: ArrowLeftRight, label: "Exchanges", href: "/inventory/exchanges" },
      { icon: CreditCard, label: "Refunds", href: "/inventory/refunds" },
    ]
  },
  {
    title: "Audit & Compliance",
    items: [
      { icon: Activity, label: "Audit Reporting", href: "/inventory/audit-reporting" },
    ]
  },
  {
    title: "Quality & Reports",
    items: [
      { icon: AlertTriangle, label: "Damage Report", href: "/inventory/damage-report" },
      { icon: FileText, label: "Damage History", href: "/inventory/damage-history" },
    ]
  }
];

// Keep the original NavItems for backward compatibility
export const NavItems = NavGroups.flatMap(group => group.items);
