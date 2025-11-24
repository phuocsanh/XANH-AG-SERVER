# 📜 Module Công Nợ (Debt Note)

**Trạng thái**: ✅ SẴN SÀNG CHO FRONTEND

---

## 🔗 Mối Quan Hệ
- **Customer**: Người nợ.
- **Season**: Nợ thuộc mùa vụ nào (để dễ đòi).
- **SalesInvoice**: Nguồn gốc của nợ (từ hóa đơn nào).

---

## 📝 Data Structures (DTO)

### 1. Debt Note Detail (Response)
```typescript
interface DebtNote {
  id: number;
  code: string;           // VD: "DN-2024-001"
  customer_name: string;
  season_name: string;
  amount: number;         // Số tiền nợ gốc
  paid_amount: number;    // Đã trả được bao nhiêu
  remaining_amount: number; // Còn phải trả
  status: 'active' | 'paid' | 'overdue';
  due_date: string;
  source_invoices: number[]; // List ID hóa đơn gốc
  created_at: string;
}
```

### 2. Pay Debt (Request)
```typescript
interface PayDebtDto {
  amount: number;             // Số tiền trả
  payment_method: 'cash' | 'transfer';
  notes?: string;
}
```

---

## 🚀 API Endpoints & Examples

### 1. Xem Danh Sách Nợ (Theo Khách/Mùa)
**GET** `/debt-notes`

**Query Params**:
- `customer_id`: number
- `season_id`: number
- `status`: 'active' | 'overdue'

### 2. Trả Nợ (Cho 1 Phiếu Cụ Thể)
**POST** `/debt-notes/:id/pay`

**Scenario**: Khách trả 1tr cho phiếu nợ DN-001.

**Body**:
```json
{
  "amount": 1000000,
  "payment_method": "cash",
  "notes": "Trả bớt nợ cũ"
}
```

**Response**:
```json
{
  "debt_note": {
    "id": 1,
    "remaining_amount": 2000000, // Còn nợ 2tr (nếu gốc là 3tr)
    "status": "active"
  },
  "payment": {
    "id": 502,
    "code": "PT-502"
  }
}
```

---

## 💡 Workflow Frontend
1. **Màn hình "Sổ Nợ"**:
   - List danh sách DebtNote.
   - Filter theo Mùa vụ (để xem nợ cũ/mới).
   - Hiển thị màu sắc trạng thái: Đỏ (Overdue), Xanh (Paid), Vàng (Active).
2. **Action "Trả Nợ"**:
   - Click vào 1 DebtNote -> Popup "Trả Nợ".
   - Nhập số tiền -> Gọi API `/pay`.
