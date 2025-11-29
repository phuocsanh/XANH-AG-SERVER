# 🎨 Hướng Dẫn Tích Hợp Frontend - Cảnh Báo Bệnh Đạo Ôn Lúa

> Tài liệu này hướng dẫn Frontend Developer tích hợp API cảnh báo bệnh đạo ôn lúa vào giao diện.

---

## 📋 Tổng Quan

### Backend URL
```
http://localhost:3003
```

### 4 API Endpoints

| Method | Endpoint | Mô tả | Response |
|--------|----------|-------|----------|
| **GET** | `/api/location` | Lấy vị trí ruộng lúa hiện tại | `Location` object |
| **POST** | `/api/location` | Cập nhật vị trí ruộng lúa | `Location` object |
| **GET** | `/api/warning` | Lấy cảnh báo bệnh đạo ôn mới nhất | `RiceBlastWarning` object |
| **POST** | `/api/run-now` | Chạy phân tích ngay lập tức | `RiceBlastWarning` object |

---

## 📦 Data Structures

### 1. Location (Vị trí ruộng lúa)

```typescript
interface Location {
  id: number;              // Luôn = 1
  name: string;            // Tên vị trí (VD: "Ruộng nhà ông Tư - Tân Lập, Vũ Thư")
  lat: number;             // Vĩ độ (VD: 20.4167)
  lon: number;             // Kinh độ (VD: 106.3667)
  updated_at: string;      // ISO timestamp
}
```

### 2. RiceBlastWarning (Cảnh báo bệnh)

```typescript
interface RiceBlastWarning {
  id: number;              // Luôn = 1
  generated_at: string;    // Thời điểm tạo cảnh báo (ISO timestamp)
  risk_level: string;      // "AN TOÀN" | "THẤP" | "TRUNG BÌNH" | "CAO" | "RẤT CAO"
  probability: number;     // Xác suất nhiễm bệnh (0-100%)
  message: string;         // Tin nhắn cảnh báo chi tiết (có emoji + ngày + thuốc)
  peak_days: string;       // Ngày cao điểm (VD: "30/11 – 02/12") hoặc null
  daily_data: DailyRiskData[];  // Dữ liệu chi tiết 7 ngày
  updated_at: string;      // ISO timestamp
}
```

### 3. DailyRiskData (Dữ liệu từng ngày)

```typescript
interface DailyRiskData {
  date: string;            // "29/11"
  dayOfWeek: string;       // "T6"
  tempMin: number;         // Nhiệt độ thấp nhất (°C)
  tempMax: number;         // Nhiệt độ cao nhất (°C)
  tempAvg: number;         // Nhiệt độ trung bình (°C)
  humidityAvg: number;     // Độ ẩm trung bình (%)
  lwdHours: number;        // Số giờ lá ướt (0-24)
  rainTotal: number;       // Tổng lượng mưa (mm)
  rainHours: number;       // Số giờ có mưa
  fogHours: number;        // Số giờ có sương mù
  cloudCoverAvg: number;   // Độ che phủ mây (%)
  visibilityAvg: number;   // Tầm nhìn (m)
  riskScore: number;       // Điểm nguy cơ (0-135)
  riskLevel: string;       // "AN TOÀN" | "THẤP" | "TRUNG BÌNH" | "CAO" | "RẤT CAO"
  breakdown: {
    tempScore: number;     // Điểm nhiệt độ
    lwdScore: number;      // Điểm lá ướt
    humidityScore: number; // Điểm độ ẩm
    rainScore: number;     // Điểm mưa
    fogScore: number;      // Điểm sương mù
  };
}
```

---

## 🔌 API Usage Examples

### 1. Lấy Vị Trí Hiện Tại

```bash
GET http://localhost:3003/api/location
```

**Response:**
```json
{
  "id": 1,
  "name": "Ruộng nhà ông Tư - Tân Lập, Vũ Thư",
  "lat": 20.4167,
  "lon": 106.3667,
  "updated_at": "2025-11-29T06:00:00+07:00"
}
```

### 2. Cập Nhật Vị Trí

