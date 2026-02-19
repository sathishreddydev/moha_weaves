/**
 * Standardized error handling for store module
 */

export enum StoreErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  UNAUTHORIZED = 'UNAUTHORIZED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface StoreError {
  type: StoreErrorType;
  message: string;
  statusCode: number;
  details?: any;
}

export class StoreErrorHandler {
  static createError(
    type: StoreErrorType,
    message: string,
    details?: any
  ): StoreError {
    const statusCodeMap = {
      [StoreErrorType.VALIDATION_ERROR]: 400,
      [StoreErrorType.NOT_FOUND]: 404,
      [StoreErrorType.INSUFFICIENT_STOCK]: 400,
      [StoreErrorType.UNAUTHORIZED]: 401,
      [StoreErrorType.DATABASE_ERROR]: 500,
      [StoreErrorType.BUSINESS_LOGIC_ERROR]: 400,
      [StoreErrorType.INTERNAL_ERROR]: 500
    };

    return {
      type,
      message,
      statusCode: statusCodeMap[type],
      details
    };
  }

  static handleValidationError(message: string, details?: any): StoreError {
    return this.createError(StoreErrorType.VALIDATION_ERROR, message, details);
  }

  static handleNotFoundError(resource: string, id?: string): StoreError {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    return this.createError(StoreErrorType.NOT_FOUND, message);
  }

  static handleInsufficientStockError(
    item: string, 
    available: number, 
    requested: number
  ): StoreError {
    return this.createError(
      StoreErrorType.INSUFFICIENT_STOCK,
      `Insufficient stock for ${item}. Available: ${available}, Requested: ${requested}`
    );
  }

  static handleUnauthorizedError(message: string = 'Unauthorized access'): StoreError {
    return this.createError(StoreErrorType.UNAUTHORIZED, message);
  }

  static handleDatabaseError(error: any): StoreError {
    console.error('Database error:', error);
    return this.createError(
      StoreErrorType.DATABASE_ERROR,
      'Database operation failed',
      process.env.NODE_ENV === 'development' ? error.message : undefined
    );
  }

  static handleBusinessLogicError(message: string, details?: any): StoreError {
    return this.createError(StoreErrorType.BUSINESS_LOGIC_ERROR, message, details);
  }

  static handleInternalError(error: any): StoreError {
    console.error('Internal error:', error);
    return this.createError(
      StoreErrorType.INTERNAL_ERROR,
      'An internal error occurred',
      process.env.NODE_ENV === 'development' ? error.message : undefined
    );
  }

  /**
   * Express middleware to handle StoreError instances
   */
  static middleware() {
    return (error: any, req: any, res: any, next: any) => {
      if (error.type && Object.values(StoreErrorType).includes(error.type)) {
        return res.status(error.statusCode).json({
          error: error.message,
          type: error.type,
          ...(error.details && { details: error.details })
        });
      }

      // Handle non-StoreError instances
      console.error('Unhandled error:', error);
      return res.status(500).json({
        error: 'An unexpected error occurred',
        type: StoreErrorType.INTERNAL_ERROR
      });
    };
  }
}

/**
 * Utility function to wrap async route handlers with error handling
 */
export function withErrorHandling(handler: Function) {
  return async (req: any, res: any, next: any) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
