# Hướng Dẫn Tích Hợp Frontend - Hệ Thống Cảnh Báo Sâu Bệnh Mới

Tài liệu này hướng dẫn Frontend tích hợp 5 module cảnh báo mới (bao gồm 3 module mới hoàn toàn và 2 module tách ra từ module cũ).

## 1. Danh sách API Endpoint Mới

Frontend cần gọi các API sau để lấy dữ liệu cảnh báo. Tất cả đều là method `GET`.

| Tên Module | Endpoint Lấy Dữ Liệu | Endpoint Chạy Phân Tích (Manual) |
| :--- | :--- | :--- |
| **Sâu Đục Thân** (Mới tách) | `/ai-stem-borer/warning` | `/ai-stem-borer/run-now` |
| **Muỗi Hành** (Mới tách) | `/ai-gall-midge/warning` | `/ai-gall-midge/run-now` |
| **Rầy Nâu** (Mới) | `/ai-brown-plant-hopper/warning` | `/ai-brown-plant-hopper/run-now` |
| **Bệnh Khô Vằn** (Mới) | `/ai-sheath-blight/warning` | `/ai-sheath-blight/run-now` |
| **Bệnh Lem Lép Hạt** (Mới) | `/ai-grain-discoloration/warning` | `/ai-grain-discoloration/run-now` |

> **Lưu ý:** Module cũ `/ai-pest-warning` đã bị XÓA. Vui lòng loại bỏ code gọi API này.

---

## 2. Cấu Trúc Dữ Liệu Trả Về (Response Structure)

Tất cả các API đều trả về cấu trúc JSON tương tự nhau, giúp Frontend dễ dàng tái sử dụng Component hiển thị.

### Ví dụ Response (Sâu Đục Thân):
```json
{
  "id": 1,
  "generated_at": "2024-11-30T13:00:00.000Z",
  "risk_level": "CAO", // Enum: AN TOÀN | TRUNG BÌNH | CAO | ĐANG CHỜ CẬP NHẬT
  "message": "🐛 SÂU ĐỤC THÂN: NGUY CƠ CAO\n⚠️ Thời tiết ấm ẩm...",
  "daily_data": [
    {
      "date": "30/11",
      "dayOfWeek": "CN",
      "riskLevel": "CAO",
      "riskScore": 85,
      "tempAvg": 28.5,
      "humidityAvg": 82,
      // Các trường đặc thù của từng module (xem chi tiết bên dưới)
      "sunHours": 5.2 
    },
    ...
  ]
}
```

### Các trường đặc thù trong `daily_data`:

1.  **Sâu Đục Thân (`ai-stem-borer`)**:
    *   `sunHours`: Số giờ nắng (quan trọng cho bướm vũ hóa).
    *   `tempAvg`: Nhiệt độ trung bình.

2.  **Muỗi Hành (`ai-gall-midge`)**:
    *   `cloudAvg`: Độ che phủ mây (%).
    *   `humidityAvg`: Độ ẩm trung bình.

3.  **Rầy Nâu (`ai-brown-plant-hopper`)**:
    *   `windSpeedAvg`: Tốc độ gió (km/h) - quan trọng cho rầy di trú.
    *   `rainTotal`: Lượng mưa (mm).

4.  **Bệnh Khô Vằn (`ai-sheath-blight`)**:
    *   `tempAvg`: Nhiệt độ (cần nóng 28-32°C).
    *   `humidityAvg`: Độ ẩm.

5.  **Bệnh Lem Lép Hạt (`ai-grain-discoloration`)**:
    *   `rainTotal`: Lượng mưa (quan trọng nhất).
    *   `windSpeedAvg`: Tốc độ gió.

---

## 3. Hướng Dẫn Hiển Thị (UI Recommendation)

Nên sử dụng **Tab Layout** hoặc **Grid Layout** để hiển thị các thẻ cảnh báo (Warning Card).

### Gợi ý Component `DiseaseWarningCard`:
Component này nhận props là data từ API và hiển thị:
*   **Header:** Tên bệnh + Badge màu mức độ nguy cơ (Đỏ/Vàng/Xanh).
*   **Body:**
    *   Hiển thị `message` (có xuống dòng).
    *   Biểu đồ nhỏ (Sparkline) hoặc List 7 ngày (`daily_data`) để user thấy xu hướng.
*   **Footer:** Nút "Phân tích ngay" (gọi API `/run-now`).

### Mapping Màu Sắc (Color Mapping):
*   `CAO`: **#ff4d4f** (Đỏ) - Icon: 🚨
*   `TRUNG BÌNH`: **#faad14** (Vàng) - Icon: ⚠️
*   `THẤP` / `AN TOÀN`: **#52c41a** (Xanh) - Icon: ✅
*   `ĐANG CHỜ CẬP NHẬT`: **#d9d9d9** (Xám) - Icon: ⏳

---

## 4. Các Bước Cần Làm Ở Frontend (Checklist)

1.  [ ] **Xóa bỏ** code liên quan đến `AiPestWarningService` cũ.
2.  [ ] **Tạo mới** 5 Service/Hook tương ứng (ví dụ: `useStemBorerQuery`, `useBrownPlantHopperQuery`...).
3.  [ ] **Cập nhật UI Dashboard:** Thêm 5 Tab hoặc 5 Card mới vào màn hình Cảnh báo dịch hại.
4.  [ ] **Kiểm tra hiển thị:** Đảm bảo text `message` hiển thị đúng định dạng xuống dòng (`white-space: pre-wrap`).

---
**Hỗ trợ:** Nếu cần thêm dữ liệu gì, vui lòng liên hệ Backend Team (Antigravity).
