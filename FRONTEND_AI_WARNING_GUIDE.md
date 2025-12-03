# 🤖 Hướng Dẫn Frontend: Tích Hợp AI Cảnh Báo Sâu Bệnh

## 📌 Tổng Quan Thay Đổi

Hệ thống Backend đã được nâng cấp từ **Rule-Based (Công thức tĩnh)** sang **AI-Powered (Google Gemini)**.
Dữ liệu trả về từ API vẫn giữ nguyên cấu trúc JSON để không gây lỗi app, NHƯNG **ý nghĩa và giá trị của các trường đã thay đổi**.

---

## 🔄 1. Thay Đổi Về Dữ Liệu (Data Changes)

### A. Trường `message` (Quan Trọng Nhất)
Trước đây là một câu ngắn gọn. Bây giờ là một bài phân tích chi tiết có cấu trúc.

**Format mới:**
```text
🟠 CẢNH BÁO: CAO                                 <-- Header + Emoji
📍 Đồng Tháp                                     <-- Location

Nguy cơ bệnh đạo ôn đang ở mức CAO...            <-- Summary

⚠️ Thời gian nguy cơ cao: 05/12 - 07/12          <-- Peak Days Alert

🔍 PHÂN TÍCH CHI TIẾT:                           <-- Section 1
Mưa 11.5mm trong 12 giờ liên tục...

💊 KHUYẾN NGHỊ:                                  <-- Section 2
Phun thuốc NGAY trong 24-48 giờ tới...
```

👉 **Frontend Action:** Cần parse chuỗi này để hiển thị đẹp hơn (VD: tách header, bôi đậm tiêu đề, hiển thị khuyến nghị màu xanh/đỏ).

### B. Trường `daily_data`
| Trường | Trước Đây | Bây Giờ (AI) | Frontend Cần Làm |
|--------|-----------|--------------|------------------|
| `riskScore` | Tính bằng công thức (VD: `tempScore + rainScore`) | **Điểm số do AI đánh giá** (0-100) | Dùng số này để vẽ biểu đồ |
| `riskLevel` | Map từ score | **AI đánh giá trực tiếp** | Hiển thị badge màu |
| `breakdown` | `{ tempScore: 30, rainScore: 20... }` | **Tất cả bằng 0** (VD: `{ tempScore: 0... }`) | ⚠️ **ẨN biểu đồ thành phần** nếu có |
| `rainTotal` | Tổng lượng mưa | Chỉ tính khi **xác suất mưa ≥ 50%** | Hiển thị bình thường |

---

## 🎨 2. Hướng Dẫn UI/UX Mới

### 1️⃣ Hiển Thị Message
Đừng chỉ `console.log` hoặc hiển thị text thô. Hãy tách dòng để dễ đọc.

```tsx
// Gợi ý xử lý hiển thị Message
const sections = data.message.split('\n\n');

return (
  <Card>
    {/* 1. Header & Location */}
    <div className="header">
      <Text strong style={{ fontSize: 18 }}>{sections[0]}</Text> {/* 🟠 CẢNH BÁO: CAO */}
      <Text type="secondary">{sections[1]}</Text> {/* 📍 Đồng Tháp */}
    </div>

    {/* 2. Summary */}
    <div className="summary" style={{ margin: '10px 0' }}>
      <Text>{sections[2]}</Text>
    </div>

    {/* 3. Peak Days (Nếu có) */}
    {data.peak_days && (
      <Alert 
        message="Thời gian nguy cơ cao" 
        description={data.peak_days} 
        type="warning" 
        showIcon 
      />
    )}

    <Divider />

    {/* 4. Chi tiết & Khuyến nghị */}
    {sections.slice(3).map(sec => (
      <div key={sec}>
        {sec.includes('PHÂN TÍCH') && <Title level={5}>🔍 Phân Tích</Title>}
        {sec.includes('KHUYẾN NGHỊ') && <Title level={5}>💊 Khuyến Nghị</Title>}
        <Text>{sec.replace(/.*:\n/, '')}</Text>
      </div>
    ))}
  </Card>
)
```

### 2️⃣ Biểu Đồ Nguy Cơ (Risk Chart)
- **Trục X:** Ngày (`date`)
- **Trục Y:** Điểm nguy cơ (`riskScore`) - Max 100
- **Màu sắc:** Dựa theo `riskLevel` của từng ngày.
  - `RẤT CAO` -> Đỏ
  - `CAO` -> Cam
  - `TRUNG BÌNH` -> Vàng
  - `THẤP` -> Xanh

⚠️ **Lưu ý:** Không vẽ biểu đồ stack/breakdown nữa vì các giá trị con (`tempScore`, `humidityScore`...) giờ đều là 0.

---

## 🛠️ 3. API Endpoints (Giữ Nguyên)

Không cần thay đổi code gọi API, chỉ cần trỏ đúng vào các endpoint cũ:

- **Bệnh Đạo Ôn:** `GET /api/ai-rice-blast/warning`
- **Bệnh Cháy Bìa Lá:** `GET /api/ai-bacterial-blight/warning`
- **Rầy Nâu:** `GET /api/ai-brown-plant-hopper/warning`
- **Muỗi Hành:** `GET /api/ai-gall-midge/warning`
- **Sâu Đục Thân:** `GET /api/ai-stem-borer/warning`
- **Bệnh Đốm Vằn:** `GET /api/ai-sheath-blight/warning`
- **Bệnh Đốm Hạt:** `GET /api/ai-grain-discoloration/warning`

---

## 🧪 4. Cách Test Data Mới

Để thấy dữ liệu AI thực tế (thay vì dữ liệu cũ trong cache), Frontend có thể gọi nút **"Phân Tích Ngay"**:

```http
POST /api/ai-[module-name]/run-now
```

Sau đó gọi lại API `GET` để thấy dữ liệu mới nhất.

---

## ✅ Checklist Cho Frontend Dev

- [ ] Update component hiển thị `message` để hỗ trợ format mới (xuống dòng, emoji).
- [ ] Kiểm tra biểu đồ: Ẩn các phần hiển thị `breakdown` scores.
- [ ] Kiểm tra màu sắc badge cảnh báo (`risk_level`).
- [ ] Thêm nút "Chạy Phân Tích Lại" (gọi API `/run-now`) cho Admin/User VIP.
