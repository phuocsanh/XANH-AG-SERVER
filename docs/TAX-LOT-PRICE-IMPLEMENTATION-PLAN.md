# Tax Lot Price Implementation Plan

## Muc tieu

Chuyen logic `gia ban khai thue` tu cap `product` sang cap `lo nhap` de doanh thu khai thue duoc tinh dung theo nguon hang thuc te da ban ra.

Muc tieu nghiep vu:

- Moi lo nhap co the khai bao `gia ban khai thue` rieng
- Khi ban hang, he thong lay `gia ban khai thue` theo FIFO tung lo
- Bao cao thue tinh tren phan bo thuc te cua tung lo, khong doc nguoc tu `product.tax_selling_price`
- Du lieu cu truoc cutover duoc snapshot/backfill 1 lan roi giu nguyen

## Quyet dinh da chot

1. Cutover

- `Cutover` la moc chuyen tu logic cu sang logic moi
- Hoa don / phieu nhap truoc moc nay dung logic legacy
- Hoa don / phieu nhap sau moc nay dung logic theo lo nhap
- Ngay cutover se duoc chot khi release va dua vao config / migration

2. Hoa don cu

- Hoa don cu se duoc `snapshot/backfill 1 lan roi khong doi nua`
- Thu tu lay gia khi backfill:
  1. `receipt_item.tax_selling_price`
  2. neu khong co thi lay `product.tax_selling_price`
  3. neu van khong co thi danh dau `unknown`

3. Phieu nhap moi

- Khong auto-fill `tax_selling_price` tu san pham
- Neu co `taxable_quantity` thi bat buoc nhap `tax_selling_price`

4. Hoa don ban moi

- `sales_invoice_items.tax_selling_price` van duoc luu de hien thi
- Neu 1 dong ban an tu nhieu lo thi field nay luu `weighted average`

5. Sua phieu nhap da duyet

- Cho phep sua `tax_selling_price` tren phieu nhap da `approved/completed`
- Khi sua, he thong phai cap nhat lai du lieu cho cac hoa don sau cutover da an tu lo do

6. Pham vi bao cao

- Chi sua report `/reports/tax-revenue`
- Khong mo rong sang `store-profit-report` hay bao cao khac trong phase nay

## Van de hien tai

Hien tai he thong co cac dac diem sau:

- `products.tax_selling_price` dang la 1 gia chung cho san pham
- `inventory_receipt_items` chua co `tax_selling_price` o cap lo nhap
- `sales_invoice_items.tax_selling_price` chi la snapshot cap dong ban
- `sync taxable` dang gan `batch.taxSellingPrice = product.tax_selling_price`
- 1 dong ban co the an tu nhieu lo, nhung `sales_invoice_items` chi co 1 field gia duy nhat

He qua:

- Khong bieu dien dung truong hop 1 dong ban an tu nhieu lo co gia khai thue khac nhau
- Khi doi `product.tax_selling_price`, du lieu cu co nguy co bi anh huong boi fallback
- Bao cao thue hien tai chinh xac o muc han che, chua dat muc theo-lo

## Nguyen tac nghiep vu can chot

1. Gia khai thue dung nhat nam o lo nhap

- `inventory_receipt_items.tax_selling_price` la nguon goc nghiep vu
- Gia nay la snapshot tai thoi diem nhap

2. Khi ban hang, can tinh theo phan bo thuc te

- Neu 1 dong ban an tu 3 lo, doanh thu khai thue phai bang tong cua 3 phan bo
- Khong co khai niem 1 gia khai thue duy nhat la "chinh xac tuyet doi" o cap `sales_invoice_item`

3. `sales_invoice_items.tax_selling_price` van co the giu lai

- Dung cho hien thi nhanh, in an, du lieu cu, hoac fallback
- Khong duoc coi la nguon su that cuoi cung cho bao cao thue moi

4. Bao cao phai uu tien doc allocation theo lo

- Nguon dung nhat la `sales_invoice_item_stock_allocations`
- Neu khong co du lieu allocation thue thi moi fallback

5. Du lieu cu va du lieu moi duoc tach bang moc cutover

- Truoc cutover: backfill 1 lan, freeze snapshot
- Sau cutover: tinh theo `inventory_receipt_items` va allocation

## Thiet ke du lieu de xuat

### 1. Inventory receipt items

Them cac cot moi vao bang `inventory_receipt_items`:

- `tax_selling_price`: numeric nullable
- `tax_price_source`: enum/string nullable

Y nghia:

- `tax_selling_price`: gia ban khai thue cua chinh lo nhap do
- `tax_price_source`:
  - `manual`
  - `copied_from_product`
  - `legacy_backfill`

Ghi chu:

- Giai doan dau cho phep nullable de khong chan migration
- Ve sau co the validate: neu `taxable_quantity > 0` thi nen co `tax_selling_price > 0`

### 2. Sales invoice item stock allocations

Them cac cot moi vao bang `sales_invoice_item_stock_allocations`:

