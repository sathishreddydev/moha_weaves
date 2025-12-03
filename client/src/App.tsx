import { Routes, Route, useLocation } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

import NotFound from "@/pages/not-found";
import Home from "@/pages/user/Home";
import Sarees from "@/pages/user/Sarees";
import SareeDetail from "@/pages/user/SareeDetail";
import Categories from "@/pages/user/Categories";
import Cart from "@/pages/user/Cart";
import Wishlist from "@/pages/user/Wishlist";
import Orders from "@/pages/user/Orders";
import OrderDetail from "@/pages/user/OrderDetail";
import Returns from "@/pages/user/Returns";
import Checkout from "@/pages/user/Checkout";
import UserLogin from "@/pages/user/Login";
import UserRegister from "@/pages/user/Register";
import Addresses from "@/pages/user/Addresses";

import AdminLogin from "@/pages/admin/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminSarees from "@/pages/admin/Sarees";
import AdminCategories from "@/pages/admin/Categories";
import AdminColors from "@/pages/admin/Colors";
import AdminFabrics from "@/pages/admin/Fabrics";
import AdminUsers from "@/pages/admin/Users";
import AdminStaff from "@/pages/admin/Staff";
import AdminStores from "@/pages/admin/Stores";
import AdminOrders from "@/pages/admin/Orders";
import AdminCoupons from "@/pages/admin/Coupons";
import AdminReviews from "@/pages/admin/Reviews";
import AdminSettings from "@/pages/admin/Settings";

import InventoryLogin from "@/pages/inventory/Login";
import InventoryDashboard from "@/pages/inventory/Dashboard";
import InventorySarees from "@/pages/inventory/Sarees";
import InventoryStock from "@/pages/inventory/Stock";
import InventoryStockDistribution from "@/pages/inventory/StockDistribution";
import InventoryRequests from "@/pages/inventory/Requests";
import InventoryOrders from "@/pages/inventory/Orders";
import InventoryReturns from "@/pages/inventory/Returns";

import StoreLogin from "@/pages/store/Login";
import StoreDashboard from "@/pages/store/Dashboard";
import StoreSale from "@/pages/store/Sale";
import StoreInventoryPage from "@/pages/store/Inventory";
import StoreRequests from "@/pages/store/Requests";
import StoreHistory from "@/pages/store/History";

function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Router() {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  
  const isAuthPage = [
    "/user/login",
    "/user/register",
    "/admin/login",
    "/inventory/login",
    "/store/login",
  ].includes(location.pathname);

  const isDashboardPage = [
    "/admin/dashboard",
    "/inventory/dashboard",
    "/store/dashboard",
  ].some((path) => location.pathname.startsWith(path.replace("/dashboard", "")));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="font-serif text-3xl font-semibold text-primary">Moha</div>
        </div>
      </div>
    );
  }

  if (isAuthPage || isDashboardPage) {
    return (
      <Routes>
        {/* User auth */}
        <Route path="/user/login" element={<UserLogin />} />
        <Route path="/user/register" element={<UserRegister />} />
        
        {/* Admin module */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/sarees" element={<AdminSarees />} />
        <Route path="/admin/categories" element={<AdminCategories />} />
        <Route path="/admin/colors" element={<AdminColors />} />
        <Route path="/admin/fabrics" element={<AdminFabrics />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/staff" element={<AdminStaff />} />
        <Route path="/admin/stores" element={<AdminStores />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/coupons" element={<AdminCoupons />} />
        <Route path="/admin/reviews" element={<AdminReviews />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        
        {/* Inventory module */}
        <Route path="/inventory/login" element={<InventoryLogin />} />
        <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
        <Route path="/inventory/sarees" element={<InventorySarees />} />
        <Route path="/inventory/stock" element={<InventoryStock />} />
        <Route path="/inventory/distribution" element={<InventoryStockDistribution />} />
        <Route path="/inventory/requests" element={<InventoryRequests />} />
        <Route path="/inventory/orders" element={<InventoryOrders />} />
        <Route path="/inventory/returns" element={<InventoryReturns />} />
        
        {/* Store module */}
        <Route path="/store/login" element={<StoreLogin />} />
        <Route path="/store/dashboard" element={<StoreDashboard />} />
        <Route path="/store/sale" element={<StoreSale />} />
        <Route path="/store/inventory" element={<StoreInventoryPage />} />
        <Route path="/store/requests" element={<StoreRequests />} />
        <Route path="/store/history" element={<StoreHistory />} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <UserLayout>
      <Routes>
        {/* User public pages */}
        <Route path="/" element={<Home />} />
        <Route path="/sarees" element={<Sarees />} />
        <Route path="/sarees/:id" element={<SareeDetail />} />
        <Route path="/categories" element={<Categories />} />
        
        {/* User auth pages */}
        <Route path="/user/login" element={<UserLogin />} />
        <Route path="/user/register" element={<UserRegister />} />
        
        {/* User protected pages */}
        <Route path="/user/cart" element={<Cart />} />
        <Route path="/user/wishlist" element={<Wishlist />} />
        <Route path="/user/orders" element={<Orders />} />
        <Route path="/user/orders/:id" element={<OrderDetail />} />
        <Route path="/user/returns" element={<Returns />} />
        <Route path="/user/checkout" element={<Checkout />} />
        <Route path="/user/addresses" element={<Addresses />} />
        
        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </UserLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
