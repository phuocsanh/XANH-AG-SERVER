#!/bin/bash

# Script để generate JWT secrets cho production
# Chạy: chmod +x generate-jwt-secrets.sh && ./generate-jwt-secrets.sh

echo "🔐 Generating JWT Secrets for Production..."
echo ""

echo "📝 JWT_SECRET:"
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "$JWT_SECRET"
echo ""

echo "📝 JWT_REFRESH_SECRET:"
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "$JWT_REFRESH_SECRET"
echo ""

echo "✅ Secrets generated successfully!"
echo ""
echo "⚠️  QUAN TRỌNG:"
echo "1. Copy 2 secrets trên"
echo "2. Paste vào file .env.production"
echo "3. Thay thế các giá trị:"
echo "   - JWT_SECRET=prod_secret_key_CHANGE_THIS_IMMEDIATELY"
echo "   - JWT_REFRESH_SECRET=prod_refresh_secret_key_CHANGE_THIS_IMMEDIATELY"
echo ""
echo "4. KHÔNG share secrets này với ai!"
echo "5. KHÔNG commit file .env.production vào Git!"
