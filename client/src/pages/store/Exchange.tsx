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
import type { ProductWithDetails, StoreSaleWithItems } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
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

type ShopProduct = ProductWithDetails & {
    activeSale?: {
      id: string;
      name: string;
      offerType: string;
      discountValue: string;
      maxDiscount?: string;
    } | null;
    discountedPrice?: number;
  };


interface ReturnItem {
  saleItemId: string;
  productId: string;
  variantId?: string;
  product: ProductWithDetails;
  quantity: number;
  maxQuantity: number;
  unitPrice: string;
  returnAmount: string;
}

interface NewCartItem {
  productId: string;
  variantId?: string;
  product: ProductWithDetails;
  quantity: number;
  maxQuantity: number;
  unitPrice: string;
  lineAmount: string;
}

interface SaleItemWithAvailable {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  returnedQuantity: number;
  price: string;
  product: ProductWithDetails & {
    activeSale?: {
      id: string;
      name: string;
      offerType: string;
      discountValue: string;
      maxDiscount?: string;
    } | null;
    discountedPrice?: number;
  };
  availableQuantity: number;
}
const exchangeReasons = [
  { value: "defective", label: "Product is defective" },
  { value: "wrong_item", label: "Received wrong item" },
  { value: "not_as_described", label: "Not as described" },
  { value: "quality_issue", label: "Quality issue" },
  { value: "size_issue", label: "Size doesn&apos;t fit" },
  { value: "changed_mind", label: "Changed my mind" },
  // { value: "other", label: "Other reason" },
];

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
  const [reason, setReason] = useState("changed_mind");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showNewItemsSection, setShowNewItemsSection] = useState(false);

  const {
    data: saleData,
    isLoading: saleLoading,
  } = useQuery<StoreSaleWithItems>({
    queryKey: ["/api/store/sales", selectedSaleId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/store/sales/${selectedSaleId}`);
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
        quantity: number;
        unitPrice: string;
        returnAmount: string;
      }[];
      newItems: {
        productId: string;
        quantity: number;
        unitPrice: string;
        lineAmount: string;
      }[];
      reason: string;
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
      navigate(`/store/invoice/${data.orderId}`);
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
          const results = await apiRequest("GET", `/api/store/sales/search?query=${encodeURIComponent(saleIdInput.trim())}`);
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
  };

  const saleItems: SaleItemWithAvailable[] =
    saleData?.items?.map((item: any) => ({
      ...item,
      availableQuantity: item.quantity - (item.returnedQuantity || 0),
    })) || [];

  const addReturnItem = (saleItem: SaleItemWithAvailable) => {
    if (saleItem.availableQuantity <= 0) {
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
      if (existing.quantity < saleItem.availableQuantity) {
        setReturnItems((prev) =>
          prev.map((item) =>
            item.saleItemId === saleItem.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  returnAmount: (
                    (item.quantity + 1) *
                    parseFloat(item.unitPrice)
                  ).toString(),
                }
              : item,
          ),
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
          maxQuantity: saleItem.availableQuantity,
          unitPrice:
            saleItem.product.activeSale && saleItem.product.discountedPrice
              ? saleItem.product.discountedPrice.toString()
              : saleItem.price,
          returnAmount:
            saleItem.product.activeSale && saleItem.product.discountedPrice
              ? saleItem.product.discountedPrice.toString()
              : saleItem.price,
        },
      ]);
    }
  };

  const updateReturnQuantity = (saleItemId: string, delta: number) => {
    setReturnItems((prev) =>
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
  const addNewItem = (product: ShopProduct) => {
    if (product.totalStock === 0) {
      toast({
        title: "Out of stock",
        description: "This product is not available",
        variant: "destructive",
      });
      return;
    }
    const existing = newItems.find((item) => item.productId === product.id);
    if (existing) {
      if (existing.quantity < product.totalStock) {
        setNewItems((prev) =>
          prev.map((item) =>
            item.productId === product.id
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
      } else {
        toast({
          title: "Limit reached",
          description: "Cannot add more than available stock",
        });
      }
    } else {
      setNewItems((prev) => [
        ...prev,
        {
          productId: product.id,
          product: product,
          quantity: 1,
          maxQuantity: product.totalStock,
          unitPrice:
            product.activeSale && product.discountedPrice
              ? product.discountedPrice.toString()
              : product.price,
          lineAmount:
            product.activeSale && product.discountedPrice
              ? product.discountedPrice.toString()
              : product.price,
        },
      ]);
    }
  };

  const updateNewItemQuantity = (productId: string, delta: number) => {
    setNewItems((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty < 1) return null;
          if (newQty > item.maxQuantity) {
            toast({
              title: "Limit reached",
              description: "Cannot exceed available stock",
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

  const removeNewItem = (productId: string) => {
    setNewItems((prev) => prev.filter((item) => item.productId !== productId));
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
    returnTotal > newItemsTotal
      ? "refund"
      : returnTotal < newItemsTotal
        ? "due"
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
      if (!inventory || inventory.totalStock < newItem.quantity) {
        toast({
          title: "Insufficient Stock",
          description: `Only ${inventory?.totalStock || 0} units available for ${newItem.product.name}`,
          variant: "destructive",
        });
        return;
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
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        returnAmount: item.returnAmount,
      })),
      newItems: newItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineAmount: item.lineAmount,
      })),
      reason,
      notes,
      customerName,
      customerPhone,
    });
  };

  const filteredProducts = products?.filter(
    (item) =>
      item.totalStock > 0 &&
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase())),
  ) || [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              Process Exchange
            </h1>
            <p className="text-muted-foreground">
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
                    {searchResults.map((sale:any) => {
                      const eligibility = sale.eligibilityData;
                      const isEligible = eligibility?.eligible !== false;
                      const isDisabled = eligibility && !eligibility.eligible;

                      return (
                        <div
                          key={sale.id}
                          className={`flex items-center justify-between p-3 border rounded-lg ${
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
                          <ArrowRight
                            className={`h-4 w-4 ${isDisabled ? "text-gray-400" : "text-muted-foreground"}`}
                          />
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
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Items to Return
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSaleId(null)}
                  >
                    Change Sale
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sale #{selectedSaleId}
                </p>
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
                                Size: {item.product?.variants?.find((v: any) => v.id === item.variantId)?.size || `ID: ${item.variantId}`}
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
                            <Badge
                              variant={
                                isUnavailable ? "destructive" : "secondary"
                              }
                              className="text-xs"
                            >
                              {item.availableQuantity} available
                            </Badge>
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
                                Size: {item.product?.variants?.find((v: any) => v.id === item.variantId)?.size || `ID: ${item.variantId}`}
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
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
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
                        const inNew = newItems.find(
                          (c) => c.productId === item.id,
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
                                  {item.activeSale &&
                                  item.discountedPrice ? (
                                    <div className="flex items-center gap-2">
                                      <span>
                                        {formatPrice(
                                          item.discountedPrice,
                                        )}
                                      </span>
                                      <span className="text-xs text-muted-foreground line-through">
                                        {formatPrice(item.price)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span>
                                      {formatPrice(item.price)}
                                    </span>
                                  )}
                                </p>
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {item.totalStock} in stock
                                </Badge>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon">
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
                            key={item.productId}
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
                                  updateNewItemQuantity(item.productId, -1);
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
                                  updateNewItemQuantity(item.productId, 1);
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
                                  removeNewItem(item.productId);
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
                <CardTitle>Exchange Summary</CardTitle>
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
                        balanceDirection === "refund"
                          ? "text-red-600"
                          : balanceDirection === "due"
                            ? "text-green-600"
                            : "text-muted-foreground"
                      }
                    >
                      {balanceDirection === "refund" &&
                        `Refund ${formatPrice(balanceAmount)}`}
                      {balanceDirection === "due" &&
                        `Customer Pays ${formatPrice(balanceAmount)}`}
                      {balanceDirection === "even" && "Even Exchange"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exchange Details</CardTitle>
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
                    placeholder="+91 XXXXX XXXXX"
                    readOnly
                  />
                </div>
                <div>
                  <Label>Reason for Exchange</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {exchangeReasons.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </div>
  );
}

export default StoreExchange;
