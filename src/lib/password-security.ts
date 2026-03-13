// Comprehensive Password Security System
// Implements strong password policies, validation, and security measures

import crypto from 'crypto';

// Password policy configuration
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventPersonalInfo: true,
  maxConsecutiveChars: 3,
  historySize: 5, // Remember last 5 passwords
  lockoutAttempts: 5,
  lockoutDuration: 30 * 60 * 1000, // 30 minutes
  resetTokenExpiry: 15 * 60 * 1000, // 15 minutes
};

// Common weak passwords to reject
const COMMON_PASSWORDS = [
  'password', 'password123', '123456', '123456789', 'qwerty', 'abc123',
  'password1', 'admin', 'letmein', 'welcome', 'monkey', '1234567890',
  'password12345', 'qwerty123', 'iloveyou', 'princess', 'rockyou',
  '1234567', '12345678', 'password123456', '12345678910'
];

// Password strength scoring
export interface PasswordStrength {
  score: number; // 0-4 (very weak to very strong)
  feedback: string[];
  isAcceptable: boolean;
}

// Calculate password strength
export function calculatePasswordStrength(password: string): PasswordStrength {
  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length >= PASSWORD_POLICY.minLength) {
    score += 1;
  } else {
    feedback.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }

  // Character variety checks
  if (/[a-z]/.test(password)) score += 0.5;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 0.5;
  else feedback.push('Include uppercase letters');

  if (/\d/.test(password)) score += 0.5;
  else feedback.push('Include numbers');

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 0.5;
  else feedback.push('Include special characters');

  // Length bonus
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Deductions for patterns
  if (/(.)\1{2,}/.test(password)) {
    score -= 0.5;
    feedback.push('Avoid repeated characters');
  }

  if (/123|abc|qwe/i.test(password)) {
    score -= 0.5;
    feedback.push('Avoid sequential characters');
  }

  const finalScore = Math.min(4, Math.max(0, Math.floor(score)));
  const isAcceptable = score >= 2.5; // Require at least "good" strength

  return {
    score: finalScore,
    feedback,
    isAcceptable
  };
}

