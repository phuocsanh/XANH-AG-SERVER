# 📋 TÀI LIỆU TÍCH HỢP FRONTEND - CẢNH BÁO BỆNH LÚA

## 🎯 Tổng quan thay đổi

### ✅ Module mới được tạo:
1. **LocationModule** - Quản lý vị trí ruộng lúa (shared)
2. **AiBacterialBlightModule** - Cảnh báo bệnh cháy bìa lá do vi khuẩn

### 🔄 Module được refactor:
- **AiRiceBlastModule** - Đã tách logic quản lý vị trí ra LocationModule

---

## 📡 API ENDPOINTS

### 1. 🗺️ **Location Management** (Module mới)

#### GET `/location`
**Mục đích**: Lấy vị trí ruộng lúa hiện tại

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response**:
```json
{
  "id": 1,
  "name": "Ruộng nhà ông Tư - Tân Lập, Vũ Thư",
  "lat": 20.4167,
  "lon": 106.3667,
  "created_at": "2025-11-29T14:00:00.000Z",
  "updated_at": "2025-11-29T14:00:00.000Z"
}
```

**Permissions**: `RICE_BLAST_VIEW`

---

#### POST `/location`
**Mục đích**: Cập nhật vị trí ruộng lúa

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Ruộng nhà ông Tư - Tân Lập, Vũ Thư",
  "lat": 20.4167,
  "lon": 106.3667
}
```

**Validation**:
- `name`: required, string
- `lat`: required, number, -90 đến 90
- `lon`: required, number, -180 đến 180

**Response**: Giống GET `/location`

**Permissions**: `RICE_BLAST_MANAGE`

**⚠️ Lưu ý**: Sau khi cập nhật vị trí, hệ thống sẽ tự động chạy lại phân tích cho **CẢ 2 BỆNH** (đạo ôn + cháy bìa lá)

---

### 2. 🦠 **Rice Blast Warning** (Bệnh đạo ôn)

#### GET `/ai-rice-blast/warning`
**Mục đích**: Lấy cảnh báo bệnh đạo ôn mới nhất

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response**:
```json
{
  "id": 1,
  "generated_at": "2025-11-29T14:00:00.000Z",
  "risk_level": "RẤT CAO",
  "probability": 85,
  "message": "🔴 CẢNH BÁO ĐỎ BỆNH ĐẠO ÔN\n\n📍 Ruộng nhà ông Tư...",
  "peak_days": "30/11 – 02/12",
  "daily_data": [
    {
      "date": "29/11",
      "dayOfWeek": "T6",
      "tempMin": 18.5,
      "tempMax": 28.3,
      "tempAvg": 23.4,
      "humidityAvg": 92.5,
      "lwdHours": 14,
      "rainTotal": 5.2,
      "rainHours": 6,
      "fogHours": 4,
      "cloudCoverAvg": 75.0,
      "visibilityAvg": 1500.0,
      "riskScore": 105,
      "riskLevel": "CỰC KỲ NGUY HIỂM",
      "breakdown": {
        "tempScore": 30,
        "lwdScore": 50,
        "humidityScore": 15,
        "rainScore": 15,
        "fogScore": 25
      }
    }
    // ... 6 ngày tiếp theo
  ],
  "updated_at": "2025-11-29T14:00:00.000Z"
}
```

**Permissions**: `RICE_BLAST_VIEW`

---

#### POST `/ai-rice-blast/run-now`
**Mục đích**: Chạy phân tích bệnh đạo ôn ngay lập tức

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response**: Giống GET `/ai-rice-blast/warning`

**Permissions**: `RICE_BLAST_MANAGE`

---

### 3. 🍃 **Bacterial Blight Warning** (Bệnh cháy bìa lá - MỚI)

#### GET `/ai-bacterial-blight/warning`
**Mục đích**: Lấy cảnh báo bệnh cháy bìa lá mới nhất

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response**:
```json
{
  "id": 1,
  "generated_at": "2025-11-29T14:00:00.000Z",
  "risk_level": "CAO",
  "probability": 75,
  "message": "🟠 CẢNH BÁO SỚM – Nguy cơ đang tăng cao\n\n📍 Ruộng nhà ông Tư...",
  "peak_days": "01/12 – 03/12",
  "daily_data": [
    {
      "date": "29/11",
      "dayOfWeek": "T6",
      "tempMin": 24.5,
      "tempMax": 33.2,
      "tempAvg": 28.8,
      "humidityAvg": 85.0,
      "rainTotal": 35.5,
      "rainHours": 8,
      "windSpeedMax": 22.5,
      "windSpeedAvg": 15.3,
      "rain3Days": 85.2,
      "riskScore": 95,
      "riskLevel": "RẤT CAO",
      "breakdown": {
        "tempScore": 30,
        "rainScore": 30,
        "windScore": 25,
        "humidityScore": 20,
        "floodScore": 15
      }
    }
    // ... 6 ngày tiếp theo
  ],
  "updated_at": "2025-11-29T14:00:00.000Z"
}
```

**Permissions**: `RICE_BLAST_VIEW`

---

#### POST `/ai-bacterial-blight/run-now`
**Mục đích**: Chạy phân tích bệnh cháy bìa lá ngay lập tức

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response**: Giống GET `/ai-bacterial-blight/warning`

**Permissions**: `RICE_BLAST_MANAGE`

---

### 4. 🐛 **Pest Warning** (Sâu hại - MỚI)

#### GET `/ai-pest-warning/warning`
**Mục đích**: Lấy cảnh báo sâu hại (Sâu đục thân, Muỗi hành) mới nhất

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response**:
```json
{
  "id": 1,
  "generated_at": "2025-11-29T14:00:00.000Z",
  "stem_borer_risk": "CAO",
  "gall_midge_risk": "TRUNG BÌNH",
  "message": "📍 Ruộng nhà ông Tư\n\n🐛 SÂU ĐỤC THÂN: NGUY CƠ CAO\n⚠️ Thời tiết ấm ẩm...",
  "daily_data": [
    {
      "date": "29/11",
      "dayOfWeek": "T6",
      "tempMin": 24.5,
      "tempMax": 30.2,
      "tempAvg": 27.5,
      "humidityAvg": 82.0,
      "rainTotal": 5.5,
      "sunHours": 4.5,
      "stemBorerScore": 85,
      "gallMidgeScore": 45,
      "stemBorerLevel": "CAO",
      "gallMidgeLevel": "TRUNG BÌNH"
    }
    // ... 6 ngày tiếp theo
  ],
  "updated_at": "2025-11-29T14:00:00.000Z"
}
```

**Permissions**: `RICE_BLAST_VIEW`

---

#### POST `/ai-pest-warning/run-now`
**Mục đích**: Chạy phân tích sâu hại ngay lập tức

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response**: Giống GET `/ai-pest-warning/warning`

**Permissions**: `RICE_BLAST_MANAGE`

---

## 🔑 Permissions cần thiết

| Permission | Mô tả |
|------------|-------|
| `RICE_BLAST_VIEW` | Xem cảnh báo bệnh/sâu và vị trí |
| `RICE_BLAST_MANAGE` | Cập nhật vị trí và chạy phân tích thủ công |

---

## 📊 So sánh dữ liệu 3 loại cảnh báo

### 1. Bệnh Đạo Ôn (Rice Blast)
- **Key metrics**: `lwdHours` (giờ lá ướt), `fogHours` (giờ sương mù).
- **Risk Score**: 0-135.

### 2. Bệnh Cháy Bìa Lá (Bacterial Blight)
- **Key metrics**: `rainTotal` (mưa), `windSpeedMax` (gió), `rain3Days` (ngập).
- **Risk Score**: 0-135.

### 3. Sâu Hại (Pest Warning)
```typescript
interface PestDailyData {
  date: string;
  dayOfWeek: string;
  tempAvg: number;        // Quan trọng cho Sâu đục thân (25-30°C)
  humidityAvg: number;    // Quan trọng cho cả 2 (>80-90%)
  rainTotal: number;
  sunHours: number;       // Quan trọng (Muỗi hành sợ nắng, Sâu đục thân thích nắng ấm)
  
