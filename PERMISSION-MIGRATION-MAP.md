# Permission Migration Map

## Old → New Mapping

### User Management
- `USER_VIEW` → `user:read`
- `USER_CREATE` → `user:create`
- `USER_UPDATE` → `user:update`
- `USER_DELETE` → `user:delete`
- `USER_APPROVE` → `user:approve`

### Role Management
- `ROLE_MANAGE` → `role:manage`

### AI Features
- `RICE_BLAST_VIEW` → `ai:rice_blast:read`
- `RICE_BLAST_MANAGE` → `ai:rice_blast:manage`

### Product Management
- `PRODUCT_VIEW` → `product:read`
- `PRODUCT_MANAGE` → `product:manage` (covers create/update/delete)

### Sales Management
- `SALES_VIEW` → `sales:read`
- `SALES_CREATE` → `sales:create`
- `SALES_MANAGE` → `sales:manage` (covers update/delete)

### Customer Management
- `CUSTOMER_VIEW` → `customer:read`
- `CUSTOMER_MANAGE` → `customer:manage`

### Inventory Management
- `INVENTORY_VIEW` → `inventory:read`
- `INVENTORY_MANAGE` → `inventory:manage`

### Report
- `REPORT_VIEW` → `report:read`
- `REPORT_EXPORT` → `report:export`

### Rice Crop (already good)
- `rice_crop:read` ✅
- `rice_crop:create` ✅
- `rice_crop:update` ✅
- `rice_crop:delete` ✅

### Cost Item (remove duplicates)
- ❌ DELETE: `COST_ITEM_VIEW` (duplicate of cost_item:read)
- ❌ DELETE: `COST_ITEM_MANAGE` (duplicate of cost_item:create/update/delete)
- ✅ KEEP: `cost_item:read`
- ✅ KEEP: `cost_item:create`
- ✅ KEEP: `cost_item:update`
- ✅ KEEP: `cost_item:delete`

### Harvest (already good)
- `harvest:read` ✅
- `harvest:create` ✅
- `harvest:update` ✅
- `harvest:delete` ✅

### Schedule (already good)
- `schedule:read` ✅
- `schedule:create` ✅
- `schedule:update` ✅
- `schedule:delete` ✅

### Application (already good)
- `application:read` ✅
- `application:create` ✅
- `application:update` ✅
- `application:delete` ✅

### Growth Tracking (already good)
- `growth:read` ✅
- `growth:create` ✅
- `growth:update` ✅
- `growth:delete` ✅

### Area of Plot (already good)
- `area_of_each_plot_of_land:read` ✅
- `area_of_each_plot_of_land:create` ✅
- `area_of_each_plot_of_land:update` ✅
- `area_of_each_plot_of_land:delete` ✅

### Store Profit Report (already good)
- `store-profit-report:read` ✅

### Operating Cost
- `OPERATING_COST_VIEW` → `operating_cost:read`
- `OPERATING_COST_MANAGE` → `operating_cost:manage`

---

## Summary

**Total permissions:**
- Old format (UPPERCASE): 18 permissions → Convert to lowercase:action
- Already good (lowercase:action): 28 permissions → Keep as is
- Duplicates: 2 permissions → Remove

**New total: ~44 permissions** (clean, no duplicates)
