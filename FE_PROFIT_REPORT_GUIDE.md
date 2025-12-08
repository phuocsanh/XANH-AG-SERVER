# Hướng dẫn triển khai Frontend - Trang Báo cáo Lợi nhuận

Tài liệu này hướng dẫn đội ngũ Frontend tạo trang báo cáo lợi nhuận cho cửa hàng với 3 loại báo cáo chính.

## 1. Tổng quan

Backend đã cung cấp đầy đủ API để xem báo cáo lợi nhuận theo 3 cấp độ:
1. **Lợi nhuận theo Hóa đơn** - Chi tiết từng đơn hàng
2. **Lợi nhuận theo Vụ lúa (Rice Crop)** - Tổng hợp các đơn hàng của một vụ lúa
3. **Lợi nhuận theo Mùa vụ (Season)** - Tổng hợp toàn bộ mùa vụ

## 2. API Endpoints

### 2.1. Lợi nhuận theo Hóa đơn

**Endpoint:**
```
GET /store-profit-report/invoice/:id
```

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "invoice_id": 123,
  "invoice_code": "INV-2024-123",
  "customer_name": "Nguyễn Văn A",
  "created_at": "2024-12-08T...",
  "total_amount": 10000000,
  "cost_of_goods_sold": 7000000,
  "gross_profit": 3000000,
  "gross_margin": 30.00,
  "item_details": [
    {
      "product_name": "Phân NPK",
      "quantity": 10,
      "unit_price": 500000,
      "avg_cost": 350000,
      "cogs": 3500000,
      "profit": 1500000,
      "margin": 30.00
    }
  ]
}
```

**Giải thích các trường:**
- `total_amount`: Tổng doanh thu (sau giảm giá)
- `cost_of_goods_sold`: Tổng giá vốn hàng bán
- `gross_profit`: Lợi nhuận gộp = Doanh thu - Giá vốn
- `gross_margin`: Tỷ suất lợi nhuận (%)
- `item_details`: Chi tiết từng sản phẩm trong đơn

### 2.2. Lợi nhuận theo Vụ lúa (Rice Crop)

**Endpoint:**
```
GET /store-profit-report/rice-crop/:riceCropId
```

**Response:**
```json
{
  "rice_crop_id": 1,
  "field_name": "Ruộng sau nhà",
  "customer_name": "Nguyễn Văn A",
  "season_name": "Đông Xuân 2024-2025",
  "summary": {
    "total_invoices": 5,
    "total_revenue": 50000000,
    "total_cost": 35000000,
    "total_profit": 15000000,
    "avg_margin": 30.00
  },
  "invoices": [
    {
      "invoice_id": 123,
      "invoice_code": "INV-2024-123",
      "date": "2024-12-01T...",
      "revenue": 10000000,
      "cost": 7000000,
      "profit": 3000000,
      "margin": 30.00,
      "customer_name": "Nguyễn Văn A"
    }
  ]
}
```

**Use case:**
- Xem tổng lợi nhuận từ việc bán hàng cho một vụ lúa cụ thể
- Theo dõi danh sách các đơn hàng liên quan đến vụ lúa đó

### 2.3. Lợi nhuận theo Mùa vụ (Season)

**Endpoint:**
```
GET /store-profit-report/season/:seasonId
```

**Response:**
```json
{
  "season_id": 1,
  "season_name": "Đông Xuân 2024-2025",
  "period": {
    "start_date": "2024-11-01",
    "end_date": "2025-02-28"
  },
  "summary": {
    "total_invoices": 50,
    "total_customers": 20,
    "total_revenue": 500000000,
    "cost_of_goods_sold": 350000000,
    "gross_profit": 150000000,
    "gross_margin": 30.00,
    "operating_costs": 20000000,
    "net_profit": 130000000,
    "net_margin": 26.00
  },
  "operating_costs_breakdown": [
    {
      "type": "SALARY",
      "name": "Lương nhân viên",
      "amount": 10000000
    }
  ],
  "delivery_stats": {
    "total_deliveries": 50,
    "total_delivery_cost": 5000000,
    "avg_cost_per_delivery": 100000,
    "total_distance": 500,
    "cost_per_km": 10000
  },
  "top_customers": [
    {
      "customer_id": 1,
      "customer_name": "Nguyễn Văn A",
      "total_invoices": 10,
      "total_revenue": 100000000,
      "total_profit": 30000000,
      "avg_margin": 30.00
    }
  ],
  "top_products": [
    {
      "product_id": 1,
      "product_name": "Phân NPK",
      "quantity_sold": 100,
      "total_revenue": 50000000,
      "total_profit": 15000000,
      "margin": 30.00
    }
  ]
}
```

**Giải thích:**
- `gross_profit`: Lợi nhuận gộp (chưa trừ chi phí vận hành)
- `operating_costs`: Tổng chi phí vận hành (lương, điện nước, giao hàng...)
- `net_profit`: Lợi nhuận ròng = Lợi nhuận gộp - Chi phí vận hành
- `top_customers`: Top 10 khách hàng có lợi nhuận cao nhất
- `top_products`: Top 10 sản phẩm có lợi nhuận cao nhất

### 2.4. Lợi nhuận theo Khách hàng (Bonus)

**Endpoint:**
```
GET /store-profit-report/customer/:customerId?seasonId=1&startDate=2024-01-01&endDate=2024-12-31
```

**Query Parameters:**
- `seasonId` (optional): Lọc theo mùa vụ
- `startDate` (optional): Lọc từ ngày (YYYY-MM-DD)
- `endDate` (optional): Lọc đến ngày (YYYY-MM-DD)

## 3. Yêu cầu UI/UX

### 3.1. Trang Báo cáo Lợi nhuận (Dashboard)

Tạo một trang mới tại route `/reports/profit` với các tab:

**Tab 1: Tổng quan Mùa vụ**
- Dropdown chọn Season
- Hiển thị các card tổng hợp:
  - Tổng doanh thu
  - Lợi nhuận gộp
  - Lợi nhuận ròng
  - Tỷ suất lợi nhuận
- Biểu đồ:
  - Biểu đồ tròn: Phân bổ chi phí vận hành
  - Biểu đồ cột: Top 10 khách hàng
  - Biểu đồ cột: Top 10 sản phẩm

**Tab 2: Báo cáo theo Vụ lúa**
- Dropdown hoặc search để chọn Rice Crop
- Hiển thị thông tin vụ lúa (tên ruộng, khách hàng, mùa vụ)
- Tổng hợp: Số đơn hàng, doanh thu, lợi nhuận
- Bảng danh sách các hóa đơn liên quan
- Nút "Xem chi tiết" để chuyển sang tab chi tiết hóa đơn

**Tab 3: Chi tiết Hóa đơn**
- Input để nhập Invoice ID hoặc chọn từ danh sách
- Hiển thị thông tin hóa đơn
- Bảng chi tiết từng sản phẩm với:
  - Tên sản phẩm
  - Số lượng
  - Giá bán
  - Giá vốn
  - Lợi nhuận
  - Tỷ suất lợi nhuận

### 3.2. Tích hợp vào các trang hiện có

**Trang Danh sách Hóa đơn:**
- Thêm cột "Lợi nhuận" (có thể ẩn/hiện)
- Thêm nút "Xem báo cáo lợi nhuận" cho từng hóa đơn

**Trang Chi tiết Vụ lúa:**
- Thêm tab "Báo cáo lợi nhuận"
- Hiển thị tổng hợp và danh sách hóa đơn

**Trang Danh sách Mùa vụ:**
- Thêm cột "Lợi nhuận" (tổng hợp)
- Thêm nút "Xem báo cáo chi tiết"

## 4. TypeScript Interfaces

```typescript
// Lợi nhuận hóa đơn
interface InvoiceProfit {
  invoice_id: number;
  invoice_code: string;
  customer_name: string;
  created_at: string;
  total_amount: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  gross_margin: number;
  item_details: InvoiceItemProfit[];
}

