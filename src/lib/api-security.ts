// Secure API Endpoints with Authentication & Validation
// Protects all API routes with comprehensive security measures

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabase';
import { validate, sanitize } from './security';
import { applyRateLimit, createRateLimitResponse } from './rate-limiting';
import { generateCSRFToken, validateCSRFToken, csrfMiddleware, doubleSubmitProtection, originValidation } from './csrf-protection';
import { logAuditEvent } from './audit-logging';

// API endpoint security configuration
export const API_SECURITY_CONFIG = {
  // Authentication requirements
  auth: {
    required: true,
    allowAnonymous: ['/api/public/*', '/api/auth/*'],
    tokenExpiry: 3600000, // 1 hour
  },

  // Rate limiting
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },

  // Input validation
  validation: {
    maxBodySize: 1048576, // 1MB
    allowedContentTypes: ['application/json', 'multipart/form-data'],
  },

  // CORS settings
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://hstn.vercel.app'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 86400, // 24 hours
  }
};

// Authentication middleware
export async function authenticateRequest(request: NextRequest): Promise<{
  user: any | null;
  session: any | null;
  error?: NextResponse;
}> {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        user: null,
        session: null,
        error: NextResponse.json(
          { error: 'Authorization header required' },
          { status: 401 }
        )
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logAuditEvent('authentication_failure', request, { error: error?.message });
      return {
        user: null,
        session: null,
        error: NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        )
      };
    }

    // Resolve profile/role with admin client to avoid RLS false negatives
    const supabaseAdmin = getSupabaseAdmin();
    let { data: profile } = await (supabaseAdmin as any)
      .from('profiles')
      .select('role, disabled')
      .eq('id', user.id)
      .single();

    // Fallback: token-scoped client query when admin client is unavailable/misconfigured
    if (!profile) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && anon) {
        const scoped = createClient(url, anon, {
          global: {
            headers: { Authorization: `Bearer ${token}` }
          },
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        const { data: scopedProfile } = await (scoped as any)
          .from('profiles')
          .select('role, disabled')
          .eq('id', user.id)
          .single();
        profile = scopedProfile || profile;
      }
    }

    const resolvedRole = profile?.role || (user as any)?.user_metadata?.role || (user as any)?.app_metadata?.role || 'user';

    if (profile?.disabled) {
      logAuditEvent('authentication_disabled_user', request, { userId: user.id });
      return {
        user: null,
        session: null,
        error: NextResponse.json(
          { error: 'Account is disabled' },
          { status: 403 }
        )
      };
    }

    logAuditEvent('authentication_success', request, { userId: user.id });

    return {
      user: { ...user, profile: { ...(profile || {}), role: resolvedRole } },
      session: { token }
    };

  } catch (error) {
    logAuditEvent('authentication_error', request, { error: error instanceof Error ? error.message : 'Unknown error' });
    return {
      user: null,
      session: null,
      error: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      )
    };
  }
}

// Authorization middleware
export function authorizeRequest(
  user: any,
  requiredRole?: string,
  resourceOwner?: string
): NextResponse | null {
  // Check role-based access
  if (requiredRole) {
    const userRole = String(user.profile?.role || 'user').toLowerCase();
    const required = String(requiredRole).toLowerCase();
    if (userRole !== required && userRole !== 'admin') {
      logAuditEvent('authorization_role_denied', null, {
        userId: user.id,
        requiredRole,
        userRole
      });
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
  }

  // Check resource ownership
  if (resourceOwner && resourceOwner !== user.id && user.profile?.role !== 'admin') {
    logAuditEvent('authorization_ownership_denied', null, {
      userId: user.id,
      resourceOwner
    });
    return NextResponse.json(
      { error: 'Access denied: not resource owner' },
      { status: 403 }
    );
  }

  return null; // Access granted
}

// Input validation middleware
export async function validateRequestInput(
  request: NextRequest,
  schema?: Record<string, any>
): Promise<{ data?: any; error?: NextResponse }> {
  try {
    // Check content type
    const contentType = request.headers.get('content-type') || '';
    if (!API_SECURITY_CONFIG.validation.allowedContentTypes.some(type =>
      contentType.includes(type)
    )) {
      return {
        error: NextResponse.json(
          { error: 'Unsupported content type' },
          { status: 400 }
        )
      };
    }

    // Check body size
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > API_SECURITY_CONFIG.validation.maxBodySize) {
      return {
        error: NextResponse.json(
          { error: 'Request body too large' },
          { status: 413 }
        )
      };
    }

    // Parse request body
    let body: any = {};

    if (contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch {
        return {
          error: NextResponse.json(
            { error: 'Invalid JSON' },
            { status: 400 }
          )
        };
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Handle form data (would need additional parsing)
      body = await request.formData();
    }

    // Sanitize input
    const sanitizedBody = sanitizeInput(body);

    // Validate against schema if provided
    if (schema) {
      const validation = validateAgainstSchema(sanitizedBody, schema);
      if (!validation.valid) {
        return {
          error: NextResponse.json(
            { error: 'Validation failed', details: validation.errors },
            { status: 400 }
          )
        };
      }
    }

    return { data: sanitizedBody };

  } catch (error) {
    logAuditEvent('input_validation_error', request, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return {
      error: NextResponse.json(
        { error: 'Input validation failed' },
        { status: 400 }
      )
    };
  }
}

// Sanitize input recursively
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return sanitize.safeHtml(input);
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      // Skip dangerous keys
      if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
        sanitized[key] = sanitizeInput(value);
      }
    }
    return sanitized;
  }

  return input;
}

