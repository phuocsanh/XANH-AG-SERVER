# 📚 API Flow Documentation - Hướng dẫn tích hợp Frontend

## 🎯 Tổng quan hệ thống

Hệ thống quản lý bán hàng nông nghiệp với các module chính:
- **Season**: Quản lý mùa vụ
- **Customer**: Quản lý khách hàng
- **Sales Invoice**: Quản lý hóa đơn bán hàng (hỗ trợ bán nợ/bán thiếu)
- **Payment**: Quản lý phiếu thu tiền
- **Payment Allocation**: Phân bổ thanh toán vào hóa đơn/công nợ
- **Debt Note**: Quản lý công nợ
- **Sales Return**: Quản lý trả hàng (tự động cập nhật kho & trừ nợ)

---

## 1️⃣ SEASON MODULE (Quản lý Mùa vụ)

### 📍 Base URL: `/season`

### 🔄 Luồng hoạt động cơ bản

```mermaid
graph LR
    A[Tạo mùa vụ] --> B[Danh sách mùa vụ]
    B --> C[Chọn mùa vụ active]
    C --> D[Tạo hóa đơn theo mùa]
```

### 📝 API Endpoints

#### 1. Tạo mùa vụ mới
```http
POST /season
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Hè Thu 2024",
  "code": "HT2024",
  "year": 2024,
  "start_date": "2024-06-01",
  "end_date": "2024-11-30",
  "description": "Mùa vụ Hè Thu năm 2024",
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Hè Thu 2024",
    "code": "HT2024",
    "year": 2024,
    "is_active": true,
    "created_at": "2024-11-24T10:00:00Z"
  }
}
```

#### 2. Lấy danh sách mùa vụ
```http
GET /season
Authorization: Bearer {token}
```

#### 3. Lấy mùa vụ đang active
```http
GET /season/active
Authorization: Bearer {token}
```

**Use case Frontend:**
- Hiển thị dropdown chọn mùa vụ khi tạo hóa đơn
- Mặc định chọn mùa vụ đang active
- Báo cáo theo mùa vụ

---

## 2️⃣ CUSTOMER MODULE (Quản lý Khách hàng)

### 📍 Base URL: `/customers`

### 🔄 Luồng hoạt động

```mermaid
graph TD
    A[Tạo khách hàng] --> B[Lưu thông tin]
    B --> C[Tạo hóa đơn cho khách]
    C --> D[Theo dõi công nợ]
```

### 📝 API Endpoints

#### 1. Tạo khách hàng
```http
POST /customers
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "KH001",
  "name": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "nguyenvana@example.com",
  "address": "123 Đường ABC, TP.HCM",
  "type": "individual"
}
```

#### 2. Tìm kiếm khách hàng
```http
GET /customers?search=Nguyễn&page=1&limit=20
Authorization: Bearer {token}
```

#### 3. Lấy chi tiết khách hàng
```http
GET /customers/{id}
Authorization: Bearer {token}
```

**Use case Frontend:**
- Autocomplete tìm khách hàng khi tạo hóa đơn
- Hiển thị lịch sử mua hàng của khách
- Theo dõi công nợ tổng của khách

---

## 3️⃣ SALES INVOICE MODULE (Quản lý Hóa đơn)

### 📍 Base URL: `/sales/invoice`

### 🔄 Luồng hoạt động chi tiết

```mermaid
graph TD
    A[Tạo hóa đơn DRAFT] --> B{Khách trả tiền?}
    B -->|Trả đủ| C[Đánh dấu PAID]
    B -->|Trả một phần| D[Partial Payment]
    B -->|Chưa trả| E[Ghi nợ]
    D --> F[Thanh toán thêm]
    F --> G{Đủ tiền?}
    G -->|Đủ| C
    G -->|Chưa| D
    E --> H[Tạo Debt Note]
    C --> I[Hoàn tất]
```

### 📝 API Endpoints

