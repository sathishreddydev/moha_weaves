import { db } from "../db";
import { orders, users } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface NotificationData {
  orderId: string;
  customerName: string;
  phone: string;
  email?: string;
  waybill?: string;
  estimatedDelivery?: string;
  error?: string;
}

export class NotificationService {
  
  /**
   * Send order confirmation notification
   */
  static async sendOrderConfirmation(orderId: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      const notificationData: NotificationData = {
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        email: order.email
      };

      // Send SMS
      await this.sendSMS(notificationData, 'order_confirmation');
      
      // Send Email (if available)
      if (order.email) {
        await this.sendEmail(notificationData, 'order_confirmation');
      }

      console.log(`✅ Order confirmation sent for ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send order confirmation for ${orderId}:`, error);
    }
  }

  /**
   * Send shipping confirmation notification
   */
  static async sendShippingConfirmation(orderId: string, waybill: string, estimatedDelivery?: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      const notificationData: NotificationData = {
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        email: order.email,
        waybill,
        estimatedDelivery
      };

      // Send SMS with tracking details
      await this.sendSMS(notificationData, 'shipping_confirmation');
      
      // Send Email with tracking details
      if (order.email) {
        await this.sendEmail(notificationData, 'shipping_confirmation');
      }

      // Update order to mark customer as notified
      await db
        .update(orders)
        .set({ customerNotified: true })
        .where(eq(orders.id, orderId));

      console.log(`✅ Shipping confirmation sent for ${orderId} with waybill ${waybill}`);
    } catch (error) {
      console.error(`❌ Failed to send shipping confirmation for ${orderId}:`, error);
    }
  }

  /**
   * Send delivery confirmation notification
   */
  static async sendDeliveryConfirmation(orderId: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      const notificationData: NotificationData = {
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        email: order.email
      };

      await this.sendSMS(notificationData, 'delivery_confirmation');
      
      if (order.email) {
        await this.sendEmail(notificationData, 'delivery_confirmation');
      }

      console.log(`✅ Delivery confirmation sent for ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send delivery confirmation for ${orderId}:`, error);
    }
  }

  /**
   * Notify admin about manual intervention required
   */
  static async notifyManualInterventionRequired(orderId: string, error: Error) {
    try {
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) return;

      await this.sendNotification({
        type: 'email',
        recipient: 'admin@mohaweaves.com', // Should be configurable
        subject: `Manual Intervention Required - Order ${orderId}`,
        message: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">⚠️ Manual Intervention Required</h2>
            <p>Automatic shipping failed for order <strong>${orderId}</strong></p>
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Order Details:</h3>
              <ul>
                <li>Customer: ${orderDetails.customerName}</li>
                <li>Phone: ${orderDetails.phone}</li>
                <li>Email: ${orderDetails.email || 'N/A'}</li>
              </ul>
            </div>
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Error Details:</h3>
              <p style="color: #dc2626; font-family: monospace;">${error.message}</p>
            </div>
            <p>Please review this order and process it manually.</p>
            <a href="${process.env.ADMIN_URL || 'http://localhost:5000'}/admin/orders/${orderId}" 
               style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Review Order
            </a>
          </div>
        `
      });
    } catch (error) {
      console.error('Failed to notify admin about manual intervention:', error);
    }
  }

  /**
   * Notify about delivery exception
   */
  static async notifyDeliveryException(orderId: string, error: Error) {
    try {
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) return;

      await this.sendNotification({
        type: 'email',
        recipient: 'admin@mohaweaves.com',
        subject: `Delivery Exception - Order ${orderId}`,
        message: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">🚚 Delivery Exception</h2>
            <p>A delivery exception occurred for order <strong>${orderId}</strong></p>
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Order Details:</h3>
              <ul>
                <li>Customer: ${orderDetails.customerName}</li>
                <li>Phone: ${orderDetails.phone}</li>
                <li>Email: ${orderDetails.email || 'N/A'}</li>
              </ul>
            </div>
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Exception Details:</h3>
              <p style="color: #dc2626; font-family: monospace;">${error.message}</p>
            </div>
            <p>Please contact the customer and arrange for redelivery.</p>
          </div>
        `
      });
    } catch (error) {
      console.error('Failed to notify about delivery exception:', error);
    }
  }

  /**
   * Notify order dispatched
   */
  static async notifyOrderDispatched(data: NotificationData) {
    try {
      await this.sendNotification({
        type: 'email',
        recipient: data.email,
        subject: `Your Order ${data.orderId} Has Been Dispatched! 🚚`,
        message: this.getOrderDispatchedEmail(data)
      });

      if (data.phone) {
        await this.sendNotification({
          type: 'sms',
          recipient: data.phone,
          message: `Your order ${data.orderId} has been dispatched! Track with waybill: ${data.waybill}. Expected delivery: ${data.estimatedDelivery || '3-5 business days'}`
        });
      }
    } catch (error) {
      console.error('Failed to send order dispatched notification:', error);
    }
  }

  /**
   * Notify order in transit
   */
  static async notifyOrderInTransit(data: NotificationData) {
    try {
      await this.sendNotification({
        type: 'email',
        recipient: data.email,
        subject: `Your Order ${data.orderId} is In Transit! 📦`,
        message: this.getOrderInTransitEmail(data)
      });

      if (data.phone) {
        await this.sendNotification({
          type: 'sms',
          recipient: data.phone,
          message: `Your order ${data.orderId} is now in transit and will reach you soon! Track: ${data.waybill}`
        });
      }
    } catch (error) {
      console.error('Failed to send order in transit notification:', error);
    }
  }

  /**
   * Notify order out for delivery
   */
  static async notifyOrderOutForDelivery(data: NotificationData) {
    try {
      await this.sendNotification({
        type: 'email',
        recipient: data.email,
        subject: `Your Order ${data.orderId} is Out for Delivery! 🏠`,
        message: this.getOrderOutForDeliveryEmail(data)
      });

      if (data.phone) {
        await this.sendNotification({
          type: 'sms',
          recipient: data.phone,
          message: `Your order ${data.orderId} is out for delivery today! Expect delivery shortly. Track: ${data.waybill}`
        });
      }
    } catch (error) {
      console.error('Failed to send order out for delivery notification:', error);
    }
  }

  /**
   * Notify order delivered
   */
  static async notifyOrderDelivered(data: NotificationData) {
    try {
      await this.sendNotification({
        type: 'email',
        recipient: data.email,
        subject: `Your Order ${data.orderId} Has Been Delivered! 🎉`,
        message: this.getOrderDeliveredEmail(data)
      });

      if (data.phone) {
        await this.sendNotification({
          type: 'sms',
          recipient: data.phone,
          message: `Your order ${data.orderId} has been successfully delivered! Thank you for shopping with Moha Weaves.`
        });
      }
    } catch (error) {
      console.error('Failed to send order delivered notification:', error);
    }
  }

  /**
   * Notify RTO initiated
   */
  static async notifyOrderRTOInitiated(data: NotificationData) {
    try {
      await this.sendNotification({
        type: 'email',
        recipient: data.email,
        subject: `Update on Your Order ${data.orderId} - Return to Origin`,
        message: this.getRTOInitiatedEmail(data)
      });

      if (data.phone) {
        await this.sendNotification({
          type: 'sms',
          recipient: data.phone,
          message: `Your order ${data.orderId} is being returned to our warehouse. Our team will contact you soon.`
        });
      }
    } catch (error) {
      console.error('Failed to send RTO initiated notification:', error);
    }
  }

  /**
   * Notify NDR pending
   */
  static async notifyOrderNDRPending(data: NotificationData, remarks?: string) {
    try {
      await this.sendNotification({
        type: 'email',
        recipient: data.email,
        subject: `Action Required for Your Order ${data.orderId} - Delivery Attempted`,
        message: this.getNDRPendingEmail(data, remarks)
      });

      if (data.phone) {
        await this.sendNotification({
          type: 'sms',
          recipient: data.phone,
          message: `Delivery attempt failed for order ${data.orderId}. Please contact customer support or ensure address is correct.`
        });
      }
    } catch (error) {
      console.error('Failed to send NDR pending notification:', error);
    }
  }

  /**
   * Notify pickup scheduled
   */
  static async notifyPickupScheduled(data: NotificationData) {
    try {
      await this.sendNotification({
        type: 'email',
        recipient: data.email,
        subject: `Pickup Scheduled for Your Order ${data.orderId} 📦`,
        message: this.getPickupScheduledEmail(data)
      });

      if (data.phone) {
        await this.sendNotification({
          type: 'sms',
          recipient: data.phone,
          message: `Pickup scheduled for your order ${data.orderId}. Our courier partner will collect the package soon.`
        });
      }
    } catch (error) {
      console.error('Failed to send pickup scheduled notification:', error);
    }
  }

  /**
   * Send SMS notification
   */
  private static async sendSMS(data: NotificationData, type: string): Promise<void> {
    try {
      let message = '';
      
      switch (type) {
        case 'order_confirmation':
          message = `Dear ${data.customerName}, your order #${data.orderId} has been confirmed. Thank you for shopping with Moha Weaves!`;
          break;
          
        case 'shipping_confirmation':
          message = `Dear ${data.customerName}, your order #${data.orderId} has been shipped! Waybill: ${data.waybill}. Track: https://delhivery.com/track/#/${data.waybill}. Expected delivery: ${data.estimatedDelivery || '3-4 days'}`;
          break;
          
        case 'delivery_confirmation':
          message = `Dear ${data.customerName}, your order #${data.orderId} has been delivered successfully. Please rate your experience!`;
          break;
          
        case 'address_update':
          message = `Dear ${data.customerName}, we've updated your shipping address for order #${data.orderId} to ensure faster delivery. Please contact us if this is incorrect.`;
          break;
          
        default:
          message = `Update regarding your order #${data.orderId}`;
      }

      // TODO: Integrate with actual SMS service (Twilio, etc.)
      console.log(`📱 SMS to ${data.phone}: ${message}`);
      
      // Mock SMS sending
      // await smsService.send(data.phone, message);
      
    } catch (error) {
      console.error(`❌ Failed to send SMS to ${data.phone}:`, error);
    }
  }

  /**
   * Send Email notification
   */
  private static async sendEmail(data: NotificationData, type: string): Promise<void> {
    try {
      let subject = '';
      let htmlBody = '';
      
      switch (type) {
        case 'order_confirmation':
          subject = `Order Confirmed - #${data.orderId}`;
          htmlBody = this.getOrderConfirmationEmail(data);
          break;
          
        case 'shipping_confirmation':
          subject = `Order Shipped - #${data.orderId}`;
          htmlBody = this.getShippingConfirmationEmail(data);
          break;
          
        case 'delivery_confirmation':
          subject = `Order Delivered - #${data.orderId}`;
          htmlBody = this.getDeliveryConfirmationEmail(data);
          break;
          
        case 'address_update':
          subject = `Address Updated - #${data.orderId}`;
          htmlBody = this.getAddressUpdateEmail(data);
          break;
          
        default:
          subject = `Update - Order #${data.orderId}`;
          htmlBody = `<p>There's an update regarding your order #${data.orderId}.</p>`;
      }

      // TODO: Integrate with actual email service (SendGrid, etc.)
      console.log(`📧 Email to ${data.email}: ${subject}`);
      console.log(`📧 HTML: ${htmlBody}`);
      
      // Mock email sending
      // await emailService.send(data.email, subject, htmlBody);
      
    } catch (error) {
      console.error(`❌ Failed to send email to ${data.email}:`, error);
    }
  }

  /**
   * Send admin notification
   */
  private static async sendAdminNotification(data: any): Promise<void> {
    try {
      // TODO: Integrate with admin notification system (Slack, email, etc.)
      console.log(`🚨 Admin Notification: ${JSON.stringify(data)}`);
      
      // Mock admin notification
      // await slackService.send('#alerts', `Manual intervention required for order ${data.orderId}: ${data.error}`);
      
    } catch (error) {
      console.error(`❌ Failed to send admin notification:`, error);
    }
  }

  /**
   * Get order details
   */
  private static async getOrderDetails(orderId: string): Promise<{
    id: string;
    customerName: string;
    phone: string;
    email?: string;
  } | null> {
    const result = await db
      .select({
        id: orders.id,
        customerName: users.name,
        phone: orders.phone,
        email: orders.email
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, orderId));

    const order = result[0];
    if (!order) return null;

    return {
      id: order.id,
      customerName: order.customerName || "Customer",
      phone: order.phone,
      email: order.email || undefined
    };
  }

  /**
   * Email templates
   */
  private static getOrderConfirmationEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Confirmed! 🎉</h2>
        <p>Dear ${data.customerName},</p>
        <p>Thank you for your order! We've received your order #${data.orderId} and it's being processed.</p>
        <p>You'll receive another notification once your order ships.</p>
        <br>
        <p>Thank you for choosing Moha Weaves!</p>
        <p>Team Moha Weaves</p>
      </div>
    `;
  }

  private static getOrderDispatchedEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your Order Has Been Dispatched! 🚚</h2>
        <p>Dear ${data.customerName},</p>
        <p>Great news! Your order has been dispatched and is on its way to you.</p>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Tracking Details:</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Expected Delivery:</strong> ${data.estimatedDelivery || '3-5 business days'}</p>
        </div>
        <p>You can track your order using the waybill number on our website.</p>
      </div>
    `;
  }

  private static getOrderInTransitEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Your Order is In Transit! 📦</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your order is now in transit and moving closer to your location.</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Shipping Update:</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> In Transit</p>
        </div>
        <p>Your beautiful handcrafted saree will reach you soon!</p>
      </div>
    `;
  }

  private static getOrderOutForDeliveryEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Your Order is Out for Delivery! 🏠</h2>
        <p>Dear ${data.customerName},</p>
        <p>Exciting news! Your order is out for delivery today.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Delivery Details:</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Out for Delivery</p>
        </div>
        <p>Please ensure someone is available to receive the package.</p>
      </div>
    `;
  }

  private static getOrderDeliveredEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Your Order Has Been Delivered! 🎉</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your order has been successfully delivered! We hope you love your beautiful handcrafted saree.</p>
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Delivery Confirmation:</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Delivered</p>
        </div>
        <p>Thank you for choosing Moha Weaves! Feel free to share your experience with us.</p>
        <p>Need help? Contact us at support@mohaweaves.com</p>
      </div>
    `;
  }

  private static getRTOInitiatedEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">Update on Your Order - Return to Origin</h2>
        <p>Dear ${data.customerName},</p>
        <p>We were unable to deliver your order and it is being returned to our warehouse.</p>
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Order Details:</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Return to Origin</p>
        </div>
        <p>Our team will contact you shortly to arrange for redelivery or address the issue.</p>
        <p>If you have any questions, please contact us at support@mohaweaves.com</p>
      </div>
    `;
  }

  private static getNDRPendingEmail(data: NotificationData, remarks?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ca8a04;">Action Required - Delivery Attempted</h2>
        <p>Dear ${data.customerName},</p>
        <p>We attempted to deliver your order but were unable to complete the delivery.</p>
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Delivery Details:</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Delivery Attempted</p>
          ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
        </div>
        <p>Please contact our customer support at support@mohaweaves.com or ensure your address is correct for redelivery.</p>
      </div>
    `;
  }

  private static getPickupScheduledEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0ea5e9;">Pickup Scheduled for Your Order! 📦</h2>
        <p>Dear ${data.customerName},</p>
        <p>Good news! Pickup has been scheduled for your order.</p>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Pickup Details:</h3>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Pickup Scheduled</p>
        </div>
        <p>Our courier partner will collect the package soon and you'll receive tracking updates.</p>
      </div>
    `;
  }

  private static getShippingConfirmationEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Shipped! 📦</h2>
        <p>Dear ${data.customerName},</p>
        <p>Great news! Your order #${data.orderId} has been shipped and is on its way.</p>
        <p><strong>Waybill Number:</strong> ${data.waybill}</p>
        <p><strong>Expected Delivery:</strong> ${data.estimatedDelivery || '3-4 days'}</p>
        <p>You can track your package here: <a href="https://delhivery.com/track/#/${data.waybill}">Track Package</a></p>
        <br>
        <p>Thank you for choosing Moha Weaves!</p>
        <p>Team Moha Weaves</p>
      </div>
    `;
  }

  private static getDeliveryConfirmationEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Order Delivered! ✅</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your order #${data.orderId} has been successfully delivered.</p>
        <p>We hope you love your purchase! Please take a moment to share your experience.</p>
        <br>
        <p>Thank you for choosing Moha Weaves!</p>
        <p>Team Moha Weaves</p>
      </div>
    `;
  }

  private static getAddressUpdateEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Address Updated 📍</h2>
        <p>Dear ${data.customerName},</p>
        <p>We've updated your shipping address for order #${data.orderId} to ensure faster delivery.</p>
        <p>If this is incorrect, please contact us immediately.</p>
        <br>
        <p>Thank you for choosing Moha Weaves!</p>
        <p>Team Moha Weaves</p>
      </div>
    `;
  }
}
