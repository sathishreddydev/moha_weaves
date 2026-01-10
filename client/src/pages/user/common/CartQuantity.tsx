import { Button } from "@/components/ui/button";
import { CartItemWithProduct, ProductWithDetails } from "@shared/schema";
import { Minus, Plus } from "lucide-react";


export const CartQuantity = ({
  product,
  cartItems,
  updateQuantity,
  isButtonDisabled,
}: {
  product: ProductWithDetails;
  cartItems: CartItemWithProduct[];
  updateQuantity: (id: string, quantity: number) => void;
  isButtonDisabled: (id: string) => boolean;
}) => {
  const item = cartItems.find((c) => c.product.id === product.id);
  if (!item) return null;

  return (
    <div className="flex items-center border rounded-md">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => updateQuantity(item.id, item.quantity - 1)}
        disabled={isButtonDisabled(item.id)}
        data-testid={`button-quantity-minus-${item.id}`}
      >
        <Minus className="h-3 w-3" />
      </Button>

      <span
        className="w-8 text-center text-sm"
        data-testid={`text-quantity-${item.id}`}
      >
        {item.quantity}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => updateQuantity(item.id, item.quantity + 1)}
        disabled={item.quantity >= item.product.onlineStock || isButtonDisabled(item.id)}
        data-testid={`button-quantity-plus-${item.id}`}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
};
