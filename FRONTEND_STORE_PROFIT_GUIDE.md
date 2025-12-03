# 📘 Hướng Dẫn Tích Hợp Frontend: Hệ Thống Lợi Nhuận Cửa Hàng

Tài liệu này hướng dẫn tích hợp 3 tính năng mới:
1. **Lợi nhuận đơn hàng** (Hiển thị trong chi tiết đơn hàng)
2. **Báo cáo mùa vụ** (Dashboard lợi nhuận tổng quan)
3. **Lợi nhuận khách hàng** (Tab mới trong chi tiết khách hàng)

---

## 🛠️ 1. API Endpoints Mới

Base URL: `/store-profit-report`

| Chức năng | Method | Endpoint | Params |
|-----------|--------|----------|--------|
| **Lợi nhuận đơn hàng** | `GET` | `/invoice/:id` | `id`: ID hóa đơn |
| **Báo cáo mùa vụ** | `GET` | `/season/:seasonId` | `seasonId`: ID mùa vụ |
| **Lợi nhuận khách hàng** | `GET` | `/customer/:customerId` | `customerId`: ID khách<br>`seasonId`: (opt) Lọc theo mùa<br>`startDate`: (opt) YYYY-MM-DD<br>`endDate`: (opt) YYYY-MM-DD |

---

## 💻 2. Typescript Interfaces

Copy các interfaces này vào `src/types/store-profit.ts`:

```typescript
// 1. Lợi nhuận đơn hàng
export interface InvoiceProfit {
  invoice_id: number;
  invoice_code: string;
  customer_name: string;
  total_amount: number;      // Doanh thu
  cost_of_goods_sold: number; // Giá vốn
  gross_profit: number;      // Lợi nhuận
  gross_margin: number;      // % Lợi nhuận
  item_details: {
    product_name: string;
    quantity: number;
    unit_price: number;
    avg_cost: number;        // Giá vốn đơn vị
    profit: number;          // Lợi nhuận item
    margin: number;
  }[];
}

// 2. Báo cáo mùa vụ
export interface SeasonProfitReport {
  season_id: number;
  season_name: string;
  summary: {
    total_revenue: number;
    cost_of_goods_sold: number;
    gross_profit: number;    // Lợi nhuận gộp
    operating_costs: number; // Chi phí vận hành
    net_profit: number;      // Lợi nhuận ròng (sau chi phí)
    net_margin: number;
  };
  operating_costs_breakdown: {
    type: string;
    name: string;
    amount: number;
  }[];
  delivery_stats?: {
    total_deliveries: number;
    total_delivery_cost: number;
    avg_cost_per_delivery: number;
  };
  top_customers: {
    customer_id: number;
    customer_name: string;
    total_profit: number;
  }[];
  top_products: {
    product_id: number;
    product_name: string;
    total_profit: number;
  }[];
}

// 3. Lợi nhuận khách hàng
export interface CustomerProfitReport {
  customer_id: number;
  customer_name: string;
  summary: {
    total_invoices: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;    // Tổng lợi nhuận từ khách này
    avg_margin: number;
  };
  invoices: {
    invoice_id: number;
    invoice_code: string;
    date: string;
    revenue: number;
    profit: number;
    margin: number;
    season_name?: string;
  }[];
  by_season: {
    season_id: number;
    season_name: string;
    total_profit: number;
  }[];
}
```

---

## 🎨 3. Gợi Ý UI Implementation

### **A. Trang Chi Tiết Đơn Hàng (`/sales-invoices/:id`)**

Thêm một **Card "Phân Tích Lợi Nhuận"** (chỉ hiện với Admin/Manager):

```tsx
// Component: InvoiceProfitCard.tsx
<Card title="Phân Tích Lợi Nhuận">
  <Statistic 
    title="Lợi Nhuận Gộp" 
    value={data.gross_profit} 
    suffix={`(${data.gross_margin}%)`}
    valueStyle={{ color: data.gross_profit > 0 ? '#3f8600' : '#cf1322' }}
  />
  <Table 
    dataSource={data.item_details}
    columns={[
      { title: 'Sản phẩm', dataIndex: 'product_name' },
      { title: 'Giá vốn', dataIndex: 'avg_cost', render: moneyFormat },
      { title: 'Lợi nhuận', dataIndex: 'profit', render: moneyFormat },
    ]} 
  />
</Card>
```

### **B. Trang Báo Cáo Mùa Vụ (`/reports/season`)**

Tạo trang Dashboard mới với các biểu đồ:

1. **Tổng quan (Cards):**
   - Doanh thu
   - Giá vốn
   - Chi phí vận hành (bao gồm giao hàng)
   - **Lợi nhuận ròng (Net Profit)** - *Highlight số này*

