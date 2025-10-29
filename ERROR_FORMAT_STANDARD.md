# Tiêu chuẩn Format Lỗi trong Ứng dụng

## 1. Tổng quan

Tất cả các lỗi trong ứng dụng đều được xử lý theo một format thống nhất để frontend có thể dễ dàng xử lý và hiển thị.

## 2. Format lỗi chuẩn

```json
{
  "statusCode": 400,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/resource",
  "method": "POST",
  "error": "Validation Error",
  "message": "Dữ liệu đầu vào không hợp lệ",
  "details": []
}
```

### Các trường trong format lỗi:

- `statusCode`: Mã HTTP status code
- `timestamp`: Thời gian xảy ra lỗi (ISO 8601 format)
- `path`: Đường dẫn API gây ra lỗi
- `method`: Phương thức HTTP của request
- `error`: Loại lỗi (tên lỗi)
- `message`: Thông báo lỗi dành cho người dùng
- `details`: Chi tiết lỗi (tùy chọn, tùy theo loại lỗi)

## 3. Các loại lỗi và format cụ thể

### 3.1. Lỗi xác thực (Validation Error) - 400

```json
{
  "statusCode": 400,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/users",
  "method": "POST",
  "error": "Validation Error",
  "message": "Dữ liệu đầu vào không hợp lệ",
  "details": [
    "userAccount must be longer than or equal to 3 characters",
    "userPassword must be longer than or equal to 6 characters"
  ]
}
```

### 3.2. Lỗi trùng lặp (Duplicate Record) - 409

```json
{
  "statusCode": 409,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/suppliers",
  "method": "POST",
  "error": "Duplicate Record",
  "message": "Mã nhà cung cấp đã tồn tại",
  "field": "code"
}
```

### 3.3. Không tìm thấy tài nguyên (Not Found) - 404

```json
{
  "statusCode": 404,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/users/999",
  "method": "GET",
  "error": "Resource Not Found",
  "message": "Không tìm thấy người dùng",
  "resource": "user"
}
```

### 3.4. Lỗi logic nghiệp vụ (Business Logic Error) - 400

```json
{
  "statusCode": 400,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/inventory/transfer",
  "method": "POST",
  "error": "Business Logic Error",
  "message": "Số lượng tồn kho không đủ để chuyển",
  "code": "INSUFFICIENT_STOCK"
}
```

### 3.5. Lỗi cơ sở dữ liệu (Database Error) - 500

```json
{
  "statusCode": 500,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/products",
  "method": "POST",
  "error": "Database Error",
  "message": "Lỗi cơ sở dữ liệu",
  "details": {
    "code": "23505",
    "detail": "Key (code)=(ABC001) already exists."
  }
}
```

### 3.6. Lỗi server không xác định (Internal Server Error) - 500

```json
{
  "statusCode": 500,
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/report/generate",
  "method": "GET",
  "error": "Internal Server Error",
  "message": "Đã xảy ra lỗi không mong muốn"
}
```

## 4. Cách xử lý lỗi trong service

Tất cả các service đều sử dụng `ErrorHandler` helper để xử lý lỗi một cách thống nhất:

```typescript
try {
  // Thực hiện thao tác database
  return await this.repository.save(entity);
} catch (error) {
  // Sử dụng ErrorHandler để xử lý lỗi
  ErrorHandler.handleCreateError(error, 'tên entity');
}
```

## 5. Các exception tùy chỉnh

### 5.1. DuplicateRecordException

Dùng khi có bản ghi trùng lặp trong cơ sở dữ liệu.

### 5.2. ValidationException

Dùng khi có lỗi xác thực dữ liệu.

### 5.3. ResourceNotFoundException

Dùng khi không tìm thấy tài nguyên.

### 5.4. BusinessLogicException

Dùng khi có lỗi logic nghiệp vụ.

### 5.5. DatabaseException

Dùng khi có lỗi cơ sở dữ liệu không được xử lý bởi các exception trên.
