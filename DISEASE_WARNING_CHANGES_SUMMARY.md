# 📝 TÓM TẮT THAY ĐỔI - HỆ THỐNG CẢNH BÁO BỆNH LÚA

## 🎯 Mục tiêu
Tách riêng module quản lý vị trí và thêm module cảnh báo bệnh cháy bìa lá do vi khuẩn.

---

## ✨ Các Module Mới

### 1. **LocationModule** (`/src/modules/location/`)
**Mục đích**: Quản lý vị trí ruộng lúa (shared cho tất cả module cảnh báo bệnh)

**Files**:
- `location.module.ts` - Module definition
- `location.service.ts` - Service quản lý CRUD vị trí
- `location.controller.ts` - Controller với 2 endpoints
- `dto/update-location.dto.ts` - DTO validation

**Endpoints**:
- `GET /location` - Lấy vị trí hiện tại
- `POST /location` - Cập nhật vị trí

**Exports**: `LocationService` (để các module khác sử dụng)

---

### 2. **AiBacterialBlightModule** (`/src/modules/ai-bacterial-blight/`)
**Mục đích**: Cảnh báo bệnh cháy bìa lá do vi khuẩn

**Files**:
- `ai-bacterial-blight.module.ts` - Module definition + Cron job
- `ai-bacterial-blight.service.ts` - Service phân tích bệnh
- `ai-bacterial-blight.controller.ts` - Controller với 2 endpoints

**Entity mới**:
- `/src/entities/bacterial-blight-warning.entity.ts`

**Endpoints**:
- `GET /ai-bacterial-blight/warning` - Lấy cảnh báo mới nhất
- `POST /ai-bacterial-blight/run-now` - Chạy phân tích thủ công

**Đặc điểm**:
- Sử dụng `LocationService` từ `LocationModule`
- Cron job chạy tự động 6:00 sáng hàng ngày
- Chạy phân tích khi server khởi động

**Công thức tính điểm** (khác với đạo ôn):
- Nhiệt độ (0-30): Tối ưu 25-34°C (cao hơn đạo ôn)
- Mưa (0-40): Quan trọng hơn, tính cả tổng mưa 3 ngày
- Gió (0-25): Yếu tố MỚI (vi khuẩn lây qua gió)
- Độ ẩm (0-20): Ngưỡng thấp hơn (≥85%)
- Ngập úng (0-20): Yếu tố MỚI (tổng mưa 3 ngày)

---

## 🔄 Module Được Refactor

### **AiRiceBlastModule** (`/src/modules/ai-rice-blast/`)

**Thay đổi**:
- ❌ Xóa logic quản lý vị trí (getLocation, updateLocation)
- ❌ Xóa dependency `Location` entity
- ❌ Xóa `dto/update-location.dto.ts`
- ✅ Import `LocationModule`
- ✅ Inject `LocationService` vào constructor
- ✅ Sử dụng `locationService.getLocation()` thay vì `this.getLocation()`

**Endpoints bị XÓA**:
- ~~`GET /ai-rice-blast/location`~~
- ~~`POST /ai-rice-blast/location`~~

**Endpoints GIỮ NGUYÊN**:
- `GET /ai-rice-blast/warning`
- `POST /ai-rice-blast/run-now`

---

## 📊 So sánh 2 Bệnh

| Đặc điểm | Bệnh Đạo Ôn | Bệnh Cháy Bìa Lá |
|----------|--------------|------------------|
| **Nguyên nhân** | Nấm | Vi khuẩn |
| **Nhiệt độ tối ưu** | 20-28°C | 25-34°C |
| **Độ ẩm** | ≥90% | ≥85% |
| **Yếu tố chính** | Lá ướt (LWD) | Mưa + Gió |
| **Điểm lá ướt** | 0-50 | - |
| **Điểm mưa** | 0-15 | 0-40 |
| **Điểm gió** | - | 0-25 |
| **Điểm ngập úng** | - | 0-20 |
| **Sương mù** | Quan trọng | Ít quan trọng |

---

## 🗂️ Cấu trúc Thư mục Mới

