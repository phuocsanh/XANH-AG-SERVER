# 🛡️ Hướng Dẫn Tích Hợp RBAC cho Frontend (ReactJS)

Tài liệu này hướng dẫn chi tiết cách tích hợp hệ thống Phân quyền (RBAC) vào ứng dụng Frontend.

---

## 1. Tổng Quan Hệ Thống

Hệ thống hiện tại sử dụng **RBAC (Role-Based Access Control)** với 4 vai trò:
1.  **SUPER_ADMIN**: Quản trị viên cấp cao (Full quyền).
2.  **ADMIN**: Quản trị viên (Quản lý user, sản phẩm, kho, bán hàng...).
3.  **STAFF**: Nhân viên (Bán hàng, xem kho...).
4.  **USER**: Nông dân/Khách hàng (Chỉ xem thông tin cơ bản).

---

## 2. Luồng Xác Thực (Authentication Flow)

### A. Đăng Nhập & Lưu Trữ State
Khi đăng nhập thành công, API sẽ trả về thông tin user kèm theo **Role** và danh sách **Permissions**.

**API:** `POST /auth/login`
**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUz...",
  "refresh_token": "...",
  "user": {
    "id": 1,
    "account": "admin",
    "nickname": "Administrator",
    "role": {
      "id": 1,
      "code": "SUPER_ADMIN",
      "name": "Super Admin",
      "permissions": [
        { "code": "USER_VIEW" },
        { "code": "USER_CREATE" },
        { "code": "PRODUCT_MANAGE" },
        // ... danh sách các quyền khác
      ]
    }
  }
}
```

👉 **Frontend Action:**
1.  Lưu `access_token` vào LocalStorage/Cookie.
2.  Lưu object `user` (bao gồm role và permissions) vào Global State (Redux/Zustand/Context).
3.  **Quan trọng:** Helper function để check quyền:

```javascript
// utils/permission.js
export const hasPermission = (user, requiredPermission) => {
  if (!user || !user.role || !user.role.permissions) return false;
  
  // Super Admin luôn có quyền (hoặc check permission cụ thể nếu muốn chặt chẽ)
  if (user.role.code === 'SUPER_ADMIN') return true;

  return user.role.permissions.some(p => p.code === requiredPermission);
};

export const hasAnyPermission = (user, permissionsArray) => {
  if (!user || !user.role || !user.role.permissions) return false;
  if (user.role.code === 'SUPER_ADMIN') return true;
  
  return user.role.permissions.some(p => permissionsArray.includes(p.code));
};
```

### B. Xử Lý Đăng Ký (Luồng Mới)
User tự đăng ký sẽ có trạng thái là **PENDING** (Chờ duyệt) và Role là **USER**.

**API:** `POST /auth/register`
**Lưu ý:** Sau khi đăng ký thành công, User **chưa thể đăng nhập ngay**.
👉 **Frontend Action:** Hiển thị thông báo: *"Đăng ký thành công. Vui lòng chờ Quản trị viên duyệt tài khoản của bạn."*

---

## 3. Quản Lý User & Phê Duyệt (Dành cho Admin)

Cần xây dựng trang **Quản Lý Người Dùng** với các tính năng sau:

### A. Tab "Danh Sách Chờ Duyệt" (Pending Users)
*   **API:** `GET /users/admin/pending`
*   **Permission:** `USER_VIEW`
*   **Action:** Hiển thị danh sách user có `status = 'pending'`.
*   **Nút "Duyệt" (Approve):**
    *   Gọi API: `POST /users/admin/approve`
    *   Body: `{ "user_id": 123 }`
    *   Permission: `USER_APPROVE`

### B. Tab "Tạo Nhân Viên" (Create Staff)
Admin có thể tạo trực tiếp tài khoản cho nhân viên (bỏ qua bước duyệt).
*   **API:** `POST /users/admin/create`
*   **Permission:** `USER_CREATE`
*   **Form fields:** Account, Password, Nickname, Role (Dropdown chọn ADMIN/STAFF/USER).

### C. Quản Lý Trạng Thái Tài Khoản

#### Kích Hoạt (Activate)
*   **API:** `POST /users/:id/activate`
*   **Permission:** `USER_UPDATE`
*   **Lưu ý:** ADMIN không thể kích hoạt tài khoản SUPER_ADMIN hoặc ADMIN khác.

#### Vô Hiệu Hóa (Deactivate)
*   **API:** `POST /users/:id/deactivate`
*   **Permission:** `USER_UPDATE`
*   **Lưu ý:** ADMIN không thể vô hiệu hóa tài khoản SUPER_ADMIN hoặc ADMIN khác.

#### Xóa Tài Khoản (Soft Delete)
*   **API:** `DELETE /users/:id`
*   **Permission:** `USER_DELETE`
*   **Lưu ý:** ADMIN không thể xóa tài khoản SUPER_ADMIN hoặc ADMIN khác.

### D. Quy Tắc Phân Quyền Quan Trọng

| Hành Động | SUPER_ADMIN | ADMIN |
|:---|:---|:---|
| Tạo/Sửa/Xóa SUPER_ADMIN | ✅ | ❌ |
| Tạo/Sửa/Xóa ADMIN | ✅ | ❌ |
| Tạo/Sửa/Xóa STAFF | ✅ | ✅ |
| Tạo/Sửa/Xóa USER | ✅ | ✅ |

**Frontend cần xử lý:**
- Ẩn nút "Sửa", "Xóa", "Kích hoạt", "Vô hiệu hóa" nếu:
  - User đang đăng nhập là ADMIN
  - User đang xem là SUPER_ADMIN hoặc ADMIN khác

```javascript
// Example: Ẩn nút xóa nếu không có quyền
const canManageUser = (currentUser, targetUser) => {
  // Super Admin có thể quản lý tất cả
  if (currentUser.role.code === 'SUPER_ADMIN') return true;
  
  // Admin không thể quản lý Super Admin hoặc Admin khác
  if (currentUser.role.code === 'ADMIN') {
    return !['SUPER_ADMIN', 'ADMIN'].includes(targetUser.role.code);
  }
  
  return false;
};

