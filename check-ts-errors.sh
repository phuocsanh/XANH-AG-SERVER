#!/bin/bash

# Script to check TypeScript errors in the project

echo "Checking TypeScript errors in the project..."
echo "=========================================="

# Check each module directory
MODULES=("auth" "user" "product" "inventory" "file-tracking")

for module in "${MODULES[@]}"; do
  echo "Checking $module module..."
  if [ -f "src/modules/$module/tsconfig.json" ]; then
    npx tsc --noEmit --project src/modules/$module/tsconfig.json
  else
    npx tsc --noEmit --project tsconfig.json --rootDir src/modules/$module
  fi
  if [ $? -ne 0 ]; then
    echo "❌ Errors found in $module module"
  else
    echo "✅ No errors in $module module"
  fi
  echo ""
done

# Check entities
echo "Checking entities..."
if [ -f "src/entities/tsconfig.json" ]; then
  npx tsc --noEmit --project src/entities/tsconfig.json
else
  npx tsc --noEmit --project tsconfig.json --rootDir src/entities
fi
if [ $? -ne 0 ]; then
  echo "❌ Errors found in entities"
else
  echo "✅ No errors in entities"
fi
echo ""

# Check common directory
echo "Checking common directory..."
if [ -f "src/common/tsconfig.json" ]; then
  npx tsc --noEmit --project src/common/tsconfig.json
else
  npx tsc --noEmit --project tsconfig.json --rootDir src/common
fi
if [ $? -ne 0 ]; then
  echo "❌ Errors found in common directory"
else
  echo "✅ No errors in common directory"
fi
echo ""

echo "TypeScript error check completed!"