2. **Biểu đồ tròn (Pie Chart):**
   - Cơ cấu chi phí: Giá vốn vs Vận hành vs Giao hàng

3. **Top Ranking (Tables):**
   - Top 10 khách hàng mang lại lợi nhuận cao nhất
   - Top 10 sản phẩm lãi nhất

### **C. Trang Chi Tiết Khách Hàng (`/customers/:id`)**

Thêm Tab mới: **"Lợi Nhuận"**

```tsx
// Tab: CustomerProfitTab.tsx
<Tabs>
  <TabPane tab="Thông tin chung" key="1">...</TabPane>
  <TabPane tab="Lịch sử mua hàng" key="2">...</TabPane>
  
  {/* TAB MỚI */}
  <TabPane tab="Phân Tích Lợi Nhuận" key="3">
    <Row gutter={16}>
      <Col span={8}>
        <Statistic title="Tổng Lợi Nhuận Đem Lại" value={data.summary.total_profit} />
      </Col>
      <Col span={8}>
        <Statistic title="Tỷ Suất Lợi Nhuận TB" value={data.summary.avg_margin} suffix="%" />
      </Col>
    </Row>
    
    <Divider>Lịch sử lợi nhuận theo đơn hàng</Divider>
    <Table dataSource={data.invoices} columns={...} />
  </TabPane>
</Tabs>
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **Permissions:**
   - Các API này yêu cầu quyền `store-profit-report:read`.
   - Đảm bảo user gọi API có quyền này (thường là Admin/Manager).

2. **Format Tiền Tệ:**
   - Luôn format số tiền VNĐ: `value.toLocaleString('vi-VN')} đ`

3. **Màu Sắc:**
   - Lợi nhuận dương: Màu xanh lá (`#3f8600`)
   - Lợi nhuận âm/lỗ: Màu đỏ (`#cf1322`)

---

## 🚀 Checklist Triển Khai

- [ ] Tạo file types `store-profit.ts`
- [ ] Tạo React Query hooks (`useInvoiceProfit`, `useSeasonProfit`, `useCustomerProfit`)
- [ ] Update trang chi tiết đơn hàng
- [ ] Tạo trang báo cáo mùa vụ mới
- [ ] Update trang chi tiết khách hàng

---

# 🤖 Hướng Dẫn Tích Hợp: Hệ Thống AI Cảnh Báo Sâu Bệnh (MỚI!)

## 📌 Tổng Quan

Hệ thống cảnh báo sâu bệnh đã được **nâng cấp lên AI-Powered** sử dụng Google Gemini. Thay vì tính toán theo công thức cứng nhắc, giờ AI sẽ tự phân tích dữ liệu thời tiết và đưa ra cảnh báo thông minh hơn.

### 🆕 Điểm Mới

| Trước (Rule-Based) | Sau (AI-Powered) |
|-------------------|------------------|
| Tính điểm theo công thức if-else | AI suy luận dựa trên kiến thức nông nghiệp |
| Đếm tất cả giờ có mưa (sai!) | Chỉ tính mưa khi xác suất ≥ 50% |
| Không giải thích được | AI giải thích chi tiết lý do |
| Khó điều chỉnh (phải sửa code) | Dễ điều chỉnh (chỉ sửa prompt) |

---

## 🛠️ API Endpoints (Không Đổi)

Base URL: `/api/ai-[module-name]`

| Module | Endpoint | Mô Tả |
|--------|----------|-------|
| Bệnh Đạo Ôn | `/ai-rice-blast/warning` | Lấy cảnh báo mới nhất |
| | `/ai-rice-blast/run-now` | Chạy phân tích ngay |
| Bệnh Cháy Bìa Lá | `/ai-bacterial-blight/warning` | |
| | `/ai-bacterial-blight/run-now` | |
| Rầy Nâu | `/ai-brown-plant-hopper/warning` | |
| | `/ai-brown-plant-hopper/run-now` | |
| Muỗi Hành | `/ai-gall-midge/warning` | |
| | `/ai-gall-midge/run-now` | |
| Sâu Đục Thân | `/ai-stem-borer/warning` | |
| | `/ai-stem-borer/run-now` | |
| Bệnh Đốm Vằn Lá | `/ai-sheath-blight/warning` | |
| | `/ai-sheath-blight/run-now` | |
| Bệnh Đốm Hạt | `/ai-grain-discoloration/warning` | |
| | `/ai-grain-discoloration/run-now` | |

---

## 💻 Typescript Interfaces (CẬP NHẬT)

**Thay đổi chính:** Trường `message` giờ sẽ có format mới, chi tiết và dễ đọc hơn.

