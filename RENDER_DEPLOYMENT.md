# ==========================================
# RENDER DEPLOYMENT GUIDE
# ==========================================
# Hướng dẫn deploy lên Render.com

## Bước 1: Chuẩn bị Database (Supabase)

1. Đăng nhập vào Supabase Dashboard
2. Vào Project Settings -> Database -> Connection String
3. Copy "URI" connection string (Session mode - port 5432)
4. Thay [YOUR-PASSWORD] bằng password thực tế

## Bước 2: Tạo Web Service trên Render

1. Đăng nhập vào Render.com
2. Click "New +" -> "Web Service"
3. Connect repository của bạn
4. Điền thông tin:
   - **Name**: xanh-ag-server (hoặc tên bạn muốn)
   - **Region**: Singapore (gần nhất với Supabase ap-south-1)
   - **Branch**: main (hoặc branch bạn muốn deploy)
   - **Runtime**: Node
   - **Build Command**: 
     ```
     npm install && npm run build
     ```
   - **Start Command**: 
     ```
     node dist/main.js
     ```

## Bước 3: Cấu hình Environment Variables

Vào tab "Environment" và thêm các biến sau:

### Required (Bắt buộc)
```
NODE_ENV=production
DATABASE_URL=postgresql://postgres.xxx:password@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
JWT_SECRET=<generate-strong-key>
JWT_REFRESH_SECRET=<generate-strong-key>
```

### Optional (Tùy chọn)
```
PORT=3003
JWT_EXPIRES_IN=1d
CORS_ORIGIN=https://yourdomain.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GOOGLE_AI_API_KEY=your_google_ai_key
BRAVE_SEARCH_API_KEY=your_brave_key
LOG_LEVEL=error
```

### Generate Strong JWT Secrets
Chạy lệnh sau để tạo key mạnh:
```bash
openssl rand -base64 64
```

## Bước 4: Deploy

1. Click "Create Web Service"
2. Render sẽ tự động build và deploy
3. Đợi khoảng 3-5 phút
4. Kiểm tra logs để đảm bảo không có lỗi

## Bước 5: Kiểm tra

1. Truy cập URL Render cung cấp (vd: https://xanh-ag-server.onrender.com)
2. Kiểm tra API docs tại: https://xanh-ag-server.onrender.com/api
3. Test một endpoint đơn giản

## Lưu ý quan trọng

### Free Tier Limitations
- ⏰ Server sẽ "ngủ" sau 15 phút không hoạt động
- 🐌 Cold start mất 30-60 giây khi wake up
- 💾 RAM: 512MB (đủ cho app này)
- 🔄 Build time: Không giới hạn (nhưng nên < 15 phút)

### Bảo mật
- ✅ Đã bật SSL cho Supabase connection
- ✅ Đã tắt synchronize trong production (dùng migrations)
- ✅ Đã giới hạn CORS theo domain cụ thể
- ✅ Đã dùng non-root user trong Docker
- ⚠️ Nhớ set JWT_SECRET mạnh!

### Monitoring
- Xem logs realtime trên Render Dashboard
- Set up health check endpoint nếu cần
- Theo dõi database usage trên Supabase

### Troubleshooting

**Lỗi kết nối database:**
- Kiểm tra DATABASE_URL đúng format
- Đảm bảo password không có ký tự đặc biệt cần encode
- Kiểm tra Supabase project có đang active

**Lỗi build:**
- Kiểm tra Node version (cần 20+)
- Xem build logs chi tiết
- Đảm bảo package.json có đầy đủ dependencies

**App crash sau khi start:**
- Xem logs để tìm lỗi cụ thể
- Kiểm tra các biến môi trường bắt buộc
- Test local trước với NODE_ENV=production

## Nâng cấp lên Paid Plan (Khuyến nghị cho Production)

Nếu app của bạn cần:
- ⚡ Không bị sleep (always-on)
- 🚀 Nhiều RAM hơn (1GB+)
- 🔒 Custom domain với SSL
- 📊 Better monitoring

Thì nên nâng cấp lên plan trả phí ($7/tháng)
