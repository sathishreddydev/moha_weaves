import {
  Building2,
  LayoutDashboard,
  Package,
  Palette,
  Settings,
  Shirt,
  Star,
  Tags,
  Ticket,
  UserCog,
  Users,
  Zap
} from "lucide-react";

export const AdminNavGroups = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    ]
  },
  {
    title: "Product Management",
    items: [
      { icon: Package, label: "Products", href: "/admin/products" },
      { icon: Tags, label: "Categories", href: "/admin/categories" },
      { icon: Palette, label: "Colors", href: "/admin/colors" },
      { icon: Shirt, label: "Fabrics", href: "/admin/fabrics" },
    ]
  },
  {
    title: "User Management",
    items: [
      { icon: Users, label: "Users", href: "/admin/users" },
      { icon: UserCog, label: "Staff", href: "/admin/staff" },
      { icon: Building2, label: "Stores", href: "/admin/stores" },
    ]
  },
  {
    title: "Marketing",
    items: [
      { icon: Zap, label: "Sales & Offers", href: "/admin/sales" },
      { icon: Ticket, label: "Coupons", href: "/admin/coupons" },
      { icon: Star, label: "Reviews", href: "/admin/reviews" },
    ]
  },
  {
    title: "System",
    items: [
      { icon: Settings, label: "Settings", href: "/admin/settings" },
    ]
  }
];

// Keep the original AdminNavItems for backward compatibility
export const AdminNavItems = AdminNavGroups.flatMap(group => group.items);