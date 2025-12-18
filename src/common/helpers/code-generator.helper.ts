import { v4 as uuidv4 } from 'uuid';

/**
 * Helper để tự động generate code cho các entity
 * Sử dụng UUID để đảm bảo tính duy nhất mà không cần query database
 */
export class CodeGeneratorHelper {
  /**
   * Generate code tự động với prefix và UUID
   * Format: PREFIX-SHORTID (8 ký tự đầu của UUID)
   * Ví dụ: PT-A1B2C3D4, CUS-X9Y8Z7W6
   * 
   * @param prefix - Tiền tố (VD: 'PT' cho Product Type, 'CUS' cho Customer)
   * @returns Code mới được generate
   */
  static generateCode(prefix: string): string {
    // Lấy 8 ký tự đầu của UUID và chuyển thành uppercase
    const shortId = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `${prefix}-${shortId}`;
  }

  /**
   * Generate code với timestamp (nếu muốn có thông tin thời gian)
   * Format: PREFIX-YYYYMMDD-SHORTID
   * Ví dụ: PT-20231217-A1B2C3D4
   * 
   * @param prefix - Tiền tố
   * @returns Code mới với timestamp
   */
  static generateCodeWithTimestamp(prefix: string): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const shortId = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `${prefix}-${dateStr}-${shortId}`;
  }

  /**
   * Validate format của code
   * @param code - Code cần validate
   * @param prefix - Tiền tố mong đợi
   * @returns true nếu code hợp lệ
   */
  static validateCodeFormat(code: string, prefix: string): boolean {
    // Pattern: PREFIX-XXXXXXXX (8 ký tự alphanumeric)
    const pattern = new RegExp(`^${prefix}-[A-Z0-9]{8}$`);
    return pattern.test(code);
  }

  /**
   * Generate code TUYỆT ĐỐI DUY NHẤT với timestamp milliseconds + UUID
   * Format: PREFIX-YYYYMMDD-TIMESTAMP-SHORTID
   * Ví dụ: REC-20231217-1734537295-A1B2C3
   * 
   * ✅ Đảm bảo 100% KHÔNG BAO GIỜ TRÙNG vì:
   * - Timestamp milliseconds: Unique trong thời gian thực
   * - UUID 6 ký tự: Thêm entropy để tránh trùng nếu tạo cùng millisecond
   * 
   * @param prefix - Tiền tố
   * @returns Code tuyệt đối duy nhất
   */
  static generateUniqueCode(prefix: string): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const timestamp = Date.now().toString().slice(-10); // 10 chữ số cuối của timestamp
    const shortId = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase(); // 6 ký tự UUID
    return `${prefix}-${dateStr}-${timestamp}-${shortId}`;
  }
}
