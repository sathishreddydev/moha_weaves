import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  Search,
  Globe,
  Store,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails } from "@shared/schema";

type ShopProduct = {
  saree: SareeWithDetails;
  storeStock: number;
};

export default function StoreInventoryPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "in-stock" | "out-of-stock"
  >("all");

  const { data: products, isLoading } = useQuery<ShopProduct[]>({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store",
  });

  const handleLogout = async () => {
    await logout();
    navigate("/store/login");
  };

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const filteredProducts = products?.filter((item) => {
    const matchesSearch =
      item.saree.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.saree.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    if (stockFilter === "in-stock") {
      return matchesSearch && item.storeStock > 0;
    } else if (stockFilter === "out-of-stock") {
      return matchesSearch && item.storeStock === 0;
    }
    return matchesSearch;
  });

  const inStockCount = products?.filter((p) => p.storeStock > 0).length || 0;
  const outOfStockCount =
    products?.filter((p) => p.storeStock === 0).length || 0;

  const getDistributionBadge = (channel: string) => {
    switch (channel) {
      case "shop":
        return (
          <Badge variant="outline" className="gap-1">
            <Store className="h-3 w-3" />
            Shop Only
          </Badge>
        );
      case "online":
        return (
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" />
            Online
          </Badge>
        );
      case "both":
        return (
          <Badge variant="outline" className="gap-1">
            <ArrowLeftRight className="h-3 w-3" />
            Both
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Shop Products
          </h1>
          <p className="text-muted-foreground">
            All products available for your store
          </p>
        </div>
        <Link to="/store/requests">
          <Button data-testid="button-request-stock">
            <Package className="h-4 w-4 mr-2" />
            Request Stock
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{products?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {inStockCount}
            </div>
            <p className="text-sm text-muted-foreground">In Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">
              {outOfStockCount}
            </div>
            <p className="text-sm text-muted-foreground">Need to Request</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Select
              value={stockFilter}
              onValueChange={(value) =>
                setStockFilter(value as typeof stockFilter)
              }
            >
              <SelectTrigger className="w-40" data-testid="select-stock-filter">
                <SelectValue placeholder="Filter by stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="out-of-stock">Need Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Your Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((item) => (
                    <TableRow
                      key={item.saree.id}
                      data-testid={`row-product-${item.saree.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              item.saree.imageUrl ||
                              "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                            }
                            alt=""
                            className="w-10 h-12 rounded object-cover"
                          />
                          <span className="font-medium max-w-[200px] truncate">
                            {item.saree.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {item.saree.sku || "-"}
                      </TableCell>
                      <TableCell>{item.saree.category?.name || "-"}</TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(item.saree.price)}
                      </TableCell>
                      <TableCell>
                        {getDistributionBadge(item.saree.distributionChannel)}
                      </TableCell>
                      <TableCell>
                        {item.storeStock > 0 ? (
                          <Badge
                            variant={
                              item.storeStock < 5 ? "secondary" : "default"
                            }
                            className={
                              item.storeStock < 5
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                                : ""
                            }
                          >
                            {item.storeStock} in stock
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">No stock</Badge>
                            <Link to="/store/requests">
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-request-${item.saree.id}`}
                              >
                                Request
                              </Button>
                            </Link>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? "No matching products found"
                : "No products available for shop"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
