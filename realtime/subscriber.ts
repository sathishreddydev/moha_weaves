import { sub } from "./redis";
import { getIO } from "./socket";
import { RedisMessage, RealtimeEvent } from "./types";

export class RedisSubscriber {
  private subscriptions: Map<string, (message: RedisMessage) => void> =
    new Map();

  constructor() {
    this.setupRedisSubscriber();
  }

  private setupRedisSubscriber(): void {
    sub.on("message", (channel: string, message: string) => {
      try {
        // Route the event to the appropriate Socket.io handler
        this.handleRealtimeEvent(channel, message);

        // Also invoke any per-channel callbacks registered via subscribe()
        const handler = this.subscriptions.get(channel);
        if (handler) {
          handler({ channel, message, timestamp: new Date() });
        }
      } catch (error) {
        console.error(
          `Error processing Redis message from channel ${channel}:`,
          error,
        );
      }
    });
  }

  private handleRealtimeEvent(_channel: string, message: string): void {
    try {
      const event: RealtimeEvent = JSON.parse(message);
      switch (event.type) {
        case "user_event":
          this.handleUserUpdate(event);
          break;
        case "filter_event":
          this.handleCategoryCreated(event);
          break;
        case "stock_event":
          this.handleStockUpdate(event);
          break;
        case "order_event":
          this.handleOrderUpdate(event);
          break;
        case "product_event":
          this.handleProductUpdate(event);
          break;
        case "system_event":
          this.handleSystemNotification(event);
          break;
        case "product_purchased":
          this.handleProductPurchased(event);
          break;
        case "order_item_status_updated":
          this.handleOrderItemStatusUpdated(event);
          break;
        case "return_status_updated":
          this.handleReturnStatusUpdated(event);
          break;
        case "product_returned":
          this.handleReturnCreated(event);
          break;
        case "product_exchanged":
          this.handleExchangeCreated(event);
          break;
        case "exchange_status_updated":
          this.handleExchangeStatusUpdated(event);
          break;
        default:
          console.warn(`Unknown event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error parsing realtime event:`, error);
    }
  }
  private handleProductPurchased(event: RealtimeEvent): void {
    const { productId, variantId } = event.data ?? {};
    const payload = { productId, variantId: variantId ?? null };

    // Notify admin & inventory so their dashboards/orders/products refresh
    getIO().to("role:admin").emit("product_purchased", payload);
    getIO().to("role:inventory").emit("product_purchased", payload);

    // Notify anyone viewing this product page so stock updates live
    if (productId) {
      getIO().to(`product:${productId}`).emit("product_purchased", payload);
    }
  }

  private handleOrderItemStatusUpdated(event: RealtimeEvent): void {
    const { userId, orderId, itemId, status } = event.data ?? {};
    const payload = {
      type: event.type,
      data: { userId, orderId, itemId, status },
    };
    // Notify the customer who owns the order
    if (userId) {
      getIO().to(`user:${userId}`).emit("order_item_status_updated", payload);
    }

    // Notify inventory and admin roles so their order lists stay in sync
    getIO().to("role:inventory").emit("order_item_status_updated", payload);
    getIO().to("role:admin").emit("order_item_status_updated", payload);
  }

  private handleReturnStatusUpdated(event: RealtimeEvent): void {
    const { returnId, userId, status } = event.data ?? {};
    const payload = { type: event.type, data: { returnId, userId, status } };

    // Notify the customer whose return was updated
    if (userId) {
      getIO().to(`user:${userId}`).emit("return_status_updated", payload);
    }

    // Notify inventory and admin so their returns list refreshes
    getIO().to("role:inventory").emit("return_status_updated", payload);
    getIO().to("role:admin").emit("return_status_updated", payload);
  }

  private handleReturnCreated(event: RealtimeEvent): void {
    const { orderId, itemId, userId, status } = event.data ?? {};
    const payload = { type: event.type, data: { orderId, itemId, userId, status } };

    // Notify inventory and admin of the new return request
    getIO().to("role:inventory").emit("product_returned", payload);
    getIO().to("role:admin").emit("product_returned", payload);

    // Notify the customer so their order page can reflect the new status
    if (userId) {
      getIO().to(`user:${userId}`).emit("product_returned", payload);
    }
  }

  private handleExchangeCreated(event: RealtimeEvent): void {
    const { orderId, itemId, userId, status } = event.data ?? {};
    const payload = { type: event.type, data: { orderId, itemId, userId, status } };

    // Notify inventory and admin of the new exchange request
    getIO().to("role:inventory").emit("product_exchanged", payload);
    getIO().to("role:admin").emit("product_exchanged", payload);

    // Notify the customer so their order page can reflect the new status
    if (userId) {
      getIO().to(`user:${userId}`).emit("product_exchanged", payload);
    }
  }

  private handleExchangeStatusUpdated(event: RealtimeEvent): void {
    const { exchangeId, userId, status } = event.data ?? {};
    const payload = { type: event.type, data: { exchangeId, userId, status } };

    // Notify the customer whose exchange was updated
    if (userId) {
      getIO().to(`user:${userId}`).emit("exchange_status_updated", payload);
    }

    // Notify inventory and admin so their exchanges list refreshes
    getIO().to("role:inventory").emit("exchange_status_updated", payload);
    getIO().to("role:admin").emit("exchange_status_updated", payload);
  }
  private handleUserUpdate(event: RealtimeEvent): void {
    const { target } = event;

    if (target?.userId) {
      getIO()
        .to(`user:${target.userId}`)
        .emit("user_event", { type: event.type });
    }

    if (target?.role === "admin" || !target) {
      getIO().to("role:admin").emit("user_event", { type: event.type });
      getIO().to("role:inventory").emit("user_event", { type: event.type });
    }
  }
  private handleCategoryCreated(event: RealtimeEvent): void {
    getIO().emit("filter_event", { type: event.type });
  }

  private handleStockUpdate(event: RealtimeEvent): void {
    const { target } = event;

    if (target?.role === "admin") {
      getIO().to("role:admin").emit("stock_event", { type: event.type });
    }

    if (target?.userId) {
      getIO()
        .to(`user:${target.userId}`)
        .emit("stock_event", { type: event.type });
    }

    // Broadcast to all connected clients for general stock updates
    if (!target) {
      getIO().emit("stock_event", { type: event.type });
    }
  }

  private handleOrderUpdate(event: RealtimeEvent): void {
    const { target } = event;

    if (target?.userId) {
      getIO()
        .to(`user:${target.userId}`)
        .emit("order_event", { type: event.type });
    }

    if (target?.role === "admin") {
      getIO().to("role:admin").emit("order_event", { type: event.type });
    }
  }

  private handleProductUpdate(event: RealtimeEvent): void {
    // Broadcast to all clients — product changes (price, images, etc.) are public
    getIO().emit("product_event", { type: event.type });
  }

  private handleSystemNotification(event: RealtimeEvent): void {
    const { target } = event;

    if (target?.userId) {
      getIO()
        .to(`user:${target.userId}`)
        .emit("system_event", { type: event.type });
    } else if (target?.role) {
      getIO()
        .to(`role:${target.role}`)
        .emit("system_event", { type: event.type });
    } else {
      getIO().emit("system_event", { type: event.type });
    }
  }

  public subscribe(
    channel: string,
    callback?: (message: RedisMessage) => void,
  ): void {
    if (callback) {
      this.subscriptions.set(channel, callback);
    }
    sub.subscribe(channel);
  }

  public unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
    sub.unsubscribe(channel);
  }

  public getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  public close(): void {
    this.subscriptions.clear();
    sub.quit();
  }
}

export const redisSubscriber = new RedisSubscriber();

export const initSubscriber = async () => {
  // Subscribe to the "realtime" Redis channel.
  // All routing is handled centrally in handleRealtimeEvent — no per-channel
  // callback is needed here.
  redisSubscriber.subscribe("realtime");

  console.log("✅ Redis subscriber initialized");
};
