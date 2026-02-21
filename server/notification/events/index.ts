// Central export for all notification events
import { NotificationEvent } from '../types';
import { NotificationChannel, NotificationPriority } from '../types';
import { INVENTORY_EVENTS } from './inventory';
import { ORDER_EVENTS } from './order';
import { USER_EVENTS } from './user';
import { ADMIN_EVENTS } from './admin';

// All events combined
export const ALL_EVENTS: NotificationEvent[] = [
  ...INVENTORY_EVENTS,
  ...ORDER_EVENTS,
  ...USER_EVENTS,
  ...ADMIN_EVENTS
];

// Events by module
export const EVENTS_BY_MODULE = {
  inventory: INVENTORY_EVENTS,
  order: ORDER_EVENTS,
  user: USER_EVENTS,
  admin: ADMIN_EVENTS
};

// Get event by name across all modules
export const getEvent = (eventName: string): NotificationEvent | undefined => {
  return ALL_EVENTS.find(event => event.name === eventName);
};

// Check if event is valid across all modules
export const isValidEvent = (eventName: string): boolean => {
  return ALL_EVENTS.some(event => event.name === eventName);
};

// Get all event names
export const getAllEventNames = (): string[] => {
  return ALL_EVENTS.map(event => event.name);
};

// Get events by module
export const getEventsByModule = (module: string): NotificationEvent[] => {
  return EVENTS_BY_MODULE[module as keyof typeof EVENTS_BY_MODULE] || [];
};

// Get events by priority across all modules
export const getEventsByPriority = (priority: NotificationPriority): NotificationEvent[] => {
  return ALL_EVENTS.filter(event => event.defaultPriority === priority);
};

// Get events that require specific channel
export const getEventsByChannel = (channel: NotificationChannel): NotificationEvent[] => {
  return ALL_EVENTS.filter(event => 
    event.defaultChannels.includes(channel)
  );
};

// Get urgent events across all modules
export const getUrgentEvents = (): NotificationEvent[] => {
  return ALL_EVENTS.filter(event => 
    event.defaultPriority === NotificationPriority.URGENT
  );
};

// Get events that require email notification
export const getEmailEvents = (): NotificationEvent[] => {
  return ALL_EVENTS.filter(event => 
    event.defaultChannels.includes(NotificationChannel.EMAIL)
  );
};

// Get events that require SMS notification
export const getSMSEvents = (): NotificationEvent[] => {
  return ALL_EVENTS.filter(event => 
    event.defaultChannels.includes(NotificationChannel.SMS)
  );
};

// Get events that require push notification
export const getPushEvents = (): NotificationEvent[] => {
  return ALL_EVENTS.filter(event => 
    event.defaultChannels.includes(NotificationChannel.PUSH)
  );
};

// Validate event data
export const validateEventData = (eventName: string, data: Record<string, any>): { isValid: boolean; missingFields: string[] } => {
  const event = getEvent(eventName);
  if (!event) {
    return { isValid: false, missingFields: ['Event not found'] };
  }

  const missingFields: string[] = [];
  event.requiredData.forEach(field => {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      missingFields.push(field);
    }
  });

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

// Get template variables for an event
export const getTemplateVariables = (eventName: string): string[] => {
  const event = getEvent(eventName);
  return event?.templateVariables || [];
};

// Check if event requires specific role permissions
export const getEventRequiredRoles = (eventName: string): string[] => {
  const event = getEvent(eventName);
  
  // Define role requirements based on event patterns
  const roleRequirements: Record<string, string[]> = {
    // Admin events
    'SYSTEM_': ['admin'],
    'DATABASE_': ['admin'],
    'SERVER_': ['admin'],
    'SECURITY_': ['admin', 'security'],
    'COMPLIANCE_': ['admin', 'compliance'],
    
    // Inventory events
    'STOCK_REQUEST_': ['inventory', 'admin'],
    'LOW_STOCK_': ['inventory', 'store', 'admin'],
    'CRITICAL_LOW_STOCK': ['inventory', 'store', 'admin'],
    'INVENTORY_RECONCILIATION_': ['inventory', 'admin'],
    'BATCH_STOCK_UPDATE_': ['inventory', 'admin'],
    
    // Order events
    'ORDER_': ['order', 'store', 'admin'],
    
    // User events
    'USER_ACCOUNT_': ['admin'],
    'USER_ROLE_': ['admin'],
    'USER_SECURITY_': ['admin', 'security'],
    
    // Default - no specific role requirements
  };

  for (const [pattern, roles] of Object.entries(roleRequirements)) {
    if (eventName.startsWith(pattern)) {
      return roles;
    }
  }

  return []; // No specific role requirements
};

// Get events that a specific role can access
export const getEventsForRole = (role: string): NotificationEvent[] => {
  return ALL_EVENTS.filter(event => {
    const requiredRoles = getEventRequiredRoles(event.name);
    return requiredRoles.length === 0 || requiredRoles.includes(role);
  });
};

// Export all modules for easy importing
export * from './inventory';
export * from './order';
export * from './user';
export * from './admin';
