import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Phone, Mail, Calendar, ShoppingCart, Eye, Edit, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, FilterConfig } from "@/components/ui/data-table";
import { useDataTable } from "@/hooks/use-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { StoreCustomer, CustomerPurchase, CustomerPurchaseItem } from "@shared/schema";

// Extended type for customer with purchase history
type StoreCustomerWithPurchases = StoreCustomer & {
  purchases?: CustomerPurchase[];
};

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function Customers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<StoreCustomerWithPurchases | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);

  const {
    data: customers,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    handleSearchChange,
  } = useDataTable<StoreCustomer>({
    queryKey: "/api/store/customers",
    initialPageSize: 20,
  });

  const columns: ColumnDef<StoreCustomer>[] = [
    {
      accessorKey: "name",
      header: "Customer Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.phone}</span>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.original.email || "—"}</span>
        </div>
      ),
    },
    {
      accessorKey: "purchaseCount",
      header: "Orders",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <Badge variant={row.original.purchaseCount > 5 ? "default" : "secondary"}>
            {row.original.purchaseCount} purchases
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "totalPurchases",
      header: "Total Spent",
      cell: ({ row }) => (
        <span className="font-semibold text-primary">
          {formatPrice(row.original.totalPurchases)}
        </span>
      ),
    },
    {
      accessorKey: "lastPurchaseDate",
      header: "Last Purchase",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{formatDate(row.original.lastPurchaseDate)}</span>
        </div>
      ),
    },
    {
      accessorKey: "loyaltyPoints",
      header: "Points",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.loyaltyPoints} pts
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => viewCustomerHistory(row.original)}
          >
            <Eye className="h-4 w-4 mr-1" />
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editCustomer(row.original)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const viewCustomerHistory = async (customer: StoreCustomer) => {
    try {
      const response = await apiRequest("GET", `/api/store/customers/${customer.id}/purchases`);
      const purchases = await response.json();
      setSelectedCustomer({ ...customer, purchases });
      setShowCustomerDetail(true);
    } catch (error) {
      console.error("Error fetching customer purchases:", error);
    }
  };

  const editCustomer = (customer: StoreCustomer) => {
    // TODO: Implement customer edit functionality
    console.log("Edit customer:", customer);
  };

  const CustomerDetailModal = () => {
    if (!showCustomerDetail || !selectedCustomer) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer Details - {selectedCustomer.name}
            </CardTitle>
            <Button variant="ghost" onClick={() => setShowCustomerDetail(false)}>
              ×
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Phone</label>
                <p className="font-medium">{selectedCustomer.phone}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <p className="font-medium">{selectedCustomer.email || "—"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Total Orders</label>
                <p className="font-medium">{selectedCustomer.purchaseCount}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Total Spent</label>
                <p className="font-medium">{formatPrice(selectedCustomer.totalPurchases)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Loyalty Points</label>
                <p className="font-medium">{selectedCustomer.loyaltyPoints}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">First Purchase</label>
                <p className="font-medium">{formatDate(selectedCustomer.firstPurchaseDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Last Purchase</label>
                <p className="font-medium">{formatDate(selectedCustomer.lastPurchaseDate)}</p>
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <label className="text-sm text-muted-foreground">Notes</label>
              <div className="mt-1 p-3 bg-muted rounded-md">
                <p className="text-sm">{selectedCustomer.notes || "No notes added"}</p>
              </div>
            </div>

            {/* Purchase History */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Purchase History</h3>
              <div className="space-y-3">
                {selectedCustomer.purchases?.map((purchase: CustomerPurchase) => (
                  <Card key={purchase.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Order #{purchase.saleId}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(purchase.createdAt)} • {purchase.paymentMode}
                        </p>
                        <div className="mt-2">
                          <p className="text-sm font-medium">Items:</p>
                          {purchase.items?.map((item: CustomerPurchaseItem, idx: number) => (
                            <div key={idx} className="text-sm text-muted-foreground ml-4">
                              {item.quantity}x {item.saree?.name || "Product"}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(purchase.totalAmount)}</p>
                        {purchase.discountAmount !== "0" && (
                          <p className="text-sm text-green-600">
                            Discount: {formatPrice(purchase.discountAmount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Customer Information</h1>
          <p className="text-muted-foreground">
            View and manage store customer profiles and purchase history
          </p>
        </div>
        <Button onClick={() => navigate("/store")}>
          Back to Store
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <DataTable
            columns={columns}
            data={customers || []}
            totalCount={totalCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPaginationChange={handlePaginationChange}
            onSearchChange={handleSearchChange}
            isLoading={isLoading}
            searchPlaceholder="Search by name or phone..."
            emptyMessage="No customers found"
          />
        </CardContent>
      </Card>

      <CustomerDetailModal />
    </div>
  );
}
