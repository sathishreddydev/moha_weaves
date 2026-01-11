import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Trash2, Tag, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/DataTable/DataTable";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { ProductWithDetails } from "@shared/schema";
import { useStoreCart } from "./Hook/cartStore";

type ShopProduct = {
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
  storeStock: number;
};

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  storeStock: number;
  product: {
    id: string;
    name: string;
    code: string;
    image: string;
    price?: string;
    activeSale?: {
      id: string;
      name: string;
      offerType: string;
      discountValue: string;
      maxDiscount?: string;
    } | null;
    discountedPrice?: number;
  };
}

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
    updateCartLoading,
    removeLoading,
    setStoreId,
  } = useStoreCart();
  const disabledBtn = (productId: string) => {
    return (
      loading ||
      addCartLoading[productId] ||
      updateCartLoading[productId] ||
      removeLoading[productId]
    );
  };
  useEffect(() => {
    if (!storeId) return;
    setStoreId(storeId);
    if (cartItems.length === 0) fetchCart();
  }, []);

  const { data: filterOptions } = useQuery<{
    categories: { id: string; name: string; subcategories?: { id: string; name: string; categoryId: string }[] }[];
    colors: { id: string; name: string; hexCode: string }[];
    fabrics: { id: string; name: string }[];
  }>({
    queryKey: ["/api/filters"],
  });

  const {
    data: tableProducts,
    totalCount,
    pageIndex,
    pageSize,
    isLoading: tableLoading,
    isFetching,
    handlePaginationChange,
    handleSearchChange,
    handleFiltersChange,
    refetch,
  } = useDataTable<ShopProduct>({
    queryKey: "/api/store/products/paginated",
    initialPageSize: 10,
  });

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const addToCart = (product: ShopProduct) => {
    if (product.storeStock === 0) {
      toast({
        title: "Out of stock",
        description: "This product is not available in your store",
        variant: "destructive",
      });
      return;
    }

    const existing = cartItems.find(
      (item) => item.productId === product.product.id,
    );
    const price =
      product.product.activeSale && product.product.discountedPrice
        ? product.product.discountedPrice
        : parseFloat(product.product.price);

    if (existing) {
      if (existing.quantity < product.storeStock) {
        addItem(product.product.id, 1, price);
      } else {
        toast({
          title: "Limit reached",
          description: "Cannot add more than available stock",
        });
      }
    } else {
      addItem(product.product.id, 1, price);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    const updatedCart = cartItems.map((item) => {
      if (item.productId !== productId) return item;
      const newQty = item.quantity + delta;
      if (newQty < 1) return item;
      if (newQty > item.storeStock) {
        toast({
          title: "Limit reached",
          description: "Cannot exceed available stock",
        });
        return item;
      }
      return {
        ...item,
        quantity: newQty,
        lineAmount: newQty * item.unitPrice,
      };
    });
    updateItems(updatedCart, productId);
  };

  const removeFromCart = (productId: string) => {
    deleteItem(productId);
  };

  const displayProducts = tableProducts;
  const displayLoading = tableLoading;
  const productColumns: ColumnDef<ShopProduct>[] = [
    {
      accessorKey: "product.imageUrl",
      header: "Image",
      cell: ({ row }) => (
        <img
          src={
            row.original.product.imageUrl ||
            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
          }
          alt={row.original.product.name}
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
            {row.original.product.name}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.original.product.sku || "-"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "product.category.name",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.product.category?.name || "-"}
        </span>
      ),
    },
    {
      accessorKey: "product.color.name",
      header: "Color",
      cell: ({ row }) => {
        const color = row.original.product.color;
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
        <span className="text-sm">
          {row.original.product.fabric?.name || "-"}
        </span>
      ),
    },
    {
      accessorKey: "product.price",
      header: "Price",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            {item.product.activeSale && item.product.discountedPrice ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">
                  {formatPrice(item.product.discountedPrice)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(item.product.price)}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-primary">
                {formatPrice(item.product.price)}
              </span>
            )}
          </div>
        );
      },
    },

    {
      accessorKey: "storeStock",
      header: "Stock",
      cell: ({ row }) => {
        const outOfStock = row.original.storeStock === 0;
        return (
          <Badge
            variant={outOfStock ? "destructive" : "secondary"}
            className="text-xs"
          >
            {outOfStock
              ? "Out of stock"
              : `${row.original.storeStock} in stock`}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const product = row.original;
        const inCart = cartItems.some((c) => c.productId === product.product.id);
        const cartItem = cartItems.find((c) => c.productId === product.product.id);
        const outOfStock = product.storeStock === 0;

        if (inCart && cartItem) {
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateQuantity(product.product.id, -1)}
                disabled={
                  disabledBtn(product.product.id) || cartItem.quantity <= 1
                }
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
                onClick={() => updateQuantity(product.product.id, 1)}
                disabled={
                  disabledBtn(product.product.id) ||
                  cartItem.quantity >= product.storeStock
                }
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700"
                onClick={() => removeFromCart(product.product.id)}
                disabled={disabledBtn(product.product.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        }

        return (
          <Button
            variant="ghost"
            size="icon"
            disabled={disabledBtn(product.product.id) || outOfStock}
            onClick={() => addToCart(product)}
            data-testid={`product-${product.product.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  // Prepare filter configurations
  const filterConfigs = [
    {
      key: "categoryId",
      label: "Category",
      options:
        filterOptions?.categories?.map((cat) => ({
          label: cat.name,
          value: cat.id,
        })) || [],
    },
    {
      key: "colorId",
      label: "Color",
      options:
        filterOptions?.colors?.map((color) => ({
          label: color.name,
          value: color.id,
        })) || [],
    },
    {
      key: "fabricId",
      label: "Fabric",
      options:
        filterOptions?.fabrics?.map((fabric) => ({
          label: fabric.name,
          value: fabric.id,
        })) || [],
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
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refetch
          </Button>
          <Button
            variant="outline"
            size={'sm'}
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
          onSearchChange={handleSearchChange}
          onFiltersChange={handleFiltersChange}
          isLoading={displayLoading}
          searchPlaceholder="Search products..."
          filters={filterConfigs}
          emptyMessage="No products in stock"
        />
      </div>
    </div>
  );
}
