# 📦 Module Sản Phẩm (Product)

**Trạng thái**: ✅ SẴN SÀNG CHO FRONTEND

---

## 🔗 Mối Quan Hệ
- **Inventory**: Sản phẩm được theo dõi tồn kho trong module `inventory`.
- **Sales**: Sản phẩm là item trong hóa đơn bán hàng.
- **Unit**: Đơn vị tính (Chai, Gói, Bao...).
- **ProductType/Subtype**: Phân loại sản phẩm.

---

## 📝 Data Structures (DTO)

### 1. Product Object (Response)
```typescript
interface Product {
  id: number;
  code: string;           // Mã SP (VD: "NPK-001")
  name: string;           // Tên SP
  type_id: number;        // ID Loại SP
  subtype_id: number;     // ID Loại phụ
  unit_id: number;        // ID Đơn vị tính
  price: number;          // Giá bán
  cost_price: number;     // Giá vốn
  description: string;
  images: string[];       // Array URL ảnh
  is_active: boolean;
  
  // Relations (thường được include)
  unit?: { id: number, name: string };
  type?: { id: number, name: string };
  inventory_quantity?: number; // Số lượng tồn kho hiện tại (nếu join)
}
```

### 2. Create Product (Request)
```typescript
interface CreateProductDto {
  code: string;           // Required, Unique
  name: string;           // Required
  type_id: number;        // Required
  subtype_id: number;     // Required
  unit_id: number;        // Required
  price: number;          // Required, min 0
  cost_price?: number;    // Optional, min 0
  description?: string;
  images?: string[];      // Optional
}
```

---

## 🚀 API Endpoints & Examples

### 1. Lấy Danh Sách Sản Phẩm (Có Phân Trang & Lọc)
**GET** `/products`

**Query Params**:
- `page`: number (default 1)
- `limit`: number (default 10)
- `search`: string (tìm theo tên hoặc code)
- `type_id`: number (lọc theo loại)

**Response**:
```json
{
  "data": [
    {
      "id": 1,
      "code": "NPK-PHU-MY",
      "name": "Phân NPK Phú Mỹ 16-16-8",
      "price": 850000,
      "unit": { "id": 1, "name": "Bao 50kg" },
      "type": { "id": 1, "name": "Phân bón" },
      "images": ["https://res.cloudinary.com/.../npk.jpg"]
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "last_page": 5
  }
}
```

### 2. Tạo Sản Phẩm Mới
**POST** `/products`

**Body**:
```json
{
  "code": "TS-RUA-VANG",
  "name": "Thuốc trừ sâu Rùa Vàng",
  "type_id": 2,      // Thuốc BVTV
  "subtype_id": 5,   // Thuốc trừ sâu
  "unit_id": 2,      // Chai
  "price": 120000,
  "cost_price": 95000,
  "description": "Đặc trị sâu cuốn lá",
  "images": []
}
```

---

## 💡 Lưu Ý Cho Frontend
1. **Dropdown Data**: Trước khi tạo Product, cần gọi các API sau để lấy dữ liệu cho Dropdown:
   - `GET /product-types`
   - `GET /product-subtypes`
   - `GET /units`
2. **Upload Ảnh**: Upload ảnh qua API `/upload` trước, lấy URL rồi mới gửi vào `images` array khi tạo Product.
