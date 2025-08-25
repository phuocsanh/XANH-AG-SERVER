#!/bin/sh

#####################################################################
# SCRIPT KHỚI ĐỘNG GN FARM GO SERVER - VỚI SWAGGER AUTO-GENERATION
# Mục đích: Khởi động Go server với việc tự động generate Swagger docs
# Tác giả: GN Farm Development Team  
# Phiên bản: 1.0
#
# Chức năng:
# - Tìm và chạy swag init để tạo tài liệu Swagger
# - Khởi động ứng dụng với Air hot reloading
# - Tự động xử lý dependencies và build process
#
# Sử dụng trong Docker container hoặc local development
#####################################################################

# Chạy swag init để tạo tài liệu Swagger từ Go annotations
# Swagger sẽ được generate từ file main.go và các annotations trong source code
echo "Running swag init..."

# Tìm đường dẫn đến swag binary trong hệ thống
# Cần thiết vì swag có thể được cài ở nhiều vị trí khác nhau
SWAG_PATH=$(find /go -name swag -type f | head -n 1)
echo "Swag path: $SWAG_PATH"

# Nếu tìm thấy swag, chạy lệnh generate documentation
if [ -n "$SWAG_PATH" ]; then
    echo "Running $SWAG_PATH init -g ./cmd/server/main.go -o ./cmd/swag/docs"
    # Generate Swagger docs từ main.go và đầu ra vào ./cmd/swag/docs
    $SWAG_PATH init -g ./cmd/server/main.go -o ./cmd/swag/docs
else
    echo "Swag not found - Swagger documentation will not be generated"
fi

# Khởi động ứng dụng với Air cho hot reloading
# Air sẽ tự động restart server khi có thay đổi trong source code
echo "Starting application with Air hot reloading..."
/go/bin/air -c .air.toml