- `taxable_quantity`: numeric nullable
- `tax_selling_price`: numeric nullable
- `tax_price_source`: enum/string nullable

Day la bang quan trong nhat cua thiet ke moi.

Y nghia:

- `taxable_quantity`: phan so luong cua allocation nay duoc tinh vao doanh thu thue
- `tax_selling_price`: gia khai thue snapshot cua lo tai luc phan bo
- `tax_price_source`:
  - `receipt_item_exact`
  - `product_fallback_legacy`
  - `legacy_snapshot_backfill`
  - `unknown`

### 3. Sales invoice items

Co the giu nguyen cac cot hien tai:

- `taxable_quantity`
- `tax_selling_price`

Nhung doi vai tro:

- `taxable_quantity`: truong tong hop nhanh o cap item
- `tax_selling_price`: gia hien thi / snapshot legacy / binh quan gia quyen

De xuat them:

- `tax_price_accuracy`: `exact | mixed | estimated | unknown`

Y nghia:

- `exact`: item chi an tu 1 gia khai thue hoac bao cao co the tinh chinh xac tu allocation
- `mixed`: item an tu nhieu lo co gia khac nhau
- `estimated`: snapshot/backfill tu du lieu legacy
- `unknown`: khong du du lieu de tinh tin cay

## Luong nghiep vu moi

### 1. Tao phieu nhap

FE/BE them field `tax_selling_price` tren tung `inventory_receipt_item`.

Rule de xuat:

- Neu `taxable_quantity > 0` thi bat buoc nhap `tax_selling_price`
- Khong auto-fill tu `product.tax_selling_price`
- Nhung gia tri luu vao phieu nhap phai la snapshot rieng, khong lien ket dong bo nguoc ve product

### 2. Tao hoa don ban

Khi tru kho theo FIFO:

- Xac dinh allocation theo tung lo nhu hien tai
- Voi moi allocation:
  - lay `receipt_item.tax_selling_price`
  - tinh `allocatedTaxableQty`
  - luu vao `sales_invoice_item_stock_allocations`

Cong thuc de xuat:

- `allocatedTaxableQty = min(allocatedQty, taxableQtyConLaiCuaLo)`
- `allocatedTaxRevenue = allocatedTaxableQty * allocation.tax_selling_price`

Cap `sales_invoice_item`:

- `taxable_quantity = sum(allocation.taxable_quantity)`
- `tax_selling_price`:
  - neu chi co 1 gia duy nhat -> luu gia do
  - neu co nhieu gia -> luu weighted average de hien thi
- `tax_price_accuracy`:
  - `exact` neu 1 gia
  - `mixed` neu nhieu gia

### 3. Dong bo taxable data

Refactor `syncTaxableDataForProduct`:

- Batch khong duoc doc gia tu `product.tax_selling_price`
- Batch phai doc gia tu `receipt_item.tax_selling_price`
- Khi sync lai item ban:
  - uu tien cap nhat lai `taxable_quantity` tu FIFO
  - neu allocation da ton tai va co gia theo lo thi rebuild `item.tax_selling_price` tu allocation

Muc tieu:

- Sau khi cutover, `sync` khong con phu thuoc vao `product.tax_selling_price`

### 4. Bao cao thue

Bao cao moi phai tinh:

- `taxable_revenue = sum(allocation.taxable_quantity * allocation.tax_selling_price)`

Thu tu uu tien:

1. `allocation.tax_selling_price` + `allocation.taxable_quantity`
2. snapshot legacy da backfill cho hoa don truoc cutover
3. `sales_invoice_item.tax_selling_price` chi de debug / doi chieu neu can

## Nguyen tac xu ly du lieu cu va moi

### 1. Hoa don truoc cutover

Rule nghiep vu:

- Backfill 1 lan roi dong bang
- Neu truy duoc `receipt_item.tax_selling_price` thi uu tien dung gia do
- Neu `receipt_item` khong co gia thi fallback `product.tax_selling_price`
- Sau khi backfill xong, report khong doc live tu `product.tax_selling_price` nua

Danh dau de xuat:

- `tax_price_source = legacy_snapshot_backfill`
- `tax_price_accuracy = estimated`

Y nghia:

- Day la snapshot legacy da chot 1 lan
- Sau do du lieu cu khong doi nua khi sua gia san pham

### 2. Hoa don sau cutover

Rule nghiep vu:

- receipt item phai co `tax_selling_price`
- allocation phai luu `tax_selling_price` va `taxable_quantity`
- bao cao phai uu tien allocation

Danh dau:

- `tax_price_source = receipt_item_exact`
- `tax_price_accuracy = exact` hoac `mixed`

### 3. Sua `tax_selling_price` tren phieu nhap da duyet

Rule nghiep vu:

- Cho phep sua tren phieu nhap `approved/completed`
- Chi hoa don sau cutover da an tu lo do moi bi cap nhat lai
- Hoa don truoc cutover giu nguyen snapshot legacy

