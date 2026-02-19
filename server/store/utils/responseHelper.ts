/**
 * Standardized response helpers for store module
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  type?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message
  };
}

/**
 * Error response helper
 */
export function errorResponse(
  error: string,
  type?: string,
  details?: any
): ApiResponse {
  return {
    success: false,
    error,
    type,
    details
  };
}

/**
 * Paginated response helper
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    }
  };
}

/**
 * Express response wrapper for consistent responses
 */
export function sendSuccess<T>(
  res: any,
  data: T,
  message?: string,
  statusCode: number = 200
) {
  return res.status(statusCode).json(successResponse(data, message));
}

/**
 * Express error response wrapper
 */
export function sendError(
  res: any,
  error: string,
  type?: string,
  details?: any,
  statusCode: number = 400
) {
  return res.status(statusCode).json(errorResponse(error, type, details));
}

/**
 * Express paginated response wrapper
 */
export function sendPaginated<T>(
  res: any,
  data: T[],
  total: number,
  limit: number,
  offset: number,
  statusCode: number = 200
) {
  return res.status(statusCode).json(paginatedResponse(data, total, limit, offset));
}
