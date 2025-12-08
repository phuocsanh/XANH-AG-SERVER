# Hướng dẫn triển khai Frontend cho tính năng Rice Crop mới

Tài liệu này hướng dẫn đội ngũ Frontend cập nhật giao diện và logic để phản ánh các thay đổi trong cơ sở dữ liệu liên quan đến quản lý vụ lúa (`RiceCrop`).

## 1. Tóm tắt thay đổi Backend

Backend đã thực hiện các thay đổi sau trong Entity `RiceCrop` (DB Table `rice_crops`):

1.  **Đổi tên thuộc tính**: `large_labor_days` (số công lớn) đã được đổi tên thành `amount_of_land` (số lượng đất). Kiểu dữ liệu vẫn là `decimal/number`.
2.  **Thêm quan hệ mới**: Thêm cột `area_of_each_plot_of_land_id` để liên kết với bảng mới `area_of_each_plot_of_land` (Danh sách các vùng/lô đất).

## 2. Cập nhật Model/Interface

Cần cập nhật interface `RiceCrop` trong mã nguồn Frontend:

```typescript
// Trước đây
export interface RiceCrop {
  id: number;
  // ...
  large_labor_days: number; // Đã bỏ
  // ...
}

// Cập nhật mới
export interface RiceCrop {
  id: number;
  // ...
  amount_of_land: number; // Thay thế large_labor_days
  
  area_of_each_plot_of_land_id?: number; // Mới thêm (có thể null)
  areaOfEachPlotOfLand?: AreaOfEachPlotOfLand; // Relation object
  // ...
}

// Interface cho bảng AreaOfEachPlotOfLand (nếu cần hiển thị chi tiết)
export interface AreaOfEachPlotOfLand {
  id: number;
  name: string;
  code: string;
  acreage: number;
}
```

## 3. Cập nhật API Payloads

### 3.1. Create Rice Crop (POST `/rice-crops`)

Payload gửi lên server cần thay đổi key json:

```json
{
  "customer_id": 1,
  "season_id": 1,
  "field_name": "Ruộng sau nhà",
  "field_area": 5000,
  
  "amount_of_land": 10,  // <-- Thay đổi key này (trước là large_labor_days)
  
  "area_of_each_plot_of_land_id": 2, // <-- Thêm key này (optional)
  
  "rice_variety": "OM 5451",
  "sowing_date": "2024-11-01"
  // ... các trường khác giữ nguyên
}
```

### 3.2. Update Rice Crop (PATCH `/rice-crops/:id`)

Tương tự, payload update cũng cần dùng key mới:

```json
{
  "amount_of_land": 12.5,
  "area_of_each_plot_of_land_id": 3
}
```

## 4. Thay đổi UI/UX

### 4.1. Form Tạo/Sửa Vụ Lúa

1.  **Đổi Label**: Đổi nhãn trường "Số công lớn" thành **"Số lượng đất"**.
2.  **Bind dữ liệu đúng biến**: Đảm bảo `v-model` hoặc state form bind vào `amount_of_land` thay vì `large_labor_days`.
3.  **Thêm Dropdown chọn Vùng/Lô đất**:
    *   Thêm một Select/Dropdown mới cho trường `area_of_each_plot_of_land_id`.
    *   Label: "Vùng/Lô đất" (hoặc tên phù hợp).
    *   **Lưu ý**: Hiện tại chưa có API để lấy danh sách `AreaOfEachPlotOfLand` (List API). Nếu cần danh sách này để đổ vào dropdown, Backend cần triển khai thêm module `AreaOfEachPlotOfLand` (CRUD).
    *   *Giải pháp tạm thời*: Có thể nhập ID thủ công hoặc Mock data cho đến khi API list sẵn sàng.

### 4.2. Danh sách/Chi tiết vụ lúa

*   Cập nhật hiển thị cột/trường từ "Số công lớn" sang "Số lượng đất".
*   Hiển thị thêm thông tin "Vùng/Lô đất" (tên hoặc mã) nếu `areaOfEachPlotOfLand` có dữ liệu trả về.

## 5. Các vấn đề cần lưu ý (Pending)

*   **API List Area**: Hiện tại Backend mới chỉ tạo Entity và sửa bảng `RiceCrop`. Chưa có Controller/Service cho `AreaOfEachPlotOfLand`. Nếu Frontend cần API để lấy danh sách các vùng đất để hiển thị lên Dropdown, hãy yêu cầu Backend triển khai thêm module này.
