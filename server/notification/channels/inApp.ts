import { 
  NotificationChannel,
  NotificationError,
  ChannelNotAvailableError,
  BaseNotification,
  NotificationStatus,
  NotificationRecipient
} from '../types';

export interface InAppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  actionText?: string;
  icon?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
  readAt?: Date;
}

export interface InAppMessage {
  notification: BaseNotification;
  content: string;
  recipients: NotificationRecipient[];
  expiresAt?: Date;
}

export class InAppChannel {
  private notifications: Map<string, InAppNotification[]> = new Map(); // userId -> notifications

  constructor() {
    console.log('📱 In-App notification channel initialized');
  }

  /**
   * Send in-app notification
   */
  async send(message: InAppMessage): Promise<void> {
    try {
      const { notification, content, recipients, expiresAt } = message;

      // Create in-app notifications for each recipient
      for (const recipient of recipients) {
        await this.createInAppNotifications(recipient, notification, content, expiresAt);
      }

      console.log(`📱 In-app notifications created for ${recipients.length} recipients`);

    } catch (error) {
      console.error('❌ Failed to send in-app notification:', error);
      throw new NotificationError(
        `Failed to send in-app notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'IN_APP_SEND_FAILED',
        500,
        { error, message }
      );
    }
  }

  /**
   * Create in-app notifications for recipient
   */
  private async createInAppNotifications(
    recipient: NotificationRecipient,
    baseNotification: BaseNotification,
    content: string,
    expiresAt?: Date
  ): Promise<void> {
    const targetUsers = await this.resolveRecipientToUsers(recipient);

    for (const userId of targetUsers) {
      const inAppNotification: InAppNotification = {
        id: baseNotification.id,
        userId,
        type: baseNotification.event,
        title: this.extractTitle(baseNotification),
        message: content,
        data: baseNotification.data,
        actionUrl: this.extractActionUrl(baseNotification),
        actionText: this.extractActionText(baseNotification),
        icon: this.getIconForEvent(baseNotification.event),
        priority: baseNotification.priority as any,
        read: false,
        createdAt: baseNotification.createdAt,
        expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days default
      };

      // Store notification
      if (!this.notifications.has(userId)) {
        this.notifications.set(userId, []);
      }
      
      const userNotifications = this.notifications.get(userId)!;
      userNotifications.unshift(inAppNotification); // Add to beginning

      // Limit to 100 notifications per user
      if (userNotifications.length > 100) {
        userNotifications.splice(100);
      }
    }
  }

  /**
   * Resolve recipient to user IDs
   */
  private async resolveRecipientToUsers(recipient: NotificationRecipient): Promise<string[]> {
    switch (recipient.type) {
      case 'user':
        return [recipient.id!];
      
      case 'role':
        // In a real implementation, this would query the database
        // For now, return empty array (would be implemented with actual user service)
        return [];
      
      case 'store':
        // In a real implementation, this would query the database for users in the store
        return [];
      
      case 'all':
        // In a real implementation, this would return all active users
        return [];
      
      default:
        return [];
    }
  }

  /**
   * Extract title from notification
   */
  private extractTitle(notification: BaseNotification): string {
    const eventTitles: Record<string, string> = {
      'STOCK_REQUEST_CREATED': 'New Stock Request',
      'STOCK_REQUEST_APPROVED': 'Stock Request Approved',
      'STOCK_REQUEST_REJECTED': 'Stock Request Rejected',
      'LOW_STOCK_ALERT': 'Low Stock Alert',
      'CRITICAL_LOW_STOCK': 'Critical Low Stock',
      'ORDER_CREATED': 'New Order',
      'ORDER_SHIPPED': 'Order Shipped',
      'ORDER_DELIVERED': 'Order Delivered',
      'ORDER_CANCELLED': 'Order Cancelled',
      'USER_REGISTERED': 'New User Registration',
      'USER_PASSWORD_CHANGED': 'Password Changed',
      'SYSTEM_BACKUP_COMPLETED': 'Backup Completed',
      'SYSTEM_MAINTENANCE_SCHEDULED': 'Maintenance Scheduled'
    };

    return eventTitles[notification.event] || 'Notification';
  }

  /**
   * Extract action URL from notification
   */
  private extractActionUrl(notification: BaseNotification): string | undefined {
    const actionUrls: Record<string, string> = {
      'STOCK_REQUEST_CREATED': `/inventory/requests/${notification.data.requestId}`,
      'STOCK_REQUEST_APPROVED': `/inventory/requests/${notification.data.requestId}`,
      'ORDER_CREATED': `/orders/${notification.data.orderId}`,
      'ORDER_SHIPPED': `/orders/${notification.data.orderId}/tracking`,
      'USER_REGISTERED': `/users/${notification.data.userId}`,
      'SYSTEM_BACKUP_COMPLETED': '/admin/backups'
    };

    return actionUrls[notification.event];
  }

  /**
   * Extract action text from notification
   */
  private extractActionText(notification: BaseNotification): string | undefined {
    const actionTexts: Record<string, string> = {
      'STOCK_REQUEST_CREATED': 'View Request',
      'STOCK_REQUEST_APPROVED': 'View Details',
      'ORDER_CREATED': 'View Order',
      'ORDER_SHIPPED': 'Track Order',
      'USER_REGISTERED': 'View Profile',
      'SYSTEM_BACKUP_COMPLETED': 'View Report'
    };

    return actionTexts[notification.event];
  }

  /**
   * Get icon for event type
   */
  private getIconForEvent(event: string): string {
    const icons: Record<string, string> = {
      'STOCK_REQUEST_CREATED': '📦',
      'STOCK_REQUEST_APPROVED': '✅',
      'STOCK_REQUEST_REJECTED': '❌',
      'LOW_STOCK_ALERT': '⚠️',
      'CRITICAL_LOW_STOCK': '🚨',
      'ORDER_CREATED': '🛒',
      'ORDER_SHIPPED': '🚚',
      'ORDER_DELIVERED': '✅',
      'ORDER_CANCELLED': '❌',
      'USER_REGISTERED': '👤',
      'USER_PASSWORD_CHANGED': '🔒',
      'SYSTEM_BACKUP_COMPLETED': '💾',
      'SYSTEM_MAINTENANCE_SCHEDULED': '🔧',
      'PRODUCT_DAMAGED': '💥',
      'INVENTORY_RECONCILIATION_COMPLETED': '🔄'
    };

    return icons[event] || '📢';
  }

  /**
   * Get notifications for user
   */
  async getUserNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<InAppNotification[]> {
    const userNotifications = this.notifications.get(userId) || [];
    
    let filteredNotifications = userNotifications;

    // Filter by read status
    if (options?.unreadOnly) {
      filteredNotifications = filteredNotifications.filter(n => !n.read);
    }

    // Filter expired notifications
    const now = new Date();
    filteredNotifications = filteredNotifications.filter(n => 
      !n.expiresAt || n.expiresAt > now
    );

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    
    return filteredNotifications.slice(offset, offset + limit);
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const userNotifications = this.notifications.get(userId) || [];
    const now = new Date();
    
    return userNotifications.filter(n => 
      !n.read && 
      (!n.expiresAt || n.expiresAt > now)
    ).length;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return false;

    const notification = userNotifications.find(n => n.id === notificationId);
    if (!notification) return false;

    notification.read = true;
    notification.readAt = new Date();
    
    return true;
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return 0;

    const now = new Date();
    let markedCount = 0;

    userNotifications.forEach(notification => {
      if (!notification.read && (!notification.expiresAt || notification.expiresAt > now)) {
        notification.read = true;
        notification.readAt = now;
        markedCount++;
      }
    });

    return markedCount;
  }

  /**
   * Delete notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return false;

    const index = userNotifications.findIndex(n => n.id === notificationId);
    if (index === -1) return false;

    userNotifications.splice(index, 1);
    return true;
  }

  /**
   * Clear all notifications for user
   */
  async clearAllNotifications(userId: string): Promise<number> {
    const userNotifications = this.notifications.get(userId);
    if (!userNotifications) return 0;

    const count = userNotifications.length;
    userNotifications.length = 0;
    
    return count;
  }

  /**
   * Get notification statistics
   */
  async getStats(userId?: string): Promise<{
    total: number;
    unread: number;
    expired: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    let allNotifications: InAppNotification[] = [];

    if (userId) {
      allNotifications = this.notifications.get(userId) || [];
    } else {
      // Get all notifications from all users
      for (const userNotifications of this.notifications.values()) {
        allNotifications.push(...userNotifications);
      }
    }

    const now = new Date();
    const stats = {
      total: allNotifications.length,
      unread: allNotifications.filter(n => !n.read).length,
      expired: allNotifications.filter(n => n.expiresAt && n.expiresAt <= now).length,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>
    };

    // Count by type
    allNotifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [userId, userNotifications] of this.notifications.entries()) {
      const originalLength = userNotifications.length;
      
      // Remove expired notifications
      const activeNotifications = userNotifications.filter(n => 
        !n.expiresAt || n.expiresAt > now
      );
      
      this.notifications.set(userId, activeNotifications);
      cleanedCount += originalLength - activeNotifications.length;
    }

    if (cleanedCount > 0) {
      console.log(`📱 Cleaned up ${cleanedCount} expired in-app notifications`);
    }

    return cleanedCount;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('📱 Shutting down in-app notification channel...');
    // In a real implementation, this would save pending notifications to database
    this.notifications.clear();
  }
}