// Validate password against policy
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic requirements
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  }

  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must be no more than ${PASSWORD_POLICY.maxLength} characters long`);
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for consecutive characters
  if (PASSWORD_POLICY.maxConsecutiveChars > 0) {
    const consecutivePattern = new RegExp(`(.)\\1{${PASSWORD_POLICY.maxConsecutiveChars},}`);
    if (consecutivePattern.test(password)) {
      errors.push(`Password cannot contain more than ${PASSWORD_POLICY.maxConsecutiveChars} consecutive identical characters`);
    }
  }

  // Check against common passwords
  if (PASSWORD_POLICY.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
      errors.push('Password is too common. Please choose a more unique password');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Password hashing utilities (Supabase handles this, but for additional security)
export const passwordHashing = {
  // Generate salt
  generateSalt: (length: number = 32): string => {
    return crypto.randomBytes(length).toString('hex');
  },

  // Hash password with salt (for additional client-side validation)
  hashPassword: (password: string, salt: string): string => {
    return crypto.createHash('sha256')
      .update(password + salt)
      .digest('hex');
  },

  // Verify password against hash
  verifyPassword: (password: string, hash: string, salt: string): boolean => {
    const computedHash = passwordHashing.hashPassword(password, salt);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }
};

// Account lockout management
export const accountLockout = {
  // In-memory lockout tracking (use Redis/database in production)
  lockouts: new Map<string, { attempts: number; lockedUntil: number; lastAttempt: number }>(),

  // Check if account is locked
  isLocked: (identifier: string): { locked: boolean; remainingTime?: number } => {
    const lockout = accountLockout.lockouts.get(identifier);

    if (!lockout) {
      return { locked: false };
    }

    const now = Date.now();

    if (now < lockout.lockedUntil) {
      return {
        locked: true,
        remainingTime: Math.ceil((lockout.lockedUntil - now) / 1000)
      };
    }

    // Lockout expired, remove it
    accountLockout.lockouts.delete(identifier);
    return { locked: false };
  },

  // Record failed attempt
  recordFailedAttempt: (identifier: string): void => {
    const now = Date.now();
    const lockout = accountLockout.lockouts.get(identifier) || {
      attempts: 0,
      lockedUntil: 0,
      lastAttempt: now
    };

    lockout.attempts += 1;
    lockout.lastAttempt = now;

    // Lock account if too many attempts
    if (lockout.attempts >= PASSWORD_POLICY.lockoutAttempts) {
      lockout.lockedUntil = now + PASSWORD_POLICY.lockoutDuration;
    }

    accountLockout.lockouts.set(identifier, lockout);
  },

  // Clear failed attempts (on successful login)
  clearFailedAttempts: (identifier: string): void => {
    accountLockout.lockouts.delete(identifier);
  }
};

// Password history management
export const passwordHistory = {
  // In-memory history (use database in production)
  history: new Map<string, string[]>(),

  // Check if password was used recently
  isPasswordInHistory: (userId: string, newPassword: string): boolean => {
    const userHistory = passwordHistory.history.get(userId) || [];
    const salt = 'dummy-salt'; // In production, get actual salt

    return userHistory.some(oldHash =>
      passwordHashing.verifyPassword(newPassword, oldHash, salt)
    );
  },

  // Add password to history
  addToHistory: (userId: string, password: string): void => {
    const userHistory = passwordHistory.history.get(userId) || [];
    const salt = passwordHashing.generateSalt();
    const hash = passwordHashing.hashPassword(password, salt);

    userHistory.unshift(hash);

    // Keep only recent passwords
    if (userHistory.length > PASSWORD_POLICY.historySize) {
      userHistory.splice(PASSWORD_POLICY.historySize);
    }

    passwordHistory.history.set(userId, userHistory);
  }
};

// Password reset security
export const passwordReset = {
  // Generate secure reset token
  generateResetToken: (): string => {
    return crypto.randomBytes(32).toString('hex');
  },

  // Validate reset token (simplified - use proper JWT in production)
  validateResetToken: (token: string): boolean => {
    // In production, validate against database with expiry
    return !!(token && token.length === 64);
  },

  // Secure reset link generation
  generateResetLink: (userId: string, token: string, baseUrl: string): string => {
    const params = new URLSearchParams({
      user: userId,
      token: token,
      timestamp: Date.now().toString()
    });

    return `${baseUrl}/reset-password?${params.toString()}`;
  }
};

// Multi-factor authentication preparation
export const mfaSupport = {
  // Generate TOTP secret (for future MFA implementation)
  generateTOTPSecret: (): string => {
    return crypto.randomBytes(32).toString('base64');
  },

  // Validate TOTP code (placeholder)
  validateTOTPCode: (secret: string, code: string): boolean => {
    // In production, use a proper TOTP library like speakeasy
    return code.length === 6 && /^\d{6}$/.test(code);
  },

  // Backup codes generation
  generateBackupCodes: (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }
};

// Security monitoring for password-related events
export const passwordSecurityMonitoring = {
  // Log security events
  logEvent: (event: string, userId: string, details?: any) => {
    console.warn(`Password Security Event: ${event}`, {
      userId,
      details,
      timestamp: new Date().toISOString(),
      ip: 'client-ip', // In production, get from request
      userAgent: 'user-agent' // In production, get from request
    });
  },

  // Detect suspicious password patterns
  detectSuspiciousPatterns: (password: string): string[] => {
    const warnings: string[] = [];

    // Check for keyboard patterns
    const keyboardPatterns = ['qwerty', 'asdfgh', 'zxcvbn'];
    const lowerPass = password.toLowerCase();
    for (const pattern of keyboardPatterns) {
      if (lowerPass.includes(pattern)) {
        warnings.push('Password contains keyboard pattern');
        break;
      }
    }

    // Check for date patterns
    if (/\d{4}|\d{2}-\d{2}-\d{4}/.test(password)) {
      warnings.push('Password contains date pattern');
    }

    // Check for phone number patterns
    if (/\d{10}|\d{3}-\d{3}-\d{4}/.test(password)) {
      warnings.push('Password resembles phone number');
    }

    return warnings;
  }
};
