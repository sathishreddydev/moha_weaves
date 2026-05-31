
import { useFilterStore } from "@/components/Store/useFilterStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { SaleWithDetails } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, DollarSign, Edit, Percent, Plus, Tag, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDate, formatPrice } from "@/lib/utils";

interface SaleFormData {
  name: string;
  description: string;
  offerType: "percentage" | "flat" | "product" | "flash_sale";
  discountValue: string;
  targetType: "all" | "category" | "products";
  categoryId?: string;
  subcategoryId?: string;
  productIds: string[];
  minOrderAmount: string;
  maxDiscount: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isFeatured: boolean;
  bannerImage: string;
  bgColor: string;
}

export default function AdminSales() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleWithDetails | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [formData, setFormData] = useState<SaleFormData>({
    name: "",
    description: "",
    offerType: "percentage",
    discountValue: "",
    targetType: "all",
    categoryId: "",
    subcategoryId: "all",
    productIds: [],
    minOrderAmount: "",
    maxDiscount: "",
    startDate: "",
    endDate: "",
    isActive: true,
    isFeatured: false,
    bannerImage: "",
    bgColor: "",
  });
  const [conflictWarning, setConflictWarning] = useState<string>("");

  const { data: sales, isLoading } = useQuery<SaleWithDetails[]>({
    queryKey: ["/api/admin/sales"],
    enabled: !!user && user.role === "admin",
  });

  const { data: productsData, } = useQuery({
    queryKey: ["/api/admin/getProducts"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/admin/getProducts", {});
      return response;
    },
    enabled: !!user && user.role === "admin",
  });

  const products = productsData?.data || [];

  const categories = useFilterStore((state) => state.categories);
  const fetchFilters = useFilterStore((state) => state.fetchFilters);

  useEffect(() => {
    if (categories.length === 0) {
      fetchFilters();
    }
  }, [categories.length, fetchFilters]);


  const createMutation = useMutation({
    mutationFn: async (data: SaleFormData) => {
      const response = await apiRequest("POST", "/api/admin/sales", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales"] });
      toast({ title: "Success", description: "Sale created successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      if (error.conflicts) {
        // Show conflict details
        const conflictList = error.conflicts.map((sale: any) => 
          `• "${sale.name}" (${sale.offerType} on ${sale.targetType})`
        ).join('\n');
        
        toast({
          title: "Sale Conflict Detected",
          description: `Cannot create sale. Conflicts found:\n${conflictList}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create sale",
          variant: "destructive",
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SaleFormData }) => {
      const response = await apiRequest("PATCH", `/api/admin/sales/${id}`, data);
      return response;
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
      targetType: "all",
      categoryId: "",
      subcategoryId: "all",
      productIds: [],
      minOrderAmount: "",
      maxDiscount: "",
      startDate: tomorrow.toISOString().split("T")[0],
      endDate: nextWeek.toISOString().split("T")[0],
      isActive: true,
      isFeatured: false,
      bannerImage: "",
      bgColor: "",
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
      targetType: sale.categoryId ? "category" : sale.products?.length ? "products" : "all",
      categoryId: sale.categoryId || "",
      subcategoryId: sale.subcategoryId || "all",
      productIds: sale.products?.map(p => p.productId) || [],
      minOrderAmount: sale.minOrderAmount || "",
      maxDiscount: sale.maxDiscount || "",
      startDate: new Date(sale.validFrom).toISOString().split("T")[0],
      endDate: new Date(sale.validUntil).toISOString().split("T")[0],
      isActive: sale.isActive,
      isFeatured: sale.isFeatured,
      bannerImage: sale.bannerImage || "",
      bgColor: sale.bgColor || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSale(null);
    setConflictWarning("");
  };

  // Check conflicts when relevant fields change
  useEffect(() => {
    if (!dialogOpen || editingSale) return;

    let cancelled = false;

    const runCheck = async () => {
      if (!formData.offerType || !formData.targetType) return;

      try {
        const response = await apiRequest("POST", "/api/admin/sales/check-conflicts", {
          offerType: formData.offerType,
          targetType: formData.targetType,
          categoryId: formData.categoryId,
          productIds: formData.productIds,
        });

        if (cancelled) return;

        if (response.hasConflict) {
          const conflictList = response.conflictingSales
            .map((sale: any) => `• "${sale.name}" (${sale.offerType})`)
            .join("\n");
          setConflictWarning(
            `Warning: This will conflict with existing sales:\n${conflictList}`
          );
        } else {
          setConflictWarning("");
        }
      } catch {
        if (!cancelled) setConflictWarning("");
      }
    };

    runCheck();

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, editingSale, formData.offerType, formData.targetType, formData.categoryId, formData.productIds]);

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.discountValue || !formData.startDate || !formData.endDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate target selection
    if (formData.targetType === "category" && !formData.categoryId) {
      toast({
        title: "Error",
        description: "Please select a category",
        variant: "destructive",
      });
      return;
    }

    if (formData.targetType === "products" && formData.productIds.length === 0) {
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
    return now >= new Date(sale.validFrom) && now <= new Date(sale.validUntil);
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
                        {sale.offerType === "percentage"
                          ? `${sale.discountValue}%`
                          : `₹${sale.discountValue}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(sale.validFrom)}</span>
                          <span>-</span>
                          <span>{formatDate(sale.validUntil)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sale.categoryId ? (
                          <span className="text-sm">
                            {sale.category?.name}
                            {sale.subcategoryId && ` (${sale.subcategory?.name})`}
                          </span>
                        ) : sale?.products && sale?.products?.length > 0 ? (
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
          
          {conflictWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800 whitespace-pre-line">
                {conflictWarning}
              </p>
            </div>
          )}
          
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
                    <SelectItem value="product">Product Offer</SelectItem>
                    <SelectItem value="flash_sale">Flash Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="discountValue">
                  Discount Value * {formData.offerType === "percentage" ? "(%)" : "(₹)"}
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

            <div>
              <Label htmlFor="targetType">Apply To *</Label>
              <Select
                value={formData.targetType}
                onValueChange={(value: "all" | "category" | "products") => {
                  setFormData({ 
                    ...formData, 
                    targetType: value, 
                    categoryId: "",
                    subcategoryId: "all",
                    productIds: [] 
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="products">Specific Products</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category and Subcategory Selection */}
            {formData.targetType === "category" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        categoryId: value, 
                        subcategoryId: "all" // Reset subcategory when category changes
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.categoryId && (
                  <div>
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Select
                      value={formData.subcategoryId}
                      onValueChange={(value) => setFormData({ ...formData, subcategoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All subcategories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subcategories</SelectItem>
                        {categories
                          ?.find((cat: any) => cat.id === formData.categoryId)
                          ?.subcategories?.map((sub: any) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Product Selection */}
            {formData.targetType === "products" && (
              <div>
                <Label htmlFor="products">Products *</Label>
                <div className="mb-2">
                  <Input
                    placeholder="Search products by name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                  {products
                    ?.filter((product: any) => 
                      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                      (product.sku && product.sku.toLowerCase().includes(productSearch.toLowerCase()))
                    )
                    .map((product: any) => (
                    <div key={product.id} className="flex items-center space-x-2 p-1">
                      <Checkbox
                        id={product.id}
                        checked={formData.productIds.includes(product.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({ 
                              ...formData, 
                              productIds: [...formData.productIds, product.id] 
                            });
                          } else {
                            setFormData({ 
                              ...formData, 
                              productIds: formData.productIds.filter(id => id !== product.id) 
                            });
                          }
                        }}
                      />
                      <label htmlFor={product.id} className="text-sm cursor-pointer">
                        {product.name}
                        {product.sku && (
                          <span className="text-muted-foreground ml-2">(SKU: {product.sku})</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.productIds.length} products selected
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

            <div>
              <Label htmlFor="bgColor">Background Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="bgColor"
                  type="color"
                  value={formData.bgColor || "#ffffff"}
                  onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                  className="w-12 h-10 p-1 cursor-pointer"
                  data-testid="input-bg-color"
                />
                <Input
                  value={formData.bgColor}
                  onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                  placeholder="#ff0000 or red"
                  className="flex-1"
                />
                {formData.bgColor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, bgColor: "" })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Background color for the sale badge/banner on the storefront
              </p>
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
