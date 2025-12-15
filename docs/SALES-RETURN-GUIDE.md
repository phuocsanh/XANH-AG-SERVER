# 📚 TÀI LIỆU HƯỚNG DẪN FRONTEND - CHỨC NĂNG TRẢ HÀNG

## 🎯 TỔNG QUAN

Hệ thống trả hàng xử lý **2 trường hợp chính**:
1. **Khách còn nợ** → Trừ vào công nợ
2. **Khách đã trả đủ** → Tạo phiếu hoàn tiền (Payment Record âm)

---

## 📊 LUỒNG NGHIỆP VỤ CHI TIẾT

### **Bước 1: Khách hàng yêu cầu trả hàng**

```
Nhân viên → Chọn hóa đơn cần trả hàng → Tạo phiếu trả hàng
```

### **Bước 2: Hệ thống kiểm tra**

Backend sẽ kiểm tra:
- ✅ Hóa đơn có tồn tại không?
- ✅ Hóa đơn có bị hủy không?
- ✅ Sản phẩm có trong hóa đơn không?
- ✅ Số lượng trả có hợp lệ không? (không vượt quá đã mua - đã trả)

### **Bước 3: Xử lý công nợ**

#### **CASE 1: Khách còn nợ** 💰

```typescript
// Ví dụ: Hóa đơn 1.000.000đ
// Khách trả trước: 300.000đ
// Còn nợ: 700.000đ
// Trả hàng: 200.000đ

Công nợ cũ:  700.000đ
Trả hàng:   -200.000đ
─────────────────────
Công nợ mới: 500.000đ ✅
```

**Kết quả:**
- ✅ Cập nhật `remaining_amount` của hóa đơn
- ✅ Tăng lại tồn kho
- ❌ KHÔNG tạo Payment Record

---

#### **CASE 2: Khách đã trả đủ** 💵

```typescript
// Ví dụ: Hóa đơn 1.000.000đ
// Khách trả tiền mặt: 1.000.000đ
// Còn nợ: 0đ
// Trả hàng: 200.000đ

Công nợ: 0đ (không đổi)
→ TẠO PHIẾU HOÀN TIỀN
```

**Kết quả:**
- ✅ Tạo Payment Record với `amount = -200.000đ`
- ✅ Tăng lại tồn kho
- ✅ Có thể in phiếu hoàn tiền cho khách

---

## 🔌 API ENDPOINT

### **POST /sales-returns**

**Request Body:**
```typescript
{
  "code": "TH001",              // Mã phiếu trả hàng (tự sinh hoặc nhập)
  "invoice_id": 123,            // ID hóa đơn cần trả
  "reason": "Hàng lỗi",         // Lý do trả hàng
  "items": [
    {
      "product_id": 456,        // ID sản phẩm
      "quantity": 2,            // Số lượng trả
      "unit_price": 100000      // Giá đơn vị (lấy từ hóa đơn)
    }
  ]
}
```

**Response Success (200):**
```typescript
{
  "success": true,
  "data": {
    "id": 789,
    "code": "TH001",
    "invoice_id": 123,
    "customer_id": 999,
    "total_refund_amount": 200000,
    "reason": "Hàng lỗi",
    "status": "completed",
    "created_at": "2025-12-15T09:00:00Z",
    "items": [...]
  },
  "meta": {...}
}
```

**Response Error (400):**
```typescript
{
  "success": false,
  "message": "Sản phẩm 'Gạo ST25' chỉ có thể trả tối đa 5 (Đã mua: 10, Đã trả: 5)",
  "error": "Bad Request"
}
```

---

## 🎨 GIAO DIỆN FRONTEND CẦN LÀM

### **1. Màn hình Danh sách Hóa đơn**

```
┌─────────────────────────────────────────────────────────┐
│  Danh sách Hóa đơn                         [+ Tạo mới]  │
├─────────────────────────────────────────────────────────┤
│  Mã HD  │ Khách hàng  │ Tổng tiền │ Còn nợ  │ Hành động │
├─────────────────────────────────────────────────────────┤
│  HD001  │ Nguyễn Văn A│ 1.000.000 │ 700.000 │ [Trả hàng]│
│  HD002  │ Trần Thị B  │   500.000 │       0 │ [Trả hàng]│
└─────────────────────────────────────────────────────────┘
```

