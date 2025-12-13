// OrderSuccess.tsx
import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react"; 
import { Button } from "@/components/ui/button";

interface OrderSuccessProps {
  orderId: string;
}

const OrderSuccess: React.FC<OrderSuccessProps> = ({ orderId }) => {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <h2 className="text-2xl font-semibold mb-2" data-testid="text-order-success">
        Order Placed Successfully!
      </h2>
      <p className="text-muted-foreground mb-2">Thank you for shopping with Moha.</p>
      <p className="text-sm text-muted-foreground mb-6">
        Order ID:{" "}
        <span className="font-medium" data-testid="text-order-id">
          #{orderId.slice(0, 8).toUpperCase()}
        </span>
      </p>
      <div className="flex flex-col gap-3">
        <Link to={`/user/orders/${orderId}`}>
          <Button className="w-full" data-testid="button-view-order">
            View Order
          </Button>
        </Link>
        <Link to="/sarees">
          <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
            Continue Shopping
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default OrderSuccess;
