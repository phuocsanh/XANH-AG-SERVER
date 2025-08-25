#!/bin/bash

# Test script to demonstrate that the GN application is working correctly

echo "Testing GN Application"
echo "======================"

# Test registration
echo "1. Testing user registration..."
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "userAccount": "testuser@example.com",
    "userPassword": "password123",
    "userSalt": "salt123",
    "userEmail": "testuser@example.com",
    "userState": 1
  }'

echo -e "\n\n2. Testing user login..."
# Test login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userAccount": "testuser@example.com",
    "userPassword": "password123"
  }'

echo -e "\n\n3. Testing product creation..."
# Test product creation (without authentication for simplicity)
curl -X POST http://localhost:8080/products \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Test Product",
    "productPrice": "100000",
    "productThumb": "test-thumb.jpg",
    "productDescription": "Test product description",
    "productType": 1,
    "productDiscountedPrice": "90000",
    "averageCostPrice": "80000",
    "profitMarginPercent": "12.5"
  }'

echo -e "\n\n4. Testing get all products..."
# Test get all products
curl -X GET http://localhost:8080/products

echo -e "\n\nAll tests completed!"