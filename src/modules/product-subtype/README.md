# 📂 Module Loại Phụ Sản Phẩm (Product Subtype)

**Trạng thái**: ✅ HOÀN THÀNH

---

## 🎯 Tổng Quan

Module quản lý các nhóm con của sản phẩm (Ví dụ: Phân bón lá, Phân bón gốc, Thuốc trừ sâu sinh học...).

### Chức Năng Chính:
- CRUD loại phụ sản phẩm.
- Liên kết với Loại sản phẩm chính.

---

## 📝 API Endpoints

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `GET` | `/product-subtypes` | Danh sách loại phụ |
| `POST` | `/product-subtypes` | Thêm loại phụ |
| `PATCH` | `/product-subtypes/:id` | Sửa loại phụ |
| `DELETE` | `/product-subtypes/:id` | Xóa loại phụ |
