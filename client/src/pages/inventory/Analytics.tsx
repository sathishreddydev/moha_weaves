import { Globe, Store, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from "@/components/ui/charts";

interface StockMovementStats {
  totalOnlineCleared: number;
  totalStoreCleared: number;
  onlineMovements: {
    productId: string;
    productName: string;
    quantity: number;
    orderRefId: string;
    createdAt: string;
  }[];
  storeMovements: {
    productId: string;
    productName: string;
    quantity: number;
    orderRefId: string;
    storeId: string | null;
    storeName: string | null;
    createdAt: string;
  }[];
}

export default function InventoryAnalytics() {
  const { user } = useAuth();

  const isInventoryUser = !!user && (user.role === "inventory" || user.role === "admin");

  const { data: stats, isLoading } = useQuery<StockMovementStats>({
    queryKey: ["/api/inventory/stock-stats"],
    enabled: isInventoryUser,
  });

  const { data: storeSales = [] } = useQuery({
    queryKey: ["/api/inventory/store-sales"],
  });

  // Aggregate top products by quantity cleared
  const getTopProducts = (movements: any[], limit = 10) => {
    const productMap = new Map<string, { name: string; quantity: number }>();

    movements.forEach((movement) => {
      const existing = productMap.get(movement.productId);
      if (existing) {
        existing.quantity += movement.quantity;
      } else {
        productMap.set(movement.productId, {
          name: movement.productName,
          quantity: movement.quantity,
        });
      }
    });

    return Array.from(productMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  };

  // Aggregate movements by store
  const getStoreStats = (movements: any[]) => {
    const storeMap = new Map<string, { name: string; quantity: number }>();

    movements.forEach((movement) => {
      if (movement.storeName) {
        const existing = storeMap.get(movement.storeId);
        if (existing) {
          existing.quantity += movement.quantity;
        } else {
          storeMap.set(movement.storeId, {
            name: movement.storeName,
            quantity: movement.quantity,
          });
        }
      }
    });

    return Array.from(storeMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity);
  };

  const totalCleared =
    (stats?.totalOnlineCleared || 0) + (stats?.totalStoreCleared || 0);
  const onlinePercentage =
    totalCleared > 0
      ? ((stats?.totalOnlineCleared || 0) / totalCleared) * 100
      : 0;
  const storePercentage =
    totalCleared > 0
      ? ((stats?.totalStoreCleared || 0) / totalCleared) * 100
      : 0;

  const pieData = [
    { name: "Online", value: stats?.totalOnlineCleared || 0, color: "#3b82f6" },
    { name: "Store", value: stats?.totalStoreCleared || 0, color: "#22c55e" },
  ];
  const topOnlineProducts = stats
    ? getTopProducts(stats.onlineMovements, 10)
    : [];
  const topStoreProducts = stats
    ? getTopProducts(stats.storeMovements, 10)
    : [];
  const storeStats = stats ? getStoreStats(stats.storeMovements) : [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Stock Movement Analytics
        </h1>
        <p className="text-muted-foreground">
          Track inventory movements across online and store channels
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card data-testid="stat-total-cleared">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Stock Cleared
                </CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCleared}</div>
                <p className="text-xs text-muted-foreground">
                  All channels combined
                </p>
              </CardContent>
            </Card>

            <Card data-testid="stat-online-cleared">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Online Orders
                </CardTitle>
                <Globe className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalOnlineCleared || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {onlinePercentage.toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>

            <Card data-testid="stat-store-cleared">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Store Sales
                </CardTitle>
                <Store className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalStoreCleared || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {storePercentage.toFixed(1)}% of total
                </p>
              </CardContent>
            </Card>
          </div>

       

          {/* Store Performance */}
          {storeStats.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Store Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store Name</TableHead>
                      <TableHead className="text-right">Units Sold</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storeStats.map((store) => {
                      const percentage = (
                        (store.quantity / (stats?.totalStoreCleared || 1)) *
                        100
                      ).toFixed(1);
                      return (
                        <TableRow key={store.id}>
                          <TableCell className="font-medium">
                            {store.name}
                          </TableCell>
                          <TableCell className="text-right">
                            {store.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{percentage}%</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Recent Movements */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Online Orders</CardTitle>
                <Globe className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                {stats?.onlineMovements && stats.onlineMovements.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {stats.onlineMovements.slice(0, 10).map((movement, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm line-clamp-1">
                            {movement.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Order: {movement.orderRefId.slice(0, 8)}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <Badge variant="secondary">
                            Qty: {movement.quantity}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(
                              new Date(movement.createdAt),
                              "MMM dd, HH:mm"
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No online movements
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Store Sales</CardTitle>
                <Store className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                {stats?.storeMovements && stats.storeMovements.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {stats.storeMovements.slice(0, 10).map((movement, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm line-clamp-1">
                            {movement.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {movement.storeName || "Unknown Store"}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <Badge variant="secondary">
                            Qty: {movement.quantity}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(
                              new Date(movement.createdAt),
                              "MMM dd, HH:mm"
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No store movements
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
