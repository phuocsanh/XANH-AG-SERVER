# Hướng Dẫn Thêm Trường "Số Công Lớn" Vào Vụ Lúa

## Tổng Quan
Đã thêm trường `large_labor_days` (Số công lớn - diện tích tính theo công) vào module quản lý vụ lúa.

## Các Thay Đổi Đã Thực Hiện

### 1. Entity (`src/entities/rice-crop.entity.ts`)
- ✅ Đã thêm trường `large_labor_days` với kiểu `decimal(10,2)`
- ✅ Trường này là **BẮT BUỘC** (NOT NULL, default = 0)
- ✅ Mô tả: "Số công lớn (diện tích tính theo công)"

### 2. DTO (`src/modules/rice-crop/rice-crop.dto.ts`)
- ✅ Đã thêm validation cho `CreateRiceCropDto` (BẮT BUỘC)
- ✅ Đã thêm validation cho `UpdateRiceCropDto` (optional khi update)
- ✅ Validation: Phải là số, >= 0, không được để trống khi tạo mới

### 3. Migration (`src/migrations/1733151000000-AddLargeLaborDaysToRiceCrops.ts`)
- ✅ Đã tạo migration file để thêm cột vào database
- ✅ Migration có thể rollback (down method)
- ✅ **Đã chạy thành công trên database**

### 4. Kiểm Tra Code
- ✅ TypeScript: Không có lỗi
- ✅ ESLint: Không có lỗi
- ✅ Import đã được dọn dẹp (xóa OneToMany không sử dụng)

## Cách Chạy Migration

### Phương Pháp 1: Sử Dụng TypeORM Migration (Khuyến Nghị)
```bash
npm run migration:run
```

**Lưu ý**: Nếu gặp lỗi với các migration cũ (cột đã tồn tại), các migration đó đã được sửa để kiểm tra trước khi thêm cột.

### Phương Pháp 2: Chạy Script SQL Trực Tiếp
Nếu migration tự động gặp vấn đề, bạn có thể chạy script SQL thủ công:

```bash
# Sử dụng psql
psql $DATABASE_URL -f add-large-labor-days.sql

# Hoặc nếu bạn có thông tin kết nối riêng
psql -h localhost -U your_user -d your_database -f add-large-labor-days.sql
```

Script SQL (`add-large-labor-days.sql`) sẽ:
- Kiểm tra xem cột đã tồn tại chưa
- Chỉ thêm cột nếu chưa tồn tại
- Hiển thị thông báo kết quả

## Sử Dụng API

### Tạo Vụ Lúa Mới (POST /rice-crops)
```json
{
  "customer_id": 1,
  "season_id": 1,
  "field_name": "Ruộng sau nhà",
  "field_area": 5000,
  "large_labor_days": 10,  // ← Trường mới (BẮT BUỘC)
  "rice_variety": "OM 5451",
  "location": "Xã Tân Hiệp, An Giang"
}
```

**Lưu ý**: Trường `large_labor_days` là **BẮT BUỘC** khi tạo vụ lúa mới. Nếu không cung cấp, API sẽ trả về lỗi validation.

### Cập Nhật Vụ Lúa (PATCH /rice-crops/:id)
```json
{
  "large_labor_days": 15  // Cập nhật số công lớn (optional khi update)
}
```

### Response Mẫu
```json
{
  "id": 1,
  "customer_id": 1,
  "season_id": 1,
  "field_name": "Ruộng sau nhà",
  "field_area": 5000,
  "large_labor_days": 10,  // ← Trường mới
  "location": "Xã Tân Hiệp, An Giang",
  "rice_variety": "OM 5451",
  "growth_stage": "seedling",
  "status": "active",
  "created_at": "2024-12-02T14:00:00.000Z",
  "updated_at": "2024-12-02T14:00:00.000Z"
}
```

## Validation Rules

- **Kiểu dữ liệu**: Number (decimal)
- **Bắt buộc**: **CÓ** (khi tạo mới), Không (khi cập nhật)
- **Giá trị tối thiểu**: 0
- **Giá trị mặc định**: 0 (nếu không có dữ liệu cũ)
- **Độ chính xác**: 10 chữ số, 2 chữ số thập phân
- **Ví dụ giá trị hợp lệ**: 0, 10, 15.5, 100.25
- **Lỗi validation**: "Số công lớn không được để trống" nếu không cung cấp khi tạo mới

## Kiểm Tra Kết Quả

Sau khi chạy migration, bạn có thể kiểm tra bằng cách:

1. **Kiểm tra cấu trúc bảng**:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'rice_crops' 
AND column_name = 'large_labor_days';
```

2. **Test API**:
```bash
# Tạo vụ lúa mới với số công lớn
curl -X POST http://localhost:3000/rice-crops \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customer_id": 1,
    "season_id": 1,
    "field_name": "Test Field",
    "field_area": 1000,
    "large_labor_days": 5,
    "rice_variety": "OM 5451"
  }'
```

## Rollback (Nếu Cần)

Nếu cần hoàn tác thay đổi:

```bash
npm run migration:revert
```

Hoặc chạy SQL thủ công:
```sql
ALTER TABLE rice_crops DROP COLUMN IF EXISTS large_labor_days;
```

## Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra log của migration: `npm run migration:run`
2. Kiểm tra kết nối database trong file `.env`
3. Đảm bảo bạn có quyền ALTER TABLE trên database
4. Liên hệ team dev nếu cần hỗ trợ thêm
