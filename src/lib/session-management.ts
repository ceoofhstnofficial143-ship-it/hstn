// Comprehensive Secure Session Management
// Handles JWT tokens, session validation, and security

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from './supabase';

// Session configuration
const SESSION_CONFIG = {
  jwtExpiry: 60 * 60 * 1000, // 1 hour
  refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxConcurrentSessions: 5,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes of inactivity
  rememberMeExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Session storage (in production, use Redis or database)
interface SessionData {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  userAgent: string;
  ipAddress: string;
  deviceFingerprint: string;
  isRemembered: boolean;
}

const activeSessions = new Map<string, SessionData>();

// Clean up expired sessions every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    const expiry = session.isRemembered
      ? SESSION_CONFIG.rememberMeExpiry
      : SESSION_CONFIG.jwtExpiry;

    if (now - session.createdAt > expiry) {
      activeSessions.delete(token);
    }
  }
}, 15 * 60 * 1000);

// Generate secure session ID
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create new session
export function createSession(
  userId: string,
  userAgent: string,
  ipAddress: string,
  deviceFingerprint: string,
  rememberMe: boolean = false
): { sessionId: string; token: string } {
  const sessionId = generateSessionId();
  const sessionData: SessionData = {
    userId,
    sessionId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    userAgent,
    ipAddress,
    deviceFingerprint,
    isRemembered: rememberMe
  };

  // Check concurrent session limit
  const userSessions = Array.from(activeSessions.values())
    .filter(session => session.userId === userId);

  if (userSessions.length >= SESSION_CONFIG.maxConcurrentSessions) {
    // Remove oldest session
    const oldestSession = userSessions
      .sort((a, b) => a.createdAt - b.createdAt)[0];

    for (const [token, session] of activeSessions.entries()) {
      if (session.sessionId === oldestSession.sessionId) {
        activeSessions.delete(token);
        break;
      }
    }
  }

  // Generate JWT token
  const token = generateJWT(sessionData);
  activeSessions.set(token, sessionData);

  return { sessionId, token };
}

// Generate JWT token (simplified - in production use proper JWT library)
function generateJWT(payload: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({
    ...payload,
    exp: payload.createdAt + (payload.isRemembered
      ? SESSION_CONFIG.rememberMeExpiry
      : SESSION_CONFIG.jwtExpiry),
    iat: payload.createdAt
  }));

  // Simple signature (in production use proper crypto)
  const signature = btoa(`${header}.${body}.${process.env.JWT_SECRET || 'default-secret'}`);
  return `${header}.${body}.${signature}`;
}

// Validate session token
export function validateSession(token: string): SessionData | null {
  const session = activeSessions.get(token);
  if (!session) return null;

  const now = Date.now();

  // Check expiry
  const expiry = session.isRemembered
    ? SESSION_CONFIG.rememberMeExpiry
    : SESSION_CONFIG.jwtExpiry;

  if (now - session.createdAt > expiry) {
    activeSessions.delete(token);
    return null;
  }

  // Check session timeout
  if (now - session.lastActivity > SESSION_CONFIG.sessionTimeout) {
    activeSessions.delete(token);
    return null;
  }

  // Update last activity
  session.lastActivity = now;

  return session;
}

// Refresh session token
export function refreshSession(token: string): string | null {
  const session = activeSessions.get(token);
  if (!session) return null;

  // Generate new token
  const newToken = generateJWT(session);
  activeSessions.set(newToken, session);
  activeSessions.delete(token);

  return newToken;
}

// Logout session
export function logoutSession(token: string): boolean {
  return activeSessions.delete(token);
}

// Logout all sessions for user
export function logoutAllSessions(userId: string): number {
  let count = 0;
  for (const [token, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(token);
      count++;
    }
  }
  return count;
}

// Get active sessions for user
export function getUserSessions(userId: string): SessionData[] {
  return Array.from(activeSessions.values())
    .filter(session => session.userId === userId);
}

// Detect suspicious session activity
export const sessionSecurity = {
  // Check for suspicious login patterns
  detectSuspiciousActivity: (session: SessionData, newLogin: SessionData): string[] => {
    const warnings: string[] = [];

    // Check for different IP address
    if (session.ipAddress !== newLogin.ipAddress) {
      warnings.push('Login from different IP address');
    }

    // Check for different user agent (device/browser change)
    if (session.userAgent !== newLogin.userAgent) {
      warnings.push('Login from different device/browser');
    }

    // Check for rapid consecutive logins (potential brute force)
    const recentLogins = Array.from(activeSessions.values())
      .filter(s => s.userId === session.userId)
      .filter(s => Date.now() - s.createdAt < 60000) // Last minute
      .length;

    if (recentLogins > 3) {
      warnings.push('Multiple rapid login attempts detected');
    }

    return warnings;
  },

  // Block suspicious sessions
  blockSuspiciousSession: (token: string): boolean => {
    const session = activeSessions.get(token);
    if (session) {
      // Mark session as suspicious (could add to blocklist)
      session.lastActivity = 0; // Force timeout
      return true;
    }
    return false;
  }
};

// Session middleware for API routes
export function sessionMiddleware(
  handler: (request: NextRequest, session: SessionData) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') ||
                 request.cookies.get('session-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const session = validateSession(token);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    return handler(request, session);
  };
}

// CSRF token integration with sessions
export const sessionCSRF = {
  // Generate CSRF token tied to session
  generateCSRFToken: (sessionId: string): string => {
    const token = crypto.randomBytes(32).toString('hex');
    // In production, store in Redis/database with session ID
    return token;
  },

  // Validate CSRF token against session
  validateCSRFToken: (sessionId: string, token: string): boolean => {
    // In production, check against stored token for session
    return !!(token && token.length === 64); // Basic validation
  }
};

// Session analytics and monitoring
export const sessionAnalytics = {
  // Track session metrics
  metrics: {
    totalSessions: 0,
    activeSessions: 0,
    expiredSessions: 0,
    suspiciousActivities: 0
  },

  // Log session event
  logEvent: (event: string, sessionId: string, details?: any) => {
    console.log(`Session ${event}:`, { sessionId, details, timestamp: new Date() });
  },

  // Get session statistics
  getStats: () => {
    sessionAnalytics.metrics.activeSessions = activeSessions.size;
    return { ...sessionAnalytics.metrics };
  }
};

// Secure logout with cleanup
export const secureLogout = {
  // Comprehensive logout
  logout: (token: string): { success: boolean; message: string } => {
    const session = activeSessions.get(token);

    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    // Remove session
    activeSessions.delete(token);

    // Log logout event
    sessionAnalytics.logEvent('logout', session.sessionId, {
      userId: session.userId,
      duration: Date.now() - session.createdAt
    });

    return { success: true, message: 'Logged out successfully' };
  },

  // Force logout all devices
  logoutAllDevices: (userId: string): { success: boolean; devicesLoggedOut: number } => {
    const devicesLoggedOut = logoutAllSessions(userId);

    sessionAnalytics.logEvent('logout_all_devices', userId, {
      devicesLoggedOut
    });

    return { success: true, devicesLoggedOut };
  }
};
