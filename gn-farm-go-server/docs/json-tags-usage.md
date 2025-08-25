# Sử Dụng JSON Tags Cho Database Models

## 🎯 **Vấn đề đã giải quyết**

Trước đây phải convert manual từ database model sang response model:

```go
// ❌ Cách cũ - Manual conversion
userItems := make([]model.UserListItem, len(users))
for i, user := range users {
    userItems[i] = model.UserListItem{
        ID:       user.UserID,
        Account:  user.UserAccount,
        Nickname: user.UserNickname.String,
        Avatar:   user.UserAvatar.String,
        // ... 20+ fields khác
    }
    
    // Format dates manually
    if user.UserBirthday.Valid {
        userItems[i].Birthday = user.UserBirthday.Time.Format("2006-01-02")
    }
    // ...
}
```

## ✅ **Giải pháp mới - JSON Tags**

### 1. **Cấu hình sqlc.yaml**
```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "sql/queries"
    schema: "sql/schema"
    gen:
      go:
        package: "database"
        out: "internal/database"
        emit_json_tags: true
        json_tags_case_style: "camel"
```

### 2. **Database Models với JSON Tags**
```go
// Sau khi regenerate sqlc
type UserProfile struct {
    UserID               int64           `json:"userId"`
    UserAccount          string          `json:"userAccount"`
    UserNickname         sql.NullString  `json:"userNickname"`
    UserAvatar           sql.NullString  `json:"userAvatar"`
    UserState            int16           `json:"userState"`
    UserMobile           sql.NullString  `json:"userMobile"`
    UserGender           sql.NullInt16   `json:"userGender"`
    UserBirthday         sql.NullTime    `json:"userBirthday"`
    UserEmail            sql.NullString  `json:"userEmail"`
    UserIsAuthentication int16           `json:"userIsAuthentication"`
    CreatedAt            sql.NullTime    `json:"createdAt"`
    UpdatedAt            sql.NullTime    `json:"updatedAt"`
}

type Product struct {
    ID                     int32                 `json:"id"`
    ProductName            string                `json:"productName"`
    ProductPrice           string                `json:"productPrice"`
    ProductStatus          sql.NullInt32         `json:"productStatus"`
    ProductThumb           string                `json:"productThumb"`
    ProductPictures        []string              `json:"productPictures"`
    ProductVideos          []string              `json:"productVideos"`
    ProductRatingsAverage  sql.NullString        `json:"productRatingsAverage"`
    ProductVariations      pqtype.NullRawMessage `json:"productVariations"`
    ProductDescription     sql.NullString        `json:"productDescription"`
    ProductSlug            sql.NullString        `json:"productSlug"`
    ProductQuantity        sql.NullInt32         `json:"productQuantity"`
    ProductType            int32                 `json:"productType"`
    SubProductType         []int32               `json:"subProductType"`
    Discount               sql.NullString        `json:"discount"`
    ProductDiscountedPrice string                `json:"productDiscountedPrice"`
    ProductSelled          sql.NullInt32         `json:"productSelled"`
    ProductAttributes      json.RawMessage       `json:"productAttributes"`
    IsDraft                sql.NullBool          `json:"isDraft"`
    IsPublished            sql.NullBool          `json:"isPublished"`
    CreatedAt              time.Time             `json:"createdAt"`
    UpdatedAt              time.Time             `json:"updatedAt"`
}
```

### 3. **Service Code Đơn Giản**
```go
// ✅ Cách mới - Không cần convert!
func (s *SUserLogin) ListUsers(ctx context.Context, in *model.ListUsersInput) (codeResult int, out model.ListUsersOutput, err error) {
    // ... logic get data from database
    
    // 4. No need to convert - use database models directly with JSON tags
    userItems := users  // Chỉ 1 dòng!
    
    // 5. Build response
    out = model.ListUsersOutput{
        Users:      userItems,
        Total:      total,
        Page:       in.Page,
        PageSize:   in.PageSize,
        TotalPages: totalPages,
        HasNext:    hasNext,
        HasPrev:    hasPrev,
        Message:    "Users retrieved successfully",
    }
    
    return response.ErrCodeSuccess, out, nil
}
```

### 4. **Model Alias**
```go
// Trong internal/model/login.go
import "gn-farm-go-server/internal/database"

// UserListItem bây giờ chỉ là alias của database.UserProfile
type UserListItem = database.UserProfile
```

## 🚀 **Lợi ích**

### **Performance**
- ❌ Trước: 25+ dòng code conversion
- ✅ Sau: 1 dòng code
- ❌ Trước: Loop qua từng item để convert
- ✅ Sau: Direct assignment
- ❌ Trước: Memory allocation cho new structs
- ✅ Sau: Reuse existing structs

### **Maintainability**
- ❌ Trước: Phải maintain 2 sets of structs
- ✅ Sau: Chỉ 1 set structs
- ❌ Trước: Khi thêm field mới phải update ở nhiều nơi
- ✅ Sau: Chỉ update database schema
- ❌ Trước: Risk of missing fields khi convert
- ✅ Sau: Không có risk

### **Code Quality**
- ❌ Trước: Duplicate code cho conversion
- ✅ Sau: DRY principle
- ❌ Trước: Manual error-prone conversion
- ✅ Sau: Automatic JSON marshaling

## 📊 **JSON Response**

### **User API Response**
```json
{
  "code": 20001,
  "message": "Success",
  "data": {
    "users": [
      {
        "userId": 1,
        "userAccount": "user@example.com",
        "userNickname": "John Doe",
        "userAvatar": "avatar.jpg",
        "userState": 1,
        "userMobile": "+1234567890",
        "userGender": 1,
        "userBirthday": "1990-01-01T00:00:00Z",
        "userEmail": "user@example.com",
        "userIsAuthentication": 2,
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T10:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### **Product API Response**
```json
{
  "id": 1,
  "productName": "iPhone 15",
  "productPrice": "999.99",
  "productStatus": 1,
  "productThumb": "iphone15.jpg",
  "productPictures": ["pic1.jpg", "pic2.jpg"],
  "productVideos": ["video1.mp4"],
  "productRatingsAverage": "4.5",
  "productDescription": "Latest iPhone",
  "productSlug": "iphone-15",
  "productQuantity": 100,
  "productType": 1,
  "subProductType": [1, 2],
  "discount": "10%",
  "productDiscountedPrice": "899.99",
  "productSelled": 50,
  "isDraft": false,
  "isPublished": true,
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:00:00Z"
}
```

## 🎯 **Kết luận**

- ✅ **Không cần convert manual** nữa
- ✅ **Performance tốt hơn** đáng kể
- ✅ **Code clean hơn** và ít lỗi hơn
- ✅ **Maintainable** và scalable
- ✅ **Consistent** với best practices của Go community

Đây là cách mà **đa số dự án Go production** làm!
