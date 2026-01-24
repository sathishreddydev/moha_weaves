import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Package } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const damageSources = [
  { value: "store", label: "In-Store" },
  { value: "warehouse", label: "Warehouse" },
  { value: "online_return", label: "Online Return" },
  { value: "shipping", label: "Shipping" },
  { value: "manufacturing", label: "Manufacturing" },
];

const damageCategories = [
  { value: "manufacturing_defect", label: "Manufacturing Defect" },
  { value: "shipping_damage", label: "Shipping Damage" },
  { value: "storage_damage", label: "Storage Damage" },
  { value: "handling_damage", label: "Handling Damage" },
  { value: "customer_damage", label: "Customer Damage" },
  { value: "expired", label: "Expired" },
  { value: "theft_loss", label: "Theft/Loss" },
  { value: "other", label: "Other" },
];

const damageSeverities = [
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "total_loss", label: "Total Loss" },
];

export default function DamageReport() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    productId: "",
    source: "",
    quantity: "",
    damageCategory: "",
    damageSeverity: "",
    reason: "",
    costValue: "",
    recoveryValue: "",
    disposalMethod: "",
    notes: "",
  });

  // Get products for selection
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/inventory/getProducts"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/inventory/getProducts", {});
      const result = await response.json();
      return result.data;
    },
    enabled: !!user && (user.role === "inventory" || user.role === "admin"),
  });

  // Report damage mutation
  const reportDamageMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/inventory/damages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to report damage");
      }

      return response.json();
    },
    onSuccess: () => {
      navigate("/inventory/damage-history");
    },
    onError: (error: any) => {
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productId || !formData.source || !formData.quantity ||
      !formData.damageCategory || !formData.damageSeverity || !formData.reason) {
      return;
    }

    const damageData = {
      productId: formData.productId,
      source: formData.source,
      quantity: parseInt(formData.quantity),
      damageCategory: formData.damageCategory,
      damageSeverity: formData.damageSeverity,
      reason: formData.reason,
      costValue: formData.costValue || undefined,
      recoveryValue: formData.recoveryValue || undefined,
      disposalMethod: formData.disposalMethod || undefined,
      notes: formData.notes || undefined,
    };

    reportDamageMutation.mutate(damageData);
  };

  const selectedProduct = products.find((p: any) => p.id === formData.productId);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          Report Product Damage
        </h1>
        <p className="text-muted-foreground">
          Report damaged products to maintain accurate inventory records
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Damage Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productId">Product *</Label>
                <Select
                  value={formData.productId}
                  onValueChange={(value) => setFormData({ ...formData, productId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product: any) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span>{product.name}</span>
                          <Badge variant="outline">SKU: {product.sku}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity Damaged *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="Enter quantity"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
                {selectedProduct && (
                  <p className="text-sm text-muted-foreground">
                    Available stock: {selectedProduct.totalStock}
                  </p>
                )}
              </div>
            </div>

            {/* Damage Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Damage Source *</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData({ ...formData, source: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {damageSources.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="damageCategory">Damage Category *</Label>
                <Select
                  value={formData.damageCategory}
                  onValueChange={(value) => setFormData({ ...formData, damageCategory: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {damageCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="damageSeverity">Severity *</Label>
                <Select
                  value={formData.damageSeverity}
                  onValueChange={(value) => setFormData({ ...formData, damageSeverity: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {damageSeverities.map((severity) => (
                      <SelectItem key={severity.value} value={severity.value}>
                        {severity.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Damage *</Label>
              <Textarea
                id="reason"
                placeholder="Describe what caused the damage..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              />
            </div>

            {/* Financial Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Financial Information (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costValue">Cost Value (₹)</Label>
                  <Input
                    id="costValue"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.costValue}
                    onChange={(e) => setFormData({ ...formData, costValue: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recoveryValue">Recovery Value (₹)</Label>
                  <Input
                    id="recoveryValue"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.recoveryValue}
                    onChange={(e) => setFormData({ ...formData, recoveryValue: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disposalMethod">Disposal Method</Label>
                <Input
                  id="disposalMethod"
                  placeholder="e.g., Recycle, Dispose, Return to supplier"
                  value={formData.disposalMethod}
                  onChange={(e) => setFormData({ ...formData, disposalMethod: e.target.value })}
                />
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information about the damage..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            {/* Stock Warning */}
            {selectedProduct && parseInt(formData.quantity) > selectedProduct.totalStock && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Warning: You're reporting more damaged quantity than available stock ({selectedProduct.totalStock}).
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/inventory")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={reportDamageMutation.isPending}
              >
                {reportDamageMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reporting...
                  </>
                ) : (
                  "Report Damage"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
