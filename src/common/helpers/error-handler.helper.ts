import { QueryFailedError } from 'typeorm';
import { DuplicateRecordException } from '../exceptions/duplicate-record.exception';
import { DatabaseException } from '../exceptions/database.exception';

/**
 * Helper class để xử lý lỗi một cách thống nhất trong các service
 */
export class ErrorHandler {
  /**
   * Xử lý lỗi từ database và chuyển đổi thành các exception phù hợp
   * @param error Lỗi từ database
   * @param entityName Tên của entity đang thao tác (dùng để tạo message phù hợp)
   */
  static handleDatabaseError(
    error: unknown,
    entityName: string = 'bản ghi',
  ): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError;

      // Xử lý lỗi trùng lặp unique constraint
      if (driverError && driverError.code === '23505') {
        let message = `${entityName} đã tồn tại`;

        // Kiểm tra xem lỗi là do trường nào gây ra
        if (driverError.detail) {
          if (driverError.detail.includes('code')) {
            message = `Mã ${entityName} đã tồn tại`;
          } else if (driverError.detail.includes('email')) {
            message = `Email đã tồn tại`;
          } else if (driverError.detail.includes('name')) {
            message = `Tên ${entityName} đã tồn tại`;
          }
        }

        throw new DuplicateRecordException(message);
      }

      // Các lỗi database khác
      throw new DatabaseException('Lỗi cơ sở dữ liệu', {
        code: driverError?.code,
        detail: driverError?.detail,
      });
    }

    // Re-throw các lỗi khác
    throw error;
  }

  /**
   * Xử lý lỗi khi tạo entity
   * @param error Lỗi từ database
   * @param entityName Tên của entity đang thao tác
   */
  static handleCreateError(
    error: unknown,
    entityName: string = 'bản ghi',
  ): never {
    return this.handleDatabaseError(error, entityName);
  }

  /**
   * Xử lý lỗi khi cập nhật entity
   * @param error Lỗi từ database
   * @param entityName Tên của entity đang thao tác
   */
  static handleUpdateError(
    error: unknown,
    entityName: string = 'bản ghi',
  ): never {
    return this.handleDatabaseError(error, entityName);
  }
}
