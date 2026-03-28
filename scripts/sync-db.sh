#!/bin/bash

# ==========================================
# 🔄 SCRIPT ĐỒNG BỘ DATA XANH AG (PRO -> DEV)
# Mở terminal tại thư mục XANH-AG-SERVER.
# Chạy lệnh: bash scripts/sync-db.sh
# Nhấn y để xác nhận xóa dữ liệu cũ ở DEV và ghi đè dữ liệu mới từ PRO.
# ==========================================

# Database URLs
URL_PRO="postgresql://neondb_owner:npg_EMzWu6sy1tNm@ep-steep-term-a15ggy6i-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
URL_DEV="postgresql://neondb_owner:npg_5bIneSfjDZB1@ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Kiểm tra công cụ cần thiết
if ! command -v pg_dump &> /dev/null || ! command -v psql &> /dev/null
then
    echo "❌ Lỗi: Cần cài đặt postgresql-client (pg_dump và psql) để chạy script này."
    exit 1
fi

echo "----------------------------------------------------"
echo "🚀 Đang bắt đầu đồng bộ dữ liệu từ PRO sang DEV..."
echo "⚠️  CẢNH BÁO: Toàn bộ dữ liệu hiện tại ở DEV sẽ bị XÓA SẠCH."
echo "----------------------------------------------------"

# Xác nhận trước khi thực hiện
read -p "❓ Bạn có chắc chắn muốn thực hiện không? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Đã hủy thao tác."
    exit 1
fi

echo "⏳ Đang trích xuất dữ liệu từ PRO và ghi đè vào DEV..."

# Thực hiện Dump và Restore trực tiếp qua Pipe
pg_dump "$URL_PRO" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | psql "$URL_DEV"

if [ $? -eq 0 ]; then
    echo "----------------------------------------------------"
    echo "✅ THÀNH CÔNG: Dữ liệu đã được đồng bộ hóa hoàn toàn!"
    echo "----------------------------------------------------"
else
    echo "----------------------------------------------------"
    echo "❌ THẤT BẠI: Có lỗi xảy ra trong quá trình đồng bộ."
    echo "----------------------------------------------------"
fi
