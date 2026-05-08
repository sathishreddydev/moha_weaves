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
  type: 'user_event' | 'stock_event' | 'order_event' | 'system_event' | 'filter_event'
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
