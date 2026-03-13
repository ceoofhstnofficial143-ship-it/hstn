// Comprehensive Error Handling Without Information Leakage
// Prevents sensitive data exposure while maintaining user experience

import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from './audit-logging';

// Error types for consistent handling
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Structured error interface
export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string; // User-friendly message
  internalMessage?: string; // Internal details (not exposed)
  code?: string;
  statusCode: number;
  details?: Record<string, any>; // Additional context (not exposed)
  timestamp: Date;
  requestId?: string;
}

// Error messages (user-safe, no sensitive data)
export const ERROR_MESSAGES = {
  [ErrorType.VALIDATION_ERROR]: 'The provided data is invalid. Please check your input.',
  [ErrorType.AUTHENTICATION_ERROR]: 'Authentication required. Please log in.',
  [ErrorType.AUTHORIZATION_ERROR]: 'You do not have permission to perform this action.',
  [ErrorType.DATABASE_ERROR]: 'A database error occurred. Please try again later.',
  [ErrorType.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [ErrorType.RATE_LIMIT_ERROR]: 'Too many requests. Please wait and try again.',
  [ErrorType.SECURITY_ERROR]: 'Security violation detected.',
  [ErrorType.BUSINESS_LOGIC_ERROR]: 'The requested operation cannot be completed.',
  [ErrorType.SYSTEM_ERROR]: 'An unexpected error occurred. Please try again later.'
};

// Create standardized error
export function createError(
  type: ErrorType,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  internalMessage?: string,
  details?: Record<string, any>,
  statusCode?: number
): AppError {
  const defaultStatusCode = getStatusCodeForError(type);
  const finalStatusCode = statusCode || defaultStatusCode;

  return {
    type,
    severity,
    message: ERROR_MESSAGES[type],
    internalMessage,
    statusCode: finalStatusCode,
    details,
    timestamp: new Date(),
    requestId: generateRequestId()
  };
}

// Get appropriate HTTP status code for error type
function getStatusCodeForError(type: ErrorType): number {
  switch (type) {
    case ErrorType.VALIDATION_ERROR:
      return 400;
    case ErrorType.AUTHENTICATION_ERROR:
      return 401;
    case ErrorType.AUTHORIZATION_ERROR:
      return 403;
    case ErrorType.RATE_LIMIT_ERROR:
      return 429;
    case ErrorType.SECURITY_ERROR:
      return 403;
    case ErrorType.DATABASE_ERROR:
    case ErrorType.SYSTEM_ERROR:
      return 500;
    case ErrorType.NETWORK_ERROR:
      return 503;
    default:
      return 500;
  }
}

// Generate unique request ID for tracking
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Convert error to safe response
export function errorToResponse(error: AppError | Error, request?: NextRequest): NextResponse {
  let appError: AppError;

  if (error instanceof Error && !(error as any).type) {
    // Convert generic Error to AppError
    appError = createError(
      ErrorType.SYSTEM_ERROR,
      ErrorSeverity.HIGH,
      error.message,
      { stack: error.stack }
    );
  } else {
    appError = error as AppError;
  }

  // Log error internally (with sensitive details)
  logErrorInternally(appError, request);

  // Return safe response (no sensitive data)
  const safeResponse: {
    error: {
      message: string;
      code?: string;
      requestId?: string;
      details?: any;
    }
  } = {
    error: {
      message: appError.message,
      code: appError.code,
      requestId: appError.requestId
    }
  };

  // Include additional details for development
  if (process.env.NODE_ENV === 'development') {
    safeResponse.error.details = {
      type: appError.type,
      severity: appError.severity,
      timestamp: appError.timestamp
    };
  }

  return NextResponse.json(safeResponse, {
    status: appError.statusCode,
    headers: {
      'X-Request-ID': appError.requestId || '',
      'X-Error-Type': appError.type
    }
  });
}

// Log error internally with full details
function logErrorInternally(error: AppError, request?: NextRequest): void {
  const logData = {
    type: error.type,
    severity: error.severity,
    internalMessage: error.internalMessage,
    details: error.details,
    statusCode: error.statusCode,
    requestId: error.requestId,
    timestamp: error.timestamp,
    request: request ? {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    } : undefined
  };

  // Log based on severity
  if (error.severity === ErrorSeverity.CRITICAL) {
    console.error('🚨 CRITICAL ERROR:', logData);
    logAuditEvent('system_error', request || null, logData);
  } else if (error.severity === ErrorSeverity.HIGH) {
    console.error('⚠️ HIGH SEVERITY ERROR:', logData);
    logAuditEvent('system_error', request || null, logData);
  } else {
    console.warn('⚡ ERROR:', logData);
  }

  // In production, send to error monitoring service
  // sendToErrorMonitoring(logData);
}

// Error boundary for React components
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const appError = createError(
      ErrorType.SYSTEM_ERROR,
      ErrorSeverity.HIGH,
      error.message,
      {
        componentStack: errorInfo.componentStack,
        stack: error.stack
      }
    );

    logErrorInternally(appError);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return React.createElement(FallbackComponent, { error: this.state.error! });
    }

    return this.props.children;
  }
}

