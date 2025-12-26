/**
 * Enum định nghĩa các trạng thái của phiếu giao hàng
 */
export enum DeliveryStatus {
  PENDING = 'pending',        // Chờ giao
  DELIVERING = 'delivering',  // Đang giao
  COMPLETED = 'completed',    // Hoàn thành
  FAILED = 'failed',          // Thất bại
  CANCELLED = 'cancelled',    // Hủy
}
