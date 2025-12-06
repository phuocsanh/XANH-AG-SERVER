# Hướng Dẫn Frontend: Tích Hợp API Quản Lý Công Nợ

## API Endpoints

### 1. Lấy Danh Sách Khách Hàng Đang Nợ
```typescript
GET /customers/debtors?page=1&limit=20&search=

Response:
{
  "data": [
    {
      "id": 1,
      "code": "KH001",
      "name": "Nguyễn Văn A",
      "phone": "0987654321",
      "total_debt": 10000000,    // Tổng nợ
      "debt_count": 2            // Số phiếu nợ
    }
  ],
  "total": 1
}
```

---

### 2. Lấy Danh Sách Phiếu Công Nợ
```typescript
GET /debt-notes?customer_id=1&season_id=2&status=active

Response:
{
  "data": [
    {
      "id": 10,
      "code": "DN20251206220000456",
      "customer_id": 1,
      "season_id": 2,
      "amount": 10000000,
      "paid_amount": 0,
      "remaining_amount": 10000000,
      "status": "active",
      "source_invoices": [1, 2, 3, 4, 5],
      "rolled_over_from_id": null,
      "rolled_over_to_id": null,
      "created_at": "2025-12-06T22:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 3. Chốt Sổ Công Nợ ⭐
```typescript
POST /payments/settle-debt

Request:
{
  "customer_id": 1,
  "season_id": 2,              // Mùa vụ cần chốt
  "amount": 7000000,           // Số tiền khách trả
  "payment_method": "cash",    // hoặc "transfer"
  "payment_date": "2025-12-06", // Optional
  "notes": "Chốt sổ cuối mùa"  // Optional
}

Response:
{
  "payment": {
    "id": 1,
    "code": "PT20251206223000123",
    "amount": 7000000,
    "payment_method": "cash"
  },
  "settled_invoices": [
    { "id": 1, "remaining_amount": 0, "payment_status": "paid" },
    { "id": 2, "remaining_amount": 0, "payment_status": "paid" }
  ],
  "old_debt_note": {
    "id": 10,
    "status": "settled",        // Đã chốt sổ (còn nợ 3tr)
    "paid_amount": 7000000,
    "remaining_amount": 3000000
  }
}
```

---

## UI Components Cần Implement

### 1. Trang "Quản Lý Công Nợ" ⚠️ QUAN TRỌNG
**Chức năng:**
- ✅ Hiển thị danh sách phiếu công nợ
- ✅ Lọc theo: Khách hàng, Mùa vụ, Trạng thái
- ❌ **KHÔNG có nút "Trả nợ"** - Chỉ xem thông tin
- ❌ **KHÔNG có bất kỳ action thanh toán nào**

> [!IMPORTANT]
> Trang này CHỈ để XEM thông tin công nợ. Mọi thao tác thanh toán đều phải làm ở trang "Thanh Toán".

**Giao diện:**
```
┌─────────────────────────────────────────────────────────┐
│  Quản Lý Công Nợ                                        │
├─────────────────────────────────────────────────────────┤
│  Lọc: [Khách hàng ▼] [Mùa vụ ▼] [Trạng thái ▼]        │
├──────┬──────────┬────────┬─────────┬──────────┬────────┤
│ Mã   │ Khách    │ Mùa vụ │ Tổng nợ │ Đã trả   │ Còn nợ │
├──────┼──────────┼────────┼─────────┼──────────┼────────┤
│ DN01 │ Nguyễn A │ ĐX2024 │ 10tr    │ 7tr      │ 3tr 🔴 │
│ DN02 │ Nguyễn A │ HT2025 │ 5tr     │ 0        │ 5tr 🔴 │
└──────┴──────────┴────────┴─────────┴──────────┴────────┘

❌ KHÔNG có nút "Trả nợ" hoặc bất kỳ action nào
✅ Chỉ hiển thị thông tin để theo dõi
```

---

### 2. Trang "Thanh Toán" - Modal "Chốt Sổ Công Nợ"
**Trigger:** Nút "Chốt sổ công nợ" ở trang Thanh Toán

> [!NOTE]
> Đây là NƠI DUY NHẤT để thực hiện thanh toán công nợ.

**Giao diện Modal:**
```
┌─────────────────────────────────────────────────────┐
│  Chốt Sổ Công Nợ                            [X]     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  * Khách hàng: [Chọn khách hàng ▼]                  │
│    → Nguyễn Văn A                                    │
│                                                      │
│  * Mùa vụ cần chốt: [Chọn mùa vụ ▼]                 │
│    → Đông Xuân 2024                                  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ Tổng nợ mùa Đông Xuân 2024: 10,000,000 đ     │  │
│  │ Gồm 5 hóa đơn chưa thanh toán đủ              │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  * Số tiền khách trả: [7,000,000] đ                 │
│                                                      │
│  * Phương thức: [Tiền mặt ▼]                        │
│                                                      │
│  ⚠️ Còn thiếu: 3,000,000 đ                          │
│                                                      │
│  ☑ Chuyển nợ còn lại sang mùa vụ mới                │
│    → Chọn mùa vụ: [Hè Thu 2025 ▼]                   │
│                                                      │
│  Ghi chú: [Khách hẹn trả cuối vụ sau]               │
│                                                      │
│         [Hủy]              [Xác nhận chốt sổ]       │
└─────────────────────────────────────────────────────┘
```

---

## React Query Hooks

### 1. useDebtors (Danh sách khách nợ)
```typescript
import { useQuery } from '@tanstack/react-query';

