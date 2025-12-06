import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut,
  Menu,
  LayoutDashboard,
  ClipboardList,
  Truck,
  BarChart3,
  Warehouse,
  Shirt,
  RotateCcw,
  Store,
  TrendingUp,
  ShoppingBag,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { StoreSaleWithItems } from "@shared/schema";
import { Badge } from "@/components/ui/badge";



export default function InventoryStoreOrders() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<StoreSaleWithItems | null>(
    null
  );

  const { data: storeSales, isLoading } = useQuery<StoreSaleWithItems[]>({
    queryKey: ["/api/inventory/store-sales"],
    enabled: !!user && user.role === "inventory",
  });

  const handleLogout = async () => {
    await logout();
    navigate("/inventory/login");
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };





  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Store Orders
            </h1>
            <p className="text-muted-foreground">
              View all store sales and transactions
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : storeSales && storeSales.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale ID</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storeSales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        data-testid={`row-sale-${sale.id}`}
                        className="cursor-pointer"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <TableCell className="font-mono text-sm">
                          #{sale.id.slice(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {sale.store.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(sale.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {(sale.items || []).slice(0, 2).map((item) => (
                              <div
                                key={item.id}
                                className="w-10 h-12 rounded overflow-hidden bg-muted"
                              >
                                <img
                                  src={
                                    item.saree?.imageUrl ||
                                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                                  }
                                  alt={item.saree?.name || "Saree"}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                            {(sale.items?.length || 0) > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{(sale.items?.length || 0) - 2}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">
                              {sale.customerName || "Walk-in"}
                            </p>
                            {sale.customerPhone && (
                              <p className="text-xs text-muted-foreground">
                                {sale.customerPhone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(sale.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="capitalize text-sm">
                              {sale.saleType.replace("_", " ")}
                            </span>
                            {sale.items.some((item: any) => (item.returnedQuantity || 0) > 0) && (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-600 block w-fit">
                                Exchanged
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No store sales found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Store Sale Details</DialogTitle>
            <DialogDescription>
              Sale #{selectedSale?.id.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <Store className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Store</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSale.store.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSale.store.address}
                  </p>
                </div>
              </div>

              {selectedSale.customerName && (
                <div className="flex items-start gap-2">
                  <ShoppingBag className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Customer</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedSale.customerName}
                    </p>
                    {selectedSale.customerPhone && (
                      <p className="text-xs text-muted-foreground">
                        Phone: {selectedSale.customerPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="font-medium text-sm mb-2">Items</p>
                <div className="space-y-2">
                  {(selectedSale.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 border rounded"
                    >
                      <img
                        src={
                          item.saree?.imageUrl ||
                          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                        }
                        alt={item.saree?.name || "Saree"}
                        className="w-12 h-16 rounded object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-1">
                          {item.saree?.name || "Unknown Saree"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} x {formatPrice(item.price)}
                        </p>
                        {(item.returnedQuantity || 0) > 0 && (
                          <p className="text-xs text-orange-600">
                            Exchanged: {item.returnedQuantity}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="font-bold">
                  {formatPrice(selectedSale.totalAmount)}
                </span>
              </div>

              <div className="text-sm">
                <p className="font-medium">Sale Type</p>
                <p className="text-muted-foreground capitalize">
                  {selectedSale.saleType.replace("_", " ")}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}