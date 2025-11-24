# ☁️ Module Upload (Upload)

**Trạng thái**: ✅ HOÀN THÀNH

---

## 🎯 Tổng Quan

Module xử lý việc upload file lên Cloudinary hoặc Local Storage.

### Chức Năng Chính:
- Upload ảnh, tài liệu.
- Validate loại file, kích thước.
- Tối ưu hóa hình ảnh.

---

## 📝 API Endpoints

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `POST` | `/upload` | Upload file đơn lẻ |
| `POST` | `/upload/multiple` | Upload nhiều file |
| `DELETE` | `/upload/:publicId` | Xóa file trên cloud |
