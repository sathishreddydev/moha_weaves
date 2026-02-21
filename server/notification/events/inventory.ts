import { NotificationEvent, NotificationChannel, NotificationPriority } from '../types';

// Inventory module notification events
export const INVENTORY_EVENTS: NotificationEvent[] = [
  {
    name: 'STOCK_REQUEST_CREATED',
    module: 'inventory',
    description: 'New stock request created by store',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['requestId', 'productId', 'quantity', 'storeId', 'requestedBy'],
    templateVariables: ['requestId', 'productName', 'quantity', 'storeName', 'requestedBy', 'createdAt']
  },
  {
    name: 'STOCK_REQUEST_APPROVED',
    module: 'inventory',
    description: 'Stock request approved by inventory manager',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['requestId', 'productId', 'quantity', 'approvedBy', 'notes'],
    templateVariables: ['requestId', 'productName', 'quantity', 'approvedBy', 'notes', 'approvedAt']
  },
  {
    name: 'STOCK_REQUEST_REJECTED',
    module: 'inventory',
    description: 'Stock request rejected by inventory manager',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['requestId', 'productId', 'quantity', 'rejectedBy', 'reason'],
    templateVariables: ['requestId', 'productName', 'quantity', 'rejectedBy', 'reason', 'rejectedAt']
  },
  {
    name: 'STOCK_LEVEL_CHANGED',
    module: 'inventory',
    description: 'Product stock level changed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['productId', 'oldStock', 'newStock', 'changeType', 'updatedBy'],
    templateVariables: ['productId', 'productName', 'oldStock', 'newStock', 'changeType', 'updatedBy', 'updatedAt']
  },
  {
    name: 'LOW_STOCK_ALERT',
    module: 'inventory',
    description: 'Product stock level is below threshold',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['productId', 'currentStock', 'threshold', 'storeLocation'],
    templateVariables: ['productId', 'productName', 'currentStock', 'threshold', 'storeLocation', 'alertTime']
  },
  {
    name: 'CRITICAL_LOW_STOCK',
    module: 'inventory',
    description: 'Product stock level is critically low',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
    defaultPriority: NotificationPriority.URGENT,
    requiredData: ['productId', 'currentStock', 'criticalThreshold', 'storeLocation'],
    templateVariables: ['productId', 'productName', 'currentStock', 'criticalThreshold', 'storeLocation', 'alertTime']
  },
  {
    name: 'PRODUCT_CREATED',
    module: 'inventory',
    description: 'New product created in inventory',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.LOW,
    requiredData: ['productId', 'productName', 'category', 'createdBy'],
    templateVariables: ['productId', 'productName', 'category', 'sku', 'createdBy', 'createdAt']
  },
  {
    name: 'PRODUCT_UPDATED',
    module: 'inventory',
    description: 'Product information updated',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['productId', 'updatedFields', 'updatedBy'],
    templateVariables: ['productId', 'productName', 'updatedFields', 'updatedBy', 'updatedAt']
  },
  {
    name: 'PRODUCT_DAMAGED',
    module: 'inventory',
    description: 'Product damage reported',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['productId', 'damageId', 'quantity', 'damageCategory', 'reportedBy', 'storeLocation'],
    templateVariables: ['productId', 'productName', 'damageId', 'quantity', 'damageCategory', 'severity', 'reportedBy', 'storeLocation', 'reportedAt']
  },
  {
    name: 'STOCK_MOVEMENT_CREATED',
    module: 'inventory',
    description: 'Stock movement recorded',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['productId', 'movementType', 'quantity', 'source', 'createdBy'],
    templateVariables: ['productId', 'productName', 'movementType', 'quantity', 'source', 'reference', 'createdBy', 'createdAt']
  },
  {
    name: 'INVENTORY_RECONCILIATION_COMPLETED',
    module: 'inventory',
    description: 'Inventory reconciliation process completed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['reconciliationId', 'productsReconciled', 'discrepanciesFound', 'completedBy'],
    templateVariables: ['reconciliationId', 'productsReconciled', 'discrepanciesFound', 'discrepanciesFixed', 'completedBy', 'completedAt']
  },
  {
    name: 'BATCH_STOCK_UPDATE_COMPLETED',
    module: 'inventory',
    description: 'Batch stock update process completed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['batchId', 'productsUpdated', 'successCount', 'failureCount', 'initiatedBy'],
    templateVariables: ['batchId', 'productsUpdated', 'successCount', 'failureCount', 'initiatedBy', 'completedAt']
  },
  {
    name: 'VARIANT_STOCK_UPDATED',
    module: 'inventory',
    description: 'Product variant stock updated',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['productId', 'variantId', 'size', 'oldStock', 'newStock', 'updatedBy'],
    templateVariables: ['productId', 'productName', 'variantId', 'size', 'oldStock', 'newStock', 'updatedBy', 'updatedAt']
  },
  {
    name: 'STORE_TRANSFER_REQUESTED',
    module: 'inventory',
    description: 'Stock transfer between stores requested',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['transferId', 'productId', 'fromStoreId', 'toStoreId', 'quantity', 'requestedBy'],
    templateVariables: ['transferId', 'productName', 'fromStoreName', 'toStoreName', 'quantity', 'requestedBy', 'requestedAt']
  },
  {
    name: 'STORE_TRANSFER_COMPLETED',
    module: 'inventory',
    description: 'Stock transfer between stores completed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['transferId', 'productId', 'fromStoreId', 'toStoreId', 'quantity', 'completedBy'],
    templateVariables: ['transferId', 'productName', 'fromStoreName', 'toStoreName', 'quantity', 'completedBy', 'completedAt']
  }
];

// Helper function to get inventory event by name
export const getInventoryEvent = (eventName: string): NotificationEvent | undefined => {
  return INVENTORY_EVENTS.find(event => event.name === eventName);
};

// Helper function to check if event is valid for inventory module
export const isValidInventoryEvent = (eventName: string): boolean => {
  return INVENTORY_EVENTS.some(event => event.name === eventName);
};

// Helper function to get all inventory event names
export const getInventoryEventNames = (): string[] => {
  return INVENTORY_EVENTS.map(event => event.name);
};

// Helper function to get events by priority
export const getInventoryEventsByPriority = (priority: NotificationPriority): NotificationEvent[] => {
  return INVENTORY_EVENTS.filter(event => event.defaultPriority === priority);
};

// Helper function to get events that require email notification
export const getInventoryEmailEvents = (): NotificationEvent[] => {
  return INVENTORY_EVENTS.filter(event => 
    event.defaultChannels.includes(NotificationChannel.EMAIL)
  );
};

// Helper function to get urgent inventory events
export const getUrgentInventoryEvents = (): NotificationEvent[] => {
  return INVENTORY_EVENTS.filter(event => 
    event.defaultPriority === NotificationPriority.URGENT
  );
};
