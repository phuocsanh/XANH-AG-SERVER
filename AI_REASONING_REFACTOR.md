# 🤖 NÂNG CẤP HỆ THỐNG CẢNH BÁO SÂU BỆNH BẰNG AI

## Tổng Quan

Chúng ta đã chuyển đổi toàn bộ **7 module cảnh báo sâu bệnh** từ hệ thống **Rule-Based** (if-else cứng nhắc) sang **AI-Powered** (sử dụng Google Gemini để suy luận thông minh).

---

## 🎯 Vấn Đề Đã Giải Quyết

### Trước Đây (Rule-Based):
❌ **Tính mưa không chính xác**: Đếm tất cả giờ có `precipitation > 0`, kể cả khi xác suất mưa chỉ 10-20%  
❌ **Logic cứng nhắc**: Không thể tự điều chỉnh khi có thông tin mới  
❌ **Thiếu ngữ cảnh**: Chỉ xét từng yếu tố riêng lẻ, không nhìn thấy "bức tranh tổng thể"  
❌ **Khó bảo trì**: Muốn thay đổi logic phải sửa code phức tạp  

### Bây Giờ (AI-Powered):
✅ **Tính mưa thông minh**: Chỉ tính khi `precipitation_probability >= 50%` VÀ `precipitation > 0.1mm`  
✅ **AI suy luận**: Gemini tự phân tích dựa trên kiến thức nông nghiệp sâu rộng  
✅ **Nhìn tổng thể**: AI hiểu được mối liên hệ giữa các yếu tố (VD: mưa dầm 2 ngày liên tiếp → nguy hiểm hơn mưa rào 1 ngày)  
✅ **Dễ điều chỉnh**: Chỉ cần sửa câu Prompt tiếng Việt, không cần sửa code  

---

## 📦 Các Module Đã Nâng Cấp

| STT | Module | Bệnh/Sâu | Trạng Thái |
|-----|--------|-----------|------------|
| 1 | `ai-rice-blast` | Bệnh Đạo Ôn | ✅ Hoàn thành |
| 2 | `ai-bacterial-blight` | Bệnh Cháy Bìa Lá | ✅ Hoàn thành |
| 3 | `ai-brown-plant-hopper` | Rầy Nâu | ✅ Hoàn thành |
| 4 | `ai-gall-midge` | Muỗi Hành | ✅ Hoàn thành |
| 5 | `ai-stem-borer` | Sâu Đục Thân | ✅ Hoàn thành |
| 6 | `ai-sheath-blight` | Bệnh Đốm Vằn Lá | ✅ Hoàn thành |
| 7 | `ai-grain-discoloration` | Bệnh Đốm Hạt | ✅ Hoàn thành |

---

## 🏗️ Kiến Trúc Mới

### 1. **AiReasoningService** (Core AI Engine)
📁 `src/modules/ai-reasoning/ai-reasoning.service.ts`

**Chức năng:**
- Nhận dữ liệu thời tiết thô từ Open-Meteo
- Gửi Prompt cho Google Gemini với context chuyên gia nông nghiệp
- Trả về kết quả phân tích chuẩn JSON

**Input:**
```typescript
{
  diseaseName: "Bệnh Đạo Ôn (Rice Blast)",
  locationName: "Đồng Tháp",
  weatherData: { hourly: {...} }, // 7 ngày dự báo
  additionalContext: "Bệnh phát triển mạnh khi..."
}
```

**Output:**
```typescript
{
  risk_level: "CAO" | "TRUNG BÌNH" | "THẤP" | "RẤT CAO",
  risk_score: 85, // 0-100
  peak_days: "05/12 - 07/12",
  summary: "Tóm tắt tình hình...",
  detailed_analysis: "Phân tích chi tiết...",
  recommendations: "Khuyến nghị hành động...",
  daily_risks: [
    { date: "2025-12-05", risk_score: 90, risk_level: "CAO", main_factors: ["Mưa lớn", "Độ ẩm cao"] }
  ]
}
```

### 2. **Cải Tiến Logic Tính Mưa**

**Trước:**
```typescript
const rainHours = rains.filter(r => r > 0).length; // ❌ Sai lầm!
```

**Sau:**
```typescript
let rainTotal = 0;
let rainHours = 0;
for (let i = 0; i < 24; i++) {
  if ((rainProbs[i] ?? 0) >= 50 && (rains[i] ?? 0) > 0.1) {
    rainTotal += rains[i] ?? 0;
    rainHours++;
  }
}
```

**Lý do:** Chỉ tính là "có mưa" khi xác suất >= 50% để tránh "dương tính giả".

