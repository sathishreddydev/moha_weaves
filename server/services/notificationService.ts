import { db } from "../db";
import { orders, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { emailService } from "./emailService";

export interface NotificationData {
  orderId: string;
  customerName: string;
  phone: string;
  email?: string;
  waybill?: string;
  estimatedDelivery?: string;
  error?: string;
}

interface SendNotificationParams {
  type: 'email' | 'sms';
  recipient?: string;
  subject?: string;
  message: string;
}

export class NotificationService {

  /**
   * Core method that actually sends notifications via emailService
   */
  private static async sendNotification(params: SendNotificationParams): Promise<void> {
    try {
      if (params.type === 'email' && params.recipient) {
        await emailService.sendEmail({
          to: params.recipient,
          subject: params.subject || 'Urumi Weaves Notification',
          htmlContent: params.message,
        });
      } else if (params.type === 'sms') {
        // SMS placeholder - log for now
        console.log(`📱 SMS to ${params.recipient}: ${params.message}`);
      }
    } catch (error) {
      console.error(`❌ Failed to send ${params.type} notification:`, error);
    }
  }

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

      // Send Email
      if (order.email) {
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Order Confirmed - #${order.id}`,
          message: this.getOrderConfirmationEmail(notificationData),
        });
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

      await this.sendSMS(notificationData, 'shipping_confirmation');

      if (order.email) {
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Order Shipped - #${order.id}`,
          message: this.getShippingConfirmationEmail(notificationData),
        });
      }

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
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Order Delivered - #${order.id}`,
          message: this.getDeliveryConfirmationEmail(notificationData),
        });
      }

      console.log(`✅ Delivery confirmation sent for ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send delivery confirmation for ${orderId}:`, error);
    }
  }

  /**
   * Send order cancelled notification
   */
  static async sendOrderCancelled(orderId: string, reason?: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      const notificationData: NotificationData = {
        orderId: order.id,
        customerName: order.customerName,
        phone: order.phone,
        email: order.email
      };

      await this.sendSMS(notificationData, 'order_cancelled');

      if (order.email) {
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Order Cancelled - #${order.id}`,
          message: this.getOrderCancelledEmail(notificationData, reason),
        });
      }

      console.log(`✅ Order cancellation notification sent for ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send cancellation notification for ${orderId}:`, error);
    }
  }

  /**
   * Send return request accepted notification
   */
  static async sendReturnAccepted(orderId: string, returnId: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      if (order.email) {
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Return Request Approved - Order #${order.id}`,
          message: this.getReturnAcceptedEmail({ ...order, orderId: order.id, phone: order.phone }, returnId),
        });
      }

      console.log(`✅ Return accepted notification sent for order ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send return accepted notification:`, error);
    }
  }

  /**
   * Send return rejected notification
   */
  static async sendReturnRejected(orderId: string, returnId: string, reason?: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      if (order.email) {
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Return Request Update - Order #${order.id}`,
          message: this.getReturnRejectedEmail({ ...order, orderId: order.id, phone: order.phone }, returnId, reason),
        });
      }

      console.log(`✅ Return rejected notification sent for order ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send return rejected notification:`, error);
    }
  }

  /**
   * Send return picked up notification
   */
  static async sendReturnPickedUp(orderId: string, returnId: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      if (order.email) {
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Return Pickup Confirmed - Order #${order.id}`,
          message: this.getReturnPickedUpEmail({ ...order, orderId: order.id, phone: order.phone }, returnId),
        });
      }

      console.log(`✅ Return picked up notification sent for order ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send return picked up notification:`, error);
    }
  }

  /**
   * Send refund initiated notification
   */
  static async sendRefundInitiated(orderId: string, amount: string, method?: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      if (order.email) {
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Refund Initiated - Order #${order.id}`,
          message: this.getRefundInitiatedEmail({ ...order, orderId: order.id, phone: order.phone }, amount, method),
        });
      }

      console.log(`✅ Refund initiated notification sent for order ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send refund initiated notification:`, error);
    }
  }

  /**
   * Send refund completed notification
   */
  static async sendRefundCompleted(orderId: string, amount: string, method?: string): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) return;

      if (order.email) {
        await this.sendNotification({
          type: 'email',
          recipient: order.email,
          subject: `Refund Completed - ₹${amount} Credited - Order #${order.id}`,
          message: this.getRefundCompletedEmail({ ...order, orderId: order.id, phone: order.phone }, amount, method),
        });
      }

      console.log(`✅ Refund completed notification sent for order ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send refund completed notification:`, error);
    }
  }

  /**
   * Notify admin about manual intervention required
   */
  static async notifyManualInterventionRequired(orderId: string, error: Error) {
    try {
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) return;

      const adminEmail = process.env.EMAIL_FROM_EMAIL || 'sathishreddy.dev@gmail.com';
      await this.sendNotification({
        type: 'email',
        recipient: adminEmail,
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
          </div>
        `
      });
    } catch (err) {
      console.error('Failed to notify admin about manual intervention:', err);
    }
  }

  /**
   * Notify about delivery exception
   */
  static async notifyDeliveryException(orderId: string, error: Error) {
    try {
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) return;

      const adminEmail = process.env.EMAIL_FROM_EMAIL || 'sathishreddy.dev@gmail.com';
      await this.sendNotification({
        type: 'email',
        recipient: adminEmail,
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
    } catch (err) {
      console.error('Failed to notify about delivery exception:', err);
    }
  }

  /**
   * Notify order dispatched
   */
  static async notifyOrderDispatched(data: NotificationData) {
    try {
      if (data.email) {
        await this.sendNotification({
          type: 'email',
          recipient: data.email,
          subject: `Your Order ${data.orderId} Has Been Dispatched! 🚚`,
          message: this.getOrderDispatchedEmail(data)
        });
      }
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
      if (data.email) {
        await this.sendNotification({
          type: 'email',
          recipient: data.email,
          subject: `Your Order ${data.orderId} is In Transit! 📦`,
          message: this.getOrderInTransitEmail(data)
        });
      }
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
      if (data.email) {
        await this.sendNotification({
          type: 'email',
          recipient: data.email,
          subject: `Your Order ${data.orderId} is Out for Delivery! 🏠`,
          message: this.getOrderOutForDeliveryEmail(data)
        });
      }
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
      if (data.email) {
        await this.sendNotification({
          type: 'email',
          recipient: data.email,
          subject: `Your Order ${data.orderId} Has Been Delivered! 🎉`,
          message: this.getOrderDeliveredEmail(data)
        });
      }
      if (data.phone) {
        await this.sendNotification({
          type: 'sms',
          recipient: data.phone,
          message: `Your order ${data.orderId} has been successfully delivered! Thank you for shopping with Urumi Weaves.`
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
      if (data.email) {
        await this.sendNotification({
          type: 'email',
          recipient: data.email,
          subject: `Update on Your Order ${data.orderId} - Return to Origin`,
          message: this.getRTOInitiatedEmail(data)
        });
      }
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
      if (data.email) {
        await this.sendNotification({
          type: 'email',
          recipient: data.email,
          subject: `Action Required for Your Order ${data.orderId} - Delivery Attempted`,
          message: this.getNDRPendingEmail(data, remarks)
        });
      }
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
      if (data.email) {
        await this.sendNotification({
          type: 'email',
          recipient: data.email,
          subject: `Pickup Scheduled for Your Order ${data.orderId} 📦`,
          message: this.getPickupScheduledEmail(data)
        });
      }
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
   * Send SMS notification (placeholder)
   */
  private static async sendSMS(data: NotificationData, type: string): Promise<void> {
    try {
      let message = '';
      switch (type) {
        case 'order_confirmation':
          message = `Dear ${data.customerName}, your order #${data.orderId} has been confirmed. Thank you for shopping with Urumi Weaves!`;
          break;
        case 'shipping_confirmation':
          message = `Dear ${data.customerName}, your order #${data.orderId} has been shipped! Waybill: ${data.waybill}. Track: https://delhivery.com/track/#/${data.waybill}`;
          break;
        case 'delivery_confirmation':
          message = `Dear ${data.customerName}, your order #${data.orderId} has been delivered successfully. Thank you!`;
          break;
        case 'order_cancelled':
          message = `Dear ${data.customerName}, your order #${data.orderId} has been cancelled. Refund will be processed if applicable.`;
          break;
        default:
          message = `Update regarding your order #${data.orderId}`;
      }
      // TODO: Integrate with SMS provider (Twilio/MSG91)
      console.log(`📱 SMS to ${data.phone}: ${message}`);
    } catch (error) {
      console.error(`❌ Failed to send SMS to ${data.phone}:`, error);
    }
  }

  /**
   * Get order details from DB
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

  // ========================
  // EMAIL TEMPLATES
  // ========================

  private static getOrderConfirmationEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #333; margin-top: 30px;">Order Confirmed! 🎉</h2>
        <p>Dear ${data.customerName},</p>
        <p>Thank you for your order! We've received your order <strong>#${data.orderId}</strong> and it's being processed.</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Status:</strong> Confirmed</p>
        </div>
        <p>You'll receive another notification once your order ships.</p>
        <br>
        <p>Thank you for choosing Urumi Weaves!</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getOrderCancelledEmail(data: NotificationData, reason?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #dc2626; margin-top: 30px;">Order Cancelled</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your order <strong>#${data.orderId}</strong> has been cancelled.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Status:</strong> Cancelled</p>
          <p>If payment was made, your refund will be processed within 5-7 business days.</p>
        </div>
        <p>If you have any questions, please contact us at support@urumiweaves.com</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getReturnAcceptedEmail(data: NotificationData, returnId: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #059669; margin-top: 30px;">Return Request Approved ✅</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your return request for order <strong>#${data.orderId}</strong> has been approved.</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Return ID:</strong> ${returnId}</p>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Next Step:</strong> Pickup will be scheduled soon</p>
        </div>
        <p>Our courier partner will contact you to schedule a pickup. Please keep the item packed and ready.</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getReturnRejectedEmail(data: NotificationData, returnId: string, reason?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #dc2626; margin-top: 30px;">Return Request Update</h2>
        <p>Dear ${data.customerName},</p>
        <p>We're sorry, but your return request for order <strong>#${data.orderId}</strong> could not be approved.</p>
        ${reason ? `<div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;"><p><strong>Reason:</strong> ${reason}</p></div>` : ''}
        <p>If you have questions, please contact us at support@urumiweaves.com</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getReturnPickedUpEmail(data: NotificationData, returnId: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #2563eb; margin-top: 30px;">Return Item Picked Up 📦</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your return item for order <strong>#${data.orderId}</strong> has been picked up successfully.</p>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Return ID:</strong> ${returnId}</p>
          <p><strong>Status:</strong> In Transit to Warehouse</p>
        </div>
        <p>Once we receive and inspect the item, your refund/exchange will be processed.</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getRefundInitiatedEmail(data: NotificationData, amount: string, method?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #7c3aed; margin-top: 30px;">Refund Initiated 💰</h2>
        <p>Dear ${data.customerName},</p>
        <p>We've initiated a refund for your order <strong>#${data.orderId}</strong>.</p>
        <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Refund Amount:</strong> ₹${amount}</p>
          <p><strong>Method:</strong> ${method || 'Original payment method'}</p>
          <p><strong>Expected Timeline:</strong> 5-7 business days</p>
        </div>
        <p>The refund will be credited to your original payment method.</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getRefundCompletedEmail(data: NotificationData, amount: string, method?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #059669; margin-top: 30px;">Refund Completed ✅</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your refund for order <strong>#${data.orderId}</strong> has been successfully processed.</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Amount Refunded:</strong> ₹${amount}</p>
          <p><strong>Credited To:</strong> ${method || 'Original payment method'}</p>
          <p><strong>Status:</strong> Completed</p>
        </div>
        <p>If you don't see the amount in your account within 2-3 business days, please contact your bank.</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getOrderDispatchedEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #2563eb; margin-top: 30px;">Your Order Has Been Dispatched! 🚚</h2>
        <p>Dear ${data.customerName},</p>
        <p>Great news! Your order has been dispatched and is on its way to you.</p>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Expected Delivery:</strong> ${data.estimatedDelivery || '3-5 business days'}</p>
        </div>
        <p>Track your order: <a href="https://www.delhivery.com/track/package/${data.waybill}">Click here</a></p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getOrderInTransitEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #059669; margin-top: 30px;">Your Order is In Transit! 📦</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your order is now in transit and moving closer to your location.</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> In Transit</p>
        </div>
        <p>Your beautiful handcrafted saree will reach you soon!</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getOrderOutForDeliveryEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #7c3aed; margin-top: 30px;">Your Order is Out for Delivery! 🏠</h2>
        <p>Dear ${data.customerName},</p>
        <p>Exciting news! Your order is out for delivery today.</p>
        <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Out for Delivery</p>
        </div>
        <p>Please ensure someone is available to receive the package.</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getOrderDeliveredEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #059669; margin-top: 30px;">Your Order Has Been Delivered! 🎉</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your order has been successfully delivered! We hope you love your beautiful handcrafted saree.</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Status:</strong> Delivered</p>
        </div>
        <p>Thank you for choosing Urumi Weaves! Feel free to share your experience with us.</p>
        <p>Need help? Contact us at support@urumiweaves.com</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getShippingConfirmationEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #2563eb; margin-top: 30px;">Order Shipped! 📦</h2>
        <p>Dear ${data.customerName},</p>
        <p>Great news! Your order <strong>#${data.orderId}</strong> has been shipped.</p>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Waybill Number:</strong> ${data.waybill}</p>
          <p><strong>Expected Delivery:</strong> ${data.estimatedDelivery || '3-4 days'}</p>
        </div>
        <p>Track your package: <a href="https://www.delhivery.com/track/package/${data.waybill}">Click here</a></p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getDeliveryConfirmationEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #059669; margin-top: 30px;">Order Delivered! ✅</h2>
        <p>Dear ${data.customerName},</p>
        <p>Your order <strong>#${data.orderId}</strong> has been successfully delivered.</p>
        <p>We hope you love your purchase! Please take a moment to share your experience.</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getRTOInitiatedEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #ea580c; margin-top: 30px;">Update on Your Order - Return to Origin</h2>
        <p>Dear ${data.customerName},</p>
        <p>We were unable to deliver your order and it is being returned to our warehouse.</p>
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Return to Origin</p>
        </div>
        <p>Our team will contact you shortly to arrange for redelivery.</p>
        <p>Contact us at support@urumiweaves.com</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getNDRPendingEmail(data: NotificationData, remarks?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #ca8a04; margin-top: 30px;">Action Required - Delivery Attempted</h2>
        <p>Dear ${data.customerName},</p>
        <p>We attempted to deliver your order but were unable to complete the delivery.</p>
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Delivery Attempted</p>
          ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
        </div>
        <p>Please ensure your address is correct and someone is available for redelivery.</p>
        <p>Contact us at support@urumiweaves.com</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }

  private static getPickupScheduledEmail(data: NotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px; background: #f8f4f0; border-radius: 8px;">
          <h1 style="color: #8B4513; margin: 0;">Urumi Weaves</h1>
        </div>
        <h2 style="color: #0ea5e9; margin-top: 30px;">Pickup Scheduled! 📦</h2>
        <p>Dear ${data.customerName},</p>
        <p>Pickup has been scheduled for your order.</p>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Waybill:</strong> ${data.waybill}</p>
          <p><strong>Status:</strong> Pickup Scheduled</p>
        </div>
        <p>Our courier partner will collect the package soon.</p>
        <p style="color: #666;">Team Urumi Weaves</p>
      </div>
    `;
  }
}