// Validate against schema
function validateAgainstSchema(data: any, schema: Record<string, any>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip validation if field is not required and empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Type validation
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }
    }

    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be no more than ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }

    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be no more than ${rules.max}`);
      }
    }

    // Custom validation
    if (rules.validate && typeof rules.validate === 'function') {
      const result = rules.validate(value);
      if (result !== true) {
        errors.push(typeof result === 'string' ? result : `${field} validation failed`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// CORS middleware
export function handleCORS(request: NextRequest): NextResponse | null {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': API_SECURITY_CONFIG.cors.allowedOrigins.includes(request.headers.get('origin') || '')
          ? request.headers.get('origin')!
          : API_SECURITY_CONFIG.cors.allowedOrigins[0],
        'Access-Control-Allow-Methods': API_SECURITY_CONFIG.cors.allowedMethods.join(', '),
        'Access-Control-Allow-Headers': API_SECURITY_CONFIG.cors.allowedHeaders.join(', '),
        'Access-Control-Max-Age': API_SECURITY_CONFIG.cors.maxAge.toString(),
      }
    });
  }

  return null;
}

// Comprehensive API security middleware
export function createSecureAPIMiddleware(options: {
  requireAuth?: boolean;
  requiredRole?: string;
  rateLimit?: boolean;
  validateInput?: Record<string, any>;
  cors?: boolean;
} = {}) {
  return (handler: (request: NextRequest, context: any) => Promise<NextResponse>) => {
    return async (request: NextRequest, context: any): Promise<NextResponse> => {
      try {
        // 1. Handle CORS
        if (options.cors !== false) {
          const corsResponse = handleCORS(request);
          if (corsResponse) return corsResponse;
        }

        // 2. Apply rate limiting
        if (options.rateLimit !== false) {
          const rateLimitResult = applyRateLimit(request, API_SECURITY_CONFIG.rateLimit);
          if (!rateLimitResult.success) {
            return createRateLimitResponse(rateLimitResult, API_SECURITY_CONFIG.rateLimit.windowMs);
          }
        }

        // 3. Authenticate user
        let authResult: { user: any | null; session: any | null; error?: NextResponse } = { user: null, session: null };
        if (options.requireAuth !== false) {
          authResult = await authenticateRequest(request);
          if (authResult.error) return authResult.error;
        }

        // 4. Authorize request
        if (options.requiredRole && authResult.user) {
          const authError = authorizeRequest(authResult.user, options.requiredRole);
          if (authError) return authError;
        }

        // 5. Validate input
        let validatedData: any = {};
        if (options.validateInput) {
          const validation = await validateRequestInput(request, options.validateInput);
          if (validation.error) return validation.error;
          validatedData = validation.data || {};
        }

        // 6. Execute handler with security context and merge with original context
        const securityContext = {
          ...context,
          user: authResult.user,
          session: authResult.session,
          validatedData
        };

        return await handler(request, securityContext);

      } catch (error) {
        logAuditEvent('api_error', request, {
          error: error instanceof Error ? error.message : 'Unknown API error'
        });

        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    };
  };
}

// API endpoint wrappers with security
export const secureAPI = {
  // GET endpoint
  GET: (handler: any, options?: any) =>
    createSecureAPIMiddleware({ ...options })(handler),

  // POST endpoint
  POST: (handler: any, options?: any) =>
    createSecureAPIMiddleware({ ...options })(handler),

  // PUT endpoint
  PUT: (handler: any, options?: any) =>
    createSecureAPIMiddleware({ ...options })(handler),

  // DELETE endpoint
  DELETE: (handler: any, options?: any) =>
    createSecureAPIMiddleware({ ...options })(handler)
};

// Security monitoring for API endpoints
export const apiMonitoring = {
  // Track API usage
  trackUsage: (request: NextRequest, userId?: string): void => {
    logAuditEvent('api_access', request, {
      method: request.method,
      endpoint: request.nextUrl.pathname,
      userId
    });
  },

  // Detect suspicious API patterns
  detectSuspiciousPatterns: (request: NextRequest): string[] => {
    const warnings: string[] = [];

    // Check for rapid repeated requests
    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.includes('curl') || userAgent.includes('wget')) {
      warnings.push('Request from command-line tool');
    }

    // Check for unusual headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip'];
    for (const header of suspiciousHeaders) {
      const headerValue = request.headers.get(header);
      if (headerValue && headerValue.split(',').length > 1) {
        warnings.push(`Multiple ${header} values detected`);
      }
    }

    return warnings;
  }
};