### 3. **Quy Trình Xử Lý Mới**

```
1. Lấy dữ liệu thời tiết từ Open-Meteo
   ↓
2. Tính toán thống kê cơ bản (temp, humidity, rain...)
   ↓
3. Gọi AiReasoningService.analyzeDiseaseRisk()
   ↓
4. Gemini phân tích và trả về kết quả JSON
   ↓
5. Merge kết quả AI vào dữ liệu ngày
   ↓
6. Tạo tin nhắn cảnh báo từ AI
   ↓
7. Lưu vào database
```

---

## 🧪 Cách Test

### Bước 1: Restart Server
```bash
cd /Users/phuocsanh/My-Document/My-Tech/Xanh-AG-Source/XANH-AG-SERVER
npm run start:dev
```

### Bước 2: Test API Endpoint
```bash
# Test Bệnh Đạo Ôn
curl http://localhost:3000/api/ai-rice-blast/run-now

# Test Bệnh Cháy Bìa Lá
curl http://localhost:3000/api/ai-bacterial-blight/run-now

# Test Rầy Nâu
curl http://localhost:3000/api/ai-brown-plant-hopper/run-now
```

### Bước 3: Kiểm Tra Kết Quả
Xem response JSON, chú ý:
- `risk_level`: Có hợp lý không?
- `detailed_analysis`: AI có giải thích rõ ràng không?
- `recommendations`: Lời khuyên có cụ thể không?

### Bước 4: So Sánh Với Dữ Liệu Thực Tế
- Xem dự báo thời tiết thực tế tại Đồng Tháp
- Kiểm tra xem AI có đánh giá đúng không

---

## 📊 Ví Dụ Kết Quả AI

### Input (Dữ Liệu Thời Tiết):
```json
{
  "date": "2025-12-03",
  "temp_avg": 27.6,
  "humidity_avg": 82.5,
  "rain_total_mm": 11.5,
  "rain_hours": 12,
  "max_rain_prob": 90
}
```

### Output (Phân Tích AI):
```json
{
  "risk_level": "CAO",
  "risk_score": 85,
  "summary": "Nguy cơ bệnh đạo ôn đang ở mức CAO do mưa kéo dài 12 giờ kết hợp với độ ẩm 82.5%. Điều kiện này rất thuận lợi cho bào tử nấm phát triển.",
  "detailed_analysis": "Mưa 11.5mm trong 12 giờ liên tục (không phải mưa rào) làm lá lúa ướt kéo dài, tạo môi trường lý tưởng cho nấm Pyricularia oryzae xâm nhập. Nhiệt độ 27.6°C nằm trong khoảng tối ưu 25-30°C cho sự phát triển của bệnh.",
  "recommendations": "Phun thuốc NGAY trong 24-48 giờ tới. Sử dụng Tricyclazole hoặc Azoxystrobin. Thời điểm phun tốt nhất: Chiều mát 16:00-18:00 khi lá đã khô sương."
}
```

---

## ⚠️ Lưu Ý Quan Trọng

### 1. **Chi Phí API**
- Mỗi lần phân tích gọi Gemini API (tốn token)
- Với Gemini Flash: ~$0.00001/request (rất rẻ)
- Ước tính: 7 module x 1 lần/ngày = ~$0.0001/ngày = $3/năm

### 2. **Độ Trễ**
- Gemini trả lời mất ~2-3 giây
- Chấp nhận được vì đây là job chạy ngầm (cron daily)

### 3. **Fallback Mechanism**
- Nếu Gemini lỗi → Trả về kết quả mặc định "TRUNG BÌNH"
- Hệ thống không bao giờ crash

### 4. **Cấu Hình Gemini**
Đảm bảo file `.env` có:
```env
GOOGLE_AI_API_KEY=your_api_key_here
GOOGLE_AI_MODEL=gemini-1.5-flash
```

---

## 🚀 Kế Hoạch Tiếp Theo

- [x] Hoàn thành refactor 7 module (✅ DONE!)
- [ ] **Test toàn bộ 7 module** (Bước tiếp theo quan trọng nhất!)
- [ ] Thu thập feedback từ nông dân thực tế
- [ ] Fine-tune Prompt để cải thiện độ chính xác
- [ ] Thêm tính năng "Học từ dữ liệu quá khứ" (Machine Learning)

---

## 📞 Hỗ Trợ

Nếu gặp lỗi, kiểm tra:
1. `GOOGLE_AI_API_KEY` có đúng không?
2. Server có kết nối internet không?
3. Xem log: `npm run start:dev` để debug

**Chúc may mắn! 🌾🤖**
