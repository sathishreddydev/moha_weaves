import axios from "axios";
import { db } from "../db";
import { orders, orderItems, shipments, users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Delhivery API Configuration
const DELHIVERY_API_BASE = process.env.DELHIVERY_TEST_URL 
  ? `${process.env.DELHIVERY_TEST_URL}/api/cmu/create.json` 
  : "https://track.delhivery.com/api/cmu/create.json";
// Force production API for testing since staging has issues
const DELHIVERY_API_BASE_PROD = "https://track.delhivery.com/api/cmu/create.json";
const DELHIVERY_TOKEN = process.env.DELHIVERY_API_TOKEN;
const DELHIVERY_CLIENT_NAME = process.env.DELHIVERY_PICKUP_WAREHOUSE || "Urumi Weaves";

// Delhivery Order Creation Interface
interface DelhiveryOrderItem {
  sku: string;
  name: string;
  qty: number;
  price: number;
  weight: number;
}

interface DelhiveryOrderRequest {
  format: string;
  data: {
    shipments: {
      name: string;
      add: string;
      pin: string;
      city: string;
      state: string;
      country: string;
      phone: string;
      order: string;
      payment_mode: string;
      return_pin: string;
      return_city: string;
      return_state: string;
      return_country: string;
      order_date: string;
      total_amount: number;
      seller_add: string;
      seller_name: string;
      seller_pin: string;
      seller_city: string;
      seller_state: string;
      seller_country: string;
      shipping_mode: string;
      products: DelhiveryOrderItem[];
      hsn_code?: string;
      seller_gst_tin?: string;
      client?: string;
      fragile_shipment?: boolean;
      waybill?: string;
      quantity?: number;
    }[];
  };
}

interface DelhiveryOrderResponse {
  success: boolean;
  packages: Array<{
    refnum?: string;
    waybill?: string;
    status?: string;
    error?: string;
  }>;
  error?: string;
}

export class DelhiveryOrderService {
  private apiKey: string;

  constructor() {
    if (!DELHIVERY_TOKEN) {
      throw new Error("DELHIVERY_TOKEN environment variable is required");
    }
    this.apiKey = DELHIVERY_TOKEN;
  }

  /**
   * Create a Delhivery shipment for an order
   */
  async createShipment(orderId: string, itemIds?: string[]): Promise<{
    success: boolean;
    shipmentId?: string;
    waybill?: string;
    error?: string;
  }> {
    try {
      // Get order details with customer name
      const [order] = await db
        .select({
          ...orders,
          customerName: users.name
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(eq(orders.id, orderId));

      if (!order) {
        return { success: false, error: "Order not found" };
      }

      if (order.shippingMethod !== "delhivery") {
        return { success: false, error: "Order shipping method is not delhivery" };
      }

      // Get order items
      let orderItemsList = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      // Filter by specific item IDs if provided
      if (itemIds && itemIds.length > 0) {
        orderItemsList = orderItemsList.filter(item => itemIds.includes(item.id));
      }

      if (orderItemsList.length === 0) {
        return { success: false, error: "No items found for shipment" };
      }

      // Parse shipping address
      const shippingAddress = this.parseShippingAddress(order.shippingAddress);
      
      // Build Delhivery order request
      const delhiveryRequest = this.buildOrderRequest(order, orderItemsList, shippingAddress);

      console.log("Creating Delhivery shipment:", {
        orderId,
        itemCount: orderItemsList.length,
        totalAmount: delhiveryRequest.data.shipments[0].total_amount,
      });

      // Call Delhivery API
      const apiUrl = process.env.DELHIVERY_TEST_URL 
        ? `${process.env.DELHIVERY_TEST_URL}/api/cmu/create.json` 
        : DELHIVERY_API_BASE_PROD;
      
      let response;
      
      if (process.env.DELHIVERY_TEST_URL) {
        // Staging API requires form-encoded format
        const formData = new URLSearchParams();
        formData.append('format', 'json');
        formData.append('data', JSON.stringify(delhiveryRequest.data));
        
        response = await axios.post<DelhiveryOrderResponse>(
          apiUrl,
          formData,
          {
            headers: {
              "Authorization": `Token ${DELHIVERY_TOKEN}`,
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json",
            },
            timeout: 30000,
          }
        );
      } else {
        // Production API uses JSON format
        response = await axios.post<DelhiveryOrderResponse>(
          apiUrl,
          delhiveryRequest,
          {
            headers: {
              "Authorization": `Token ${DELHIVERY_TOKEN}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            timeout: 30000,
          }
        );
      }

      console.log("Delhivery API response:", response.data);

      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error || "Delhivery API returned error",
        };
      }

      // Get the first package result
      const packageResult = response.data.packages[0];
      
      if (packageResult.error) {
        return {
          success: false,
          error: packageResult.error,
        };
      }

      const waybill = packageResult.waybill;
      if (!waybill) {
        return {
          success: false,
          error: "No waybill received from Delhivery",
        };
      }

      // Create shipment record
      const shipmentId = `SHP-${Date.now()}`;
      const [newShipment] = await db.insert(shipments).values({
        id: shipmentId,
        orderId: order.id,
        waybill: waybill,
        status: "processing",
        items: JSON.stringify(itemIds || orderItemsList.map(item => item.id)),
        shippingMethod: "delhivery",
      }).returning();

      // Update order items with waybill and shipment ID
      for (const item of orderItemsList) {
        await db
          .update(orderItems)
          .set({
            delhiveryWaybill: waybill,
            shipmentId: shipmentId,
            updatedAt: new Date(),
          })
          .where(eq(orderItems.id, item.id));
      }

      // Update order with Delhivery info
      await db
        .update(orders)
        .set({
          delhiveryWaybill: waybill,
          delhiveryOrderId: packageResult.refnum,
          delhiveryStatus: "processing",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      console.log("Delhivery shipment created successfully:", {
        shipmentId,
        waybill,
        orderId,
      });

      return {
        success: true,
        shipmentId,
        waybill,
      };

    } catch (error) {
      console.error("Error creating Delhivery shipment:", error);
      
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        return {
          success: false,
          error: `Delhivery API error: ${message}`,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Parse shipping address into components
   */
  private parseShippingAddress(address: string): {
    street: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  } {
    // This is a simple parser - you might want to enhance this
    // based on your address format
    
    // Extract pincode (6 digits)
    const pincodeMatch = address.match(/(\d{6})/);
    const pincode = pincodeMatch ? pincodeMatch[1] : "";
    
    // Extract phone number (10 digits starting with 6-9)
    const phoneMatch = address.match(/([6-9]\d{9})/);
    const phone = phoneMatch ? phoneMatch[1] : "";
    
    // Remove pincode and phone from address to get street/city/state
    let remainingAddress = address
      .replace(pincode, "")
      .replace(phone, "")
      .replace(/\s+/g, " ")
      .trim();
    
    // Simple city/state extraction (you may want to use a proper address parser)
    const parts = remainingAddress.split(",").map(part => part.trim());
    const city = parts[parts.length - 2] || "";
    const state = parts[parts.length - 1] || "";
    const street = parts.slice(0, -2).join(", ") || remainingAddress;

    return {
      street,
      city,
      state,
      pincode,
      phone,
    };
  }

  /**
   * Build Delhivery order request
   */
  private buildOrderRequest(
    order: any,
    orderItemsList: any[],
    shippingAddress: { street: string; city: string; state: string; pincode: string; phone: string }
  ): DelhiveryOrderRequest {
    // Seller information (from environment or config)
    const sellerInfo = {
      name: process.env.SELLER_NAME || "Urumi Weaves",
      address: process.env.SELLER_ADDRESS || "Seller Address",
      pincode: process.env.SELLER_PINCODE || "110001",
      city: process.env.SELLER_CITY || "Delhi",
      state: process.env.SELLER_STATE || "Delhi",
      country: process.env.SELLER_COUNTRY || "India",
      gstTin: process.env.SELLER_GST_TIN || "", // Required for GST
    };

    // Calculate total amount and weight
    const totalAmount = orderItemsList.reduce(
      (sum, item) => sum + (parseFloat(item.price) * item.quantity),
      0
    );
    
    const totalWeight = orderItemsList.reduce(
      (sum, item) => sum + ((item.weight || 0.5) * item.quantity),
      0
    );

    // Build products array with HSN codes
    const products: DelhiveryOrderItem[] = orderItemsList.map(item => ({
      sku: item.productId,
      name: `Product ${item.productId}`,
      qty: item.quantity,
      price: parseFloat(item.price),
      weight: item.weight || 0.5,
    }));

    // Escape special characters in address
    const escapeSpecialChars = (text: string) => {
      return text.replace(/[&%#;\\]/g, '\\$&');
    };

    const shipment = {
      name: order.customerName || "Customer", // Use actual customer name
      add: escapeSpecialChars(shippingAddress.street),
      pin: shippingAddress.pincode,
      city: shippingAddress.city,
      state: shippingAddress.state,
      country: "India",
      phone: shippingAddress.phone,
      order: order.id,
      payment_mode: "Prepaid", // Since payment is done via Razorpay
      return_pin: sellerInfo.pincode,
      return_city: sellerInfo.city,
      return_state: sellerInfo.state,
      return_country: sellerInfo.country,
      order_date: new Date(order.createdAt).toISOString().split('T')[0],
      total_amount: totalAmount,
      seller_add: escapeSpecialChars(sellerInfo.address),
      seller_name: sellerInfo.name,
      seller_pin: sellerInfo.pincode,
      seller_city: sellerInfo.city,
      seller_state: sellerInfo.state,
      seller_country: sellerInfo.country,
      shipping_mode: "Surface", // Could be "Surface" or "Air"
      products,
      quantity: orderItemsList.length,
      // 🆕 Required fields based on documentation
      hsn_code: "62021290", // Default HSN for clothing/textiles
      seller_gst_tin: sellerInfo.gstTin,
      client: DELHIVERY_CLIENT_NAME, // Must match registered client name
      fragile_shipment: false, // Set to true for fragile items
    };

    return {
      format: "json",
      data: {
        shipments: [shipment],
      },
    };
  }

  /**
   * Track shipment status
   */
  async trackShipment(waybill: string): Promise<{
    success: boolean;
    status?: string;
    trackingDetails?: any;
    error?: string;
  }> {
    try {
      const trackingUrl = `https://track.delhivery.com/api/v1/tracking/json/?waybill=${waybill}`;
      
      const response = await axios.get(trackingUrl, {
        headers: {
          "Authorization": `Token ${this.apiKey}`,
        },
        timeout: 15000,
      });

      const data = response.data;
      
      if (data.status_code === 200 && data.response.status) {
        return {
          success: true,
          status: data.response.status,
          trackingDetails: data.response,
        };
      } else {
        return {
          success: false,
          error: data.error || "Failed to track shipment",
        };
      }
    } catch (error) {
      console.error("Error tracking Delhivery shipment:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Tracking failed",
      };
    }
  }

  /**
   * Cancel shipment
   */
  async cancelShipment(waybill: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const cancelUrl = "https://track.delhivery.com/api/cancel/json/";
      
      const response = await axios.post(
        cancelUrl,
        { waybill },
        {
          headers: {
            "Authorization": `Token ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      if (response.data.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.error || "Failed to cancel shipment",
        };
      }
    } catch (error) {
      console.error("Error cancelling Delhivery shipment:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Cancellation failed",
      };
    }
  }
}

// Export singleton instance
export const delhiveryOrderService = new DelhiveryOrderService();
