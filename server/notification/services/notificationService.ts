import { v4 as uuidv4 } from 'uuid';
import { 
  BaseNotification, 
  NotificationChannel, 
  NotificationPriority,
  NotificationStatus,
  NotificationRecipient,
  SendNotificationRequest,
  SendNotificationResponse,
  NotificationError,
  InvalidRecipientError,
  ChannelNotAvailableError
} from '../types';
import { getEvent, validateEventData } from '../events';
import { getNotificationConfigSingleton } from '../config';
import { WebSocketChannel } from '../channels/websocket';
import { EmailChannel } from '../channels/email';
import { InAppChannel } from '../channels/inApp';
import { UserPreferenceService } from './preferenceService';
import { TemplateService } from './templateService';
import { QueueService } from './queueService';

export class NotificationService {
  private config = getNotificationConfigSingleton();
  private preferenceService: UserPreferenceService;
  private templateService: TemplateService;
  private queueService: QueueService;
  
  // Channel instances
  private websocketChannel: WebSocketChannel;
  private emailChannel: EmailChannel;
  private inAppChannel: InAppChannel;

  constructor() {
    this.preferenceService = new UserPreferenceService();
    this.templateService = new TemplateService();
    this.queueService = new QueueService();
    
    // Initialize channels
    this.websocketChannel = new WebSocketChannel(this.config.websocket);
    this.emailChannel = new EmailChannel(this.config.email);
    this.inAppChannel = new InAppChannel();
  }

