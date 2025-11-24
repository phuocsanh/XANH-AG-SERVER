# 🌾 XANH-AG-SERVER

Backend API server cho hệ thống quản lý nông nghiệp thông minh.

## 📋 Mục lục

- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt](#cài-đặt)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [Docker](#docker)
- [Deploy lên Production](#deploy-lên-production)
- [API Documentation](#api-documentation)

## 🔧 Yêu cầu hệ thống

- **Node.js**: >= 20.x
- **npm**: >= 10.x
- **PostgreSQL**: >= 14.x (hoặc Supabase)
- **Docker** (tùy chọn): >= 24.x

## 📦 Cài đặt

```bash
# Clone repository
git clone <repository-url>
cd XANH-AG-SERVER

# Cài đặt dependencies
npm install

# Setup môi trường development
npm run env:dev
```

## ⚙️ Cấu hình môi trường

### Cách 1: Sử dụng script tự động (Khuyến nghị)

```bash
npm run env:setup
```

Script sẽ hỏi bạn muốn setup môi trường nào (dev/prod) và tự động copy file tương ứng.

### Cách 2: Manual

#### Development

```bash
# Copy file môi trường development
cp .env.development .env

# Hoặc dùng npm script
npm run env:dev
```

#### Production

```bash
# Copy file môi trường production
cp .env.production .env

# Hoặc dùng npm script
npm run env:prod
```

### Biến môi trường quan trọng

Xem file `.env.example` để biết danh sách đầy đủ các biến môi trường.

**Bắt buộc:**
- `DATABASE_URL`: Connection string đến PostgreSQL/Supabase
- `JWT_SECRET`: Secret key cho JWT authentication
- `JWT_REFRESH_SECRET`: Secret key cho refresh token

**Tùy chọn:**
- `CLOUDINARY_*`: Credentials cho upload file
- `GOOGLE_AI_API_KEY`: API key cho Google AI
- `CORS_ORIGIN`: Danh sách domain được phép truy cập

## 🚀 Chạy ứng dụng

### Development (Local)

```bash
# Chạy với hot-reload
npm run start:dev

# Chạy với debugger
npm run start:debug
```

Server sẽ chạy tại: `http://localhost:3003`

### Production (Local)

```bash
# Build application
npm run build

# Start production server
npm run start:prod
```

## 🐳 Docker

### Development với Docker

```bash
# Chạy development container
npm run docker:dev

# Hoặc rebuild từ đầu
npm run docker:dev:build

# Xem logs
npm run docker:logs

# Dừng container
npm run docker:down-dev
```

### Production với Docker

```bash
# Build và chạy production container
npm run docker:prod:build

# Hoặc chỉ chạy (nếu đã build)
npm run docker:prod

# Xem logs
npm run docker:logs

# Dừng container
npm run docker:down
```

### Debug trong Docker

Container development đã expose port `9229` cho Node.js debugger. Bạn có thể attach debugger từ VS Code hoặc Chrome DevTools.

## 🌐 Deploy lên Production

### Render.com (Khuyến nghị cho Free Tier)

Xem hướng dẫn chi tiết tại: [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md)

Hoặc chạy:
```bash
npm run deploy:render
```

**Tóm tắt các bước:**

1. Tạo Web Service trên Render
2. Set environment variables từ `.env.production`
3. Build command: `npm install && npm run build`
4. Start command: `node dist/main.js`
5. Deploy!

### Các platform khác

- **Vercel**: Không khuyến nghị (không hỗ trợ long-running processes)
- **Railway**: Tương tự Render, dễ setup
- **AWS/GCP/Azure**: Cần cấu hình phức tạp hơn

## 📚 API Documentation

Sau khi chạy server, truy cập Swagger UI tại:

```
http://localhost:3003/api
```

Swagger UI cung cấp:
- Danh sách tất cả endpoints
- Request/Response schemas
- Try-it-out functionality
- Authentication testing

## 🗄️ Database

### Migrations

```bash
# Tạo migration mới
npm run migration:create -- src/database/migrations/MigrationName

# Generate migration từ entity changes
npm run migration:generate -- src/database/migrations/MigrationName

# Chạy migrations
npm run migration:run

# Revert migration gần nhất
npm run migration:revert
```

### Seeding

```bash
# Seed units data
npm run seed:units
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## 🔒 Bảo mật

### Best Practices đã áp dụng:

✅ **Environment Variables**: Tách biệt dev/prod, không commit vào Git  
✅ **SSL/TLS**: Tự động bật cho cloud database  
✅ **CORS**: Giới hạn theo domain trong production  
✅ **JWT**: Strong secret keys, expiration time  
✅ **Docker**: Non-root user, multi-stage build  
✅ **Database**: Tắt synchronize trong production  
✅ **Logging**: Giảm logging level trong production  

### Generate Strong Secrets

```bash
# Generate JWT secret
openssl rand -base64 64

# Hoặc dùng Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## 📁 Cấu trúc thư mục

```
XANH-AG-SERVER/
├── src/
│   ├── common/          # Shared utilities, filters, interceptors
│   ├── config/          # Configuration files
│   ├── database/        # Migrations, seeds
│   ├── entities/        # TypeORM entities
│   ├── modules/         # Feature modules
│   │   ├── auth/
│   │   ├── user/
│   │   ├── product/
│   │   └── ...
│   ├── app.module.ts
│   └── main.ts
├── uploads/             # Temporary file uploads (gitignored)
├── .env                 # Current environment (gitignored)
├── .env.development     # Dev config (gitignored)
├── .env.production      # Prod config (gitignored)
├── .env.example         # Template
├── Dockerfile           # Production Docker image
├── Dockerfile.dev       # Development Docker image
├── docker-compose.yml   # Production compose
└── docker-compose.dev.yml # Development compose
```

## 🛠️ Scripts hữu ích

```bash
# Environment management
npm run env:setup        # Interactive setup
npm run env:dev          # Switch to development
npm run env:prod         # Switch to production

# Docker operations
npm run docker:dev       # Start dev container
npm run docker:prod      # Start prod container
npm run docker:logs      # View logs

# Database
npm run migration:run    # Run migrations
npm run seed:units       # Seed data

# Code quality
npm run lint             # Lint code
npm run format           # Format code
```

## 🐛 Troubleshooting

### Lỗi kết nối database

```bash
# Kiểm tra DATABASE_URL
echo $DATABASE_URL

# Test connection
npm run typeorm -- query "SELECT 1"
```

### Port đã được sử dụng

```bash
# Tìm process đang dùng port 3003
lsof -ti:3003

# Kill process
kill -9 $(lsof -ti:3003)
```

### Docker issues

```bash
# Clean up containers
docker-compose down -v

# Rebuild from scratch
docker-compose build --no-cache

# View detailed logs
docker-compose logs -f app
```

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra [Issues](link-to-issues) đã có
2. Xem [Documentation](link-to-docs)
3. Tạo issue mới với đầy đủ thông tin

## 📄 License

[Thêm license của bạn ở đây]

---

Made with ❤️ by XANH-AG Team
