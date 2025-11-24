# 🌾 Module Mùa Vụ (Season)

**Trạng thái**: ✅ SẴN SÀNG CHO FRONTEND

---

## 🔗 Mối Quan Hệ
- **Sales**: Hóa đơn thuộc về mùa vụ nào.
- **DebtNote**: Công nợ thuộc về mùa vụ nào.

---

## 📝 Data Structures (DTO)

### 1. Season Detail (Response)
```typescript
interface Season {
  id: number;
  name: string;       // VD: "Đông Xuân 2024"
  code: string;       // VD: "DX2024"
  year: number;
  start_date: string;
  end_date: string;
  is_active: boolean; // Mùa vụ hiện tại?
}
```

---

## 🚀 API Endpoints & Examples

### 1. Lấy Mùa Vụ Đang Hoạt Động (Active)
**GET** `/seasons/active`

Dùng để **tự động chọn** (default selected) trong dropdown khi tạo đơn hàng mới.

**Response**:
```json
{
  "id": 2,
  "name": "Hè Thu 2024",
  "code": "HT2024",
  "is_active": true
}
```

### 2. Lấy Tất Cả Mùa Vụ (Dropdown List)
**GET** `/seasons`

Dùng cho filter báo cáo hoặc xem lịch sử.

---

## 💡 Workflow Frontend
1. **Khi vào trang Tạo Đơn Hàng**:
   - Gọi API `/seasons/active`.
   - Set giá trị `season_id` mặc định là ID trả về.
2. **Khi xem Báo Cáo Công Nợ**:
   - Gọi API `/seasons` để lấy list.
   - Cho user chọn mùa vụ muốn xem.
