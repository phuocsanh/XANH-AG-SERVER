# 🌦️ Module Dự Báo Thời Tiết (Weather Forecast)

**Trạng thái**: ✅ HOÀN THÀNH

---

## 🎯 Tổng Quan

Module cung cấp thông tin dự báo thời tiết nông vụ, cảnh báo thiên tai và khuyến nghị canh tác dựa trên thời tiết.

### Chức Năng Chính:
- Lấy dữ liệu thời tiết hiện tại và dự báo.
- Cảnh báo mưa bão, hạn hán, xâm nhập mặn.
- Khuyến nghị lịch gieo sạ, phun thuốc.

---

## 📝 API Endpoints

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| `GET` | `/weather-forecast` | Xem dự báo thời tiết chung |
| `GET` | `/weather-forecast/location` | Dự báo theo vị trí |
| `GET` | `/weather-forecast/warnings` | Các cảnh báo thiên tai |
