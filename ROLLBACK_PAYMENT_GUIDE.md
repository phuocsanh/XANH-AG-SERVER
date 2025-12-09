# 🔄 Rollback Payment - Hoàn tác thanh toán

## 📋 Tổng quan

Chức năng **Rollback Payment** cho phép hoàn tác thanh toán khi nhập sai số tiền hoặc nhầm lẫn.

### **Use Case:**
- ✅ Nhập nhầm số tiền (VD: 10,000,000 thay vì 1,000,000)
- ✅ Chọn nhầm khách hàng
- ✅ Ấn nhầm "Đã trả hết" nhưng thực tế chưa đủ
- ✅ Cần sửa lại thông tin thanh toán

---

## 🔌 API Endpoint

### **POST /payments/:id/rollback**

**Permission:** `SALES_MANAGE`

**Request:**
```
POST /payments/123/rollback
```

**Response:**
```json
{
  "success": true,
  "message": "Đã rollback payment #PT20251209131500123. Hoàn trả 15,000,000 đ vào công nợ.",
  "payment": {
    "id": 123,
    "code": "PT20251209131500123",
    "amount": 15000000,
    "customer_id": 9,
    ...
  },
  "affected_invoices": 3,
  "affected_debt_note": {
    "id": 5,
    "code": "DN20251209113859981",
    "remaining_amount": 17000000,
    "status": "active",
    ...
  }
}
```

---

## 🔧 Logic hoạt động

### **Khi rollback payment:**

1. ✅ **Lấy thông tin payment** và tất cả allocations
2. ✅ **Hoàn tác từng invoice:**
   - Trừ `partial_payment_amount`
   - Cộng lại `remaining_amount`
   - Cập nhật `payment_status` (paid → partial hoặc unpaid)
3. ✅ **Cập nhật debt_note:**
   - Trừ `paid_amount`
   - Cộng lại `remaining_amount`
   - Đổi `status` về `ACTIVE` nếu còn nợ
4. ✅ **Xóa payment_allocations**
5. ✅ **Xóa payment**

---

## 📊 Ví dụ thực tế

### **Tình huống:**

Nông dân A có tổng nợ **17,000,000 đ** trong mùa Đông Xuân 2024:
- Invoice #1: 5,000,000 đ
- Invoice #2: 3,000,000 đ
- Invoice #3: 7,000,000 đ
- Invoice #4: 2,000,000 đ

**Nhập nhầm:** Ấn "Trả hết" 17,000,000 đ nhưng thực tế khách chỉ trả **15,000,000 đ**

---

### **Trước khi rollback:**

```
DebtNote:
  - paid_amount: 17,000,000 đ
  - remaining_amount: 0 đ
  - status: PAID ❌ (SAI!)

Invoices:
  - Invoice #1: paid ✅
  - Invoice #2: paid ✅
  - Invoice #3: paid ✅
  - Invoice #4: paid ✅
```

---

### **Sau khi rollback:**

```
DebtNote:
  - paid_amount: 0 đ
  - remaining_amount: 17,000,000 đ
  - status: ACTIVE ✅

Invoices:
  - Invoice #1: unpaid ✅
  - Invoice #2: unpaid ✅
  - Invoice #3: unpaid ✅
  - Invoice #4: unpaid ✅
```

---

### **Nhập lại đúng:**

Sau khi rollback, nhập lại số tiền đúng **15,000,000 đ**:

```
DebtNote:
  - paid_amount: 15,000,000 đ
  - remaining_amount: 2,000,000 đ
  - status: ACTIVE ✅

Invoices:
  - Invoice #1: paid ✅
  - Invoice #2: paid ✅
  - Invoice #3: paid ✅
  - Invoice #4: partial (còn nợ 2,000,000 đ) ✅
```

---

## 💻 Frontend Implementation

### **1. Thêm nút Rollback**

```tsx
import { useMutation } from '@tanstack/react-query';

function PaymentDetail({ payment }: Props) {
  const rollbackMutation = useMutation({
    mutationFn: (paymentId: number) => 
      api.post(`/payments/${paymentId}/rollback`),
    onSuccess: (response) => {
      toast.success(response.message);
      // Refresh data
      queryClient.invalidateQueries(['payments']);
      queryClient.invalidateQueries(['debt-notes']);
    }
  });

  const handleRollback = () => {
    if (confirm('Bạn có chắc muốn hoàn tác thanh toán này?')) {
      rollbackMutation.mutate(payment.id);
    }
  };

  return (
    <div className="payment-detail">
      <h3>Payment #{payment.code}</h3>
      <p>Số tiền: {formatCurrency(payment.amount)}</p>
      
      {/* Nút Rollback */}
      <button 
        onClick={handleRollback}
        disabled={rollbackMutation.isLoading}
        className="btn-danger"
      >
        {rollbackMutation.isLoading ? 'Đang xử lý...' : '🔄 Hoàn tác thanh toán'}
      </button>
    </div>
  );
}
```

