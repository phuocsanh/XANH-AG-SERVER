/**
 * Enum định nghĩa các trạng thái cơ bản dùng chung cho các entity
 * Giúp đảm bảo tính nhất quán trong toàn bộ ứng dụng
 */
export enum BaseStatus {
  ACTIVE = 'active', // Đang hoạt động
  INACTIVE = 'inactive', // Tạm ngưng
  ARCHIVED = 'archived', // Đã lưu trữ
}
