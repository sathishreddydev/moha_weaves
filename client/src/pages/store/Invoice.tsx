import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeftRight, FileText, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function Invoice() {
  const navigate = useNavigate();
  const { saleId } = useParams();
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const formatPrice = (price: number | string) => {
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!saleId) return;

      setLoading(true);
      try {
        const data = await apiRequest("GET", `/api/store/receipt/${saleId}`);
        setInvoiceData(data);
      } catch (error) {
        console.error("Error fetching invoice data:", error);
        toast({
          title: "Error",
          description: "Failed to fetch invoice data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceData();
  }, [saleId]);
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleBackToStore = () => {
    navigate("/store");
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Invoice Not Found
          </h2>
          <p className="text-slate-600 mb-4">
            Invoice data not found. Please check the sale ID or complete a
            checkout first.
          </p>
          <Button variant={"outline"} onClick={handleBackToStore}>
            Back to Store
          </Button>
        </div>
      </div>
    );
  }

  const subtotal =
    invoiceData.type === "normal"
      ? invoiceData.items?.reduce(
          (sum: number, item: any) => sum + item.price * item.quantity,
          0,
        ) || 0
      : invoiceData.exchangeHistory?.reduce(
          (sum: number, exchange: any) =>
            sum +
            (exchange.newItems?.reduce(
              (itemSum: number, item: any) =>
                itemSum + parseFloat(item.lineAmount),
              0,
            ) || 0),
          0,
        ) || 0;
  const discountAmount =
    invoiceData.type === "normal" ? invoiceData.discountAmount || 0 : 0;
  const taxAmount =
    invoiceData.type === "normal" ? invoiceData.taxAmount || 0 : 0;
  const totalAmount =
    invoiceData.type === "normal"
      ? invoiceData.totalAmount || 0
      : parseFloat(
          invoiceData.exchangeHistory?.[invoiceData.exchangeHistory.length - 1]
            ?.newItemsAmount || "0",
        );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          {invoiceData.type === "exchange" ? <ArrowLeftRight /> : <FileText />}
          {invoiceData.type === "exchange" ? "Exchange Bill" : "Invoice"} #
          {invoiceData.orderId}
        </h1>
        <div className="flex gap-2">
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print{" "}
            {invoiceData.type === "exchange" ? "Exchange Bill" : "Invoice"}
          </Button>
          <Button variant={"outline"} onClick={handleBackToStore}>
            Back to Store
          </Button>
        </div>
      </div>
      <div
        className="print-area bg-white shadow-xl rounded-xl overflow-hidden
                  border border-slate-200
                  print:shadow-none print:border-none print:rounded-none"
      >
        <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200 print:shadow-none print:border-none">
          <div className="p-4 border-b border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-base font-bold text-slate-800">MOHA STORE</p>
                <p className="text-slate-600 text-xs">
                  Fashion & Traditional Wear
                </p>
                <p className="text-slate-600 text-xs">GSTIN: XXXXXXXXXX</p>
              </div>
              <div className="text-right">
                <h3 className="text-base font-semibold text-slate-800">
                  {invoiceData.type === "exchange"
                    ? "EXCHANGE BILL"
                    : "INVOICE"}
                </h3>
                <p className="text-slate-600 text-xs">
                  {invoiceData.type === "exchange"
                    ? "Exchange Bill"
                    : "Invoice"}{" "}
                  #: {invoiceData.orderId}
                </p>
                <p className="text-slate-600 text-xs">
                  Date: {new Date(invoiceData.createdAt).toLocaleDateString()}
                </p>
                <p className="text-slate-600 text-xs">
                  Payment: {invoiceData.paymentMode?.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="p-4 border-b border-slate-200">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-1">
                  BILL TO:
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  {invoiceData.customerName}
                </p>
                <p className="text-xs text-slate-600">
                  Phone: {invoiceData.customerPhone}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-1">
                  STORE DETAILS:
                </h4>
                <p className="text-xs text-slate-600">
                  {invoiceData.store?.name || "MOHA Store"}
                </p>
                <p className="text-xs text-slate-600">
                  Store ID: {invoiceData.store?.id}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-4 border-b border-slate-200">
            {invoiceData.type === "normal" ? (
              // Normal sale items
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-100 text-slate-500 text-[10px] uppercase tracking-wider">
                      <th className="py-3 font-semibold px-2">SKU ID</th>
                      <th className="py-3 font-semibold px-2">Description</th>
                      <th className="py-3 font-semibold px-2 text-center">
                        Qty
                      </th>
                      <th className="py-3 font-semibold px-2 text-right">
                        Price
                      </th>
                      <th className="py-3 font-semibold px-2 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoiceData.items?.map((item: any) => (
                      <tr key={item.id} className="group">
                        <td className="py-3 px-2">
                          <span className="font-medium text-slate-700 text-xs">
                            {item.product?.sku || item.productId}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-slate-600 text-xs">
                            <div>{item.product?.name || "Product"}</div>
                            {item.variantId && (
                              <div className="text-slate-500 text-[10px] mt-1">
                                Size: {item.product?.variants?.find((v: any) => v.id === item.variantId)?.size || `ID: ${item.variantId}`}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="w-8 text-center text-xs">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end">
                            <span className="text-slate-400 mr-1 text-xs">
                              ₹
                            </span>
                            <span className="text-xs">{item.price}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-slate-800 text-xs">
                          ₹{item.price * item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Exchange bill - show all exchanges with their return and new items
              <div className="space-y-6">
                {invoiceData.exchangeHistory?.map(
                  (exchange: any, exchangeIndex: number) => (
                    <div
                      key={exchangeIndex}
                      className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium text-sm text-slate-800">
                            Exchange #{exchange.id}
                          </p>
                          <p className="text-xs text-slate-600">
                            Date: {formatDate(exchange.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600">
                            Processed by: {exchange.processor?.name || "Staff"}
                          </p>
                        </div>
                      </div>

                      {/* Return Items */}
                      {exchange.returnItems &&
                        exchange.returnItems.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-red-600 mb-3">
                              Returned Items
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b-2 border-red-100 text-red-500 text-[10px] uppercase tracking-wider">
                                    <th className="py-3 font-semibold px-2">
                                      SKU ID
                                    </th>
                                    <th className="py-3 font-semibold px-2">
                                      Product
                                    </th>
                                    <th className="py-3 font-semibold px-2 text-center">
                                      Qty
                                    </th>
                                    <th className="py-3 font-semibold px-2 text-right">
                                      Price
                                    </th>
                                    <th className="py-3 font-semibold px-2 text-right">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-red-50">
                                  {exchange.returnItems.map(
                                    (item: any, itemIndex: number) => (
                                      <tr key={itemIndex} className="group">
                                        <td className="py-3 px-2">
                                          <span className="font-medium text-slate-700 text-xs">
                                            {item.product?.sku || item.productId}
                                          </span>
                                        </td>
                                        <td className="py-3 px-2">
                                          <div className="text-slate-600 text-xs">
                                            <div>{item.product?.name || "Product"}</div>
                                            {item.variantId && (
                                              <div className="text-slate-500 text-[10px] mt-1">
                                                Size: {item.product?.variants?.find((v: any) => v.id === item.variantId)?.size || `ID: ${item.variantId}`}
                                              </div>
                                            )}
                                            {item.exchangeType === "damage" ? "Damage" : "Normal"} - {item.specificReason}
                                          </div>
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                          <span className="w-8 text-center text-xs">
                                            {item.quantity}
                                          </span>
                                        </td>
                                        <td className="py-3 px-2 text-right">
                                          <div className="flex items-center justify-end">
                                            <span className="text-slate-400 mr-1 text-xs">
                                              ₹
                                            </span>
                                            <span className="text-xs">
                                              {item.unitPrice}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-2 text-right font-semibold text-red-600 text-xs">
                                          ₹{item.returnAmount}
                                        </td>
                                      </tr>
                                    ),
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                      {/* New Items */}
                      {exchange.newItems && exchange.newItems.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-green-600 mb-3">
                            Exchange Items
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b-2 border-green-100 text-green-500 text-[10px] uppercase tracking-wider">
                                  <th className="py-3 font-semibold px-2">
                                    SKU ID
                                  </th>
                                  <th className="py-3 font-semibold px-2">
                                    Description
                                  </th>
                                  <th className="py-3 font-semibold px-2 text-center">
                                    Qty
                                  </th>
                                  <th className="py-3 font-semibold px-2 text-right">
                                    Price
                                  </th>
                                  <th className="py-3 font-semibold px-2 text-right">
                                    Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-green-50">
                                {exchange.newItems.map(
                                  (item: any, itemIndex: number) => (
                                    <tr key={itemIndex} className="group">
                                      <td className="py-3 px-2">
                                        <span className="font-medium text-slate-700 text-xs">
                                          {item.product?.sku || item.productId}
                                        </span>
                                      </td>
                                      <td className="py-3 px-2">
                                        <div className="text-slate-600 text-xs">
                                          <div>{item.product?.name || "Product"}</div>
                                          {item.variantId && (
                                            <div className="text-slate-500 text-[10px] mt-1">
                                              Size: {item.product?.variants?.find((v: any) => v.id === item.variantId)?.size || `ID: ${item.variantId}`}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-2 text-center">
                                        <span className="w-8 text-center text-xs">
                                          {item.quantity}
                                        </span>
                                      </td>
                                      <td className="py-3 px-2 text-right">
                                        <div className="flex items-center justify-end">
                                          <span className="text-slate-400 mr-1 text-xs">
                                            ₹
                                          </span>
                                          <span className="text-xs">
                                            {item.unitPrice}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-2 text-right font-semibold text-green-600 text-xs">
                                        ₹{item.lineAmount}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Exchange Summary */}
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">Return Total:</span>
                          <span className="text-red-600">
                            {formatPrice(exchange.returnAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">Exchange Total:</span>
                          <span className="text-green-600">
                            {formatPrice(exchange.newItemsAmount)}
                          </span>
                        </div>
                        {exchange.balanceAmount !== "0" && (
                          <div className="flex justify-between text-xs font-medium pt-1">
                            <span>
                              {exchange.balanceDirection === "due_from_customer"
                                ? "Customer Pays:"
                                : exchange.balanceDirection ===
                                    "refund_to_customer"
                                  ? "Refund to Customer:"
                                  : "Balance:"}
                            </span>
                            <span
                              className={
                                exchange.balanceDirection ===
                                "due_from_customer"
                                  ? "text-orange-600"
                                  : "text-green-600"
                              }
                            >
                              {formatPrice(exchange.balanceAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            {/* Summary */}
            <div className="mt-8 flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Discount</span>
                    <span>-₹{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Tax</span>
                  <span>₹{taxAmount.toLocaleString()}</span>
                </div>
                <div className="pt-2 mt-1 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-bold">Total Amount</span>
                  <span className="text-sm font-bold text-slate-800">
                    ₹{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="mt-16 flex justify-between items-end">
              <div className="text-center">
                <div className="w-48 border-b border-slate-300 mb-2"></div>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                  Customer Signature
                </p>
              </div>
              <div className="text-center">
                <div className="text-sm font-script mb-2 italic text-slate-400">
                  (Authorized Signatory)
                </div>
                <div className="w-48 border-b border-slate-300 mb-2"></div>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                  For MOHA Store
                </p>
              </div>
            </div>
          </div>
          <div className="text-[11px] p-4 text-slate-500 leading-relaxed">
            <h4 className="font-bold text-slate-700 mb-1 uppercase tracking-tighter">
              Return Policy
            </h4>
            <ul className="list-disc pl-4 space-y-1">
              <li>Items must be in unused condition with all tags attached.</li>
              <li>Exchanges are subject to availability of stock.</li>
              <li>No exchanges on customized orders.</li>
              <li>
                Store management reserves the right to refuse exchanges that
                don&apos;t meet policy criteria.
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 p-4 text-center text-[10px] text-slate-400 border-t border-slate-100">
            Thank you for shopping at MOHA. Visit us again! | This is a
            computer-generated invoice.
          </div>
        </div>
      </div>
    </div>
  );
}
