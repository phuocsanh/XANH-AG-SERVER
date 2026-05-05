# Seed Rice Costing Implementation Plan

## Muc tieu

Ho tro nhom san pham dac thu nhu lua giong, trong do gia von khong co dinh theo phieu nhap ma duoc chot theo hinh thuc ban:

- Ban tien mat: gia von `cash_cost_price`
- Ban no: gia von `credit_cost_price`

Tat ca san pham khac van giu luong hien tai voi `average_cost_price`.

## Van de hien tai

He thong hien tai co cac dac diem sau:

- `products.average_cost_price` dang la gia von duy nhat cua san pham
- `sales_invoice_items` chua luu gia von tai thoi diem ban
- `sales.service.ts` tinh `invoice.cost_of_goods_sold` bang `product.average_cost_price`
- `sales-return.service.ts` dang hoan gia von dua vao `invoiceItem.product.average_cost_price`
- `store-profit-report.service.ts` va `supplier-report.service.ts` dang dung `product.average_cost_price` de tinh loi nhuan hoac fallback

He qua:

- Khong xu ly dung duoc san pham co gia von theo `price_type`
- Rui ro sai so khi doi gia san pham sau nay
- Tra hang va cac bao cao loi nhuan de bi lech

## Nguyen tac nghiep vu can chot

1. San pham thuong:
- Gia von van lay theo `average_cost_price`
- Luong nhap kho, WAC, bao cao ton kho giu nguyen

2. San pham dac thu nhu lua giong:
- Khong lay mot gia von co dinh de tinh loi nhuan ban hang
- Gia von phai duoc chot theo tung dong ban hang
- Sau khi da ban, gia von cua dong do phai bat bien

3. Bao cao loi nhuan:
- Khong doc nguoc lai `product.average_cost_price` cho du lieu lich su
- Uu tien doc `sales_invoice_items.cost_price`
- Neu can tong hop o cap hoa don thi dung `sales_invoices.cost_of_goods_sold`

## Thiet ke du lieu de xuat

### 1. Products

Them cac cot moi vao bang `products`:

- `costing_method`: `fixed | by_price_type`
- `cash_cost_price`: nullable
- `credit_cost_price`: nullable

Y nghia:

- `fixed`: san pham binh thuong, dung `average_cost_price`
- `by_price_type`: san pham nhu lua giong, gia von theo `price_type`

Validation:

- Neu `costing_method = fixed`:
  - bat buoc `average_cost_price` hoac luong nhap kho sinh ra WAC nhu hien tai
- Neu `costing_method = by_price_type`:
  - bat buoc `cash_cost_price`
  - bat buoc `credit_cost_price`
  - `average_cost_price` chi la optional / tham chieu, khong duoc dung de tinh loi nhuan ban hang

### 2. Sales invoice items

Them cac cot moi vao bang `sales_invoice_items`:

- `price_type`: `cash | credit`
- `cost_price`: gia von cua dong tai thoi diem ban
- `costing_method_snapshot`: `fixed | by_price_type`

Ghi chu:

- `price_type` hien dang co o FE form, nhung item entity/DTO BE chua luu snapshot ro rang
- `cost_price` la cot quan trong nhat

### 3. Sales invoices

Khong can them cot moi bat buoc neu da co:

- `cost_of_goods_sold`
- `gross_profit`
- `gross_profit_margin`

Nhung can doi cach tinh de dua tren `item.cost_price` thay vi `product.average_cost_price`.

## Impact DB

### Migration 1: products

Can them:

- `costing_method` varchar/enum, default `fixed`
- `cash_cost_price` numeric nullable
- `credit_cost_price` numeric nullable

### Migration 2: sales_invoice_items

Can them:

- `price_type` varchar/enum nullable hoac not null neu co backfill
- `cost_price` numeric nullable trong giai doan dau
- `costing_method_snapshot` varchar/enum nullable

### Migration 3: backfill du lieu cu

Can co script/backfill cho du lieu lich su:

- `products.costing_method = fixed` cho tat ca du lieu hien tai
- `sales_invoice_items.cost_price`:
  - neu lich su khong co du lieu chi tiet thi tam backfill = `product.average_cost_price` tai thoi diem migrate
  - danh dau ro day la du lieu legacy, khong dam bao dung 100 phan tram
