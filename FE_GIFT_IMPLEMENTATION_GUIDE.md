# 📘 Hướng dẫn Frontend - Tính năng Quà tặng

## 📋 Tổng quan

Hệ thống quà tặng có **2 loại**:

### 1. **Quà tặng khi bán hàng** 
- Nhập vào form tạo/sửa hóa đơn
- Trường: `sales_invoices.gift_description` và `gift_value`

### 2. **Quà tặng khi quyết toán nợ** ⭐ **MỚI**
- Nhập vào form quyết toán nợ (Settle Debt)
- Trường: `debt_notes.gift_description` và `gift_value`

---

## 🎯 Phần 1: Form Hóa đơn (Sales Invoice)

### **Thêm 2 trường vào form:**

```tsx
import { useForm } from 'react-hook-form';

interface SalesInvoiceForm {
  // ... existing fields
  gift_description?: string;
  gift_value?: number;
}

// Trong component
<form>
  {/* ... existing fields ... */}
  
  {/* Mô tả quà tặng */}
  <FormField
    control={form.control}
    name="gift_description"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Mô tả quà tặng</FormLabel>
        <FormControl>
          <Input 
            type="text" 
            placeholder="VD: 1 thùng nước ngọt Coca" 
            {...field}
          />
        </FormControl>
        <FormDescription>
          Mô tả quà tặng cho khách hàng (tùy chọn)
        </FormDescription>
      </FormItem>
    )}
  />

  {/* Giá trị quà tặng */}
  <FormField
    control={form.control}
    name="gift_value"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Giá trị quà tặng</FormLabel>
        <FormControl>
          <Input 
            type="number" 
            placeholder="0" 
            {...field}
            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
          />
        </FormControl>
        <FormDescription>
          Giá trị quà tặng quy đổi ra tiền (VD: 200,000 đ)
        </FormDescription>
      </FormItem>
    )}
  />
</form>
```

### **Hiển thị trong báo cáo đơn hàng:**

```tsx
// API: GET /store-profit-report/invoice/:id
const { data } = useQuery(['invoice-profit', invoiceId], () => 
  api.getInvoiceProfit(invoiceId)
);

// Hiển thị
<div className="profit-summary">
  <div className="row">
    <span>Lợi nhuận gộp:</span>
    <span>{formatCurrency(data.gross_profit)}</span>
  </div>
  
  {data.gift_description && (
    <div className="row gift-row">
      <span>Quà tặng:</span>
      <span>
        {formatCurrency(data.gift_value)}
        <small className="text-muted"> ({data.gift_description})</small>
      </span>
    </div>
  )}
  
  <div className="row total">
    <span>Lợi nhuận ròng:</span>
    <span className="font-bold">{formatCurrency(data.net_profit)}</span>
  </div>
</div>
```

---

## 🎯 Phần 2: Form Quyết toán nợ (Settle Debt) ⭐ **QUAN TRỌNG**

### **API Endpoint:**
```
POST /payment/settle-debt
```

### **Request Body:**

```typescript
interface SettleDebtRequest {
  customer_id: number;
  season_id: number;
  amount: number;              // Số tiền khách trả
  payment_method: string;      // 'cash', 'transfer', etc.
  payment_date?: string;       // ISO date string
  notes?: string;
  
  // ⭐ MỚI: Quà tặng khi quyết toán
  gift_description?: string;   // "1 bao phân DAP 50kg"
  gift_value?: number;         // 500000
}
```

### **Response:**

```typescript
interface SettleDebtResponse {
  payment: Payment;
  settled_invoices: SalesInvoice[];
  total_debt: number;
  remaining_debt: number;
  
  // ⭐ MỚI: Chi tiết theo vụ lúa
  breakdown_by_rice_crop: Array<{
    rice_crop_id: number | null;
    field_name: string;
    invoice_count: number;
    total_debt: number;
    invoices: Array<{
      id: number;
      code: string;
      amount: number;
      remaining_amount: number;
    }>;
  }>;
  
  // ⭐ MỚI: Thông tin quà tặng
  gift_description?: string;
  gift_value: number;
}
```

### **Form Component:**

