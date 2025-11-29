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

## 🔑 Permissions cần thiết

| Permission | Mô tả |
|------------|-------|
| `RICE_BLAST_VIEW` | Xem cảnh báo bệnh và vị trí |
| `RICE_BLAST_MANAGE` | Cập nhật vị trí và chạy phân tích thủ công |

---

## 📊 So sánh dữ liệu 2 bệnh

### Bệnh Đạo Ôn (Rice Blast)
```typescript
interface RiceBlastDailyData {
  date: string;           // "29/11"
  dayOfWeek: string;      // "T6"
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  humidityAvg: number;
  lwdHours: number;       // ⭐ Số giờ lá ướt (quan trọng)
  rainTotal: number;
  rainHours: number;
  fogHours: number;       // ⭐ Số giờ có sương mù
  cloudCoverAvg: number;
  visibilityAvg: number;
  riskScore: number;      // 0-135
  riskLevel: string;
  breakdown: {
    tempScore: number;    // 0-30
    lwdScore: number;     // 0-50 ⭐
    humidityScore: number;// 0-15
    rainScore: number;    // 0-15
    fogScore: number;     // 0-25
  };
}
```

### Bệnh Cháy Bìa Lá (Bacterial Blight)
```typescript
interface BacterialBlightDailyData {
  date: string;
  dayOfWeek: string;
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  humidityAvg: number;
  rainTotal: number;
  rainHours: number;
  windSpeedMax: number;   // ⭐ Tốc độ gió max (quan trọng)
  windSpeedAvg: number;   // ⭐ Tốc độ gió TB
  rain3Days: number;      // ⭐ Tổng mưa 3 ngày (nguy cơ ngập)
  riskScore: number;      // 0-135
  riskLevel: string;
  breakdown: {
    tempScore: number;    // 0-30
    rainScore: number;    // 0-40 ⭐
    windScore: number;    // 0-25 ⭐
    humidityScore: number;// 0-20
    floodScore: number;   // 0-20 ⭐
  };
}
```

---

## 🎨 Gợi ý UI/UX

### 1. Trang Quản lý Vị trí
```tsx
// Component: LocationManagement.tsx
import { useState, useEffect } from 'react';

function LocationManagement() {
  const [location, setLocation] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchLocation();
  }, []);

  const fetchLocation = async () => {
    const response = await fetch('/location', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setLocation(data);
  };

  const updateLocation = async (formData) => {
    await fetch('/location', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    // Sau khi update, cả 2 bệnh sẽ tự động phân tích lại
    fetchLocation();
  };

  return (
    <div>
      <h2>📍 Vị trí ruộng lúa</h2>
      {/* Form cập nhật vị trí */}
      {/* Map hiển thị vị trí */}
    </div>
  );
}
```

### 2. Dashboard Cảnh báo Bệnh
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
    </Tabs>
  );
}
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