interface InvoiceItemProfit {
  product_name: string;
  quantity: number;
  unit_price: number;
  avg_cost: number;
  cogs: number;
  profit: number;
  margin: number;
}

// Lợi nhuận vụ lúa
interface RiceCropProfit {
  rice_crop_id: number;
  field_name: string;
  customer_name?: string;
  season_name?: string;
  summary: {
    total_invoices: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    avg_margin: number;
  };
  invoices: RiceCropInvoice[];
}

interface RiceCropInvoice {
  invoice_id: number;
  invoice_code: string;
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  customer_name?: string;
}

// Lợi nhuận mùa vụ
interface SeasonProfit {
  season_id: number;
  season_name: string;
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_invoices: number;
    total_customers: number;
    total_revenue: number;
    cost_of_goods_sold: number;
    gross_profit: number;
    gross_margin: number;
    operating_costs: number;
    net_profit: number;
    net_margin: number;
  };
  operating_costs_breakdown: OperatingCost[];
  delivery_stats?: DeliveryStats;
  top_customers: TopCustomer[];
  top_products: TopProduct[];
}
```

## 5. Permissions

Tất cả các endpoint đều yêu cầu permission:
```
store-profit-report:read
```

Đảm bảo user đã được gán permission này trong hệ thống RBAC.

## 6. Lưu ý quan trọng

### 6.1. Cách tính lợi nhuận
- **Giá bán**: Lấy từ `unit_price` trong hóa đơn (giá thực tế lúc bán)
- **Giá vốn**: Lấy từ `average_cost_price` của sản phẩm
- **Lợi nhuận = Doanh thu - Giá vốn**

### 6.2. Hiển thị số tiền
- Format: `1.000.000 đ` hoặc `1,000,000 VND`
- Làm tròn 2 chữ số thập phân cho tỷ suất lợi nhuận

### 6.3. Màu sắc
- Lợi nhuận dương: Màu xanh lá
- Lợi nhuận âm (lỗ): Màu đỏ
- Tỷ suất lợi nhuận cao (>30%): Màu xanh đậm
- Tỷ suất lợi nhuận thấp (<10%): Màu vàng cảnh báo

## 7. Mockup gợi ý

```
┌─────────────────────────────────────────────────────────┐
│  📊 Báo cáo Lợi nhuận                                   │
├─────────────────────────────────────────────────────────┤
│  [Tổng quan] [Theo Vụ lúa] [Chi tiết Hóa đơn]         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Mùa vụ: [Đông Xuân 2024-2025 ▼]                       │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Doanh thu│ │ Lợi nhuận│ │ Chi phí  │ │ Tỷ suất  │  │
│  │ 500M đ   │ │ 130M đ   │ │ 20M đ   │ │ 26%      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                          │
│  Top 10 Khách hàng                Top 10 Sản phẩm      │
│  ┌─────────────────────┐          ┌──────────────────┐ │
│  │ [Biểu đồ cột]       │          │ [Biểu đồ cột]    │ │
│  └─────────────────────┘          └──────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 8. Checklist triển khai

- [ ] Tạo route `/reports/profit`
- [ ] Tạo service gọi API báo cáo lợi nhuận
- [ ] Tạo interfaces TypeScript
- [ ] Implement tab "Tổng quan Mùa vụ"
- [ ] Implement tab "Theo Vụ lúa"
- [ ] Implement tab "Chi tiết Hóa đơn"
- [ ] Thêm biểu đồ (Chart.js hoặc Recharts)
- [ ] Thêm export PDF/Excel (optional)
- [ ] Test với dữ liệu thực
- [ ] Responsive mobile
