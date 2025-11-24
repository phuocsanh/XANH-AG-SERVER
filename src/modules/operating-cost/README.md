# 💸 Module Chi Phí Vận Hành (Operating Cost)

**Trạng thái**: ✅ HOÀN THÀNH

---

## 🎯 Tổng Quan

Module quản lý các khoản chi phí vận hành của trang trại/doanh nghiệp (điện, nước, nhân công, thuê máy móc...).

### Chức Năng Chính:
- Ghi nhận chi phí phát sinh.
- Phân loại chi phí.
- Báo cáo tổng chi phí theo thời gian/mùa vụ.

---

## 📝 API Endpoints

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `POST` | `/operating-costs` | Thêm khoản chi phí mới |
| `GET` | `/operating-costs` | Danh sách chi phí |
| `PATCH` | `/operating-costs/:id` | Cập nhật chi phí |
| `DELETE` | `/operating-costs/:id` | Xóa khoản chi |
| `GET` | `/operating-costs/report` | Báo cáo tổng hợp |