#### 1. Tạo hóa đơn (Bán nợ)
```http
POST /sales/invoice
Authorization: Bearer {token}
Content-Type: application/json

{
  "invoice_code": "HD001",
  "customer_name": "Nguyễn Văn A",
  "customer_phone": "0912345678",
  "season_id": 1,
  "customer_id": 1,
  "total_amount": 5000000,
  "discount_amount": 0,
  "final_amount": 5000000,
  "payment_method": "debt",
  "notes": "Bán nợ, hạn thanh toán 30 ngày",
  "items": []
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "HD001",
    "final_amount": 5000000,
    "partial_payment_amount": "0.00",
    "remaining_amount": "5000000.00",
    "status": "draft",
    "payment_status": "pending"
  }
}
```

#### 2. Tạo hóa đơn (Bán thiếu - Partial Payment)
```http
POST /sales/invoice
Content-Type: application/json

{
  "invoice_code": "HD002",
  "customer_name": "Trần Thị B",
  "total_amount": 10000000,
  "final_amount": 10000000,
  "payment_method": "cash",
  "partial_payment_amount": 3000000,
  "notes": "Khách trả trước 3 triệu",
  "items": []
}
```

**Response:**
```json
{
  "data": {
    "id": 2,
    "partial_payment_amount": "3000000.00",
    "remaining_amount": "7000000.00",
    "payment_status": "partial"
  }
}
```

#### 3. Thanh toán thêm (Add Partial Payment)
```http
PATCH /sales/invoice/{id}/add-payment
Content-Type: application/json

{
  "amount": 2000000
}
```

**Response:**
```json
{
  "data": {
    "id": 2,
    "partial_payment_amount": "5000000.00",
    "remaining_amount": "5000000.00",
    "payment_status": "partial"
  }
}
```

#### 4. Xác nhận hóa đơn
```http
PATCH /sales/invoice/{id}/confirm
```

#### 5. Đánh dấu đã thanh toán
```http
PATCH /sales/invoice/{id}/paid
```

#### 6. Tìm kiếm hóa đơn
```http
POST /sales/invoices/search
Content-Type: application/json

{
  "page": 1,
  "limit": 20,
  "filters": [
    {
      "field": "status",
      "operator": "eq",
      "value": "paid"
    },
    {
      "field": "payment_status",
      "operator": "eq",
      "value": "partial"
    }
  ]
}
```

### 💡 Use case Frontend

**Kịch bản 1: Bán nợ hoàn toàn**
1. Tạo hóa đơn với `payment_method: "debt"`
2. `remaining_amount` = `final_amount`
3. Hiển thị badge "Chưa thanh toán"
4. Sau này khách trả tiền → Dùng Payment Allocation

**Kịch bản 2: Bán thiếu (Partial Payment)**
1. Tạo hóa đơn với `partial_payment_amount: 3000000`
2. Hệ thống tự tính `remaining_amount`
3. Hiển thị progress bar: "Đã trả 3M/10M"
4. Khách trả thêm → `PATCH /add-payment`

**Kịch bản 3: Thanh toán đủ**
1. Khi `remaining_amount = 0`
2. `payment_status` tự động chuyển sang `"paid"`
3. Hiển thị badge "Đã thanh toán"

---

## 4️⃣ PAYMENT MODULE (Quản lý Phiếu thu)

### 📍 Base URL: `/payments`

### 🔄 Luồng hoạt động

```mermaid
graph LR
    A[Khách trả tiền] --> B[Tạo Phiếu thu]
    B --> C[Phân bổ vào hóa đơn/nợ]
    C --> D[Cập nhật công nợ]
```

### 📝 API Endpoints

#### 1. Tạo phiếu thu
```http
POST /payments
Content-Type: application/json

{
  "code": "PT001",
  "customer_id": 1,
  "amount": 5000000,
  "payment_date": "2024-11-24",
  "payment_method": "cash",
  "notes": "Thu tiền mặt"
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "code": "PT001",
    "amount": 5000000,
    "allocated_amount": "0.00",
    "created_at": "2024-11-24T10:00:00Z"
  }
}
```

#### 2. Danh sách phiếu thu
```http
GET /payments
```

