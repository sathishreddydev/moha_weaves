import { NotificationEvent, NotificationChannel, NotificationPriority } from '../types';

// Admin module notification events
export const ADMIN_EVENTS: NotificationEvent[] = [
  {
    name: 'SYSTEM_BACKUP_COMPLETED',
    module: 'admin',
    description: 'System backup completed successfully',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['backupId', 'backupType', 'size', 'duration', 'completedBy'],
    templateVariables: ['backupId', 'backupType', 'size', 'duration', 'completedBy', 'completedAt']
  },
  {
    name: 'SYSTEM_BACKUP_FAILED',
    module: 'admin',
    description: 'System backup failed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['backupId', 'backupType', 'failureReason', 'attemptedAt'],
    templateVariables: ['backupId', 'backupType', 'failureReason', 'attemptedAt', 'nextRetry']
  },
  {
    name: 'SYSTEM_MAINTENANCE_SCHEDULED',
    module: 'admin',
    description: 'System maintenance scheduled',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['maintenanceId', 'scheduledAt', 'duration', 'affectedServices', 'scheduledBy'],
    templateVariables: ['maintenanceId', 'scheduledAt', 'duration', 'affectedServices', 'scheduledBy', 'description']
  },
  {
    name: 'SYSTEM_MAINTENANCE_STARTED',
    module: 'admin',
    description: 'System maintenance started',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['maintenanceId', 'startedAt', 'affectedServices'],
    templateVariables: ['maintenanceId', 'startedAt', 'affectedServices', 'estimatedDuration']
  },
  {
    name: 'SYSTEM_MAINTENANCE_COMPLETED',
    module: 'admin',
    description: 'System maintenance completed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['maintenanceId', 'completedAt', 'duration', 'status'],
    templateVariables: ['maintenanceId', 'completedAt', 'duration', 'status', 'summary']
  },
  {
    name: 'DATABASE_PERFORMANCE_ALERT',
    module: 'admin',
    description: 'Database performance issue detected',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['metricType', 'currentValue', 'threshold', 'alertTime'],
    templateVariables: ['metricType', 'currentValue', 'threshold', 'alertTime', 'recommendations']
  },
  {
    name: 'SERVER_DISK_SPACE_WARNING',
    module: 'admin',
    description: 'Server disk space running low',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['serverId', 'usedSpace', 'totalSpace', 'usagePercentage'],
    templateVariables: ['serverId', 'usedSpace', 'totalSpace', 'usagePercentage', 'alertTime', 'recommendedAction']
  },
  {
    name: 'SERVER_DISK_SPACE_CRITICAL',
    module: 'admin',
    description: 'Server disk space critically low',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.URGENT,
    requiredData: ['serverId', 'usedSpace', 'totalSpace', 'usagePercentage'],
    templateVariables: ['serverId', 'usedSpace', 'totalSpace', 'usagePercentage', 'alertTime', 'immediateAction']
  },
  {
    name: 'API_RATE_LIMIT_EXCEEDED',
    module: 'admin',
    description: 'API rate limit exceeded for user/service',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['userId', 'endpoint', 'requestCount', 'limit', 'timeWindow'],
    templateVariables: ['userId', 'endpoint', 'requestCount', 'limit', 'timeWindow', 'alertTime']
  },
  {
    name: 'SECURITY_BREACH_DETECTED',
    module: 'admin',
    description: 'Security breach detected in system',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.URGENT,
    requiredData: ['breachType', 'severity', 'affectedSystems', 'detectedAt', 'ipAddress'],
    templateVariables: ['breachType', 'severity', 'affectedSystems', 'detectedAt', 'ipAddress', 'immediateActions']
  },
  {
    name: 'NEW_USER_REGISTRATION_SPIKE',
    module: 'admin',
    description: 'Unusual spike in user registrations',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['registrationCount', 'timeWindow', 'baselineCount', 'spikePercentage'],
    templateVariables: ['registrationCount', 'timeWindow', 'baselineCount', 'spikePercentage', 'alertTime', 'requiresInvestigation']
  },
  {
    name: 'PAYMENT_PROCESSOR_DOWN',
    module: 'admin',
    description: 'Payment processor service is down',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['processorName', 'downAt', 'affectedTransactions', 'estimatedRecovery'],
    templateVariables: ['processorName', 'downAt', 'affectedTransactions', 'estimatedRecovery', 'fallbackActive']
  },
  {
    name: 'EMAIL_SERVICE_DOWN',
    module: 'admin',
    description: 'Email service is not responding',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['serviceName', 'downAt', 'queuedEmails', 'lastSuccessfulDelivery'],
    templateVariables: ['serviceName', 'downAt', 'queuedEmails', 'lastSuccessfulDelivery', 'troubleshootingSteps']
  },
  {
    name: 'WEEKLY_REPORT_GENERATED',
    module: 'admin',
    description: 'Weekly system report generated',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.LOW,
    requiredData: ['reportId', 'reportType', 'period', 'generatedBy'],
    templateVariables: ['reportId', 'reportType', 'period', 'generatedBy', 'generatedAt', 'keyMetrics']
  },
  {
    name: 'MONTHLY_BILLING_REPORT',
    module: 'admin',
    description: 'Monthly billing and revenue report',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['reportId', 'month', 'year', 'totalRevenue', 'totalOrders'],
    templateVariables: ['reportId', 'month', 'year', 'totalRevenue', 'totalOrders', 'growthRate', 'generatedAt']
  },
  {
    name: 'STAFF_PERFORMANCE_REVIEW',
    module: 'admin',
    description: 'Staff performance review reminder',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['reviewPeriod', 'staffCount', 'dueDate'],
    templateVariables: ['reviewPeriod', 'staffCount', 'dueDate', 'reviewLink', 'reminderAt']
  },
  {
    name: 'COMPLIANCE_REPORT_DUE',
    module: 'admin',
    description: 'Compliance report due for submission',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['reportType', 'dueDate', 'requiredBy', 'complianceBody'],
    templateVariables: ['reportType', 'dueDate', 'requiredBy', 'complianceBody', 'reportLink', 'overdueIn']
  },
  {
    name: 'THIRD_PARTY_SERVICE_UPDATE',
    module: 'admin',
    description: 'Third-party service update or maintenance',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['serviceName', 'updateType', 'scheduledAt', 'duration', 'impact'],
    templateVariables: ['serviceName', 'updateType', 'scheduledAt', 'duration', 'impact', 'actionRequired']
  },
  {
    name: 'DATA_EXPORT_COMPLETED',
    module: 'admin',
    description: 'Data export request completed',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.NORMAL,
    requiredData: ['exportId', 'requestedBy', 'recordCount', 'fileSize', 'downloadUrl'],
    templateVariables: ['exportId', 'requestedBy', 'recordCount', 'fileSize', 'downloadUrl', 'expiresAt']
  },
  {
    name: 'CRITICAL_ERROR_LOGGED',
    module: 'admin',
    description: 'Critical error logged in system',
    defaultChannels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
    defaultPriority: NotificationPriority.HIGH,
    requiredData: ['errorId', 'errorType', 'errorMessage', 'stackTrace', 'occurredAt'],
    templateVariables: ['errorId', 'errorType', 'errorMessage', 'stackTrace', 'occurredAt', 'affectedUsers']
  }
];

