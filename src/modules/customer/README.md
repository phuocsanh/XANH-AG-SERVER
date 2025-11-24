# 👥 Module Khách Hàng (Customer)

**Trạng thái**: ✅ SẴN SÀNG CHO FRONTEND

---

## 🔗 Mối Quan Hệ
- **Sales**: Khách hàng có nhiều đơn hàng.
- **DebtNote**: Khách hàng có sổ nợ.
- **Payment**: Khách hàng có lịch sử thanh toán.

---

## 📝 Data Structures (DTO)

### 1. Customer Detail (Response)
```typescript
interface Customer {
  id: number;
  code: string;
  name: string;
  phone: string;
  address: string;
  type: 'regular' | 'vip' | 'wholesale';
  total_purchases: number;    // Tổng số đơn hàng
  total_spent: number;        // Tổng tiền đã mua
  current_debt: number;       // Tổng nợ hiện tại (Tính toán từ DebtNotes + Unpaid Invoices)
}
```

---

## 🚀 API Endpoints & Examples

### 1. Tìm Kiếm Khách Hàng (Autocomplete)
**GET** `/customers?search=0909`

Dùng để gợi ý khi tạo đơn hàng. Tìm theo Tên hoặc SĐT.

### 2. Xem Hồ Sơ Khách Hàng (360 độ)
**GET** `/customers/:id`

Trả về thông tin cơ bản + Tổng quan tài chính.

### 3. Xem Lịch Sử Mua Hàng
**GET** `/customers/:id/invoices`

**Response**:
```json
[
  {
    "id": 101,
    "code": "INV-001",
    "date": "2024-11-20",
    "final_amount": 5000000,
    "status": "PAID"
  },
  {
    "id": 105,
    "code": "INV-005",
    "date": "2024-11-24",
    "final_amount": 2000000,
    "status": "PARTIAL",
    "remaining_amount": 1000000 // Còn nợ 1tr
  }
]
```

### 4. Xem Sổ Nợ
**GET** `/customers/:id/debts`

Trả về danh sách các phiếu nợ (`DebtNote`) và hóa đơn chưa thanh toán hết.

---

## 💡 Logic Nghiệp Vụ Frontend
- **Khách Vãng Lai**: Không cần tạo Customer trước. Khi tạo Invoice, chỉ cần gửi `customer_name`.
- **Convert Guest -> Regular**: Nếu khách vãng lai mua nhiều, có thể tạo Customer mới với SĐT đó. Hệ thống (sau này) có thể map lại lịch sử cũ (Feature Future).
