# ===== MAKEFILE CHO GN-FARM GO SERVER =====
# Tệp Makefile chứa các lệnh tự động hóa cho development, testing và deployment
# Sử dụng: make <command_name>

# ===== CẤU HÌNH DATABASE =====
# Chuỗi kết nối PostgreSQL cho development
GOOSE_DBSTRING ?= "postgres://postgres:postgres@localhost:5432/GO_GN_FARM?sslmode=disable"
# Thư mục chứa các file migration SQL
GOOSE_MIGRATION_DIR ?= sql/schema
# Driver database sử dụng (postgres)
GOOSE_DRIVER ?= postgres

# ===== CẤU HÌNH ỨNG DỤNG =====
# Tên ứng dụng chính
APP_NAME = server

# ===== LỆNH DEVELOPMENT =====
# Chạy ứng dụng trong môi trường development với hot reload
dev:
	go run ./cmd/$(APP_NAME)

# ===== LỆNH QUẢN LÝ DATABASE MIGRATION =====
# Chạy tất cả migration lên database (tạo/cập nhật tables)
migrate_up:
	@GOOSE_DRIVER=$(GOOSE_DRIVER) GOOSE_DBSTRING=$(GOOSE_DBSTRING) goose -dir=$(GOOSE_MIGRATION_DIR) up

# Rollback migration xuống một phiên bản trước đó
migrate_down:
	@GOOSE_DRIVER=$(GOOSE_DRIVER) GOOSE_DBSTRING=$(GOOSE_DBSTRING) goose -dir=$(GOOSE_MIGRATION_DIR) down

# Reset database về trạng thái ban đầu (xóa tất cả tables)
migrate_reset:
	@GOOSE_DRIVER=$(GOOSE_DRIVER) GOOSE_DBSTRING=$(GOOSE_DBSTRING) goose -dir=$(GOOSE_MIGRATION_DIR) reset

# Tạo file migration mới với tên được chỉ định
# Sử dụng: make migrate_create name=create_users_table
migrate_create:
	@goose -dir=$(GOOSE_MIGRATION_DIR) create $(name) sql

# ===== LỆNH TẠO CODE TỰ ĐỘNG =====
# Tạo Go code từ SQL queries sử dụng SQLC
sqlgen:
	sqlc generate

# ===== LỆNH TẠO TÀI LIỆU API =====
# Tạo Swagger documentation từ Go annotations
swag:
	swag init -g ./cmd/server/main.go -o ./cmd/swag/docs

# ===== LỆNH TESTING =====
# Chạy tất cả tests với output chi tiết
test:
	GO_ENV=test go test -v ./tests/...

# Chạy tests và tạo báo cáo coverage (tỷ lệ code được test)
test_coverage:
	GO_ENV=test go test -v -coverprofile=coverage.out ./tests/...
	go tool cover -html=coverage.out -o coverage.html

# Chạy chỉ unit tests (test các hàm/method riêng lẻ)
test_unit:
	GO_ENV=test go test -v ./tests/unit/...

# Chạy integration tests (test tương tác giữa các components)
test_integration:
	GO_ENV=test go test -v ./tests/integration/...

# Chạy end-to-end tests (test toàn bộ workflow)
test_e2e:
	GO_ENV=test go test -v ./tests/e2e/...

# Chạy tất cả loại tests
test_all:
	GO_ENV=test go test -v ./tests/unit/... ./tests/integration/... ./tests/e2e/...

# ===== CÀI ĐẶT DATABASE CHO TESTING =====
# Thiết lập database riêng cho testing (GO_GN_FARM_TEST)
test_db_setup:
	@echo "Setting up test database..."
	@GOOSE_DRIVER=$(GOOSE_DRIVER) GOOSE_DBSTRING="postgres://postgres:postgres@localhost:5432/GO_GN_FARM_TEST?sslmode=disable" goose -dir=$(GOOSE_MIGRATION_DIR) up

# Reset database test về trạng thái sạch và chạy lại migrations
test_db_reset:
	@echo "Resetting test database..."
	@GOOSE_DRIVER=$(GOOSE_DRIVER) GOOSE_DBSTRING="postgres://postgres:postgres@localhost:5432/GO_GN_FARM_TEST?sslmode=disable" goose -dir=$(GOOSE_MIGRATION_DIR) reset
	@GOOSE_DRIVER=$(GOOSE_DRIVER) GOOSE_DBSTRING="postgres://postgres:postgres@localhost:5432/GO_GN_FARM_TEST?sslmode=disable" goose -dir=$(GOOSE_MIGRATION_DIR) up

# ===== DANH SÁCH CÁC TARGET PHONY =====
# Khai báo các target không phải là file thực tế để tránh conflict
.PHONY: dev docker_up docker_down docker_build migrate_up migrate_down migrate_reset migrate_create sqlgen swag test test_coverage test_unit test_integration test_db_setup test_db_reset