import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Receipt, User, Phone, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default function StoreHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSale, setSelectedSale] = useState<StoreSaleWithItems | null>(
    null
  );

  const { data: sales, isLoading } = useQuery<StoreSaleWithItems[]>({
    queryKey: ["/api/store/sales"],
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
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Sales History
          </h1>
          <p className="text-muted-foreground">
            View all past in-store transactions
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : sales && sales.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedSale(sale)}
                        data-testid={`row-sale-${sale.id}`}
                      >
                        <TableCell className="font-mono text-sm">
                          #{sale.id.slice(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(sale.createdAt)}
                        </TableCell>
                        <TableCell>
                          {sale.customerName ? (
                            <div>
                              <p className="font-medium">{sale.customerName}</p>
                              {sale.customerPhone && (
                                <p className="text-xs text-muted-foreground">
                                  {sale.customerPhone}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              Walk-in Customer
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {sale.items.slice(0, 2).map((item) => (
                              <div
                                key={item.id}
                                className="w-10 h-12 rounded overflow-hidden bg-muted"
                              >
                                <img
                                  src={
                                    item.saree.imageUrl ||
                                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                                  }
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                            {sale.items.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{sale.items.length - 2}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="secondary">
                              {sale.saleType === "walk_in"
                                ? "Walk-in"
                                : "Reserved"}
                            </Badge>
                            {sale.items.some(
                              (item: any) => (item.returnedQuantity || 0) > 0
                            ) && (
                              <Badge
                                variant="outline"
                                className="text-orange-600 border-orange-600"
                              >
                                Exchanged
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-primary">
                          {formatPrice(sale.totalAmount)}
                        </TableCell>
                        <TableCell>
                          {sale.items.every(
                            (item: any) =>
                              item.quantity === (item.returnedQuantity || 0)
                          ) ? (
                            <Badge variant="secondary" className="text-xs">
                              Fully Returned
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/store/exchange/${sale.id}`);
                              }}
                            >
                              <ArrowLeftRight className="h-4 w-4 mr-1" />
                              Exchange
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No sales history yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Sale Details
            </DialogTitle>
            <DialogDescription>
              #{selectedSale?.id.slice(0, 8).toUpperCase()} -{" "}
              {selectedSale && formatDate(selectedSale.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              {(selectedSale.customerName || selectedSale.customerPhone) && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  {selectedSale.customerName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {selectedSale.customerName}
                    </div>
                  )}
                  {selectedSale.customerPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedSale.customerPhone}
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="font-medium text-sm mb-2">Items Sold</p>
                <div className="space-y-2">
                  {selectedSale.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 border rounded-lg"
                    >
                      <img
                        src={
                          item.saree.imageUrl ||
                          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=60"
                        }
                        alt=""
                        className="w-12 h-16 rounded object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-1">
                          {item.saree.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} x {formatPrice(item.price)}
                        </p>
                        {(item.returnedQuantity || 0) > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs mt-1 text-orange-600 border-orange-600"
                          >
                            {item.returnedQuantity} returned
                          </Badge>
                        )}
                      </div>
                      <span className="font-medium">
                        {formatPrice(parseFloat(item.price) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="font-bold">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(selectedSale.totalAmount)}
                </span>
              </div>

              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => navigate(`/store/exchange/${selectedSale.id}`)}
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Process Exchange
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
