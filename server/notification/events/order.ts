import { NotificationEvent, NotificationChannel, NotificationPriority } from '../types';

// Order module notification events
export const ORDER_EVENTS: NotificationEvent[] = [
  {
    name: 'ORDER_CREATED',
    module: 'order',
    description: 'New order created by customer',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['orderId', 'userId', 'totalAmount', 'items', 'shippingAddress'],
    templateVariables: ['orderId', 'customerName', 'totalAmount', 'itemCount', 'shippingAddress', 'createdAt']
  },
  {
    name: 'ORDER_CONFIRMED',
    module: 'order',
    description: 'Order confirmed and being processed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['orderId', 'userId', 'confirmedBy', 'estimatedDelivery'],
    templateVariables: ['orderId', 'customerName', 'confirmedBy', 'estimatedDelivery', 'confirmedAt']
  },
  {
    name: 'ORDER_SHIPPED',
    module: 'order',
    description: 'Order shipped with tracking information',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['orderId', 'userId', 'trackingNumber', 'carrier', 'shippedBy'],
    templateVariables: ['orderId', 'customerName', 'trackingNumber', 'carrier', 'shippedBy', 'shippedAt', 'estimatedDelivery']
  },
  {
    name: 'ORDER_DELIVERED',
    module: 'order',
    description: 'Order delivered to customer',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['orderId', 'userId', 'deliveredAt', 'deliveredBy'],
    templateVariables: ['orderId', 'customerName', 'deliveredAt', 'deliveredBy']
  },
  {
    name: 'ORDER_CANCELLED',
    module: 'order',
    description: 'Order cancelled by customer or admin',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['orderId', 'userId', 'cancelledBy', 'reason', 'refundAmount'],
    templateVariables: ['orderId', 'customerName', 'cancelledBy', 'reason', 'refundAmount', 'cancelledAt']
  },
  {
    name: 'ORDER_PAYMENT_FAILED',
    module: 'order',
    description: 'Order payment failed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['orderId', 'userId', 'paymentMethod', 'failureReason', 'retryAllowed'],
    templateVariables: ['orderId', 'customerName', 'paymentMethod', 'failureReason', 'retryAllowed', 'failedAt']
  },
  {
    name: 'ORDER_REFUND_INITIATED',
    module: 'order',
    description: 'Refund initiated for order',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['orderId', 'userId', 'refundAmount', 'refundMethod', 'initiatedBy'],
    templateVariables: ['orderId', 'customerName', 'refundAmount', 'refundMethod', 'initiatedBy', 'initiatedAt']
  },
  {
    name: 'ORDER_REFUND_COMPLETED',
    module: 'order',
    description: 'Refund completed for order',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['orderId', 'userId', 'refundAmount', 'refundMethod', 'completedBy'],
    templateVariables: ['orderId', 'customerName', 'refundAmount', 'refundMethod', 'completedBy', 'completedAt']
  },
  {
    name: 'ORDER_RETURN_REQUESTED',
    module: 'order',
    description: 'Return request initiated for order',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['orderId', 'userId', 'returnId', 'items', 'reason'],
    templateVariables: ['orderId', 'customerName', 'returnId', 'items', 'reason', 'requestedAt']
  },
  {
    name: 'ORDER_RETURN_APPROVED',
    module: 'order',
    description: 'Return request approved',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['orderId', 'userId', 'returnId', 'approvedBy', 'refundAmount'],
    templateVariables: ['orderId', 'customerName', 'returnId', 'approvedBy', 'refundAmount', 'approvedAt']
  },
  {
    name: 'ORDER_ITEM_STATUS_UPDATED',
    module: 'order',
    description: 'Individual order item status updated',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['orderId', 'orderItemId', 'userId', 'oldStatus', 'newStatus', 'updatedBy'],
    templateVariables: ['orderId', 'orderItemId', 'productName', 'oldStatus', 'newStatus', 'updatedBy', 'updatedAt']
  },
  {
    name: 'ORDER_PAYMENT_SUCCESS',
    module: 'order',
    description: 'Order payment successful',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['orderId', 'userId', 'paymentMethod', 'amount', 'transactionId'],
    templateVariables: ['orderId', 'customerName', 'paymentMethod', 'amount', 'transactionId', 'paidAt']
  },
  {
    name: 'ORDER_OUT_FOR_DELIVERY',
    module: 'order',
    description: 'Order out for delivery',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['orderId', 'userId', 'deliveryAgent', 'estimatedTime'],
    templateVariables: ['orderId', 'customerName', 'deliveryAgent', 'estimatedTime', 'outForDeliveryAt']
  },
  {
    name: 'ORDER_DELAYED',
    module: 'order',
    description: 'Order delivery delayed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['orderId', 'userId', 'delayReason', 'newEstimatedDelivery'],
    templateVariables: ['orderId', 'customerName', 'delayReason', 'newEstimatedDelivery', 'delayedAt']
  }
];

// Helper functions for order events
export const getOrderEvent = (eventName: string): NotificationEvent | undefined => {
  return ORDER_EVENTS.find(event => event.name === eventName);
};

export const isValidOrderEvent = (eventName: string): boolean => {
  return ORDER_EVENTS.some(event => event.name === eventName);
};

export const getOrderEventNames = (): string[] => {
  return ORDER_EVENTS.map(event => event.name);
};

export const getOrderEventsByPriority = (priority: NotificationPriority): NotificationEvent[] => {
  return ORDER_EVENTS.filter(event => event.defaultPriority === priority);
};

export const getOrderEmailEvents = (): NotificationEvent[] => {
  return ORDER_EVENTS.filter(event => 
    event.defaultChannels.includes(NotificationChannel.EMAIL)
  );
};

export const getOrderUrgentEvents = (): NotificationEvent[] => {
  return ORDER_EVENTS.filter(event => 
    event.defaultPriority === NotificationPriority.URGENT
  );
};

export const getOrderCustomerEvents = (): NotificationEvent[] => {
  return ORDER_EVENTS.filter(event => 
    event.requiredData.includes('userId')
  );
};