// Trong component
{canManageUser(currentUser, record) && (
  <>
    <Button onClick={() => handleActivate(record)}>Kích hoạt</Button>
    <Button onClick={() => handleDeactivate(record)}>Vô hiệu hóa</Button>
    <Button onClick={() => handleDelete(record)}>Xóa</Button>
  </>
)}
```

---

## 4. Bảo Vệ Route & UI (Authorization)

### A. Protected Routes
Sử dụng Wrapper Component để bảo vệ các trang.

```javascript
// components/ProtectedRoute.jsx
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { user } = useAuth(); // Lấy user từ state

  if (!user) return <Navigate to="/login" />;

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    return <ForbiddenPage />; // Trang báo lỗi 403
  }

  return children;
};

// App.js usage
<Route path="/products/create" element={
  <ProtectedRoute requiredPermission="PRODUCT_MANAGE">
    <CreateProductPage />
  </ProtectedRoute>
} />
```

### B. Ẩn/Hiện Nút Bấm (Conditional Rendering)
Ẩn các nút "Thêm", "Sửa", "Xóa" nếu user không có quyền.

```javascript
// ProductList.jsx
{hasPermission(currentUser, 'PRODUCT_MANAGE') && (
  <Button onClick={handleCreateProduct}>Thêm Sản Phẩm Mới</Button>
)}

// Table Row
{hasPermission(currentUser, 'PRODUCT_MANAGE') && (
  <>
    <Button onClick={() => handleEdit(record)}>Sửa</Button>
    <Button onClick={() => handleDelete(record)}>Xóa</Button>
  </>
)}
```

---

## 5. Danh Sách API & Permissions

Dưới đây là bảng tra cứu nhanh để Frontend gắn quyền cho đúng trang/nút:

| Module | Chức Năng | API Endpoint | Method | Permission Cần Thiết |
|:---|:---|:---|:---|:---|
| **User** | Xem danh sách | `/users` | GET | `USER_VIEW` |
| | Tạo user (Admin) | `/users/admin/create` | POST | `USER_CREATE` |
| | Duyệt user | `/users/admin/approve` | POST | `USER_APPROVE` |
| | Kích hoạt user | `/users/:id/activate` | POST | `USER_UPDATE` |
| | Vô hiệu hóa user | `/users/:id/deactivate` | POST | `USER_UPDATE` |
| | Xóa user | `/users/:id` | DELETE | `USER_DELETE` |
| **Sản Phẩm** | Xem danh sách | `/products` | GET | `PRODUCT_VIEW` |
| | Thêm/Sửa/Xóa | `/products/*` | POST/PUT/DEL | `PRODUCT_MANAGE` |
| **Bán Hàng** | Xem hóa đơn | `/sales/invoices` | GET | `SALES_VIEW` |
| | Tạo hóa đơn | `/sales/invoice` | POST | `SALES_CREATE` |
| | Sửa/Xóa/Duyệt | `/sales/invoice/*` | PATCH/DEL | `SALES_MANAGE` |
| **Kho** | Xem tồn kho | `/inventory/batches` | GET | `INVENTORY_VIEW` |
| | Nhập kho/Tạo phiếu | `/inventory/*` | POST | `INVENTORY_MANAGE` |
| **Khách Hàng** | Xem danh sách | `/customers` | GET | `SALES_VIEW` |
| | Thêm/Sửa/Xóa | `/customers` | POST/PATCH | `SALES_MANAGE` |
| **Nhà Cung Cấp**| Xem danh sách | `/suppliers` | GET | `INVENTORY_VIEW` |
| | Thêm/Sửa/Xóa | `/suppliers` | POST/PATCH | `INVENTORY_MANAGE` |
| **Đạo Ôn (AI)** | Xem cảnh báo | `/api/warning` | GET | `RICE_BLAST_VIEW` |
| | Chạy phân tích | `/api/run-now` | POST | `RICE_BLAST_MANAGE` |

---

## 6. Xử Lý Lỗi (Error Handling)

Khi gọi API, nếu Server trả về lỗi, Frontend cần xử lý như sau:

*   **401 Unauthorized**: Token hết hạn hoặc không hợp lệ.
    *   👉 **Action:** Gọi API Refresh Token hoặc Logout user và chuyển về trang Login.
*   **403 Forbidden**: User đã đăng nhập nhưng không có quyền thực hiện hành động này.
    *   👉 **Action:** Hiển thị thông báo (Toast/Notification): *"Bạn không có quyền thực hiện thao tác này."*

---

## 7. Tài Khoản Test (Mặc Định)

Sử dụng tài khoản này để test full quyền (Super Admin):
*   **Account:** `admin`
*   **Password:** `sanhtps`

---
**Lưu ý:** Hãy đảm bảo cập nhật file `src/entities/base-status.enum.ts` hoặc constants ở Frontend để map đúng với trạng thái `PENDING`, `ACTIVE`, `INACTIVE`.
