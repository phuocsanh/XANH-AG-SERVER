#!/bin/bash

#####################################################################
# SCRIPT KIỂM TRA SWAGGER UI - GN FARM GO SERVER
# Mục đích: Kiểm tra xem Swagger UI có hoạt động đúng không
# Tác giả: GN Farm Development Team
# Phiên bản: 1.0
# 
# Chức năng:
# - Kiểm tra Swagger UI endpoint (localhost:8002/swagger/index.html)
# - Kiểm tra Swagger JSON documentation
# - Kiểm tra trạng thái Docker container
# - Xem logs liên quan đến Swagger
#
# Cách sử dụng: ./check_swagger.sh
#####################################################################

# Kiểm tra xem Swagger UI có hoạt động không
# Endpoint: http://localhost:8002/swagger/index.html
echo "Kiểm tra Swagger UI..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/swagger/index.html
echo ""

# Kiểm tra xem tài liệu Swagger có tồn tại không
# Endpoint JSON: http://localhost:8002/swagger/doc.json
echo "Kiểm tra tài liệu Swagger..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/swagger/doc.json
echo ""

# Kiểm tra xem container backend_go_gn_farm có đang chạy không
# Hiện thị thông tin container nếu đang hoạt động
echo "Kiểm tra container backend_go_gn_farm..."
docker ps | grep backend_go_gn_farm

# Kiểm tra logs của container backend_go_gn_farm
# Lọc ra các dòng log liên quan đến swagger
echo "Kiểm tra logs của container backend_go_gn_farm..."
docker logs backend_go_gn_farm | grep swagger