  stemBorerScore: number; // 0-100
  gallMidgeScore: number; // 0-100
  
  stemBorerLevel: string; // THẤP, TRUNG BÌNH, CAO
  gallMidgeLevel: string; // THẤP, TRUNG BÌNH, CAO
}
```

---

## 🎨 Gợi ý UI/UX

### 1. Dashboard Cảnh báo (Cập nhật)
```tsx
// Component: DiseaseWarningDashboard.tsx
import { Tabs } from 'antd';

function DiseaseWarningDashboard() {
  return (
    <Tabs>
      <Tabs.TabPane tab="🦠 Bệnh Đạo Ôn" key="rice-blast">
        <RiceBlastWarning />
      </Tabs.TabPane>
      <Tabs.TabPane tab="🍃 Bệnh Cháy Bìa Lá" key="bacterial-blight">
        <BacterialBlightWarning />
      </Tabs.TabPane>
      <Tabs.TabPane tab="🐛 Cảnh Báo Sâu Hại" key="pest-warning">
        <PestWarning />
      </Tabs.TabPane>
    </Tabs>
  );
}
```

### 2. Component Hiển thị Sâu hại
```tsx
// Component: PestWarningCard.tsx
function PestWarningCard({ warning }) {
  return (
    <Card>
      <Row gutter={16}>
        <Col span={12}>
          <Statistic 
            title="Sâu Đục Thân" 
            value={warning.stem_borer_risk} 
            valueStyle={{ color: getRiskColor(warning.stem_borer_risk) }} 
          />
        </Col>
        <Col span={12}>
          <Statistic 
            title="Muỗi Hành" 
            value={warning.gall_midge_risk} 
            valueStyle={{ color: getRiskColor(warning.gall_midge_risk) }} 
          />
        </Col>
      </Row>
      
      <Divider />
      
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {warning.message}
      </pre>

      {/* Biểu đồ so sánh 2 loại sâu */}
      <PestRiskChart data={warning.daily_data} />
    </Card>
  );
}
```

### 3. Biểu đồ Sâu hại (Dual Line Chart)
```tsx
// Component: PestRiskChart.tsx
import { DualAxes } from '@ant-design/charts';

