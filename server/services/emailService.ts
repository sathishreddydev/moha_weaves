import nodemailer from 'nodemailer';

export interface EmailNotification {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  async initialize(): Promise<void> {
    if (!process.env.EMAIL_ENABLED || process.env.EMAIL_ENABLED !== 'true') {
      console.log('📧 Email service is disabled');
      return;
    }

    try {
      console.log(`📧 Connecting to SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
      
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      if (this.transporter) {
        await this.transporter.verify();
        console.log('📧 Email transporter verified and ready to send');
      }
    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
      this.transporter = null;
    }
  }

  async sendEmail(notification: EmailNotification): Promise<void> {
    if (!this.transporter) {
      console.log('📧 Email service not available (transporter is null), skipping email to:', notification.to);
      return;
    }

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Mohaweaves'}" <${process.env.EMAIL_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: notification.to,
        subject: notification.subject,
        html: notification.htmlContent,
        text: notification.textContent || notification.htmlContent.replace(/<[^>]*>/g, ''),
      };

      console.log(`📧 Attempting to send email to: ${notification.to} | Subject: ${notification.subject}`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent successfully! MessageId: ${info.messageId} | To: ${notification.to}`);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  async sendStockRequestNotification(data: {
    type: 'created' | 'approved' | 'rejected';
    stockRequest: any;
    product: any;
    store: any;
    user: any;
  }): Promise<void> {
    const { type, stockRequest, product, store, user } = data;

    let subject: string;
    let htmlContent: string;

    switch (type) {
      case 'created':
        subject = `📦 New Stock Request - ${product.name}`;
        htmlContent = `
          <h2>📦 New Stock Request</h2>
          <p><strong>Store:</strong> ${store.name}</p>
          <p><strong>Product:</strong> ${product.name}</p>
          <p><strong>Quantity:</strong> ${stockRequest.quantity}</p>
          <p><strong>Requested by:</strong> ${user.name}</p>
          <p><strong>Date:</strong> ${new Date(stockRequest.createdAt).toLocaleString()}</p>
          <br>
          <p>Please review and approve this stock request in the inventory dashboard.</p>
        `;
        break;

      case 'approved':
        subject = `✅ Stock Request Approved - ${product.name}`;
        htmlContent = `
          <h2>✅ Stock Request Approved</h2>
          <p><strong>Store:</strong> ${store.name}</p>
          <p><strong>Product:</strong> ${product.name}</p>
          <p><strong>Quantity:</strong> ${stockRequest.quantity}</p>
          <p><strong>Approved by:</strong> ${user.name}</p>
          <p><strong>Date:</strong> ${new Date(stockRequest.updatedAt).toLocaleString()}</p>
          <br>
          <p>Your stock request has been approved and the items will be allocated to your store.</p>
        `;
        break;

      case 'rejected':
        subject = `❌ Stock Request Rejected - ${product.name}`;
        htmlContent = `
          <h2>❌ Stock Request Rejected</h2>
          <p><strong>Store:</strong> ${store.name}</p>
          <p><strong>Product:</strong> ${product.name}</p>
          <p><strong>Quantity:</strong> ${stockRequest.quantity}</p>
          <p><strong>Rejected by:</strong> ${user.name}</p>
          <p><strong>Reason:</strong> ${stockRequest.notes || 'No reason provided'}</p>
          <p><strong>Date:</strong> ${new Date(stockRequest.updatedAt).toLocaleString()}</p>
          <br>
          <p>Your stock request has been rejected. Please contact the inventory team for more information.</p>
        `;
        break;

      default:
        return;
    }

    // Send to inventory/admin email — require the env var, no hardcoded fallback
    const inventoryEmail = process.env.EMAIL_FROM_EMAIL;
    if (!inventoryEmail) {
      console.warn("EMAIL_FROM_EMAIL not set — skipping stock request notification email");
      return;
    }
    await this.sendEmail({
      to: inventoryEmail,
      subject,
      htmlContent
    });
  }

  async sendLowStockAlert(data: {
    product: any;
    currentStock: number;
    threshold: number;
  }): Promise<void> {
    const { product, currentStock, threshold } = data;

    const subject = `⚠️ Low Stock Alert - ${product.name}`;
    const htmlContent = `
      <h2>⚠️ Low Stock Alert</h2>
      <p><strong>Product:</strong> ${product.name}</p>
      <p><strong>Current Stock:</strong> ${currentStock}</p>
      <p><strong>Threshold:</strong> ${threshold}</p>
      <p><strong>Status:</strong> Critical - Please restock soon</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      <br>
      <p>This product is running low on stock. Please consider restocking to avoid inventory shortages.</p>
    `;

    const inventoryEmail = process.env.EMAIL_FROM_EMAIL;
    if (!inventoryEmail) {
      console.warn("EMAIL_FROM_EMAIL not set — skipping low stock alert email");
      return;
    }
    await this.sendEmail({
      to: inventoryEmail,
      subject,
      htmlContent
    });
  }
}

export const emailService = new EmailService();
