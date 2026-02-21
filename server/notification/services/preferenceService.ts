import { 
  UserNotificationPreferences,
  NotificationChannel,
  NotificationPriority
} from '../types';

// Mock database for preferences (in real implementation, this would use actual database)
const userPreferencesCache = new Map<string, UserNotificationPreferences>();

export class UserPreferenceService {
  constructor() {
    console.log('⚙️ User preference service initialized');
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    // Try to get from cache first
    let preferences = userPreferencesCache.get(userId);
    
    if (!preferences) {
      // Create default preferences for new user
      preferences = this.createDefaultPreferences(userId);
      userPreferencesCache.set(userId, preferences);
    }

    return preferences;
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string, 
    updates: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    const currentPreferences = await this.getUserPreferences(userId);
    
    // Merge updates with current preferences
    const updatedPreferences: UserNotificationPreferences = {
      ...currentPreferences,
      ...updates,
      channels: {
        ...currentPreferences.channels,
        ...updates.channels
      },
      events: {
        ...currentPreferences.events,
        ...updates.events
      },
      updatedAt: new Date()
    };

    // Save to cache (in real implementation, save to database)
    userPreferencesCache.set(userId, updatedPreferences);
    
    console.log(`⚙️ Updated preferences for user ${userId}`);
    return updatedPreferences;
  }

  /**
   * Update channel preferences for user
   */
  async updateChannelPreferences(
    userId: string,
    channel: NotificationChannel,
    preferences: {
      enabled: boolean;
      quietHours?: {
        enabled: boolean;
        start: string;
        end: string;
      };
      frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
    }
  ): Promise<UserNotificationPreferences> {
    const currentPreferences = await this.getUserPreferences(userId);
    
    currentPreferences.channels[channel] = {
      ...currentPreferences.channels[channel],
      ...preferences
    };
    currentPreferences.updatedAt = new Date();

    userPreferencesCache.set(userId, currentPreferences);
    
    return currentPreferences;
  }

  /**
   * Update event preferences for user
   */
  async updateEventPreferences(
    userId: string,
    event: string,
    preferences: {
      enabled: boolean;
      channels: NotificationChannel[];
      priority: NotificationPriority;
    }
  ): Promise<UserNotificationPreferences> {
    const currentPreferences = await this.getUserPreferences(userId);
    
    currentPreferences.events[event] = {
      ...currentPreferences.events[event],
      ...preferences
    };
    currentPreferences.updatedAt = new Date();

    userPreferencesCache.set(userId, currentPreferences);
    
    return currentPreferences;
  }

  /**
   * Enable/disable channel for user
   */
  async toggleChannel(
    userId: string,
    channel: NotificationChannel,
    enabled: boolean
  ): Promise<UserNotificationPreferences> {
    return this.updateChannelPreferences(userId, channel, { enabled });
  }

  /**
   * Enable/disable event for user
   */
  async toggleEvent(
    userId: string,
    event: string,
    enabled: boolean
  ): Promise<UserNotificationPreferences> {
    const currentPreferences = await this.getUserPreferences(userId);
    
    return this.updateEventPreferences(userId, event, {
      enabled,
      channels: currentPreferences.events[event]?.channels || [NotificationChannel.IN_APP],
      priority: currentPreferences.events[event]?.priority || NotificationPriority.NORMAL
    });
  }

