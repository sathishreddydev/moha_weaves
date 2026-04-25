import { publishRealtimeEvent } from '../websocket/websocketServer';

// Helper functions for publishing real-time events from API endpoints

export class RealtimeService {
  // Product events
  static productCreated(product: any, userId?: string) {
    publishRealtimeEvent('product', 'create', product, userId);
  }

  static productUpdated(product: any, userId?: string) {
    publishRealtimeEvent('product', 'update', product, userId);
  }

  static productDeleted(productId: string, userId?: string) {
    publishRealtimeEvent('product', 'delete', { id: productId }, userId);
  }

  // Category events
  static categoryCreated(category: any, userId?: string) {
    publishRealtimeEvent('category', 'create', category, userId);
  }

  static categoryUpdated(category: any, userId?: string) {
    publishRealtimeEvent('category', 'update', category, userId);
  }

  static categoryDeleted(categoryId: string, userId?: string) {
    publishRealtimeEvent('category', 'delete', { id: categoryId }, userId);
  }

  // Order events
  static orderCreated(order: any, userId?: string) {
    publishRealtimeEvent('order', 'create', order, userId);
  }

  static orderUpdated(order: any, userId?: string) {
    publishRealtimeEvent('order', 'update', order, userId);
  }

  static orderStatusChanged(orderId: string, status: string, userId?: string) {
    publishRealtimeEvent('order', 'update', { 
      id: orderId, 
      status,
      type: 'status_change'
    }, userId);
  }

  // Inventory events
  static stockChanged(productId: string, stockData: any, userId?: string) {
    publishRealtimeEvent('inventory', 'stock_change', {
      productId,
      ...stockData
    }, userId);
  }

  static stockRequestCreated(request: any, userId?: string) {
    publishRealtimeEvent('inventory', 'create', {
      type: 'stock_request',
      ...request
    }, userId);
  }

  static stockRequestUpdated(request: any, userId?: string) {
    publishRealtimeEvent('inventory', 'update', {
      type: 'stock_request',
      ...request
    }, userId);
  }

  // User events
  static userCreated(user: any, userId?: string) {
    publishRealtimeEvent('user', 'create', user, userId);
  }

  static userUpdated(user: any, userId?: string) {
    publishRealtimeEvent('user', 'update', user, userId);
  }

  static userDeleted(userId: string, deletedBy?: string) {
    publishRealtimeEvent('user', 'delete', { id: userId }, deletedBy);
  }

  // Store events
  static storeCreated(store: any, userId?: string) {
    publishRealtimeEvent('store', 'create', store, userId);
  }

  static storeUpdated(store: any, userId?: string) {
    publishRealtimeEvent('store', 'update', store, userId);
  }

  static storeDeleted(storeId: string, userId?: string) {
    publishRealtimeEvent('store', 'delete', { id: storeId }, userId);
  }

  // Generic bulk update event
  static bulkUpdate(type: 'product' | 'inventory' | 'order', items: any[], userId?: string) {
    publishRealtimeEvent(type, 'update', {
      type: 'bulk_update',
      items,
      count: items.length
    }, userId);
  }
}