```typescript
// src/types/ai-warning.ts

export interface DiseaseWarning {
  id: number;
  generated_at: string;
  risk_level: 'THẤP' | 'TRUNG BÌNH' | 'CAO' | 'RẤT CAO';
  
  // 🆕 Message giờ có cấu trúc rõ ràng hơn
  message: string; // Format: "🟠 CẢNH BÁO: CAO\n📍 Đồng Tháp\n\n[Summary]\n\n⚠️ Thời gian nguy cơ cao: ...\n\n🔍 PHÂN TÍCH CHI TIẾT:\n...\n\n💊 KHUYẾN NGHỊ:\n..."
  
  peak_days: string | null; // VD: "05/12 - 07/12"
  
  daily_data: DailyRiskData[];
}

export interface DailyRiskData {
  date: string;           // VD: "03/12"
  dayOfWeek: string;      // VD: "T4"
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  humidityAvg: number;
  rainTotal: number;      // 🆕 Tính chính xác hơn (chỉ tính khi xác suất ≥ 50%)
  rainHours: number;      // 🆕 Số giờ mưa thực tế
  
  // 🆕 Điểm và mức độ từ AI
  riskScore: number;      // 0-100 (do AI đánh giá)
  riskLevel: string;      // "THẤP" | "TRUNG BÌNH" | "CAO" | "RẤT CAO"
  
  // Breakdown vẫn giữ để tương thích (nhưng giá trị = 0)
  breakdown: {
    tempScore: number;
    lwdScore?: number;
    humidityScore: number;
    rainScore?: number;
    fogScore?: number;
  };
}
```

---

## 🎨 UI Updates Cần Thiết

### **1. Hiển Thị Message Mới**

Message giờ có cấu trúc rõ ràng với emoji và phần chia:

```tsx
// Component: WarningMessageDisplay.tsx
import { Typography, Divider } from 'antd';

const { Paragraph, Title } = Typography;

function WarningMessageDisplay({ message }: { message: string }) {
  // Parse message thành các phần
  const sections = message.split('\n\n');
  
  return (
    <div style={{ whiteSpace: 'pre-line' }}>
      {/* Dòng đầu: Emoji + Risk Level */}
      <Title level={3}>{sections[0]}</Title>
      
      {/* Summary */}
      <Paragraph>{sections[1]}</Paragraph>
      
      {/* Peak Days */}
      <Paragraph strong>{sections[2]}</Paragraph>
      
      <Divider />
      
      {/* Phân tích chi tiết */}
      <Title level={5}>🔍 PHÂN TÍCH CHI TIẾT:</Title>
      <Paragraph>{sections[3]?.replace('🔍 PHÂN TÍCH CHI TIẾT:\n', '')}</Paragraph>
      
      <Divider />
      
      {/* Khuyến nghị */}
      <Title level={5}>💊 KHUYẾN NGHỊ:</Title>
      <Paragraph style={{ color: '#1890ff' }}>
        {sections[4]?.replace('💊 KHUYẾN NGHỊ:\n', '')}
      </Paragraph>
    </div>
  );
}
```

### **2. Badge Màu Theo Risk Level**

```tsx
function getRiskBadge(riskLevel: string) {
  const config = {
    'RẤT CAO': { color: 'red', icon: '🔴' },
    'CAO': { color: 'orange', icon: '🟠' },
    'TRUNG BÌNH': { color: 'gold', icon: '🟡' },
    'THẤP': { color: 'green', icon: '🟢' },
  };
  
  const { color, icon } = config[riskLevel] || config['THẤP'];
  
  return (
    <Badge 
      color={color} 
      text={`${icon} ${riskLevel}`}
      style={{ fontSize: 16, fontWeight: 'bold' }}
    />
  );
}
```

### **3. Biểu Đồ 7 Ngày (Cập Nhật)**

Giờ `riskScore` và `riskLevel` là do AI đánh giá, không phải tính toán cứng:

```tsx
import { Line } from '@ant-design/charts';

function RiskChart({ dailyData }: { dailyData: DailyRiskData[] }) {
  const config = {
    data: dailyData,
    xField: 'date',
    yField: 'riskScore',
    seriesField: 'riskLevel',
    yAxis: { max: 100, min: 0 },
    color: ({ riskLevel }) => {
      if (riskLevel === 'RẤT CAO') return '#ff4d4f';
      if (riskLevel === 'CAO') return '#ff7a45';
      if (riskLevel === 'TRUNG BÌNH') return '#ffc53d';
      return '#52c41a';
    },
    point: {
      size: 5,
      shape: 'circle',
    },
    tooltip: {
      formatter: (datum) => ({
        name: 'Nguy cơ',
        value: `${datum.riskScore}/100 (${datum.riskLevel})`,
      }),
    },
  };
  
  return <Line {...config} />;
}
```