```tsx
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';

interface SettleDebtFormData {
  customer_id: number;
  season_id: number;
  amount: number;
  payment_method: string;
  payment_date?: string;
  notes?: string;
  gift_description?: string;
  gift_value?: number;
}

export function SettleDebtForm({ customerId, seasonId }: Props) {
  const form = useForm<SettleDebtFormData>({
    defaultValues: {
      customer_id: customerId,
      season_id: seasonId,
      amount: 0,
      payment_method: 'cash',
      gift_value: 0,
    }
  });

  const settleDebtMutation = useMutation({
    mutationFn: (data: SettleDebtFormData) => 
      api.post('/payment/settle-debt', data),
    onSuccess: (response) => {
      console.log('Quyết toán thành công:', response);
      // Show success message
      // Redirect or refresh
    }
  });

  const onSubmit = (data: SettleDebtFormData) => {
    settleDebtMutation.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Số tiền thanh toán */}
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Số tiền thanh toán *</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                placeholder="0" 
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Phương thức thanh toán */}
      <FormField
        control={form.control}
        name="payment_method"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phương thức thanh toán *</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phương thức" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="cash">Tiền mặt</SelectItem>
                <SelectItem value="transfer">Chuyển khoản</SelectItem>
                <SelectItem value="check">Séc</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      {/* Ngày thanh toán */}
      <FormField
        control={form.control}
        name="payment_date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ngày thanh toán</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      {/* ⭐ MỚI: Mô tả quà tặng */}
      <FormField
        control={form.control}
        name="gift_description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mô tả quà tặng cuối vụ</FormLabel>
            <FormControl>
              <Input 
                type="text" 
                placeholder="VD: 1 bao phân DAP 50kg" 
                {...field}
              />
            </FormControl>
            <FormDescription>
              Mô tả quà tặng khi quyết toán nợ (tùy chọn)
            </FormDescription>
          </FormItem>
        )}
      />

      {/* ⭐ MỚI: Giá trị quà tặng */}
      <FormField
        control={form.control}
        name="gift_value"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Giá trị quà tặng</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                placeholder="0" 
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              />
            </FormControl>
            <FormDescription>
              Giá trị quà tặng quy đổi ra tiền (VD: 500,000 đ)
            </FormDescription>
          </FormItem>
        )}
      />

      {/* Ghi chú */}
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ghi chú</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
          </FormItem>
        )}
      />

      <Button type="submit" disabled={settleDebtMutation.isLoading}>
        {settleDebtMutation.isLoading ? 'Đang xử lý...' : 'Quyết toán nợ'}
      </Button>
    </form>
  );
}
```

---

## 🎯 Phần 3: Hiển thị kết quả quyết toán

### **Component hiển thị breakdown theo vụ lúa:**

