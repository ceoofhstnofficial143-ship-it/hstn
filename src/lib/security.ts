// Comprehensive Input Validation & Sanitization Utilities
// Protects against XSS, SQL injection, and malformed data

export interface ValidationResult {
  isValid: boolean;
  sanitized?: any;
  error?: string;
}

// Text validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_-]{3,30}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  phone: /^\+?[\d\s\-\(\)]{10,15}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  productTitle: /^[a-zA-Z0-9\s\-_.,!?'"()]{3,100}$/,
  productDescription: /^[a-zA-Z0-9\s\-_.,!?'"()\n\r]{10,2000}$/,
  price: /^\d+(\.\d{1,2})?$/,
  address: /^[a-zA-Z0-9\s\-_.,#]{5,200}$/,
  pincode: /^\d{6}$/,
};

// Sanitization functions
export const sanitize = {
  // Remove HTML tags and encode special characters
  html: (input: string): string => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  },

  // Remove script tags and dangerous attributes
  safeHtml: (input: string): string => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .trim();
  },

  // Remove SQL injection patterns
  sql: (input: string): string => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/['";\\]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
  },

  // Clean filename for uploads
  filename: (filename: string): string => {
    if (typeof filename !== 'string') return 'file';
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100);
  },

  // Trim and normalize whitespace
  text: (input: string): string => {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/\s+/g, ' ');
  },

  // Convert to number safely
  number: (input: any): number | null => {
    const num = parseFloat(input);
    return isNaN(num) ? null : num;
  },

  // Convert to boolean safely
  boolean: (input: any): boolean => {
    if (typeof input === 'boolean') return input;
    if (typeof input === 'string') {
      return ['true', '1', 'yes', 'on'].includes(input.toLowerCase());
    }
    return Boolean(input);
  }
};

// Validation functions
export const validate = {
  email: (email: string): ValidationResult => {
    const sanitized = sanitize.text(email);
    if (!sanitized) {
      return { isValid: false, error: 'Email is required' };
    }
    if (!VALIDATION_PATTERNS.email.test(sanitized)) {
      return { isValid: false, error: 'Invalid email format' };
    }
    return { isValid: true, sanitized };
  },

  username: (username: string): ValidationResult => {
    const sanitized = sanitize.text(username);
    if (!sanitized) {
      return { isValid: false, error: 'Username is required' };
    }
    if (!VALIDATION_PATTERNS.username.test(sanitized)) {
      return { isValid: false, error: 'Username must be 3-30 characters, letters/numbers only' };
    }
    return { isValid: true, sanitized };
  },

  password: (password: string): ValidationResult => {
    const sanitized = sanitize.text(password);
    if (!sanitized) {
      return { isValid: false, error: 'Password is required' };
    }
    if (!VALIDATION_PATTERNS.password.test(sanitized)) {
      return {
        isValid: false,
        error: 'Password must be 8+ chars with uppercase, lowercase, number, and special character'
      };
    }
    return { isValid: true, sanitized };
  },

  phone: (phone: string): ValidationResult => {
    const sanitized = sanitize.text(phone);
    if (!sanitized) {
      return { isValid: false, error: 'Phone number is required' };
    }
    if (!VALIDATION_PATTERNS.phone.test(sanitized)) {
      return { isValid: false, error: 'Invalid phone number format' };
    }
    return { isValid: true, sanitized };
  },

  productTitle: (title: string): ValidationResult => {
    const sanitized = sanitize.safeHtml(title);
    if (!sanitized) {
      return { isValid: false, error: 'Product title is required' };
    }
    if (!VALIDATION_PATTERNS.productTitle.test(sanitized)) {
      return { isValid: false, error: 'Title must be 3-100 characters, no special symbols' };
    }
    return { isValid: true, sanitized };
  },

  productDescription: (description: string): ValidationResult => {
    const sanitized = sanitize.safeHtml(description);
    if (!sanitized) {
      return { isValid: false, error: 'Product description is required' };
    }
    if (!VALIDATION_PATTERNS.productDescription.test(sanitized)) {
      return { isValid: false, error: 'Description must be 10-2000 characters' };
    }
    return { isValid: true, sanitized };
  },

  price: (price: any): ValidationResult => {
    const num = sanitize.number(price);
    if (num === null || num < 0) {
      return { isValid: false, error: 'Valid price is required' };
    }
    if (num > 1000000) {
      return { isValid: false, error: 'Price cannot exceed ₹10,00,000' };
    }
    return { isValid: true, sanitized: num };
  },

  address: (address: string): ValidationResult => {
    const sanitized = sanitize.safeHtml(address);
    if (!sanitized) {
      return { isValid: false, error: 'Address is required' };
    }
    if (!VALIDATION_PATTERNS.address.test(sanitized)) {
      return { isValid: false, error: 'Address must be 5-200 characters' };
    }
    return { isValid: true, sanitized };
  },

  pincode: (pincode: string): ValidationResult => {
    const sanitized = sanitize.text(pincode);
    if (!sanitized) {
      return { isValid: false, error: 'Pincode is required' };
    }
    if (!VALIDATION_PATTERNS.pincode.test(sanitized)) {
      return { isValid: false, error: 'Pincode must be 6 digits' };
    }
    return { isValid: true, sanitized };
  },

  file: (file: File, allowedTypes: string[], maxSize: number): ValidationResult => {
    if (!file) {
      return { isValid: false, error: 'File is required' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: `File type not allowed. Allowed: ${allowedTypes.join(', ')}` };
    }

    if (file.size > maxSize) {
      return { isValid: false, error: `File too large. Max size: ${maxSize / 1024 / 1024}MB` };
    }

    return { isValid: true, sanitized: file };
  }
};

// Rate limiting utilities
export const rateLimit = {
  attempts: new Map<string, { count: number; resetTime: number }>(),

  check: (key: string, maxAttempts: number, windowMs: number): boolean => {
    const now = Date.now();
    const record = rateLimit.attempts.get(key);

    if (!record || now > record.resetTime) {
      rateLimit.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  },

  reset: (key: string): void => {
    rateLimit.attempts.delete(key);
  }
};

// SQL injection prevention for dynamic queries
export const secureQuery = {
  // Whitelist allowed table names
  allowedTables: ['products', 'profiles', 'reviews', 'purchase_requests', 'orders'],

  // Whitelist allowed columns
  allowedColumns: {
    products: ['id', 'title', 'description', 'price', 'image_url', 'category', 'user_id', 'created_at', 'updated_at'],
    profiles: ['id', 'username', 'full_name', 'email', 'phone', 'address', 'city', 'pincode', 'role'],
    reviews: ['id', 'product_id', 'user_id', 'rating', 'comment', 'photo_url', 'created_at'],
    purchase_requests: ['id', 'product_id', 'buyer_id', 'seller_id', 'status', 'buyer_message', 'created_at'],
    orders: ['id', 'product_id', 'buyer_id', 'full_name', 'phone', 'address', 'city', 'pincode', 'status', 'created_at']
  },

  validateTable: (table: string): boolean => {
    return secureQuery.allowedTables.includes(table);
  },

  validateColumn: (table: string, column: string): boolean => {
    return secureQuery.allowedColumns[table as keyof typeof secureQuery.allowedColumns]?.includes(column) || false;
  }
};