**Lưu ý:**
- Nút **[Trả hàng]** luôn hiển thị (cả hóa đơn đã trả đủ)
- Có thể thêm badge hiển thị trạng thái: "Còn nợ" / "Đã trả đủ"

---

### **2. Modal/Form Tạo Phiếu Trả Hàng**

```
┌───────────────────────────────────────────────────────┐
│  Tạo Phiếu Trả Hàng                          [X]      │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Hóa đơn: HD001 - Nguyễn Văn A                       │
│  Ngày mua: 10/12/2025                                 │
│  Tổng tiền: 1.000.000đ                                │
│  Còn nợ: 700.000đ  ⚠️ (Hiển thị nếu > 0)             │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  Sản phẩm trả:                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │ Sản phẩm        │ SL mua │ Đã trả │ Trả thêm │    │
│  ├──────────────────────────────────────────────┤    │
│  │ Gạo ST25        │   10   │   0    │ [  2  ]  │    │
│  │ Gạo Jasmine     │    5   │   2    │ [  1  ]  │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  Lý do trả hàng:                                      │
│  [Hàng lỗi                                      ]     │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  Tổng giá trị trả: 200.000đ                           │
│                                                        │
│  💡 Xử lý:                                            │
│  • Còn nợ 700.000đ → Trừ vào công nợ                 │
│  • Công nợ mới: 500.000đ                              │
│                                                        │
│              [Hủy]        [Xác nhận trả hàng]         │
└───────────────────────────────────────────────────────┘
```

**Logic hiển thị thông báo:**

```typescript
// Tính tổng giá trị trả
const totalRefund = items.reduce((sum, item) => 
  sum + (item.quantity * item.unit_price), 0
);

// Lấy công nợ hiện tại
const remainingAmount = invoice.remaining_amount;

// Hiển thị thông báo xử lý
if (remainingAmount > 0) {
  // CASE 1: Còn nợ
  const newRemaining = Math.max(0, remainingAmount - totalRefund);
  
  message = `
    💡 Xử lý:
    • Còn nợ ${formatMoney(remainingAmount)} → Trừ vào công nợ
    • Công nợ mới: ${formatMoney(newRemaining)}
  `;
} else {
  // CASE 2: Đã trả đủ
  message = `
    💰 Xử lý:
    • Khách đã trả đủ tiền
    • Sẽ tạo phiếu hoàn tiền: ${formatMoney(totalRefund)}
    • Nhân viên cần hoàn tiền mặt cho khách
  `;
}
```

---

### **3. Màn hình Kết quả sau khi trả hàng**

#### **CASE 1: Khách còn nợ**

```
┌───────────────────────────────────────────────────────┐
│  ✅ Trả hàng thành công!                              │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Phiếu trả hàng: TH001                                │
│  Hóa đơn: HD001 - Nguyễn Văn A                       │
│                                                        │
│  Sản phẩm đã trả:                                     │
│  • Gạo ST25: 2 x 100.000đ = 200.000đ                 │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  📊 Cập nhật công nợ:                                 │
│  Công nợ cũ:  700.000đ                                │
│  Trả hàng:   -200.000đ                                │
│  ─────────────────────                                │
│  Công nợ mới: 500.000đ                                │
│                                                        │
│              [In phiếu]        [Đóng]                 │
└───────────────────────────────────────────────────────┘
```

---

#### **CASE 2: Khách đã trả đủ**

```
┌───────────────────────────────────────────────────────┐
│  ✅ Trả hàng thành công!                              │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Phiếu trả hàng: TH001                                │
│  Hóa đơn: HD002 - Trần Thị B                         │
│                                                        │
│  Sản phẩm đã trả:                                     │
│  • Gạo ST25: 2 x 100.000đ = 200.000đ                 │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  💰 PHIẾU HOÀN TIỀN                                   │
│  Mã phiếu: RF20251215093000123                        │
│  Số tiền: 200.000đ                                    │
│                                                        │
│  ⚠️ Vui lòng hoàn tiền mặt cho khách hàng!           │
│                                                        │
│     [In phiếu trả hàng]  [In phiếu hoàn tiền]        │
│                          [Đóng]                       │
└───────────────────────────────────────────────────────┘
```