### 💡 Use case Frontend
- Tạo phiếu thu khi khách đến trả tiền
- Hiển thị số tiền chưa phân bổ: `amount - allocated_amount`
- Link đến màn hình phân bổ thanh toán

---

## 5️⃣ PAYMENT ALLOCATION MODULE (Phân bổ Thanh toán)

### 📍 Base URL: `/payment-allocations`

### 🔄 Luồng hoạt động

```mermaid
graph TD
    A[Có Phiếu thu] --> B{Phân bổ vào đâu?}
    B -->|Hóa đơn| C[Trừ nợ hóa đơn]
    B -->|Công nợ| D[Trừ công nợ]
    C --> E[Cập nhật remaining_amount]
    D --> F[Cập nhật debt note]
```

### 📝 API Endpoints

#### 1. Phân bổ vào hóa đơn
```http
POST /payment-allocations
Content-Type: application/json

{
  "payment_id": 1,
  "allocation_type": "invoice",
  "invoice_id": 2,
  "amount": 2000000
}
```

**Kết quả tự động:**
- Payment: `allocated_amount` tăng 2M
- Invoice #2: `remaining_amount` giảm 2M
- Nếu invoice trả đủ → `payment_status = "paid"`

#### 2. Phân bổ vào công nợ
```http
POST /payment-allocations
Content-Type: application/json

{
  "payment_id": 1,
  "allocation_type": "debt_note",
  "debt_note_id": 1,
  "amount": 1000000
}
```

### 💡 Use case Frontend

**Màn hình phân bổ thanh toán:**
1. Chọn phiếu thu (hiển thị số tiền available)
2. Chọn loại phân bổ: Hóa đơn hoặc Công nợ
3. Chọn hóa đơn/công nợ cần trả
4. Nhập số tiền phân bổ
5. Validate: `amount <= payment.available_amount`
6. Submit → Hệ thống tự động cập nhật

**Hiển thị:**
```
Phiếu thu PT001: 5,000,000 VND
Đã phân bổ: 3,000,000 VND
Còn lại: 2,000,000 VND

Lịch sử phân bổ:
- HD002: 2,000,000 VND
- CN001: 1,000,000 VND
```

---

## 6️⃣ DEBT NOTE MODULE (Quản lý Công nợ)

### 📍 Base URL: `/debt-notes`

### 🔄 Luồng hoạt động

```mermaid
graph LR
    A[Tạo Công nợ] --> B[Khách trả tiền]
    B --> C[Payment Allocation]
    C --> D[Trừ nợ]
    D --> E{Hết nợ?}
    E -->|Yes| F[Status: PAID]
    E -->|No| G[Status: ACTIVE]
```

### 📝 API Endpoints

#### 1. Tạo công nợ
```http
POST /debt-notes
Content-Type: application/json

{
  "code": "CN001",
  "customer_id": 1,
  "season_id": 1,
  "amount": 5000000,
  "due_date": "2024-12-31",
  "notes": "Nợ cũ cần thu hồi",
  "source_invoices": [1, 2, 3]
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "code": "CN001",
    "amount": "5000000.00",
    "paid_amount": "0.00",
    "remaining_amount": "5000000.00",
    "status": "active"
  }
}
```

#### 2. Tìm kiếm công nợ
```http
POST /debt-notes/search
Content-Type: application/json

{
  "filters": [
    {
      "field": "status",
      "operator": "eq",
      "value": "active"
    }
  ]
}
```

### 💡 Use case Frontend

**Dashboard công nợ:**
```
Tổng công nợ: 50,000,000 VND
Đã thu: 20,000,000 VND
Còn lại: 30,000,000 VND

Danh sách:
- CN001: Nguyễn Văn A - 5M (Quá hạn)
- CN002: Trần Thị B - 3M (Còn 10 ngày)
```

---

## 7️⃣ SALES RETURN MODULE (Quản lý Trả hàng)

### 📍 Base URL: `/sales-returns`

### 🔄 Luồng hoạt động

