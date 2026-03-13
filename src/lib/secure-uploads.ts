// Comprehensive Secure File Upload System
// Protects against malicious uploads, malware, and abuse

import { validate } from './security';

export interface UploadConfig {
  allowedTypes: string[];
  maxSize: number; // in bytes
  maxFiles?: number;
  requireAuth?: boolean;
  scanForMalware?: boolean;
  secureNaming?: boolean;
}

export interface UploadResult {
  success: boolean;
  file?: ProcessedFile;
  error?: string;
  warnings?: string[];
}

export interface ProcessedFile {
  originalName: string;
  safeName: string;
  mimeType: string;
  size: number;
  hash: string;
  path: string;
  uploadedAt: Date;
}

// File type validation
export const FILE_VALIDATION = {
  // Image files
  images: {
    types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },

  // Document files
  documents: {
    types: ['application/pdf', 'text/plain', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.pdf', '.txt', '.doc', '.docx'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },

  // Video files (for product videos)
  videos: {
    types: ['video/mp4', 'video/webm', 'video/ogg'],
    extensions: ['.mp4', '.webm', '.ogg'],
    maxSize: 50 * 1024 * 1024, // 50MB
  }
};

// File signature validation (magic bytes)
const FILE_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'video/mp4': [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70],
};

// Validate file signature (magic bytes)
export async function validateFileSignature(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
      const signature = FILE_SIGNATURES[file.type];

      if (!signature) {
        resolve(false);
        return;
      }

      // Check if file starts with expected signature
      const matches = signature.every((byte, index) => buffer[index] === byte);
      resolve(matches);
    };
    reader.readAsArrayBuffer(file.slice(0, 10)); // Read first 10 bytes
  });
}

// Basic malware scanning (detects suspicious patterns)
export const malwareScanner = {
  // Suspicious file patterns
  suspiciousPatterns: [
    /<script/i,  // Script tags
    /javascript:/i,  // JavaScript URLs
    /vbscript:/i,   // VBScript
    /onload\s*=/i,  // Event handlers
    /eval\s*\(/i,   // eval() calls
    /document\.cookie/i,  // Cookie access
    /localStorage/i,      // Local storage access
    /sessionStorage/i,    // Session storage access
    /XMLHttpRequest/i,    // AJAX requests
    /fetch\s*\(/i,        // Fetch API
    /WebSocket/i,         // WebSocket connections
    /import\s*\(/i,       // Dynamic imports
    /require\s*\(/i,      // Node.js requires
  ],

  // Scan file content for malware patterns
  async scanContent(file: File): Promise<{ safe: boolean; threats: string[] }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const threats: string[] = [];

        // Check for suspicious patterns
        for (const pattern of malwareScanner.suspiciousPatterns) {
          if (pattern.test(content)) {
            threats.push(`Detected suspicious pattern: ${pattern.source}`);
          }
        }

        // Additional checks for text-based files
        if (file.type.startsWith('text/') || file.type === 'application/javascript') {
          // Check for encoded JavaScript
          if (/\\x[0-9a-f]{2}/i.test(content) || /\\u[0-9a-f]{4}/i.test(content)) {
            threats.push('Detected encoded content');
          }

          // Check for base64 encoded scripts
          if (/data:text\/html;base64,/i.test(content)) {
            threats.push('Detected base64 encoded HTML');
          }
        }

        resolve({
          safe: threats.length === 0,
          threats
        });
      };
      reader.readAsText(file);
    });
  },

  // Scan file metadata for suspicious attributes
  scanMetadata(file: File): { safe: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check filename for suspicious patterns
    const suspiciousNames = [
      'cmd.exe', 'powershell.exe', 'bash', 'sh',
      '..', '...', 'con', 'prn', 'aux', 'nul',
      'script', 'malware', 'virus', 'trojan'
    ];

    const fileName = file.name.toLowerCase();
    for (const name of suspiciousNames) {
      if (fileName.includes(name)) {
        warnings.push(`Suspicious filename: ${file.name}`);
      }
    }

    // Check file size (unusually small files might be stubs)
    if (file.size < 10) {
      warnings.push('File unusually small');
    }

    // Check for double extensions
    const extensions = fileName.split('.').slice(1);
    if (extensions.length > 1) {
      warnings.push('Multiple file extensions detected');
    }

    return {
      safe: warnings.length === 0,
      warnings
    };
  }
};

// Generate secure filename
export function generateSecureFilename(originalName: string, userId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'file';

  // Create secure filename: timestamp-random-userId.extension
  const components = [timestamp, random];
  if (userId) components.push(userId);

  return `${components.join('-')}.${extension}`;
}

