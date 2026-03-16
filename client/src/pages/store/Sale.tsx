import { DataTable } from "@/components/DataTable/DataTable";
import { useFilterStore } from "@/components/Store/useFilterStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDataTable } from "@/hooks/use-data-table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  calculateVariantPrice,
  findCartItem,
  getAvailableStock,
  getCartItemByVariant,
  getStockDisplayText,
  hasItemsInCart,
  isOutOfStock,
  updateCartItemQuantity
} from "@/pages/store/Utils/cartUtils";
import { createSaleFilters } from "@/pages/store/Utils/filterUtils";
import { ColumnDef } from "@tanstack/react-table";
import { Camera, Minus, Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoreCart } from "./Hook/cartForStore";
import { FilterItem, ShopProduct } from "./Utils/types";
import { formatPrice } from "@/lib/utils";

export default function StoreSale() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const storeId = user?.storeId;
  const { categories, colors, fabrics, fetchFilters } = useFilterStore();
  const [showScanner, setShowScanner] = useState(false);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);
  const [scannerError, setScannerError] = useState<string>("");

  
  const {
    items: cartItems,
    fetchCart,
    addItem,
    updateItems,
    deleteItem,
    loading,
    addCartLoading,
    removeLoading,
    setStoreId,
  } = useStoreCart();
  const disabledBtn = (productId: string) => {
    return loading || addCartLoading[productId] || removeLoading[productId];
  };
  useEffect(() => {
    if (storeId) {
      setStoreId(storeId);
      if (cartItems.length === 0) fetchCart();
    }
  }, [storeId, cartItems.length, fetchCart, setStoreId]);

  useEffect(() => {
    if (!categories.length || !colors.length || !fabrics.length) {
      fetchFilters();
    }
  }, [categories.length, colors.length, fabrics.length, fetchFilters]);

  const {
    data: tableProducts,
    totalCount,
    pageIndex,
    pageSize,
    isLoading: tableLoading,
    isFetching,
    handlePaginationChange,
    refetch,
  } = useDataTable<ShopProduct>({
    queryKey: "/api/store/products/paginated",
    initialPageSize: 10,
    pageKey:"storeSales"
  });

  
  const addToCart = useCallback((product: ShopProduct, variantId?: string, quantity: number = 1) => {
    if (!storeId) {
      toast({
        title: "Error",
        description: "This product is not available in your store",
        variant: "destructive",
      });
      return;
    }

    const actualVariantId = variantId || undefined;
    const existing = findCartItem(cartItems, product.id, actualVariantId);
    const { unitPrice } = calculateVariantPrice(product, actualVariantId, quantity);
    const availableStock = getAvailableStock(product, actualVariantId);

    if (existing && existing.quantity < availableStock) {
      addItem(product.id, quantity, unitPrice, actualVariantId);
    } else if (!existing) {
      addItem(product.id, quantity, unitPrice, actualVariantId);
    } else {
      toast({
        title: "Limit reached",
        description: "Cannot add more than available stock",
      });
    }
  }, [storeId, cartItems, findCartItem, calculateVariantPrice, getAvailableStock, addItem]);

  const updateQuantity = useCallback((productId: string, delta: number, variantId?: string) => {
    const updatedCart = updateCartItemQuantity(cartItems, productId, delta, variantId);
    updateItems(updatedCart, productId);
  }, [cartItems, updateCartItemQuantity, updateItems]);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    deleteItem(productId, variantId);
  }, [deleteItem]);

  // Barcode scanner simulation
  const handleBarcodeScan = useCallback(async () => {
    try {
      setScannerError("");
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setScannerStream(stream);
      setShowScanner(true);
      
      toast({
        title: "Camera Access Granted",
        description: "Point camera at barcode to scan",
      });
    } catch (error) {
      console.error("Camera access error:", error);
      let errorMessage = "Failed to access camera";
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Camera access denied. Please allow camera permissions in your browser settings.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No camera found. Please connect a camera device.";
        } else if (error.name === 'NotReadableError') {
          errorMessage = "Camera is already in use by another application.";
        }
      }
      
      setScannerError(errorMessage);
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Stop camera stream
  const stopScanner = useCallback(() => {
    if (scannerStream) {
      scannerStream.getTracks().forEach(track => track.stop());
      setScannerStream(null);
    }
    setShowScanner(false);
    setScannerError("");
  }, [scannerStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [scannerStream]);

  
  const displayProducts = tableProducts;
  const displayLoading = tableLoading;

  const filters: FilterItem[] = useMemo(() => 
    createSaleFilters(categories, colors, fabrics)
  , [categories, colors, fabrics]);
  const productColumns: ColumnDef<ShopProduct>[] = [
    {
      accessorKey: "product.imageUrl",
      header: "Image",
      cell: ({ row }) => (
        <img
          src={
            row.original?.imageUrl ||
            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
          }
          alt={row.original?.name}
          className="w-8 h-10 rounded object-cover"
        />
      ),
    },
    {
      accessorKey: "product.name",
      header: "Product",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-xs line-clamp-1">
            {row.original?.name}
          </p>
          <p className="text-[12px] text-muted-foreground font-mono">
            {row.original?.sku || "-"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "product.category.name",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-xs">{row.original?.category?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "product.color.name",
      header: "Color",
      cell: ({ row }) => {
        const color = row.original?.color;
        if (!color) return <span className="text-xs">-</span>;
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-gray-300"
              style={{ backgroundColor: color.hexCode }}
            />
            <span className="text-xs">{color.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "product.fabric.name",
      header: "Fabric",
      cell: ({ row }) => (
        <span className="text-xs">{row.original?.fabric?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "product.price",
      header: "Price",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            {item?.activeSale && item?.discountedPrice ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary text-xs">
                  {formatPrice(item?.discountedPrice)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(item?.price)}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-xs text-primary">
                {formatPrice(item?.price)}
              </span>
            )}
          </div>
        );
      },
    },

    {
      accessorKey: "totalStock",
      header: "Stock",
      cell: ({ row }) => {
        const outOfStock = isOutOfStock(row.original);
        return (
          <Badge
            variant={outOfStock ? "destructive" : "secondary"}
            className="text-xs"
          >
            {outOfStock
              ? "Out of stock"
              : `${row.original.totalStock} in stock`}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const product = row.original;
        const inCart = hasItemsInCart(cartItems, product.id);
        const cartItem = findCartItem(cartItems, product.id);
        const outOfStock = isOutOfStock(product);
        const hasVariants = product.variants && product.variants.length > 0;
        
        if (inCart && cartItem && !hasVariants) {
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateQuantity(product.id, -1, undefined)}
                disabled={disabledBtn(product.id) || cartItem.quantity <= 1}
                aria-label={`Decrease quantity for ${product.name}`}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-xs font-medium">
                {cartItem.quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateQuantity(product.id, 1, undefined)}
                disabled={
                  disabledBtn(product.id) ||
                  cartItem.quantity >= getAvailableStock(product, undefined)
                }
                aria-label={`Increase quantity for ${product.name}`}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700"
                onClick={() => removeFromCart(product.id, undefined)}
                disabled={disabledBtn(product.id)}
                aria-label={`Remove ${product.name} from cart`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        }

        if (hasVariants) {
          return (
            <div className="flex flex-col gap-1">
              {product.variants?.map((variant) => {
                const cartItemForVariant = getCartItemByVariant(cartItems, product.id, variant.id);
                const inCart = !!cartItemForVariant;
                const variantOutOfStock = isOutOfStock(product, variant.id);
                
                if (inCart && cartItemForVariant) {
                  return (
                    <div key={variant.id} className="flex items-center gap-1">
                      <span className="text-xs w-8">{variant.size}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(product.id, -1, variant.id)}
                        disabled={disabledBtn(product.id) || cartItemForVariant.quantity <= 1}
                        aria-label={`Decrease quantity for ${product.name} - ${variant.size}`}
                      >
                        <Minus className="h-2 w-2" />
                      </Button>
                      <span className="w-6 text-center text-xs font-medium">
                        {cartItemForVariant.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(product.id, 1, variant.id)}
                        disabled={
                          disabledBtn(product.id) ||
                          cartItemForVariant.quantity >= variant.stockQuantity
                        }
                        aria-label={`Increase quantity for ${product.name} - ${variant.size}`}
                      >
                        <Plus className="h-2 w-2" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-600 hover:text-red-700"
                        onClick={() => removeFromCart(product.id, variant.id)}
                        disabled={disabledBtn(product.id)}
                        aria-label={`Remove ${product.name} - ${variant.size} from cart`}
                      >
                        <Trash2 className="h-2 w-2" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        ({getStockDisplayText(product, variant.id)})
                      </span>
                    </div>
                  );
                }
                
                return (
                  <div key={variant.id} className="flex items-center gap-1">
                    <span className="text-xs w-8">{variant.size}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={disabledBtn(product.id) || variantOutOfStock}
                      onClick={() => addToCart(product, variant.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      ({getStockDisplayText(product, variant.id)})
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <Button
            variant="ghost"
            size="icon"
            disabled={disabledBtn(product.id) || outOfStock}
            onClick={() => addToCart(product)}
            data-testid={`product-${product.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            New Sale
          </h1>
          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Fetching data...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBarcodeScan}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Scan Barcode
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refetch
          </Button>
          <Button
            variant="outline"
            size={"sm"}
            onClick={() => navigate("/store/cart")}
            className="gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            Cart
            {cartItems.length > 0 && (
              <>
                <span>-</span>
                <span className="text-primary">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Barcode Scanner</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopScanner}
              >
                ×
              </Button>
            </div>
            {scannerError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-sm text-red-600">{scannerError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={handleBarcodeScan}
                >
                  Try Again
                </Button>
              </div>
            ) : scannerStream ? (
              <div className="bg-black rounded-lg overflow-hidden">
                <video
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                  ref={(videoElement) => {
                    if (videoElement && scannerStream) {
                      videoElement.srcObject = scannerStream;
                    }
                  }}
                />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-48 h-1 bg-red-500 opacity-75"></div>
                    <div className="w-1 h-48 bg-red-500 opacity-75 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                  </div>
                </div>
                <div className="bg-black/80 text-white p-2 text-center">
                  <p className="text-sm">Align barcode within frame</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-gray-600" />
                </div>
                <p className="text-sm text-gray-600">Initializing camera...</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <DataTable
          pageKey="storeSales"
          columns={productColumns}
          data={displayProducts}
          totalCount={totalCount || displayProducts.length}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPaginationChange={handlePaginationChange}
          isLoading={displayLoading}
          searchPlaceholder="Search products..."
          emptyMessage="No products in stock"
          filters={filters}
          
        />
      </div>
    </div>
  );
}