export const useDebtors = (params: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return useQuery({
    queryKey: ['debtors', params],
    queryFn: () => api.get('/customers/debtors', { params }),
  });
};
```

---

### 2. useDebtNotes (Danh sách phiếu nợ)
```typescript
export const useDebtNotes = (filters: {
  customer_id?: number;
  season_id?: number;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['debt-notes', filters],
    queryFn: () => api.get('/debt-notes', { params: filters }),
  });
};
```

---

### 3. useSettleDebt (Chốt sổ công nợ)
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useSettleDebt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: SettleDebtDto) => 
      api.post('/payments/settle-debt', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-notes'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
};
```

---

## Example Component

```typescript
import { useState } from 'react';
import { useSettleDebt } from '@/hooks/usePayments';
import { useSeasons } from '@/hooks/useSeasons';

export const SettleDebtModal = ({ 
  customerId, 
  seasonId, 
  totalDebt 
}: Props) => {
  const [amount, setAmount] = useState(0);
  const [rolloverSeasonId, setRolloverSeasonId] = useState<number>();
  const [notes, setNotes] = useState('');
  
  const { data: seasons } = useSeasons();
  const settleMutation = useSettleDebt();
  
  const remainingDebt = totalDebt - amount;
  
  const handleSubmit = async () => {
    await settleMutation.mutateAsync({
      customer_id: customerId,
      season_id: seasonId,
      amount,
      payment_method: 'cash',
      rollover_to_season_id: remainingDebt > 0 ? rolloverSeasonId : undefined,
      notes,
    });
    
    // Show success message
    toast.success('Chốt sổ công nợ thành công!');
  };
  
  return (
    <Modal>
      <h2>Chốt Sổ Công Nợ</h2>
      
      <div>
        <label>Số tiền khách trả</label>
        <input 
          type="number" 
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>
      
      {remainingDebt > 0 && (
        <>
          <Alert type="warning">
            Còn thiếu: {remainingDebt.toLocaleString()} đ
          </Alert>
          
          <div>
            <label>
              <input type="checkbox" />
              Chuyển nợ còn lại sang mùa vụ mới
            </label>
            
            <select onChange={(e) => setRolloverSeasonId(Number(e.target.value))}>
              <option>Chọn mùa vụ</option>
              {seasons?.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </>
      )}
      
      <button onClick={handleSubmit}>
        Xác nhận chốt sổ
      </button>
    </Modal>
  );
};
```

---

## Lưu Ý Quan Trọng

> [!CAUTION]
> **KHÔNG BAO GIỜ có nút "Trả nợ" ở trang "Quản Lý Công Nợ"!**

### Phân công rõ ràng:

#### ✅ Trang "Quản Lý Công Nợ"
- **Mục đích:** XEM thông tin công nợ
- **Chức năng:** Lọc, tìm kiếm, xem chi tiết
- **KHÔNG có:** Nút trả nợ, nút thanh toán, bất kỳ action nào

#### ✅ Trang "Thanh Toán"
- **Mục đích:** Thực hiện thanh toán
- **Chức năng:** Thu tiền, Chốt sổ công nợ
- **Có:** Nút "Chốt sổ công nợ", Form thanh toán

#### ✅ Trang "Hóa Đơn Bán Hàng"
- **Mục đích:** Quản lý hóa đơn
- **Chức năng:** Tạo đơn, Xem đơn, Trả nợ cho 1 đơn cụ thể
- **Có:** Nút "Trả nợ" (cho từng hóa đơn riêng lẻ)

---

### Validation Rules:
1. **Số tiền trả phải > 0** và **<= tổng nợ**
2. **Cần quyền `SALES_MANAGE`** để chốt sổ
3. **Không thể chốt sổ** nếu không có hóa đơn nợ
4. **Mỗi mùa vụ** chỉ có **1 phiếu công nợ** cho 1 khách hàng
