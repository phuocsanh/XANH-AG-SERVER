# Hướng Dẫn Frontend: Tích Hợp Phí Vận Chuyển Phiếu Nhập Kho

## 📋 Tổng quan

Tài liệu này hướng dẫn Frontend tích hợp chức năng **Phí Vận Chuyển** vào form tạo/sửa phiếu nhập kho.

Hệ thống hỗ trợ 2 phương thức nhập phí vận chuyển:
1. **Phí riêng**: Mỗi sản phẩm có phí vận chuyển riêng
2. **Phí chung**: Một khoản phí chung được chia đều cho tất cả sản phẩm

---

## 🔧 API Endpoint

**POST** `/inventory/receipt`

### Request Body Structure

```typescript
interface CreateInventoryReceiptDto {
  receipt_code: string;              // Mã phiếu nhập (bắt buộc)
  supplier_id: number;               // ID nhà cung cấp (bắt buộc)
  total_amount: number;              // Tổng tiền (bắt buộc)
  status: string;                    // Trạng thái: draft, approved, completed (bắt buộc)
  created_by: number;                // ID người tạo (bắt buộc)
  notes?: string;                    // Ghi chú (tùy chọn)
  
  // ===== TRƯỜNG MỚI =====
  shared_shipping_cost?: number;     // Phí vận chuyển chung (tùy chọn)
  shipping_allocation_method?: 'by_value' | 'by_quantity'; // Phương thức phân bổ (tùy chọn)
  
  items: CreateInventoryReceiptItemDto[]; // Danh sách sản phẩm
}

interface CreateInventoryReceiptItemDto {
  product_id: number;                // ID sản phẩm (bắt buộc)
  quantity: number;                  // Số lượng (bắt buộc)
  unit_cost: number;                 // Giá nhập đơn vị (bắt buộc)
  total_price: number;               // Tổng tiền = quantity * unit_cost (bắt buộc)
  notes?: string;                    // Ghi chú (tùy chọn)
  
  // ===== TRƯỜNG MỚI =====
  individual_shipping_cost?: number; // Phí vận chuyển riêng cho sản phẩm này (tùy chọn)
}
```

---

## 🎨 UI/UX Design

### 1. Form Layout

```
┌─────────────────────────────────────────────────────────────┐
│ TẠO PHIẾU NHẬP KHO                                          │
├─────────────────────────────────────────────────────────────┤
│ Mã phiếu: [PN-001        ]  Nhà cung cấp: [Dropdown ▼]    │
│ Trạng thái: [Draft ▼]      Ghi chú: [____________]         │
├─────────────────────────────────────────────────────────────┤
│ DANH SÁCH SẢN PHẨM                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Sản phẩm │ SL │ Giá nhập │ Phí VC riêng │ Tổng tiền   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ NPK 20   │100 │ 100,000  │ 50,000       │ 10,000,000  │ │
│ │ Phân DAP │ 50 │ 200,000  │ 0            │ 10,000,000  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [+ Thêm sản phẩm]                                           │
├─────────────────────────────────────────────────────────────┤
│ PHÍ VẬN CHUYỂN CHUNG (Tùy chọn)                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☐ Có phí vận chuyển chung                               │ │
│ │                                                          │ │
│ │ Số tiền: [1,000,000 VND]                                │ │
│ │                                                          │ │
│ │ Phương thức phân bổ:                                    │ │
│ │ ○ Theo giá trị (sản phẩm đắt chịu phí nhiều hơn)       │ │
│ │ ● Theo số lượng (chia đều)                              │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ TỔNG CỘNG                                                   │
│ Tổng tiền hàng:        20,000,000 VND                      │
│ Phí vận chuyển riêng:      50,000 VND                      │
│ Phí vận chuyển chung:   1,000,000 VND                      │
│ ─────────────────────────────────────────                  │
│ TỔNG THANH TOÁN:       21,050,000 VND                      │
├─────────────────────────────────────────────────────────────┤
│                    [Hủy]  [Lưu nháp]  [Tạo phiếu]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Code Example (React + Ant Design)

### 1. State Management

```typescript
import { useState } from 'react';
import { Form, Input, InputNumber, Select, Radio, Checkbox, Table, Button } from 'antd';

