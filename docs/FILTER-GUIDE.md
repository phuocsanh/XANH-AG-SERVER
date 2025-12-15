# 🔧 Hướng dẫn Filter Sales Invoices API

## ✅ CÁCH TỐI ƯU (Khuyến nghị)

### **Filter nhiều status - Cách đơn giản:**

```json
{
  "page": 1,
  "limit": 20,
  "status": ["confirmed", "paid"]
}
```

✅ **Ưu điểm:**
- Trực quan, dễ hiểu
- Ngắn gọn
- Không cần nhớ operator

---

### **Filter single status:**

```json
{
  "page": 1,
  "limit": 20,
  "status": "confirmed"
}
```

---

## 📊 CÁC CÁCH FILTER KHÁC

### **1. Filter theo customer_id:**

```json
{
  "page": 1,
  "limit": 20,
  "customer_id": 123
}
```

---

### **2. Filter theo payment_status:**

```json
{
  "page": 1,
  "limit": 20,
  "payment_status": ["paid", "partial"]
}
```

Hoặc single value:
```json
{
  "payment_status": "unpaid"
}
```

---

### **3. Filter theo season_id:**

```json
{
  "page": 1,
  "limit": 20,
  "season_id": 5
}
```

---

### **4. Filter theo rice_crop_id:**

```json
{
  "page": 1,
  "limit": 20,
  "rice_crop_id": 10
}
```

---

### **5. Filter theo khoảng giá (final_amount):**

Sử dụng `filters` với operator:

```json
{
  "page": 1,
  "limit": 20,
  "filters": [
    {
      "field": "final_amount",
      "operator": "gte",
      "value": 1000000
    },
    {
      "field": "final_amount",
      "operator": "lte",
      "value": 5000000
    }
  ]
}
```

---

### **6. Filter hóa đơn còn nợ:**

```json
{
  "page": 1,
  "limit": 20,
  "filters": [
    {
      "field": "remaining_amount",
      "operator": "gt",
      "value": 0
    }
  ]
}
```

---

### **7. Kết hợp nhiều điều kiện:**

```json
{
  "page": 1,
  "limit": 20,
  "status": ["confirmed", "paid"],
  "season_id": 5,
  "customer_id": 123
}
```

**Logic:** Lấy hóa đơn có status là `confirmed` HOẶC `paid`, VÀ thuộc season 5, VÀ của khách hàng 123.

---

## 🔍 GLOBAL SEARCH (Keyword)

Tìm kiếm toàn văn trong các field: `code`, `customer.name`, `customer.phone`, `notes`

```json
{
  "page": 1,
  "limit": 20,
  "keyword": "HD001"
}
```

Kết hợp với filter:
```json
{
  "page": 1,
  "limit": 20,
  "keyword": "nguyen",
  "status": ["confirmed", "paid"]
}
```

---

## 📊 SORTING (Sắp xếp)

### **Cách 1: Dùng sort_by và sort_order**

```json
{
  "page": 1,
  "limit": 20,
  "sort_by": "created_at",
  "sort_order": "DESC"
}
```

**Các field có thể sort:**
- `created_at` - Ngày tạo
- `final_amount` - Tổng tiền
- `remaining_amount` - Còn nợ
- `code` - Mã hóa đơn
- `customer.name` - Tên khách hàng (dùng relation)

---

### **Cách 2: Dùng sort (legacy)**

```json
{
  "page": 1,
  "limit": 20,
  "sort": "final_amount:DESC"
}
```

---

## 🎯 CÁC VÍ DỤ THỰC TẾ

### **1. Lấy hóa đơn đã xác nhận và đã thanh toán:**

```json
{
  "page": 1,
  "limit": 20,
  "status": ["confirmed", "paid"]
}
```

---

### **2. Lấy hóa đơn còn nợ của khách hàng:**

```json
{
  "page": 1,
  "limit": 20,
  "customer_id": 123,
  "filters": [
    {
      "field": "remaining_amount",
      "operator": "gt",
      "value": 0
    }
  ]
}
```

---

### **3. Lấy hóa đơn trong khoảng thời gian:**

```json
{
  "page": 1,
  "limit": 20,
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}
```

---

### **4. Tìm hóa đơn theo tên khách hàng:**

```json
{
  "page": 1,
  "limit": 20,
  "keyword": "nguyen van a"
}
```

---

### **5. Lấy hóa đơn của mùa vụ, sắp xếp theo tổng tiền:**

```json
{
  "page": 1,
  "limit": 20,
  "season_id": 5,
  "sort_by": "final_amount",
  "sort_order": "DESC"
}
```

---

### **6. Lấy hóa đơn chưa thanh toán hoặc thanh toán một phần:**

```json
{
  "page": 1,
  "limit": 20,
  "payment_status": ["unpaid", "partial"]
}
```

---

## 🔧 FILTER NÂNG CAO (Dùng filters)

Khi cần filter phức tạp hơn, sử dụng `filters` với các operator:

### **Các operator hỗ trợ:**

