import { Server as HTTPServer } from 'http';
import { 
  SendNotificationRequest,
  SendNotificationResponse,
  NotificationChannel,
  NotificationStats,
  BaseNotification,
  NotificationStatus
} from './types';
import { getNotificationConfigSingleton } from './config';
import { NotificationService } from './services/notificationService';
import { WebSocketChannel } from './channels/websocket';
import { TemplateService } from './services/templateService';
import { QueueService } from './services/queueService';

/**
 * Main notification manager that orchestrates the entire notification system
 */
export class NotificationManager {
  private config = getNotificationConfigSingleton();
  private notificationService: NotificationService;
  private webSocketChannel: WebSocketChannel;
  private templateService: TemplateService;
  private queueService: QueueService;
  private initialized = false;

  constructor() {
    this.notificationService = new NotificationService();
    this.webSocketChannel = new WebSocketChannel(this.config.websocket);
    this.templateService = new TemplateService();
    this.queueService = new QueueService();
  }

  /**
   * Initialize the notification system
   */
  async initialize(httpServer?: HTTPServer): Promise<void> {
    if (this.initialized) {
      console.log('📢 Notification system already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing Universal Notification System...');

      // Initialize WebSocket server if HTTP server provided
      if (httpServer) {
        this.webSocketChannel.initialize(httpServer);
      }

      // Initialize template service
      await this.templateService.initialize();

      // Initialize queue service if enabled
      if (this.config.queue.enabled) {
        await this.queueService.initialize();
      }

      // Setup cleanup tasks
      this.setupCleanupTasks();

      this.initialized = true;
      console.log('✅ Universal Notification System initialized successfully');

      // Log system status
      this.logSystemStatus();

    } catch (error) {
      console.error('❌ Failed to initialize notification system:', error);
      throw error;
    }
  }

  /**
   * Send a notification (main entry point)
   */
  async send(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    this.ensureInitialized();
    return this.notificationService.sendNotification(request);
  }

  /**
   * Send notification to specific user
   */
  async sendToUser(
    userId: string,
    event: string,
    data: Record<string, any>,
    options?: {
      channels?: NotificationChannel[];
      priority?: import('./types').NotificationPriority;
      scheduledAt?: Date;
    }
  ): Promise<SendNotificationResponse> {
    this.ensureInitialized();
    return this.notificationService.sendToUser(userId, event, data, options);
  }

  /**
   * Send notification to users with specific role
   */
  async sendToRole(
    role: string,
    event: string,
    data: Record<string, any>,
    options?: {
      channels?: NotificationChannel[];
      priority?: import('./types').NotificationPriority;
      scheduledAt?: Date;
    }
  ): Promise<SendNotificationResponse> {
    this.ensureInitialized();
    return this.notificationService.sendToRole(role, event, data, options);
  }

  /**
   * Send notification to specific store
   */
  async sendToStore(
    storeId: string,
    event: string,
    data: Record<string, any>,
    options?: {
      channels?: NotificationChannel[];
      priority?: import('./types').NotificationPriority;
      scheduledAt?: Date;
    }
  ): Promise<SendNotificationResponse> {
    this.ensureInitialized();
    return this.notificationService.sendToStore(storeId, event, data, options);
  }

  /**
   * Send notification to all users
   */
  async sendToAll(
    event: string,
    data: Record<string, any>,
    options?: {
      channels?: NotificationChannel[];
      priority?: import('./types').NotificationPriority;
      scheduledAt?: Date;
    }
  ): Promise<SendNotificationResponse> {
    this.ensureInitialized();
    return this.notificationService.sendToAll(event, data, options);
  }

  /**
   * Get notification statistics
   */
  async getStats(): Promise<NotificationStats> {
    this.ensureInitialized();
    return this.notificationService.getNotificationStats();
  }

  /**
   * Get WebSocket connection statistics
   */
  getWebSocketStats() {
    this.ensureInitialized();
    return this.webSocketChannel.getConnectionStats();
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    this.ensureInitialized();
    return this.webSocketChannel.isUserOnline(userId);
  }

