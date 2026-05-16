export interface UserPayload {
  userId: string;
  role: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

export interface SocketEvent {
  event: string;
  data: any;
  timestamp: Date;
  userId?: string;
  room?: string;
}

export interface RedisMessage {
  channel: string;
  message: string;
  timestamp: Date;
}

export interface RealtimeEvent {
  type:
    | "user_event"
    | "stock_event"
    | "order_event"
    | "system_event"
    | "filter_event"
    | "product_event"
    | "product_purchased"
    | "order_item_status_updated"
    | "return_status_updated"
    | "product_returned"
    | "product_exchanged"
    | "exchange_status_updated";
  target?: {
    userId?: string;
    role?: string;
    room?: string;
  };
  data?: {
    userId?: string;
    orderId?: string;
    itemId?: string;
    status?: string;
    /** @deprecated use orderId/itemId/userId/status instead */
    returnId?: string;
    /** @deprecated use orderId/itemId/userId/status instead */
    exchangeId?: string;
    [key: string]: any;
  };
  metadata?: {
    source?: string;
    priority?: "low" | "medium" | "high";
    expiresAt?: Date;
  };
}
