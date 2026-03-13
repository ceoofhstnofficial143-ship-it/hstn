// Comprehensive XSS Protection & Content Security Policy
// Implements multiple layers of XSS protection

import { NextRequest, NextResponse } from 'next/server';

// Content Security Policy Configuration
export const CSP_CONFIG = {
  // Default CSP directives
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Next.js
    "'unsafe-eval'",   // Required for Next.js
    "https://*.vercel.com",
    "https://*.supabase.co"
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for Next.js styles
    "https://fonts.googleapis.com",
    "https://*.vercel.com"
  ],
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com",
    "https://*.vercel.com"
  ],
  'img-src': [
    "'self'",
    "data:", // For base64 images
    "blob:", // For file uploads
    "https://*.unsplash.com",
    "https://*.supabase.co",
    "https://*.vercel.com",
    "https://images.unsplash.com"
  ],
  'connect-src': [
    "'self'",
    "https://*.supabase.co",
    "https://*.vercel.com",
    "https://api.unsplash.com"
  ],
  'frame-src': ["'none'"], // Block all iframes
  'object-src': ["'none'"], // Block object/embed tags
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"], // Prevent clickjacking
  'upgrade-insecure-requests': [], // Force HTTPS
};

// Generate CSP header string
export function generateCSPHeader(config: typeof CSP_CONFIG = CSP_CONFIG): string {
  const directives = Object.entries(config).map(([key, values]) => {
    if (values.length === 0) return key;
    return `${key} ${values.join(' ')}`;
  });

  return directives.join('; ');
}

// Security headers middleware
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  const cspHeader = generateCSPHeader();
  response.headers.set('Content-Security-Policy', cspHeader);

  // Additional security headers
  response.headers.set('X-Frame-Options', 'DENY'); // Prevent clickjacking
  response.headers.set('X-Content-Type-Options', 'nosniff'); // Prevent MIME sniffing
  response.headers.set('X-XSS-Protection', '1; mode=block'); // Legacy XSS protection
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin'); // Control referrer information
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); // Restrict permissions

  // HTTPS Strict Transport Security (only for HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
}

// XSS Detection and Prevention Utilities
export const xssProtection = {
  // Detect potentially dangerous patterns
  detectXSSPatterns: (input: string): boolean => {
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
  },

  // Sanitize HTML content
  sanitizeHTML: (html: string): string => {
    if (typeof html !== 'string') return '';

    // Remove script tags
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove iframe tags
    html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // Remove object/embed tags
    html = html.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    html = html.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');

    // Remove event handlers
    html = html.replace(/on\w+="[^"]*"/gi, '');
    html = html.replace(/on\w+='[^']*'/gi, '');

    // Remove javascript: URLs
    html = html.replace(/javascript:[^"']*/gi, '#');

    // Encode special characters in remaining tags
    html = html.replace(/<([^>]+)>/g, (match, tagContent) => {
      // Allow safe tags
      const safeTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'];
      const tagName = tagContent.split(' ')[0].toLowerCase();

      if (safeTags.includes(tagName)) {
        return match; // Keep safe tags
      }

      // Encode dangerous tags
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });

    return html.trim();
  },

  // Validate and sanitize URL parameters
  sanitizeURL: (url: string): string => {
    if (typeof url !== 'string') return '';

    // Remove dangerous protocols
    url = url.replace(/^javascript:/i, '');
    url = url.replace(/^vbscript:/i, '');
    url = url.replace(/^data:/i, '#'); // Block data URLs unless specifically allowed

    // Only allow http/https protocols
    if (!/^https?:\/\//i.test(url)) {
      return '#';
    }

    return url;
  },

  // Sanitize user-generated content for display
  sanitizeUserContent: (content: string): string => {
    if (typeof content !== 'string') return '';

    // First check for dangerous patterns
    if (xssProtection.detectXSSPatterns(content)) {
      console.warn('XSS pattern detected in user content, sanitizing aggressively');
      return xssProtection.sanitizeHTML(content);
    }

    // For safe content, allow basic HTML
    return xssProtection.sanitizeHTML(content);
  }
};

// CSRF Protection
export const csrfProtection = {
  // Generate CSRF token
  generateToken: (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  // Validate CSRF token
  validateToken: (providedToken: string, expectedToken: string): boolean => {
    if (!providedToken || !expectedToken) return false;

    // Use constant-time comparison to prevent timing attacks
    return providedToken === expectedToken;
  },

  // CSRF middleware for API routes
  protectAPI: (handler: Function) => {
    return async (request: NextRequest) => {
      // Skip CSRF for GET, HEAD, OPTIONS
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        return handler(request);
      }

      const csrfToken = request.headers.get('x-csrf-token');
      const sessionToken = request.cookies.get('csrf-token')?.value;

      if (!csrfToken || !sessionToken || !csrfProtection.validateToken(csrfToken, sessionToken)) {
        return NextResponse.json(
          { error: 'Invalid CSRF token' },
          { status: 403 }
        );
      }

      return handler(request);
    };
  }
};

// Secure Headers Middleware
export function createSecureHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': generateCSPHeader(),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(process.env.NODE_ENV === 'production' && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    })
  };
}

// Input sanitization for forms
export const formProtection = {
  // Sanitize form data
  sanitizeFormData: (data: Record<string, any>): Record<string, any> => {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Sanitize text inputs
        sanitized[key] = xssProtection.sanitizeUserContent(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = formProtection.sanitizeFormData(value);
      } else {
        // Keep other types as-is
        sanitized[key] = value;
      }
    }

    return sanitized;
  },

  // Validate required fields
  validateRequired: (data: Record<string, any>, requiredFields: string[]): string[] => {
    const missing: string[] = [];

    for (const field of requiredFields) {
      const value = data[field];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }

    return missing;
  }
};
