import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SareeWithDetails } from "@shared/schema";

type ShopProduct = {
  saree: SareeWithDetails;
  storeStock: number;
};

interface CartItem {
  sareeId: string;
  saree: SareeWithDetails;
  quantity: number;
  price: string;
  maxQuantity: number;
}


export default function StoreSale() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);

  const { data: products, isLoading } = useQuery<ShopProduct[]>({
    queryKey: ["/api/store/products"],
    enabled: !!user && user.role === "store",
  });

  // Use data table hook for paginated products
  const {
    data: tableProducts,
    totalCount,
    pageIndex,
    pageSize,
    isLoading: tableLoading,
    handlePaginationChange,
    handleSearchChange,
  } = useDataTable<ShopProduct>({
    queryKey: "/api/store/products/paginated",
    initialPageSize: 20,
  });

  const { data: cartData } = useQuery<any>({
    queryKey: ["/api/store/cart"],
    enabled: !!user?.storeId,
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (item: { sareeId: string; quantity: number; unitPrice: number }) => {
      const res = await apiRequest("POST", "/api/store/cart", item);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/cart"] });
      toast({
        title: "Added to cart",
        description: data.message || "Item added to cart successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update cart mutation
  const updateCartMutation = useMutation({
    mutationFn: async (items: CartItem[]) => {
      const res = await apiRequest("PUT", "/api/store/cart", {
        items: items.map(item => ({
          id: item.sareeId,
          sareeId: item.sareeId,
          quantity: item.quantity,
          unitPrice: parseFloat(item.price),
          lineAmount: item.quantity * parseFloat(item.price),
        }))
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/cart"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete cart item mutation
  const deleteCartMutation = useMutation({
    mutationFn: async (sareeId: string) => {
      const res = await apiRequest("DELETE", `/api/store/cart/${sareeId}`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/cart"] });
      toast({
        title: "Item removed",
        description: data.message || "Item removed from cart successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (cartData?.items) {
      const mappedCart = cartData.items.map((item: any) => ({
        sareeId: item.sareeId,
        saree: item.saree,
        quantity: item.quantity,
        price: item.unitPrice.toString(),
        maxQuantity: item.saree.totalStock || 999, // Fallback max quantity
      }));
      setCart(mappedCart);
    }
  }, [cartData]);

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

    const existing = cart.find((item) => item.sareeId === product.saree.id);

    if (existing) {
      if (existing.quantity < product.storeStock) {
        // Use the add to cart mutation to increment quantity
        addToCartMutation.mutate({
          sareeId: product.saree.id,
          quantity: 1,
          unitPrice: parseFloat(product.saree.price),
        });
      } else {
        toast({
          title: "Limit reached",
          description: "Cannot add more than available stock",
        });
      }
    } else {
      // Add new item to cart
      addToCartMutation.mutate({
        sareeId: product.saree.id,
        quantity: 1,
        unitPrice: parseFloat(product.saree.price),
      });
    }
  };

  const updateQuantity = (sareeId: string, delta: number) => {
    const updatedCart = cart.map((item) => {
      if (item.sareeId !== sareeId) return item;
      const newQty = item.quantity + delta;
      if (newQty < 1) return item;
      if (newQty > item.maxQuantity) {
        toast({
          title: "Limit reached",
          description: "Cannot exceed available stock",
        });
        return item;
      }
      return { ...item, quantity: newQty };
    });
    setCart(updatedCart);
    updateCartMutation.mutate(updatedCart);
  };

  const removeFromCart = (sareeId: string) => {
    deleteCartMutation.mutate(sareeId);
  };

  const displayProducts = tableProducts.length > 0 ? tableProducts : (products || []);
  const displayLoading = tableLoading || isLoading;
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
        const inCart = cart.some(c => c.sareeId === product.saree.id);
        const cartItem = cart.find(c => c.sareeId === product.saree.id);
        const outOfStock = product.storeStock === 0;

        if (inCart && cartItem) {
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateQuantity(product.saree.id, -1)}
                disabled={cartItem.quantity <= 1}
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
                disabled={cartItem.quantity >= product.storeStock}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700"
                onClick={() => removeFromCart(product.saree.id)}
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
            disabled={outOfStock}
            onClick={() => addToCart(product)}
            data-testid={`product-${product.saree.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          New Sale
        </h1>
        <Button
          variant="outline"
          className="relative"
          onClick={() => navigate("/store/cart")}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart
          {cart.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </Badge>
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
          isLoading={displayLoading}
          searchPlaceholder="Search products..."
          emptyMessage="No products in stock"
        />
      </div>
    </div>
  );
}
