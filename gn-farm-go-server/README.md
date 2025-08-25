<!--
===== GN FARM GO SERVER - BACKEND CHÍNH CỦA HỆ THỐNG =====
Tài liệu này mô tả backend Go server cho hệ thống quản lý GN Farm
Công nghệ sử dụng: Go, Gin, PostgreSQL, Redis, GORM, JWT
Chức năng chính:
- Quản lý người dùng và xác thực (JWT, 2FA, OTP)
- Quản lý sản phẩm và danh mục
- Hệ thống quản lý kho hàng (inventory management)
- Upload và theo dõi file
- API RESTful với Swagger documentation
- Hot reloading cho development
- Database migration với Goose
- Testing framework hoàn chỉnh
-->

# GN Farm Go Server

## Tổng quan (Overview)

Backend chính của hệ thống GN Farm được xây dựng bằng Go và Gin framework.

## Các tính năng chính (Features)

### Xác thực và Bảo mật (Authentication & Security)

- JWT token authentication
- Two-Factor Authentication (2FA)
- OTP verification
- Rate limiting
- CORS protection

### Quản lý Sản phẩm (Product Management)

- CRUD operations cho sản phẩm
- Quản lý loại và phân loại sản phẩm
- Tìm kiếm và lọc sản phẩm
- Thống kê sản phẩm

### Quản lý Kho hàng (Inventory Management)

- Phiếu nhập/xuất kho
- Tính giá trung bình gia quyền (Weighted Average Costing)
- Quản lý lô hàng và hạn sử dụng
- Lịch sử giao dịch kho hàng
- Báo cáo tồn kho

### File Management

- Upload file lên Cloudinary/S3
- Theo dõi file references
- Tự động dọn dẹp file không sử dụng
- Audit log cho các thao tác file

## Công nghệ sử dụng (Tech Stack)

- **Go 1.19+** - Ngôn ngữ lập trình chính
- **Gin** - Web framework
- **PostgreSQL** - Cơ sở dữ liệu chính
- **GORM** - ORM cho Go
- **Redis** - Cache và session storage
- **SQLC** - Generate Go code từ SQL
- **Goose** - Database migration
- **Swagger** - API documentation
- **Air** - Hot reloading cho development
- **Docker** - Containerization

## Cài đặt và Chạy (Installation & Setup)

### Yêu cầu hệ thống (Requirements)

- Go 1.19 hoặc cao hơn
- PostgreSQL 15+
- Redis 7+
- Docker và Docker Compose (optional)

### Chạy với Docker

```bash
# Chạy tất cả services
make docker_up

# Build và chạy
make docker_build
```

### Chạy Development

```bash
# Chạy với hot reload
make dev

# Hoặc chạy trực tiếp
go run ./cmd/server
```

### Quản lý Database

```bash
# Chạy migration
make migrate_up

# Tạo migration mới
make migrate_create name=ten_migration

# Rollback migration
make migrate_down

# Reset database
make migrate_reset
```

### Generate Code

```bash
# Generate Go code từ SQL
make sqlgen

# Generate Swagger docs
make swag
```

### Testing

```bash
# Chạy tất cả tests
make test

# Test với coverage report
make test_coverage

# Chạy unit tests
make test_unit

# Chạy integration tests
make test_integration

# Chạy e2e tests
make test_e2e
```

## API Documentation

Trựy cập Swagger UI tại: http://localhost:8002/swagger/index.html

## Cấu hình (Configuration)

Cấu hình được quản lý qua các file YAML:

- `config/local.yaml` - Development
- `config/production.yaml` - Production
- `config/test.yaml` - Testing

## Cấu trúc Dự án (Project Structure)

```
/gn-farm-go-server
  /cmd                 # Entry points
    /server           # Main application
  /config             # Configuration files
  /internal           # Private application code
    /controller       # HTTP handlers
    /service          # Business logic
    /model           # Data models
    /middleware      # HTTP middlewares
    /routers         # Route definitions
    /database        # Database layer
    /utils           # Utilities
  /pkg                # Public packages
  /sql                # SQL migrations
  /tests              # Test files
```

## Deploy

### Docker Production

```bash
# Build production image
docker build -t gn-farm-go-server .

# Run production container
docker run -p 8002:8002 --env-file .env gn-farm-go-server
```

### Binary Deploy

```bash
# Build binary
go build -o gn-farm-server ./cmd/server

# Run binary
./gn-farm-server
```
