// Custom error types for inventory system
export class InventoryError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class StockValidationError extends InventoryError {
  constructor(message: string, details?: any) {
    super(message, 'STOCK_VALIDATION_ERROR', 400, details);
    this.name = 'StockValidationError';
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productId}. Requested: ${requested}, Available: ${available}`,
      'INSUFFICIENT_STOCK',
      400,
      { productId, requested, available }
    );
    this.name = 'InsufficientStockError';
  }
}

export class ProductNotFoundError extends InventoryError {
  constructor(productId: string) {
    super(
      `Product not found: ${productId}`,
      'PRODUCT_NOT_FOUND',
      404,
      { productId }
    );
    this.name = 'ProductNotFoundError';
  }
}

export class DatabaseTransactionError extends InventoryError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_TRANSACTION_ERROR', 503, details);
    this.name = 'DatabaseTransactionError';
  }
}

export class InvalidAllocationError extends InventoryError {
  constructor(message: string, details?: any) {
    super(message, 'INVALID_ALLOCATION', 400, details);
    this.name = 'InvalidAllocationError';
  }
}

export class ConcurrentModificationError extends InventoryError {
  constructor(message: string, details?: any) {
    super(message, 'CONCURRENT_MODIFICATION', 409, details);
    this.name = 'ConcurrentModificationError';
  }
}

// Error handler utility
export const handleInventoryError = (error: any, devMode: boolean = false) => {
  console.error('Inventory Error:', error);

  if (error instanceof InventoryError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...(devMode && { details: error.details, stack: error.stack })
    };
  }

  // Handle specific database errors
  if (error.code === '23505') { // PostgreSQL unique violation
    return {
      message: 'Duplicate entry detected',
      code: 'DUPLICATE_ENTRY',
      statusCode: 409,
      ...(devMode && { details: error.detail, stack: error.stack })
    };
  }

  if (error.code === '23503') { // PostgreSQL foreign key violation
    return {
      message: 'Referenced record not found',
      code: 'FOREIGN_KEY_VIOLATION',
      statusCode: 400,
      ...(devMode && { details: error.detail, stack: error.stack })
    };
  }

  if (error.code === '23514') { // PostgreSQL check constraint violation
    return {
      message: 'Data validation failed',
      code: 'CONSTRAINT_VIOLATION',
      statusCode: 400,
      ...(devMode && { details: error.detail, stack: error.stack })
    };
  }

  // Generic error
  return {
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    ...(devMode && { details: error.message, stack: error.stack })
  };
};

// Validation utilities
export const validateStockAllocation = (totalStock: number, onlineStock: number, storeAllocations: any[]) => {
  const totalStoreStock = storeAllocations.reduce((sum, alloc) => sum + (alloc.quantity || 0), 0);
  const expectedTotal = onlineStock + totalStoreStock;

  if (totalStock < 0 || onlineStock < 0) {
    throw new StockValidationError('Stock values cannot be negative');
  }

  if (onlineStock > totalStock) {
    throw new StockValidationError('Online stock cannot exceed total stock');
  }

  if (expectedTotal !== totalStock) {
    throw new StockValidationError(
      `Stock allocation mismatch. Total: ${totalStock}, Online: ${onlineStock}, Store: ${totalStoreStock}, Expected: ${expectedTotal}`,
      { totalStock, onlineStock, totalStoreStock, expectedTotal }
    );
  }

  return true;
};

export const validateDistributionChannel = (distributionChannel: string, onlineStock: number, totalStoreStock: number) => {
  if (distributionChannel === 'online' && totalStoreStock > 0) {
    throw new InvalidAllocationError(
      'Distribution channel is "Online Only" but has store allocations',
      { distributionChannel, totalStoreStock }
    );
  }

  if (distributionChannel === 'shop' && onlineStock > 0) {
    throw new InvalidAllocationError(
      'Distribution channel is "Shop Only" but has online stock',
      { distributionChannel, onlineStock }
    );
  }

  return true;
};
