// Comprehensive Audit Logging & Security Monitoring
// Tracks all security events, user activities, and system changes

import { NextRequest } from 'next/server';

// Audit log entry structure
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  event: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource: string;
  action: string;
  outcome: 'success' | 'failure' | 'warning';
  details?: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Security event types
export const SECURITY_EVENTS = {
  // Authentication events
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
  PASSWORD_RESET_SUCCESS: 'password_reset_success',
  PASSWORD_RESET_FAILURE: 'password_reset_failure',

  // Authorization events
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  PERMISSION_DENIED: 'permission_denied',
  ELEVATED_PRIVILEGES: 'elevated_privileges',

  // Data access events
  DATA_ACCESS: 'data_access',
  DATA_MODIFICATION: 'data_modification',
  SENSITIVE_DATA_ACCESS: 'sensitive_data_access',

  // Security violations
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
  XSS_ATTEMPT: 'xss_attempt',
  CSRF_ATTEMPT: 'csrf_attempt',
  BRUTE_FORCE_ATTEMPT: 'brute_force_attempt',
  MALWARE_UPLOAD_ATTEMPT: 'malware_upload_attempt',

  // System events
  CONFIG_CHANGE: 'config_change',
  BACKUP_CREATED: 'backup_created',
  BACKUP_RESTORED: 'backup_restored',
  SYSTEM_ERROR: 'system_error',

  // Compliance events
  GDPR_DATA_REQUEST: 'gdpr_data_request',
  GDPR_DATA_DELETION: 'gdpr_data_deletion',
  PRIVACY_VIOLATION: 'privacy_violation'
};

// Risk level assessment
export function assessRiskLevel(event: string, details?: Record<string, any>): 'low' | 'medium' | 'high' | 'critical' {
  // High-risk events
  if ([
    SECURITY_EVENTS.UNAUTHORIZED_ACCESS,
    SECURITY_EVENTS.SQL_INJECTION_ATTEMPT,
    SECURITY_EVENTS.XSS_ATTEMPT,
    SECURITY_EVENTS.MALWARE_UPLOAD_ATTEMPT
  ].includes(event)) {
    return 'critical';
  }

  // Medium-risk events
  if ([
    SECURITY_EVENTS.LOGIN_FAILURE,
    SECURITY_EVENTS.BRUTE_FORCE_ATTEMPT,
    SECURITY_EVENTS.PERMISSION_DENIED,
    SECURITY_EVENTS.CSRF_ATTEMPT
  ].includes(event)) {
    return 'high';
  }

  // Low-risk events
  if ([
    SECURITY_EVENTS.LOGIN_SUCCESS,
    SECURITY_EVENTS.LOGOUT,
    SECURITY_EVENTS.DATA_ACCESS
  ].includes(event)) {
    return 'medium';
  }

  // Default to low risk
  return 'low';
}

// In-memory audit log (use database in production)
const auditLog: AuditLogEntry[] = [];
const MAX_LOG_ENTRIES = 10000; // Keep last 10k entries

// Add audit log entry
export function logAuditEvent(
  event: string,
  request: NextRequest | null,
  details?: Record<string, any>,
  userId?: string,
  sessionId?: string
): void {
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    event,
    userId,
    sessionId,
    ipAddress: request?.headers.get('x-forwarded-for') ||
              request?.headers.get('x-real-ip') ||
              'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown',
    resource: request?.url || 'unknown',
    action: event,
    outcome: details?.success === false ? 'failure' : 'success',
    details,
    riskLevel: assessRiskLevel(event, details)
  };

  auditLog.push(entry);

  // Maintain log size
  if (auditLog.length > MAX_LOG_ENTRIES) {
    auditLog.shift(); // Remove oldest entry
  }

  // Log critical events to console
  if (entry.riskLevel === 'critical') {
    console.error('🚨 CRITICAL SECURITY EVENT:', entry);
  } else if (entry.riskLevel === 'high') {
    console.warn('⚠️ HIGH RISK SECURITY EVENT:', entry);
  }

  // In production, send to external logging service
  // sendToExternalLogger(entry);
}

