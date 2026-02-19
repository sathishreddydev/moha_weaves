/**
 * Centralized logging utility for store module
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  error?: any;
}

class StoreLogger {
  private static isDevelopment = process.env.NODE_ENV === 'development';

  static log(level: LogLevel, message: string, context?: string, error?: any): void {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error
    };

    // In development, log to console with colors
    if (StoreLogger.isDevelopment) {
      const colors = {
        [LogLevel.ERROR]: '\x1b[31m', // Red
        [LogLevel.WARN]: '\x1b[33m', // Yellow
        [LogLevel.INFO]: '\x1b[36m', // Cyan
        [LogLevel.DEBUG]: '\x1b[37m', // White
      };
      
      const resetColor = '\x1b[0m';
      const prefix = colors[level] || '';
      
      console.log(
        `${prefix}[${level.toUpperCase()}]${resetColor} ${message}${resetColor}`,
        context ? ` (${context})` : '',
        error ? `\nError: ${error}` : ''
      );
    } else {
      // In production, you could send to external logging service
      // For now, we'll use structured console output
      console.log(JSON.stringify(logEntry));
    }
  }

  static error(message: string, context?: string, error?: any): void {
    StoreLogger.log(LogLevel.ERROR, message, context, error);
  }

  static warn(message: string, context?: string): void {
    StoreLogger.log(LogLevel.WARN, message, context);
  }

  static info(message: string, context?: string): void {
    StoreLogger.log(LogLevel.INFO, message, context);
  }

  static debug(message: string, context?: string): void {
    StoreLogger.log(LogLevel.DEBUG, message, context);
  }
}

export default StoreLogger;
