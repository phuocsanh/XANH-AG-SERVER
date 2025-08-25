# API Lấy Danh Sách User Có Phân Trang và Tìm Kiếm

## Mô tả
API này cho phép lấy danh sách user với các tính năng:
- Phân trang (pagination)
- Tìm kiếm theo tên tài khoản hoặc nickname
- Yêu cầu authentication

## Endpoint
```
GET /api/v1/user/list
```

## Headers
```
Authorization: Bearer <access_token>
```

## Query Parameters

| Tham số | Kiểu | Bắt buộc | Mặc định | Mô tả |
|---------|------|----------|----------|-------|
| page | int | Không | 1 | Số trang (bắt đầu từ 1) |
| pageSize | int | Không | 10 | Số lượng user trên mỗi trang (tối đa 100) |
| search | string | Không | "" | Từ khóa tìm kiếm theo tài khoản hoặc nickname |

## Response

### Thành công (200)
```json
{
  "code": 20001,
  "message": "Success",
  "data": {
    "users": [
      {
        "id": 1,
        "account": "user@example.com",
        "nickname": "John Doe",
        "avatar": "https://example.com/avatar.jpg",
        "email": "user@example.com",
        "mobile": "+1234567890",
        "state": 1,
        "gender": 1,
        "birthday": "1990-01-01",
        "isAuth": 2,
        "createdAt": "2024-01-01 10:00:00",
        "updatedAt": "2024-01-01 10:00:00"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false,
    "message": "Users retrieved successfully"
  }
}
```

### Lỗi (401)
```json
{
  "code": 40001,
  "message": "Authentication failed",
  "data": null
}
```

## Ví dụ sử dụng

### 1. Lấy trang đầu tiên
```bash
curl -X GET "http://localhost:8080/api/v1/user/list" \
  -H "Authorization: Bearer your_access_token"
```

### 2. Lấy trang 2 với 5 user mỗi trang
```bash
curl -X GET "http://localhost:8080/api/v1/user/list?page=2&pageSize=5" \
  -H "Authorization: Bearer your_access_token"
```

### 3. Tìm kiếm user theo tên
```bash
curl -X GET "http://localhost:8080/api/v1/user/list?search=john" \
  -H "Authorization: Bearer your_access_token"
```

### 4. Tìm kiếm với phân trang
```bash
curl -X GET "http://localhost:8080/api/v1/user/list?page=1&pageSize=10&search=test" \
  -H "Authorization: Bearer your_access_token"
```

## Ghi chú
- API yêu cầu authentication, cần đăng nhập trước để lấy access token
- Tìm kiếm sẽ tìm trong cả trường `user_account` và `user_nickname`
- Tìm kiếm không phân biệt hoa thường (case-insensitive)
- Page size tối đa là 100, nếu vượt quá sẽ được giới hạn về 100
- Nếu page <= 0, sẽ được set về 1