---

## 💻 CODE FRONTEND MẪU

### **1. Interface TypeScript**

```typescript
// types/sales-return.ts

export interface SalesReturnItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CreateSalesReturnDto {
  code?: string;              // Tự sinh nếu không có
  invoice_id: number;
  reason?: string;
  items: SalesReturnItem[];
}

export interface SalesReturn {
  id: number;
  code: string;
  invoice_id: number;
  customer_id?: number;
  total_refund_amount: number;
  reason?: string;
  status: 'draft' | 'completed' | 'cancelled';
  created_at: string;
  items: SalesReturnItem[];
}

export interface SalesReturnResponse {
  success: true;
  data: SalesReturn;
  meta: {
    timestamp: string;
    path: string;
    method: string;
  };
}
```

---

### **2. API Service**

```typescript
// services/sales-return.service.ts

import axios from 'axios';
import { CreateSalesReturnDto, SalesReturnResponse } from '@/types/sales-return';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const salesReturnService = {
  /**
   * Tạo phiếu trả hàng
   */
  async create(data: CreateSalesReturnDto): Promise<SalesReturnResponse> {
    const response = await axios.post<SalesReturnResponse>(
      `${API_URL}/sales-returns`,
      data
    );
    return response.data;
  },

  /**
   * Lấy danh sách phiếu trả hàng
   */
  async search(params: any) {
    const response = await axios.post(
      `${API_URL}/sales-returns/search`,
      params
    );
    return response.data;
  },

  /**
   * Lấy chi tiết phiếu trả hàng
   */
  async getById(id: number) {
    const response = await axios.get(`${API_URL}/sales-returns/${id}`);
    return response.data;
  }
};
```

---

### **3. React Hook**

```typescript
// hooks/useSalesReturn.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { salesReturnService } from '@/services/sales-return.service';
import { toast } from 'react-toastify';
import { CreateSalesReturnDto } from '@/types/sales-return';

export const useCreateSalesReturn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSalesReturnDto) => 
      salesReturnService.create(data),
    
    onSuccess: (response) => {
      const salesReturn = response.data;
      
      // Invalidate queries
      queryClient.invalidateQueries(['sales-invoices']);
      queryClient.invalidateQueries(['sales-returns']);
      
      // Hiển thị thông báo thành công
      toast.success(
        `✅ Trả hàng thành công! Phiếu ${salesReturn.code}`,
        { autoClose: 3000 }
      );
      
      return salesReturn;
    },
    
    onError: (error: any) => {
      const message = error.response?.data?.message || 
                     'Có lỗi xảy ra khi trả hàng';
      
      toast.error(`❌ ${message}`, { autoClose: 5000 });
    }
  });
};
```

---

### **4. Component Form Trả Hàng**