---

### **2. Hiển thị kết quả rollback**

```tsx
{rollbackMutation.isSuccess && (
  <div className="rollback-result">
    <h4>✅ Hoàn tác thành công!</h4>
    <p>{rollbackMutation.data.message}</p>
    
    <div className="affected-items">
      <p>Số hóa đơn bị ảnh hưởng: {rollbackMutation.data.affected_invoices}</p>
      
      {rollbackMutation.data.affected_debt_note && (
        <div className="debt-note-info">
          <p>Phiếu công nợ: {rollbackMutation.data.affected_debt_note.code}</p>
          <p>Còn nợ: {formatCurrency(rollbackMutation.data.affected_debt_note.remaining_amount)}</p>
        </div>
      )}
    </div>
  </div>
)}
```

---

### **3. Confirm dialog**

```tsx
const confirmRollback = () => {
  return new Promise((resolve) => {
    const confirmed = window.confirm(
      `⚠️ CẢNH BÁO!\n\n` +
      `Bạn sắp hoàn tác thanh toán:\n` +
      `- Mã: ${payment.code}\n` +
      `- Số tiền: ${formatCurrency(payment.amount)}\n\n` +
      `Hành động này sẽ:\n` +
      `✓ Xóa payment và allocations\n` +
      `✓ Hoàn trả tiền vào công nợ\n` +
      `✓ Cập nhật lại trạng thái invoices\n\n` +
      `Bạn có chắc chắn muốn tiếp tục?`
    );
    resolve(confirmed);
  });
};
```

---

## ⚠️ Lưu ý quan trọng

### **Khi nào NÊN dùng rollback:**
- ✅ Nhập sai số tiền
- ✅ Chọn nhầm khách hàng
- ✅ Phát hiện lỗi ngay sau khi nhập
- ✅ Chưa có giao dịch phức tạp khác

### **Khi nào KHÔNG NÊN dùng rollback:**
- ❌ Đã qua nhiều ngày
- ❌ Đã có nhiều giao dịch khác sau đó
- ❌ Đã đối soát sổ sách
- ❌ Đã báo cáo tài chính

### **Best Practices:**
1. ✅ **Confirm kỹ** trước khi rollback
2. ✅ **Ghi log** lý do rollback
3. ✅ **Thông báo** cho khách hàng nếu cần
4. ✅ **Nhập lại** ngay sau khi rollback

---

## 🔍 Kiểm tra sau khi rollback

### **SQL Query để verify:**

```sql
-- Kiểm tra payment đã bị xóa chưa
SELECT * FROM payments WHERE id = 123;
-- Kết quả: 0 rows (đã xóa) ✅

-- Kiểm tra debt_note
SELECT 
  code,
  paid_amount,
  remaining_amount,
  status
FROM debt_notes 
WHERE customer_id = 9 AND season_id = 1;
-- Kết quả: remaining_amount đã tăng lên ✅

-- Kiểm tra invoices
SELECT 
  code,
  partial_payment_amount,
  remaining_amount,
  payment_status
FROM sales_invoices
WHERE customer_id = 9 AND season_id = 1;
-- Kết quả: remaining_amount đã tăng lên ✅
```

---

## 📝 TypeScript Interfaces

```typescript
interface RollbackPaymentResponse {
  success: boolean;
  message: string;
  payment: Payment;
  affected_invoices: number;
  affected_debt_note: DebtNote | null;
}
```

---

## ✅ Checklist

### **Backend:**
- [x] Tạo method `rollbackPayment()` trong service
- [x] Thêm endpoint `POST /payments/:id/rollback`
- [x] Thêm permission `SALES_MANAGE`
- [x] Test build thành công

### **Frontend:**
- [ ] Thêm nút "Hoàn tác" trong payment detail
- [ ] Implement confirm dialog
- [ ] Hiển thị kết quả rollback
- [ ] Update queries sau khi rollback
- [ ] Test UI flow

---

## 🚀 Ready to use!

API đã sẵn sàng. Frontend có thể bắt đầu implement ngay! 😊
