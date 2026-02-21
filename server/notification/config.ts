import { NotificationConfig } from './types';

// Default notification configuration
export const defaultNotificationConfig: NotificationConfig = {
  websocket: {
    enabled: true,
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? (process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'])
        : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'Inventory System',
      email: process.env.EMAIL_FROM_EMAIL || 'noreply@inventory.com'
    },
    templatesPath: process.env.EMAIL_TEMPLATES_PATH || './server/notification/templates/email'
  },
  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    provider: (process.env.SMS_PROVIDER as 'twilio' | 'aws-sns' | 'custom') || 'twilio',
    config: {
      // Twilio configuration
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
      
      // AWS SNS configuration
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1'
    }
  },
  push: {
    enabled: process.env.PUSH_ENABLED === 'true',
    vapidKeys: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    } : undefined
  },
  queue: {
    enabled: process.env.QUEUE_ENABLED === 'true',
    redis: process.env.REDIS_HOST ? {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    } : undefined,
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY || '5000')
  }
};

// Configuration validation
export const validateConfig = (config: NotificationConfig): boolean => {
  try {
    // Validate WebSocket config
    if (config.websocket.enabled) {
      if (!config.websocket.cors.origin.length) {
        throw new Error('WebSocket CORS origins must be specified');
      }
    }

    // Validate Email config
    if (config.email.enabled) {
      if (!config.email.smtp.host || !config.email.smtp.auth.user) {
        throw new Error('Email SMTP configuration is incomplete');
      }
      if (!config.email.from.email) {
        throw new Error('Email from address is required');
      }
    }

    // Validate SMS config
    if (config.sms.enabled) {
      if (config.sms.provider === 'twilio') {
        if (!config.sms.config.accountSid || !config.sms.config.authToken) {
          throw new Error('Twilio configuration is incomplete');
        }
      }
    }

    // Validate Push config
    if (config.push.enabled) {
      if (!config.push.vapidKeys) {
        console.warn('Push notifications enabled but VAPID keys not provided');
      }
    }

    // Validate Queue config
    if (config.queue.enabled && config.queue.redis) {
      if (!config.queue.redis.host) {
        throw new Error('Redis configuration is incomplete');
      }
    }

    return true;
  } catch (error) {
    console.error('Notification configuration validation failed:', error);
    return false;
  }
};

// Get configuration with environment overrides
export const getNotificationConfig = (): NotificationConfig => {
  const config = { ...defaultNotificationConfig };

  // Apply environment-specific overrides
  if (process.env.NODE_ENV === 'production') {
    // Production-specific overrides
    config.websocket.pingTimeout = 120000;
    config.websocket.pingInterval = 30000;
    config.queue.maxRetries = 5;
    config.queue.retryDelay = 10000;
  } else if (process.env.NODE_ENV === 'development') {
    // Development-specific overrides
    config.queue.maxRetries = 1;
    config.queue.retryDelay = 1000;
  }

  // Validate configuration
  if (!validateConfig(config)) {
    throw new Error('Invalid notification configuration');
  }

  return config;
};

// Channel availability check
export const isChannelAvailable = (channel: string, config: NotificationConfig): boolean => {
  switch (channel) {
    case 'websocket':
      return config.websocket.enabled;
    case 'email':
      return config.email.enabled;
    case 'sms':
      return config.sms.enabled;
    case 'push':
      return config.push.enabled;
    case 'in_app':
      return true; // In-app is always available
    default:
      return false;
  }
};

// Get enabled channels
export const getEnabledChannels = (config: NotificationConfig): string[] => {
  const channels: string[] = [];
  
  if (config.websocket.enabled) channels.push('websocket');
  if (config.email.enabled) channels.push('email');
  if (config.sms.enabled) channels.push('sms');
  if (config.push.enabled) channels.push('push');
  channels.push('in_app'); // Always available

  return channels;
};

// Export configuration singleton
let notificationConfig: NotificationConfig | null = null;

export const getNotificationConfigSingleton = (): NotificationConfig => {
  if (!notificationConfig) {
    notificationConfig = getNotificationConfig();
  }
  return notificationConfig;
};

// Hot reload configuration (for development)
if (process.env.NODE_ENV === 'development') {
  // Watch for configuration changes in development
  process.on('SIGUSR2', () => {
    console.log('🔄 Reloading notification configuration...');
    notificationConfig = null;
    try {
      getNotificationConfigSingleton();
      console.log('✅ Notification configuration reloaded');
    } catch (error) {
      console.error('❌ Failed to reload notification configuration:', error);
    }
  });
}
