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
export const JWT_REFRESH_TOKEN_EXPIRY = '90d'; // 3 tháng - cho ứng dụng cần đăng nhập lâu dài
export const JWT_ACCESS_TOKEN_EXPIRY = '1d';

// Cloudinary
export const CLOUDINARY_FOLDER = 'xanh-ag';

export enum UploadType {
  AVATAR = 'avatar',
  PRODUCT = 'product',
  RICE_CROP = 'rice-crop',
  DOCUMENT = 'document',
  COMMON = 'common',
}

export const UPLOAD_FOLDER_MAP: Record<UploadType, string> = {
  [UploadType.AVATAR]: 'avatars',
  [UploadType.PRODUCT]: 'products',
  [UploadType.RICE_CROP]: 'rice-crops',
  [UploadType.DOCUMENT]: 'documents',
  [UploadType.COMMON]: 'common',
};