- `sales_invoice_items.costing_method_snapshot = fixed` cho du lieu cu

Can chap nhan:

- Bao cao lich su truoc khi refactor se khong the dat do chinh xac tuyet doi neu truoc day item khong luu gia von

## Impact Backend

### 1. Product entity / dto / service

Files du kien:

- `src/entities/products.entity.ts`
- `src/modules/product/dto/create-product.dto.ts`
- `src/modules/product/dto/update-product.dto.ts`
- `src/modules/product/product.service.ts`

Can lam:

- Them field moi vao entity va DTO
- Validate theo `costing_method`
- Tranh de `updateProductAverageCostAndPrice()` ghi de logic dac thu cua `by_price_type`

Luu y:

- Cac ham tinh `suggested_price`, `inventory value`, `indirect cost` hien dang dua tren `average_cost_price`
- Can quyet dinh ro:
  - giu nguyen cho `fixed`
  - voi `by_price_type` thi dung `average_cost_price` chi de phuc vu ton kho / tham chieu, khong phuc vu loi nhuan ban hang

### 2. Sales create invoice

Files du kien:

- `src/modules/sales/dto/create-sales-invoice.dto.ts`
- `src/entities/sales-invoice-items.entity.ts`
- `src/modules/sales/sales.service.ts`

Can lam:

- FE/BE phai truyen va luu `price_type` tren tung item
- Khi tao item:
  - neu product `costing_method = fixed` -> `item.cost_price = product.average_cost_price`
  - neu product `costing_method = by_price_type`:
    - `price_type = cash` -> `item.cost_price = product.cash_cost_price`
    - `price_type = credit` -> `item.cost_price = product.credit_cost_price`
- Luu `item.costing_method_snapshot`
- Tinh `invoice.cost_of_goods_sold = sum(base_quantity * item.cost_price)`
- Tinh `gross_profit` tu tong item

Tuyet doi khong:

- Tinh lai COGS bang `product.average_cost_price` trong luc save invoice

### 3. Sales return

Files du kien:

- `src/modules/sales-return/sales-return.service.ts`

Can lam:

- Khi tra hang, giam COGS theo `invoiceItem.cost_price`
- Khong doc `invoiceItem.product.average_cost_price`

Logic:

- `returnedCOGS = returnQtyBase * invoiceItem.cost_price`

Neu co quy doi don vi:

- phai dung `base_quantity`/`conversion_factor` nhat quan voi luong ban dau

### 4. Store profit report

Files du kien:

- `src/modules/store-profit-report/store-profit-report.service.ts`

Can lam:

- Uu tien dung `invoice.cost_of_goods_sold`
- Moi noi tinh toi level item:
  - dung `item.cost_price`
  - khong dung `item.product.average_cost_price`
- Cac doan fallback legacy can doi de fallback tu `item.cost_price`, neu null thi moi canh bao va dung `average_cost_price`

Day la vung anh huong lon nhat vi file nay dang co nhieu cho tinh lai cost theo item.

### 5. Supplier report

Files du kien:

- `src/modules/supplier-report/supplier-report.service.ts`

Can lam:

- Dung `item.cost_price` thay cho `item.product.average_cost_price`

### 6. Profit report cho ruong lua

Files du kien:

- `src/modules/profit-report/profit-report.service.ts`

Danh gia:

- Module nay hien lay `salesInvoice.final_amount` lam chi phi vat tu cua nong dan
- Khong phu thuoc truc tiep vao gia von cua cua hang
- Co the khong can sua ngay cho case lua giong

## Impact Frontend

### 1. Product model / form / validation

Files du kien:

- `XANH-AG-REACTJS-ADMIN/src/models/product.model.ts`
- `XANH-AG-REACTJS-ADMIN/src/pages/products/components/form-config.ts`
- `XANH-AG-REACTJS-ADMIN/src/pages/products/components/product-form.tsx`

Can lam:

- Them field:
  - `costing_method`
  - `cash_cost_price`
  - `credit_cost_price`
- Form hien/validation theo `costing_method`

Rule:

- `fixed`:
  - show/trust `average_cost_price`
- `by_price_type`:
  - hide hoac downgrade yeu cau cua `average_cost_price`
  - bat buoc `cash_cost_price`, `credit_cost_price`

### 2. Sales invoice form

Files du kien:

