# Hướng Dẫn Migration API Search (Quan trọng)

Tài liệu này hướng dẫn Frontend Team cách gọi các API Search/Filter sau khi Backend đã refactor để loại bỏ logic `filters` cũ.

## 🚨 THAY ĐỔI QUAN TRỌNG

1.  **ĐÃ BỎ:** Param `filters` (dạng array json hoặc object) **không còn được hỗ trợ**. Backend sẽ **KHÔNG** đọc param này nữa.
2.  **BẮT BUỘC:** Chuyển sang dùng **Flat Query Parameters** (truyền trực tiếp key-value lên URL).

### Ví dụ So Sánh

❌ **Cũ (SAI - Đừng dùng nữa):**
```http
GET /products?filters=[{"field":"status","operator":"eq","value":"active"}]&filters=[{"field":"unit_name","operator":"like","value":"kg"}]
```

✅ **Mới (ĐÚNG):**
```http
GET /products?status=active&unit_name=kg&search=lua
```

---

## Các Param Chung (Base Search)
Áp dụng cho tất cả các modules:
*   `page`: Số trang (Ví dụ: `1`).
*   `limit`: Số item/trang (Ví dụ: `20`).
*   `sort_by`: (Hoặc dùng `sort="created_at:DESC"`) Tên trường sort (Ví dụ: `created_at`).
*   `sort_order`: `ASC` hoặc `DESC` (nếu dùng `sort_by`).
*   `keyword`: (Hoặc `search` tùy module nhưng `keyword` là chuẩn mới) Tìm kiếm chung trên nhiều trường.

---

## Chi tiết Params theo Module

Dưới đây là danh sách các fields bạn có thể filter trực tiếp.

### 1. Product (Sản phẩm)
*   **Các trường filter:**
    *   `code`: Mã sản phẩm
    *   `name`: Tên sản phẩm
    *   `status`: Trạng thái (`active`, `inactive`...)
    *   `unit_name`: Tên đơn vị tính (search like)
    *   `type_name`: Tên loại sản phẩm (search like)
    *   `subtype_name`: Tên chi tiết loại (search like)
    *   `notes`: Ghi chú
    *   `deleted_at`: Lọc sản phẩm đã xóa

### 2. Customer (Khách hàng)
*   **Các trường filter:**
    *   `code`: Mã khách hàng
    *   `name`: Tên khách hàng
    *   `phone`: Số điện thoại
    *   `email`: Email
    *   `address`: Địa chỉ
    *   `status`: Trạng thái
    *   `type`: Loại khách hàng
    *   `group`: Nhóm
    *   `full_name`: (Alias cho name)

### 3. Operating Cost (Chi phí vận hành)
*   **Các trường filter:**
    *   `code`: Mã chi phí
    *   `amount`: Số tiền
    *   `expense_date`: Ngày chi (YYYY-MM-DD)
    *   `season_id`: ID mùa vụ
    *   `rice_crop_id`: ID vụ lúa
    *   `cost_type_id`: ID loại chi phí
    *   `season_name`: Tên mùa vụ (Search text)
    *   `rice_crop_name`: Tên vụ lúa (Search text)
    *   `cost_type_name`: Tên loại chi phí (Search text)

### 4. User (Người dùng)
*   **Các trường filter:**
    *   `account`: Tên tài khoản
    *   `full_name`: Tên hiển thị (Nickname)
    *   `email`: Email
    *   `phone_number`: SĐT
    *   `status`: Trạng thái (`ACTIVE`, `PENDING`...)
    *   `role`: Mã quyền (`ADMIN`, `USER`, `STAFF`...)
    *   `user_type`: (Alias cho role)

### 5. Supplier (Nhà cung cấp)
*   **Các trường filter:**
    *   `code`: Mã
    *   `name`: Tên
    *   `phone`: SĐT
    *   `address`: Địa chỉ
    *   `status`: Trạng thái (Lưu ý: Nếu không truyền `status`, backend mặc định lấy `active`. Muốn lấy all cần truyền override).

### 6. Season (Mùa vụ)
*   **Các trường filter:**
    *   `code`, `name`
    *   `status`
    *   `start_date`, `end_date`

### 7. Unit (Đơn vị tính) & Symbol (Ký hiệu)
*   **Các trường filter:**
    *   `code`, `name`
    *   `description`
    *   `status`

### 8. Payment (Thanh toán)
*   **Các trường filter:**
    *   `code`
    *   `customer_id`: ID khách hàng
    *   `customer_name`: Tên khách hàng (Search text)
    *   `customer_phone`: SĐT khách hàng
    *   `debt_note_code`: Mã công nợ
    *   `payment_method`: Phương thức (`CASH`, `TRANSFER`...)
    *   `payment_date`: Ngày thanh toán
    *   `start_date`, `end_date`: Lọc theo khoảng thời gian (nếu có implementation).

---

## ⚠️ YÊU CẦU ACTION TỪ FE
1.  **Review lại toàn bộ code gọi API search/list.**
2.  **Remove** đoạn code nào đang build param `filters` (JSON stringify).
3.  **Replace** bằng việc truyền thẳng object params vào query.

Ví dụ sửa code JS/TS:
```typescript
// ❌ code cũ:
// const params = { filters: JSON.stringify([{ field: 'status', operator: 'eq', value: 'active' }]) };

// ✅ code mới:
const params = { status: 'active', page: 1, limit: 10 };
// axios.get('/products', { params })
```