```mermaid
graph TD
    A[Khách trả hàng] --> B[Tạo Sales Return]
    B --> C[Tính tiền hoàn lại]
    C --> D{Khách còn nợ?}
    D -->|Có| E[Trừ nợ]
    D -->|Không| F[Cần hoàn tiền]
    E --> G[Cập nhật Invoice]
    F --> H[Log refund amount]
    G --> I[Cập nhật Inventory]
    H --> I
    I --> J[Hoàn tất]
```

### 📝 API Endpoints

#### 1. Tạo phiếu trả hàng
```http
POST /sales-returns
Content-Type: application/json

{
  "code": "TH001",
  "invoice_id": 1,
  "reason": "Hàng lỗi, khách trả lại",
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "unit_price": 500000
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "code": "TH001",
    "total_refund_amount": 1000000,
    "status": "completed"
  }
}
```

**Tự động xử lý:**
1. ✅ Tính `total_refund_amount = Σ(quantity × unit_price)`
2. ✅ Trừ nợ invoice: `remaining_amount -= refund_amount`
3. ✅ Cập nhật kho: `inventory.remaining_quantity += quantity`
4. ✅ Nếu cần hoàn tiền: Log ra console

#### 2. Danh sách trả hàng
```http
GET /sales-returns
```

### 💡 Use case Frontend

**Kịch bản 1: Khách còn nợ**
```
Invoice HD001:
- Tổng tiền: 5,000,000
- Còn nợ: 5,000,000

Trả hàng: 1,000,000
→ Còn nợ: 4,000,000 ✅
```

**Kịch bản 2: Khách đã trả đủ**
```
Invoice HD002:
- Tổng tiền: 5,000,000
- Còn nợ: 0 (đã trả đủ)

Trả hàng: 1,000,000
→ Còn nợ: 0
→ Cần hoàn lại: 1,000,000 ⚠️
→ Hiển thị thông báo: "Cần hoàn tiền cho khách"
```

**UI gợi ý:**
```
[Tạo phiếu trả hàng]

Hóa đơn: HD001 - Nguyễn Văn A
Còn nợ: 5,000,000 VND

Sản phẩm trả lại:
- Phân bón NPK x2 = 1,000,000 VND

Tổng tiền trả: 1,000,000 VND
Nợ sau khi trả: 4,000,000 VND

[Xác nhận trả hàng]
```

---

## 🔐 Authentication

Tất cả API đều yêu cầu Bearer token:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Lấy token:
```http
POST /auth/login
Content-Type: application/json

{
  "userAccount": "testuser123",
  "password": "123456"
}
```

---

## 📊 Response Format

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-11-24T10:00:00Z",
    "path": "/sales/invoice",
    "method": "POST"
  }
}
```

### Error Response:
```json
{
  "type": "https://example.com/probs/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Dữ liệu đầu vào không hợp lệ",
  "details": [
    {
      "field": "amount",
      "message": "amount must be a positive number"
    }
  ]
}
```

---

## 🎨 Frontend Implementation Tips

### 1. State Management
```typescript
// Invoice State
interface InvoiceState {
  id: number;
  code: string;
  final_amount: number;
  partial_payment_amount: number;
  remaining_amount: number;
  payment_status: 'pending' | 'partial' | 'paid';
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
}
```

### 2. Progress Bar cho Partial Payment
```tsx
<ProgressBar 
  value={invoice.partial_payment_amount} 
  max={invoice.final_amount}
  label={`Đã trả ${formatMoney(invoice.partial_payment_amount)} / ${formatMoney(invoice.final_amount)}`}
/>
```

### 3. Badge hiển thị trạng thái
```tsx
{invoice.payment_status === 'paid' && <Badge color="green">Đã thanh toán</Badge>}
{invoice.payment_status === 'partial' && <Badge color="yellow">Trả một phần</Badge>}
{invoice.payment_status === 'pending' && <Badge color="red">Chưa thanh toán</Badge>}
```

---

## 📞 Support

Nếu có thắc mắc về API, vui lòng liên hệ team Backend.

**API Documentation:** http://localhost:3003/api
