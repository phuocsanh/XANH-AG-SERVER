# 🔐 Admin Password Configuration

## 📝 Cách hoạt động

Mật khẩu Super Admin được cấu hình qua **environment variable** để bảo mật hơn.

---

## ⚙️ Cấu hình

### Development (Local)

**File `.env`:**
```bash
# Mật khẩu mặc định cho Super Admin
ADMIN_DEFAULT_PASSWORD=123456
```

### Production (Render/Heroku)

**Render Dashboard:**
1. Vào **Environment** tab
2. Thêm biến:
   - Key: `ADMIN_DEFAULT_PASSWORD`
   - Value: `your_strong_password_here`

**Heroku:**
```bash
heroku config:set ADMIN_DEFAULT_PASSWORD=your_strong_password_here
```

---

## 🔒 Bảo mật

### ⚠️ QUAN TRỌNG:

1. **KHÔNG hardcode password** trong code
2. **KHÔNG commit** file `.env` lên Git
3. **ĐỔI password** ngay sau khi deploy production
4. **SỬ DỤNG password mạnh** cho production

### ✅ Password mạnh:

```bash
# ❌ YẾU
ADMIN_DEFAULT_PASSWORD=123456

# ✅ MẠNH
ADMIN_DEFAULT_PASSWORD=Xanh@AG#2024!Secure$Pass
```

**Generate password mạnh:**
```bash
# Linux/Mac
openssl rand -base64 32

# Hoặc dùng online:
# https://passwordsgenerator.net/
```

---

## 🚀 Workflow

### 1. Development
```bash
# .env
ADMIN_DEFAULT_PASSWORD=123456
```
- Login: `admin` / `123456`
- OK cho dev/testing

### 2. Staging
```bash
# Render Environment
ADMIN_DEFAULT_PASSWORD=Staging@2024!Test
```
- Login: `admin` / `Staging@2024!Test`
- Dùng password khác với production

### 3. Production
```bash
# Render Environment
ADMIN_DEFAULT_PASSWORD=Xanh@AG#Prod$2024!Secure
```
- Login: `admin` / `Xanh@AG#Prod$2024!Secure`
- **ĐỔI NGAY** sau lần login đầu tiên

---

## 📋 Checklist Deploy

- [ ] Set `ADMIN_DEFAULT_PASSWORD` trong Render Environment
- [ ] Deploy application
- [ ] Run seed: `POST /seed/rbac`
- [ ] Login với password từ environment variable
- [ ] **ĐỔI PASSWORD** qua giao diện admin
- [ ] Test login với password mới
- [ ] Xóa `ADMIN_DEFAULT_PASSWORD` khỏi environment (optional)

---

## 🔄 Đổi Password

### Sau khi login lần đầu:

1. Vào **Profile** / **Settings**
2. Chọn **Change Password**
3. Nhập password mới (mạnh)
4. Save

### Hoặc qua API:

```bash
curl -X PATCH https://your-app.com/users/me/password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "Xanh@AG#Prod$2024!Secure",
    "newPassword": "New@Strong#Password$2024"
  }'
```

---

## ❓ FAQ

**Q: Nếu không set `ADMIN_DEFAULT_PASSWORD` thì sao?**
A: Sẽ dùng mặc định `123456` (không an toàn cho production)

**Q: Có thể đổi username `admin` không?**
A: Có, sửa trong `rbac-seed.ts`:
```typescript
const superAdminAccount = process.env.ADMIN_USERNAME || 'admin';
```

**Q: Quên password thì làm sao?**
A: 
1. Connect vào database
2. Reset password bằng SQL:
```sql
UPDATE users 
SET password = '$2b$10$...' -- bcrypt hash của password mới
WHERE account = 'admin';
```

---

**Ngày tạo:** 2025-12-21
**Version:** 1.0.0
