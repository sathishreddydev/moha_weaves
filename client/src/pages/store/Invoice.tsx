import { ShoppingCart, FileText, Printer, ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export default function Invoice() {
  const location = useLocation();
  const navigate = useNavigate();
  const { saleId } = useParams();
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!saleId) return;
      
      setLoading(true);
      try {
        const res = await apiRequest("GET", `/api/store/receipt/${saleId}`);
        const data = await res.json();
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Invoice Not Found</h2>
          <p className="text-slate-600 mb-4">Invoice data not found. Please check the sale ID or complete a checkout first.</p>
          <button onClick={handleBackToStore} className="text-blue-600 hover:text-blue-800">
            ← Back to Store
          </button>
        </div>
      </div>
    );
  }

  const subtotal = invoiceData.items?.reduce((sum: number, item: any) => sum + item.lineAmount, 0) || 0;
  const discountAmount = invoiceData.discountAmount || 0;
  const taxAmount = invoiceData.taxAmount || 0;
  const totalAmount = invoiceData.totalAmount || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FileText />
          Invoice #{invoiceData.orderId}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            Print Invoice
          </button>
          <button
            onClick={handleBackToStore}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Store
          </button>
        </div>
      </div>

      <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200 print:shadow-none print:border-none">
        {/* Invoice Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-base font-bold text-slate-800">MOHA STORE</p>
              <p className="text-slate-600 text-sx">Fashion & Traditional Wear</p>
              <p className="text-slate-600 text-xs">GSTIN: XXXXXXXXXX</p>
            </div>
            <div className="text-right">
              <h3 className="text-base font-semibold text-slate-800">INVOICE</h3>
              <p className="text-slate-600 text-xs">Invoice #: {invoiceData.orderId}</p>
              <p className="text-slate-600 text-xs">Date: {new Date(invoiceData.createdAt).toLocaleDateString()}</p>
              <p className="text-slate-600 text-xs">Payment: {invoiceData.paymentMode?.toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="p-4 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">BILL TO:</h4>
              <p className="text-slate-600 font-medium">{invoiceData.customerName}</p>
              <p className="text-slate-600">Phone: {invoiceData.customerPhone}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">STORE DETAILS:</h4>
              <p className="text-slate-600">{invoiceData.store?.name || "MOHA Store"}</p>
              <p className="text-slate-600 text-sm">Store ID: {invoiceData.store?.id}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="py-3 font-semibold px-2">SKU ID</th>
                  <th className="py-3 font-semibold px-2">Description</th>
                  <th className="py-3 font-semibold px-2 text-center">Qty</th>
                  <th className="py-3 font-semibold px-2 text-right">Price</th>
                  <th className="py-3 font-semibold px-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoiceData.items?.map((item: any) => (
                  <tr key={item.id} className="group">
                    <td className="py-3 px-2">
                      <span className="font-medium text-slate-700 text-xs">
                        {item.saree?.sku || item.sareeId}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-slate-600 text-xs">
                        {item.saree?.name || "Product"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="w-8 text-center text-xs">{item.quantity}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end">
                        <span className="text-slate-400 mr-1 text-xs">₹</span>
                        <span className="text-xs">{item.unitPrice}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-slate-800 text-xs">
                      ₹{item.lineAmount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

        <div className="bg-slate-50 p-4 text-center text-[10px] text-slate-400 border-t border-slate-100">
          Thank you for shopping at MOHA. Visit us again! | This is a computer-generated invoice.
        </div>
      </div>
    </div>
  );
}