Tac dong:

- Rebuild `allocation.tax_selling_price`
- Rebuild `sales_invoice_items.tax_selling_price` neu can
- Rebuild du lieu report `/reports/tax-revenue`

## Chien luoc migration va backfill

### Phase 1: DB migration

Them cot moi:

- `inventory_receipt_items.tax_selling_price`
- `inventory_receipt_items.tax_price_source`
- `sales_invoice_item_stock_allocations.taxable_quantity`
- `sales_invoice_item_stock_allocations.tax_selling_price`
- `sales_invoice_item_stock_allocations.tax_price_source`
- `sales_invoice_items.tax_price_accuracy`

Tat ca nen nullable o giai doan dau.

### Phase 2: FE/BE cho phieu nhap moi

Can lam:

- Them input `tax_selling_price` vao man hinh phieu nhap
- Validate theo `taxable_quantity`
- Save vao `inventory_receipt_items`
- Khong auto-fill gia tu product

Moc cutover de xuat:

- Chot 1 moc cutover ro rang khi release
- Chi hoa don tao sau moc nay moi ap dung logic theo lo

### Phase 3: Update luong ban hang

Can lam:

- Luc tru kho, luu `taxable_quantity` va `tax_selling_price` vao allocation
- Tinh lai `sales_invoice_items.tax_selling_price` tu allocation
- Set `tax_price_accuracy`

### Phase 4: Xu ly legacy

Can backfill snapshot 1 lan cho hoa don cu.

Can lam:

- Chot cach xac dinh invoice legacy:
  - theo `sale_date < cutoverDate`
  - hoac theo khong co allocation tax price
- Backfill gia theo thu tu:
  1. `receipt_item.tax_selling_price`
  2. `product.tax_selling_price`
  3. `unknown`
- Luu snapshot vao du lieu report / allocation / item theo thiet ke cuoi cung
- Danh dau `tax_price_accuracy = estimated`

### Phase 5: Refactor report

Can lam:

- Bao cao `tax-revenue` uu tien doc allocation
- Neu allocation khong du:
  - neu invoice truoc cutover -> doc snapshot legacy da backfill
  - neu invoice sau cutover -> canh bao du lieu loi hoac fallback tam voi nhan `unknown`
- Xuat kem thong tin chat luong du lieu neu can

## Tieu chi chap nhan

1. Du lieu moi

- Tao phieu nhap co `taxable_quantity` va `tax_selling_price`
- Ban ra 1 dong an tu 1 lo -> bao cao tinh dung gia lo do
- Ban ra 1 dong an tu nhieu lo -> bao cao tinh bang tong allocation, khong mat so

2. Du lieu cu

- Invoice cu duoc snapshot/backfill 1 lan roi giu nguyen
- Invoice cu duoc danh dau `estimated`
- Thu tu backfill la `receipt item -> product -> unknown`

3. Khong hoi quy logic ton thue

- `taxable_quantity_stock` van tinh dung theo FIFO
- `sync taxable` khong con phu thuoc vao `product.tax_selling_price`

## Impact files du kien

- `src/entities/inventory-receipt-items.entity.ts`
- `src/entities/sales-invoice-item-stock-allocations.entity.ts`
- `src/entities/sales-invoice-items.entity.ts`
- `src/modules/inventory/dto/create-inventory-receipt.dto.ts`
- `src/modules/inventory/inventory.service.ts`
- `src/modules/sales/sales.service.ts`
- `src/modules/store-profit-report/store-profit-report.service.ts`
- `src/pages/inventory/...` o admin FE
- `src/pages/sales-invoices/...` neu can hien thi accuracy / weighted tax price
- `src/pages/reports/tax-revenue/...` o admin FE

## De xuat rollout thuc te

1. Lam phase du lieu moi truoc

- Them field vao phieu nhap
- Luu allocation tax theo lo
- Sua report uu tien allocation

2. Chot legacy bang snapshot 1 lan

- Du lieu cu van xem duoc va khong doi nua
- Bao cao can phan biet `estimated` va `exact`

3. Ho tro sua phieu nhap da duyet cho du lieu moi

- Cho phep sua `tax_selling_price`
- Khi sua thi cap nhat lai report `tax-revenue` cho cac hoa don sau cutover bi anh huong

## Ket luan

Huong "luu gia ban khai thue theo lo nhap" la dung.

Nhung de dat do chinh xac thuc su, can di het 2 buoc:

- luu gia khai thue o `inventory_receipt_items`
- luu snapshot gia khai thue o `sales_invoice_item_stock_allocations`

Voi hoa don cu, khong can co gang suy nguoc gia theo lo. Cach dung la:

- hoa don truoc cutover -> backfill 1 lan theo `receipt item -> product -> unknown`, roi freeze
- hoa don sau cutover -> dung gia theo `inventory_receipt_items` va allocation
- chi sua report `/reports/tax-revenue` trong phase nay