| Operator | Mô tả | Ví dụ |
|----------|-------|-------|
| `eq` | Bằng | `{ "field": "status", "operator": "eq", "value": "confirmed" }` |
| `ne` | Không bằng | `{ "field": "status", "operator": "ne", "value": "cancelled" }` |
| `in` | Trong danh sách | `{ "field": "status", "operator": "in", "value": ["confirmed", "paid"] }` |
| `notin` | Không trong danh sách | `{ "field": "status", "operator": "notin", "value": ["cancelled"] }` |
| `gt` | Lớn hơn | `{ "field": "final_amount", "operator": "gt", "value": 1000000 }` |
| `gte` | Lớn hơn hoặc bằng | `{ "field": "final_amount", "operator": "gte", "value": 1000000 }` |
| `lt` | Nhỏ hơn | `{ "field": "remaining_amount", "operator": "lt", "value": 500000 }` |
| `lte` | Nhỏ hơn hoặc bằng | `{ "field": "remaining_amount", "operator": "lte", "value": 500000 }` |
| `like` | Chứa (case-sensitive) | `{ "field": "notes", "operator": "like", "value": "giao hàng" }` |
| `ilike` | Chứa (case-insensitive) | `{ "field": "customer_name", "operator": "ilike", "value": "nguyen" }` |
| `isnull` | Là NULL | `{ "field": "notes", "operator": "isnull", "value": true }` |
| `isnotnull` | Không NULL | `{ "field": "customer_id", "operator": "isnotnull", "value": true }` |

---

### **Ví dụ filter nâng cao:**

```json
{
  "page": 1,
  "limit": 20,
  "filters": [
    {
      "field": "final_amount",
      "operator": "gte",
      "value": 1000000
    },
    {
      "field": "final_amount",
      "operator": "lte",
      "value": 5000000
    },
    {
      "field": "status",
      "operator": "in",
      "value": ["confirmed", "paid"]
    }
  ]
}
```

**Logic:** Lấy hóa đơn có tổng tiền từ 1.000.000đ đến 5.000.000đ VÀ status là `confirmed` hoặc `paid`.

---

## 💻 CODE FRONTEND MẪU

### **TypeScript Interface:**

```typescript
// types/sales-invoice.ts

export interface SearchSalesInvoiceParams {
  page?: number;
  limit?: number;
  keyword?: string;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
  
  // Simple filters
  status?: string | string[];
  payment_status?: string | string[];
  customer_id?: number;
  season_id?: number;
  rice_crop_id?: number;
  
  // Date range
  start_date?: string;
  end_date?: string;
  
  // Advanced filters
  filters?: FilterCondition[];
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'in' | 'notin' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'isnull' | 'isnotnull';
  value: any;
}
```

---

### **React Hook:**

```typescript
// hooks/useSalesInvoices.ts

import { useQuery } from '@tanstack/react-query';
import { salesService } from '@/services/sales.service';
import { SearchSalesInvoiceParams } from '@/types/sales-invoice';

export const useSalesInvoices = (params: SearchSalesInvoiceParams) => {
  return useQuery({
    queryKey: ['sales-invoices', params],
    queryFn: () => salesService.search(params),
  });
};
```

---

### **Component sử dụng:**

```typescript
// components/SalesInvoiceList.tsx

import React, { useState } from 'react';
import { useSalesInvoices } from '@/hooks/useSalesInvoices';

export const SalesInvoiceList: React.FC = () => {
  const [params, setParams] = useState({
    page: 1,
    limit: 20,
    status: ['confirmed', 'paid'], // ✅ Đơn giản!
  });

  const { data, isLoading } = useSalesInvoices(params);

  const handleStatusChange = (statuses: string[]) => {
    setParams(prev => ({
      ...prev,
      status: statuses,
      page: 1 // Reset về trang 1
    }));
  };

  // ... render UI
};
```

---

## 📋 SO SÁNH 2 CÁCH

### **Cách 1: Simple (Khuyến nghị) ⭐**

```json
{
  "status": ["confirmed", "paid"]
}
```

✅ Ngắn gọn, trực quan  
✅ Dễ viết, dễ đọc  
✅ Phù hợp 90% trường hợp  

---

### **Cách 2: Advanced (Khi cần)**

```json
{
  "filters": [
    {
      "field": "status",
      "operator": "in",
      "value": ["confirmed", "paid"]
    }
  ]
}
```

✅ Linh hoạt hơn  
✅ Hỗ trợ nhiều operator  
⚠️ Dài dòng hơn  

---

## 🎯 KẾT LUẬN

**Sử dụng cách nào?**

1. **Cách 1 (Simple)** - Dùng cho hầu hết trường hợp:
   - Filter theo status
   - Filter theo payment_status
   - Filter theo customer_id, season_id, rice_crop_id
   - Keyword search
   - Sorting

2. **Cách 2 (Advanced)** - Chỉ dùng khi cần:
   - So sánh số (gt, gte, lt, lte)
   - Filter NULL/NOT NULL
   - Logic phức tạp

---

## 📞 Hỗ trợ

Nếu có vấn đề gì, liên hệ team Backend! 🚀
