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