```
src/
├── entities/
│   ├── location.entity.ts (đã có)
│   ├── rice-blast-warning.entity.ts (đã có)
│   └── bacterial-blight-warning.entity.ts (MỚI)
│
├── modules/
│   ├── location/ (MỚI)
│   │   ├── location.module.ts
│   │   ├── location.service.ts
│   │   ├── location.controller.ts
│   │   └── dto/
│   │       └── update-location.dto.ts
│   │
│   ├── ai-rice-blast/ (REFACTORED)
│   │   ├── ai-rice-blast.module.ts (updated)
│   │   ├── ai-rice-blast.service.ts (updated)
│   │   └── ai-rice-blast.controller.ts (updated)
│   │
│   └── ai-bacterial-blight/ (MỚI)
│       ├── ai-bacterial-blight.module.ts
│       ├── ai-bacterial-blight.service.ts
│       └── ai-bacterial-blight.controller.ts
│
└── app.module.ts (updated)
```

---

## 🔑 Permissions

Tất cả endpoints sử dụng 2 permissions hiện có:
- `RICE_BLAST_VIEW` - Xem cảnh báo và vị trí
- `RICE_BLAST_MANAGE` - Cập nhật vị trí và chạy phân tích

**Lưu ý**: Có thể cần tạo permissions riêng cho bacterial blight trong tương lai.

---

## 🚀 Migration Database

Cần tạo bảng mới cho `bacterial_blight_warnings`:

```sql
CREATE TABLE bacterial_blight_warnings (
  id INTEGER PRIMARY KEY,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  risk_level VARCHAR(50) NOT NULL,
  probability INTEGER NOT NULL,
  message TEXT NOT NULL,
  peak_days VARCHAR(100),
  daily_data JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## ⚙️ Cron Jobs

Cả 2 module đều có cron job chạy **6:00 sáng** hàng ngày:
- `rice-blast-daily-analysis`
- `bacterial-blight-daily-analysis`

---

## 📡 API Changes Summary

### ❌ Removed Endpoints:
```
GET  /ai-rice-blast/location
POST /ai-rice-blast/location
```

### ✅ New Endpoints:
```
GET  /location
POST /location
GET  /ai-bacterial-blight/warning
POST /ai-bacterial-blight/run-now
```

### 🔄 Unchanged Endpoints:
```
GET  /ai-rice-blast/warning
POST /ai-rice-blast/run-now
```

---

## 🧪 Testing Checklist

### Backend:
- [ ] Test `GET /location`
- [ ] Test `POST /location` với validation
- [ ] Test `GET /ai-rice-blast/warning`
- [ ] Test `POST /ai-rice-blast/run-now`
- [ ] Test `GET /ai-bacterial-blight/warning`
- [ ] Test `POST /ai-bacterial-blight/run-now`
- [ ] Test cron jobs (mock thời gian)
- [ ] Test permissions (VIEW vs MANAGE)
- [ ] Test khi không có location
- [ ] Test khi API thời tiết fail

### Frontend:
- [ ] Migrate từ `/ai-rice-blast/location` sang `/location`
- [ ] Tạo UI cho bacterial blight warning
- [ ] Test auto-refresh
- [ ] Test notifications
- [ ] Test responsive design

---

## 📚 Tài liệu Liên quan

- `FRONTEND_DISEASE_WARNING_INTEGRATION.md` - Hướng dẫn tích hợp frontend chi tiết
- `README.md` - Tổng quan dự án

---

## 🎓 Kiến thức Nông nghiệp

### Bệnh Đạo Ôn (Rice Blast)
- **Tác nhân**: Nấm *Pyricularia oryzae*
- **Triệu chứng**: Vết bệnh hình thoi màu nâu trên lá
- **Điều kiện**: Sương mù, lá ướt lâu, nhiệt độ mát
- **Phòng trừ**: Tricyclazole, Tebuconazole

### Bệnh Cháy Bìa Lá (Bacterial Leaf Blight)
- **Tác nhân**: Vi khuẩn *Xanthomonas oryzae*
- **Triệu chứng**: Lá vàng khô từ mép lá
- **Điều kiện**: Mưa lớn, gió mạnh, ngập úng, nhiệt độ cao
- **Phòng trừ**: Streptomycin, Copper hydroxide

---

## 👥 Contributors

- Backend Team
- Agronomy Consultant

**Ngày hoàn thành**: 29/11/2025
