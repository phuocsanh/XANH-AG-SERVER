# ↩️ Module Trả Hàng (Sales Return)

**Trạng thái**: ✅ HOÀN THÀNH

---

## 🎯 Tổng Quan

Module quản lý quy trình khách hàng trả lại hàng hóa đã mua.

### Chức Năng Chính:
- Tạo phiếu trả hàng từ hóa đơn bán hàng.
- Nhập lại kho hàng trả.
- Hoàn tiền hoặc trừ công nợ cho khách.

---

## 📝 API Endpoints

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `POST` | `/sales-returns` | Tạo phiếu trả hàng |
| `GET` | `/sales-returns` | Danh sách phiếu trả |
| `GET` | `/sales-returns/:id` | Chi tiết phiếu trả |
| `PATCH` | `/sales-returns/:id/status` | Cập nhật trạng thái (Approved/Rejected) |
