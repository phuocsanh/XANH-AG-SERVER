# Hướng Dẫn Cập Nhật Frontend: Đồng Bộ Dữ Liệu API (Enriched Responses)

Tài liệu này hướng dẫn chi tiết cho đội Frontend (FE) về các thay đổi mới nhất trên Backend (BE). Hiện tại, hầu hết các API trả về danh sách hoặc chi tiết đã được cập nhật để **trả kèm thông tin đối tượng liên quan (name, code...)** thay vì chỉ trả về ID.

---

## 1. Nguyên Tắc Chung & Mục Tiêu

*   **Trước đây:** API chỉ trả về `abc_id` (VD: `customer_id: 123`). FE phải gọi thêm API `getCustomer(123)` hoặc map từ một danh sách `customers` đã tải trước đó để hiển thị tên.
*   **Hiện tại:** API trả về cả `abc_id` VÀ đối tượng `abc` (VD: `customer: { id: 123, name: "Nguyễn Văn A", ... }`).
*   **Hành động của FE:**
    1.  **Cập nhật Types/Interfaces:** Thêm field object vào interface (VD: thêm `customer?: Customer;` vào `SalesInvoice`).
    2.  **Xóa các API call thừa:** Không cần gọi `getById` cho các trường hiển thị danh sách nữa.
    3.  **Hiển thị trực tiếp:** Sửa binding từ `getLabelById(item.customer_id)` thành `item.customer?.name`.

---

## 2. Chi Tiết Các Module Cần Cập Nhật

Dưới đây là danh sách chi tiết các module đã thay đổi và các trường dữ liệu mới có sẵn.

### 2.1. Nhóm Kinh Doanh & Tài Chính (Sales, Debt, Payment)

#### **A. Hóa Đơn Bán Hàng (Sales Invoice)**
*   **API:** `/sales/invoices`, `/sales/invoices/search`, `/sales/invoices/:id`
*   **Dữ liệu thêm vào:**
    *   `creator`: (User) Thông tin người tạo (`account`, `full_name`...).
    *   `customer`: (Customer) Thông tin khách hàng (`name`, `phone`...).
    *   `season`: (Season) Thông tin mùa vụ (`name`, `code`).
    *   `rice_crop`: (RiceCrop) Thông tin vụ lúa (`field_name`, `plot_code`).
*   **Việc cần làm:** Hiển thị người tạo, tên khách, tên ruộng, tên vụ ngay trên bảng danh sách mà không cần lookup.

#### **B. Công Nợ (Debt Note)**
*   **API:** `/debt-notes/search`
*   **Dữ liệu thêm vào:**
    *   `creator`: (User) Người tạo phiếu.
    *   `customer`: (Customer) Khách hàng.
    *   `season`: (Season) Mùa vụ.
*   **Việc cần làm:** Cập nhật bảng công nợ để hiển thị tên khách và vụ mùa trực tiếp.

#### **C. Phiếu Thu (Payment)**
*   **API:** `/payments/search`
*   **Dữ liệu thêm vào:**
    *   `creator`: (User) Người thu tiền.
    *   `customer`: (Customer) Khách hàng nộp tiền.

#### **D. Trả Hàng (Sales Return)**
*   **API:** `/sales-return`, `/sales-return/search`
*   **Dữ liệu thêm vào:**
    *   `invoice`: (SalesInvoice) Hóa đơn gốc.
    *   `customer`: (Customer) Khách trả hàng.
    *   `creator`: (User) Người tạo phiếu trả.

---

### 2.2. Nhóm Kho & Sản Phẩm (Inventory & Product)

#### **A. Sản Phẩm (Product)**
*   **API:** `/products`, `/products/search`, `/products/:id`... (Tất cả các API lấy sản phẩm)
*   **Dữ liệu thêm vào:**
    *   `unit`: (Unit) Đơn vị tính (`name` như "Chai", "Gói", "Thùng").
    *   `symbol`: (Symbol) Ký hiệu sản phẩm.
*   **Việc cần làm:** Thay vì chỉ hiện `unit_id`, hãy hiện `product.unit?.name`.

#### **B. Loại Phụ Sản Phẩm (Product Subtype)**
*   **API:** `/product-subtypes`
*   **Dữ liệu thêm vào:**
    *   `product_type`: (ProductType) Loại sản phẩm cha.

