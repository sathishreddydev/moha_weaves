import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import InventoryLayout from "./pages/inventory/Layout";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/user/Home"));
const Sarees = lazy(() => import("@/pages/user/Sarees"));
const SareeDetail = lazy(() => import("@/pages/user/SareeDetail"));
const Categories = lazy(() => import("@/pages/user/Categories"));
const Cart = lazy(() => import("@/pages/user/Cart"));
const Wishlist = lazy(() => import("@/pages/user/Wishlist"));
const Orders = lazy(() => import("@/pages/user/Orders"));
const OrderDetail = lazy(() => import("@/pages/user/OrderDetail"));
const Returns = lazy(() => import("@/pages/user/Returns"));
const Checkout = lazy(() => import("@/pages/user/Checkout"));
const UserLogin = lazy(() => import("@/pages/user/Login"));
const UserRegister = lazy(() => import("@/pages/user/Register"));
const Addresses = lazy(() => import("@/pages/user/Addresses"));

const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminSarees = lazy(() => import("@/pages/admin/Sarees"));
const AdminCategories = lazy(() => import("@/pages/admin/Categories"));
const AdminColors = lazy(() => import("@/pages/admin/Colors"));
const AdminFabrics = lazy(() => import("@/pages/admin/Fabrics"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminStaff = lazy(() => import("@/pages/admin/Staff"));
const AdminStores = lazy(() => import("@/pages/admin/Stores"));
const AdminOrders = lazy(() => import("@/pages/admin/Orders"));
const AdminCoupons = lazy(() => import("@/pages/admin/Coupons"));
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));

const InventoryLogin = lazy(() => import("@/pages/inventory/Login"));
const InventoryDashboard = lazy(() => import("@/pages/inventory/Dashboard"));
const InventorySarees = lazy(() => import("@/pages/inventory/Sarees"));
const InventoryStock = lazy(() => import("@/pages/inventory/Stock"));
const InventoryStockDistribution = lazy(
  () => import("@/pages/inventory/StockDistribution")
);
const InventoryAnalytics = lazy(() => import("@/pages/inventory/Analytics"));
const InventoryRequests = lazy(() => import("@/pages/inventory/Requests"));
const InventoryOrders = lazy(() => import("@/pages/inventory/Orders"));
const InventoryReturns = lazy(() => import("@/pages/inventory/Returns"));
const InventoryStoreOrders = lazy(
  () => import("@/pages/inventory/StoreOrders")
); // Added new page

const StoreLogin = lazy(() => import("@/pages/store/Login"));
const StoreDashboard = lazy(() => import("@/pages/store/Dashboard"));
const StoreSale = lazy(() => import("@/pages/store/Sale"));
const StoreInventoryPage = lazy(() => import("@/pages/store/Inventory"));
const StoreRequests = lazy(() => import("@/pages/store/Requests"));
const StoreHistory = lazy(() => import("@/pages/store/History"));
const StoreExchange = lazy(() => import("@/pages/store/Exchange"));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse">
        <div className="font-serif text-3xl font-semibold text-primary">
          Moha
        </div>
      </div>
    </div>
  );
}

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
  ].some((path) =>
    location.pathname.startsWith(path.replace("/dashboard", ""))
  );

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (isAuthPage || isDashboardPage) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/user/login" element={<UserLogin />} />
          <Route path="/user/register" element={<UserRegister />} />

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

          <Route path="/inventory/login" element={<InventoryLogin />} />

          <Route path="inventory" element={<InventoryLayout />}>
            <Route
              path="dashboard"
              element={<InventoryDashboard />}
            />
            <Route path="sarees" element={<InventorySarees />} />
            <Route path="stock" element={<InventoryStock />} />
            <Route
              path="distribution"
              element={<InventoryStockDistribution />}
            />
            <Route
              path="analytics"
              element={<InventoryAnalytics />}
            />
            <Route path="requests" element={<InventoryRequests />} />
            <Route path="orders" element={<InventoryOrders />} />
            <Route
              path="store-orders"
              element={<InventoryStoreOrders />}
            />
            <Route path="returns" element={<InventoryReturns />} />
          </Route>

          <Route path="/store/login" element={<StoreLogin />} />
          <Route path="/store/dashboard" element={<StoreDashboard />} />
          <Route path="/store/sale" element={<StoreSale />} />
          <Route path="/store/inventory" element={<StoreInventoryPage />} />
          <Route path="/store/requests" element={<StoreRequests />} />
          <Route path="/store/history" element={<StoreHistory />} />
          <Route path="/store/exchange" element={<StoreExchange />} />
          <Route path="/store/exchange/:saleId" element={<StoreExchange />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <UserLayout>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sarees" element={<Sarees />} />
          <Route path="/sarees/:id" element={<SareeDetail />} />
          <Route path="/categories" element={<Categories />} />

          <Route path="/user/login" element={<UserLogin />} />
          <Route path="/user/register" element={<UserRegister />} />

          <Route path="/user/cart" element={<Cart />} />
          <Route path="/user/wishlist" element={<Wishlist />} />
          <Route path="/user/orders" element={<Orders />} />
          <Route path="/user/orders/:id" element={<OrderDetail />} />
          <Route path="/user/returns" element={<Returns />} />
          <Route path="/user/checkout" element={<Checkout />} />
          <Route path="/user/addresses" element={<Addresses />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
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
