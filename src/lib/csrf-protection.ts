// Comprehensive CSRF Protection System
// Protects against Cross-Site Request Forgery attacks

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

// CSRF token storage (in production, use Redis or database)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Clean up expired tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of csrfTokens.entries()) {
    if (now > value.expires) {
      csrfTokens.delete(key);
    }
  }
}, 30 * 60 * 1000);

// Generate cryptographically secure CSRF token
export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const expires = Date.now() + CSRF_TOKEN_EXPIRY;

  csrfTokens.set(sessionId, { token, expires });
  return token;
}

// Validate CSRF token with constant-time comparison
export function validateCSRFToken(sessionId: string, providedToken: string): boolean {
  const stored = csrfTokens.get(sessionId);

  if (!stored || Date.now() > stored.expires) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(stored.token, 'hex'),
    Buffer.from(providedToken, 'hex')
  );
}

// Get CSRF token for a session
export function getCSRFToken(sessionId: string): string | null {
  const stored = csrfTokens.get(sessionId);
  return stored && Date.now() <= stored.expires ? stored.token : null;
}

// Remove CSRF token (for logout)
export function removeCSRFToken(sessionId: string): void {
  csrfTokens.delete(sessionId);
}

// CSRF middleware for API routes
export function csrfMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Skip CSRF protection for safe HTTP methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method)) {
      return handler(request);
    }

    // Get session ID (in production, this would be from a secure session store)
    const sessionId = request.cookies.get('session-id')?.value ||
                     request.headers.get('x-session-id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session required for this operation' },
        { status: 401 }
      );
    }

    // Check CSRF token
    const csrfToken = request.headers.get('x-csrf-token') ||
                     request.headers.get('csrf-token') ||
                     new URL(request.url).searchParams.get('csrf_token');

    if (!csrfToken) {
      return NextResponse.json(
        { error: 'CSRF token required' },
        { status: 403 }
      );
    }

    if (!validateCSRFToken(sessionId, csrfToken)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    return handler(request);
  };
}

// CSRF protection for forms (React hook)
export const useCSRF = () => {
  // In a real implementation, this would fetch the token from the server
  // For now, we'll generate a client-side token (less secure but functional)
  const generateFormToken = () => {
    return crypto.randomBytes(16).toString('hex');
  };

  const validateFormToken = (token: string) => {
    // Basic validation - in production, validate against server
    return token && token.length === 32;
  };

  return {
    generateFormToken,
    validateFormToken
  };
};

// CSRF-protected fetch wrapper
export const secureFetch = async (
  url: string,
  options: RequestInit = {},
  sessionId?: string
): Promise<Response> => {
  const headers = new Headers(options.headers);

  // Add CSRF token if available
  if (sessionId) {
    const csrfToken = getCSRFToken(sessionId);
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  // Add other security headers
  headers.set('X-Requested-With', 'XMLHttpRequest');

  return fetch(url, {
    ...options,
    headers
  });
};

// Double-submit cookie pattern implementation
export const doubleSubmitProtection = {
  // Set double-submit cookie
  setCookie: (response: NextResponse, token: string): NextResponse => {
    response.cookies.set('csrf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CSRF_TOKEN_EXPIRY / 1000
    });
    return response;
  },

  // Validate double-submit cookie
  validateCookie: (request: NextRequest): boolean => {
    const cookieToken = request.cookies.get('csrf_token')?.value;
    const headerToken = request.headers.get('x-csrf-token');

   return !!(cookieToken && headerToken && cookieToken === headerToken);
  }
};

// Origin validation
export const originValidation = {
  // Allowed origins (configure for your domains)
  allowedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'https://localhost:3000',
    // Add your production domains here
  ].filter(Boolean),

  // Validate request origin
  validateOrigin: (request: NextRequest): boolean => {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    // Allow same-origin requests
    if (!origin) return true;

    // Check against allowed origins
    if (originValidation.allowedOrigins.includes(origin)) {
      return true;
    }

    // Additional check for referer header
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        return originValidation.allowedOrigins.includes(refererOrigin);
      } catch {
        return false;
      }
    }

    return false;
  },

  // Middleware for origin validation
  middleware: (handler: Function) => {
    return async (request: NextRequest) => {
      if (!originValidation.validateOrigin(request)) {
        return NextResponse.json(
          { error: 'Invalid origin' },
          { status: 403 }
        );
      }

      return handler(request);
    };
  }
};

// Comprehensive CSRF protection combining all methods
export const comprehensiveCSRFProtection = {
  // Apply all CSRF protections
  protect: (handler: Function) => {
    return csrfMiddleware(
      originValidation.middleware(handler)
    );
  },

  // Generate tokens for forms
  generateTokens: (sessionId: string) => {
    const csrfToken = generateCSRFToken(sessionId);
    return {
      csrfToken,
      formToken: generateCSRFToken(sessionId + '_form')
    };
  }
};
