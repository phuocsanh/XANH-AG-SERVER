/**
 * Enum định nghĩa các mã Role chuẩn trong hệ thống
 * Sử dụng để tránh hardcode string khi check quyền trong code
 */
export enum RoleCode {
  SUPER_ADMIN = 'SUPER_ADMIN', // Quản trị viên cấp cao nhất
  ADMIN = 'ADMIN',             // Quản trị viên hệ thống
  MANAGER = 'MANAGER',         // Quản lý
  STAFF = 'STAFF',             // Nhân viên
  FARMER = 'FARMER',           // Nông dân (Khách hàng)
  USER = 'USER',               // Người dùng thông thường
}