#### **C. Kho - Lô Hàng (Inventory Batch)**
*   **API:** `/inventory/batches`, `/inventory/batches/search`
*   **Dữ liệu thêm vào:**
    *   `product`: (Product) Thông tin sản phẩm.
    *   `supplier`: (Supplier) Nhà cung cấp.

#### **D. Kho - Phiếu Nhập (Inventory Receipt)**
*   **API:** `/inventory/receipts`, `/inventory/receipts/search`, `/inventory/receipts/:id`
*   **Dữ liệu thêm vào:**
    *   `supplier`: (Supplier) Nhà cung cấp.
    *   `creator`: (User) Người nhập kho.
    *   `items.product`: (Product) Thông tin sản phẩm trong từng dòng chi tiết (với `findOne`).

#### **E. Nhà Cung Cấp (Supplier)**
*   **API:** `/suppliers`, `/suppliers/search`
*   **Dữ liệu thêm vào:**
    *   `creator`: (User) Người tạo nhà cung cấp.

---

### 2.3. Nhóm Canh Tác (Rice Crop Ecosystem)

*   **Lưu ý chung:** Các API trong nhóm này trước đây thường chỉ trả về `rice_crop_id`. Nay đã trả về object `rice_crop`.

#### **A. Nhật Ký Canh Tác (Application Record)**
*   **API:** `/application-records/crop/:id`, `/application-records/:id`
*   **Dữ liệu thêm vào:** `rice_crop` (Thông tin vụ lúa).

#### **B. Lịch Canh Tác (Farming Schedule)**
*   **API:** `/farming-schedules/crop/:id`, `/farming-schedules/:id`
*   **Dữ liệu thêm vào:** `rice_crop`.

#### **C. Theo Dõi Sinh Trưởng (Growth Tracking)**
*   **API:** `/growth-tracking/crop/:id`, `/growth-tracking/:id`
*   **Dữ liệu thêm vào:** `rice_crop`.

#### **D. Vụ Lúa (Rice Crop)**
*   **API:** `/rice-crops`, `/rice-crops/search`
*   **Dữ liệu thêm vào:**
    *   `customer`: (Customer) Chủ ruộng.
    *   `season`: (Season) Mùa vụ.

---

## 3. Ví Dụ JSON Response Mới (Before vs After)

**Ví dụ: Lấy danh sách Hóa Đơn (`SalesInvoice`)**

**🔴 Trước đây (OLD):**
```json
{
  "id": 101,
  "code": "INV-001",
  "customer_id": 55,       // <--- Chỉ có ID
  "season_id": 2,          // <--- Chỉ có ID
  "created_by": 1,         // <--- Chỉ có ID
  "total_amount": 5000000
}
```

**🟢 Bây giờ (NEW):**
```json
{
  "id": 101,
  "code": "INV-001",
  "customer_id": 55,
  "season_id": 2,
  "created_by": 1,
  "total_amount": 5000000,
  
  // ✅ Dữ liệu mới được join thêm:
  "customer": {
    "id": 55,
    "name": "Nguyễn Văn A",
    "phone": "0909123456"
  },
  "season": {
    "id": 2,
    "name": "Đông Xuân 2024",
    "code": "DX24"
  },
  "creator": {
    "id": 1,
    "account": "admin",
    "full_name": "Quản trị viên"
  }
}
```

## 4. Checklist Cho FE Developer

1.  [ ] **Kiểm tra Interface:** Mở file types/interface (ví dụ `sales-invoice.interface.ts`) và thêm các optional fields (`customer?`, `season?`, `creator?`...).
2.  [ ] **Review List Pages:** Xem lại các trang danh sách (List Page). Những cột nào đang hiển thị ID hoặc đang phải dùng hàm `findNameById` thì switch sang dùng biến trong object mới.
3.  [ ] **Xóa Lookup Calls:** Tìm các đoạn code `useEffect` gọi API phụ (ví dụ `userService.getAll()`, `customerService.getAll()`) chỉ để lấy danh sách map tên. Nếu không dùng cho việc filter dropdown thì có thể xóa để nhẹ app.
4.  [ ] **Test hiển thị:** Đảm bảo null check (ví dụ: `invoice.creator?.account || 'N/A'`) để tránh lỗi render nếu dữ liệu cũ chưa có liên kết.
