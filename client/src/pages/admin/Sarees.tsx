import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import type { SareeWithDetails } from "@shared/schema";

export default function AdminSarees() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingSaree, setViewingSaree] = useState<SareeWithDetails | null>(
    null
  );

  const { data: sarees, isLoading } = useQuery<SareeWithDetails[]>({
    queryKey: ["/api/admin/sarees"],
  });

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const filteredSarees = sarees?.filter(
    (saree) =>
      saree.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      saree.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Saree Stock Overview
            </h1>
            <p className="text-muted-foreground">
              View saree inventory details (read-only)
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            To add/edit sarees, use the Inventory module
          </Badge>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sarees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Total Stock</TableHead>
                      <TableHead>Online Stock</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSarees?.map((saree) => (
                      <TableRow
                        key={saree.id}
                        data-testid={`row-saree-${saree.id}`}
                      >
                        <TableCell>
                          <div className="w-12 h-16 rounded overflow-hidden bg-muted">
                            <img
                              src={
                                saree.imageUrl ||
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100"
                              }
                              alt={saree.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {saree.name}
                          {saree.isFeatured && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Featured
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {saree.sku || "-"}
                        </TableCell>
                        <TableCell>{saree.category?.name || "-"}</TableCell>
                        <TableCell>{formatPrice(saree.price)}</TableCell>
                        <TableCell>
                          <span
                            className={
                              saree.totalStock < 10
                                ? "text-destructive font-medium"
                                : ""
                            }
                          >
                            {saree.totalStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {saree.onlineStock}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {saree.distributionChannel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={saree.isActive ? "default" : "secondary"}
                          >
                            {saree.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingSaree(saree)}
                              data-testid={`button-view-${saree.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!viewingSaree}
        onOpenChange={(open) => !open && setViewingSaree(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saree Details</DialogTitle>
          </DialogHeader>
          {viewingSaree && (
            <div className="space-y-4">
              <div className="flex gap-6">
                <div className="w-32 h-40 rounded overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={
                      viewingSaree.imageUrl ||
                      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200"
                    }
                    alt={viewingSaree.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-semibold">{viewingSaree.name}</h3>
                  <p className="text-2xl font-bold text-primary">
                    {formatPrice(viewingSaree.price)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {viewingSaree.sku || "No SKU"}
                    </Badge>
                    <Badge
                      variant={viewingSaree.isActive ? "default" : "secondary"}
                    >
                      {viewingSaree.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {viewingSaree.isFeatured && (
                      <Badge variant="secondary">Featured</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {viewingSaree.distributionChannel}
                    </Badge>
                  </div>
                </div>
              </div>

              {viewingSaree.description && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">
                    Description
                  </h4>
                  <p className="text-sm">{viewingSaree.description}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">
                    {viewingSaree.totalStock}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Stock</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {viewingSaree.onlineStock}
                  </p>
                  <p className="text-xs text-muted-foreground">Online Stock</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {viewingSaree.totalStock - viewingSaree.onlineStock}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Store/Warehouse
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <span className="ml-2 font-medium">
                    {viewingSaree.category?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Color:</span>
                  <span className="ml-2 font-medium flex items-center gap-1">
                    {viewingSaree.color?.hexCode && (
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: viewingSaree.color.hexCode }}
                      />
                    )}
                    {viewingSaree.color?.name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fabric:</span>
                  <span className="ml-2 font-medium">
                    {viewingSaree.fabric?.name || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