function PestRiskChart({ data }) {
  const config = {
    data: [data, data],
    xField: 'date',
    yField: ['stemBorerScore', 'gallMidgeScore'],
    geometryOptions: [
      { geometry: 'line', color: '#fa8c16' }, // Sâu đục thân (Cam)
      { geometry: 'line', color: '#722ed1' }, // Muỗi hành (Tím)
    ],
    legend: {
      custom: true,
      items: [
        { name: 'Sâu đục thân', value: 'stemBorerScore', marker: { style: { fill: '#fa8c16' } } },
        { name: 'Muỗi hành', value: 'gallMidgeScore', marker: { style: { fill: '#722ed1' } } },
      ],
    },
  };

  return <DualAxes {...config} />;
}
```

---

## 🚀 Ví dụ React Query Hooks (Thêm mới)

```typescript
// hooks/usePestWarning.ts
export const usePestWarning = () => {
  return useQuery(
    ['pest-warning'],
    async () => {
      const res = await fetch('/ai-pest-warning/warning', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    },
    {
      refetchInterval: 5 * 60 * 1000,
    }
  );
};

export const useRunPestAnalysis = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async () => {
      const res = await fetch('/ai-pest-warning/run-now', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pest-warning']);
      }
    }
  );
};
```

### 3. Component Hiển thị Cảnh báo
```tsx
// Component: WarningCard.tsx
function WarningCard({ warning }) {
  const getRiskColor = (level) => {
    const colors = {
      'AN TOÀN': '#52c41a',
      'THẤP': '#1890ff',
      'TRUNG BÌNH': '#faad14',
      'CAO': '#fa8c16',
      'RẤT CAO': '#f5222d',
      'CỰC KỲ NGUY HIỂM': '#a8071a'
    };
    return colors[level] || '#d9d9d9';
  };

  return (
    <Card>
      <div style={{ 
        backgroundColor: getRiskColor(warning.risk_level),
        padding: '20px',
        borderRadius: '8px'
      }}>
        <h2>{warning.risk_level}</h2>
        <p>Xác suất: {warning.probability}%</p>
        <p>Ngày cao điểm: {warning.peak_days}</p>
      </div>
      
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {warning.message}
      </pre>

      {/* Biểu đồ 7 ngày */}
      <DailyRiskChart data={warning.daily_data} />
    </Card>
  );
}
```

### 4. Biểu đồ Nguy cơ Theo Ngày
```tsx
// Component: DailyRiskChart.tsx
import { Line } from '@ant-design/charts';

