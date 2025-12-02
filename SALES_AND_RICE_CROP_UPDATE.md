# Hướng Dẫn Tích Hợp Frontend: Cập Nhật Vụ Lúa & Hóa Đơn

Tài liệu này mô tả các thay đổi mới nhất liên quan đến **Vụ lúa (Rice Crop)** và **Hóa đơn bán hàng (Sales Invoice)**.

## 1. Quản Lý Vụ Lúa (Rice Crop)

### Thay đổi
Thêm trường **Số công lớn** (`large_labor_days`) để quản lý diện tích tính theo công.

### API: Tạo/Cập nhật Vụ lúa
*   **Endpoint:** `POST /rice-crops` hoặc `PATCH /rice-crops/:id`
*   **Trường mới:** `large_labor_days` (Number, decimal)
*   **Quy tắc:**
    *   **Bắt buộc** khi tạo mới (`POST`).
    *   Tùy chọn khi cập nhật (`PATCH`).
    *   Giá trị phải >= 0.

**Ví dụ Payload (Tạo mới):**
```json
{
  "customer_id": 1,
  "season_id": 1,
  "field_name": "Ruộng Gò",
  "field_area": 5000,
  "large_labor_days": 10,  // <-- MỚI: Bắt buộc
  "rice_variety": "OM 5451",
  "location": "An Giang"
}
```

---

## 2. Hóa Đơn Bán Hàng (Sales Invoice)

### Thay đổi
Liên kết hóa đơn với **Vụ lúa** và **Mùa vụ** để quản lý chi phí chi tiết.

### API: Tạo Hóa Đơn Mới
*   **Endpoint:** `POST /sales`
*   **Trường mới:**
    *   `rice_crop_id` (Number, Optional): ID của vụ lúa mà khách hàng mua vật tư cho.
    *   `season_id` (Number, Optional): ID của mùa vụ (thường được tự động lấy từ vụ lúa hoặc chọn tay).

**Logic Frontend đề xuất:**
1.  Khi chọn khách hàng -> Load danh sách vụ lúa đang hoạt động (`status=active`) của khách đó.
2.  Cho phép chọn **Vụ lúa**.
3.  Nếu chọn Vụ lúa -> Tự động điền **Mùa vụ** (`season_id`) tương ứng.
4.  Gửi cả `rice_crop_id` và `season_id` về API.

**Ví dụ Payload:**
```json
{
  "customer_id": 1,
  "customer_name": "Nguyễn Văn A",
  "rice_crop_id": 5,       // <-- MỚI: Gắn với vụ lúa cụ thể
  "season_id": 1,          // <-- MỚI: Gắn với mùa vụ
  "total_amount": 1000000,
  "final_amount": 1000000,
  "payment_method": "cash",
  "items": [
    { "product_id": 10, "quantity": 2, "unit_price": 500000 }
  ]
}
```

### API: Tìm Kiếm & Lọc Hóa Đơn
*   **Endpoint:** `POST /sales/search`
*   **Cách lọc:** Sử dụng mảng `filters` để lọc theo `rice_crop_id`.

**Ví dụ 1: Lọc hóa đơn của một vụ lúa cụ thể**
```json
{
  "page": 1,
  "limit": 20,
  "filters": [
    {
      "field": "rice_crop_id",
      "operator": "eq",
      "value": 5
    }
  ]
}
```

**Ví dụ 2: Lọc hóa đơn vãng lai (không gắn vụ lúa)**
```json
{
  "page": 1,
  "limit": 20,
  "filters": [
    {
      "field": "rice_crop_id",
      "operator": "isnull",
      "value": true
    }
  ]
}
```

## 3. Tóm Tắt Luồng Nghiệp Vụ Mới

1.  **Tạo Vụ Lúa:** Nông dân khai báo diện tích và **số công lớn** (`large_labor_days`).
2.  **Bán Hàng:** Khi nông dân mua chịu hoặc tiền mặt:
    *   Nhân viên chọn tên khách hàng.
    *   Hệ thống hiện danh sách ruộng (vụ lúa) của khách.
    *   Nhân viên chọn "Ruộng sau nhà" (`rice_crop_id`).
    *   Hóa đơn được lưu và gắn liền với ruộng đó.
3.  **Báo Cáo:**
    *   Có thể xem tổng chi phí cho từng ruộng cụ thể dựa trên `rice_crop_id`.
    *   Tính giá thành sản xuất chính xác cho từng thửa ruộng.