### **4. Highlight Peak Days**

```tsx
function PeakDaysAlert({ peakDays }: { peakDays: string | null }) {
  if (!peakDays) return null;
  
  return (
    <Alert
      message="⚠️ Thời Gian Nguy Cơ Cao"
      description={`Cần đặc biệt chú ý trong khoảng: ${peakDays}`}
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
}
```

---

## 🔔 Thông Báo Cho Nông Dân

### **Push Notification (Nếu Có)**

Khi `risk_level` = "CAO" hoặc "RẤT CAO", gửi thông báo:

```typescript
if (warning.risk_level === 'CAO' || warning.risk_level === 'RẤT CAO') {
  sendPushNotification({
    title: `${warning.risk_level === 'RẤT CAO' ? '🔴' : '🟠'} Cảnh Báo ${diseaseName}`,
    body: warning.message.split('\n\n')[1], // Lấy phần summary
    data: {
      type: 'disease-warning',
      diseaseType: 'rice-blast', // hoặc module tương ứng
      riskLevel: warning.risk_level,
    },
  });
}
```

---

## ⚙️ React Query Hooks (Cập Nhật)

```typescript
// src/hooks/useAiWarnings.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/services/api';

// Hook lấy cảnh báo
export function useRiceBlastWarning() {
  return useQuery({
    queryKey: ['ai-warning', 'rice-blast'],
    queryFn: () => api.get('/ai-rice-blast/warning'),
    refetchInterval: 5 * 60 * 1000, // Refresh mỗi 5 phút
  });
}

// Hook chạy phân tích ngay
export function useRunRiceBlastAnalysis() {
  return useMutation({
    mutationFn: () => api.post('/ai-rice-blast/run-now'),
    onSuccess: () => {
      // Invalidate cache để refresh data
      queryClient.invalidateQueries(['ai-warning', 'rice-blast']);
    },
  });
}

// Tương tự cho các module khác...
```

---

## 🎯 Checklist Triển Khai AI Warning

- [ ] Cập nhật TypeScript interfaces (`ai-warning.ts`)
- [ ] Tạo component `WarningMessageDisplay` để hiển thị message mới
- [ ] Cập nhật `RiskChart` để dùng `riskScore` từ AI
- [ ] Thêm `PeakDaysAlert` component
- [ ] Implement Push Notification cho cảnh báo cao
- [ ] Test với tất cả 7 module AI
- [ ] Kiểm tra responsive trên mobile

---

## 📊 So Sánh Trước/Sau (Cho Nông Dân Thấy)

### Trước:
> "Nguy cơ: CAO (85 điểm). Mưa 11.5mm, độ ẩm 82%."

### Sau (AI):
> "🟠 CẢNH BÁO: CAO  
> 📍 Đồng Tháp
> 
> Nguy cơ bệnh đạo ôn đang ở mức CAO do mưa kéo dài 12 giờ kết hợp với độ ẩm 82.5%. Điều kiện này rất thuận lợi cho bào tử nấm phát triển.
> 
> ⚠️ Thời gian nguy cơ cao: 05/12 - 07/12
> 
> 🔍 PHÂN TÍCH CHI TIẾT:
> Mưa 11.5mm trong 12 giờ liên tục (không phải mưa rào) làm lá lúa ướt kéo dài, tạo môi trường lý tưởng cho nấm Pyricularia oryzae xâm nhập. Nhiệt độ 27.6°C nằm trong khoảng tối ưu 25-30°C cho sự phát triển của bệnh.
> 
> 💊 KHUYẾN NGHỊ:
> Phun thuốc NGAY trong 24-48 giờ tới. Sử dụng Tricyclazole hoặc Azoxystrobin. Thời điểm phun tốt nhất: Chiều mát 16:00-18:00 khi lá đã khô sương."

**→ Rõ ràng, dễ hiểu, và có hành động cụ thể hơn rất nhiều!**

---

## 🚨 Lưu Ý Quan Trọng

1. **Không Breaking Change:**
   - API endpoints không đổi
   - Response structure không đổi
   - Chỉ nội dung `message` và cách tính `riskScore` thay đổi

2. **Backward Compatible:**
   - Frontend cũ vẫn hoạt động bình thường
   - Chỉ cần update UI để tận dụng tối đa thông tin mới từ AI

3. **Performance:**
   - AI phân tích mất ~2-3 giây
   - Kết quả được cache trong database
   - Frontend vẫn load nhanh như cũ

---

**Chúc các bạn Frontend tích hợp thành công! 🚀**

