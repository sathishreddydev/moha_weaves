import { generateInvoicePDF, type InvoiceData } from './invoiceGenerator';

// Test function to verify invoice generation
export const testInvoiceGeneration = async () => {
  const testData: InvoiceData = {
    orderId: 'TEST-001',
    customerName: 'Test Customer',
    customerPhone: '+91 98765 43210',
    items: [
      {
        name: 'Beautiful Silk Saree with Traditional Design',
        code: 'SS-001',
        quantity: 2,
        unitPrice: 2500,
        lineAmount: 5000
      },
      {
        name: 'Cotton Casual Saree',
        code: 'CS-002',
        quantity: 1,
        unitPrice: 1500,
        lineAmount: 1500
      }
    ],
    subtotal: 6500,
    discountAmount: 500,
    taxAmount: 1080,
    totalAmount: 7080,
    paymentMode: 'card',
    createdAt: new Date(),
    store: {
      name: 'MOHA WEAVES',
      address: '123 Fashion Street, Textile Market',
      phone: '+91 98765 43210',
      email: 'info@mohaweaves.com'
    }
  };

  try {
    await generateInvoicePDF(testData);
    console.log('Test invoice generated successfully!');
    return true;
  } catch (error) {
    console.error('Test invoice generation failed:', error);
    return false;
  }
};
