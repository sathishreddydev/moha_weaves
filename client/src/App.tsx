import React from "react";
import { lazy, Suspense } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { Routes, Route, Navigate } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import InventoryLayout from "./pages/inventory/Layout";
import StoreLayout from "./pages/store/Layout";
import AdminLayout from "./pages/admin/Layout";
import ProtectedRoute from "./ProtectedRoute";
import Unauthorized from "./Unauthorized";

const NotFound = lazy(() => import("@/pages/not-found"));
const Portal = lazy(() => import("@/pages/Portal"));

const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("@/pages/admin/Products"));
const AdminProductDetail = lazy(() => import("@/pages/admin/ProductDetail"));
const AdminCategories = lazy(() => import("@/pages/admin/Categories"));
const AdminColors = lazy(() => import("@/pages/admin/Colors"));
const AdminFabrics = lazy(() => import("@/pages/admin/Fabrics"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminStaff = lazy(() => import("@/pages/admin/Staff"));
const AdminStores = lazy(() => import("@/pages/admin/Stores"));
const AdminCoupons = lazy(() => import("@/pages/admin/Coupons"));
const AdminSales = lazy(() => import("@/pages/admin/Sales"));
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminAuditReporting = lazy(() => import("@/pages/admin/AuditReporting"));

const InventoryLogin = lazy(() => import("@/pages/inventory/Login"));
const InventoryDashboard = lazy(() => import("@/pages/inventory/Dashboard"));
const InventoryProducts = lazy(() => import("@/pages/inventory/Products"));
const InventoryAddProduct = lazy(
  () => import("@/pages/inventory/components/AddProduct"),
);
const InventoryEditProduct = lazy(
  () => import("@/pages/inventory/components/EditProduct"),
);
const InventoryStockDistribution = lazy(
  () => import("@/pages/inventory/StockDistribution"),
);
const InventoryAnalytics = lazy(() => import("@/pages/inventory/Analytics"));
const InventoryRequests = lazy(() => import("@/pages/inventory/Requests"));
const InventoryOrders = lazy(() => import("@/pages/inventory/Orders"));
const InventoryOrderDetail = lazy(
  () => import("@/pages/inventory/OrderDetail"),
);
const InventoryReturns = lazy(() => import("@/pages/inventory/Returns"));
const InventoryExchanges = lazy(() => import("@/pages/inventory/Exchanges"));
const InventoryRefunds = lazy(() => import("@/pages/inventory/Refunds"));
const InventoryStoreOrders = lazy(
  () => import("@/pages/inventory/StoreOrders"),
);
const InventoryStoreExchanges = lazy(
  () => import("@/pages/inventory/StoreExchanges"),
);
const DamageReport = lazy(() => import("@/pages/inventory/DamageReport"));
const DamageHistory = lazy(() => import("@/pages/inventory/DamageHistory"));
const InventoryStockMovements = lazy(
  () => import("@/pages/inventory/StockMovements"),
);
const InventoryStockReconciliation = lazy(
  () => import("@/pages/inventory/StockReconciliation"),
);
const InventoryBatchStockOperations = lazy(
  () => import("@/pages/inventory/BatchStockOperations"),
);

const StoreLogin = lazy(() => import("@/pages/store/Login"));
const StoreDashboard = lazy(() => import("@/pages/store/Dashboard"));
const StoreSale = lazy(() => import("@/pages/store/Sale"));
const StoreCart = lazy(() => import("@/pages/store/Cart"));
const StoreInventoryPage = lazy(() => import("@/pages/store/Inventory"));
const StoreRequests = lazy(() => import("@/pages/store/Requests"));
const StoreHistory = lazy(() => import("@/pages/store/History"));
const StoreExchange = lazy(() => import("@/pages/store/Exchange"));
const StoreExchangeHistory = lazy(
  () => import("@/pages/store/ExchangeHistory"),
);
const StoreInvoice = lazy(() => import("@/pages/store/Invoice"));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse">
        <div className="font-serif text-3xl font-semibold text-primary">
          {BRAND_NAME}
        </div>
      </div>
    </div>
  );
}

function Router() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="unauthorized" element={<Unauthorized />} />

        {/* Portal landing page */}
        <Route path="/" element={<Portal />} />

        <Route path="admin">
          <Route path="login" element={<AdminLogin />} />
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["admin"]}
                loginPath="/admin/login"
              />
            }
          >
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="products/:id" element={<AdminProductDetail />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="colors" element={<AdminColors />} />
              <Route path="fabrics" element={<AdminFabrics />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="staff" element={<AdminStaff />} />
              <Route path="stores" element={<AdminStores />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="sales" element={<AdminSales />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="audit-reporting" element={<AdminAuditReporting />} />
            </Route>
          </Route>
        </Route>

        <Route path="inventory">
          <Route path="login" element={<InventoryLogin />} />
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["inventory", "admin"]}
                loginPath="/inventory/login"
              />
            }
          >
            <Route element={<InventoryLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<InventoryDashboard />} />
              <Route path="products" element={<InventoryProducts />} />
              <Route
                path="products/addProduct"
                element={<InventoryAddProduct />}
              />
              <Route
                path="products/editProduct/:sku"
                element={<InventoryEditProduct />}
              />
              <Route
                path="distribution"
                element={<InventoryStockDistribution />}
              />
              <Route path="analytics" element={<InventoryAnalytics />} />
              <Route path="requests" element={<InventoryRequests />} />
              <Route path="orders" element={<InventoryOrders />} />
              <Route path="orders/:id" element={<InventoryOrderDetail />} />
              <Route path="store-orders" element={<InventoryStoreOrders />} />
              <Route
                path="store-exchanges"
                element={<InventoryStoreExchanges />}
              />
              <Route path="returns" element={<InventoryReturns />} />
              <Route path="exchanges" element={<InventoryExchanges />} />
              <Route path="refunds" element={<InventoryRefunds />} />
              <Route path="damage-report" element={<DamageReport />} />
              <Route path="damage-report/:sku" element={<DamageReport />} />
              <Route path="damage-history" element={<DamageHistory />} />
              <Route
                path="stock-movements"
                element={<InventoryStockMovements />}
              />
              <Route
                path="stock-reconciliation"
                element={<InventoryStockReconciliation />}
              />
              <Route
                path="batch-stock-operations"
                element={<InventoryBatchStockOperations />}
              />
            </Route>
          </Route>
        </Route>

        <Route path="store">
          <Route path="login" element={<StoreLogin />} />
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["store"]}
                loginPath="/store/login"
              />
            }
          >
            <Route element={<StoreLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StoreDashboard />} />
              <Route path="sale" element={<StoreSale />} />
              <Route path="cart" element={<StoreCart />} />
              <Route path="inventory" element={<StoreInventoryPage />} />
              <Route path="requests" element={<StoreRequests />} />
              <Route path="history" element={<StoreHistory />} />
              <Route path="exchange" element={<StoreExchange />} />
              <Route path="exchange/:saleId" element={<StoreExchange />} />
              <Route path="exchanges" element={<StoreExchangeHistory />} />
              <Route path="invoice/:saleId" element={<StoreInvoice />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
