import { DataTable } from "@/components/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDataTable } from "@/hooks/use-data-table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { ProductWithDetails } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { Minus, Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStoreCart } from "./Hook/cartStore";
import { 
  formatPrice, 
  calculateVariantPrice, 
  findCartItem, 
  getCartItemByVariant, 
  getAvailableStock,
  updateCartItemQuantity,
  isOutOfStock,
  getStockDisplayText,
  hasItemsInCart
} from "@/pages/store/utils/cartUtils";

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

export default function StoreSale() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const storeId = user?.storeId;

  
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

  
  
  const displayProducts = tableProducts;
  const displayLoading = tableLoading;
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
          className="w-12 h-16 rounded object-cover"
        />
      ),
    },
    {
      accessorKey: "product.name",
      header: "Product",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm line-clamp-1">
            {row.original?.name}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.original?.sku || "-"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "product.category.name",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-sm">{row.original?.category?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "product.color.name",
      header: "Color",
      cell: ({ row }) => {
        const color = row.original?.color;
        if (!color) return <span className="text-sm">-</span>;
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-gray-300"
              style={{ backgroundColor: color.hexCode }}
            />
            <span className="text-sm">{color.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "product.fabric.name",
      header: "Fabric",
      cell: ({ row }) => (
        <span className="text-sm">{row.original?.fabric?.name || "-"}</span>
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
                <span className="font-semibold text-primary">
                  {formatPrice(item?.discountedPrice)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(item?.price)}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-primary">
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
              <span className="w-8 text-center text-sm font-medium">
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
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
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

      <div>
        <DataTable
          columns={productColumns}
          data={displayProducts}
          totalCount={totalCount || displayProducts.length}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPaginationChange={handlePaginationChange}
          isLoading={displayLoading}
          searchPlaceholder="Search products..."
          emptyMessage="No products in stock"
          className="[&_table]:text-xs [&_th]:h-8 [&_th]:px-2 [&_td]:px-2 [&_td]:py-1"
        />
      </div>
    </div>
  );
}
