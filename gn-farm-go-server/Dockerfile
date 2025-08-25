# ===== DOCKERFILE CHO GN-FARM-GO-SERVER (GOLANG) =====
# Container hóa ứng dụng Go server với hot reloading cho development
# Bao gồm các tools cần thiết: Air, Goose, Swag, CompileDaemon

# Sử dụng Go image chính thức với Alpine Linux
FROM golang:alpine

# Cài đặt các công cụ hệ thống cần thiết
# - git: Download dependencies từ Git repositories
# - curl: Health check và debugging
RUN apk add --no-cache git curl

# Cài đặt swag và thêm vào PATH
RUN go install github.com/swaggo/swag/cmd/swag@latest
ENV PATH="/go/bin:${PATH}"

# Kiểm tra xem swag đã được cài đặt chưa
RUN which swag || echo "swag not found in PATH"

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy toàn bộ mã nguồn vào container
COPY . .

# Tải xuống các dependencies của Go
RUN go mod download

# Cài đặt Air, Goose, Swag và CompileDaemon cho hot reloading
RUN go install github.com/air-verse/air@latest
RUN go install github.com/pressly/goose/v3/cmd/goose@latest
RUN go install github.com/swaggo/swag/cmd/swag@latest
RUN go install github.com/githubnemo/CompileDaemon@latest

# Expose port (nếu ứng dụng của bạn chạy trên một port cụ thể)
EXPOSE 8002

# Chạy swag init để tạo tài liệu Swagger
RUN cd /app && /go/bin/swag init -g ./cmd/server/main.go -o ./cmd/swag/docs || echo "Failed to run swag init"

# Sử dụng lệnh air để phát triển mà không cần build lại toàn bộ
CMD ["/go/bin/air", "-c", ".air.toml"]