  /**
   * Send a notification to specified recipients
   */
  async sendNotification(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    try {
      // Validate event
      const event = getEvent(request.event);
      if (!event) {
        throw new NotificationError(`Unknown event: ${request.event}`, 'UNKNOWN_EVENT', 400);
      }

      // Validate event data
      const dataValidation = validateEventData(request.event, request.data);
      if (!dataValidation.isValid) {
        throw new NotificationError(
          `Missing required data: ${dataValidation.missingFields.join(', ')}`,
          'MISSING_REQUIRED_DATA',
          400,
          { missingFields: dataValidation.missingFields }
        );
      }

      // Validate recipients
      this.validateRecipients(request.recipients);

      // Determine channels to use
      const channels = request.channels || event.defaultChannels;
      const availableChannels = this.getAvailableChannels(channels);

      if (availableChannels.length === 0) {
        throw new ChannelNotAvailableError(channels[0]);
      }

      // Create notification object
      const notification: BaseNotification = {
        id: uuidv4(),
        event: request.event,
        data: request.data,
        recipients: request.recipients,
        channels: availableChannels,
        priority: request.priority || event.defaultPriority,
        status: NotificationStatus.PENDING,
        createdAt: new Date(),
        scheduledAt: request.scheduledAt,
        metadata: request.metadata
      };

      // Process notification
      const result = await this.processNotification(notification);

      return {
        id: notification.id,
        status: notification.status,
        message: result.message,
        scheduledChannels: availableChannels
      };

    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
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
      priority?: NotificationPriority;
      scheduledAt?: Date;
    }
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      event,
      data,
      recipients: [{ type: 'user', id: userId }],
      channels: options?.channels,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt
    });
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
      priority?: NotificationPriority;
      scheduledAt?: Date;
    }
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      event,
      data,
      recipients: [{ type: 'role', id: role }],
      channels: options?.channels,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt
    });
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
      priority?: NotificationPriority;
      scheduledAt?: Date;
    }
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      event,
      data,
      recipients: [{ type: 'store', id: storeId }],
      channels: options?.channels,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt
    });
  }

  /**
   * Send notification to all users
   */
  async sendToAll(
    event: string, 
    data: Record<string, any>,
    options?: {
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
      scheduledAt?: Date;
    }
  ): Promise<SendNotificationResponse> {
    return this.sendNotification({
      event,
      data,
      recipients: [{ type: 'all' }],
      channels: options?.channels,
      priority: options?.priority,
      scheduledAt: options?.scheduledAt
    });
  }

  /**
   * Process notification through appropriate channels
   */
  private async processNotification(notification: BaseNotification): Promise<{ message: string }> {
    const results: Promise<any>[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each channel
    for (const channel of notification.channels) {
      try {
        // Get recipients for this channel based on user preferences
        const channelRecipients = await this.getChannelRecipients(
          notification.recipients, 
          channel, 
          notification.event
        );

        if (channelRecipients.length === 0) {
          console.log(`No recipients for channel ${channel}`);
          continue;
        }

        // Get channel-specific data
        const channelData = await this.prepareChannelData(
          notification, 
          channel, 
          channelRecipients
        );

        // Send through channel
        switch (channel) {
          case NotificationChannel.WEBSOCKET:
            results.push(this.websocketChannel.send(channelData));
            break;
          case NotificationChannel.EMAIL:
            results.push(this.emailChannel.send(channelData));
            break;
          case NotificationChannel.IN_APP:
            results.push(this.inAppChannel.send(channelData));
            break;
          case NotificationChannel.SMS:
            // SMS channel would be implemented here
            console.log('SMS channel not yet implemented');
            break;
          case NotificationChannel.PUSH:
            // Push channel would be implemented here
            console.log('Push channel not yet implemented');
            break;
        }

        successCount++;

      } catch (error) {
        console.error(`Error sending via ${channel}:`, error);
        failureCount++;
      }
    }

    // Wait for all sends to complete
    await Promise.allSettled(results);

    // Update notification status
    if (failureCount === 0) {
      notification.status = NotificationStatus.SENT;
    } else if (successCount > 0) {
      notification.status = NotificationStatus.SENT; // Partial success
    } else {
      notification.status = NotificationStatus.FAILED;
    }

    return {
      message: `Notification processed. Success: ${successCount}, Failed: ${failureCount}`
    };
  }

  /**
   * Get available channels based on configuration
   */
  private getAvailableChannels(requestedChannels: NotificationChannel[]): NotificationChannel[] {
    return requestedChannels.filter(channel => {
      switch (channel) {
        case NotificationChannel.WEBSOCKET:
          return this.config.websocket.enabled;
        case NotificationChannel.EMAIL:
          return this.config.email.enabled;
        case NotificationChannel.SMS:
          return this.config.sms.enabled;
        case NotificationChannel.PUSH:
          return this.config.push.enabled;
        case NotificationChannel.IN_APP:
          return true; // Always available
        default:
          return false;
      }
    });
  }

  /**
   * Validate recipient objects
   */
  private validateRecipients(recipients: NotificationRecipient[]): void {
    if (!recipients || recipients.length === 0) {
      throw new InvalidRecipientError('No recipients specified');
    }

    for (const recipient of recipients) {
      switch (recipient.type) {
        case 'user':
        case 'role':
        case 'store':
          if (!recipient.id) {
            throw new InvalidRecipientError(`Missing ID for ${recipient.type} recipient`);
          }
          break;
        case 'email':
          if (!recipient.email) {
            throw new InvalidRecipientError('Missing email address for email recipient');
          }
          break;
        case 'phone':
          if (!recipient.phone) {
            throw new InvalidRecipientError('Missing phone number for phone recipient');
          }
          break;
        case 'all':
          // No validation needed
          break;
        default:
          throw new InvalidRecipientError(`Unknown recipient type: ${recipient.type}`);
      }
    }
  }

  /**
   * Get recipients for specific channel based on user preferences
   */
  private async getChannelRecipients(
    recipients: NotificationRecipient[], 
    channel: NotificationChannel, 
    event: string
  ): Promise<NotificationRecipient[]> {
    const channelRecipients: NotificationRecipient[] = [];

    for (const recipient of recipients) {
      switch (recipient.type) {
        case 'user':
          // Check user preferences for this channel and event
          const userPrefs = await this.preferenceService.getUserPreferences(recipient.id!);
          if (this.shouldSendToUser(userPrefs, channel, event)) {
            channelRecipients.push(recipient);
          }
          break;
        case 'role':
        case 'store':
        case 'all':
          // These are always included (preferences checked at individual user level)
          channelRecipients.push(recipient);
          break;
        case 'email':
          if (channel === NotificationChannel.EMAIL) {
            channelRecipients.push(recipient);
          }
          break;
        case 'phone':
          if (channel === NotificationChannel.SMS) {
            channelRecipients.push(recipient);
          }
          break;
      }
    }

    return channelRecipients;
  }

  /**
   * Check if notification should be sent to user based on preferences
   */
  private shouldSendToUser(
    preferences: any, 
    channel: NotificationChannel, 
    event: string
  ): boolean {
    // Check if channel is enabled
    const channelPrefs = preferences.channels[channel];
    if (!channelPrefs?.enabled) {
      return false;
    }

    // Check quiet hours
    if (channelPrefs.quietHours?.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { start, end } = channelPrefs.quietHours;
      
      if (this.isTimeInRange(currentTime, start, end)) {
        return false;
      }
    }

    // Check event-specific preferences
    const eventPrefs = preferences.events[event];
    if (eventPrefs) {
      return eventPrefs.enabled && eventPrefs.channels.includes(channel);
    }

    // Default to enabled if no specific preferences
    return true;
  }

  /**
   * Check if current time is within quiet hours range
   */
  private isTimeInRange(current: string, start: string, end: string): boolean {
    const currentMinutes = this.timeToMinutes(current);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    if (startMinutes <= endMinutes) {
      // Normal range (e.g., 22:00 to 08:00 doesn't cross midnight)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Range crosses midnight (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Prepare channel-specific data
   */
  private async prepareChannelData(
    notification: BaseNotification, 
    channel: NotificationChannel, 
    recipients: NotificationRecipient[]
  ): Promise<any> {
    // Get template for this channel and event
    const template = await this.templateService.getTemplate(
      notification.event, 
      channel, 
      'en' // Default language
    );

    // Prepare template data
    const templateData = {
      ...notification.data,
      notificationId: notification.id,
      event: notification.event,
      priority: notification.priority,
      createdAt: notification.createdAt.toISOString(),
      recipients: recipients
    };

    // Render template
    const renderedContent = await this.templateService.renderTemplate(
      template, 
      templateData
    );

    // Return channel-specific data structure
    switch (channel) {
      case NotificationChannel.WEBSOCKET:
        return {
          type: 'notification',
          event: notification.event,
          data: {
            notification,
            template: renderedContent,
            recipients
          },
          timestamp: new Date().toISOString()
        };

      case NotificationChannel.EMAIL:
        return {
          template: template.name,
          subject: renderedContent.subject,
          to: recipients.filter(r => r.type === 'email' || r.type === 'user').map(r => r.email || r.id),
          content: renderedContent.content,
          data: templateData
        };

      case NotificationChannel.IN_APP:
        return {
          notification,
          content: renderedContent.content,
          recipients,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };

      default:
        return {
          notification,
          template: renderedContent,
          recipients
        };
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<any> {
    // This would query the database for statistics
    return {
      total: 0,
      byChannel: {},
      byStatus: {},
      byEvent: {},
      deliveryRate: 0,
      averageDeliveryTime: 0
    };
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string, 
    options?: {
      status?: NotificationStatus;
      channel?: NotificationChannel;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ notifications: BaseNotification[]; total: number }> {
    // This would query the database for user notifications
    return {
      notifications: [],
      total: 0
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
