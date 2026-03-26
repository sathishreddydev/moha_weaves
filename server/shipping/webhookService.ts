import crypto from 'crypto';
import { db } from '../db';
import { orders, orderItems, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { NotificationService } from '../services/notificationService';

export interface WebhookEvent {
  event: string;
  data: any;
  timestamp: string;
  signature?: string;
}

export interface DelhiveryWebhookPayload {
  waybill: string;
  order_id: string;
  status: string;
  status_code: string;
  status_datetime: string;
  location: string;
  remarks?: string;
  edd?: string;
  additional_info?: Record<string, any>;
}

export class WebhookService {
  private static readonly DELHIVERY_WEBHOOK_SECRET = process.env.DELHIVERY_WEBHOOK_SECRET || 'default-secret';

  /**
   * Verify Delhivery webhook signature
   */
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.DELHIVERY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Handle Delhivery status update webhook
   */
  static async handleDelhiveryStatusUpdate(payload: DelhiveryWebhookPayload): Promise<void> {
    try {
      console.log(`📦 Received Delhivery webhook for waybill: ${payload.waybill}, status: ${payload.status}`);

      // Find order by waybill with user details
      const orderResult = await db
        .select({
          id: orders.id,
          userId: orders.userId,
          delhiveryWaybill: orders.delhiveryWaybill,
          delhiveryStatus: orders.delhiveryStatus,
          shippingAddress: orders.shippingAddress,
          phone: orders.phone,
          email: orders.email,
          customerName: users.name
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(eq(orders.delhiveryWaybill, payload.waybill));

      if (orderResult.length === 0) {
        console.log(`⚠️ No order found for waybill: ${payload.waybill}`);
        return;
      }

      const order = orderResult[0];

      // Update order status
      await db
        .update(orders)
        .set({
          delhiveryStatus: payload.status,
          updatedAt: new Date()
        })
        .where(eq(orders.id, order.id));

      // Update order items status based on Delhivery status
      const itemStatus = this.mapDelhiveryStatusToItemStatus(payload.status);
      if (itemStatus) {
        await db
          .update(orderItems)
          .set({
            status: itemStatus,
            updatedAt: new Date()
          })
          .where(eq(orderItems.orderId, order.id));
      }

      // Send notifications based on status
      await this.handleStatusNotifications(order, payload);

      console.log(`✅ Updated order ${order.id} status to ${payload.status}`);

    } catch (error) {
      console.error(`❌ Failed to handle Delhivery webhook:`, error);
      throw error;
    }
  }

  /**
   * Map Delhivery status to internal item status
   */
  private static mapDelhiveryStatusToItemStatus(delhiveryStatus: string): string | null {
    const statusMap: Record<string, string> = {
      'Manifested': 'confirmed',
      'Dispatched': 'dispatched',
      'In Transit': 'in_transit',
      'Out for Delivery': 'out_for_delivery',
      'Delivered': 'delivered',
      'RTO Initiated': 'rto_initiated',
      'NDR Pending': 'ndr_pending',
      'Cancelled': 'cancelled'
    };

    return statusMap[delhiveryStatus] || null;
  }

  /**
   * Handle notifications based on status updates
   */
  private static async handleStatusNotifications(
    order: any,
    payload: DelhiveryWebhookPayload
  ): Promise<void> {
    const notificationData = {
      orderId: order.id,
      customerName: order.customerName || "Customer",
      phone: order.phone,
      email: order.email || undefined,
      waybill: payload.waybill,
      estimatedDelivery: payload.edd
    };

    try {
      switch (payload.status) {
        case 'Dispatched':
          await NotificationService.notifyOrderDispatched(notificationData);
          break;

        case 'In Transit':
          await NotificationService.notifyOrderInTransit(notificationData);
          break;

        case 'Out for Delivery':
          await NotificationService.notifyOrderOutForDelivery(notificationData);
          break;

        case 'Delivered':
          await NotificationService.notifyOrderDelivered(notificationData);
          break;

        case 'RTO Initiated':
          await NotificationService.notifyOrderRTOInitiated(notificationData);
          break;

        case 'NDR Pending':
          await NotificationService.notifyOrderNDRPending(notificationData, payload.remarks);
          break;

        default:
          console.log(`ℹ️ No notification handler for status: ${payload.status}`);
      }
    } catch (notificationError) {
      console.error(`❌ Failed to send notification for order ${order.id}:`, notificationError);
      // Don't throw error - webhook should still succeed even if notification fails
    }
  }

  /**
   * Handle pickup scheduled webhook
   */
  static async handlePickupScheduled(payload: DelhiveryWebhookPayload): Promise<void> {
    try {
      console.log(`🚚 Pickup scheduled for waybill: ${payload.waybill}`);

      // Update order pickup status
      await db
        .update(orders)
        .set({
          pickupScheduled: true,
          updatedAt: new Date()
        })
        .where(eq(orders.delhiveryWaybill, payload.waybill));

      // Send pickup notification
      const orderResult = await db
        .select({
          id: orders.id,
          phone: orders.phone,
          email: orders.email,
          customerName: users.name
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(eq(orders.delhiveryWaybill, payload.waybill));

      if (orderResult.length > 0) {
        const order = orderResult[0];
        await NotificationService.notifyPickupScheduled({
          orderId: order.id,
          customerName: order.customerName || "Customer",
          phone: order.phone,
          email: order.email || undefined,
          waybill: payload.waybill
        });
      }

    } catch (error) {
      console.error(`❌ Failed to handle pickup scheduled webhook:`, error);
      throw error;
    }
  }

  /**
   * Handle delivery exception webhook
   */
  static async handleDeliveryException(payload: DelhiveryWebhookPayload): Promise<void> {
    try {
      console.log(`⚠️ Delivery exception for waybill: ${payload.waybill}, reason: ${payload.remarks}`);

      // Update order with exception info
      await db
        .update(orders)
        .set({
          delhiveryStatus: 'exception',
          updatedAt: new Date()
        })
        .where(eq(orders.delhiveryWaybill, payload.waybill));

      // Notify admin about delivery exception
      const orderResult = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.delhiveryWaybill, payload.waybill));

      if (orderResult.length > 0) {
        await NotificationService.notifyDeliveryException(
          orderResult[0].id,
          new Error(payload.remarks || 'Delivery exception occurred')
        );
      }

    } catch (error) {
      console.error(`❌ Failed to handle delivery exception webhook:`, error);
      throw error;
    }
  }

  /**
   * Process webhook event
   */
  static async processWebhook(event: string, payload: any): Promise<void> {
    try {
      switch (event) {
        case 'status_update':
          await this.handleDelhiveryStatusUpdate(payload);
          break;

        case 'pickup_scheduled':
          await this.handlePickupScheduled(payload);
          break;

        case 'delivery_exception':
          await this.handleDeliveryException(payload);
          break;

        default:
          console.log(`ℹ️ Unknown webhook event: ${event}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process webhook event ${event}:`, error);
      throw error;
    }
  }

  /**
   * Log webhook for debugging
   */
  static logWebhook(event: string, payload: any, signature?: string): void {
    console.log(`📥 Webhook Received:`, {
      event,
      timestamp: new Date().toISOString(),
      signature: signature ? `${signature.substring(0, 20)}...` : 'none',
      payload: {
        waybill: payload.waybill,
        order_id: payload.order_id,
        status: payload.status,
        status_datetime: payload.status_datetime
      }
    });
  }
}
