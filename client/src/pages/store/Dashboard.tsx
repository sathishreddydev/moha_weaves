import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Plus,
  Search,
  PackageSearch,
  ClipboardList,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails, StoreSaleWithItems } from "@shared/schema";

interface StoreStats {
  todaySales: number;
  todayRevenue: number;
  totalInventory: number;
  pendingRequests: number;
}

type ShopProduct = {
  saree: SareeWithDetails;
  storeStock: number;
};

export default function StoreDashboard() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading: loadingStats } = useQuery<StoreStats>({
    queryKey: ["/api/store/stats"],
    enabled: !!user && user.role === "store",
  });

  const { data: products, isLoading: loadingProducts } = useQuery<
    ShopProduct[]
  >({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store",
  });

  const { data: recentSales } = useQuery<StoreSaleWithItems[]>({
    queryKey: ["/api/store/sales?limit=5"],
    enabled: !!user && user.role === "store",
  });

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const filteredProducts = products?.filter(
    (item) =>
      item.saree.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.saree.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Store Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your store sales and inventory
          </p>
        </div>
        <Link to="/store/sale">
          <Button data-testid="button-new-sale">
            <Plus className="h-4 w-4 mr-2" />
            New Sale
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      {loadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-today-sales">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Sales
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.todaySales || 0}</div>
              <p className="text-xs text-muted-foreground">transactions</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-today-revenue">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPrice(stats?.todayRevenue || 0)}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-inventory">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Store Inventory
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalInventory || 0}
              </div>
              <p className="text-xs text-muted-foreground">items in stock</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Requests
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.pendingRequests || 0}
              </div>
              <p className="text-xs text-muted-foreground">awaiting approval</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Inventory Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5" />
              Quick Inventory Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-inventory"
              />
            </div>

            {loadingProducts ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredProducts.slice(0, 10).map((item) => (
                  <div
                    key={item.saree.id}
                    className="flex items-center justify-between p-2 rounded-lg border hover-elevate"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          item.saree.imageUrl ||
                          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=40&h=40&fit=crop"
                        }
                        alt=""
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium line-clamp-1">
                          {item.saree.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.saree.price)}
                        </p>
                      </div>
                    </div>
                    {item.storeStock > 0 ? (
                      <Badge
                        variant={item.storeStock < 5 ? "secondary" : "default"}
                      >
                        {item.storeStock} in stock
                      </Badge>
                    ) : (
                      <Badge variant="destructive">No stock</Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {searchQuery
                  ? "No matching items found"
                  : "No products available"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Recent Sales
            </CardTitle>
            <Link to="/store/history">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentSales && recentSales.length > 0 ? (
              <div className="space-y-3">
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {sale.customerName || "Walk-in Customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.items.length} items •{" "}
                        {new Date(sale.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        {formatPrice(sale.totalAmount)}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {sale.saleType === "walk_in" ? "Walk-in" : "Reserved"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sales today
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
