# Hướng Dẫn Tích Hợp Search & Filter API (Refactored)

Tài liệu này hướng dẫn Frontend tích hợp hệ thống tìm kiếm mới được refactor trên Server. Hệ thống mới hỗ trợ tìm kiếm linh hoạt hơn thông qua query parameters phẳng (flat params) đồng thời vẫn giữ tương thích ngược với cấu trúc filters phức tạp cũ.

## 1. Cấu Trúc Request Chung (Base Search)

Tất cả các API `search` (thường là POST hoặc GET tùy endpoint, nhưng cấu trúc DTO hỗ trợ cả hai) đều kế thừa `BaseSearchDto` và hỗ trợ các tham số sau:

| Tên tham số | Kiểu dữ liệu | Mặc định | Mô tả | Ví dụ |
| :--- | :--- | :--- | :--- | :--- |
| `page` | number | 1 | Số trang hiện tại | `1` |
| `limit` | number | 20 | Số lượng bản ghi trên một trang | `50` |
| `sort` | string | `created_at:DESC` | Định dạng sắp xếp: `field:DIRECTION` | `name:ASC`, `price:DESC` |
| `keyword` | string | null | Từ khóa tìm kiếm chung (Global Search). Server sẽ tự động tìm trên các trường quan trọng (tên, mã, sđt...) | `gạo st25`, `0987654321` |

**Lưu ý:** `sort` hỗ trợ sort theo field của bảng (VD: `name:ASC`) hoặc field của relation (VD: `customer.name:DESC` - tùy thuộc setup từng module).

---

## 2. Module Params (Simple Filters)

Ngoài các tham số chung, mỗi module hỗ trợ lọc trực tiếp bằng cách gửi tên trường và giá trị tương ứng. Đây là cách **được khuyến nghị** cho các filter đơn giản trên UI (Dropdown, Input text).

### 2.1. Product (Sản phẩm)
- Endpoint: `/products/search`
- Fields:
  - `name`: Tên sản phẩm (tìm gần đúng)
  - `code`: Mã sản phẩm (tìm chính xác hoặc gần đúng tùy cấu hình)
  - `status`: Trạng thái (`active`, `inactive`)

### 2.2. Customer (Khách hàng)
- Endpoint: `/customers/search`
- Fields:
  - `name`: Tên khách hàng
  - `phone`: Số điện thoại
  - `code`: Mã khách hàng
  - `address`: Địa chỉ

### 2.3. Sales Invoice (Hóa đơn bán hàng)
- Endpoint: `/sales/search`
- Fields:
  - `code`: Mã hóa đơn
  - `customer_id`: ID khách hàng (dùng cho dropdown chọn khách)
  - `season_id`: ID mùa vụ
  - `payment_status`: Trạng thái thanh toán (`unpaid`, `partial`, `paid`)
  - `status`: Trạng thái đơn (`draft`, `pending`, `completed`, `cancelled`)

### 2.4. Payment (Thanh toán/Phiếu thu)
- Endpoint: `/payments/search`
- Fields:
  - `code`: Mã phiếu thu
  - `customer_id`: ID khách hàng
  - `method`: Phương thức thanh toán (`CASH`, `TRANSFER`...)
  - `status`: Trạng thái (`completed`, `cancelled`...)

### 2.5. User (Người dùng)
- Endpoint: `/users/search`
- Fields:
  - `account`: Tên tài khoản
  - `full_name`: Họ tên (tìm theo `profile.nickname`)
  - `role`: Mã quyền (`ADMIN`, `USER`, `STAFF`)
  - `status`: Trạng thái (`active`, `pending`...)

### 2.6. Supplier (Nhà cung cấp)
- Endpoint: `/suppliers/search`
- Fields:
  - `name`: Tên nhà cung cấp
  - `code`: Mã NCC
  - `phone`: Số điện thoại
  - `status`: Trạng thái (`active`...)

### 2.7. Inventory (Kho hàng)
- Endpoint: `/inventory/batches/search`
- Fields:
  - `product_id`: ID sản phẩm
  - `keyword`: Tìm theo mã lô, tên sản phẩm

### 2.8. Debt Note (Công nợ)
- Fields:
  - `code`: Mã phiếu nợ
  - `status`: Trạng thái (`active`, `overdue`, `paid`)

### 2.9. Các Module Khác (Unit, Symbol, ProductType...)
Hầu hết các module danh mục đều hỗ trợ filter:
- `name`: Tên (đơn vị, loại sp, ký hiệu...)

---

## 3. Advanced Filters (Backward Compatibility)
Hệ thống VẪN HỖ TRỢ cấu trúc `filters` mảng phức tạp cũ để đảm bảo không làm hỏng các tính năng lọc nâng cao hiện có trên FE.

```json
{
  "page": 1,
  "filters": [
    { "field": "price", "operator": "gte", "value": 100000 },
    { "field": "created_at", "operator": "between", "value": ["2023-01-01", "2023-12-31"] }
  ],
  "operator": "AND" // hoặc "OR"
}
```

Các operator hỗ trợ: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `notin`, `isnull`, `isnotnull`, `between`.

---

## 4. Ví dụ Triển Khai (Frontend Code)

### Ví dụ 1: Tìm kiếm đơn giản (Search Bar + Status Dropdown)
```typescript
// Gọi API search Products
const params = {
  page: 1,
  limit: 10,
  keyword: 'Gạo ST25',    // User nhập vào ô tìm kiếm
  status: 'active',       // User chọn từ dropdown
  sort: 'price:DESC'      // User click header bảng để sort
};

// Kết quả gọi API:
// POST /products/search
// Body: { "page": 1, "limit": 10, "keyword": "Gao ST25", "status": "active", "sort": "price:DESC" }
```

### Ví dụ 2: Lọc theo danh mục (Dropdown ID)
```typescript
// Gọi API search Hóa đơn theo Mùa vụ và Khách hàng
const params = {
  season_id: 123,
  customer_id: 456,
  page: 1
};
```

## 5. Lợi ích của thay đổi này
1.  **Dễ dùng hơn:** Không cần construct mảng `filters` phức tạp cho các tác vụ đơn giản.
2.  **Chuẩn hóa:** Tất cả module đều dùng chung `keyword` cho global search và `sort` string format.
3.  **Linh hoạt:** Có thể kết hợp cả simple params và advanced filters nếu cần thiết.
