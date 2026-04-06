#!/bin/bash

# Configuration
PROD_DB_URL="postgresql://neondb_owner:npg_EMzWu6sy1tNm@ep-steep-term-a15ggy6i-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DEV_DB_URL="postgresql://neondb_owner:npg_5bIneSfjDZB1@ep-broad-pine-a1675nqi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

echo "----------------------------------------------------------"
echo "🚀 SYNCING DATABASE FROM PROD TO DEV..."
echo "PROD: ep-steep-term-a15ggy6i..."
echo "DEV:  ep-broad-pine-a1675nqi..."
echo "----------------------------------------------------------"

# Cảnh báo xác nhận
read -p "⚠️ CẢNH BÁO: Thao tác này sẽ XÓA HẾT dữ liệu của DB DEV hiện tại. Bạn có chắc không? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Đã hủy bỏ thao tác."
    exit 1
fi

# Bước 1: Xóa schema cũ ở DB DEV để đảm bảo sạch sẽ
echo "Step 1: Cleaning DEV database (recreating public schema)..."
psql "$DEV_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Bước 2: Dump dữ liệu từ Pro và pipe thẳng vào Dev
echo "Step 2: Transferring data from PROD to DEV (This may take a while)..."
pg_dump --no-owner --no-privileges "$PROD_DB_URL" | psql "$DEV_DB_URL"

echo "----------------------------------------------------------"
echo "✅ SYNC COMPLETED SUCCESSFULLY!"
echo "----------------------------------------------------------"
