// Comprehensive HTTPS/SSL Configuration & Security Headers
// Ensures secure communication and proper SSL/TLS settings

import { NextRequest, NextResponse } from 'next/server';

// SSL/TLS Configuration
export const SSL_CONFIG = {
  // Minimum TLS version
  minVersion: 'TLSv1.2',

  // Cipher suites (prioritize secure ones)
  cipherSuites: [
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-RSA-AES128-SHA256'
  ],

  // Certificate requirements
  certificate: {
    keySize: 2048, // Minimum RSA key size
    validityDays: 365, // Certificate validity
    autoRenewal: true, // Enable auto-renewal
    hstsMaxAge: 31536000 // 1 year HSTS max-age
  }
};

// Security headers for HTTPS
export const SECURITY_HEADERS = {
  // Strict Transport Security (HSTS)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',

  // XSS protection (legacy)
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Feature policy (restrict permissions)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',

  // Content Security Policy (defined separately)
  // 'Content-Security-Policy': CSP_STRING,

  // Certificate Transparency
  'Expect-CT': 'max-age=86400, enforce',

  // Remove server information
  'X-Powered-By': '', // Remove this header

  // DNS prefetch control
  'X-DNS-Prefetch-Control': 'on'
};

// HTTPS enforcement middleware
export function enforceHTTPS(request: NextRequest): NextResponse | null {
  // Skip for localhost/development
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  const host = request.headers.get('host') || '';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';

  // Redirect HTTP to HTTPS
  if (protocol !== 'https') {
    const httpsUrl = `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(httpsUrl, { status: 301 });
  }

  return null;
}

// SSL certificate validation
export const certificateValidation = {
  // Check certificate validity
  isValid: (certInfo: any): boolean => {
    if (!certInfo) return false;

    const now = new Date();
    const notBefore = new Date(certInfo.notBefore);
    const notAfter = new Date(certInfo.notAfter);

    // Check if certificate is currently valid
    return now >= notBefore && now <= notAfter;
  },

  // Check certificate strength
  isStrong: (certInfo: any): boolean => {
    if (!certInfo) return false;

    // Check key size
    const keySize = certInfo.bits || 0;
    if (keySize < SSL_CONFIG.certificate.keySize) {
      return false;
    }

    // Check issuer (avoid self-signed for production)
    if (process.env.NODE_ENV === 'production') {
      const issuer = certInfo.issuer?.CN || '';
      if (issuer.includes('localhost') || issuer.includes('self-signed')) {
        return false;
      }
    }

    return true;
  },

  // Get certificate information
  getInfo: (): any => {
    // In production, this would query the actual certificate
    // For now, return mock data
    return {
      subject: { CN: 'hstn.vercel.app' },
      issuer: { CN: 'Let\'s Encrypt' },
      notBefore: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      notAfter: new Date(Date.now() + 7776000000).toISOString(), // 90 days from now
      bits: 2048,
      serialNumber: '1234567890'
    };
  }
};

// HPKP (HTTP Public Key Pinning) - DEPRECATED but included for completeness
export const HPKP_CONFIG = {
  enabled: false, // HPKP is deprecated, use Certificate Transparency instead

  // Example pins (would be actual certificate hashes)
  pins: [
    'pin-sha256="base64-encoded-hash1"',
    'pin-sha256="base64-encoded-hash2"'
  ],

  maxAge: 5184000, // 60 days
  includeSubDomains: true,
  reportUri: '/hpkp-report'
};

// SSL/TLS monitoring and alerts
export const sslMonitoring = {
  // Check certificate expiry
  checkExpiry: (certInfo: any): { daysUntilExpiry: number; warning: boolean } => {
    const notAfter = new Date(certInfo.notAfter);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      daysUntilExpiry,
      warning: daysUntilExpiry <= 30 // Warn if expires in 30 days or less
    };
  },

  // Monitor SSL/TLS connections
  logConnection: (request: NextRequest, success: boolean): void => {
    const protocol = request.headers.get('x-forwarded-proto') || 'unknown';
    const cipher = request.headers.get('x-forwarded-cipher') || 'unknown';

    console.log(`SSL Connection: ${success ? '✓' : '✗'}`, {
      protocol,
      cipher,
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    });
  },

  // Detect SSL stripping attacks
  detectSSLStripping: (request: NextRequest): boolean => {
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const host = request.headers.get('host') || '';

    // Check if request came through HTTP but should be HTTPS
    if (process.env.NODE_ENV === 'production' && forwardedProto !== 'https') {
      console.warn('Potential SSL stripping detected', {
        forwardedProto,
        host,
        ip: request.headers.get('x-forwarded-for')
      });
      return true;
    }

    return false;
  }
};

// Mixed content detection and prevention
export const mixedContentProtection = {
  // Detect mixed content in HTML
  detectMixedContent: (html: string): string[] => {
    const issues: string[] = [];

    // Find HTTP URLs in HTTPS context
    const httpPattern = /http:\/\/[^"'\s]+/g;
    const matches = html.match(httpPattern);

    if (matches) {
      issues.push(...matches.map(url => `Mixed content: ${url}`));
    }

    return issues;
  },

  // Upgrade insecure requests
  upgradeInsecureRequests: (html: string): string => {
    // Add upgrade-insecure-requests CSP directive
    return html.replace(
      '<head>',
      '<head><meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">'
    );
  }
};

// Perfect Forward Secrecy (PFS) configuration
export const pfsConfig = {
  // Ensure ECDHE cipher suites are prioritized
  ensurePFS: (cipherSuites: string[]): boolean => {
    const ecdheSuites = cipherSuites.filter(suite => suite.startsWith('ECDHE-'));
    return ecdheSuites.length > 0 && ecdheSuites.length >= cipherSuites.length / 2;
  },

  // Validate PFS compliance
  validate: (): boolean => {
    return pfsConfig.ensurePFS(SSL_CONFIG.cipherSuites);
  }
};

// SSL/TLS best practices checker
export const sslBestPractices = {
  // Check overall SSL configuration
  audit: (): Array<{ check: string; passed: boolean; recommendation?: string }> => {
    const results = [];

    // Check TLS version
    results.push({
      check: 'Minimum TLS 1.2',
      passed: SSL_CONFIG.minVersion === 'TLSv1.2',
      recommendation: 'Upgrade to TLS 1.3 for better security'
    });

    // Check PFS
    results.push({
      check: 'Perfect Forward Secrecy',
      passed: pfsConfig.validate(),
      recommendation: 'Ensure ECDHE cipher suites are prioritized'
    });

    // Check HSTS
    results.push({
      check: 'HSTS enabled',
      passed: SECURITY_HEADERS['Strict-Transport-Security'] !== undefined,
      recommendation: 'Enable HSTS with appropriate max-age'
    });

    // Check certificate
    const certInfo = certificateValidation.getInfo();
    results.push({
      check: 'Certificate validity',
      passed: certificateValidation.isValid(certInfo),
      recommendation: 'Renew certificate before expiry'
    });

    results.push({
      check: 'Certificate strength',
      passed: certificateValidation.isStrong(certInfo),
      recommendation: 'Use RSA 2048+ or ECDSA certificates'
    });

    return results;
  },

  // Generate SSL report
  generateReport: (): string => {
    const auditResults = sslBestPractices.audit();
    const passed = auditResults.filter(r => r.passed).length;
    const total = auditResults.length;

    let report = `SSL/TLS Security Audit Report\n`;
    report += `================================\n`;
    report += `Passed: ${passed}/${total} checks\n\n`;

    auditResults.forEach(result => {
      report += `${result.passed ? '✅' : '❌'} ${result.check}\n`;
      if (result.recommendation && !result.passed) {
        report += `   → ${result.recommendation}\n`;
      }
      report += '\n';
    });

    return report;
  }
};