// Calculate file hash for integrity checking
export function calculateFileHash(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const hashBuffer = crypto.subtle.digest('SHA-256', buffer);
      hashBuffer.then(hash => {
        const hashArray = Array.from(new Uint8Array(hash));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

// Comprehensive file upload processor
export class SecureFileUpload {
  private config: UploadConfig;

  constructor(config: UploadConfig) {
    this.config = {
      scanForMalware: true,
      secureNaming: true,
      ...config
    };
  }

  async processFile(file: File, userId?: string): Promise<UploadResult> {
    const warnings: string[] = [];

    try {
      // 1. Basic validation
      const basicValidation = validate.file(file, this.config.allowedTypes, this.config.maxSize);
      if (!basicValidation.isValid) {
        return { success: false, error: basicValidation.error };
      }

      // 2. File signature validation
      const signatureValid = await validateFileSignature(file);
      if (!signatureValid) {
        return { success: false, error: 'File signature validation failed - file may be corrupted or malicious' };
      }

      // 3. Metadata scanning
      const metadataScan = malwareScanner.scanMetadata(file);
      if (!metadataScan.safe) {
        warnings.push(...metadataScan.warnings);
      }

      // 4. Content scanning (for text-based files)
      if (this.config.scanForMalware && (file.type.startsWith('text/') ||
          file.type === 'application/javascript' ||
          file.type === 'application/json')) {
        const contentScan = await malwareScanner.scanContent(file);
        if (!contentScan.safe) {
          return {
            success: false,
            error: 'Malicious content detected',
            warnings: contentScan.threats
          };
        }
      }

      // 5. Generate secure filename
      const safeName = this.config.secureNaming
        ? generateSecureFilename(file.name, userId)
        : file.name;

      // 6. Calculate file hash
      const hash = await calculateFileHash(file);

      // 7. Create processed file object
      const processedFile: ProcessedFile = {
        originalName: file.name,
        safeName,
        mimeType: file.type,
        size: file.size,
        hash,
        path: `/uploads/${safeName}`, // Adjust path as needed
        uploadedAt: new Date()
      };

      return {
        success: true,
        file: processedFile,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: `Upload processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async processMultipleFiles(files: FileList | File[], userId?: string): Promise<UploadResult[]> {
    const maxFiles = this.config.maxFiles || 10;
    const fileArray = Array.from(files);

    if (fileArray.length > maxFiles) {
      return [{ success: false, error: `Too many files. Maximum allowed: ${maxFiles}` }];
    }

    const results = await Promise.all(
      fileArray.map(file => this.processFile(file, userId))
    );

    return results;
  }
}

// Pre-configured upload handlers
export const uploadHandlers = {
  // Product images
  productImage: new SecureFileUpload({
    allowedTypes: FILE_VALIDATION.images.types,
    maxSize: FILE_VALIDATION.images.maxSize,
    maxFiles: 5,
    requireAuth: true,
    scanForMalware: true,
    secureNaming: true
  }),

  // Review photos
  reviewPhoto: new SecureFileUpload({
    allowedTypes: FILE_VALIDATION.images.types,
    maxSize: 2 * 1024 * 1024, // 2MB
    maxFiles: 3,
    requireAuth: true,
    scanForMalware: true,
    secureNaming: true
  }),

  // Product videos
  productVideo: new SecureFileUpload({
    allowedTypes: FILE_VALIDATION.videos.types,
    maxSize: FILE_VALIDATION.videos.maxSize,
    maxFiles: 1,
    requireAuth: true,
    scanForMalware: false, // Videos are binary, skip content scanning
    secureNaming: true
  }),

  // Documents
  document: new SecureFileUpload({
    allowedTypes: FILE_VALIDATION.documents.types,
    maxSize: FILE_VALIDATION.documents.maxSize,
    maxFiles: 1,
    requireAuth: true,
    scanForMalware: true,
    secureNaming: true
  })
};

// Upload progress tracking
export const uploadProgress = {
  trackers: new Map<string, { loaded: number; total: number; percentage: number }>(),

  start: (uploadId: string, total: number) => {
    uploadProgress.trackers.set(uploadId, { loaded: 0, total, percentage: 0 });
  },

  update: (uploadId: string, loaded: number) => {
    const tracker = uploadProgress.trackers.get(uploadId);
    if (tracker) {
      tracker.loaded = loaded;
      tracker.percentage = Math.round((loaded / tracker.total) * 100);
    }
  },

  get: (uploadId: string) => {
    return uploadProgress.trackers.get(uploadId);
  },

  complete: (uploadId: string) => {
    uploadProgress.trackers.delete(uploadId);
  }
};
