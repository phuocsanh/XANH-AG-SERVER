# 🏭 Module Kho Hàng (Inventory)

**Trạng thái**: ✅ SẴN SÀNG CHO FRONTEND

---

## 🔗 Mối Quan Hệ
- **Product**: Inventory quản lý số lượng của Product.
- **Sales**: Khi bán hàng, Inventory sẽ tự động giảm (theo nguyên tắc FIFO - nhập trước xuất trước).
- **Supplier**: Nhập kho từ nhà cung cấp.

---

## 📝 Data Structures (DTO)

### 1. Inventory Status (Response)
```typescript
interface InventoryStatus {
  product_id: number;
  product_name: string;
  product_code: string;
  unit_name: string;
  total_quantity: number; // Tổng tồn kho hiện tại
  batches: InventoryBatch[]; // Chi tiết từng lô
}

interface InventoryBatch {
  id: number;
  batch_code: string;     // Mã lô
  quantity: number;       // Số lượng còn lại trong lô
  expiry_date: string;    // Hạn sử dụng
  import_date: string;    // Ngày nhập
}
```

### 2. Import Receipt (Phiếu Nhập Kho Request)
```typescript
interface CreateInventoryReceiptDto {
  supplier_id: number;    // Nhà cung cấp
  import_date: string;    // Ngày nhập (ISO Date)
  notes?: string;
  items: ImportItem[];
}

interface ImportItem {
  product_id: number;
  quantity: number;       // Số lượng nhập
  unit_price: number;     // Giá nhập đơn vị
  batch_code?: string;    // Mã lô (Optional, hệ thống có thể tự sinh)
  expiry_date?: string;   // Hạn sử dụng (Optional)
}
```

---

## 🚀 API Endpoints & Examples

### 1. Xem Tồn Kho (Dashboard Kho)
**GET** `/inventory`

**Response**:
```json
[
  {
    "product_id": 1,
    "product_name": "Phân NPK Phú Mỹ",
    "total_quantity": 150,
    "unit": "Bao",
    "warning_level": "safe" // safe, low, out_of_stock
  },
  {
    "product_id": 2,
    "product_name": "Thuốc Rùa Vàng",
    "total_quantity": 5,
    "unit": "Chai",
    "warning_level": "low"
  }
]
```

### 2. Nhập Kho (Tạo Phiếu Nhập)
**POST** `/inventory/receipt`

**Body**:
```json
{
  "supplier_id": 1,
  "import_date": "2024-11-25",
  "notes": "Nhập hàng vụ Đông Xuân",
  "items": [
    {
      "product_id": 1,
      "quantity": 100,
      "unit_price": 800000,
      "expiry_date": "2025-11-25"
    }
  ]
}
```

---

## 💡 Logic Nghiệp Vụ Frontend Cần Biết
1. **FIFO (First-In, First-Out)**: Khi bán hàng (Sales), hệ thống sẽ tự động trừ số lượng từ các lô hàng cũ nhất (có `import_date` cũ nhất). Frontend không cần chọn lô để xuất, chỉ cần gửi `product_id` và `quantity`.
2. **Validation**: Không thể bán quá số lượng tồn kho hiện có. API Sales sẽ trả về lỗi `400 Bad Request` nếu thiếu hàng.