- `src/pages/sales-invoices/form-config.ts`
- `src/pages/sales-invoices/create.tsx`
- `src/pages/sales-invoices/components/ProductsTable.tsx`
- `src/models/sales-invoice.ts`

Can lam:

- Moi item phai co `price_type`
- Preview loi nhuan FE phai tinh theo `item.cost_price` hoac theo rule cua product
- Khi add san pham vao hoa don:
  - neu `fixed` -> cost preview = `average_cost_price`
  - neu `by_price_type` -> cost preview doi theo `price_type`
- Khi user doi `price_type`, phai doi:
  - `unit_price`
  - `item.cost_price`
  - preview loi nhuan

### 3. Profit reports UI

Files du kien:

- `src/pages/profit-reports/index.tsx`
- `src/pages/suppliers/supplier-stats.tsx`

Can lam:

- Chu yeu la dam bao model API moi map du du lieu
- Neu API tra chi phi theo item/hieu chinh moi, FE chi can render dung

## Chien luoc trien khai an toan

### Phase 1: Data model

1. Them cot moi cho `products`
2. Them cot moi cho `sales_invoice_items`
3. Release migration
4. Backfill du lieu cu

### Phase 2: Write path

1. Sua product create/update
2. Sua sales create invoice
3. Dam bao moi hoa don moi deu luu `item.cost_price`

### Phase 3: Return path

1. Sua sales return de dung `item.cost_price`
2. Test tra hang mot phan, tra hang toan phan, tra hang sau khi doi gia san pham

### Phase 4: Reports

1. Sua store profit report
2. Sua supplier report
3. Review tat ca noi fallback dang doc `average_cost_price`

### Phase 5: UI hardening

1. Product form
2. Sales invoice preview
3. Validation / tooltip / label de user khong nhap sai

## Du lieu lich su

Can note ro:

- Hoa don cu khong co `item.cost_price`
- Sau migration, chi co the backfill gan dung
- Bao cao lich su truoc thoi diem refactor co the khong dat do chinh xac 100 phan tram cho cac san pham dac thu

Neu can bao cao chinh xac tuyet doi cho lich su:

- phai co nguon doi soat ngoai he thong
- hoac script chuyen doi du lieu dua tren quy tac nghiep vu cu the

## Test cases bat buoc

### A. Sales invoice

1. San pham `fixed`
- Ban 10 don vi
- COGS = `base_quantity * average_cost_price`

2. San pham `by_price_type` ban tien mat
- `price_type = cash`
- COGS = `base_quantity * cash_cost_price`

3. San pham `by_price_type` ban no
- `price_type = credit`
- COGS = `base_quantity * credit_cost_price`

4. Doi `price_type` tren cung mot dong
- `unit_price` doi dung
- `cost_price` doi dung
- preview loi nhuan doi dung

### B. Sales return

1. Tra mot phan cua don `cash`
- giam doanh thu dung
- giam COGS theo `cash_cost_price`

2. Tra mot phan cua don `credit`
- giam COGS theo `credit_cost_price`

3. Sau khi sua gia tren product
- tra hang van phai dung `cost_price` cu cua item

### C. Reports

1. Store profit report theo hoa don
- doanh thu, gia von, loi nhuan khop voi item snapshot

2. Store profit report theo mua vu
- tong hop khop voi tong hoa don

3. Supplier report
- total_cost, profit, margin khop voi cost snapshot

### D. Regression

1. Hang thuong khong bi thay doi luong cu
2. Nhap kho va WAC van tinh duoc cho hang `fixed`
3. Print invoice, delivery, debt note khong vo

## Quy tac quyet dinh

Trong moi tinh toan lien quan den loi nhuan:

- Du lieu lich su cua giao dich ban hang phai uu tien snapshot tren `sales_invoice_items`
- Khong duoc doc nguoc tu `products` neu giao dich da phat sinh

## Ket luan

Refactor nay khong phai chi la them 2 field gia von cho lua giong. Day la viec bo sung "cost snapshot at sale time" cho toan bo luong tinh loi nhuan.

Neu chi sua form san pham ma khong sua:

- `sales.service.ts`
- `sales-return.service.ts`
- `store-profit-report.service.ts`
- `supplier-report.service.ts`

thi he thong van co nguy co sai loi nhuan va sai tra hang.
