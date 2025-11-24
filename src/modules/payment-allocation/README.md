# 🔗 Module Phân Bổ (Payment Allocation)

**Trạng thái**: ✅ SẴN SÀNG CHO FRONTEND

---

## 🎯 Mục Đích
Module này dùng để **truy vết** dòng tiền. Khi một phiếu thu (`Payment`) được tạo ra, nó có thể trả cho nhiều hóa đơn hoặc phiếu nợ khác nhau. Bảng này lưu chi tiết đó.

---

## 📝 Data Structures (DTO)

### 1. Allocation Detail (Response)
```typescript
interface PaymentAllocation {
  id: number;
  payment_code: string;     // Mã phiếu thu
  amount: number;           // Số tiền phân bổ
  allocation_type: 'invoice' | 'debt_note';
  
  // Target details
  invoice_code?: string;    // Nếu trả cho hóa đơn
  debt_note_code?: string;  // Nếu trả cho phiếu nợ
  
  created_at: string;
}
```

---

## 🚀 API Endpoints & Examples

### 1. Xem Lịch Sử Phân Bổ Của 1 Phiếu Thu
**GET** `/payments/:id/allocations`

Dùng để hiển thị chi tiết trong popup "Chi tiết phiếu thu".

**Response**:
```json
[
  {
    "id": 10,
    "amount": 5000000,
    "allocation_type": "invoice",
    "invoice_code": "INV-101"
  },
  {
    "id": 11,
    "amount": 3000000,
    "allocation_type": "debt_note",
    "debt_note_code": "DN-005"
  }
]
```
// Nghĩa là: Phiếu thu này tổng 8tr, trong đó 5tr trả cho HĐ INV-101 và 3tr trả cho Nợ DN-005.
