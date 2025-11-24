# 👤 Module Người Dùng (User)

**Trạng thái**: ✅ HOÀN THÀNH

---

## 🎯 Tổng Quan

Module quản lý thông tin người dùng, hồ sơ cá nhân và phân quyền.

### Chức Năng Chính:
- Quản lý thông tin tài khoản (User).
- Quản lý hồ sơ chi tiết (UserProfile).
- Cập nhật thông tin cá nhân, đổi mật khẩu.
- Quản lý danh sách người dùng (cho Admin).

---

## 📊 Cấu Trúc Database

### Bảng `users`
- `username`, `password` (hash), `email`, `role`, `status`...

### Bảng `user_profiles`
- `full_name`, `phone`, `address`, `avatar`...

---

## 📝 API Endpoints

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `GET` | `/users` | Lấy danh sách người dùng |
| `GET` | `/users/:id` | Lấy chi tiết người dùng |
| `PATCH` | `/users/:id` | Cập nhật thông tin người dùng |
| `DELETE` | `/users/:id` | Xóa người dùng |
| `PATCH` | `/users/change-password` | Đổi mật khẩu |
