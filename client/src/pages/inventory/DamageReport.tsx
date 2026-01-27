import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

interface StockReductions {
  [key: string]: string; // online, storeId1, storeId2, etc.
}

export default function DamageReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { sku } = useParams();

  const [formData, setFormData] = useState({
    productId: "",
    source: "",
    damageCategory: "",
    damageSeverity: "",
    reason: "",
    costValue: "",
    recoveryValue: "",
    disposalMethod: "",
    notes: "",
    allocationType: "",
    stockReductions: {} as StockReductions,
  });

  // Get specific product by ID when SKU is provided, otherwise get all products
  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ["/api/inventory/getProducts"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/inventory/getProducts", { page: 1, pageSize: 10 });
      return response;
    },
    enabled: !!user && (user.role === "inventory" || user.role === "admin") && !sku,
    retry: 2,
  });

  // Get specific product by SKU when SKU is provided
  const { data: productBySku, isLoading: productBySkuLoading, error: productBySkuError } = useQuery({
    queryKey: ["/api/inventory/product-by-sku", sku],
    queryFn: async () => {
      if (!sku) return null;
      const response = await apiRequest("GET", `/api/inventory/product-by-sku/${sku}`);
      return response;
    },
    enabled: !!user && (user.role === "inventory" || user.role === "admin") && !!sku,
    retry: 2,
  });

  // Auto-select product when SKU is provided
  useEffect(() => {
    if (sku && productBySku) {
      setFormData({
        productId: productBySku.id,
        source: "",
        damageCategory: "",
        damageSeverity: "",
        reason: "",
        costValue: "",
        recoveryValue: "",
        disposalMethod: "",
        notes: "",
        allocationType: "",
        stockReductions: {} as StockReductions,
      });
    }
  }, [sku, productBySku]);

  // Report damage mutation
  const reportDamageMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/inventory/damages", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Damage reported successfully",
      });
      // Reset form after successful submission
      setFormData({
        productId: "",
        source: "",
        damageCategory: "",
        damageSeverity: "",
        reason: "",
        costValue: "",
        recoveryValue: "",
        disposalMethod: "",
        notes: "",
        allocationType: "",
        stockReductions: {} as StockReductions,
      });
      navigate("/inventory/damage-history");
    },
    onError: (error: any) => {
      console.error("Damage report error:", error);

      // Parse detailed error messages from backend
      let errorMessage = "Failed to report damage";

      if (error.message) {
        if (error.message.includes("Stock reduction failed for allocations")) {
          // Extract individual allocation errors
          const allocationErrors = error.message.split("Stock reduction failed for allocations:")[1];
          if (allocationErrors) {
            const errors = allocationErrors.split(";").map((e: string) => e.trim()).filter((e: string) => e);
            errorMessage = "Stock reduction issues:\n" + errors.join("\n");
          }
        } else if (error.message.includes("Insufficient")) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic form validation
    if (!formData.productId || !formData.source ||
      !formData.damageCategory || !formData.damageSeverity || !formData.reason || !formData.allocationType) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate stock reductions
    const stockReductions = formData.stockReductions;
    const totalReductions = Object.values(stockReductions).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);

    if (totalReductions === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter damage quantity for at least one allocation",
        variant: "destructive",
      });
      return;
    }

    // Stock validation before submission
    const selectedProduct = products.find((p: any) => p.id === formData.productId);
    if (!selectedProduct) {
      toast({
        title: "Error",
        description: "Selected product not found",
        variant: "destructive",
      });
      return;
    }

    // Validate each stock reduction against available stock
    for (const [allocationId, quantity] of Object.entries(stockReductions)) {
      const qty = parseInt(quantity) || 0;
      if (qty <= 0) continue;

      let maxStock = 0;
      let stockType = "";

      if (allocationId === "online") {
        maxStock = selectedProduct.onlineStock || 0;
        stockType = "online";
      } else {
        const storeAllocation = selectedProduct.storeAllocations?.find((s: any) => s.storeId === allocationId);
        if (!storeAllocation) {
          toast({
            title: "Error",
            description: `Store allocation not found for ${allocationId}`,
            variant: "destructive",
          });
          return;
        }
        maxStock = storeAllocation.quantity || 0;
        stockType = `store ${storeAllocation.storeName}`;
      }

      if (qty > maxStock) {
        toast({
          title: "Stock Error",
          description: `Cannot reduce ${qty} units from ${stockType}. Available: ${maxStock} units.`,
          variant: "destructive",
        });
        return;
      }
    }

    const damageData = {
      productId: formData.productId,
      source: formData.source,
      stockReductions: stockReductions,
      damageCategory: formData.damageCategory,
      damageSeverity: formData.damageSeverity,
      reason: formData.reason,
      costValue: formData.costValue || undefined,
      recoveryValue: formData.recoveryValue || undefined,
      disposalMethod: formData.disposalMethod || undefined,
      notes: formData.notes || undefined,
      allocationType: formData.allocationType || undefined,
    };

    reportDamageMutation.mutate(damageData);
  };

  const selectedProduct = sku ? productBySku : products.find((p: any) => p.id === formData.productId);

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

      {/* Error State */}
      {(productsError || productBySkuError) && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {sku ? "Failed to load product. Please check the SKU and try again." : "Failed to load products. Please refresh the page and try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {(productsLoading || productBySkuLoading) ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>{sku ? "Loading product..." : "Loading products..."}</span>
            </div>
          </CardContent>
        </Card>
      ) : !sku && products.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Products Available</h3>
              <p className="text-muted-foreground">
                There are no products in the inventory to report damage for.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : sku && !productBySku ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Product Not Found</h3>
              <p className="text-muted-foreground">
                No product found with SKU: {sku}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Damage Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label htmlFor="productId">Product *</Label>
                {sku ? (
                  <div className="p-3 bg-muted rounded-md">
                    {selectedProduct ? (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span className="font-medium">{selectedProduct.name}</span>
                        <Badge variant="outline">SKU: {selectedProduct.sku}</Badge>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        Loading product details...
                      </div>
                    )}
                  </div>
                ) : (
                  <Select
                    value={formData.productId}
                    onValueChange={(value) => setFormData({ ...formData, productId: value, allocationType: "", stockReductions: {} as StockReductions })}
                    disabled={productsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={productsLoading ? "Loading products..." : "Select product"} />
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
                )}
              </div>

              {/* Damage Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Damage Source *</Label>
                  <Select
                    value={formData.source}
                    onValueChange={(value) => setFormData({ ...formData, source: value })}
                    disabled={!formData.productId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.productId ? "Select source" : "Select product first"} />
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
                    disabled={!formData.productId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.productId ? "Select category" : "Select product first"} />
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
                    disabled={!formData.productId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.productId ? "Select severity" : "Select product first"} />
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

              {/* Stock Allocation */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Stock Allocation</h3>
                <div className="space-y-2">
                  <Label htmlFor="allocationType">Allocation Type *</Label>
                  <Select
                    value={formData.allocationType}
                    onValueChange={(value) => setFormData({ ...formData, allocationType: value, stockReductions: {} as StockReductions })}
                    disabled={!formData.productId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.productId ? "Select allocation type" : "Select product first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online Stock Only</SelectItem>
                      <SelectItem value="store">Store Stock Only</SelectItem>
                      <SelectItem value="both">Online + Store Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic Stock Input Fields */}
                {selectedProduct && formData.allocationType && (
                  <div className="space-y-4">
                    <h4 className="text-md font-medium">Enter Damage Quantities</h4>

                    {/* Online Stock Input */}
                    {(formData.allocationType === "online" || formData.allocationType === "both") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="onlineStock">Online Stock</Label>
                          <Input
                            id="onlineStock"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={formData.stockReductions?.online || ""}
                            onChange={(e) => setFormData({
                              ...formData,
                              stockReductions: {
                                ...formData.stockReductions,
                                online: e.target.value
                              } as StockReductions
                            })}
                            disabled={!formData.productId}
                            className={
                              (() => {
                                const qty = parseInt(formData.stockReductions?.online) || 0;
                                const maxStock = selectedProduct.onlineStock || 0;
                                return qty > maxStock ? "border-red-500 focus:border-red-500" : "";
                              })()
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Available Online Stock</Label>
                          <div className="p-2 bg-gray-50 rounded border">
                            <p className="text-sm font-medium">{selectedProduct.onlineStock || 0} units</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Store Stock Inputs */}
                    {(formData.allocationType === "store" || formData.allocationType === "both") &&
                      selectedProduct.storeAllocations?.map((store: any) => (
                        <div key={store.storeId} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={store.storeId}>{store.storeName}</Label>
                            <Input
                              id={store.storeId}
                              type="number"
                              min="0"
                              placeholder="0"
                              value={formData.stockReductions?.[store.storeId] || ""}
                              onChange={(e) => setFormData({
                                ...formData,
                                stockReductions: {
                                  ...formData.stockReductions,
                                  [store.storeId]: e.target.value
                                } as StockReductions
                              })}
                              disabled={!formData.productId}
                              className={
                                (() => {
                                  const qty = parseInt(formData.stockReductions?.[store.storeId]) || 0;
                                  const maxStock = store.quantity || 0;
                                  return qty > maxStock ? "border-red-500 focus:border-red-500" : "";
                                })()
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Available Stock</Label>
                            <div className="p-2 bg-gray-50 rounded border">
                              <p className="text-sm font-medium">{store.quantity || 0} units</p>
                            </div>
                          </div>
                        </div>
                      ))
                    }

                    {/* Validation Alerts */}
                    {(() => {
                      const alerts = [];

                      // Online stock validation
                      if ((formData.allocationType === "online" || formData.allocationType === "both") && formData.stockReductions?.online) {
                        const qty = parseInt(formData.stockReductions.online) || 0;
                        const maxStock = selectedProduct.onlineStock || 0;
                        if (qty > maxStock) {
                          alerts.push({
                            type: "online",
                            message: `Online stock: Cannot reduce ${qty} units. Available: ${maxStock} units.`
                          });
                        }
                      }

                      // Store stock validation
                      if (formData.allocationType === "store" || formData.allocationType === "both") {
                        selectedProduct.storeAllocations?.forEach((store: any) => {
                          const qty = parseInt(formData.stockReductions?.[store.storeId]) || 0;
                          const maxStock = store.quantity || 0;
                          if (qty > maxStock) {
                            alerts.push({
                              type: "store",
                              message: `${store.storeName}: Cannot reduce ${qty} units. Available: ${maxStock} units.`
                            });
                          }
                        });
                      }

                      return alerts;
                    })().map((alert, index) => (
                      <Alert key={index}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{alert.message}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Damage *</Label>
                <Textarea
                  id="reason"
                  placeholder="Describe what caused the damage..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  disabled={!formData.productId}
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
                      disabled={!formData.productId}
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
                      disabled={!formData.productId}
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
                    disabled={!formData.productId}
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
                  disabled={!formData.productId}
                />
              </div>

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
                  disabled={reportDamageMutation.isPending || !formData.productId}
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
      )}
    </div>
  );
}
