#!/bin/bash

# ============================================
# RICE BLAST WARNING SYSTEM - TEST SCRIPT
# ============================================

BASE_URL="http://localhost:3003"

echo "🌾 Testing Rice Blast Warning System..."
echo "========================================"
echo ""

# Test 1: Get current location
echo "1️⃣ Testing GET /api/location"
echo "----------------------------"
curl -s -X GET "$BASE_URL/api/location" | jq '.'
echo ""
echo ""

# Test 2: Update location
echo "2️⃣ Testing POST /api/location"
echo "----------------------------"
curl -s -X POST "$BASE_URL/api/location" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ruộng test - Mỹ Lộc, Nam Định",
    "lat": 20.4500,
    "lon": 106.1200
  }' | jq '.'
echo ""
echo ""

# Test 3: Run analysis now
echo "3️⃣ Testing POST /api/run-now"
echo "----------------------------"
echo "⏳ Running analysis... (this may take 5-10 seconds)"
curl -s -X POST "$BASE_URL/api/run-now" | jq '.'
echo ""
echo ""

# Test 4: Get warning
echo "4️⃣ Testing GET /api/warning"
echo "----------------------------"
curl -s -X GET "$BASE_URL/api/warning" | jq '.'
echo ""
echo ""

echo "✅ All tests completed!"
echo "========================================"
echo ""
echo "📊 Check the results above"
echo "📚 Full documentation: RICE_BLAST_WARNING_README.md"
