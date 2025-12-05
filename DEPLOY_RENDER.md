# 🚀 Deploy lên Render với Docker

## Bước 1: Chuẩn Bị

### 1.1. Generate JWT Secrets
```bash
./generate-jwt-secrets.sh
```
Lưu lại 2 secrets: `JWT_SECRET` và `JWT_REFRESH_SECRET`

### 1.2. Push Code lên GitHub
```bash
git add .
git commit -m "Production ready"
git push origin main
```

---

## Bước 2: Tạo Web Service

1. Vào https://render.com → Sign up/Login
2. Dashboard → **New** → **Web Service**
3. Connect GitHub repo: **XANH-AG-SERVER**
4. Cấu hình:
   - **Name:** xanh-ag-server
   - **Environment:** Docker
   - **Region:** Singapore
   - **Instance Type:** Free

---

## Bước 3: Environment Variables

Click **Advanced** → Add các biến sau:

```bash
NODE_ENV=production
PORT=3003
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
JWT_SECRET=<từ-bước-1.1>
JWT_REFRESH_SECRET=<từ-bước-1.1>
CORS_ORIGIN=https://your-frontend-domain.com
LOG_LEVEL=error

# API Keys (nếu có)
GOOGLE_GENAI_API_KEY=<your-key>
BRAVE_SEARCH_API_KEY=<your-key>
CLOUDINARY_CLOUD_NAME=<your-name>
CLOUDINARY_API_KEY=<your-key>
CLOUDINARY_API_SECRET=<your-secret>
```

---

## Bước 4: Deploy

1. Click **Create Web Service**
2. Đợi 3-5 phút build
3. Kiểm tra logs thấy: `🚀 Application is running`

---

## Bước 5: Test

```bash
# Health check
curl https://xanh-ag-server.onrender.com/health

# API docs
https://xanh-ag-server.onrender.com/api
```

---

## Bước 6: Setup Database

### Option A: Chạy Migrations
```bash
# Vào Render Shell
npm run migration:run
```

### Option B: Import từ Local
```bash
# Export từ local
pg_dump -h localhost -U postgres -d gn_argi > backup.sql

# Import vào Supabase SQL Editor
```

---

## Bước 7: Tránh Sleep (Free Tier)

1. Vào https://uptimerobot.com
2. Add New Monitor:
   - URL: `https://xanh-ag-server.onrender.com/health`
   - Interval: 5 minutes
3. ✅ Server không bao giờ ngủ!

---

## 🔧 Troubleshooting

### Build Failed
```bash
# Kiểm tra logs tại Dashboard → Logs
# Thường do: thiếu dependencies, sai Dockerfile path
```

### Database Connection Failed
```bash
# Thêm vào DATABASE_URL:
?sslmode=require

# Kiểm tra IP Render có được whitelist trong Supabase
```

### CORS Error
```bash
# Cập nhật CORS_ORIGIN với domain frontend thật
CORS_ORIGIN=https://your-actual-domain.com
```

---

## 🔄 Update Code

```bash
git add .
git commit -m "Update feature"
git push origin main
# Render tự động deploy lại!
```

---

## ✅ Checklist

- [ ] Generate JWT secrets
- [ ] Push code lên GitHub  
- [ ] Tạo Web Service
- [ ] Set environment variables
- [ ] Deploy thành công
- [ ] Test endpoints
- [ ] Setup database
- [ ] Setup UptimeRobot
- [ ] Update CORS_ORIGIN

**URL Production:** `https://xanh-ag-server.onrender.com`

🎉 **DONE!**
