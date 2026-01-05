import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

export interface InvoiceData {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    name: string;
    code: string;
    quantity: number;
    unitPrice: number;
    lineAmount: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMode: string;
  createdAt: Date;
  store?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export const generateInvoicePDF = async (data: InvoiceData): Promise<void> => {
  const doc = new jsPDF();
  
  // Page setup
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;
  
  // Brand Header
  let logoLoaded = false;
  try {
    // Try to load the brand logo
    const logoUrl = '/banner.png';
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => {
        try {
          doc.addImage(logoImg, 'PNG', 20, yPosition, 60, 30);
          logoLoaded = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      logoImg.onerror = reject;
      logoImg.src = logoUrl;
      
      // Timeout after 3 seconds
      setTimeout(() => reject(new Error('Logo loading timeout')), 3000);
    });
    
    yPosition += 40;
  } catch (error) {
    console.log('Logo loading failed, using text fallback:', error);
    // If logo fails to load, add brand name as text
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MOHA WEAVES', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Traditional Sarees & Ethnic Wear', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }
  
  // Store Information
  if (data.store) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const storeInfoStartX = logoLoaded ? 20 : pageWidth - 60;
    if (data.store.name) {
      doc.text(data.store.name, storeInfoStartX, yPosition);
      yPosition += 5;
    }
    if (data.store.address) {
      doc.text(data.store.address, storeInfoStartX, yPosition);
      yPosition += 5;
    }
    if (data.store.phone) {
      doc.text(`Phone: ${data.store.phone}`, storeInfoStartX, yPosition);
      yPosition += 5;
    }
    if (data.store.email) {
      doc.text(`Email: ${data.store.email}`, storeInfoStartX, yPosition);
      yPosition += 5;
    }
  }
  
  yPosition += 10;
  
  // Invoice Title and Details
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;
  
  // Invoice Number and Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice #: ${data.orderId}`, 20, yPosition);
  doc.text(`Date: ${new Date(data.createdAt).toLocaleDateString('en-IN')}`, pageWidth - 60, yPosition);
  yPosition += 10;
  
  // Customer Information
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 20, yPosition);
  yPosition += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.text(data.customerName, 20, yPosition);
  yPosition += 5;
  doc.text(data.customerPhone, 20, yPosition);
  yPosition += 10;
  
  // Items Table Header
  const tableStart = yPosition;
  const tableHeaders = ['Item', 'Code', 'Qty', 'Price', 'Total'];
  const columnWidths = [80, 30, 20, 30, 30];
  let xPos = 20;
  
  doc.setFillColor(240, 240, 240);
  doc.rect(20, yPosition, pageWidth - 40, 10, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  tableHeaders.forEach((header, index) => {
    doc.text(header, xPos, yPosition + 7);
    xPos += columnWidths[index];
  });
  
  yPosition += 10;
  
  // Items Table Rows
  doc.setFont('helvetica', 'normal');
  data.items.forEach((item, index) => {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }
    
    xPos = 20;
    
    // Item name (truncate if too long)
    const itemName = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
    doc.text(itemName, xPos, yPosition);
    xPos += columnWidths[0];
    
    // Item code
    doc.text(item.code, xPos, yPosition);
    xPos += columnWidths[1];
    
    // Quantity
    doc.text(item.quantity.toString(), xPos, yPosition, { align: 'center' });
    xPos += columnWidths[2];
    
    // Unit price
    doc.text(formatPrice(item.unitPrice), xPos, yPosition, { align: 'right' });
    xPos += columnWidths[3];
    
    // Line total
    doc.text(formatPrice(item.lineAmount), xPos, yPosition, { align: 'right' });
    
    yPosition += 8;
  });
  
  // Table border
  doc.rect(20, tableStart, pageWidth - 40, yPosition - tableStart);
  
  yPosition += 15;
  
  // Summary Section
  const summaryStartX = pageWidth - 120;
  
  doc.text('Subtotal:', summaryStartX, yPosition);
  doc.text(formatPrice(data.subtotal), pageWidth - 20, yPosition, { align: 'right' });
  yPosition += 8;
  
  if (data.discountAmount > 0) {
    doc.text('Discount:', summaryStartX, yPosition);
    doc.text(`-${formatPrice(data.discountAmount)}`, pageWidth - 20, yPosition, { align: 'right' });
    yPosition += 8;
  }
  
  doc.text('Tax (GST 18%):', summaryStartX, yPosition);
  doc.text(formatPrice(data.taxAmount), pageWidth - 20, yPosition, { align: 'right' });
  yPosition += 8;
  
  // Total
  doc.setFillColor(240, 240, 240);
  doc.rect(summaryStartX - 5, yPosition - 5, 110, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total Amount:', summaryStartX, yPosition);
  doc.text(formatPrice(data.totalAmount), pageWidth - 20, yPosition, { align: 'right' });
  yPosition += 15;
  
  // Payment Information
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Payment Mode: ${data.paymentMode.charAt(0).toUpperCase() + data.paymentMode.slice(1)}`, 20, yPosition);
  yPosition += 15;
  
  // Return Policy Section
  if (yPosition > pageHeight - 80) {
    doc.addPage();
    yPosition = 20;
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Return Policy', 20, yPosition);
  yPosition += 10;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const returnPolicy = [
    '• Items can be returned within 7 days of purchase with original bill and packaging.',
    '• Items must be in unused condition with all tags attached.',
    '• Refunds will be processed in the same mode of payment.',
    '• Exchanges are subject to availability of stock.',
    '• No returns on sale items or customized orders.',
    '• Store management reserves the right to refuse returns that don\'t meet policy criteria.'
  ];
  
  returnPolicy.forEach(line => {
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    const lines = doc.splitTextToSize(line, pageWidth - 40);
    lines.forEach((lineText: string) => {
      doc.text(lineText, 20, yPosition);
      yPosition += 5;
    });
  });
  
  yPosition += 10;
  
  // Footer
  if (yPosition > pageHeight - 40) {
    doc.addPage();
    yPosition = pageHeight - 30;
  }
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Thank you for your business!', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;
  doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, yPosition, { align: 'center' });
  
  // Save the PDF
  const pdfBlob = doc.output('blob');
  const fileName = `invoice_${data.orderId}_${new Date().toISOString().split('T')[0]}.pdf`;
  saveAs(pdfBlob, fileName);
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
};
