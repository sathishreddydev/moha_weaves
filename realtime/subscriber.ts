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
        case 'user_update':
          this.handleUserUpdate(event)
          break
        case 'category_created':
          this.handleCategoryCreated(event)
          break
        case 'stock_update':
          this.handleStockUpdate(event)
          break
        case 'order_update':
          this.handleOrderUpdate(event)
          break
        case 'system_notification':
          this.handleSystemNotification(event)
          break
        default:
          console.warn(`Unknown event type: ${event.type}`)
      }
    } catch (error) {
      console.error(`Error parsing realtime event:`, error)
    }
  }

  private handleUserUpdate(event: RealtimeEvent): void {
    const { payload, target } = event

    if (target?.userId) {
      io.to(`user:${target.userId}`).emit("user.updated", payload)
    }

    if (target?.role === "admin" || !target) {
      io.to("role:admin").emit("user.updated", payload)
    }
  }
  private handleCategoryCreated(event: RealtimeEvent): void {

    const { payload } = event

    io.emit("category.created", payload)
  }

  private handleStockUpdate(event: RealtimeEvent): void {
    const { payload, target } = event

    if (target?.role === "admin") {
      io.to("role:admin").emit("stock.updated", payload)
    }

    if (target?.userId) {
      io.to(`user:${target.userId}`).emit("stock.updated", payload)
    }

    // Broadcast to all connected clients for general stock updates
    if (!target) {
      io.emit("stock.updated", payload)
    }
  }

  private handleOrderUpdate(event: RealtimeEvent): void {
    const { payload, target } = event

    if (target?.userId) {
      io.to(`user:${target.userId}`).emit("order.updated", payload)
    }

    if (target?.role === "admin") {
      io.to("role:admin").emit("order.updated", payload)
    }
  }

  private handleSystemNotification(event: RealtimeEvent): void {
    const { payload, target } = event

    if (target?.userId) {
      io.to(`user:${target.userId}`).emit("system.notification", payload)
    } else if (target?.role) {
      io.to(`role:${target.role}`).emit("system.notification", payload)
    } else {
      io.emit("system.notification", payload)
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