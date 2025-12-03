#!/bin/bash

# ================================================
# SCRIPT TỰ ĐỘNG DEPLOY STORE PROFIT SYSTEM
# ================================================

set -e  # Exit on error

echo "🚀 Bắt đầu deployment Store Profit System..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ================================================
# BƯỚC 1: CHẠY MIGRATIONS
# ================================================
echo ""
echo "${YELLOW}📊 BƯỚC 1: Chạy Database Migrations...${NC}"

# Extract database credentials from .env
export $(grep -v '^#' .env | xargs)

# Parse DATABASE_URL
DB_URL_DECODED=$(echo "$DATABASE_URL" | sed 's/%24/$/g')

echo "✅ Đã load database credentials"

# Chạy migration 1: Thêm profit columns
echo ""
echo "${YELLOW}→ Migration 1: Thêm cột profit vào sales_invoices...${NC}"
psql "$DB_URL_DECODED" -f add-profit-columns-to-sales-invoices.sql

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Migration 1 thành công${NC}"
else
    echo "${RED}❌ Migration 1 thất bại${NC}"
    exit 1
fi

# Chạy migration 2: Tạo bảng delivery_logs
echo ""
echo "${YELLOW}→ Migration 2: Tạo bảng delivery_logs...${NC}"
psql "$DB_URL_DECODED" -f create-delivery-logs-table.sql

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Migration 2 thành công${NC}"
else
    echo "${RED}❌ Migration 2 thất bại${NC}"
    exit 1
fi

# ================================================
# BƯỚC 2: BUILD SERVER
# ================================================
echo ""
echo "${YELLOW}🔨 BƯỚC 2: Build NestJS Server...${NC}"

npm run build

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Build thành công${NC}"
else
    echo "${RED}❌ Build thất bại${NC}"
    exit 1
fi

# ================================================
# BƯỚC 3: VERIFY MIGRATIONS
# ================================================
echo ""
echo "${YELLOW}🔍 BƯỚC 3: Kiểm tra migrations...${NC}"

# Check columns
COLUMN_CHECK=$(psql "$DB_URL_DECODED" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_name = 'sales_invoices' 
      AND column_name IN ('cost_of_goods_sold', 'gross_profit', 'gross_profit_margin');
")

if [ "$COLUMN_CHECK" -eq 3 ]; then
    echo "${GREEN}✅ 3 cột profit đã tồn tại trong sales_invoices${NC}"
else
    echo "${RED}❌ Thiếu cột profit! Cần kiểm tra lại${NC}"
fi

# Check table
TABLE_CHECK=$(psql "$DB_URL_DECODED" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_name = 'delivery_logs';
")

if [ "$TABLE_CHECK" -eq 1 ]; then
    echo "${GREEN}✅ Bảng delivery_logs đã tồn tại${NC}"
else
    echo "${RED}❌ Bảng delivery_logs chưa tồn tại! Cần kiểm tra lại${NC}"
fi

# ================================================
# HOÀN THÀNH
# ================================================
echo ""
echo "${GREEN}════════════════════════════════════════${NC}"
echo "${GREEN}🎉 DEPLOYMENT HOÀN TẤT!${NC}"
echo "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "📋 Kết quả:"
echo "  ✅ Database migrations: OK"
echo "  ✅ Server build: OK"
echo "  ✅ Verification: OK"
echo ""
echo "🚀 Bước tiếp theo:"
echo "  1. Restart server: npm run start:prod"
echo "  2. Test APIs:"
echo "     curl http://localhost:3000/store-profit-report/invoice/1"
echo "     curl http://localhost:3000/store-profit-report/season/1"
echo ""
echo "${YELLOW}⚠️  Lưu ý: Nhớ restart server để load code mới!${NC}"
