# 📎 Module Theo Dõi File (File Tracking)

**Trạng thái**: ✅ HOÀN THÀNH

---

## 🎯 Tổng Quan

Module quản lý việc theo dõi các file đã upload, liên kết chúng với các entity khác (Product, User...) và dọn dẹp file rác.

### Chức Năng Chính:
- Lưu trữ metadata của file (tên, đường dẫn, kích thước, loại).
- Theo dõi file đang được sử dụng ở đâu.
- Xóa file vật lý khi không còn được tham chiếu.

---

## 📝 API Endpoints

Module này chủ yếu cung cấp Service cho các module khác sử dụng, ít khi gọi trực tiếp qua API public.

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `GET` | `/file-tracking` | Danh sách file (Admin) |
| `DELETE` | `/file-tracking/:id` | Xóa file thủ công |
