import { NotificationEvent, NotificationChannel, NotificationPriority } from '../types';

// User module notification events
export const USER_EVENTS: NotificationEvent[] = [
  {
    name: 'USER_REGISTERED',
    module: 'user',
    description: 'New user registered successfully',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['userId', 'email', 'name', 'registrationSource'],
    templateVariables: ['userId', 'userName', 'email', 'registrationSource', 'registeredAt']
  },
  {
    name: 'USER_EMAIL_VERIFIED',
    module: 'user',
    description: 'User email verified successfully',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['userId', 'email', 'verifiedAt'],
    templateVariables: ['userId', 'userName', 'email', 'verifiedAt']
  },
  {
    name: 'USER_PASSWORD_CHANGED',
    module: 'user',
    description: 'User password changed successfully',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['userId', 'email', 'changedAt', 'ipAddress'],
    templateVariables: ['userId', 'userName', 'email', 'changedAt', 'ipAddress', 'deviceInfo']
  },
  {
    name: 'USER_PROFILE_UPDATED',
    module: 'user',
    description: 'User profile information updated',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.LOW,
    requiredData: ['userId', 'updatedFields', 'updatedAt'],
    templateVariables: ['userId', 'userName', 'updatedFields', 'updatedAt']
  },
  {
    name: 'USER_LOGIN_SUCCESS',
    module: 'user',
    description: 'User successfully logged in',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.LOW,
    requiredData: ['userId', 'loginAt', 'ipAddress', 'deviceInfo'],
    templateVariables: ['userId', 'userName', 'loginAt', 'ipAddress', 'deviceInfo', 'location']
  },
  {
    name: 'USER_LOGIN_FAILED',
    module: 'user',
    description: 'User login attempt failed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['userId', 'email', 'failureReason', 'ipAddress', 'attemptedAt'],
    templateVariables: ['userId', 'userName', 'email', 'failureReason', 'ipAddress', 'attemptedAt', 'location']
  },
  {
    name: 'USER_ACCOUNT_SUSPENDED',
    module: 'user',
    description: 'User account suspended by admin',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['userId', 'email', 'suspensionReason', 'suspendedBy', 'suspendedAt'],
    templateVariables: ['userId', 'userName', 'email', 'suspensionReason', 'suspendedBy', 'suspendedAt']
  },
  {
    name: 'USER_ACCOUNT_REACTIVATED',
    module: 'user',
    description: 'User account reactivated by admin',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['userId', 'email', 'reactivatedBy', 'reactivatedAt'],
    templateVariables: ['userId', 'userName', 'email', 'reactivatedBy', 'reactivatedAt']
  },
  {
    name: 'USER_ROLE_CHANGED',
    module: 'user',
    description: 'User role changed by admin',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['userId', 'email', 'oldRole', 'newRole', 'changedBy'],
    templateVariables: ['userId', 'userName', 'email', 'oldRole', 'newRole', 'changedBy', 'changedAt']
  },
  {
    name: 'USER_PASSWORD_RESET_REQUESTED',
    module: 'user',
    description: 'User requested password reset',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['userId', 'email', 'resetToken', 'requestedAt', 'ipAddress'],
    templateVariables: ['userId', 'userName', 'email', 'resetToken', 'requestedAt', 'ipAddress']
  },
  {
    name: 'USER_PASSWORD_RESET_COMPLETED',
    module: 'user',
    description: 'User completed password reset',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['userId', 'email', 'resetAt', 'ipAddress'],
    templateVariables: ['userId', 'userName', 'email', 'resetAt', 'ipAddress', 'deviceInfo']
  },
  {
    name: 'USER_EMAIL_CHANGED',
    module: 'user',
    description: 'User email address changed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['userId', 'oldEmail', 'newEmail', 'changedAt', 'ipAddress'],
    templateVariables: ['userId', 'userName', 'oldEmail', 'newEmail', 'changedAt', 'ipAddress']
  },
  {
    name: 'USER_PHONE_CHANGED',
    module: 'user',
    description: 'User phone number changed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['userId', 'oldPhone', 'newPhone', 'changedAt', 'ipAddress'],
    templateVariables: ['userId', 'userName', 'oldPhone', 'newPhone', 'changedAt', 'ipAddress']
  },
  {
    name: 'USER_SESSION_EXPIRED',
    module: 'user',
    description: 'User session expired due to inactivity',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.LOW,
    requiredData: ['userId', 'expiredAt', 'lastActivity'],
    templateVariables: ['userId', 'userName', 'expiredAt', 'lastActivity']
  },
  {
    name: 'USER_SECURITY_ALERT',
    module: 'user',
    description: 'Security alert for suspicious activity',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.URGENT,
    requiredData: ['userId', 'email', 'alertType', 'description', 'ipAddress', 'alertAt'],
    templateVariables: ['userId', 'userName', 'email', 'alertType', 'description', 'ipAddress', 'location', 'alertAt']
  },
  {
    name: 'USER_SUBSCRIPTION_RENEWED',
    module: 'user',
    description: 'User subscription renewed successfully',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['userId', 'subscriptionType', 'renewedAt', 'nextBillingDate'],
    templateVariables: ['userId', 'userName', 'subscriptionType', 'renewedAt', 'nextBillingDate', 'amount']
  },
  {
    name: 'USER_SUBSCRIPTION_CANCELLED',
    module: 'user',
    description: 'User subscription cancelled',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['userId', 'subscriptionType', 'cancelledAt', 'reason'],
    templateVariables: ['userId', 'userName', 'subscriptionType', 'cancelledAt', 'reason', 'validUntil']
  },
  {
    name: 'USER_BIRTHDAY_REMINDER',
    module: 'user',
    description: 'User birthday reminder with special offers',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.PUSH, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.LOW,
    requiredData: ['userId', 'email', 'birthDate', 'offers'],
    templateVariables: ['userId', 'userName', 'email', 'birthDate', 'offers', 'discountCode']
  }
];

// Helper functions for user events
export const getUserEvent = (eventName: string): NotificationEvent | undefined => {
  return USER_EVENTS.find(event => event.name === eventName);
};

export const isValidUserEvent = (eventName: string): boolean => {
  return USER_EVENTS.some(event => event.name === eventName);
};

export const getUserEventNames = (): string[] => {
  return USER_EVENTS.map(event => event.name);
};

export const getUserEventsByPriority = (priority: NotificationPriority): NotificationEvent[] => {
  return USER_EVENTS.filter(event => event.defaultPriority === priority);
};

export const getUserEmailEvents = (): NotificationEvent[] => {
  return USER_EVENTS.filter(event => 
    event.defaultChannels.includes(NotificationChannel.EMAIL)
  );
};

export const getUserUrgentEvents = (): NotificationEvent[] => {
  return USER_EVENTS.filter(event => 
    event.defaultPriority === NotificationPriority.URGENT
  );
};

export const getUserSecurityEvents = (): NotificationEvent[] => {
  return USER_EVENTS.filter(event => 
    event.name.includes('SECURITY') || 
    event.name.includes('LOGIN_FAILED') ||
    event.name.includes('PASSWORD') ||
    event.name.includes('SUSPENDED')
  );
};

export const getUserAccountEvents = (): NotificationEvent[] => {
  return USER_EVENTS.filter(event => 
    event.name.includes('ACCOUNT') ||
    event.name.includes('ROLE_CHANGED') ||
    event.name.includes('PROFILE_UPDATED')
  );
};