// Default error fallback component
function DefaultErrorFallback({ error }: { error: Error }) {
  return React.createElement('div', { className: 'min-h-screen flex items-center justify-center bg-background' },
    React.createElement('div', { className: 'text-center p-8' },
      React.createElement('h1', { className: 'text-2xl font-bold text-red-600 mb-4' }, 'Something went wrong'),
      React.createElement('p', { className: 'text-muted mb-4' }, 'We encountered an unexpected error. Please try refreshing the page.'),
      process.env.NODE_ENV === 'development' && React.createElement('details', { className: 'text-left bg-gray-100 p-4 rounded' },
        React.createElement('summary', { className: 'cursor-pointer font-semibold' }, 'Error Details (Dev Only)'),
        React.createElement('pre', { className: 'mt-2 text-sm overflow-auto' }, error.message)
      ),
      React.createElement('button', {
        onClick: () => window.location.reload(),
        className: 'mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/80'
      }, 'Refresh Page')
    )
  );
}

// Async error handler wrapper
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R> | R,
  errorType: ErrorType = ErrorType.SYSTEM_ERROR
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        throw createError(errorType, ErrorSeverity.MEDIUM, error.message);
      }
      throw createError(errorType, ErrorSeverity.MEDIUM, 'Unknown error occurred');
    }
  };
}

// Database error sanitizer
export function sanitizeDatabaseError(error: any): AppError {
  // Don't expose database internal details
  let message = 'Database operation failed';

  if (error?.code) {
    // Handle specific database error codes
    switch (error.code) {
      case '23505': // Unique violation
        return createError(ErrorType.VALIDATION_ERROR, ErrorSeverity.LOW, error.message);
      case '23503': // Foreign key violation
        return createError(ErrorType.VALIDATION_ERROR, ErrorSeverity.LOW, 'Related data not found');
      case '42501': // Insufficient privilege
        return createError(ErrorType.AUTHORIZATION_ERROR, ErrorSeverity.MEDIUM, error.message);
      default:
        // Log internal details but return generic message
        console.warn('Database error:', error);
        break;
    }
  }

  return createError(ErrorType.DATABASE_ERROR, ErrorSeverity.MEDIUM, error?.message || message);
}

// API error handler
export function handleAPIError(error: any, request: NextRequest): NextResponse {
  let appError: AppError;

  if (error?.type && typeof error.type === 'string') {
    // Already an AppError
    appError = error as AppError;
  } else if (error?.code === 'PGRST116') {
    // Supabase auth error
    appError = createError(ErrorType.AUTHENTICATION_ERROR, ErrorSeverity.MEDIUM, error.message);
  } else if (error?.code?.startsWith('23')) {
    // Database constraint errors
    appError = sanitizeDatabaseError(error);
  } else if (error?.message?.includes('JWT')) {
    // JWT/auth related errors
    appError = createError(ErrorType.AUTHENTICATION_ERROR, ErrorSeverity.MEDIUM, error.message);
  } else {
    // Generic error
    appError = createError(ErrorType.SYSTEM_ERROR, ErrorSeverity.MEDIUM, error?.message);
  }

  return errorToResponse(appError, request);
}

// Validation error formatter
export function formatValidationErrors(errors: any[]): AppError {
  const errorMessages = errors.map(err =>
    typeof err === 'string' ? err : err.message || 'Validation failed'
  );

  return createError(
    ErrorType.VALIDATION_ERROR,
    ErrorSeverity.LOW,
    errorMessages.join('; '),
    { validationErrors: errors }
  );
}

// Security violation detector
export function detectSecurityViolation(error: any, request: NextRequest): boolean {
  const securityIndicators = [
    'sql',
    'script',
    'javascript',
    'eval',
    'document.cookie',
    'localStorage',
    'sessionStorage',
    'XMLHttpRequest',
    'fetch'
  ];

  const errorMessage = error?.message || '';
  const hasSecurityIndicator = securityIndicators.some(indicator =>
    errorMessage.toLowerCase().includes(indicator)
  );

  if (hasSecurityIndicator) {
    logAuditEvent('security_violation_detected', request, {
      errorMessage,
      securityIndicators: securityIndicators.filter(ind =>
        errorMessage.toLowerCase().includes(ind)
      )
    });
    return true;
  }

  return false;
}
