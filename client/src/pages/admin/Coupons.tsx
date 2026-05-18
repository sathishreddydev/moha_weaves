import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { CouponWithUsage } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  Edit,
  Percent,
  Plus,
  Ticket,
  Trash2,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { formatDate, formatPrice } from "@/lib/utils";


interface CouponFormData {
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  maxUsageLimit: string;
  perUserLimit: string;
  expiresAt: string;
  isActive: boolean;
}

export default function AdminCoupons() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponWithUsage | null>(null);
  const [deletingCouponId, setDeletingCouponId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CouponFormData>({
    code: "",
    type: "percentage",
    value: "",
    minOrderAmount: "",
    maxDiscount: "",
    maxUsageLimit: "",
    perUserLimit: "1",
    expiresAt: "",
    isActive: true,
  });

  const { data: coupons, isLoading } = useQuery<CouponWithUsage[]>({
    queryKey: ["/api/admin/coupons"],
    enabled: !!user && user.role === "admin",
  });

  const createMutation = useMutation({
    mutationFn: async (data: CouponFormData) => {
      const response = await apiRequest("POST", "/api/admin/coupons", {
        ...data,
        code: data.code.toUpperCase(),
        minOrderAmount: data.minOrderAmount || null,
        maxDiscount: data.maxDiscount || null,
        maxUsageLimit: data.maxUsageLimit ? parseInt(data.maxUsageLimit) : null,
        perUserLimit: data.perUserLimit ? parseInt(data.perUserLimit) : 1,
        expiresAt: data.expiresAt || null,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Success", description: "Coupon created successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create coupon",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CouponFormData }) => {
      const response = await apiRequest("PATCH", `/api/admin/coupons/${id}`, {
        ...data,
        code: data.code.toUpperCase(),
        minOrderAmount: data.minOrderAmount || null,
        maxDiscount: data.maxDiscount || null,
        maxUsageLimit: data.maxUsageLimit ? parseInt(data.maxUsageLimit) : null,
        perUserLimit: data.perUserLimit ? parseInt(data.perUserLimit) : 1,
        expiresAt: data.expiresAt || null,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Success", description: "Coupon updated successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update coupon",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/coupons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Success", description: "Coupon deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingCouponId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete coupon",
        variant: "destructive",
      });
    },
  });


  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setFormData({
      code: "",
      type: "percentage",
      value: "",
      minOrderAmount: "",
      maxDiscount: "",
      maxUsageLimit: "",
      perUserLimit: "1",
      expiresAt: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (coupon: CouponWithUsage) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      type: coupon.type as "percentage" | "fixed" | "free_shipping",
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount || "",
      maxDiscount: coupon.maxDiscount || "",
      maxUsageLimit: coupon.usageLimit?.toString() || "",
      perUserLimit: coupon.perUserLimit?.toString() || "1",
      expiresAt: coupon.validUntil
        ? new Date(coupon.validUntil).toISOString().split("T")[0]
        : "",
      isActive: coupon.isActive,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCoupon(null);
  };

  const handleSubmit = () => {
    if (!formData.code.trim()) {
      toast({
        title: "Error",
        description: "Coupon code is required",
        variant: "destructive",
      });
      return;
    }

    if (
      formData.type !== "free_shipping" &&
      (!formData.value ||
        isNaN(parseFloat(formData.value)) ||
        parseFloat(formData.value) <= 0)
    ) {
      toast({
        title: "Error",
        description: "Please enter a valid discount value",
        variant: "destructive",
      });
      return;
    }

    if (formData.type === "percentage" && parseFloat(formData.value) > 100) {
      toast({
        title: "Error",
        description: "Percentage discount cannot exceed 100%",
        variant: "destructive",
      });
      return;
    }

    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOpenDelete = (id: string) => {
    setDeletingCouponId(id);
    setDeleteDialogOpen(true);
  };

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Coupons
            </h1>
            <p className="text-muted-foreground">
              Manage discount coupons and promotions
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-coupon">
            <Plus className="h-4 w-4 mr-2" />
            Add Coupon
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
            ) : coupons && coupons.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Min Order</TableHead>
                    <TableHead>Max Discount</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow
                      key={coupon.id}
                      data-testid={`row-coupon-${coupon.id}`}
                    >
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {coupon.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {coupon.type === "percentage" ? (
                            <>
                              <Percent className="h-3 w-3 mr-1" /> Percentage
                            </>
                          ) : coupon.type === "free_shipping" ? (
                            <>
                              <Truck className="h-3 w-3 mr-1" /> Free Shipping
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-3 w-3 mr-1" /> Fixed
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {coupon.type === "percentage"
                          ? `${coupon.value}%`
                          : coupon.type === "free_shipping"
                          ? "—"
                          : formatPrice(coupon.value)}
                      </TableCell>
                      <TableCell>
                        {formatPrice(coupon?.minOrderAmount || "")}
                      </TableCell>
                      <TableCell>{formatPrice(coupon?.maxDiscount || "")}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {coupon.usageCount || 0} /{" "}
                          {coupon.usageLimit || "∞"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(coupon.validUntil)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={coupon.isActive ? "default" : "secondary"}
                        >
                          {coupon.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(coupon)}
                            data-testid={`button-edit-${coupon.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenDelete(coupon.id)}
                            data-testid={`button-delete-${coupon.id}`}
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
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No coupons found. Create your first coupon.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? "Edit Coupon" : "Add Coupon"}
            </DialogTitle>
            <DialogDescription>
              {editingCoupon
                ? "Update coupon details"
                : "Create a new discount coupon"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="code">Coupon Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., SAVE20"
                className="mt-1"
                data-testid="input-coupon-code"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Discount Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "percentage" | "fixed" | "free_shipping") =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger
                    className="mt-1"
                    data-testid="select-coupon-type"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="value">
                  {formData.type === "percentage"
                    ? "Percentage"
                    : formData.type === "free_shipping"
                    ? "Value (N/A)"
                    : "Amount (₹)"}
                </Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: e.target.value })
                  }
                  placeholder={
                    formData.type === "percentage"
                      ? "e.g., 20"
                      : formData.type === "free_shipping"
                      ? "Not required"
                      : "e.g., 500"
                  }
                  disabled={formData.type === "free_shipping"}
                  className="mt-1"
                  data-testid="input-coupon-value"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minOrderAmount">Min Order Amount (₹)</Label>
                <Input
                  id="minOrderAmount"
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, minOrderAmount: e.target.value })
                  }
                  placeholder="e.g., 1000"
                  className="mt-1"
                  data-testid="input-min-order"
                />
              </div>
              <div>
                <Label htmlFor="maxDiscount">Max Discount (₹)</Label>
                <Input
                  id="maxDiscount"
                  type="number"
                  value={formData.maxDiscount}
                  onChange={(e) =>
                    setFormData({ ...formData, maxDiscount: e.target.value })
                  }
                  placeholder="e.g., 2000"
                  className="mt-1"
                  data-testid="input-max-discount"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxUsageLimit">Total Usage Limit</Label>
                <Input
                  id="maxUsageLimit"
                  type="number"
                  value={formData.maxUsageLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUsageLimit: e.target.value })
                  }
                  placeholder="e.g., 100 (blank = unlimited)"
                  className="mt-1"
                  data-testid="input-usage-limit"
                />
              </div>
              <div>
                <Label htmlFor="perUserLimit">Per User Limit</Label>
                <Input
                  id="perUserLimit"
                  type="number"
                  value={formData.perUserLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, perUserLimit: e.target.value })
                  }
                  placeholder="e.g., 1"
                  className="mt-1"
                  data-testid="input-user-limit"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="expiresAt">Expiry Date</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
                className="mt-1"
                data-testid="input-expires-at"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
                data-testid="switch-is-active"
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
              data-testid="button-submit-coupon"
            >
              {editingCoupon ? "Save Changes" : "Create Coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Coupon</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this coupon? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {deletingCouponId &&
            (() => {
              const coupon = coupons?.find((c) => c.id === deletingCouponId);
              return coupon ? (
                <div className="py-4 border rounded-md p-3 bg-muted/50">
                  <p className="font-mono font-medium">{coupon.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {coupon.type === "percentage"
                      ? `${coupon.value}% off`
                      : coupon.type === "free_shipping"
                      ? "Free shipping"
                      : `₹${coupon.value} off`}
                    {coupon.minOrderAmount &&
                      ` on orders above ₹${coupon.minOrderAmount}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Used {coupon.usageCount || 0} times
                  </p>
                </div>
              ) : null;
            })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deletingCouponId && deleteMutation.mutate(deletingCouponId)
              }
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
