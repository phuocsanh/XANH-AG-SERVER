#!/bin/bash

# Script to check TypeScript errors in the project

echo "Checking TypeScript errors in the project..."
echo "=========================================="

# Check each module directory
MODULES=("auth" "user" "product" "inventory" "file-tracking")

for module in "${MODULES[@]}"; do
  echo "Checking $module module..."
  npx tsc --noEmit --project tsconfig.json --rootDir src/modules/$module
  if [ $? -ne 0 ]; then
    echo "❌ Errors found in $module module"
  else
    echo "✅ No errors in $module module"
  fi
  echo ""
done

# Check entities
echo "Checking entities..."
npx tsc --noEmit --project tsconfig.json --rootDir src/entities
if [ $? -ne 0 ]; then
  echo "❌ Errors found in entities"
else
  echo "✅ No errors in entities"
fi
echo ""

# Check common directory
echo "Checking common directory..."
npx tsc --noEmit --project tsconfig.json --rootDir src/common
if [ $? -ne 0 ]; then
  echo "❌ Errors found in common directory"
else
  echo "✅ No errors in common directory"
fi
echo ""

echo "TypeScript error check completed!"