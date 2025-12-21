# Permission Refactor - Controllers Checklist

## ✅ Completed
1. ✅ UserController - DONE
2. ✅ CostItemController - DONE (already using new format)
3. ✅ HarvestRecordController - DONE (already using new format)

## 🔄 Need to Update (21 controllers)

### Mapping Reference:
```
USER_VIEW → user:read
USER_CREATE → user:create
USER_UPDATE → user:update
USER_DELETE → user:delete
USER_APPROVE → user:approve

PRODUCT_VIEW → product:read
PRODUCT_MANAGE → product:manage

SALES_VIEW → sales:read
SALES_CREATE → sales:create
SALES_MANAGE → sales:manage

CUSTOMER_VIEW → customer:read
CUSTOMER_MANAGE → customer:manage

INVENTORY_VIEW → inventory:read
INVENTORY_MANAGE → inventory:manage

REPORT_VIEW → report:read
REPORT_EXPORT → report:export

RICE_BLAST_VIEW → ai:rice_blast:read
RICE_BLAST_MANAGE → ai:rice_blast:manage

OPERATING_COST_VIEW → operating_cost:read
OPERATING_COST_MANAGE → operating_cost:manage

COST_ITEM_VIEW → (DELETE - duplicate)
COST_ITEM_MANAGE → (DELETE - duplicate)
```

## Controllers to Update:

### 1. ProductController
**File:** `src/modules/product/product.controller.ts`
**Permissions to replace:**
- PRODUCT_VIEW → product:read
- PRODUCT_MANAGE → product:manage

### 2. SalesController
**File:** `src/modules/sales/sales.controller.ts`
**Permissions to replace:**
- SALES_VIEW → sales:read
- SALES_CREATE → sales:create
- SALES_MANAGE → sales:manage

### 3. CustomerController
**File:** `src/modules/customer/customer.controller.ts`
**Permissions to replace:**
- CUSTOMER_VIEW → customer:read
- CUSTOMER_MANAGE → customer:manage

### 4. InventoryController
**File:** `src/modules/inventory/inventory.controller.ts`
**Permissions to replace:**
- INVENTORY_VIEW → inventory:read
- INVENTORY_MANAGE → inventory:manage

### 5. AiRiceBlastController
**File:** `src/modules/ai-rice-blast/ai-rice-blast.controller.ts`
**Permissions to replace:**
- RICE_BLAST_VIEW → ai:rice_blast:read
- RICE_BLAST_MANAGE → ai:rice_blast:manage

### 6. AiBacterialBlightController
**File:** `src/modules/ai-bacterial-blight/ai-bacterial-blight.controller.ts`
**Permissions to replace:**
- RICE_BLAST_VIEW → ai:rice_blast:read (if any)

### 7. OperatingCostController
**File:** `src/modules/operating-cost/operating-cost.controller.ts`
**Permissions to replace:**
- OPERATING_COST_VIEW → operating_cost:read
- OPERATING_COST_MANAGE → operating_cost:manage

### 8. CostItemCategoryController
**File:** `src/modules/cost-item-category/cost-item-category.controller.ts`
**Permissions to replace:**
- COST_ITEM_VIEW → cost_item:read (if used for category)
- COST_ITEM_MANAGE → cost_item:manage

### 9. OperatingCostCategoryController
**File:** `src/modules/operating-cost-category/operating-cost-category.controller.ts`
**Permissions to replace:**
- OPERATING_COST_VIEW → operating_cost:read
- OPERATING_COST_MANAGE → operating_cost:manage

### 10. ProductTypeController
**File:** `src/modules/product-type/product-type.controller.ts`
**Permissions to replace:**
- PRODUCT_VIEW → product:read
- PRODUCT_MANAGE → product:manage

### 11. ProductSubtypeController
**File:** `src/modules/product-subtype/product-subtype.controller.ts`
**Permissions to replace:**
- PRODUCT_VIEW → product:read
- PRODUCT_MANAGE → product:manage

### 12. SupplierController
**File:** `src/modules/supplier/supplier.controller.ts`
**Permissions to replace:**
- Check what permissions it uses

### 13. SeasonController
**File:** `src/modules/season/season.controller.ts`
**Permissions to replace:**
- PRODUCT_VIEW → product:read (if any)

### 14. UnitController
**File:** `src/modules/unit/unit.controller.ts`
**Permissions to replace:**
- PRODUCT_VIEW → product:read

### 15. SymbolController
**File:** `src/modules/symbol/symbol.controller.ts`
**Permissions to replace:**
- PRODUCT_VIEW → product:read

### 16. SalesReturnController
**File:** `src/modules/sales-return/sales-return.controller.ts`
**Permissions to replace:**
- SALES_VIEW → sales:read
- SALES_MANAGE → sales:manage

### 17. DebtNoteController
**File:** `src/modules/debt-note/debt-note.controller.ts`
**Permissions to replace:**
- CUSTOMER_VIEW → customer:read
- CUSTOMER_MANAGE → customer:manage

### 18. PaymentController
**File:** `src/modules/payment/payment.controller.ts`
**Permissions to replace:**
- Check permissions

### 19. PaymentAllocationController
**File:** `src/modules/payment-allocation/payment-allocation.controller.ts`
**Permissions to replace:**
- Check permissions

### 20. LocationController
**File:** `src/modules/location/location.controller.ts`
**Permissions to replace:**
- Check permissions

### 21. UploadController
**File:** `src/modules/upload/upload.controller.ts`
**Permissions to replace:**
- Check permissions

---

## Progress Tracking

- [x] UserController
- [ ] ProductController
- [ ] SalesController
- [ ] CustomerController
- [ ] InventoryController
- [ ] AiRiceBlastController
- [ ] AiBacterialBlightController
- [ ] OperatingCostController
- [ ] CostItemCategoryController
- [ ] OperatingCostCategoryController
- [ ] ProductTypeController
- [ ] ProductSubtypeController
- [ ] SupplierController
- [ ] SeasonController
- [ ] UnitController
- [ ] SymbolController
- [ ] SalesReturnController
- [ ] DebtNoteController
- [ ] PaymentController
- [ ] PaymentAllocationController
- [ ] LocationController
- [ ] UploadController

---

## Next Steps

1. Update each controller one by one
2. Test build after each update
3. Update frontend permissions after all backend is done
4. Final integration test