```bash
POST http://localhost:3003/api/location
Content-Type: application/json

{
  "name": "Ruộng nhà ông Năm - Mỹ Lộc, Nam Định",
  "lat": 20.4500,
  "lon": 106.1200
}
```

**Response:** Giống GET `/api/location`

**Lưu ý:** Sau khi cập nhật vị trí, backend sẽ **tự động chạy phân tích ngay** và cập nhật cảnh báo.

### 3. Lấy Cảnh Báo Mới Nhất

```bash
GET http://localhost:3003/api/warning
```

**Response:**
```json
{
  "id": 1,
  "generated_at": "2025-11-29T06:00:00+07:00",
  "risk_level": "RẤT CAO",
  "probability": 95,
  "peak_days": "30/11 – 02/12",
  "message": "🔴 CẢNH BÁO ĐỎ BỆNH ĐẠO ÔN\n\n📍 Ruộng nhà ông Tư - Tân Lập, Vũ Thư\n⚠️ Nguy cơ bùng phát TRONG 2–4 NGÀY TỚI (30/11 – 02/12)\n🌫️ Sương mù dày + lá ướt 16 giờ → CỰC KỲ THUẬN LỢI cho nấm!\n\n💊 KHUYẾN CÁO: Phun NGAY hôm nay hoặc ngày mai (29–30/11) khi trời còn khô ráo\n\n🧪 Thuốc tốt nhất:\n• Tricyclazole 75WP (Beam, Fuji-One)\n• Tebuconazole + Trifloxystrobin (Nativo)\n• Isoprothiolane (Fuji-One)\n• Antracol + Kasumin (phối hợp)\n\n⏰ Phun vào sáng sớm (5–7h) hoặc chiều mát (16–18h)\n💧 Dùng đủ nước (400–500 lít/ha) để thuốc phủ đều",
  "daily_data": [
    {
      "date": "29/11",
      "dayOfWeek": "T6",
      "tempMin": 18.5,
      "tempMax": 28.3,
      "tempAvg": 23.4,
      "humidityAvg": 94.2,
      "lwdHours": 16,
      "rainTotal": 8.5,
      "rainHours": 7,
      "fogHours": 5,
      "cloudCoverAvg": 85.0,
      "visibilityAvg": 1500.0,
      "riskScore": 115,
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
  "updated_at": "2025-11-29T06:00:00+07:00"
}
```

### 4. Chạy Phân Tích Ngay

```bash
POST http://localhost:3003/api/run-now
```

**Response:** Giống GET `/api/warning`

**Lưu ý:** API này sẽ mất 5-10 giây để hoàn thành vì phải:
1. Gọi Open-Meteo API lấy dữ liệu thời tiết
2. Tính toán phân tích
3. Lưu vào database

---

## 🎨 UI/UX Recommendations

### 1. Màu Sắc Theo Mức Độ Nguy Cơ

| Risk Level | Màu | Hex | Icon |
|------------|-----|-----|------|
| **RẤT CAO** | Đỏ | `#ff4d4f` | 🔴 |
| **CAO** | Cam | `#fa8c16` | 🟠 |
| **TRUNG BÌNH** | Vàng | `#faad14` | 🟡 |
| **THẤP** | Xanh lá | `#52c41a` | 🟢 |
| **AN TOÀN** | Xanh dương | `#1890ff` | ✅ |
| **ĐANG CHỜ CẬP NHẬT** | Xám | `#d9d9d9` | ⏳ |

### 2. Components Gợi Ý

#### Dashboard Page
- **Warning Card**: Hiển thị cảnh báo với màu sắc phù hợp
- **Location Form**: Form cập nhật vị trí (có validation)
- **Daily Data Table**: Bảng dữ liệu 7 ngày
- **Refresh Button**: Nút "Cập nhật ngay" (gọi `/api/run-now`)

#### Warning Card Layout
```
┌─────────────────────────────────────────┐
│ 🔴 RẤT CAO          95%     [Cập nhật]  │
│ 📅 Ngày cao điểm: 30/11 – 02/12         │
├─────────────────────────────────────────┤
│                                         │
│ [Tin nhắn cảnh báo chi tiết]            │
│ (Hiển thị với whitespace-pre-wrap)      │
│                                         │
├─────────────────────────────────────────┤
│ 🕐 Cập nhật: 29/11/2025 06:00          │
└─────────────────────────────────────────┘
```

