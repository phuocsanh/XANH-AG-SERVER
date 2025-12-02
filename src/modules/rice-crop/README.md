# Rice Crop Management Module

Module quản lý vụ lúa của nông dân, theo dõi từ khi gieo trồng đến thu hoạch.

## Chức năng

- ✅ Tạo và quản lý thông tin vụ lúa (ruộng, giống, thời gian)
- ✅ Theo dõi giai đoạn sinh trưởng (mạ → đẻ nhánh → làm đòng → trổ → chín → thu hoạch)
- ✅ Cập nhật trạng thái vụ lúa (active, harvested, failed)
- ✅ Ghi nhận kết quả thu hoạch (năng suất, chất lượng)
- ✅ Thống kê vụ lúa theo khách hàng

## API Endpoints

### 1. Tạo vụ lúa mới
```http
POST /rice-crops
Authorization: Bearer <token>
Content-Type: application/json

{
  "customer_id": 1,
  "season_id": 1,
  "field_name": "Ruộng sau nhà",
  "field_area": 5000,
  "location": "Xã Tân Hiệp, An Giang",
  "rice_variety": "OM 5451",
  "seed_source": "Trung tâm giống An Giang",
  "sowing_date": "2024-11-01",
  "transplanting_date": "2024-11-20",
  "expected_harvest_date": "2025-02-15",
  "notes": "Vụ lúa đông xuân 2024"
}
```

### 2. Lấy danh sách vụ lúa
```http
GET /rice-crops?customer_id=1&season_id=1&status=active
Authorization: Bearer <token>
```

**Query Parameters:**
- `customer_id` (optional): Lọc theo khách hàng
- `season_id` (optional): Lọc theo mùa vụ
- `status` (optional): Lọc theo trạng thái (active, harvested, failed)
- `growth_stage` (optional): Lọc theo giai đoạn sinh trưởng

### 3. Lấy chi tiết vụ lúa
```http
GET /rice-crops/:id
Authorization: Bearer <token>
```

### 4. Cập nhật thông tin vụ lúa
```http
PATCH /rice-crops/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "field_name": "Ruộng sau nhà (mở rộng)",
  "field_area": 6000,
  "notes": "Đã mở rộng thêm 1000m²"
}
```

### 5. Cập nhật giai đoạn sinh trưởng
```http
PATCH /rice-crops/:id/growth-stage
Authorization: Bearer <token>
Content-Type: application/json

{
  "growth_stage": "tillering",
  "notes": "Lúa đang đẻ nhánh tốt"
}
```

**Giai đoạn sinh trưởng:**
- `seedling` - Giai đoạn mạ
- `tillering` - Đẻ nhánh
- `panicle` - Làm đòng
- `heading` - Trổ bông
- `ripening` - Chín
- `harvested` - Đã thu hoạch

### 6. Cập nhật trạng thái vụ lúa
```http
PATCH /rice-crops/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "harvested",
  "notes": "Đã thu hoạch xong"
}
```

**Trạng thái:**
- `active` - Đang canh tác
- `harvested` - Đã thu hoạch
- `failed` - Thất bại

### 7. Xóa vụ lúa
```http
DELETE /rice-crops/:id
Authorization: Bearer <token>
```

### 8. Thống kê vụ lúa theo khách hàng
```http
GET /rice-crops/customer/:customerId/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total": 10,
  "active": 5,
  "harvested": 4,
  "failed": 1,
  "totalArea": 50000,
  "totalYield": 30000
}
```

## Database Schema

```sql
CREATE TABLE rice_crops (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  season_id INT NOT NULL REFERENCES seasons(id),
  field_name VARCHAR(100) NOT NULL,
  field_area DECIMAL(10, 2) NOT NULL,
  location TEXT,
  rice_variety VARCHAR(100) NOT NULL,
  seed_source VARCHAR(255),
  sowing_date DATE,
  transplanting_date DATE,
  expected_harvest_date DATE,
  actual_harvest_date DATE,
  growth_stage VARCHAR(50) NOT NULL DEFAULT 'seedling',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  yield_amount DECIMAL(10, 2),
  quality_grade VARCHAR(10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Permissions

Module này yêu cầu các quyền sau:
- `rice_crop:create` - Tạo vụ lúa mới
- `rice_crop:read` - Xem danh sách và chi tiết vụ lúa
- `rice_crop:update` - Cập nhật thông tin vụ lúa
- `rice_crop:delete` - Xóa vụ lúa

## Business Logic

### Tự động cập nhật trạng thái
- Khi cập nhật `growth_stage` sang `harvested` → Tự động set `status` = `harvested` và `actual_harvest_date` = ngày hiện tại
- Khi cập nhật `status` sang `harvested` → Tự động set `growth_stage` = `harvested` và `actual_harvest_date` = ngày hiện tại (nếu chưa có)

### Validation
- `field_area` phải > 0
- `customer_id` và `season_id` phải tồn tại trong database
- Ngày cấy phải sau ngày gieo mạ
- Ngày thu hoạch phải sau ngày cấy

## Tích hợp với Module khác

### Liên kết với Customer
- Mỗi vụ lúa thuộc về 1 khách hàng (nông dân)
- Có thể lấy tất cả vụ lúa của 1 khách hàng

### Liên kết với Season
- Mỗi vụ lúa thuộc về 1 mùa vụ (VD: Đông Xuân 2024)
- Có thể lấy tất cả vụ lúa trong 1 mùa vụ

### Sẽ liên kết với (Phase 2-3)
- **Farming Schedule** - Lịch canh tác của vụ lúa
- **Application Records** - Nhật ký phun thuốc/bón phân
- **Growth Tracking** - Theo dõi sinh trưởng chi tiết
- **Cost Items** - Chi phí đầu vào
- **Harvest Records** - Kết quả thu hoạch

## Testing

```bash
# Unit tests
npm run test -- rice-crop.service.spec.ts

# E2E tests
npm run test:e2e -- rice-crop.e2e-spec.ts
```

## Migration

Chạy migration để tạo bảng `rice_crops`:

```bash
npm run migration:run
```

Xem file migration tại: `src/migrations/XXXXXX-create-rice-crops-table.ts`