```typescript
// components/SalesReturnModal.tsx

import React, { useState, useMemo } from 'react';
import { Modal, Button, Form, Input, InputNumber } from 'antd';
import { useCreateSalesReturn } from '@/hooks/useSalesReturn';
import { SalesInvoice } from '@/types/sales-invoice';

interface Props {
  visible: boolean;
  invoice: SalesInvoice;
  onClose: () => void;
}

export const SalesReturnModal: React.FC<Props> = ({ 
  visible, 
  invoice, 
  onClose 
}) => {
  const [form] = Form.useForm();
  const createMutation = useCreateSalesReturn();
  
  // State cho số lượng trả của từng sản phẩm
  const [returnQuantities, setReturnQuantities] = useState<
    Record<number, number>
  >({});

  // Tính tổng giá trị trả
  const totalRefund = useMemo(() => {
    return invoice.items?.reduce((sum, item) => {
      const qty = returnQuantities[item.product_id] || 0;
      return sum + (qty * item.unit_price);
    }, 0) || 0;
  }, [returnQuantities, invoice.items]);

  // Tính công nợ mới
  const newRemaining = useMemo(() => {
    const current = parseFloat(invoice.remaining_amount?.toString() || '0');
    return Math.max(0, current - totalRefund);
  }, [invoice.remaining_amount, totalRefund]);

  // Kiểm tra xem có cần hoàn tiền không
  const needRefund = useMemo(() => {
    const current = parseFloat(invoice.remaining_amount?.toString() || '0');
    return current === 0 && totalRefund > 0;
  }, [invoice.remaining_amount, totalRefund]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // Tạo danh sách items
      const items = invoice.items
        ?.filter(item => returnQuantities[item.product_id] > 0)
        .map(item => ({
          product_id: item.product_id,
          quantity: returnQuantities[item.product_id],
          unit_price: item.unit_price
        })) || [];

      if (items.length === 0) {
        toast.error('Vui lòng chọn ít nhất 1 sản phẩm để trả');
        return;
      }

      // Gọi API
      await createMutation.mutateAsync({
        invoice_id: invoice.id,
        reason: values.reason,
        items
      });

      // Đóng modal
      onClose();
      form.resetFields();
      setReturnQuantities({});
      
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <Modal
      title="Tạo Phiếu Trả Hàng"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={createMutation.isLoading}
          onClick={handleSubmit}
        >
          Xác nhận trả hàng
        </Button>
      ]}
    >
      <Form form={form} layout="vertical">
        {/* Thông tin hóa đơn */}
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <p><strong>Hóa đơn:</strong> {invoice.code}</p>
          <p><strong>Khách hàng:</strong> {invoice.customer?.name}</p>
          <p><strong>Tổng tiền:</strong> {invoice.final_amount?.toLocaleString()}đ</p>
          {parseFloat(invoice.remaining_amount?.toString() || '0') > 0 && (
            <p className="text-orange-600">
              <strong>Còn nợ:</strong> {parseFloat(invoice.remaining_amount?.toString() || '0').toLocaleString()}đ
            </p>
          )}
        </div>

        {/* Danh sách sản phẩm */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Sản phẩm trả:</h4>
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Sản phẩm</th>
                <th className="p-2 border">SL mua</th>
                <th className="p-2 border">Đã trả</th>
                <th className="p-2 border">Trả thêm</th>
                <th className="p-2 border">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map(item => {
                const returnQty = returnQuantities[item.product_id] || 0;
                const maxReturn = item.quantity - (item.returned_quantity || 0);
                
                return (
                  <tr key={item.product_id}>
                    <td className="p-2 border">{item.product?.name}</td>
                    <td className="p-2 border text-center">{item.quantity}</td>
                    <td className="p-2 border text-center">
                      {item.returned_quantity || 0}
                    </td>
                    <td className="p-2 border">
                      <InputNumber
                        min={0}
                        max={maxReturn}
                        value={returnQty}
                        onChange={(val) => 
                          setReturnQuantities(prev => ({
                            ...prev,
                            [item.product_id]: val || 0
                          }))
                        }
                        className="w-full"
                      />
                    </td>
                    <td className="p-2 border text-right">
                      {(returnQty * item.unit_price).toLocaleString()}đ
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Lý do trả hàng */}
        <Form.Item
          name="reason"
          label="Lý do trả hàng"
        >
          <Input.TextArea rows={3} placeholder="Ví dụ: Hàng lỗi, sai quy cách..." />
        </Form.Item>

        {/* Thông tin xử lý */}
        <div className="p-4 bg-blue-50 rounded border border-blue-200">
          <p className="font-semibold mb-2">
            Tổng giá trị trả: {totalRefund.toLocaleString()}đ
          </p>
          
          {totalRefund > 0 && (
            <>
              <p className="text-sm font-semibold mb-1">💡 Xử lý:</p>
              {needRefund ? (
                <div className="text-sm">
                  <p>• Khách đã trả đủ tiền</p>
                  <p className="text-red-600 font-semibold">
                    • Sẽ tạo phiếu hoàn tiền: {totalRefund.toLocaleString()}đ
                  </p>
                  <p className="text-red-600">
                    ⚠️ Nhân viên cần hoàn tiền mặt cho khách!
                  </p>
                </div>
              ) : (
                <div className="text-sm">
                  <p>
                    • Còn nợ {parseFloat(invoice.remaining_amount?.toString() || '0').toLocaleString()}đ 
                    → Trừ vào công nợ
                  </p>
                  <p className="text-green-600 font-semibold">
                    • Công nợ mới: {newRemaining.toLocaleString()}đ
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Form>
    </Modal>
  );
};
```