```tsx
interface SettleDebtResultProps {
  result: SettleDebtResponse;
}

export function SettleDebtResult({ result }: SettleDebtResultProps) {
  return (
    <div className="settle-debt-result">
      {/* Tổng quan */}
      <div className="summary-card">
        <h3>Tổng quan thanh toán</h3>
        <div className="summary-row">
          <span>Tổng nợ:</span>
          <span>{formatCurrency(result.total_debt)}</span>
        </div>
        <div className="summary-row">
          <span>Đã thanh toán:</span>
          <span className="text-green-600">
            {formatCurrency(result.payment.amount)}
          </span>
        </div>
        <div className="summary-row">
          <span>Còn nợ:</span>
          <span className={result.remaining_debt > 0 ? 'text-red-600' : 'text-green-600'}>
            {formatCurrency(result.remaining_debt)}
          </span>
        </div>
        
        {/* ⭐ Hiển thị quà tặng */}
        {result.gift_description && (
          <div className="summary-row gift-row">
            <span>Quà tặng:</span>
            <span>
              {formatCurrency(result.gift_value)}
              <small className="text-muted"> ({result.gift_description})</small>
            </span>
          </div>
        )}
      </div>

      {/* ⭐ Breakdown theo vụ lúa */}
      <div className="breakdown-section">
        <h3>Chi tiết theo vụ lúa</h3>
        {result.breakdown_by_rice_crop.map((crop) => (
          <div key={crop.rice_crop_id} className="crop-card">
            <div className="crop-header">
              <h4>{crop.field_name}</h4>
              <span className="badge">{crop.invoice_count} đơn hàng</span>
            </div>
            
            <div className="crop-summary">
              <span>Tổng nợ:</span>
              <span className="font-bold">{formatCurrency(crop.total_debt)}</span>
            </div>

            {/* Danh sách hóa đơn */}
            <div className="invoice-list">
              <h5>Danh sách hóa đơn:</h5>
              <ul>
                {crop.invoices.map((invoice) => (
                  <li key={invoice.id} className="invoice-item">
                    <span>{invoice.code}</span>
                    <span>{formatCurrency(invoice.remaining_amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Danh sách hóa đơn đã thanh toán */}
      <div className="settled-invoices">
        <h3>Hóa đơn đã thanh toán ({result.settled_invoices.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Mã hóa đơn</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {result.settled_invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.code}</td>
                <td>{formatCurrency(invoice.final_amount)}</td>
                <td>
                  <span className={`badge ${invoice.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                    {invoice.payment_status === 'paid' ? 'Đã thanh toán' : 'Thanh toán một phần'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 🎨 CSS Mẫu

```css
/* Settle Debt Result Styles */
.settle-debt-result {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.summary-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.summary-row:last-child {
  border-bottom: none;
  font-weight: bold;
  font-size: 1.1rem;
}

.gift-row {
  background: #fff3cd;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.breakdown-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.crop-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid #10b981;
}

.crop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.invoice-list {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
}

.invoice-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}
```

---

## 📝 TypeScript Interfaces đầy đủ

```typescript
// ============================================
// 1. Sales Invoice Gift
// ============================================
interface InvoiceProfitDto {
  invoice_id: number;
  invoice_code: string;
  customer_name: string;
  created_at: Date;
  total_amount: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  gross_margin: number;
  gift_description?: string;    // ⭐ Mô tả quà tặng
  gift_value: number;           // ⭐ Giá trị quà tặng
  net_profit: number;           // ⭐ Lợi nhuận ròng
  item_details: InvoiceItemProfitDto[];
}

// ============================================
// 2. Settle Debt Gift
// ============================================
interface SettleDebtRequest {
  customer_id: number;
  season_id: number;
  amount: number;
  payment_method: string;
  payment_date?: string;
  notes?: string;
  gift_description?: string;    // ⭐ Mô tả quà tặng cuối vụ
  gift_value?: number;          // ⭐ Giá trị quà tặng cuối vụ
}

interface SettleDebtResponse {
  payment: Payment;
  settled_invoices: SalesInvoice[];
  total_debt: number;
  remaining_debt: number;
  breakdown_by_rice_crop: RiceCropBreakdown[];
  gift_description?: string;
  gift_value: number;
}

interface RiceCropBreakdown {
  rice_crop_id: number | null;
  field_name: string;
  invoice_count: number;
  total_debt: number;
  invoices: InvoiceInBreakdown[];
}

interface InvoiceInBreakdown {
  id: number;
  code: string;
  amount: number;
  remaining_amount: number;
}
```

---

## ✅ Checklist triển khai

### Form Hóa đơn (Sales Invoice)
- [ ] Thêm field `gift_description` (text, optional)
- [ ] Thêm field `gift_value` (number, optional)
- [ ] Hiển thị gift trong báo cáo lợi nhuận đơn hàng
- [ ] Validation: `gift_value >= 0`

### Form Quyết toán nợ (Settle Debt)
- [ ] Thêm field `gift_description` (text, optional)
- [ ] Thêm field `gift_value` (number, optional)
- [ ] Hiển thị breakdown theo vụ lúa
- [ ] Hiển thị thông tin quà tặng trong kết quả
- [ ] Validation: `gift_value >= 0`

### Testing
- [ ] Test tạo hóa đơn có quà tặng
- [ ] Test quyết toán nợ có quà tặng
- [ ] Test hiển thị breakdown theo vụ lúa
- [ ] Test với nhiều vụ lúa khác nhau
- [ ] Test với hóa đơn không thuộc vụ lúa nào

---

## 🎯 Ví dụ thực tế

### Tình huống: Quyết toán nợ cho Nông dân A

**Input:**
```json
{
  "customer_id": 1,
  "season_id": 1,
  "amount": 15000000,
  "payment_method": "cash",
  "gift_description": "1 bao phân DAP 50kg",
  "gift_value": 500000
}
```

**Output:**
```json
{
  "total_debt": 17000000,
  "remaining_debt": 2000000,
  "breakdown_by_rice_crop": [
    {
      "rice_crop_id": 1,
      "field_name": "Ruộng sau nhà",
      "invoice_count": 2,
      "total_debt": 8000000,
      "invoices": [...]
    },
    {
      "rice_crop_id": 2,
      "field_name": "Ruộng trước nhà",
      "invoice_count": 1,
      "total_debt": 7000000,
      "invoices": [...]
    }
  ],
  "gift_description": "1 bao phân DAP 50kg",
  "gift_value": 500000
}
```

**Hiển thị cho user:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUYẾT TOÁN NỢ THÀNH CÔNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tổng nợ:          17,000,000 đ
Đã thanh toán:    15,000,000 đ
Còn nợ:            2,000,000 đ

Quà tặng:            500,000 đ
(1 bao phân DAP 50kg)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHI TIẾT THEO VỤ LÚA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Ruộng sau nhà (2 đơn hàng)
   Tổng nợ: 8,000,000 đ
   - INV-001: 5,000,000 đ
   - INV-002: 3,000,000 đ

📍 Ruộng trước nhà (1 đơn hàng)
   Tổng nợ: 7,000,000 đ
   - INV-003: 7,000,000 đ
```

---

## 📞 Hỗ trợ

Nếu có thắc mắc, tham khảo:
- `SETTLE_DEBT_GIFT_GUIDE.md` - Chi tiết kỹ thuật
- `GIFT_VALUE_GUIDE.md` - Hướng dẫn quà tặng đơn hàng
