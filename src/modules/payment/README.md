# 💰 Module Thanh Toán (Payment)

**Trạng thái**: ✅ SẴN SÀNG CHO FRONTEND

---

## 🔗 Mối Quan Hệ
- **Customer**: Người trả tiền.
- **SalesInvoice**: Hóa đơn được thanh toán.
- **DebtNote**: Phiếu nợ được thanh toán.
- **PaymentAllocation**: Chi tiết phân bổ tiền.

---

## 📝 Data Structures (DTO)

### 1. Create Payment (Request - Simple)
Dùng khi khách trả tiền chung chung, hệ thống tự trừ vào các khoản nợ cũ nhất.
```typescript
interface CreatePaymentDto {
  customer_id: number;
  amount: number;
  payment_method: 'cash' | 'transfer';
  payment_date?: string; // Default: Now
  notes?: string;
}
```

### 2. Settle Payment (Request - Advanced) ⭐
Dùng khi chốt sổ cuối mùa hoặc thanh toán một cục.
```typescript
interface SettlePaymentDto {
  customer_id: number;
  amount: number;             // Số tiền khách đưa
  payment_method: 'cash' | 'transfer';
  
  // Chỉ định rõ trả cho những hóa đơn nào (Optional)
  invoice_ids?: number[];     
  
  // Nếu trả không đủ, có tạo phiếu nợ mới không?
  create_debt_note?: boolean; 
  
  // Cấu hình phiếu nợ mới (nếu create_debt_note = true)
  debt_note_config?: {
    season_id: number;        // Ghi nợ vào mùa nào
    due_date?: string;        // Hạn trả
    notes?: string;
  };
}
```

---

## 🚀 API Endpoints & Examples

### 1. Thanh Toán & Chốt Công Nợ (Quan Trọng)
**POST** `/payments/settle-with-debt-note`

**Scenario**: Khách nợ 3 hóa đơn tổng 10tr. Khách trả 8tr. Còn 2tr muốn ghi thành "Nợ Mùa Đông Xuân".

**Body**:
```json
{
  "customer_id": 1,
  "amount": 8000000,
  "invoice_ids": [101, 102, 103], // IDs của 3 hóa đơn nợ
  "create_debt_note": true,
  "debt_note_config": {
    "season_id": 2, // Đông Xuân
    "notes": "Còn thiếu 2tr, hẹn cuối vụ trả"
  }
}
```

**Response**:
```json
{
  "payment": { "id": 501, "amount": 8000000 },
  "debt_note_created": {
    "id": 20,
    "code": "DN-020",
    "amount": 2000000, // Số tiền còn thiếu
    "season_name": "Đông Xuân 2024"
  },
  "invoices_settled": [
    { "id": 101, "status": "PAID" },
    { "id": 102, "status": "PAID" },
    { "id": 103, "status": "PAID" } 
    // Hóa đơn được đánh dấu PAID vì phần thiếu đã chuyển sang DebtNote
  ]
}
```

---

## 💡 Workflow Frontend
1. **Màn hình "Thu Tiền Khách Hàng"**:
   - Chọn Khách Hàng.
   - Hiển thị danh sách các Hóa đơn chưa thanh toán & Phiếu nợ cũ.
   - Nhập số tiền khách trả (`amount`).
   - Chọn các khoản muốn gạch nợ (`invoice_ids`).
   - Nếu `amount < tổng nợ đã chọn`: Hiển thị popup "Số tiền còn thiếu sẽ được ghi nợ mới?".
   - Nếu User đồng ý -> Gọi API `settle-with-debt-note`.
