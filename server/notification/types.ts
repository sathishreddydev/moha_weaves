// Core notification types for the universal notification system

export enum NotificationChannel {
  WEBSOCKET = 'websocket',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read'
}

// Base notification interface
export interface BaseNotification {
  id: string;
  event: string;
  data: Record<string, any>;
  recipients: NotificationRecipient[];
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: Date;
  scheduledAt?: Date;
  sentAt?: Date;
  metadata?: Record<string, any>;
}

// Recipient definition
export interface NotificationRecipient {
  type: 'user' | 'role' | 'store' | 'email' | 'phone' | 'all';
  id?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

// Channel-specific notification data
export interface ChannelNotificationData {
  websocket?: {
    room?: string;
    event?: string;
    data?: any;
  };
  email?: {
    template: string;
    subject: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>;
  };
  sms?: {
    template: string;
    to: string[];
    message: string;
  };
  push?: {
    title: string;
    body: string;
    icon?: string;
    badge?: number;
    data?: any;
  };
  in_app?: {
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
    expiresAt?: Date;
  };
}

// User notification preferences
export interface UserNotificationPreferences {
  userId: string;
  channels: {
    [key in NotificationChannel]: {
      enabled: boolean;
      quietHours?: {
        enabled: boolean;
        start: string; // "22:00"
        end: string;   // "08:00"
      };
      frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
    };
  };
  events: {
    [eventName: string]: {
      enabled: boolean;
      channels: NotificationChannel[];
      priority: NotificationPriority;
    };
  };
  updatedAt: Date;
}

// Template data
export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  language: string;
  subject?: string;
  content: string;
  variables: string[]; // Template variables
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Event definition
export interface NotificationEvent {
  name: string;
  module: string;
  description: string;
  defaultChannels: NotificationChannel[];
  defaultPriority: NotificationPriority;
  requiredData: string[]; // Required data fields
  templateVariables: string[]; // Available template variables
}

// Delivery log
export interface NotificationDeliveryLog {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// Queue item
export interface NotificationQueueItem {
  id: string;
  notification: BaseNotification;
  channelData: ChannelNotificationData;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  priority: NotificationPriority;
  createdAt: Date;
}

// WebSocket message format
export interface WebSocketMessage {
  type: 'notification' | 'system' | 'typing' | 'presence';
  data: any;
  timestamp: string;
  id?: string;
}

// Notification statistics
export interface NotificationStats {
  total: number;
  byChannel: Record<NotificationChannel, number>;
  byStatus: Record<NotificationStatus, number>;
  byEvent: Record<string, number>;
  deliveryRate: number;
  averageDeliveryTime: number;
}

// API request/response types
export interface SendNotificationRequest {
  event: string;
  data: Record<string, any>;
  recipients: NotificationRecipient[];
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export interface SendNotificationResponse {
  id: string;
  status: NotificationStatus;
  message: string;
  scheduledChannels: NotificationChannel[];
}

export interface GetNotificationsRequest {
  userId?: string;
  status?: NotificationStatus;
  channel?: NotificationChannel;
  event?: string;
  limit?: number;
  offset?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GetNotificationsResponse {
  notifications: BaseNotification[];
  total: number;
  page: number;
  pageSize: number;
}

// Configuration types
export interface NotificationConfig {
  websocket: {
    enabled: boolean;
    cors: {
      origin: string[];
      credentials: boolean;
    };
    transports: string[];
    pingTimeout: number;
    pingInterval: number;
  };
  email: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: {
      name: string;
      email: string;
    };
    templatesPath: string;
  };
  sms: {
    enabled: boolean;
    provider: 'twilio' | 'aws-sns' | 'custom';
    config: Record<string, any>;
  };
  push: {
    enabled: boolean;
    vapidKeys?: {
      publicKey: string;
      privateKey: string;
    };
  };
  queue: {
    enabled: boolean;
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
    maxRetries: number;
    retryDelay: number;
  };
}

// Error types
export class NotificationError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class InvalidRecipientError extends NotificationError {
  constructor(recipient: string, details?: any) {
    super(
      `Invalid recipient: ${recipient}`,
      'INVALID_RECIPIENT',
      400,
      details
    );
    this.name = 'InvalidRecipientError';
  }
}

export class ChannelNotAvailableError extends NotificationError {
  constructor(channel: NotificationChannel) {
    super(
      `Notification channel not available: ${channel}`,
      'CHANNEL_NOT_AVAILABLE',
      503,
      { channel }
    );
    this.name = 'ChannelNotAvailableError';
  }
}

export class TemplateNotFoundError extends NotificationError {
  constructor(template: string, channel: NotificationChannel) {
    super(
      `Template not found: ${template} for channel ${channel}`,
      'TEMPLATE_NOT_FOUND',
      404,
      { template, channel }
    );
    this.name = 'TemplateNotFoundError';
  }
}
