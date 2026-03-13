// Comprehensive Rate Limiting System
// Protects against brute force, spam, and abuse

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix?: string;  // Prefix for Redis/cache keys
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean;   // Skip rate limiting for failed requests
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

// In-memory rate limiting (for development/simple deployments)
// In production, use Redis or similar persistent store
class MemoryRateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();

  check(key: string, maxRequests: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      // First request or window expired
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return {
        success: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
        limit: maxRequests
      };
    }

    if (record.count >= maxRequests) {
      // Rate limit exceeded
      return {
        success: false,
        remaining: 0,
        resetTime: record.resetTime,
        limit: maxRequests
      };
    }

    // Increment counter
    record.count++;
    return {
      success: true,
      remaining: maxRequests - record.count,
      resetTime: record.resetTime,
      limit: maxRequests
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Global rate limiter instance
const rateLimiter = new MemoryRateLimiter();

// Clean up expired entries every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

// Rate limiting configurations for different endpoints
export const RATE_LIMITS = {
  // Authentication endpoints
  auth: {
    login: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 attempts per 15 minutes
    signup: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 signups per hour
    passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 resets per hour
  },

  // API endpoints
  api: {
    productCreate: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 products per minute
    productUpdate: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 updates per minute
    reviewCreate: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 reviews per minute
    purchaseRequest: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
    search: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 searches per minute
    general: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 general requests per minute
  },

  // File uploads
  upload: {
    image: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 images per minute
    document: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 documents per minute
  }
};

// Generate rate limit key from request
export function generateRateLimitKey(
  request: NextRequest,
  keyType: 'ip' | 'user' | 'combined' = 'combined',
  customKey?: string
): string {
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';

  const userId = request.headers.get('x-user-id') || 'anonymous';

  switch (keyType) {
    case 'ip':
      return `rl:ip:${ip}`;
    case 'user':
      return `rl:user:${userId}`;
    case 'combined':
      return `rl:combined:${ip}:${userId}`;
    default:
      return `rl:custom:${customKey || 'unknown'}`;
  }
}

// Apply rate limiting to a request
export function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  keyType: 'ip' | 'user' | 'combined' = 'combined'
): RateLimitResult {
  const key = generateRateLimitKey(request, keyType, config.keyPrefix);
  return rateLimiter.check(key, config.maxRequests, config.windowMs);
}

// Create rate limited response
export function createRateLimitResponse(
  result: RateLimitResult,
  retryAfter: number
): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(retryAfter / 1000), // seconds
      limit: result.limit,
      remaining: result.remaining
    },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil(retryAfter / 1000).toString(),
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
      }
    }
  );

  return response;
}

// Middleware function for rate limiting
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  config: RateLimitConfig,
  keyType: 'ip' | 'user' | 'combined' = 'combined'
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = applyRateLimit(request, config, keyType);

    if (!result.success) {
      const retryAfter = result.resetTime - Date.now();
      return createRateLimitResponse(result, retryAfter);
    }

    // Add rate limit headers to successful response
    const response = await handler(request);

    if (response instanceof NextResponse) {
      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
    }

    return response;
  };
}

// Specific rate limiting functions for common use cases
export const rateLimiters = {
  // Authentication rate limiting
  authLogin: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.auth.login),

  authSignup: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.auth.signup),

  authPasswordReset: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.auth.passwordReset),

  // API rate limiting
  apiProductCreate: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.api.productCreate),

  apiProductUpdate: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.api.productUpdate),

  apiReviewCreate: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.api.reviewCreate),

  apiPurchaseRequest: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.api.purchaseRequest),

  apiSearch: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.api.search),

  // Upload rate limiting
  uploadImage: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.upload.image),

  uploadDocument: (request: NextRequest) =>
    applyRateLimit(request, RATE_LIMITS.upload.document),
};

// Suspicious activity detection
export const securityMonitoring = {
  // Track failed login attempts
  trackFailedLogin: (identifier: string) => {
    const key = `failed_login:${identifier}`;
    const attempts = parseInt(localStorage.getItem(key) || '0') + 1;
    localStorage.setItem(key, attempts.toString());

    // If too many failed attempts, implement stricter rate limiting
    if (attempts >= 3) {
      console.warn(`Multiple failed login attempts for: ${identifier}`);
      // Could trigger additional security measures
    }
  },

  // Track suspicious API usage patterns
  trackSuspiciousActivity: (request: NextRequest, reason: string) => {
    console.warn(`Suspicious activity detected: ${reason}`, {
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString(),
    });
  },

  // Reset failed attempt counters on successful actions
  resetFailedAttempts: (identifier: string) => {
    const key = `failed_login:${identifier}`;
    localStorage.removeItem(key);
  }
};