// Get audit logs with filtering
export function getAuditLogs(filters?: {
  userId?: string;
  event?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): AuditLogEntry[] {
  let filtered = [...auditLog];

  if (filters?.userId) {
    filtered = filtered.filter(entry => entry.userId === filters.userId);
  }

  if (filters?.event) {
    filtered = filtered.filter(entry => entry.event === filters.event);
  }

  if (filters?.riskLevel) {
    filtered = filtered.filter(entry => entry.riskLevel === filters.riskLevel);
  }

  if (filters?.startDate) {
    filtered = filtered.filter(entry => entry.timestamp >= filters.startDate!);
  }

  if (filters?.endDate) {
    filtered = filtered.filter(entry => entry.timestamp <= filters.endDate!);
  }

  // Sort by timestamp (newest first)
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return filters?.limit ? filtered.slice(0, filters.limit) : filtered;
}

// Security monitoring and alerting
export const securityMonitoring = {
  // Track suspicious patterns
  suspiciousPatterns: new Map<string, { count: number; lastSeen: Date; blocked: boolean }>(),

  // Report suspicious activity
  reportSuspiciousActivity: (
    type: string,
    identifier: string,
    request: NextRequest,
    details?: Record<string, any>
  ): void => {
    const key = `${type}:${identifier}`;
    const existing = securityMonitoring.suspiciousPatterns.get(key) || {
      count: 0,
      lastSeen: new Date(),
      blocked: false
    };

    existing.count += 1;
    existing.lastSeen = new Date();

    // Block after multiple incidents
    if (existing.count >= 5 && !existing.blocked) {
      existing.blocked = true;
      logAuditEvent(SECURITY_EVENTS.BRUTE_FORCE_ATTEMPT, request, {
        type,
        identifier,
        blocked: true,
        ...details
      });
    }

    securityMonitoring.suspiciousPatterns.set(key, existing);

    // Log the incident
    logAuditEvent(`${type}_attempt`, request, details);
  },

  // Check if identifier is blocked
  isBlocked: (type: string, identifier: string): boolean => {
    const key = `${type}:${identifier}`;
    return securityMonitoring.suspiciousPatterns.get(key)?.blocked || false;
  },

  // Unblock identifier
  unblock: (type: string, identifier: string): void => {
    const key = `${type}:${identifier}`;
    const existing = securityMonitoring.suspiciousPatterns.get(key);
    if (existing) {
      existing.blocked = false;
      existing.count = 0;
    }
  }
};

// Compliance logging (GDPR, etc.)
export const complianceLogger = {
  // Log data access for GDPR compliance
  logDataAccess: (
    userId: string,
    resource: string,
    purpose: string,
    request: NextRequest
  ): void => {
    logAuditEvent(SECURITY_EVENTS.DATA_ACCESS, request, {
      resource,
      purpose,
      compliance: 'gdpr'
    }, userId);
  },

  // Log data modification
  logDataModification: (
    userId: string,
    resource: string,
    action: 'create' | 'update' | 'delete',
    recordId: string,
    changes?: Record<string, any>,
    request?: NextRequest
  ): void => {
    logAuditEvent(SECURITY_EVENTS.DATA_MODIFICATION, request || null, {
      resource,
      action,
      recordId,
      changes,
      compliance: 'gdpr'
    }, userId);
  },

  // Log privacy-related events
  logPrivacyEvent: (
    userId: string,
    event: string,
    details: Record<string, any>,
    request: NextRequest
  ): void => {
    logAuditEvent(event, request, {
      ...details,
      compliance: 'gdpr'
    }, userId);
  }
};

// Performance monitoring
export const performanceMonitor = {
  // Track response times
  responseTimes: new Map<string, number[]>(),

  // Record response time
  recordResponseTime: (endpoint: string, timeMs: number): void => {
    const times = performanceMonitor.responseTimes.get(endpoint) || [];
    times.push(timeMs);

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }

    performanceMonitor.responseTimes.set(endpoint, times);
  },

  // Get average response time
  getAverageResponseTime: (endpoint: string): number => {
    const times = performanceMonitor.responseTimes.get(endpoint) || [];
    if (times.length === 0) return 0;

    return times.reduce((sum, time) => sum + time, 0) / times.length;
  },

  // Detect performance anomalies
  detectAnomalies: (endpoint: string, currentTime: number): boolean => {
    const avgTime = performanceMonitor.getAverageResponseTime(endpoint);
    const threshold = avgTime * 2; // 200% of average

    if (currentTime > threshold) {
      logAuditEvent('performance_anomaly', null, {
        endpoint,
        currentTime,
        averageTime: avgTime,
        threshold
      });
      return true;
    }

    return false;
  }
};

// Error tracking and monitoring
export const errorTracker = {
  // Track application errors
  errors: new Map<string, { count: number; lastSeen: Date; stackTrace?: string }>(),

  // Report application error
  reportError: (
    error: Error,
    request: NextRequest | null,
    context?: Record<string, any>
  ): void => {
    const errorKey = `${error.name}:${error.message}`;
    const existing = errorTracker.errors.get(errorKey) || {
      count: 0,
      lastSeen: new Date()
    };

    existing.count += 1;
    existing.lastSeen = new Date();
    existing.stackTrace = error.stack;

    errorTracker.errors.set(errorKey, existing);

    // Log security-related errors
    if (error.message.includes('SQL') || error.message.includes('auth')) {
      logAuditEvent(SECURITY_EVENTS.SYSTEM_ERROR, request, {
        error: error.message,
        stackTrace: error.stack,
        ...context
      });
    }
  },

  // Get error statistics
  getErrorStats: (): Array<{ error: string; count: number; lastSeen: Date }> => {
    return Array.from(errorTracker.errors.entries()).map(([error, data]) => ({
      error,
      count: data.count,
      lastSeen: data.lastSeen
    }));
  }
};

// Export audit data (for compliance/archiving)
export const auditExport = {
  // Export audit logs in JSON format
  exportLogs: (filters?: Parameters<typeof getAuditLogs>[0]): string => {
    const logs = getAuditLogs(filters);
    return JSON.stringify(logs, null, 2);
  },

  // Generate compliance report
  generateComplianceReport: (startDate: Date, endDate: Date): string => {
    const logs = getAuditLogs({ startDate, endDate });
    const report = {
      period: { start: startDate, end: endDate },
      totalEvents: logs.length,
      riskBreakdown: {
        critical: logs.filter(l => l.riskLevel === 'critical').length,
        high: logs.filter(l => l.riskLevel === 'high').length,
        medium: logs.filter(l => l.riskLevel === 'medium').length,
        low: logs.filter(l => l.riskLevel === 'low').length
      },
      topEvents: logs.reduce((acc, log) => {
        acc[log.event] = (acc[log.event] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      logs
    };

    return JSON.stringify(report, null, 2);
  }
};
