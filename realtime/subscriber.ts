import { sub } from "./redis"
import { io } from "./socket"
import { RedisMessage, RealtimeEvent } from "./types"

export class RedisSubscriber {
  private subscriptions: Map<string, (message: RedisMessage) => void> = new Map()

  constructor() {
    this.setupRedisSubscriber()
  }

  private setupRedisSubscriber(): void {
    sub.on("message", (channel: string, message: string) => {
      try {
        const parsedMessage: RedisMessage = {
          channel,
          message,
          timestamp: new Date()
        }

        const handler = this.subscriptions.get(channel)
        if (handler) {
          handler(parsedMessage)
        }

        this.handleRealtimeEvent(channel, message)
      } catch (error) {
        console.error(`Error processing Redis message from channel ${channel}:`, error)
      }
    })
  }

  private handleRealtimeEvent(channel: string, message: string): void {
    try {
      const event: RealtimeEvent = JSON.parse(message)

      switch (event.type) {
        case 'user_event':
          this.handleUserUpdate(event)
          break
        case 'filter_event':
          this.handleCategoryCreated(event)
          break
        case 'stock_event':
          this.handleStockUpdate(event)
          break
        case 'order_event':
          this.handleOrderUpdate(event)
          break
        case 'product_event':
          this.handleProductUpdate(event)
          break
        case 'system_event':
          this.handleSystemNotification(event)
          break
        case 'user_order_created':
          this.handleUserOrderCreated(event)
          break
        case 'order_item_status_updated':
          this.handleOrderItemStatusUpdated(event)
          break
        case 'return_status_updated':
          this.handleReturnStatusUpdated(event)
          break
        case 'return_created':
          this.handleReturnCreated(event)
          break
        case 'exchange_created':
          this.handleExchangeCreated(event)
          break
        case 'exchange_status_updated':
          this.handleExchangeStatusUpdated(event)
          break
        default:
          console.warn(`Unknown event type: ${event.type}`)
      }
    } catch (error) {
      console.error(`Error parsing realtime event:`, error)
    }
  }
  private handleUserOrderCreated(event: RealtimeEvent): void {
    io.emit("user_order_created", { type: event.type })
  }

  private handleOrderItemStatusUpdated(event: RealtimeEvent): void {
    const { userId, orderId, itemId, status } = event.data ?? {}
    const payload = { type: event.type, data: { userId, orderId, itemId, status } }

    // Notify the customer who owns the order
    if (userId) {
      io.to(`user:${userId}`).emit("order_item_status_updated", payload)
    }

    // Notify inventory and admin roles so their order lists stay in sync
    io.to("role:inventory").emit("order_item_status_updated", payload)
    io.to("role:admin").emit("order_item_status_updated", payload)
  }

  private handleReturnStatusUpdated(event: RealtimeEvent): void {
    const { returnId, userId, status } = event.data ?? {}
    const payload = { type: event.type, data: { returnId, userId, status } }

    // Notify the customer whose return was updated
    if (userId) {
      io.to(`user:${userId}`).emit("return_status_updated", payload)
    }

    // Notify inventory and admin so their returns list refreshes
    io.to("role:inventory").emit("return_status_updated", payload)
    io.to("role:admin").emit("return_status_updated", payload)
  }

  private handleReturnCreated(event: RealtimeEvent): void {
    const { returnId, userId, orderId } = event.data ?? {}
    const payload = { type: event.type, data: { returnId, userId, orderId } }

    // Notify inventory and admin of the new return request
    io.to("role:inventory").emit("return_created", payload)
    io.to("role:admin").emit("return_created", payload)
  }

  private handleExchangeCreated(event: RealtimeEvent): void {
    const { exchangeId, userId, orderId } = event.data ?? {}
    const payload = { type: event.type, data: { exchangeId, userId, orderId } }

    // Notify inventory and admin of the new exchange request
    io.to("role:inventory").emit("exchange_created", payload)
    io.to("role:admin").emit("exchange_created", payload)
  }

  private handleExchangeStatusUpdated(event: RealtimeEvent): void {
    const { exchangeId, userId, status } = event.data ?? {}
    const payload = { type: event.type, data: { exchangeId, userId, status } }

    // Notify the customer whose exchange was updated
    if (userId) {
      io.to(`user:${userId}`).emit("exchange_status_updated", payload)
    }

    // Notify inventory and admin so their exchanges list refreshes
    io.to("role:inventory").emit("exchange_status_updated", payload)
    io.to("role:admin").emit("exchange_status_updated", payload)
  }
  private handleUserUpdate(event: RealtimeEvent): void {
    const { target } = event

    if (target?.userId) {
      io.to(`user:${target.userId}`).emit("user_event", { type: event.type })
    }

    if (target?.role === "admin" || !target) {
      io.to("role:admin").emit("user_event", { type: event.type })
    }
  }
  private handleCategoryCreated(event: RealtimeEvent): void {
    io.emit("filter_event", { type: event.type })
  }

  private handleStockUpdate(event: RealtimeEvent): void {
    const { target } = event

    if (target?.role === "admin") {
      io.to("role:admin").emit("stock_event", { type: event.type })
    }

    if (target?.userId) {
      io.to(`user:${target.userId}`).emit("stock_event", { type: event.type })
    }

    // Broadcast to all connected clients for general stock updates
    if (!target) {
      io.emit("stock_event", { type: event.type })
    }
  }

  private handleOrderUpdate(event: RealtimeEvent): void {
    const { target } = event

    if (target?.userId) {
      io.to(`user:${target.userId}`).emit("order_event", { type: event.type })
    }

    if (target?.role === "admin") {
      io.to("role:admin").emit("order_event", { type: event.type })
    }
  }

  private handleProductUpdate(event: RealtimeEvent): void {


    io.emit("product_event", { type: event.type })


  }

  private handleSystemNotification(event: RealtimeEvent): void {
    const { target } = event

    if (target?.userId) {
      io.to(`user:${target.userId}`).emit("system_event", { type: event.type })
    } else if (target?.role) {
      io.to(`role:${target.role}`).emit("system_event", { type: event.type })
    } else {
      io.emit("system_event", { type: event.type })
    }
  }

  public subscribe(channel: string, callback: (message: RedisMessage) => void): void {
    this.subscriptions.set(channel, callback)
    sub.subscribe(channel)
  }

  public unsubscribe(channel: string): void {
    this.subscriptions.delete(channel)
    sub.unsubscribe(channel)
  }

  public getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys())
  }

  public close(): void {
    this.subscriptions.clear()
    sub.quit()
  }
}

export const redisSubscriber = new RedisSubscriber()

export const initSubscriber = async () => {

  redisSubscriber.subscribe(
    "realtime",
    (message) => {

      console.log(
        "📡 Redis message:",
        message.channel
      );
    }
  );

  console.log(
    "✅ Redis subscriber initialized"
  );
};