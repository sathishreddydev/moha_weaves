import { 
  NotificationQueueItem,
  BaseNotification,
  NotificationChannel,
  NotificationPriority,
  ChannelNotificationData
} from '../types';

// Simple in-memory queue (in production, would use Redis or RabbitMQ)
class InMemoryQueue {
  private queues: Map<NotificationPriority, NotificationQueueItem[]> = new Map();
  private processing = false;

  constructor() {
    // Initialize queues for each priority
    Object.values(NotificationPriority).forEach(priority => {
      this.queues.set(priority, []);
    });
  }

  async add(item: NotificationQueueItem): Promise<void> {
    const queue = this.queues.get(item.priority);
    if (queue) {
      queue.push(item);
      // Sort by priority and creation time
      queue.sort((a, b) => {
        const priorityOrder = {
          [NotificationPriority.URGENT]: 0,
          [NotificationPriority.HIGH]: 1,
          [NotificationPriority.NORMAL]: 2,
          [NotificationPriority.LOW]: 3
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority] || 
               a.createdAt.getTime() - b.createdAt.getTime();
      });
    }
  }

  async getNext(): Promise<NotificationQueueItem | null> {
    // Check queues in priority order
    const priorityOrder = [
      NotificationPriority.URGENT,
      NotificationPriority.HIGH,
      NotificationPriority.NORMAL,
      NotificationPriority.LOW
    ];

    for (const priority of priorityOrder) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift() || null;
      }
    }

    return null;
  }

  async size(): Promise<number> {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  async getStats(): Promise<Record<NotificationPriority, number>> {
    const stats: Record<NotificationPriority, number> = {} as any;
    
    for (const [priority, queue] of this.queues.entries()) {
      stats[priority] = queue.length;
    }
    
    return stats;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  setProcessing(processing: boolean): void {
    this.processing = processing;
  }
}

export class QueueService {
  private queue: InMemoryQueue;
  private enabled: boolean;
  private maxRetries: number;
  private retryDelay: number;
  private processingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.queue = new InMemoryQueue();
    this.enabled = process.env.QUEUE_ENABLED === 'true';
    this.maxRetries = parseInt(process.env.QUEUE_MAX_RETRIES || '3');
    this.retryDelay = parseInt(process.env.QUEUE_RETRY_DELAY || '5000');
    
    console.log('📋 Queue service initialized');
  }

  /**
   * Initialize queue service
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      console.log('📋 Queue service is disabled');
      return;
    }

    try {
      // Start processing queue
      this.startQueueProcessor();
      console.log('📋 Queue service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize queue service:', error);
      throw error;
    }
  }

  /**
   * Add notification to queue
   */
  async addToQueue(
    notification: BaseNotification,
    channelData: ChannelNotificationData,
    channel: NotificationChannel
  ): Promise<void> {
    if (!this.enabled) {
      // Process immediately if queue is disabled
      await this.processNotification(notification, channelData, channel);
      return;
    }

    const queueItem: NotificationQueueItem = {
      id: `${notification.id}-${channel}`,
      notification,
      channelData,
      attempts: 0,
      maxAttempts: this.maxRetries,
      nextAttemptAt: new Date(),
      priority: notification.priority,
      createdAt: new Date()
    };

    await this.queue.add(queueItem);
    console.log(`📋 Added notification to queue: ${queueItem.id}`);
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.processingInterval = setInterval(async () => {
      if (!this.queue.isProcessing()) {
        await this.processQueue();
      }
    }, 1000); // Process every second

    console.log('📋 Queue processor started');
  }

  /**
   * Process queue items
   */
  private async processQueue(): Promise<void> {
    this.queue.setProcessing(true);

    try {
      const item = await this.queue.getNext();
      
      if (item) {
        await this.processQueueItem(item);
      }
    } catch (error) {
      console.error('❌ Error processing queue:', error);
    } finally {
      this.queue.setProcessing(false);
    }
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: NotificationQueueItem): Promise<void> {
    try {
      // Check if it's time to process this item
      if (item.nextAttemptAt > new Date()) {
        // Put it back in the queue
        await this.queue.add(item);
        return;
      }

      // Determine which channel to process
      const channel = this.getChannelFromItem(item);
      
      // Process the notification
      await this.processNotification(item.notification, item.channelData, channel);
      
      console.log(`📋 Successfully processed queue item: ${item.id}`);

    } catch (error) {
      console.error(`❌ Failed to process queue item ${item.id}:`, error);
      
      // Retry logic
      item.attempts++;
      
      if (item.attempts < item.maxAttempts) {
        item.nextAttemptAt = new Date(Date.now() + this.retryDelay * Math.pow(2, item.attempts - 1));
        await this.queue.add(item);
        console.log(`📋 Retrying queue item ${item.id} (attempt ${item.attempts})`);
      } else {
        console.error(`📋 Queue item ${item.id} failed after ${item.maxAttempts} attempts`);
        // Would log to database for failed notifications
      }
    }
  }

  /**
   * Process notification through appropriate channel
   */
  private async processNotification(
    notification: BaseNotification,
    channelData: ChannelNotificationData,
    channel: NotificationChannel
  ): Promise<void> {
    // This would integrate with the actual channel implementations
    console.log(`📋 Processing ${channel} notification for ${notification.event}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation, this would call the appropriate channel's send method
    switch (channel) {
      case NotificationChannel.EMAIL:
        // await emailChannel.send(channelData.email);
        break;
      case NotificationChannel.SMS:
        // await smsChannel.send(channelData.sms);
        break;
      case NotificationChannel.PUSH:
        // await pushChannel.send(channelData.push);
        break;
      case NotificationChannel.WEBSOCKET:
        // WebSocket notifications are typically sent immediately, not queued
        break;
      case NotificationChannel.IN_APP:
        // In-app notifications are typically stored immediately, not queued
        break;
    }
  }

  /**
   * Extract channel from queue item
   */
  private getChannelFromItem(item: NotificationQueueItem): NotificationChannel {
    // This would be stored in the queue item or derived from channelData
    // For now, return a default
    return NotificationChannel.EMAIL;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    size: number;
    processing: boolean;
    byPriority: Record<NotificationPriority, number>;
    enabled: boolean;
  }> {
    return {
      size: await this.queue.size(),
      processing: this.queue.isProcessing(),
      byPriority: await this.queue.getStats(),
      enabled: this.enabled
    };
  }

  /**
   * Get queue items (for debugging)
   */
  async getQueueItems(limit: number = 50): Promise<NotificationQueueItem[]> {
    // In a real implementation, this would query the queue
    return [];
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<void> {
    // In a real implementation, this would clear the queue
    console.log('📋 Queue cleared');
  }

  /**
   * Pause queue processing
   */
  pauseQueue(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isRunning = false;
    console.log('📋 Queue processing paused');
  }

  /**
   * Resume queue processing
   */
  resumeQueue(): void {
    if (!this.isRunning && this.enabled) {
      this.startQueueProcessor();
    }
    console.log('📋 Queue processing resumed');
  }

  /**
   * Force process all items in queue
   */
  async forceProcessQueue(): Promise<void> {
    console.log('📋 Force processing all queue items...');
    
    const originalInterval = this.processingInterval;
    
    // Pause normal processing
    this.pauseQueue();
    
    // Process all items
    let processedCount = 0;
    while (true) {
      const item = await this.queue.getNext();
      if (!item) break;
      
      await this.processQueueItem(item);
      processedCount++;
    }
    
    console.log(`📋 Force processed ${processedCount} items`);
    
    // Resume normal processing
    if (originalInterval) {
      this.processingInterval = originalInterval;
    }
    this.isRunning = true;
  }

  /**
   * Requeue failed items
   */
  async requeueFailedItems(): Promise<number> {
    // In a real implementation, this would query failed notifications from database
    // and re-add them to the queue
    console.log('📋 Requeuing failed items...');
    return 0;
  }

  /**
   * Get queue health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    queueSize: number;
    processingRate: number;
    errorRate: number;
    oldestItem: Date | null;
  }> {
    const stats = await this.getQueueStats();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (stats.size > 1000) {
      status = 'critical';
    } else if (stats.size > 500) {
      status = 'warning';
    }
    
    return {
      status,
      queueSize: stats.size,
      processingRate: 0, // Would calculate from metrics
      errorRate: 0, // Would calculate from metrics
      oldestItem: null // Would get from queue
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('📋 Shutting down queue service...');
    
    // Stop processing
    this.pauseQueue();
    
    // Wait for current processing to complete
    let attempts = 0;
    while (this.queue.isProcessing() && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (this.queue.isProcessing()) {
      console.warn('📋 Queue processing did not complete gracefully');
    }
    
    console.log('📋 Queue service shutdown complete');
  }

  /**
   * Configure queue settings
   */
  configure(settings: {
    maxRetries?: number;
    retryDelay?: number;
    enabled?: boolean;
  }): void {
    if (settings.maxRetries !== undefined) {
      this.maxRetries = settings.maxRetries;
    }
    if (settings.retryDelay !== undefined) {
      this.retryDelay = settings.retryDelay;
    }
    if (settings.enabled !== undefined) {
      this.enabled = settings.enabled;
      if (this.enabled && !this.isRunning) {
        this.startQueueProcessor();
      } else if (!this.enabled && this.isRunning) {
        this.pauseQueue();
      }
    }
    
    console.log('📋 Queue configuration updated');
  }
}