// Helper functions for admin events
export const getAdminEvent = (eventName: string): NotificationEvent | undefined => {
  return ADMIN_EVENTS.find(event => event.name === eventName);
};

export const isValidAdminEvent = (eventName: string): boolean => {
  return ADMIN_EVENTS.some(event => event.name === eventName);
};

export const getAdminEventNames = (): string[] => {
  return ADMIN_EVENTS.map(event => event.name);
};

export const getAdminEventsByPriority = (priority: NotificationPriority): NotificationEvent[] => {
  return ADMIN_EVENTS.filter(event => event.defaultPriority === priority);
};

export const getAdminEmailEvents = (): NotificationEvent[] => {
  return ADMIN_EVENTS.filter(event => 
    event.defaultChannels.includes(NotificationChannel.EMAIL)
  );
};

export const getAdminUrgentEvents = (): NotificationEvent[] => {
  return ADMIN_EVENTS.filter(event => 
    event.defaultPriority === NotificationPriority.URGENT
  );
};

export const getAdminSystemEvents = (): NotificationEvent[] => {
  return ADMIN_EVENTS.filter(event => 
    event.name.includes('SYSTEM') ||
    event.name.includes('SERVER') ||
    event.name.includes('DATABASE')
  );
};

export const getAdminSecurityEvents = (): NotificationEvent[] => {
  return ADMIN_EVENTS.filter(event => 
    event.name.includes('SECURITY') ||
    event.name.includes('BREACH') ||
    event.name.includes('RATE_LIMIT')
  );
};

export const getAdminReportEvents = (): NotificationEvent[] => {
  return ADMIN_EVENTS.filter(event => 
    event.name.includes('REPORT') ||
    event.name.includes('BILLING') ||
    event.name.includes('PERFORMANCE')
  );
};
