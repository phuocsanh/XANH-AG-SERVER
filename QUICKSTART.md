# 🚀 Quick Start Guide - Solo Developer

Hướng dẫn nhanh cho developer code 1 mình.

## 📦 Setup ban đầu (1 lần duy nhất)

```bash
# 1. Clone và cài đặt
git clone <repo-url>
cd XANH-AG-SERVER
npm install

# 2. Tạo file .env
cp .env.example .env

# 3. Điền thông tin vào .env
# - DATABASE_URL: Đã có sẵn (dev database)
# - CLOUDINARY_*: Điền credentials của bạn
# - GOOGLE_AI_API_KEY: Điền nếu có
```

## 🏃 Chạy Development

```bash
# Cách 1: Chạy local (Khuyến nghị)
npm run start:dev

# Cách 2: Chạy với Docker
npm run docker:dev
```

Truy cập:
- App: http://localhost:3003
- API Docs: http://localhost:3003/api

## 🚀 Deploy lên Production (Render)

### Bước 1: Chuẩn bị
```bash
# Kiểm tra build OK
npm run build
npm run start:prod
```

### Bước 2: Tạo Web Service trên Render
1. Vào https://render.com
2. New + → Web Service
3. Connect repo của bạn
4. Điền:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/main.js`

### Bước 3: Set Environment Variables
Copy các biến từ `.env` của bạn vào Render Dashboard, **NHƯNG** thay đổi:

```bash
# QUAN TRỌNG: Thay đổi những biến này!
NODE_ENV=production
DATABASE_URL=<production-database-url>  # Nếu có DB riêng cho prod
JWT_SECRET=<generate-strong-key>        # openssl rand -base64 64
JWT_REFRESH_SECRET=<another-strong-key>
CORS_ORIGIN=https://yourdomain.com      # Domain frontend thực tế
LOG_LEVEL=error
```

### Bước 4: Deploy!
Click "Create Web Service" và đợi deploy xong.

## 📝 File .env - Cách dùng

File `.env` của bạn có 2 phần:

### Development (Mặc định)
```bash
NODE_ENV=development
DATABASE_URL=postgresql://...  # Dev database
CORS_ORIGIN=*                  # Allow all
LOG_LEVEL=debug
```

### Production (Uncomment khi cần)
```bash
# Khi deploy lên Render, uncomment và thay giá trị:
# NODE_ENV=production
# DATABASE_URL=<prod-db-url>
# CORS_ORIGIN=https://yourdomain.com
# LOG_LEVEL=error
```

**Lưu ý**: Trên Render, bạn set biến qua Dashboard UI, không cần uncomment trong file.

## 🔧 Commands hay dùng

```bash
# Development
npm run start:dev          # Chạy với hot-reload
npm run start:debug        # Chạy với debugger

# Docker
npm run docker:dev         # Chạy dev container
npm run docker:logs        # Xem logs
npm run docker:down-dev    # Dừng container

# Database
npm run migration:run      # Chạy migrations
npm run seed:units         # Seed data

# Production
npm run build              # Build app
npm run start:prod         # Chạy production mode
```

## 🐛 Troubleshooting

### Port 3003 đã được dùng
```bash
# Kill process
lsof -ti:3003 | xargs kill -9
```

### Database connection failed
```bash
# Kiểm tra DATABASE_URL
cat .env | grep DATABASE_URL
```

### Docker không chạy
```bash
# Clean up và rebuild
npm run docker:down-dev
npm run docker:dev:build
```

## 📚 Đọc thêm

- Chi tiết deploy: `RENDER_DEPLOYMENT.md`
- Bảo mật: `SECURITY_CHECKLIST.md`
- Full docs: `README.md`

---

**Tóm tắt**: 
1. Copy `.env.example` → `.env`
2. Điền credentials
3. `npm run start:dev`
4. Code thôi! 🎉
