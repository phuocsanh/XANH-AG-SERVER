# � Module Bán Hàng (Sales)

**Trạng thái**: ✅ SẴN SÀNG CHO FRONTEND

---

## 🔗 Mối Quan Hệ
- **Customer**: Đơn hàng thuộc về khách hàng (hoặc khách vãng lai).
- **Season**: Đơn hàng thuộc về mùa vụ nào (để tính công nợ/doanh thu theo mùa).
- **Inventory**: Tạo đơn hàng -> Trừ tồn kho.
- **Payment**: Tạo đơn hàng -> Có thể thanh toán ngay hoặc nợ.

---

## � Data Structures (DTO)

### 1. Create Invoice (Request)
```typescript
interface CreateSalesInvoiceDto {
  // Thông tin khách hàng
  customer_id?: number;       // Nếu là khách quen (Optional)
  customer_name: string;      // Required (Nếu customer_id có, FE tự điền tên vào đây hoặc BE tự lấy)
  customer_phone: string;     // Required
  customer_address?: string;
  
  // Thông tin đơn hàng
  season_id?: number;         // Mùa vụ (Optional nhưng Recommended)
  invoice_code?: string;      // Optional (BE tự sinh nếu không gửi)
  notes?: string;             // Ghi chú thường
  warning?: string;           // Lưu ý quan trọng (hiển thị đỏ)
  
  // Thông tin thanh toán
  payment_method: 'cash' | 'transfer' | 'debt';
  total_amount: number;       // Tổng tiền hàng
  discount_amount: number;    // Giảm giá tổng đơn
  final_amount: number;       // Khách cần trả (total - discount)
  partial_payment_amount?: number; // Số tiền khách trả trước (cho phép bán thiếu)
  
  // Danh sách sản phẩm
  items: SalesItemDto[];
}

interface SalesItemDto {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount_amount?: number;   // Giảm giá trên từng SP
  notes?: string;
}
```

---

## 🚀 API Endpoints & Examples

### 1. Tạo Đơn Hàng (Full Option)
**POST** `/sales/invoice`

**Scenario**: Khách quen mua hàng, trả trước 1 phần, ghi nợ phần còn lại vào mùa vụ hiện tại.

**Body**:
```json
{
  "customer_id": 10,
  "customer_name": "Nguyễn Văn A",
  "customer_phone": "0909123456",
  "season_id": 2,             // Mùa Đông Xuân 2024
  "payment_method": "cash",
  
  "total_amount": 5000000,
  "discount_amount": 0,
  "final_amount": 5000000,
  
  "partial_payment_amount": 2000000, // Khách đưa trước 2tr
  // => Hệ thống tự hiểu còn nợ 3tr
  
  "warning": "Giao hàng trước 9h sáng",
  
  "items": [
    {
      "product_id": 5,
      "quantity": 10,
      "unit_price": 500000
    }
  ]
}
```

### 2. Thanh Toán Thêm (Trả Nợ Dần)
**PATCH** `/sales/invoice/:id/add-payment`

**Scenario**: Khách quay lại trả thêm 1 triệu cho đơn hàng cũ.

**Body**:
```json
{
  "amount": 1000000
}
```
**Logic**:
- `remaining_amount` giảm đi 1tr.
- Nếu trả hết, trạng thái đơn hàng chuyển thành `PAID`.

---

## 💡 Workflow Frontend
1. **Bước 1**: Chọn Khách Hàng (Search Customer API).
   - Nếu có: Điền ID, Name, Phone.
   - Nếu không: Để trống ID, tự nhập Name, Phone.
2. **Bước 2**: Chọn Mùa Vụ (Get Active Season API).
   - Mặc định chọn mùa vụ đang `is_active = true`.
3. **Bước 3**: Chọn Sản Phẩm (Search Product API).
   - Hiển thị giá bán và tồn kho hiện tại.
   - Validate số lượng nhập không quá tồn kho.
4. **Bước 4**: Nhập Thanh Toán.
   - Nhập `partial_payment_amount`.
   - Hiển thị `remaining_amount` (Nợ lại) cho user thấy.
5. **Bước 5**: Submit.