function DailyRiskChart({ data }) {
  const config = {
    data: data.map(d => ({
      date: `${d.dayOfWeek} ${d.date}`,
      score: d.riskScore,
      level: d.riskLevel
    })),
    xField: 'date',
    yField: 'score',
    seriesField: 'level',
    yAxis: {
      max: 135,
      label: { formatter: (v) => `${v} điểm` }
    },
    color: ({ level }) => {
      const colors = {
        'AN TOÀN': '#52c41a',
        'THẤP': '#1890ff',
        'TRUNG BÌNH': '#faad14',
        'CAO': '#fa8c16',
        'RẤT CAO': '#f5222d',
        'CỰC KỲ NGUY HIỂM': '#a8071a'
      };
      return colors[level];
    }
  };

  return <Line {...config} />;
}
```

---

## 🔄 Luồng hoạt động

### Khi khởi động server:
1. ✅ LocationModule khởi tạo
2. ✅ AiRiceBlastModule khởi tạo → Chạy phân tích bệnh đạo ôn
3. ✅ AiBacterialBlightModule khởi tạo → Chạy phân tích bệnh cháy bìa lá

### Khi cập nhật vị trí:
1. User gọi `POST /location`
2. LocationService cập nhật vị trí
3. ⚠️ **KHÔNG** tự động trigger phân tích (khác với trước)
4. User cần gọi riêng:
   - `POST /ai-rice-blast/run-now`
   - `POST /ai-bacterial-blight/run-now`

### Cron job tự động (6:00 sáng hàng ngày):
1. ✅ Phân tích bệnh đạo ôn
2. ✅ Phân tích bệnh cháy bìa lá

---

## ⚠️ Breaking Changes

### ❌ Endpoints đã XÓA:
- `GET /ai-rice-blast/location` → Chuyển sang `GET /location`
- `POST /ai-rice-blast/location` → Chuyển sang `POST /location`

### ✅ Endpoints MỚI:
- `GET /location`
- `POST /location`
- `GET /ai-bacterial-blight/warning`
- `POST /ai-bacterial-blight/run-now`

### 🔄 Endpoints GIỮ NGUYÊN:
- `GET /ai-rice-blast/warning`
- `POST /ai-rice-blast/run-now`

---

## 📝 Checklist Tích hợp Frontend

- [ ] Tạo service/hook để gọi API Location
- [ ] Tạo service/hook để gọi API Bacterial Blight
- [ ] Cập nhật service Rice Blast (xóa location endpoints)
- [ ] Tạo UI quản lý vị trí (form + map)
- [ ] Tạo UI dashboard 2 bệnh (tabs)
- [ ] Tạo component hiển thị cảnh báo (card + message)
- [ ] Tạo biểu đồ nguy cơ theo ngày
- [ ] Tạo bảng chi tiết breakdown điểm số
- [ ] Thêm nút "Chạy phân tích ngay"
- [ ] Thêm auto-refresh mỗi 5 phút
- [ ] Thêm notification khi có cảnh báo mới
- [ ] Test permissions (VIEW vs MANAGE)

---

## 🚀 Ví dụ React Query Hooks

```typescript
// hooks/useLocation.ts
export const useLocation = () => {
  return useQuery(['location'], async () => {
    const res = await fetch('/location', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  });
};

export const useUpdateLocation = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (data: UpdateLocationDto) => {
      const res = await fetch('/location', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['location']);
        // Có thể tự động trigger phân tích lại
      }
    }
  );
};

// hooks/useRiceBlast.ts
export const useRiceBlastWarning = () => {
  return useQuery(
    ['rice-blast-warning'],
    async () => {
      const res = await fetch('/ai-rice-blast/warning', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    },
    {
      refetchInterval: 5 * 60 * 1000, // Auto-refresh mỗi 5 phút
    }
  );
};

export const useRunRiceBlastAnalysis = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async () => {
      const res = await fetch('/ai-rice-blast/run-now', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rice-blast-warning']);
      }
    }
  );
};

// hooks/useBacterialBlight.ts
export const useBacterialBlightWarning = () => {
  return useQuery(
    ['bacterial-blight-warning'],
    async () => {
      const res = await fetch('/ai-bacterial-blight/warning', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    },
    {
      refetchInterval: 5 * 60 * 1000,
    }
  );
};

export const useRunBacterialBlightAnalysis = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async () => {
      const res = await fetch('/ai-bacterial-blight/run-now', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['bacterial-blight-warning']);
      }
    }
  );
};
```

---

## 📞 Hỗ trợ

Nếu có vấn đề trong quá trình tích hợp, vui lòng liên hệ team backend.

**Ngày tạo**: 29/11/2025  
**Version**: 1.0.0
