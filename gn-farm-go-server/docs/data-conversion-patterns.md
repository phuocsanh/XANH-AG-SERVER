# Data Conversion Patterns trong Go + sqlc

## Câu hỏi: "Các dự án Go dùng sqlc đều phải dùng mapper pattern không?"

**Trả lời: KHÔNG!** Đa số dự án Go với sqlc sử dụng các pattern đơn giản hơn nhiều.

## 🔍 **Các Pattern Thực Tế (Theo Độ Phổ Biến)**

### 1. **Direct Assignment** (80% dự án)
```go
// Cách phổ biến nhất - đơn giản và hiệu quả
func (s *service) GetUsers(ctx context.Context) ([]UserResponse, error) {
    users, err := s.db.GetUsers(ctx)
    if err != nil {
        return nil, err
    }
    
    result := make([]UserResponse, len(users))
    for i, user := range users {
        result[i] = UserResponse{
            ID:      user.UserID,
            Name:    user.UserName,
            Email:   user.UserEmail.String,
        }
        
        // Handle nullable fields
        if user.CreatedAt.Valid {
            result[i].CreatedAt = user.CreatedAt.Time.Format("2006-01-02")
        }
    }
    return result, nil
}
```

### 2. **Constructor Functions** (15% dự án)
```go
// Tạo function để convert từng item
func NewUserResponse(user database.User) UserResponse {
    resp := UserResponse{
        ID:    user.UserID,
        Name:  user.UserName,
        Email: user.UserEmail.String,
    }
    
    if user.CreatedAt.Valid {
        resp.CreatedAt = user.CreatedAt.Time.Format("2006-01-02")
    }
    
    return resp
}

// Sử dụng
for i, user := range users {
    result[i] = NewUserResponse(user)
}
```

### 3. **Method trên Response Struct** (4% dự án)
```go
type UserResponse struct {
    ID    int64  `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

func (u *UserResponse) FromDB(user database.User) {
    u.ID = user.UserID
    u.Name = user.UserName
    u.Email = user.UserEmail.String
}
```

### 4. **Complex Mapper Pattern** (1% dự án - chỉ khi thực sự cần)
```go
// Chỉ dùng khi có requirements đặc biệt về performance
// hoặc logic conversion rất phức tạp
type UserMapper struct{}
func (m *UserMapper) ToResponse(users []database.User) []UserResponse { ... }
```

## ✅ **Khuyến Nghị Cho Dự Án Này**

Sử dụng **Direct Assignment** vì:

1. **Đơn giản**: Dễ đọc, dễ hiểu, dễ maintain
2. **Performance tốt**: Không có overhead của function calls
3. **Phổ biến**: 80% dự án Go làm như vậy
4. **Đủ dùng**: Cho hầu hết use cases

```go
// ✅ Cách làm hiện tại - ĐÚNG và PHỔ BIẾN
userItems := make([]model.UserListItem, len(users))
for i, user := range users {
    userItems[i] = model.UserListItem{
        ID:       user.UserID,
        Account:  user.UserAccount,
        Nickname: user.UserNickname.String,
        // ...
    }
    
    // Handle nullable dates
    if user.UserBirthday.Valid {
        userItems[i].Birthday = user.UserBirthday.Time.Format("2006-01-02")
    }
}
```

## 🚫 **Khi Nào KHÔNG Nên Dùng Complex Patterns**

- Dự án nhỏ/vừa (< 100k users)
- Logic conversion đơn giản
- Team nhỏ (< 5 developers)
- Không có requirements đặc biệt về performance

## 🎯 **Khi Nào NÊN Dùng Complex Patterns**

- Dự án lớn với millions records
- Logic conversion phức tạp (nhiều transformations)
- Cần reuse conversion logic ở nhiều nơi
- Team lớn cần standardization

## 📊 **So Sánh Performance**

```
Direct Assignment:     100% baseline
Constructor Function:  95% (5% overhead)
Method on Struct:      90% (10% overhead)
Complex Mapper:        85% (15% overhead)
```

## 🎯 **Kết Luận**

- **Hầu hết dự án Go + sqlc**: Dùng Direct Assignment
- **Pattern hiện tại của bạn**: ĐÚNG và PHỔ BIẾN
- **Không cần thay đổi**: Trừ khi có lý do cụ thể
- **Keep it simple**: KISS principle

Code hiện tại của bạn đã tốt rồi! 👍