#### Daily Data Table Columns
- Ngày (date + dayOfWeek)
- Nhiệt độ (min-max, avg)
- Độ ẩm (%)
- Lá ướt (giờ) - **Quan trọng nhất**
- Mưa (mm + giờ)
- Sương mù (giờ)
- Điểm nguy cơ (score/135)
- Mức độ (tag có màu)

### 3. Loading States

- **Khi load data**: Hiển thị skeleton hoặc spinner
- **Khi chạy phân tích**: Disable button + hiển thị "Đang phân tích..." (5-10s)
- **Khi cập nhật vị trí**: Disable form + hiển thị "Đang lưu..."

### 4. Error Handling

- **Network error**: "Không thể kết nối đến server"
- **API error**: Hiển thị message từ backend
- **Validation error**: Hiển thị lỗi từng field

---

## 🔄 Auto-Refresh (Optional)

Backend tự động cập nhật mỗi ngày lúc 6:00 sáng, nhưng frontend có thể:

1. **Auto-refresh mỗi 5 phút**: Gọi GET `/api/warning` để kiểm tra cập nhật mới
2. **Manual refresh**: Button "Cập nhật ngay" gọi POST `/api/run-now`
3. **Notification**: Hiển thị toast/notification khi có cảnh báo mức "RẤT CAO" hoặc "CAO"

---

## 📱 Mobile Responsive

- **Table**: Scroll ngang hoặc chuyển sang card layout trên mobile
- **Form**: Stack vertical trên mobile
- **Message**: Đảm bảo text wrap đúng với `white-space: pre-wrap`

---

## ✅ Validation Rules

### Update Location Form

| Field | Type | Required | Min | Max | Example |
|-------|------|----------|-----|-----|---------|
| `name` | string | ✅ | - | - | "Ruộng nhà ông Tư" |
| `lat` | number | ✅ | -90 | 90 | 20.4167 |
| `lon` | number | ✅ | -180 | 180 | 106.3667 |

---

## 🧪 Testing

### Test Script
```bash
# Chạy test script có sẵn
./test-rice-blast.sh
```

### Manual Test
```bash
# 1. Lấy vị trí
curl http://localhost:3003/api/location

# 2. Cập nhật vị trí
curl -X POST http://localhost:3003/api/location \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","lat":20.5,"lon":106.5}'

# 3. Lấy cảnh báo
curl http://localhost:3003/api/warning

# 4. Chạy phân tích
curl -X POST http://localhost:3003/api/run-now
```

---

## 🔧 Troubleshooting

### CORS Error
Backend đã cấu hình `CORS_ORIGIN=*` nên không nên có lỗi CORS. Nếu vẫn gặp:
```bash
# Kiểm tra .env backend
CORS_ORIGIN=http://localhost:3000
```

### 404 Not Found
```bash
# Kiểm tra backend đang chạy
curl http://localhost:3003/api/location
```

### Slow Response
API `/api/run-now` có thể mất 5-10 giây vì phải:
- Gọi Open-Meteo API
- Tính toán phân tích
- Lưu database

→ Hiển thị loading state cho user

---

## 📚 Tài Liệu Backend

Để hiểu rõ hơn về logic phân tích, xem:
- `init-scripts/rice-blast-warning.sql` - Database schema
- `src/modules/rice-blast/rice-blast.service.ts` - Logic phân tích
- `test-rice-blast.sh` - Test script

---

## 💡 Tips

1. **Message field**: Sử dụng `white-space: pre-wrap` để giữ nguyên format (có emoji + line breaks)
2. **Timestamp**: Convert ISO string sang format Việt Nam: `new Date(timestamp).toLocaleString('vi-VN')`
3. **LWD Hours**: Đây là chỉ số quan trọng nhất - highlight nếu ≥14 giờ (nguy hiểm)
4. **Risk Score**: Tổng điểm tối đa là 135, ≥100 là cực kỳ nguy hiểm
5. **Peak Days**: Có thể null nếu không có nguy cơ cao

---

**Chúc bạn tích hợp thành công! 🌾**
