import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { SareeWithDetails } from "@shared/schema";
import { useStoreCart } from "./Hook/cartStore";

type ShopProduct = {
  saree: SareeWithDetails;
  storeStock: number;
};

interface CartItem {
  id: string;
  sareeId: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  storeStock: number;
  saree: {
    id: string;
    name: string;
    code: string;
    image: string;
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
    setStoreId
  } = useStoreCart();
  const disabledBtn = (sareeId: string) => {
    return loading || addCartLoading[sareeId] || updateCartLoading[sareeId] || removeLoading[sareeId];
  }
  useEffect(() => {
    if (!storeId) return;
    setStoreId(storeId);
    if (cartItems.length === 0) fetchCart();
  }, []);

  const { data: filterOptions } = useQuery<{
    categories: { id: string; name: string }[];
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
    handlePaginationChange,
    handleSearchChange,
    handleFiltersChange,
  } = useDataTable<ShopProduct>({
    queryKey: "/api/store/products/paginated",
    initialPageSize: 20,
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

    const existing = cartItems.find((item) => item.sareeId === product.saree.id);

    if (existing) {
      if (existing.quantity < product.storeStock) {
        addItem(product.saree.id, 1, parseFloat(product.saree.price));
      } else {
        toast({
          title: "Limit reached",
          description: "Cannot add more than available stock",
        });
      }
    } else {
      addItem(product.saree.id, 1, parseFloat(product.saree.price));

    }
  };

  const updateQuantity = (sareeId: string, delta: number) => {
    const updatedCart = cartItems.map((item) => {
      if (item.sareeId !== sareeId) return item;
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
        lineAmount: newQty * item.unitPrice
      };
    });
    updateItems(updatedCart, sareeId);
  };

  const removeFromCart = (sareeId: string) => {
    deleteItem(sareeId);
  };

  const displayProducts = tableProducts;
  const displayLoading = tableLoading;
  const productColumns: ColumnDef<ShopProduct>[] = [
    {
      accessorKey: "saree.imageUrl",
      header: "Image",
      cell: ({ row }) => (
        <img
          src={
            row.original.saree.imageUrl ||
            "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=50"
          }
          alt={row.original.saree.name}
          className="w-12 h-16 rounded object-cover"
        />
      ),
    },
    {
      accessorKey: "saree.name",
      header: "Product",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm line-clamp-1">
            {row.original.saree.name}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.original.saree.sku || "-"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "saree.category.name",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.saree.category?.name || "-"}
        </span>
      ),
    },
    {
      accessorKey: "saree.color.name",
      header: "Color",
      cell: ({ row }) => {
        const color = row.original.saree.color;
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
      accessorKey: "saree.fabric.name",
      header: "Fabric",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.saree.fabric?.name || "-"}
        </span>
      ),
    },
    {
      accessorKey: "saree.price",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-semibold text-primary">
          {formatPrice(row.original.saree.price)}
        </span>
      ),
    },

    {
      accessorKey: "storeStock",
      header: "Stock",
      cell: ({ row }) => {
        const outOfStock = row.original.storeStock === 0;
        return (
          <Badge variant={outOfStock ? "destructive" : "secondary"} className="text-xs">
            {outOfStock ? "Out of stock" : `${row.original.storeStock} in stock`}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const product = row.original;
        const inCart = cartItems.some(c => c.sareeId === product.saree.id);
        const cartItem = cartItems.find(c => c.sareeId === product.saree.id);
        const outOfStock = product.storeStock === 0;

        if (inCart && cartItem) {
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateQuantity(product.saree.id, -1)}
                disabled={disabledBtn(product.saree.id) || cartItem.quantity <= 1}
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
                onClick={() => updateQuantity(product.saree.id, 1)}
                disabled={disabledBtn(product.saree.id) || cartItem.quantity >= product.storeStock}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700"
                onClick={() => removeFromCart(product.saree.id)}
                disabled={disabledBtn(product.saree.id)}
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
            disabled={disabledBtn(product.saree.id) || outOfStock}
            onClick={() => addToCart(product)}
            data-testid={`product-${product.saree.id}`}
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
      options: filterOptions?.categories?.map((cat) => ({
        label: cat.name,
        value: cat.id,
      })) || [],
    },
    {
      key: "colorId",
      label: "Color",
      options: filterOptions?.colors?.map((color) => ({
        label: color.name,
        value: color.id,
      })) || [],
    },
    {
      key: "fabricId",
      label: "Fabric",
      options: filterOptions?.fabrics?.map((fabric) => ({
        label: fabric.name,
        value: fabric.id,
      })) || [],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          New Sale
        </h1>
        <Button
          variant="outline"
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
