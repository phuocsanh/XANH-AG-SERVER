#!/bin/bash

# Test Inventory Return and Adjustment APIs
# Server: http://localhost:3003

echo "🚀 Starting API Tests..."
echo ""

# 1. Login to get token
echo "1️⃣ Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3003/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "sanhtps"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful! Token: ${TOKEN:0:20}..."
echo ""

# 2. Test GET /inventory/returns
echo "2️⃣ Testing GET /inventory/returns..."
RETURNS_RESPONSE=$(curl -s -X GET http://localhost:3003/inventory/returns \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $RETURNS_RESPONSE"
echo ""

# 3. Test GET /inventory/adjustments
echo "3️⃣ Testing GET /inventory/adjustments..."
ADJUSTMENTS_RESPONSE=$(curl -s -X GET http://localhost:3003/inventory/adjustments \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $ADJUSTMENTS_RESPONSE"
echo ""

# 4. Test POST /inventory/return (Create Return)
echo "4️⃣ Testing POST /inventory/return..."
CREATE_RETURN_RESPONSE=$(curl -s -X POST http://localhost:3003/inventory/return \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "return_code": "RT-TEST-001",
    "supplier_id": 1,
    "total_amount": 100000,
    "reason": "Test return - Hàng lỗi",
    "status": "draft",
    "created_by": 1,
    "items": [{
      "product_id": 1,
      "quantity": 1,
      "unit_cost": 100000,
      "total_price": 100000,
      "reason": "Test item"
    }]
  }')
echo "Response: $CREATE_RETURN_RESPONSE"
echo ""

# 5. Test POST /inventory/adjustment (Create Adjustment)
echo "5️⃣ Testing POST /inventory/adjustment..."
CREATE_ADJUSTMENT_RESPONSE=$(curl -s -X POST http://localhost:3003/inventory/adjustment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adjustment_code": "ADJ-TEST-001",
    "adjustment_type": "OUT",
    "reason": "Test adjustment - Kiểm kê",
    "status": "draft",
    "created_by": 1,
    "items": [{
      "product_id": 1,
      "quantity_change": -1,
      "reason": "Test decrease"
    }]
  }')
echo "Response: $CREATE_ADJUSTMENT_RESPONSE"
echo ""

# 6. Test GET /inventory/receipt/:id/images (Image Upload feature)
echo "6️⃣ Testing GET /inventory/receipt/1/images..."
IMAGES_RESPONSE=$(curl -s -X GET http://localhost:3003/inventory/receipt/1/images \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $IMAGES_RESPONSE"
echo ""

echo "✅ All tests completed!"
