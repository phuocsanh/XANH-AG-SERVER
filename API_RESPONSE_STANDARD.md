# Tiêu chuẩn Response cho API

## 1. Cấu trúc Response Thành công

Tất cả các API thành công sẽ trả về response theo cấu trúc chuẩn sau:

### Response thông thường:

```json
{
  "success": true,
  "data": {...},
  "meta": {
    "timestamp": "2023-01-01T00:00:00Z",
    "path": "/api/v1/resource",
    "method": "GET"
  }
}
```

### Response có phân trang:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "timestamp": "2023-01-01T00:00:00Z",
    "path": "/api/v1/resource",
    "method": "GET"
  },
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Các trường trong response:

| Trường                | Kiểu dữ liệu | Bắt buộc | Mô tả                                                 |
| --------------------- | ------------ | -------- | ----------------------------------------------------- |
| success               | boolean      | Có       | Luôn là `true` cho response thành công                |
| data                  | any          | Có       | Dữ liệu trả về từ API                                 |
| meta                  | object       | Có       | Metadata của response                                 |
| meta.timestamp        | string       | Có       | Thời gian response (ISO 8601)                         |
| meta.path             | string       | Có       | Đường dẫn của request                                 |
| meta.method           | string       | Có       | Phương thức HTTP của request                          |
| pagination            | object       | Không    | Thông tin phân trang (chỉ có với endpoint phân trang) |
| pagination.total      | number       | Có       | Tổng số bản ghi                                       |
| pagination.page       | number       | Có       | Trang hiện tại                                        |
| pagination.limit      | number       | Có       | Số bản ghi mỗi trang                                  |
| pagination.totalPages | number       | Có       | Tổng số trang                                         |

## 2. Cấu trúc Response Lỗi (RFC 7807)

Tất cả các API lỗi sẽ tuân theo chuẩn RFC 7807:

```json
{
  "type": "https://example.com/probs/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Dữ liệu đầu vào không hợp lệ",
  "details": [
    {
      "field": "name",
      "message": "name must be a string"
    }
  ]
}
```

### Các trường trong response lỗi:

| Trường   | Kiểu dữ liệu | Bắt buộc | Mô tả                                |
| -------- | ------------ | -------- | ------------------------------------ |
| type     | string (URI) | Có       | URI định danh loại lỗi               |
| title    | string       | Có       | Tiêu đề ngắn gọn của lỗi             |
| status   | number       | Có       | HTTP status code                     |
| detail   | string       | Không    | Mô tả chi tiết lỗi                   |
| instance | string (URI) | Không    | URI xác định instance cụ thể của lỗi |

## 3. Ví dụ cụ thể

### 3.1. GET /suppliers (thành công có phân trang)

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Nhà cung cấp A",
      "code": "NCC001"
    },
    {
      "id": 2,
      "name": "Nhà cung cấp B",
      "code": "NCC002"
    }
  ],
  "meta": {
    "timestamp": "2023-01-01T10:00:00Z",
    "path": "/suppliers",
    "method": "GET"
  },
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### 3.2. POST /suppliers (thành công không phân trang)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Nhà cung cấp mới",
    "code": "NCC003"
  },
  "meta": {
    "timestamp": "2023-01-01T10:00:00Z",
    "path": "/suppliers",
    "method": "POST"
  }
}
```

### 3.3. Validation Error (400)

```json
{
  "type": "https://example.com/probs/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Dữ liệu đầu vào không hợp lệ",
  "details": [
    {
      "field": "name",
      "message": "name must be a string"
    },
    {
      "field": "code",
      "message": "code must be a string"
    }
  ]
}
```

### 3.4. Resource Not Found (404)

```json
{
  "type": "https://example.com/probs/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Không tìm thấy nhà cung cấp với ID: 999"
}
```

### 3.5. Internal Server Error (500)

```json
{
  "type": "https://example.com/probs/internal-server-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "Đã xảy ra lỗi không mong muốn"
}
```

## 4. HTTP Status Codes

| Status Code | Ý nghĩa               | Khi nào sử dụng                                   |
| ----------- | --------------------- | ------------------------------------------------- |
| 200         | OK                    | Request thành công                                |
| 201         | Created               | Tạo resource mới thành công                       |
| 204         | No Content            | Request thành công nhưng không có nội dung trả về |
| 400         | Bad Request           | Request không hợp lệ (validation error)           |
| 401         | Unauthorized          | Chưa xác thực                                     |
| 403         | Forbidden             | Không có quyền truy cập                           |
| 404         | Not Found             | Không tìm thấy resource                           |
| 409         | Conflict              | Xung đột dữ liệu (duplicate record)               |
| 500         | Internal Server Error | Lỗi server                                        |

## 5. Hướng dẫn cho Frontend

### 5.1. Xử lý response thành công:

```javascript
// Kiểm tra response thành công
if (response.success) {
  // Sử dụng response.data
  const data = response.data;

  // Nếu có phân trang
  if (response.pagination) {
    const { total, page, limit, totalPages } = response.pagination;
  }
}
```

### 5.2. Xử lý response lỗi:

```javascript
// Kiểm tra HTTP status code
if (response.status >= 400) {
  // Sử dụng response.title và response.detail
  const { title, detail, details } = response;

  // Hiển thị lỗi cho người dùng
  showError(title, detail);

  // Nếu có details (validation error)
  if (details) {
    // Hiển thị lỗi chi tiết cho từng field
    details.forEach((error) => {
      if (error.field) {
        showFieldError(error.field, error.message);
      }
    });
  }
}
```
