/**
 * Error Handler Utility
 *
 * Provides safe error responses that don't leak sensitive information.
 * Full error details are logged server-side only.
 */

import type { Context } from 'hono';

/**
 * Error codes for categorizing errors
 */
export enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFLICT = 'CONFLICT',
}

/**
 * User-friendly error messages (German)
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.INTERNAL_ERROR]: 'Ein interner Fehler ist aufgetreten',
  [ErrorCode.VALIDATION_ERROR]: 'Ungültige Eingabedaten',
  [ErrorCode.NOT_FOUND]: 'Ressource nicht gefunden',
  [ErrorCode.UNAUTHORIZED]: 'Authentifizierung erforderlich',
  [ErrorCode.FORBIDDEN]: 'Zugriff verweigert',
  [ErrorCode.RATE_LIMITED]: 'Zu viele Anfragen, bitte später erneut versuchen',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service vorübergehend nicht verfügbar',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'Externer Service nicht erreichbar',
  [ErrorCode.CONFLICT]: 'Ressource existiert bereits',
};

/**
 * HTTP status codes for error types
 */
const ERROR_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.CONFLICT]: 409,
};

interface ErrorDetails {
  /** Error code for categorization */
  code?: ErrorCode;
  /** Custom user-facing message (optional) */
  message?: string;
  /** The original error (for logging) */
  error?: unknown;
  /** Additional context for logging */
  context?: Record<string, unknown>;
  /** Request ID for tracking (optional) */
  requestId?: string;
}

/**
 * Generate a simple request ID for error tracking
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Safely extract error stack from unknown error
 */
function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Log error details server-side
 */
function logError(requestId: string, details: ErrorDetails): void {
  const logData = {
    requestId,
    code: details.code || ErrorCode.INTERNAL_ERROR,
    message: getErrorMessage(details.error),
    stack: getErrorStack(details.error),
    context: details.context,
    timestamp: new Date().toISOString(),
  };

  // In production, you might want to send this to a logging service
  console.error('[Error]', JSON.stringify(logData, null, 2));
}

/**
 * Create a safe error response
 *
 * @param c - Hono context
 * @param details - Error details
 * @returns JSON response with safe error message
 */
export function errorResponse(c: Context, details: ErrorDetails) {
  const code = details.code || ErrorCode.INTERNAL_ERROR;
  const status = ERROR_STATUS[code];
  const requestId = details.requestId || generateRequestId();

  // Log full error details server-side
  if (details.error || details.context) {
    logError(requestId, details);
  }

  // Build client response
  const response: Record<string, unknown> = {
    error: details.message || ERROR_MESSAGES[code],
    code,
    requestId,
  };

  // In development, optionally include more details
  if (process.env.NODE_ENV === 'development' && process.env.DEBUG_ERRORS === 'true') {
    response.debug = {
      originalMessage: getErrorMessage(details.error),
      context: details.context,
    };
  }

  return c.json(response, status as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503);
}

/**
 * Convenience functions for common error types
 */

export function internalError(c: Context, error: unknown, context?: Record<string, unknown>) {
  return errorResponse(c, {
    code: ErrorCode.INTERNAL_ERROR,
    error,
    context,
  });
}

export function validationError(c: Context, message: string) {
  return errorResponse(c, {
    code: ErrorCode.VALIDATION_ERROR,
    message,
  });
}

export function notFoundError(c: Context, resource?: string) {
  return errorResponse(c, {
    code: ErrorCode.NOT_FOUND,
    message: resource ? `${resource} nicht gefunden` : undefined,
  });
}

export function unauthorizedError(c: Context) {
  return errorResponse(c, {
    code: ErrorCode.UNAUTHORIZED,
  });
}

export function forbiddenError(c: Context, message?: string) {
  return errorResponse(c, {
    code: ErrorCode.FORBIDDEN,
    message,
  });
}

export function conflictError(c: Context, message?: string) {
  return errorResponse(c, {
    code: ErrorCode.CONFLICT,
    message,
  });
}

export function serviceError(c: Context, error: unknown, serviceName?: string) {
  return errorResponse(c, {
    code: ErrorCode.EXTERNAL_SERVICE_ERROR,
    message: serviceName ? `${serviceName} ist nicht erreichbar` : undefined,
    error,
    context: { service: serviceName },
  });
}

/**
 * Wrap an async handler with automatic error handling
 */
export function withErrorHandling<T>(
  handler: (c: Context) => Promise<T>,
  context?: Record<string, unknown>
) {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      return internalError(c, error, context);
    }
  };
}