  /**
   * Set quiet hours for user
   */
  async setQuietHours(
    userId: string,
    channel: NotificationChannel,
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    }
  ): Promise<UserNotificationPreferences> {
    const currentPrefs = await this.getUserPreferences(userId);
    return this.updateChannelPreferences(userId, channel, { 
      enabled: currentPrefs.channels[channel]?.enabled || true,
      quietHours 
    });
  }

  /**
   * Set notification frequency for user
   */
  async setFrequency(
    userId: string,
    channel: NotificationChannel,
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly'
  ): Promise<UserNotificationPreferences> {
    const currentPrefs = await this.getUserPreferences(userId);
    return this.updateChannelPreferences(userId, channel, { 
      enabled: currentPrefs.channels[channel]?.enabled || true,
      frequency 
    });
  }

  /**
   * Get users who should receive notification for specific event and channel
   */
  async getUsersForNotification(
    userIds: string[],
    event: string,
    channel: NotificationChannel
  ): Promise<string[]> {
    const eligibleUsers: string[] = [];

    for (const userId of userIds) {
      const preferences = await this.getUserPreferences(userId);
      
      // Check if channel is enabled
      if (!preferences.channels[channel]?.enabled) {
        continue;
      }

      // Check if event is enabled
      if (preferences.events[event]) {
        if (!preferences.events[event].enabled) {
          continue;
        }
        
        // Check if channel is in event's allowed channels
        if (!preferences.events[event].channels.includes(channel)) {
          continue;
        }
      }

      // Check quiet hours (only for non-urgent notifications)
      if (preferences.channels[channel]?.quietHours?.enabled) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const { start, end } = preferences.channels[channel].quietHours;
        
        if (this.isTimeInRange(currentTime, start, end)) {
          continue;
        }
      }

      eligibleUsers.push(userId);
    }

    return eligibleUsers;
  }

  /**
   * Get preference summary for user
   */
  async getPreferenceSummary(userId: string): Promise<{
    enabledChannels: NotificationChannel[];
    enabledEvents: string[];
    quietHoursActive: boolean;
    totalPreferences: number;
  }> {
    const preferences = await this.getUserPreferences(userId);
    
    const enabledChannels = Object.entries(preferences.channels)
      .filter(([_, config]) => config.enabled)
      .map(([channel]) => channel as NotificationChannel);

    const enabledEvents = Object.entries(preferences.events)
      .filter(([_, config]) => config.enabled)
      .map(([event]) => event);

    const quietHoursActive = Object.values(preferences.channels)
      .some(config => config.quietHours?.enabled);

    return {
      enabledChannels,
      enabledEvents,
      quietHoursActive,
      totalPreferences: enabledChannels.length + enabledEvents.length
    };
  }

  /**
   * Reset user preferences to defaults
   */
  async resetToDefaults(userId: string): Promise<UserNotificationPreferences> {
    const defaultPreferences = this.createDefaultPreferences(userId);
    userPreferencesCache.set(userId, defaultPreferences);
    
    console.log(`⚙️ Reset preferences to defaults for user ${userId}`);
    return defaultPreferences;
  }

  /**
   * Create default preferences for new user
   */
  private createDefaultPreferences(userId: string): UserNotificationPreferences {
    return {
      userId,
      channels: {
        [NotificationChannel.WEBSOCKET]: {
          enabled: true,
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
          },
          frequency: 'immediate'
        },
        [NotificationChannel.EMAIL]: {
          enabled: true,
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00'
          },
          frequency: 'immediate'
        },
        [NotificationChannel.SMS]: {
          enabled: false,
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
          },
          frequency: 'immediate'
        },
        [NotificationChannel.PUSH]: {
          enabled: true,
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00'
          },
          frequency: 'immediate'
        },
        [NotificationChannel.IN_APP]: {
          enabled: true,
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
          },
          frequency: 'immediate'
        }
      },
      events: {
        // Inventory events
        'STOCK_REQUEST_CREATED': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          priority: NotificationPriority.NORMAL
        },
        'STOCK_REQUEST_APPROVED': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          priority: NotificationPriority.HIGH
        },
        'LOW_STOCK_ALERT': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS],
          priority: NotificationPriority.HIGH
        },
        'CRITICAL_LOW_STOCK': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
          priority: NotificationPriority.URGENT
        },
        
        // Order events
        'ORDER_CREATED': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          priority: NotificationPriority.NORMAL
        },
        'ORDER_SHIPPED': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
          priority: NotificationPriority.HIGH
        },
        'ORDER_DELIVERED': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          priority: NotificationPriority.NORMAL
        },
        
        // User events
        'USER_PASSWORD_CHANGED': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS],
          priority: NotificationPriority.HIGH
        },
        'USER_LOGIN_FAILED': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS],
          priority: NotificationPriority.HIGH
        },
        
        // Admin events
        'SYSTEM_BACKUP_COMPLETED': {
          enabled: false, // Disabled by default for regular users
          channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          priority: NotificationPriority.NORMAL
        },
        'SECURITY_BREACH_DETECTED': {
          enabled: true,
          channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH],
          priority: NotificationPriority.URGENT
        }
      },
      updatedAt: new Date()
    };
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
   * Get all users' preferences (admin function)
   */
  async getAllUserPreferences(): Promise<UserNotificationPreferences[]> {
    return Array.from(userPreferencesCache.values());
  }

  /**
   * Get users with specific preferences (admin function)
   */
  async getUsersWithChannelEnabled(channel: NotificationChannel): Promise<string[]> {
    const userIds: string[] = [];
    
    for (const [userId, preferences] of userPreferencesCache.entries()) {
      if (preferences.channels[channel]?.enabled) {
        userIds.push(userId);
      }
    }
    
    return userIds;
  }

  /**
   * Get users with event enabled (admin function)
   */
  async getUsersWithEventEnabled(event: string): Promise<string[]> {
    const userIds: string[] = [];
    
    for (const [userId, preferences] of userPreferencesCache.entries()) {
      if (preferences.events[event]?.enabled) {
        userIds.push(userId);
      }
    }
    
    return userIds;
  }

  /**
   * Export user preferences (backup)
   */
  async exportUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    return await this.getUserPreferences(userId);
  }

  /**
   * Import user preferences (restore)
   */
  async importUserPreferences(preferences: UserNotificationPreferences): Promise<UserNotificationPreferences> {
    // Validate preferences
    if (!preferences.userId) {
      throw new Error('User ID is required for import');
    }

    // Update with current timestamp
    preferences.updatedAt = new Date();
    
    userPreferencesCache.set(preferences.userId, preferences);
    
    console.log(`⚙️ Imported preferences for user ${preferences.userId}`);
    return preferences;
  }

  /**
   * Get preference statistics (admin function)
   */
  async getPreferenceStatistics(): Promise<{
    totalUsers: number;
    channelUsage: Record<NotificationChannel, number>;
    eventUsage: Record<string, number>;
    quietHoursUsage: number;
  }> {
    const allPreferences = await this.getAllUserPreferences();
    
    const channelUsage: Record<string, number> = {};
    const eventUsage: Record<string, number> = {};
    let quietHoursUsage = 0;

    // Initialize channel counts
    Object.values(NotificationChannel).forEach(channel => {
      channelUsage[channel] = 0;
    });

    allPreferences.forEach(preferences => {
      // Count channel usage
      Object.entries(preferences.channels).forEach(([channel, config]) => {
        if (config.enabled) {
          channelUsage[channel] = (channelUsage[channel] || 0) + 1;
        }
        
        if (config.quietHours?.enabled) {
          quietHoursUsage++;
        }
      });

      // Count event usage
      Object.entries(preferences.events).forEach(([event, config]) => {
        if (config.enabled) {
          eventUsage[event] = (eventUsage[event] || 0) + 1;
        }
      });
    });

    return {
      totalUsers: allPreferences.length,
      channelUsage: channelUsage as Record<NotificationChannel, number>,
      eventUsage,
      quietHoursUsage
    };
  }
}
