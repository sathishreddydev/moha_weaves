// Main entry point for the Universal Notification System
export * from './types';
export * from './config';
export * from './events';

// Services
export { NotificationService } from './services/notificationService';
export { UserPreferenceService } from './services/preferenceService';
export { TemplateService } from './services/templateService';
export { QueueService } from './services/queueService';

// Channels
export { WebSocketChannel } from './channels/websocket';
export { EmailChannel } from './channels/email';
export { InAppChannel } from './channels/inApp';

// Main notification manager
export { NotificationManager, notificationManager } from './notificationManager';