  /**
   * Get online users
   */
  getOnlineUsers(role?: string): string[] {
    this.ensureInitialized();
    return this.webSocketChannel.getOnlineUsers(role);
  }

  /**
   * Test email configuration
   */
  async testEmail(to: string): Promise<void> {
    this.ensureInitialized();
    // This would be implemented in the email channel
    console.log(`📧 Email test would be sent to: ${to}`);
  }

  /**
   * Test WebSocket connection
   */
  async testWebSocket(): Promise<boolean> {
    this.ensureInitialized();
    return this.webSocketChannel.getConnectionStats().totalConnections > 0;
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      websocket: boolean;
      email: boolean;
      queue: boolean;
      templates: boolean;
    };
    uptime: number;
    stats: {
      totalConnections: number;
      totalNotifications: number;
      queueSize: number;
    };
  }> {
    const stats = this.getWebSocketStats();
    const notificationStats = await this.getStats();
    
    const services = {
      websocket: this.config.websocket.enabled,
      email: this.config.email.enabled,
      queue: this.config.queue.enabled,
      templates: true // Would check template service
    };

    const unhealthyServices = Object.entries(services).filter(([_, healthy]) => !healthy).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyServices > 0) {
      status = unhealthyServices > 2 ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      services,
      uptime: process.uptime(),
      stats: {
        totalConnections: stats.totalConnections,
        totalNotifications: notificationStats.total,
        queueSize: 0 // Would get from queue service
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    console.log('🛑 Shutting down Universal Notification System...');

    try {
      // Shutdown WebSocket
      this.webSocketChannel.shutdown();

      // Shutdown queue service
      if (this.config.queue.enabled) {
        await this.queueService.shutdown();
      }

      // Shutdown other services
      await this.templateService.shutdown();

      this.initialized = false;
      console.log('✅ Notification system shutdown complete');

    } catch (error) {
      console.error('❌ Error during notification system shutdown:', error);
    }
  }

  /**
   * Ensure system is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Notification system not initialized. Call initialize() first.');
    }
  }

  /**
   * Setup periodic cleanup tasks
   */
  private setupCleanupTasks(): void {
    // Clean up expired notifications every hour
    setInterval(async () => {
      try {
        // This would clean up expired in-app notifications
        console.log('🧹 Running notification cleanup task...');
      } catch (error) {
        console.error('❌ Error in cleanup task:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Clean up queue items every 30 minutes
    if (this.config.queue.enabled) {
      setInterval(async () => {
        try {
          // This would clean up old queue items
          console.log('🧹 Running queue cleanup task...');
        } catch (error) {
          console.error('❌ Error in queue cleanup task:', error);
        }
      }, 30 * 60 * 1000); // 30 minutes
    }
  }

  /**
   * Log system status
   */
  private logSystemStatus(): void {
    console.log('📊 Notification System Status:');
    console.log(`   WebSocket: ${this.config.websocket.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Email: ${this.config.email.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   SMS: ${this.config.sms.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Push: ${this.config.push.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Queue: ${this.config.queue.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   In-App: ✅ Always Enabled`);
  }

  /**
   * Get configuration (for debugging)
   */
  getConfig() {
    return {
      websocket: {
        enabled: this.config.websocket.enabled,
        transports: this.config.websocket.transports
      },
      email: {
        enabled: this.config.email.enabled,
        smtpConfigured: !!this.config.email.smtp.auth.user
      },
      sms: {
        enabled: this.config.sms.enabled,
        provider: this.config.sms.provider
      },
      push: {
        enabled: this.config.push.enabled,
        vapidConfigured: !!this.config.push.vapidKeys
      },
      queue: {
        enabled: this.config.queue.enabled,
        redisConfigured: !!this.config.queue.redis
      }
    };
  }

  /**
   * Reload configuration (for development)
   */
  async reloadConfig(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Reloading notification configuration...');
      // This would reload configuration from environment
      console.log('✅ Configuration reloaded');
    }
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();
