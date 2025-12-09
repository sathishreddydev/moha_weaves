
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Percent, DollarSign, Tag, Zap, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SaleWithDetails, Category, SareeWithDetails } from "@shared/schema";

interface SaleFormData {
  name: string;
  description: string;
  offerType: "percentage" | "flat" | "category" | "product" | "flash_sale";
  discountValue: string;
  categoryId: string;
  minOrderAmount: string;
  maxDiscount: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isFeatured: boolean;
  bannerImage: string;
  productIds: string[];
}

export default function AdminSales() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleWithDetails | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SaleFormData>({
    name: "",
    description: "",
    offerType: "percentage",
    discountValue: "",
    categoryId: "",
    minOrderAmount: "",
    maxDiscount: "",
    startDate: "",
    endDate: "",
    isActive: true,
    isFeatured: false,
    bannerImage: "",
    productIds: [],
  });

  const { data: sales, isLoading } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/admin/sales"],
    enabled: !!user && user.role === "admin",
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: sarees } = useQuery<SareeWithDetails[]>({
    queryKey: ["/api/admin/sarees"],
    enabled: formData.offerType === "product",
  });

  const createMutation = useMutation({
    mutationFn: async (data: SaleFormData) => {
      const response = await apiRequest("POST", "/api/admin/sales", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales"] });
      toast({ title: "Success", description: "Sale created successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sale",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SaleFormData }) => {
      const response = await apiRequest("PATCH", `/api/admin/sales/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales"] });
      toast({ title: "Success", description: "Sale updated successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update sale",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/sales/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales"] });
      toast({ title: "Success", description: "Sale deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingSaleId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete sale",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingSale(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    setFormData({
      name: "",
      description: "",
      offerType: "percentage",
      discountValue: "",
      categoryId: "",
      minOrderAmount: "",
      maxDiscount: "",
      startDate: tomorrow.toISOString().split("T")[0],
      endDate: nextWeek.toISOString().split("T")[0],
      isActive: true,
      isFeatured: false,
      bannerImage: "",
      productIds: [],
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (sale: SaleWithDetails) => {
    setEditingSale(sale);
    setFormData({
      name: sale.name,
      description: sale.description || "",
      offerType: sale.offerType as any,
      discountValue: sale.discountValue,
      categoryId: sale.categoryId || "",
      minOrderAmount: sale.minOrderAmount || "",
      maxDiscount: sale.maxDiscount || "",
      startDate: new Date(sale.startDate).toISOString().split("T")[0],
      endDate: new Date(sale.endDate).toISOString().split("T")[0],
      isActive: sale.isActive,
      isFeatured: sale.isFeatured,
      bannerImage: sale.bannerImage || "",
      productIds: sale.products?.map(p => p.sareeId) || [],
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSale(null);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.discountValue || !formData.startDate || !formData.endDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.offerType === "category" && !formData.categoryId) {
      toast({
        title: "Error",
        description: "Please select a category for category-level offer",
        variant: "destructive",
      });
      return;
    }

    if (formData.offerType === "product" && formData.productIds.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive",
      });
      return;
    }

    if (editingSale) {
      updateMutation.mutate({ id: editingSale.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenDelete = (id: string) => {
    setDeletingSaleId(id);
    setDeleteDialogOpen(true);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getOfferIcon = (type: string) => {
    switch (type) {
      case "percentage": return <Percent className="h-3 w-3" />;
      case "flat": return <DollarSign className="h-3 w-3" />;
      case "category": return <Tag className="h-3 w-3" />;
      case "flash_sale": return <Zap className="h-3 w-3" />;
      default: return <Tag className="h-3 w-3" />;
    }
  };

  const isActive = (sale: SaleWithDetails) => {
    if (!sale.isActive) return false;
    const now = new Date();
    return now >= new Date(sale.startDate) && now <= new Date(sale.endDate);
  };

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Sales & Offers
            </h1>
            <p className="text-muted-foreground">
              Manage discount offers and flash sales
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-sale">
            <Plus className="h-4 w-4 mr-2" />
            Add Sale
          </Button>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sale.name}</p>
                          {sale.isFeatured && (
                            <Badge variant="secondary" className="text-xs mt-1">Featured</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {getOfferIcon(sale.offerType)}
                          <span className="ml-1">{sale.offerType.replace("_", " ")}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {sale.offerType === "percentage" || sale.offerType === "category"
                          ? `${sale.discountValue}%`
                          : `₹${sale.discountValue}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(sale.startDate)}</span>
                          <span>-</span>
                          <span>{formatDate(sale.endDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sale.offerType === "category" ? (
                          <span className="text-sm">{sale.category?.name || "-"}</span>
                        ) : sale.offerType === "product" ? (
                          <span className="text-sm">{sale.productCount} products</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive(sale) ? "default" : "secondary"}>
                          {isActive(sale) ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(sale)}
                            data-testid={`button-edit-${sale.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenDelete(sale.id)}
                            data-testid={`button-delete-${sale.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No sales found. Create your first sale offer.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSale ? "Edit Sale" : "Add Sale"}</DialogTitle>
            <DialogDescription>
              {editingSale ? "Update sale details" : "Create a new sale offer"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Sale Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Summer Sale 2024"
                data-testid="input-name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Sale description"
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="offerType">Offer Type *</Label>
                <Select
                  value={formData.offerType}
                  onValueChange={(value: any) => setFormData({ ...formData, offerType: value })}
                >
                  <SelectTrigger data-testid="select-offer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Discount</SelectItem>
                    <SelectItem value="flat">Flat Discount</SelectItem>
                    <SelectItem value="category">Category Offer</SelectItem>
                    <SelectItem value="product">Product Offer</SelectItem>
                    <SelectItem value="flash_sale">Flash Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="discountValue">
                  Discount Value * {formData.offerType === "percentage" || formData.offerType === "category" ? "(%)" : "(₹)"}
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  placeholder={formData.offerType === "percentage" ? "20" : "500"}
                  data-testid="input-discount-value"
                />
              </div>
            </div>

            {formData.offerType === "category" && (
              <div>
                <Label htmlFor="categoryId">Category *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.offerType === "product" && (
              <div>
                <Label>Select Products *</Label>
                <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                  {sarees?.map((saree) => (
                    <label key={saree.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.productIds.includes(saree.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              productIds: [...formData.productIds, saree.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              productIds: formData.productIds.filter((id) => id !== saree.id),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{saree.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.productIds.length} product(s) selected
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minOrderAmount">Min Order Amount (₹)</Label>
                <Input
                  id="minOrderAmount"
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                  placeholder="Optional"
                  data-testid="input-min-order"
                />
              </div>
              <div>
                <Label htmlFor="maxDiscount">Max Discount (₹)</Label>
                <Input
                  id="maxDiscount"
                  type="number"
                  value={formData.maxDiscount}
                  onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                  placeholder="Optional"
                  data-testid="input-max-discount"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="bannerImage">Banner Image URL</Label>
              <Input
                id="bannerImage"
                value={formData.bannerImage}
                onChange={(e) => setFormData({ ...formData, bannerImage: e.target.value })}
                placeholder="https://..."
                data-testid="input-banner-image"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-active"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isFeatured">Featured</Label>
              <Switch
                id="isFeatured"
                checked={formData.isFeatured}
                onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                data-testid="switch-featured"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {editingSale ? "Save Changes" : "Create Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sale</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this sale? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingSaleId && deleteMutation.mutate(deletingSaleId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
