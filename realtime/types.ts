export interface UserPayload {
  userId: string
  role: string
  email?: string
  name?: string
  [key: string]: any
}

export interface SocketEvent {
  event: string
  data: any
  timestamp: Date
  userId?: string
  room?: string
}

export interface RedisMessage {
  channel: string
  message: string
  timestamp: Date
}

export interface RealtimeEvent {
  type: 'user_update' | 'stock_update' | 'order_update' | 'system_notification' | 'category_created'
  payload: any
  target?: {
    userId?: string
    role?: string
    room?: string
  }
  metadata?: {
    source?: string
    priority?: 'low' | 'medium' | 'high'
    expiresAt?: Date
  }
}
