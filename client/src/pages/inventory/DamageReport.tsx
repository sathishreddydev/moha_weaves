import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Package } from "lucide-react";
import React,{ useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

interface StockReductions {
  [key: string]: string; // online, storeId1, storeId2, etc.
}

export default function DamageReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { sku } = useParams();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    productId: "",
    variantId: "",
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

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  // Validation functions
  const validateNumericInput = (value: string, fieldName: string) => {
    const num = parseFloat(value);
    if (value === "") return ""; // Allow empty values
    if (isNaN(num)) return `${fieldName} must be a valid number`;
    if (num < 0) return `${fieldName} cannot be negative`;
    return "";
  };

  const validateStockReduction = (allocationId: string, quantity: string, maxStock: number) => {
    const qty = parseInt(quantity) || 0;
    if (qty < 0) return "Quantity cannot be negative";
    if (qty > maxStock) return `Cannot reduce ${qty} units. Available: ${maxStock} units`;
    return "";
  };

  const validateAllocationType = (allocationType: string, stockReductions: StockReductions) => {
    if (!allocationType) return "Please select an allocation type";
    
    const totalReductions = Object.values(stockReductions).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
    if (totalReductions === 0) return "Please enter damage quantity for at least one allocation";
    
    return "";
  };

  // Get specific product by ID when SKU is provided, otherwise get all products
  // const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery({
  //   queryKey: ["/api/inventory/getProducts"],
  //   queryFn: async () => {
  //     const response = await apiRequest("POST", "/api/inventory/getProducts", { page: 1, pageSize: 10 });
  //     return response;
  //   },
  //   enabled: !!user && (user.role === "inventory" || user.role === "admin") && !sku,
  //   retry: 2,
  // });

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
        variantId: "",
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


  // Update selected variant when form data changes
  useEffect(() => {
    if (productBySku && formData.variantId) {
      const variant = productBySku.variants?.find((v: any) => v.id === formData.variantId);
      setSelectedVariant(variant);
    } else {
      setSelectedVariant(null);
    }
  }, [formData.variantId, productBySku]);

  // Reset variant when product changes
  useEffect(() => {
    setSelectedVariant(null);
    setFormData(prev => ({ 
      ...prev, 
      variantId: "", 
      allocationType: "", 
      stockReductions: {} as StockReductions 
    }));
    // Clear allocation type validation errors
    setFormErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.allocationType;
      delete newErrors.stockReductions;
      return newErrors;
    });
  }, [formData.productId]);

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
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/getDamages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/damage-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/getProducts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/product-by-sku"] });
      
      // Also invalidate general inventory queries that might be affected
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stock-distribution"] });
      
      // Reset form after successful submission
      setFormData({
        productId: sku ? productBySku?.id || "" : "",
        variantId: "",
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
      setSelectedVariant(null);
      setFormErrors({});
      
      // Navigate to damage history page
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

    // Clear previous errors
    setFormErrors({});

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

    // Variant validation - required if product has variants
    if (productBySku?.variants?.length > 0 && !formData.variantId) {
      toast({
        title: "Validation Error",
        description: "Please select a product variant",
        variant: "destructive",
      });
      return;
    }

    // Validate allocation type and stock reductions
    const allocationError = validateAllocationType(formData.allocationType, formData.stockReductions);
    if (allocationError) {
      setFormErrors(prev => ({ ...prev, allocationType: allocationError }));
      toast({
        title: "Validation Error",
        description: allocationError,
        variant: "destructive",
      });
      return;
    }

    // Validate numeric fields
    const costError = validateNumericInput(formData.costValue, "Cost value");
    const recoveryError = validateNumericInput(formData.recoveryValue, "Recovery value");
    
    if (costError || recoveryError) {
      setFormErrors(prev => ({
        ...prev,
        ...(costError && { costValue: costError }),
        ...(recoveryError && { recoveryValue: recoveryError })
      }));
      toast({
        title: "Validation Error",
        description: "Please fix the numeric input errors",
        variant: "destructive",
      });
      return;
    }

    // Validate each stock reduction against available stock (real-time validation should catch this, but double-check)
    const stockReductions = formData.stockReductions;
    for (const [allocationId, quantity] of Object.entries(stockReductions)) {
      const qty = parseInt(quantity) || 0;
      if (qty <= 0) continue;

      let maxStock = 0;
      let stockType = "";

      if (allocationId === "online") {
        maxStock = selectedVariant ? (selectedVariant.onlineStock || 0) : (productBySku.onlineStock || 0);
        stockType = "online";
      } else {
        const storeAllocation = selectedVariant 
          ? selectedVariant.storeAllocations?.find((s: any) => s.storeId === allocationId)
          : productBySku.storeAllocations?.find((s: any) => s.storeId === allocationId);
        
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

    // Convert stockReductions from strings to numbers for API
    const stockReductionsForApi = Object.entries(formData.stockReductions).reduce((acc, [key, value]) => {
      const numValue = parseInt(value) || 0;
      if (numValue > 0) {
        acc[key] = numValue;
      }
      return acc;
    }, {} as { [key: string]: number });

    // Validate that at least one stock reduction is specified
    if (Object.keys(stockReductionsForApi).length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter damage quantity for at least one allocation",
        variant: "destructive",
      });
      return;
    }

    const damageData = {
      productId: formData.productId,
      variantId: formData.variantId || undefined,
      source: formData.source,
      stockReductions: stockReductionsForApi,
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          Report Product Damage
        </h1>
        <p className="text-muted-foreground">
          Report damaged products to maintain accurate inventory records
        </p>
      </div>


      {/* Loading State */}
      {(productBySkuLoading) ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>{sku ? "Loading product..." : "Loading products..."}</span>
            </div>
          </CardContent>
        </Card>
      ) : !sku ? (
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
                    {productBySku ? (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span className="font-medium">{productBySku.name}</span>
                        <Badge variant="outline">SKU: {productBySku.sku}</Badge>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        Loading product details...
                      </div>
                    )}
                  </div>
                ) : (
                  <></>
                )}
              </div>

              {/* Variant Selection - Only show if product has variants */}
              {productBySku?.variants?.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="variantId">Product Variant *</Label>
                  <Select
                    value={formData.variantId}
                    onValueChange={(value) => setFormData({ ...formData, variantId: value, allocationType: "", stockReductions: {} as StockReductions })}
                    disabled={!formData.productId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.productId ? "Select variant" : "Select product first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {productBySku.variants.map((variant: any) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          <div className="flex items-center gap-2">
                            <span>Size: {variant.size}</span>
                            <Badge variant="outline">Online: {variant.onlineStock || 0}</Badge>
                            <Badge variant="outline">Total: {variant.stockQuantity || 0}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                    onValueChange={(value) => {
                      setFormData({ ...formData, allocationType: value, stockReductions: {} as StockReductions });
                      // Clear allocation type errors when changed
                      setFormErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.allocationType;
                        delete newErrors.stockReductions;
                        return newErrors;
                      });
                    }}
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
                  {formErrors.allocationType && (
                    <p className="text-sm text-red-500">{formErrors.allocationType}</p>
                  )}
                </div>

                {/* Dynamic Stock Input Fields */}
                {productBySku && formData.allocationType && (
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
                            onChange={(e) => {
                              const value = e.target.value;
                              const maxStock = selectedVariant ? (selectedVariant.onlineStock || 0) : (productBySku.onlineStock || 0);
                              const error = validateStockReduction("online", value, maxStock);
                              
                              setFormData({
                                ...formData,
                                stockReductions: {
                                  ...formData.stockReductions,
                                  online: value
                                } as StockReductions
                              });
                              
                              setFormErrors(prev => {
                                const newErrors = { ...prev };
                                if (error) {
                                  newErrors[`stockReductions_online`] = error;
                                } else {
                                  delete newErrors[`stockReductions_online`];
                                }
                                return newErrors;
                              });
                            }}
                            disabled={!formData.productId}
                            className={
                              (formErrors[`stockReductions_online`] || (() => {
                                const qty = parseInt(formData.stockReductions?.online) || 0;
                                const maxStock = selectedVariant ? (selectedVariant.onlineStock || 0) : (productBySku.onlineStock || 0);
                                return qty > maxStock;
                              })()) ? "border-red-500 focus:border-red-500" : ""
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Available Online Stock</Label>
                          <div className="p-2 bg-gray-50 rounded border">
                            <p className="text-sm font-medium">
                              {selectedVariant ? (selectedVariant.onlineStock || 0) : (productBySku.onlineStock || 0)} units
                              {selectedVariant && <span className="text-xs text-gray-500 ml-2">(Variant: {selectedVariant.size})</span>}
                            </p>
                          </div>
                          {formErrors[`stockReductions_online`] && (
                            <p className="text-sm text-red-500">{formErrors[`stockReductions_online`]}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Store Stock Inputs */}
                    {(formData.allocationType === "store" || formData.allocationType === "both") &&
                      productBySku.storeAllocations?.map((store: any) => (
                        <div key={store.storeId} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={store.storeId}>{store.storeName}</Label>
                            <Input
                              id={store.storeId}
                              type="number"
                              min="0"
                              placeholder="0"
                              value={formData.stockReductions?.[store.storeId] || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                const maxStock = selectedVariant 
                                  ? (selectedVariant.storeAllocations?.find((s: any) => s.storeId === store.storeId)?.quantity || 0)
                                  : (store.quantity || 0);
                                const error = validateStockReduction(store.storeId, value, maxStock);
                                
                                setFormData({
                                  ...formData,
                                  stockReductions: {
                                    ...formData.stockReductions,
                                    [store.storeId]: value
                                  } as StockReductions
                                });
                                
                                setFormErrors(prev => {
                                  const newErrors = { ...prev };
                                  if (error) {
                                    newErrors[`stockReductions_${store.storeId}`] = error;
                                  } else {
                                    delete newErrors[`stockReductions_${store.storeId}`];
                                  }
                                  return newErrors;
                                });
                              }}
                              disabled={!formData.productId}
                              className={
                                (formErrors[`stockReductions_${store.storeId}`] || (() => {
                                  const qty = parseInt(formData.stockReductions?.[store.storeId]) || 0;
                                  const maxStock = selectedVariant 
                                    ? (selectedVariant.storeAllocations?.find((s: any) => s.storeId === store.storeId)?.quantity || 0)
                                    : (store.quantity || 0);
                                  return qty > maxStock;
                                })()) ? "border-red-500 focus:border-red-500" : ""
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Available Stock</Label>
                            <div className="p-2 bg-gray-50 rounded border">
                              <p className="text-sm font-medium">
                                {selectedVariant 
                                  ? (selectedVariant.storeAllocations?.find((s: any) => s.storeId === store.storeId)?.quantity || 0)
                                  : (store.quantity || 0)} units
                                {selectedVariant && <span className="text-xs text-gray-500 ml-2">(Variant: {selectedVariant.size})</span>}
                              </p>
                            </div>
                            {formErrors[`stockReductions_${store.storeId}`] && (
                              <p className="text-sm text-red-500">{formErrors[`stockReductions_${store.storeId}`]}</p>
                            )}
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
                        const maxStock = selectedVariant ? (selectedVariant.onlineStock || 0) : (productBySku.onlineStock || 0);
                        if (qty > maxStock) {
                          alerts.push({
                            type: "online",
                            message: `Online stock: Cannot reduce ${qty} units. Available: ${maxStock} units.`
                          });
                        }
                      }

                      // Store stock validation
                      if (formData.allocationType === "store" || formData.allocationType === "both") {
                        const stockSource = selectedVariant || productBySku;
                        const allocations = selectedVariant ? selectedVariant.storeAllocations : productBySku.storeAllocations;
                        
                        allocations?.forEach((store: any) => {
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
                      min="0"
                      placeholder="0.00"
                      value={formData.costValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        const error = validateNumericInput(value, "Cost value");
                        setFormErrors(prev => ({ ...prev, costValue: error }));
                        setFormData({ ...formData, costValue: value });
                      }}
                      disabled={!formData.productId}
                      className={formErrors.costValue ? "border-red-500 focus:border-red-500" : ""}
                    />
                    {formErrors.costValue && (
                      <p className="text-sm text-red-500">{formErrors.costValue}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recoveryValue">Recovery Value (₹)</Label>
                    <Input
                      id="recoveryValue"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.recoveryValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        const error = validateNumericInput(value, "Recovery value");
                        setFormErrors(prev => ({ ...prev, recoveryValue: error }));
                        setFormData({ ...formData, recoveryValue: value });
                      }}
                      disabled={!formData.productId}
                      className={formErrors.recoveryValue ? "border-red-500 focus:border-red-500" : ""}
                    />
                    {formErrors.recoveryValue && (
                      <p className="text-sm text-red-500">{formErrors.recoveryValue}</p>
                    )}
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
