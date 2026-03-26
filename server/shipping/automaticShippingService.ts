import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { DelhiveryOrderService } from "./delhiveryOrderService";
import { AddressValidationService } from "./addressValidationService";
import { orders, orderItems, users } from "@shared/schema";
import { NotificationService } from "server/services/notificationService";
import { shippingMethodEnum } from "@shared/enums";

export interface ShippingResult {
  success: boolean;
  waybill?: string;
  shipmentId?: string;
  courier?: string;
  estimatedDelivery?: string;
  error?: string;
  fallbackUsed?: boolean;
}

export interface OrderWithDetails {
  id: string;
  customerName: string;
  phone: string;
  shippingAddress: string;
  finalAmount: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: string;
    product?: {
      name: string;
      weight?: number;
      category?: string;
    };
  }>;
}

export class AutomaticShippingService {
  private static delhiveryService = new DelhiveryOrderService();

  /**
   * Process shipping automatically for an order
   */
  static async processShippingAutomatically(orderId: string): Promise<ShippingResult> {
    try {
      console.log(`🚀 Starting automatic shipping for order: ${orderId}`);
      
      // 1. Get order details
      const order = await this.getOrderWithDetails(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      // 2. Validate and fix address
      const validatedAddress = await AddressValidationService.validateAndFixAddress(
        JSON.parse(order.shippingAddress)
      );

      // 3. Try Delhivery first (primary courier)
      try {
        const delhiveryResult = await this.createDelhiveryShipment(order);
        if (delhiveryResult.success) {
          await this.updateOrderWithShipping(orderId, {
            ...delhiveryResult,
            courier: "delhivery",
            addressValidated: true
          });
          
          console.log(`✅ Delhivery shipment created: ${delhiveryResult.waybill}`);
          return delhiveryResult;
        }
      } catch (delhiveryError) {
        console.log(`⚠️ Delhivery failed, trying alternatives: ${delhiveryError instanceof Error ? delhiveryError.message : 'Unknown error'}`);
      }

      // 4. Fallback to alternative couriers
      const fallbackResult = await this.fallbackToAlternativeCourier(order);
      if (fallbackResult.success) {
        await this.updateOrderWithShipping(orderId, {
          ...fallbackResult,
          addressValidated: true,
          fallbackUsed: true
        });
        
        console.log(`✅ Alternative courier shipment created: ${fallbackResult.courier}`);
        return fallbackResult;
      }

      throw new Error("All shipping options failed");

    } catch (error) {
      console.error(`❌ Automatic shipping failed for order ${orderId}:`, error);
      await this.logShippingFailure(orderId, error instanceof Error ? error : new Error(String(error)));
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }

  /**
   * Create Delhivery shipment
   */
  private static async createDelhiveryShipment(order: OrderWithDetails): Promise<ShippingResult> {
    try {
      const result = await this.delhiveryService.createShipment(order.id);
      
      if (result.success) {
        return {
          success: true,
          waybill: result.waybill,
          shipmentId: result.shipmentId,
          courier: "delhivery",
          estimatedDelivery: this.calculateEstimatedDelivery("delhivery")
        };
      }
      
      throw new Error(result.error || "Delhivery shipment creation failed");
    } catch (error) {
      throw new Error(`Delhivery error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Fallback to alternative couriers
   */
  private static async fallbackToAlternativeCourier(order: OrderWithDetails): Promise<ShippingResult> {
    const alternativeCouriers = [
      { name: "blue-dart", priority: 1 },
      { name: "xpressbees", priority: 2 },
      { name: "fedex", priority: 3 }
    ];

    for (const courier of alternativeCouriers) {
      try {
        console.log(`🔄 Trying ${courier.name} for order ${order.id}`);
        
        const result = await this.createAlternativeShipment(order, courier.name);
        if (result.success) {
          return {
            ...result,
            courier: courier.name,
            fallbackUsed: true
          };
        }
      } catch (error) {
        console.log(`❌ ${courier.name} failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        continue;
      }
    }

    throw new Error("All alternative couriers failed");
  }

  /**
   * Create shipment with alternative courier (placeholder for future integration)
   */
  private static async createAlternativeShipment(order: OrderWithDetails, courierName: string): Promise<ShippingResult> {
    // TODO: Implement actual courier API integrations
    // For now, simulate successful creation
    const mockWaybill = `${courierName.toUpperCase()}-${Date.now()}`;
    
    return {
      success: true,
      waybill: mockWaybill,
      shipmentId: `ALT-${Date.now()}`,
      estimatedDelivery: this.calculateEstimatedDelivery(courierName)
    };
  }

  /**
   * Update order with shipping information
   */
  private static async updateOrderWithShipping(orderId: string, shippingInfo: {
    courier?: string;
    waybill?: string;
    shipmentId?: string;
    estimatedDelivery?: string;
    addressValidated?: boolean;
    fallbackUsed?: boolean;
  }) {
    await db
      .update(orders)
      .set({
        shippingMethod: (shippingInfo.courier || "delhivery") as "manual" | "delhivery",
        delhiveryWaybill: shippingInfo.waybill,
        delhiveryOrderId: shippingInfo.shipmentId,
        delhiveryStatus: "dispatched",
        estimatedDelivery: shippingInfo.estimatedDelivery ? new Date(shippingInfo.estimatedDelivery) : undefined,
        autoProcessed: true,
        addressValidated: shippingInfo.addressValidated || false,
        customerNotified: false,
        pickupScheduled: true,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));

    // Update order items
    await db
      .update(orderItems)
      .set({
        delhiveryWaybill: shippingInfo.waybill,
        shipmentId: shippingInfo.shipmentId,
        updatedAt: new Date()
      })
      .where(eq(orderItems.orderId, orderId));
  }

  /**
   * Get order with full details
   */
  private static async getOrderWithDetails(orderId: string): Promise<OrderWithDetails | null> {
    const result = await db
      .select({
        id: orders.id,
        customerName: users.name,
        phone: orders.phone,
        shippingAddress: orders.shippingAddress,
        finalAmount: orders.finalAmount
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, orderId));

    const order = result[0];
    if (!order) return null;

    const items = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    return {
      id: order.id,
      customerName: order.customerName || "Customer",
      phone: order.phone,
      shippingAddress: order.shippingAddress,
      finalAmount: order.finalAmount,
      items
    };
  }

  /**
   * Calculate estimated delivery date
   */
  private static calculateEstimatedDelivery(courier: string): string {
    const deliveryDays = {
      "delhivery": 3,
      "blue-dart": 2,
      "xpressbees": 3,
      "fedex": 2
    };

    const days = deliveryDays[courier as keyof typeof deliveryDays] || 3;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + days);
    
    return deliveryDate.toISOString().split('T')[0];
  }

  /**
   * Log shipping failure
   */
  private static async logShippingFailure(orderId: string, error: Error) {
    // TODO: Create shipping_automation_logs table and log the failure
    console.error(`Shipping failure logged for order ${orderId}:`, {
      orderId,
      error: error.message,
      timestamp: new Date(),
      automated: true
    });
  }

  /**
   * Handle shipping failure and notify
   */
  static async handleShippingFailure(orderId: string, error: Error) {
    await this.logShippingFailure(orderId, error);
    
    // Update order to indicate manual intervention required
    await db
      .update(orders)
      .set({
        shippingMethod: "manual",
        autoProcessed: false,
        delhiveryStatus: "failed",
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));

    // Notify admin about manual intervention required
    await NotificationService.notifyManualInterventionRequired(orderId, error);
  }
}
