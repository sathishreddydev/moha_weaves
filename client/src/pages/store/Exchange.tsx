import { CloudinaryUploader } from "@/components/CloudinaryUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { StoreSaleWithItems } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  Camera,
  Check,
  Clock,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { damageReasons, exchangeTypes, normalExchangeReasons } from "./utils/exchangeReasons";
import { NewCartItem, ReturnItem, SaleItemWithAvailable, ShopProduct } from "./utils/types";
import { ExchangeType } from "./utils/enums";


const getSpecificReasons = (exchangeType: string) => {
  if (exchangeType === ExchangeType.DAMAGE) {
    return damageReasons;
  }
  return normalExchangeReasons;
};

function StoreExchange() {
  const navigate = useNavigate();
  const { saleId: urlSaleId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saleIdInput, setSaleIdInput] = useState(urlSaleId || "");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(
    urlSaleId || null,
  );
  const [searchResults, setSearchResults] = useState<StoreSaleWithItems[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [newItems, setNewItems] = useState<NewCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showNewItemsSection, setShowNewItemsSection] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] =
    useState<ShopProduct | null>(null);
  const [showVariantSelection, setShowVariantSelection] = useState(false);

  const { data: saleData, isLoading: saleLoading } =
    useQuery<StoreSaleWithItems>({
      queryKey: ["/api/store/sales", selectedSaleId],
      queryFn: async () => {
        const response = await apiRequest(
          "GET",
          `/api/store/sales/${selectedSaleId}`,
        );
        return response;
      },
      enabled: !!selectedSaleId && !!user && user.role === "store",
    });

  const { data: products, isLoading: productsLoading } = useQuery<
    ShopProduct[]
  >({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store" && showNewItemsSection,
  });

  useEffect(() => {
    if (saleData) {
      setCustomerName(saleData.customerName || "");
      setCustomerPhone(saleData.customerPhone || "");
    }
  }, [saleData]);

  const createExchangeMutation = useMutation({
    mutationFn: async (data: {
      originalSaleId: string;
      returnItems: {
        saleItemId: string;
        productId: string;
        variantId?: string;
        quantity: number;
        unitPrice: string;
        returnAmount: string;
        exchangeType: string;
        specificReason: string;
        damageImages: string[];
      }[];
      newItems: {
        productId: string;
        variantId?: string;
        quantity: number;
        unitPrice: string;
        lineAmount: string;
      }[];
      notes: string;
      customerName: string;
      customerPhone: string;
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/store/store-exchanges",
        data,
      );
      return response;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/store"),
      });

      toast({
        title: "Success",
        description: "Exchange completed successfully",
      });
      navigate(`/store/invoice/${data.originalSaleId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to complete exchange",
        variant: "destructive",
      });
    },
  });

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const handleLookupSale = async () => {
    if (saleIdInput.trim()) {
      // Check if the input looks like a sale ID (starts with MOHA)
      if (saleIdInput.trim().toUpperCase().startsWith("MOHA")) {
        setSelectedSaleId(saleIdInput.trim());
        setReturnItems([]);
        setNewItems([]);
        setShowSearchResults(false);
      } else {
        // Search by customer name or phone
        setIsSearching(true);
        setShowSearchResults(true);
        try {
          const results = await apiRequest(
            "GET",
            `/api/store/sales/search?query=${encodeURIComponent(saleIdInput.trim())}`,
          );
          setSearchResults(results);
        } catch {
          toast({
            title: "Search Error",
            description: "Failed to search sales",
            variant: "destructive",
          });
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }
    }
  };

  const handleSelectSale = (saleId: string) => {
    setSelectedSaleId(saleId);
    setReturnItems([]);
    setNewItems([]);
    setShowSearchResults(false);
    setSearchResults([]);
    navigate(`/store/exchange/${saleId}`);
  };

  const saleItems: SaleItemWithAvailable[] =
    saleData?.items?.map((item: any) => ({
      ...item,
      availableQuantity: item.quantity - (item.returnedQuantity || 0),
    })) || [];

  const addReturnItem = (saleItem: SaleItemWithAvailable) => {
    const available = saleItem?.availableQuantity ?? 0;

    if (available <= 0) {
      toast({
        title: "Not available",
        description: "This item has already been fully returned",
        variant: "destructive",
      });
      return;
    }
    const existing = returnItems.find(
      (item) => item.saleItemId === saleItem.id,
    );
    if (existing) {
      if (existing.quantity < available) {
        setReturnItems((prev) =>
          prev.map((item) => {
            if (item.saleItemId !== saleItem.id) return item;
            const newQty = item.quantity + 1;
            if (newQty > item.maxQuantity) {
              toast({
                title: "Limit reached",
                description: "Cannot return more than available quantity",
              });
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              returnAmount: (newQty * parseFloat(item.unitPrice)).toString(),
              exchangeType: item.exchangeType || "normal",
              specificReason: item.specificReason || "changed_mind",
              damageImages: item.damageImages || [],
            };
          }),
        );
      } else {
        toast({
          title: "Limit reached",
          description: "Cannot return more than available quantity",
        });
      }
    } else {
      setReturnItems((prev) => [
        ...prev,
        {
          saleItemId: saleItem.id,
          productId: saleItem.productId,
          variantId: saleItem.variantId,
          product: saleItem.product,
          quantity: 1,
          maxQuantity: available,
          unitPrice:
            saleItem.product.activeSale && saleItem.product.discountedPrice
              ? saleItem.product.discountedPrice.toString()
              : saleItem.price,
          returnAmount:
            saleItem.product.activeSale && saleItem.product.discountedPrice
              ? saleItem.product.discountedPrice.toString()
              : saleItem.price,
          exchangeType: "normal",
          specificReason: "changed_mind",
          damageImages: [],
        },
      ]);
    }
  };

  const updateReturnQuantity = (saleItemId: string, delta: number) => {
    setReturnItems(
      (prev) =>
        prev
          .map((item) => {
            if (item.saleItemId !== saleItemId) return item;
            const newQty = item.quantity + delta;
            if (newQty < 1) return null;
            if (newQty > item.maxQuantity) {
              toast({
                title: "Limit reached",
                description: "Cannot exceed available quantity",
              });
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              returnAmount: (newQty * parseFloat(item.unitPrice)).toString(),
            };
          })
          .filter(Boolean) as ReturnItem[],
    );
  };

  const removeReturnItem = (saleItemId: string) => {
    setReturnItems((prev) =>
      prev.filter((item) => item.saleItemId !== saleItemId),
    );
  };

  const updateItemExchangeType = (saleItemId: string, exchangeType: string) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.saleItemId === saleItemId
          ? { 
              ...item, 
              exchangeType, 
              specificReason: "", // Reset specific reason when type changes
              damageImages: exchangeType === "damage" ? item.damageImages : [] // Clear images if switching to normal
            }
          : item,
      ),
    );
  };

  const updateItemSpecificReason = (saleItemId: string, specificReason: string) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.saleItemId === saleItemId
          ? { ...item, specificReason }
          : item,
      ),
    );
  };

  const updateItemDamageImages = (saleItemId: string, damageImages: string[]) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.saleItemId === saleItemId
          ? { ...item, damageImages }
          : item,
      ),
    );
  };

  const removeDamageImage = (saleItemId: string, imageIndex: number) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.saleItemId === saleItemId) {
          const updatedImages = item.damageImages.filter((_, i) => i !== imageIndex);
          toast({
            title: "Photo Removed",
            description: "Damage photo has been removed",
            duration: 2000,
          });
          return { ...item, damageImages: updatedImages };
        }
        return item;
      }),
    );
  };

  const clearAllDamageImages = (saleItemId: string) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.saleItemId === saleItemId) {
          toast({
            title: "All Photos Cleared", 
            description: "All damage photos have been removed",
            duration: 2000,
          });
          return { ...item, damageImages: [] };
        }
        return item;
      }),
    );
  };
  const addNewItem = (product: ShopProduct, variantId?: string) => {
    // Check if product has variants and no variant was selected
    if (product.variants && product.variants.length > 0 && !variantId) {
      setSelectedProductForVariant(product);
      setShowVariantSelection(true);
      return;
    }

    // Validate variant exists if variantId is provided
    if (variantId && product.variants) {
      const selectedVariant = product.variants.find((v) => v.id === variantId);
      if (!selectedVariant) {
        toast({
          title: "Invalid Variant",
          description: "Selected variant not found",
          variant: "destructive",
        });
        return;
      }
    }

    // Get variant-specific stock if variantId is provided
    let availableStock = 0;
    let unitPrice = product.price;

    if (variantId && product.variants) {
      const selectedVariant = product.variants.find((v) => v.id === variantId);
      if (selectedVariant) {
        // Use variant stockQuantity since storeAllocations may not exist
        availableStock = selectedVariant.stockQuantity || 0;
        unitPrice = selectedVariant.price || product.price;
      }
    } else if (!product.variants || product.variants.length === 0) {
      // For products without variants, use total stock
      availableStock = product.totalStock;
    }

    // Stock validation
    if (availableStock === 0) {
      toast({
        title: "Out of Stock",
        description: "This item is currently out of stock",
        variant: "destructive",
      });
      return;
    }

    // Check for existing item (both productId and variantId must match)
    const existing = newItems.find(
      (item) => item.productId === product.id && item.variantId === variantId,
    );

    if (existing) {
      if (existing.quantity >= availableStock) {
        toast({
          title: "Stock Limit Reached",
          description: `Cannot add more than ${availableStock} units`,
          variant: "destructive",
        });
        return;
      }

      if (existing.quantity < availableStock) {
        setNewItems((prev) =>
          prev.map((item) =>
            item.productId === product.id && item.variantId === variantId
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  lineAmount: (
                    (item.quantity + 1) *
                    parseFloat(item.unitPrice)
                  ).toString(),
                }
              : item,
          ),
        );

        toast({
          title: "Item Updated",
          description: "Quantity increased successfully",
        });
      }
    } else {
      setNewItems((prev) => [
        ...prev,
        {
          productId: product.id,
          variantId: variantId,
          product: product,
          quantity: 1,
          maxQuantity: availableStock,
          unitPrice:
            product.activeSale && product.discountedPrice
              ? product.discountedPrice.toString()
              : unitPrice,
          lineAmount:
            product.activeSale && product.discountedPrice
              ? product.discountedPrice.toString()
              : unitPrice,
        },
      ]);

      toast({
        title: "Item Added",
        description: `${product.name}${variantId ? ` (${product.variants?.find((v) => v.id === variantId)?.size})` : ""} added to exchange`,
      });
    }
  };

  const updateNewItemQuantity = (
    productId: string,
    variantId: string | undefined,
    delta: number,
  ) => {
    setNewItems(
      (prev) =>
        prev
          .map((item) => {
            if (item.productId !== productId || item.variantId !== variantId)
              return item;
            const newQty = item.quantity + delta;

            if (newQty < 1) {
              return null;
            }

            // Validation: Cannot exceed max quantity
            if (newQty > item.maxQuantity) {
              toast({
                title: "Stock Limit Reached",
                description: `Cannot add more than ${item.maxQuantity} units`,
                variant: "destructive",
              });
              return item;
            }

            return {
              ...item,
              quantity: newQty,
              lineAmount: (newQty * parseFloat(item.unitPrice)).toString(),
            };
          })
          .filter(Boolean) as NewCartItem[],
    );
  };

  const removeNewItem = (productId: string, variantId?: string) => {
    setNewItems((prev) =>
      prev.filter(
        (item) => item.productId !== productId || item.variantId !== variantId,
      ),
    );
  };

  const returnTotal = returnItems.reduce(
    (sum, item) => sum + parseFloat(item.returnAmount),
    0,
  );
  const newItemsTotal = newItems.reduce(
    (sum, item) => sum + parseFloat(item.lineAmount),
    0,
  );
  const balanceAmount = Math.abs(returnTotal - newItemsTotal);
  const balanceDirection =
    returnTotal < newItemsTotal
      ? "due"
      : returnTotal > newItemsTotal
        ? "add_more"
        : "even";

  const handleCompleteExchange = () => {
    if (!selectedSaleId || !saleData) {
      toast({
        title: "No Sale Selected",
        description: "Please select a valid sale to process exchange",
        variant: "destructive",
      });
      return;
    }

    if (returnItems.length === 0) {
      toast({
        title: "No Return Items",
        description: "Please select at least one item to return",
        variant: "destructive",
      });
      return;
    }

    if (newItems.length === 0) {
      toast({
        title: "Exchange Items Required",
        description: "Please select at least one new item for exchange",
        variant: "destructive",
      });
      return;
    }

    if (createExchangeMutation.isPending) {
      toast({
        title: "Processing",
        description: "Exchange is already being processed",
        variant: "default",
      });
      return;
    }

    for (const returnItem of returnItems) {
      if (
        returnItem.quantity <= 0 ||
        returnItem.quantity > returnItem.maxQuantity
      ) {
        toast({
          title: "Invalid Quantity",
          description: `Invalid quantity for ${returnItem.product.name}. Max: ${returnItem.maxQuantity}`,
          variant: "destructive",
        });
        return;
      }
      if (parseFloat(returnItem.returnAmount) <= 0) {
        toast({
          title: "Invalid Amount",
          description: `Invalid return amount for ${returnItem.product.name}`,
          variant: "destructive",
        });
        return;
      }
      
      // Validate exchange type and specific reason
      if (!returnItem.exchangeType || !returnItem.specificReason) {
        toast({
          title: "Missing Exchange Reason",
          description: `Please select exchange type and reason for ${returnItem.product.name}`,
          variant: "destructive",
        });
        return;
      }
      
      // Validate damage images for damage exchanges
      if (returnItem.exchangeType === "damage" && (!returnItem.damageImages || returnItem.damageImages.length === 0)) {
        toast({
          title: "Damage Photos Required",
          description: `Please upload at least one damage photo for ${returnItem.product.name}`,
          variant: "destructive",
        });
        return;
      }
    }

    for (const newItem of newItems) {
      if (newItem.quantity <= 0) {
        toast({
          title: "Invalid Quantity",
          description: `Invalid quantity for new item`,
          variant: "destructive",
        });
        return;
      }
      if (parseFloat(newItem.lineAmount) <= 0) {
        toast({
          title: "Invalid Amount",
          description: `Invalid amount for new item`,
          variant: "destructive",
        });
        return;
      }

      const inventory = products?.find((p) => p.id === newItem.productId);
      if (!inventory) {
        toast({
          title: "Product Not Found",
          description: `Product ${newItem.product.name} not found in inventory`,
          variant: "destructive",
        });
        return;
      }

      // Check variant-specific stock if variantId exists
      if (newItem.variantId && inventory.variants) {
        const variant = inventory.variants.find(
          (v) => v.id === newItem.variantId,
        );
        if (!variant) {
          toast({
            title: "Variant Not Found",
            description: `Selected variant not found for ${newItem.product.name}`,
            variant: "destructive",
          });
          return;
        }

        const availableStock = variant.stockQuantity || 0;
        if (availableStock < newItem.quantity) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${availableStock} units available for ${newItem.product.name} (${variant.size})`,
            variant: "destructive",
          });
          return;
        }
      } else if (!newItem.variantId) {
        // For products without variants, check total stock
        if (inventory.totalStock < newItem.quantity) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${inventory.totalStock} units available for ${newItem.product.name}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const saleDate = new Date(saleData.createdAt);
    const currentDate = new Date();
    const daysSinceSale = Math.floor(
      (currentDate.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceSale > 7) {
      toast({
        title: "Exchange Period Expired",
        description: "Items can only be exchanged within 7 days of purchase",
        variant: "destructive",
      });
      return;
    }

    const totalReturnAmount = returnItems.reduce(
      (sum, item) => sum + parseFloat(item.returnAmount),
      0,
    );
    const totalNewAmount = newItems.reduce(
      (sum, item) => sum + parseFloat(item.lineAmount),
      0,
    );

    // Block unfavorable exchanges where returned value is significantly higher than new items
    if (totalReturnAmount > totalNewAmount) {
      const difference = totalReturnAmount - totalNewAmount;
      toast({
        title: "Unfavorable Exchange Blocked",
        description: `Returned items value (${formatPrice(totalReturnAmount)}) > Exchange items value (${formatPrice(totalNewAmount)}). This exchange would result in a loss of ${formatPrice(difference)} for the store.`,
        variant: "destructive",
      });
      return;
    }

    // Show exchange amount summary for valid exchanges
    if (totalNewAmount > totalReturnAmount) {
      const difference = totalNewAmount - totalReturnAmount;
      toast({
        title: "Payment Required",
        description: `Exchange items value (${formatPrice(totalNewAmount)}) > Returned items value (${formatPrice(totalReturnAmount)}). Customer must pay ${formatPrice(difference)}`,
      });
    } else {
      toast({
        title: "Even Exchange",
        description: `Equal value exchange: ${formatPrice(totalReturnAmount)}`,
      });
    }

    createExchangeMutation.mutate({
      originalSaleId: selectedSaleId!,
      returnItems: returnItems.map((item) => ({
        saleItemId: item.saleItemId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        returnAmount: item.returnAmount,
        exchangeType: item.exchangeType,
        specificReason: item.specificReason,
        damageImages: item.damageImages,
      })),
      newItems: newItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineAmount: item.lineAmount,
      })),
      notes,
      customerName,
      customerPhone,
    });
  };

  const filteredProducts =
    products?.filter(
      (item) =>
        item.totalStock > 0 &&
        (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.sku?.toLowerCase().includes(searchQuery.toLowerCase())),
    ) || [];

  return (
    <div className="max-w-6xl mx-auto text-sm">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Process Exchange
            </h1>
            <p className="text-xs text-muted-foreground">
              Return items from a sale and add new items
            </p>
          </div>
        </div>
      </div>

      {!selectedSaleId ? (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Find Original Sale</CardTitle>
            <p className="text-sm text-muted-foreground">
              Search by Sale ID, customer name, or phone number
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="saleSearch">Search</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="saleSearch"
                  placeholder="Enter sale ID, customer name, or phone number..."
                  value={saleIdInput}
                  onChange={(e) => {
                    setSaleIdInput(e.target.value);
                    if (e.target.value === "") {
                      setShowSearchResults(false);
                      setSearchResults([]);
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleLookupSale()}
                />
                <Button onClick={handleLookupSale} disabled={isSearching}>
                  <Search className="h-4 w-4 mr-2" />
                  {isSearching ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>

            {showSearchResults && (
              <div className="mt-4">
                {isSearching ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <p className="text-sm font-medium text-muted-foreground">
                      Found {searchResults.length} sales
                    </p>
                    {searchResults.map((sale: any) => {
                      const eligibility = sale.eligibilityData;
                      const isEligible = eligibility?.eligible !== false;
                      const isDisabled = eligibility && !eligibility.eligible;

                      return (
                        <div
                          key={sale.id}
                          className={`flex items-center justify-between p-3 border rounded-lg relative ${
                            isDisabled
                              ? "opacity-60 cursor-not-allowed bg-red-50/50"
                              : "hover-elevate cursor-pointer"
                          }`}
                          onClick={() =>
                            isEligible && handleSelectSale(sale.id)
                          }
                          title={
                            isDisabled
                              ? eligibility?.reason
                              : "Select this sale for exchange"
                          }
                        >
                          {/* Top right corner - Partial Returns badge */}
                          {sale.items &&
                            sale.items.some(
                              (item: any) => item.returnedQuantity > 0,
                            ) && (
                              <div className="absolute top-2 right-2">
                                <Badge
                                  variant="outline"
                                  className="text-xs text-orange-600 border-orange-600"
                                >
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Partial Returns
                                </Badge>
                              </div>
                            )}

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {sale.id}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {new Date(sale.createdAt).toLocaleDateString()}
                              </Badge>
                              {eligibility ? (
                                eligibility.eligible ? (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-green-500" />
                                    <span className="text-xs text-green-600">
                                      {eligibility.daysRemaining || 0} days left
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                    <span className="text-xs text-red-600">
                                      Not eligible
                                    </span>
                                  </div>
                                )
                              ) : null}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {sale.customerName && (
                                <span>{sale.customerName}</span>
                              )}
                              {sale.customerName && sale.customerPhone && (
                                <span> • </span>
                              )}
                              {sale.customerPhone && (
                                <span>{sale.customerPhone}</span>
                              )}
                            </div>
                            <div className="text-sm font-medium text-primary mt-1">
                              {formatPrice(sale.totalAmount)}
                            </div>
                            {isDisabled && eligibility?.reason && (
                              <div className="text-xs text-red-600 mt-1 bg-red-100 p-1 rounded">
                                {eligibility.reason}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end">
                            <ArrowRight
                              className={`h-4 w-4 ${
                                isDisabled
                                  ? "text-gray-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No sales found</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground text-center">
              Or go to Sales History and click &quot;Exchange&quot; on a sale
            </p>
          </CardContent>
        </Card>
      ) : saleLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : !saleData ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Sale not found</p>
            <Button variant="outline" onClick={() => setSelectedSaleId(null)}>
              Try Another
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Items to Return
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Sale #{selectedSaleId}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSaleId(null)}
                  >
                    Change Sale
                  </Button>
                </div>

                {saleData?.eligibilityData ? (
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${saleData.eligibilityData.eligible ? "bg-green-500" : "bg-red-500"}`}
                    ></div>
                    <span className="text-xs text-muted-foreground">
                      {saleData.eligibilityData.eligible
                        ? `${saleData.eligibilityData.daysRemaining || 0} days remaining for exchange`
                        : "Not eligible for exchange"}
                    </span>
                  </div>
                ) : null}
              </CardHeader>
              {saleData?.eligibilityData &&
                !saleData.eligibilityData.eligible && (
                  <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-medium">
                      Exchange Not Available
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {saleData.eligibilityData.reason}
                    </p>
                  </div>
                )}
              <CardContent>
                <p className="text-sm font-medium mb-3">Original Sale Items</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {saleItems.map((item) => {
                    const inReturn = returnItems.find(
                      (r) => r.saleItemId === item.id,
                    );
                    const isUnavailable = item.availableQuantity <= 0;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isUnavailable
                            ? "opacity-50"
                            : "hover-elevate cursor-pointer"
                        }`}
                        onClick={() => !isUnavailable && addReturnItem(item)}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              item.product.imageUrl ||
                              "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                            }
                            alt=""
                            className="w-12 h-16 rounded object-cover"
                          />
                          <div>
                            <p className="font-medium text-sm line-clamp-1">
                              {item.product.name}
                            </p>
                            {item?.variantId && (
                              <p className="text-xs text-muted-foreground">
                                Size:{" "}
                                {item.product?.variants?.find(
                                  (v: any) => v.id === item.variantId,
                                )?.size || `ID: ${item.variantId}`}
                              </p>
                            )}
                            <p className="text-sm text-primary font-semibold">
                              {item.product.activeSale &&
                              item.product.discountedPrice ? (
                                <div className="flex items-center gap-2">
                                  <span>
                                    {formatPrice(item.product.discountedPrice)}
                                  </span>
                                  <span className="text-xs text-muted-foreground line-through">
                                    {formatPrice(item.price)}
                                  </span>
                                </div>
                              ) : (
                                <span>{formatPrice(item.price)}</span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant={
                                  isUnavailable ? "destructive" : "secondary"
                                }
                                className="text-xs"
                              >
                                {item.availableQuantity} available
                              </Badge>
                              {item.returnedQuantity > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-orange-600"
                                >
                                  {item.returnedQuantity} returned
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Original: {item.quantity} • Returned:{" "}
                              {item.returnedQuantity || 0} • Available:{" "}
                              {item.availableQuantity}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isUnavailable}
                        >
                          {inReturn ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {returnItems.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <p className="text-sm font-medium mb-3">Selected Returns</p>
                    <div className="space-y-2">
                      {returnItems.map((item) => (
                        <div
                          key={item.saleItemId}
                          className="flex items-center gap-3 p-2 border rounded-lg bg-red-50 dark:bg-red-950/20"
                        >
                          <img
                            src={
                              item.product.imageUrl ||
                              "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                            }
                            alt=""
                            className="w-10 h-12 rounded object-cover"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-sm line-clamp-1">
                              {item.product.name}
                            </p>
                            {item?.variantId && (
                              <p className="text-xs text-muted-foreground">
                                Size:{" "}
                                {item.product?.variants?.find(
                                  (v: any) => v.id === item.variantId,
                                )?.size || `ID: ${item.variantId}`}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(item.unitPrice)} each
                            </p>
                            <div className="flex gap-2 mt-1">
                              <Select
                                value={item.exchangeType}
                                onValueChange={(value) =>
                                  updateItemExchangeType(item.saleItemId, value)
                                }
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {exchangeTypes.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={item.specificReason}
                                onValueChange={(value) =>
                                  updateItemSpecificReason(item.saleItemId, value)
                                }
                              >
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue placeholder="Reason" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getSpecificReasons(item.exchangeType).map((reason) => (
                                    <SelectItem key={reason.value} value={reason.value}>
                                      {reason.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {item.exchangeType === "damage" && (
                              <div className="mt-2">
                                <p className="text-xs font-medium mb-1">Damage Photos:</p>
                                <CloudinaryUploader
                                  maxNumberOfFiles={3}
                                  maxFileSize={5 * 1024 * 1024}
                                  fileType="image"
                                  onComplete={(urls) =>
                                    updateItemDamageImages(item.saleItemId, urls)
                                  }
                                  buttonVariant="outline"
                                  buttonClassName="h-6 text-xs px-2"
                                >
                                  <Camera className="h-3 w-3 mr-1" />
                                  Upload Photos
                                </CloudinaryUploader>
                                {item.damageImages.length > 0 && (
                                  <div className="mt-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-xs font-medium">Damage Photos:</p>
                                      {item.damageImages.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            clearAllDamageImages(item.saleItemId);
                                          }}
                                          className="text-xs text-red-600 hover:text-red-700"
                                        >
                                          Clear All
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      {item.damageImages.map((url, index) => (
                                        <div key={index} className="relative">
                                          <img
                                            src={url}
                                            alt={`Damage ${index + 1}`}
                                            className="w-8 h-8 rounded object-cover border"
                                          />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeDamageImage(item.saleItemId, index);
                                            }}
                                            title="Remove damage photo"
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateReturnQuantity(item.saleItemId, -1);
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateReturnQuantity(item.saleItemId, 1);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeReturnItem(item.saleItemId);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center py-3 mt-2 border-t font-bold text-red-600">
                      <span>Return Amount</span>
                      <span>{formatPrice(returnTotal)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    New Items
                  </CardTitle>
                  <Button
                    variant={showNewItemsSection ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setShowNewItemsSection(!showNewItemsSection)}
                  >
                    Add Items
                  </Button>
                </div>
              </CardHeader>
              {showNewItemsSection && (
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {productsLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : filteredProducts && filteredProducts.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {filteredProducts.map((item) => {
                        // Check if any variant of this product is already in new items
                        const inNew = newItems.find(
                          (c) => c.productId === item.id,
                        );

                        // Check if product has variants with available stock
                        const hasAvailableVariants = item.variants?.some(
                          (variant) => (variant.stockQuantity || 0) > 0,
                        );

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                            onClick={() => addNewItem(item)}
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  item.imageUrl ||
                                  "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                                }
                                alt=""
                                className="w-10 h-12 rounded object-cover"
                              />
                              <div>
                                <p className="font-medium text-sm line-clamp-1">
                                  {item.name}
                                </p>

                                <p className="text-sm text-primary font-semibold">
                                  {item.activeSale && item.discountedPrice ? (
                                    <div className="flex items-center gap-2">
                                      <span>
                                        {formatPrice(item.discountedPrice)}
                                      </span>
                                      <span className="text-xs text-muted-foreground line-through">
                                        {formatPrice(item.price)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span>{formatPrice(item.price)}</span>
                                  )}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {item.variants && item.variants.length > 0 ? (
                                    <>
                                      {item.variants
                                        .filter(
                                          (variant) =>
                                            (variant.stockQuantity || 0) > 0,
                                        )
                                        .slice(0, 3)
                                        .map((variant) => (
                                          <Badge
                                            key={variant.id}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {variant.size}:{" "}
                                            {variant.stockQuantity || 0}
                                          </Badge>
                                        ))}
                                      {item.variants.filter(
                                        (variant) =>
                                          (variant.stockQuantity || 0) > 0,
                                      ).length > 3 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          +
                                          {item.variants.filter(
                                            (variant) =>
                                              (variant.stockQuantity || 0) > 0,
                                          ).length - 3}{" "}
                                          more
                                        </Badge>
                                      )}
                                    </>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {item.totalStock} in stock
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={
                                !hasAvailableVariants && item.totalStock === 0
                              }
                            >
                              {inNew ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : searchQuery ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No products found matching "{searchQuery}"
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No products available
                    </p>
                  )}

                  {newItems.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <p className="text-sm font-medium mb-3">New Items</p>
                      <div className="space-y-2">
                        {newItems.map((item) => (
                          <div
                            key={`${item.productId}-${item.variantId || "no-variant"}`}
                            className="flex items-center gap-3 p-2 border rounded-lg bg-green-50 dark:bg-green-950/20"
                          >
                            <img
                              src={
                                item.product.imageUrl ||
                                "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
                              }
                              alt=""
                              className="w-10 h-12 rounded object-cover"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm line-clamp-1">
                                {item.product.name}
                              </p>
                              {item?.variantId && (
                                <p className="text-xs text-muted-foreground">
                                  Size:{" "}
                                  {item.product?.variants?.find(
                                    (v: any) => v.id === item.variantId,
                                  )?.size || `ID: ${item.variantId}`}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {formatPrice(item.unitPrice)} each
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNewItemQuantity(
                                    item.productId,
                                    item.variantId,
                                    -1,
                                  );
                                }}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm font-medium">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={item.quantity >= item.maxQuantity}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNewItemQuantity(
                                    item.productId,
                                    item.variantId,
                                    1,
                                  );
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNewItem(item.productId, item.variantId);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center py-3 mt-2 border-t font-bold text-green-600">
                        <span>New Items Total</span>
                        <span>{formatPrice(newItemsTotal)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exchange Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Return Items ({returnItems.length})
                    </span>
                    <span className="text-red-600 font-medium">
                      -{formatPrice(returnTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      New Items ({newItems.length})
                    </span>
                    <span className="text-green-600 font-medium">
                      +{formatPrice(newItemsTotal)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Balance</span>
                    <span
                      className={
                        balanceDirection === "due"
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }
                    >
                      {balanceDirection === "due" &&
                        `Customer Pays ${formatPrice(balanceAmount)}`}
                      {balanceDirection === "add_more" &&
                        `Add ${formatPrice(returnTotal - newItemsTotal)}`}
                      {balanceDirection === "even" && "Even Exchange"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exchange Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone Number</Label>
                  <Input
                    id="customerPhone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={process.env.NEXT_PUBLIC_PHONE_PLACEHOLDER || "+91 XXXXX XXXXX"}
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional information..."
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCompleteExchange}
                  disabled={createExchangeMutation.isPending}
                  data-testid="button-complete-exchange"
                >
                  {createExchangeMutation.isPending
                    ? "Processing..."
                    : "Complete Exchange"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Variant Selection Modal */}
      {showVariantSelection && selectedProductForVariant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Select Variant</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedProductForVariant.name}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedProductForVariant.variants
                  ?.filter((variant) => {
                    // Check if variant has stock (using stockQuantity since storeAllocations may not exist)
                    return (variant.stockQuantity || 0) > 0;
                  })
                  .map((variant) => {
                    const availableStock = variant.stockQuantity || 0;

                    return (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted"
                        onClick={() => {
                          // Validate variant stock before adding
                          if (availableStock === 0) {
                            toast({
                              title: "Out of Stock",
                              description:
                                "This variant is currently out of stock",
                              variant: "destructive",
                            });
                            return;
                          }

                          addNewItem(selectedProductForVariant, variant.id);
                          setShowVariantSelection(false);
                          setSelectedProductForVariant(null);
                        }}
                      >
                        <div>
                          <p className="font-medium text-sm">
                            Size: {variant.size}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {variant.sku || "N/A"}
                          </p>
                          <p className="text-sm text-primary font-semibold">
                            {formatPrice(
                              variant.price || selectedProductForVariant.price,
                            )}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {availableStock} in stock
                        </Badge>
                      </div>
                    );
                  })}
              </div>
              {selectedProductForVariant.variants?.filter((variant) => {
                return (variant.stockQuantity || 0) > 0;
              }).length === 0 && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    No variants available in stock
                  </p>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowVariantSelection(false);
                    setSelectedProductForVariant(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default StoreExchange;
