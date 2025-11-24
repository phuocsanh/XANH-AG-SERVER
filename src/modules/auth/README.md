# 🔐 Module Xác Thực (Auth)

**Trạng thái**: ✅ HOÀN THÀNH

---

## 🎯 Tổng Quan

Module này chịu trách nhiệm xử lý xác thực người dùng, đăng nhập, đăng ký và quản lý phiên làm việc (session) thông qua JWT (JSON Web Token).

### Chức Năng Chính:
- Đăng nhập (Login)
- Đăng ký (Register)
- Làm mới token (Refresh Token)
- Đăng xuất (Logout)
- Bảo vệ các route yêu cầu đăng nhập (Auth Guard)

---

## 📝 API Endpoints

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `POST` | `/auth/login` | Đăng nhập, trả về Access Token & Refresh Token |
| `POST` | `/auth/register` | Đăng ký tài khoản mới |
| `POST` | `/auth/refresh` | Lấy Access Token mới bằng Refresh Token |
| `POST` | `/auth/logout` | Đăng xuất, vô hiệu hóa Refresh Token |
| `GET` | `/auth/profile` | Lấy thông tin người dùng hiện tại |

---

## 🔄 Workflow Xác Thực

1. **Đăng nhập**:
   - Client gửi `username` và `password`.
   - Server kiểm tra, nếu đúng trả về `accessToken` (ngắn hạn) và `refreshToken` (dài hạn).
2. **Sử dụng API**:
   - Client gửi `accessToken` trong header `Authorization: Bearer <token>`.
3. **Hết hạn Token**:
   - Khi `accessToken` hết hạn, Client gọi `/auth/refresh` với `refreshToken` để lấy cặp token mới.
