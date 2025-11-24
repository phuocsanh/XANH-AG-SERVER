/**
 * Application-wide constants
 */

// Security
export const BCRYPT_SALT_ROUNDS = 10;

// File Upload Limits
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed File Types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// JWT
export const JWT_REFRESH_TOKEN_EXPIRY = '7d';
export const JWT_ACCESS_TOKEN_EXPIRY = '1d';

// Cloudinary
export const CLOUDINARY_FOLDER = 'gn-farm';
