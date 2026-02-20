import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import type {
  Order,
  ProductWithDetails,
  StockRequestWithDetails,
} from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, Truck, DollarSign, TrendingUp, Package, Store, ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";
import { UserRole } from "./utils/enums";

export default function InventoryDashboard() {
  const { user } = useAuth();
  const isInventoryUser = !!user && (user.role === UserRole.INVENTORY || user.role === UserRole.ADMIN);

  const { data: lowStockItems, isLoading: loadingStock } = useQuery<
    ProductWithDetails[]
  >({
    queryKey: ["/api/inventory/low-stock"],
    enabled: isInventoryUser,
  });

  const { data: pendingRequests } = useQuery<StockRequestWithDetails[]>({
    queryKey: ["/api/inventory/requests?status=pending"],
    enabled: isInventoryUser,
  });

  const { data: pendingOrders } = useQuery<Order[]>({
    queryKey: ["/api/inventory/orders?status=created"],
    enabled: isInventoryUser,
  });

  const { data: storeSalesStats } = useQuery<{
    total: number;
    today: number;
    thisWeek: number;
  }>({
    queryKey: ["/api/inventory/store-sales-stats"],
    enabled: isInventoryUser,
  });

  const { data: storeExchangesStats } = useQuery<{
    total: number;
    today: number;
    thisWeek: number;
  }>({
    queryKey: ["/api/inventory/store-exchanges-stats"],
    enabled: isInventoryUser,
  });

  const { data: valuation, isLoading: loadingValuation } = useQuery<{
    summary: {
      totalValue: number;
      totalCostValue: number;
      profitPotential: number;
      profitMargin: number;
      totalStock: number;
      totalProducts: number;
      lowStockValue: number;
      lowStockCount: number;
      deadStockCount: number;
      avgValuePerProduct: number;
    };
  }>({
    queryKey: ["/api/inventory/valuation"],
    enabled: isInventoryUser,
  });


  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Inventory Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage stock, requests, and online orders
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card data-testid="stat-low-stock">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Items
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lowStockItems?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Items below threshold
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-store-sales">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Store Sales
            </CardTitle>
            <Store className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {storeSalesStats?.today || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Today ({storeSalesStats?.thisWeek || 0} this week)
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-store-exchanges">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Store Exchanges
            </CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {storeExchangesStats?.today || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Today ({storeExchangesStats?.thisWeek || 0} this week)
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-pending-requests">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingRequests?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">From stores</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-pending-orders">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orders to Ship
            </CardTitle>
            <Truck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingOrders?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Ready for dispatch</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Items */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Low Stock Items</CardTitle>
          <Link to="/inventory/products">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loadingStock ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : lowStockItems && lowStockItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Total Stock</TableHead>
                  <TableHead>Online Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems.slice(0, 5).map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            product.imageUrl ||
                            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50&h=50&fit=crop"
                          }
                          alt={product.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                        <div>
                          <p className="font-medium text-sm line-clamp-1">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.sku}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.totalStock < 5 ? "destructive" : "secondary"
                        }
                      >
                        {product.totalStock}
                      </Badge>
                    </TableCell>
                    <TableCell>{product.onlineStock}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No low stock items
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Store Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pending Store Requests</CardTitle>
          <Link to="/inventory/requests">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pendingRequests && pendingRequests.length > 0 ? (
            <div className="space-y-3">
              {pendingRequests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{request.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.store.name} • Qty: {request.quantity}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Reject
                    </Button>
                    <Button size="sm">Approve</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending requests
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