---

## 📋 CHECKLIST TRIỂN KHAI

### **Backend** ✅
- [x] API POST /sales-returns
- [x] Validation số lượng trả
- [x] Logic trừ công nợ
- [x] Logic tạo Payment âm
- [x] Cập nhật tồn kho
- [x] Transaction đảm bảo tính toàn vẹn

### **Frontend** (Cần làm)
- [ ] Tạo interface TypeScript
- [ ] Tạo API service
- [ ] Tạo React Hook (useSalesReturn)
- [ ] Tạo Modal/Form trả hàng
- [ ] Hiển thị thông báo xử lý (còn nợ vs hoàn tiền)
- [ ] Validation số lượng trả
- [ ] Màn hình kết quả sau trả hàng
- [ ] In phiếu trả hàng
- [ ] In phiếu hoàn tiền (nếu có)
- [ ] Cập nhật danh sách hóa đơn
- [ ] Cập nhật danh sách phiếu trả hàng

---

## 🎯 LƯU Ý QUAN TRỌNG

### **1. Hiển thị cảnh báo hoàn tiền**
```typescript
if (needRefund) {
  // Hiển thị modal cảnh báo rõ ràng
  Modal.warning({
    title: '⚠️ Cần hoàn tiền cho khách',
    content: `
      Khách hàng đã trả đủ tiền.
      Vui lòng hoàn ${totalRefund.toLocaleString()}đ tiền mặt cho khách!
      
      Phiếu hoàn tiền: ${refundCode}
    `,
    okText: 'Đã hiểu'
  });
}
```

### **2. Kiểm tra số lượng trả**
```typescript
// Số lượng tối đa có thể trả
const maxReturn = item.quantity - (item.returned_quantity || 0);

// Validation
if (returnQty > maxReturn) {
  toast.error(
    `Sản phẩm "${item.product.name}" chỉ có thể trả tối đa ${maxReturn}`
  );
  return;
}
```

### **3. Cập nhật UI sau khi trả hàng**
```typescript
// Invalidate các queries liên quan
queryClient.invalidateQueries(['sales-invoices']);
queryClient.invalidateQueries(['sales-returns']);
queryClient.invalidateQueries(['payments']); // Nếu có hoàn tiền
queryClient.invalidateQueries(['inventory']); // Cập nhật tồn kho
```

---

## 📊 BẢNG TỔNG HỢP CÁC TRƯỜNG HỢP

| Tình huống | Công nợ cũ | Trả hàng | Công nợ mới | Payment Record | Hoàn tiền |
|------------|------------|----------|-------------|----------------|-----------|
| **1. Còn nợ nhiều** | 700k | 200k | 500k | ❌ Không | ❌ Không |
| **2. Còn nợ ít** | 100k | 200k | 0 | ❌ Không | ❌ Không |
| **3. Đã trả đủ** | 0 | 200k | 0 | ✅ RF-200k | ✅ 200k |

---

## 🔍 XEM PHIẾU HOÀN TIỀN

Sau khi tạo phiếu trả hàng thành công, nếu có hoàn tiền, có thể xem trong:

**GET /payments/search**

```typescript
{
  "filters": [
    {
      "field": "payment_method",
      "operator": "eq",
      "value": "REFUND"
    },
    {
      "field": "amount",
      "operator": "lt",
      "value": 0
    }
  ]
}
```

Response sẽ trả về các Payment có `amount < 0` (phiếu hoàn tiền).

---

## 📞 HỖ TRỢ

Nếu có vấn đề gì trong quá trình triển khai, hãy liên hệ team Backend để được hỗ trợ! 🚀

---

## 📝 CHANGELOG

### Version 1.0 - 2025-12-15
- ✅ Hoàn thành logic trả hàng với 2 trường hợp
- ✅ Tự động tạo Payment Record âm khi hoàn tiền
- ✅ Validation số lượng trả hàng
- ✅ Cập nhật tồn kho tự động
- ✅ Transaction đảm bảo tính toàn vẹn dữ liệu