interface ReceiptItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  individual_shipping_cost: number;
  total_price: number;
}

const CreateReceiptForm = () => {
  const [form] = Form.useForm();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [hasSharedShipping, setHasSharedShipping] = useState(false);
  const [sharedShippingCost, setSharedShippingCost] = useState(0);
  const [allocationMethod, setAllocationMethod] = useState<'by_value' | 'by_quantity'>('by_value');

  // Tính tổng tiền
  const calculateTotals = () => {
    const totalProductValue = items.reduce((sum, item) => sum + item.total_price, 0);
    const totalIndividualShipping = items.reduce((sum, item) => sum + (item.individual_shipping_cost || 0), 0);
    const totalSharedShipping = hasSharedShipping ? sharedShippingCost : 0;
    
    return {
      totalProductValue,
      totalIndividualShipping,
      totalSharedShipping,
      grandTotal: totalProductValue + totalIndividualShipping + totalSharedShipping,
    };
  };

  const handleSubmit = async (values: any) => {
    const payload = {
      receipt_code: values.receipt_code,
      supplier_id: values.supplier_id,
      total_amount: calculateTotals().grandTotal,
      status: values.status || 'draft',
      created_by: 1, // Lấy từ auth context
      notes: values.notes,
      
      // Phí vận chuyển chung (chỉ gửi nếu có)
      ...(hasSharedShipping && {
        shared_shipping_cost: sharedShippingCost,
        shipping_allocation_method: allocationMethod,
      }),
      
      items: items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_price: item.total_price,
        
        // Phí vận chuyển riêng (chỉ gửi nếu có)
        ...(item.individual_shipping_cost > 0 && {
          individual_shipping_cost: item.individual_shipping_cost,
        }),
      })),
    };

    try {
      const response = await fetch('/api/inventory/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        message.success('Tạo phiếu nhập kho thành công!');
        // Redirect hoặc reset form
      }
    } catch (error) {
      message.error('Có lỗi xảy ra!');
    }
  };

  return (
    <Form form={form} onFinish={handleSubmit} layout="vertical">
      {/* Form fields cho thông tin phiếu nhập */}
      
      {/* Bảng danh sách sản phẩm */}
      <ProductTable items={items} setItems={setItems} />
      
      {/* Phần phí vận chuyển chung */}
      <Card title="Phí Vận Chuyển Chung" style={{ marginTop: 16 }}>
        <Checkbox 
          checked={hasSharedShipping}
          onChange={(e) => setHasSharedShipping(e.target.checked)}
        >
          Có phí vận chuyển chung
        </Checkbox>
        
        {hasSharedShipping && (
          <>
            <Form.Item label="Số tiền" style={{ marginTop: 16 }}>
              <InputNumber
                value={sharedShippingCost}
                onChange={(value) => setSharedShippingCost(value || 0)}
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                style={{ width: '100%' }}
                addonAfter="VND"
              />
            </Form.Item>
            
            <Form.Item label="Phương thức phân bổ">
              <Radio.Group 
                value={allocationMethod}
                onChange={(e) => setAllocationMethod(e.target.value)}
              >
                <Radio value="by_value">
                  Theo giá trị (sản phẩm đắt chịu phí nhiều hơn)
                </Radio>
                <Radio value="by_quantity">
                  Theo số lượng (chia đều)
                </Radio>
              </Radio.Group>
            </Form.Item>
          </>
        )}
      </Card>
      
      {/* Tổng cộng */}
      <TotalSummary totals={calculateTotals()} />
      
      {/* Buttons */}
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Tạo phiếu nhập
        </Button>
      </Form.Item>
    </Form>
  );
};
```

### 2. Product Table Component

```typescript
const ProductTable = ({ items, setItems }: { items: ReceiptItem[], setItems: any }) => {
  const columns = [
    {
      title: 'Sản phẩm',
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (value: number, record: ReceiptItem, index: number) => (
        <InputNumber
          value={value}
          onChange={(newValue) => {
            const newItems = [...items];
            newItems[index].quantity = newValue || 0;
            newItems[index].total_price = newItems[index].quantity * newItems[index].unit_cost;
            setItems(newItems);
          }}
          min={1}
        />
      ),
    },
    {
      title: 'Giá nhập (VND)',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      render: (value: number, record: ReceiptItem, index: number) => (
        <InputNumber
          value={value}
          onChange={(newValue) => {
            const newItems = [...items];
            newItems[index].unit_cost = newValue || 0;
            newItems[index].total_price = newItems[index].quantity * newItems[index].unit_cost;
            setItems(newItems);
          }}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value!.replace(/\$\s?|(,*)/g, '')}
        />
      ),
    },
    {
      title: 'Phí VC riêng (VND)',
      dataIndex: 'individual_shipping_cost',
      key: 'individual_shipping_cost',
      render: (value: number, record: ReceiptItem, index: number) => (
        <InputNumber
          value={value}
          onChange={(newValue) => {
            const newItems = [...items];
            newItems[index].individual_shipping_cost = newValue || 0;
            setItems(newItems);
          }}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={value => value!.replace(/\$\s?|(,*)/g, '')}
          placeholder="0"
        />
      ),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'total_price',
      key: 'total_price',
      render: (value: number) => value.toLocaleString('vi-VN') + ' VND',
    },
    {
      title: '',
      key: 'action',
      render: (_: any, record: ReceiptItem, index: number) => (
        <Button 
          danger 
          onClick={() => {
            const newItems = items.filter((_, i) => i !== index);
            setItems(newItems);
          }}
        >
          Xóa
        </Button>
      ),
    },
  ];

  return (
    <Table
      dataSource={items}
      columns={columns}
      pagination={false}
      rowKey={(record, index) => index?.toString() || '0'}
    />
  );
};
```

### 3. Total Summary Component

```typescript
const TotalSummary = ({ totals }: { totals: any }) => {
  return (
    <Card style={{ marginTop: 16, backgroundColor: '#f5f5f5' }}>
      <div style={{ fontSize: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Tổng tiền hàng:</span>
          <strong>{totals.totalProductValue.toLocaleString('vi-VN')} VND</strong>
        </div>
        
        {totals.totalIndividualShipping > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Phí vận chuyển riêng:</span>
            <strong>{totals.totalIndividualShipping.toLocaleString('vi-VN')} VND</strong>
          </div>
        )}
        
        {totals.totalSharedShipping > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Phí vận chuyển chung:</span>
            <strong>{totals.totalSharedShipping.toLocaleString('vi-VN')} VND</strong>
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: 16, 
          paddingTop: 16, 
          borderTop: '2px solid #d9d9d9',
          fontSize: 18,
        }}>
          <span>TỔNG THANH TOÁN:</span>
          <strong style={{ color: '#1890ff' }}>
            {totals.grandTotal.toLocaleString('vi-VN')} VND
          </strong>
        </div>
      </div>
    </Card>
  );
};
```

---

## 📊 Response từ Server

Khi tạo phiếu nhập thành công, server sẽ trả về:

```json
{
  "id": 123,
  "code": "PN-001",
  "supplier_id": 1,
  "total_amount": 21050000,
  "status": "draft",
  "shared_shipping_cost": 1000000,
  "shipping_allocation_method": "by_value",
  "created_at": "2025-12-03T21:00:00Z",
  "supplier": {
    "id": 1,
    "name": "Nhà cung cấp ABC"
  }
}
```

**Lưu ý:** Response **KHÔNG** bao gồm `items` mặc định. Nếu cần xem chi tiết items, gọi endpoint:

**GET** `/inventory/receipt/:id`

Response sẽ bao gồm:

```json
{
  "id": 123,
  "code": "PN-001",
  "items": [
    {
      "id": 456,
      "product_id": 1,
      "quantity": 100,
      "unit_cost": 100000,
      "individual_shipping_cost": 50000,
      "allocated_shipping_cost": 500000,
      "final_unit_cost": 105500,
      "total_price": 10000000
    }
  ]
}
```

---

## 🧪 Test Cases

### Test Case 1: Chỉ có phí riêng

**Input:**
```json
{
  "receipt_code": "PN-001",
  "supplier_id": 1,
  "total_amount": 10050000,
  "status": "draft",
  "created_by": 1,
  "items": [
    {
      "product_id": 1,
      "quantity": 100,
      "unit_cost": 100000,
      "total_price": 10000000,
      "individual_shipping_cost": 50000
    }
  ]
}
```

**Kết quả:**
- `final_unit_cost` = 100,000 + (50,000 / 100) = **100,500 VND**

---

### Test Case 2: Chỉ có phí chung (chia theo giá trị)

**Input:**
```json
{
  "receipt_code": "PN-002",
  "supplier_id": 1,
  "total_amount": 21000000,
  "status": "draft",
  "created_by": 1,
  "shared_shipping_cost": 1000000,
  "shipping_allocation_method": "by_value",
  "items": [
    {
      "product_id": 1,
      "quantity": 100,
      "unit_cost": 100000,
      "total_price": 10000000
    },
    {
      "product_id": 2,
      "quantity": 50,
      "unit_cost": 200000,
      "total_price": 10000000
    }
  ]
}
```

**Kết quả:**
- Sản phẩm 1: `final_unit_cost` = 100,000 + 5,000 = **105,000 VND**
- Sản phẩm 2: `final_unit_cost` = 200,000 + 10,000 = **210,000 VND**

---

### Test Case 3: Kết hợp phí riêng + phí chung

**Input:**
```json
{
  "receipt_code": "PN-003",
  "supplier_id": 1,
  "total_amount": 20650000,
  "status": "draft",
  "created_by": 1,
  "shared_shipping_cost": 500000,
  "shipping_allocation_method": "by_quantity",
  "items": [
    {
      "product_id": 1,
      "quantity": 100,
      "unit_cost": 100000,
      "total_price": 10000000,
      "individual_shipping_cost": 100000
    },
    {
      "product_id": 2,
      "quantity": 100,
      "unit_cost": 200000,
      "total_price": 20000000
    }
  ]
}
```

**Kết quả:**
- Sản phẩm 1: `final_unit_cost` = 100,000 + 1,000 + 2,500 = **103,500 VND**
- Sản phẩm 2: `final_unit_cost` = 200,000 + 2,500 = **202,500 VND**

---

## ⚠️ Lưu ý quan trọng

1. **Validation:**
   - `shared_shipping_cost` và `individual_shipping_cost` phải >= 0
   - Nếu có `shared_shipping_cost`, bắt buộc phải có `shipping_allocation_method`

2. **Tính tổng tiền:**
   - `total_amount` = Tổng tiền hàng + Tổng phí vận chuyển riêng + Phí vận chuyển chung

3. **Backward Compatibility:**
   - Các trường phí vận chuyển đều là **tùy chọn**
   - Nếu không nhập, hệ thống sẽ hoạt động như cũ (phí = 0)

4. **Hiển thị:**
   - Khi xem chi tiết phiếu nhập, nên hiển thị:
     - `unit_cost`: Giá nhập gốc
     - `individual_shipping_cost`: Phí vận chuyển riêng
     - `allocated_shipping_cost`: Phí vận chuyển được phân bổ
     - `final_unit_cost`: Giá vốn cuối cùng (đã bao gồm phí)

---

## 🎯 Checklist cho Frontend Developer

- [ ] Thêm checkbox "Có phí vận chuyển chung"
- [ ] Thêm input nhập số tiền phí vận chuyển chung
- [ ] Thêm radio button chọn phương thức phân bổ (by_value / by_quantity)
- [ ] Thêm cột "Phí VC riêng" vào bảng sản phẩm
- [ ] Cập nhật logic tính tổng tiền
- [ ] Hiển thị breakdown chi tiết (tiền hàng + phí riêng + phí chung)
- [ ] Validate input (số tiền >= 0)
- [ ] Test với 3 test cases trên
- [ ] Cập nhật màn hình xem chi tiết phiếu nhập để hiển thị thông tin phí vận chuyển

---

## 📞 Hỗ trợ

Nếu có vấn đề, liên hệ Backend team hoặc tham khảo:
- Implementation Plan: `/implementation_plan.md`
- Migration file: `src/database/migrations/1764773425483-add-shipping-cost-to-inventory-receipts.ts`
