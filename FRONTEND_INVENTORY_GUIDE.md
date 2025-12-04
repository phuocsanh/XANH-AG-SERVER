# Hướng Dẫn Frontend: Inventory Management Features

## 📋 Tổng Quan

Tài liệu này hướng dẫn Frontend triển khai các chức năng quản lý kho đã được Backend hoàn thành:

1. **Upload Hình Ảnh Hóa Đơn** - Đính kèm ảnh vào phiếu nhập kho
2. **Phiếu Xuất Trả Hàng (Return)** - Trả hàng lỗi cho nhà cung cấp
3. **Phiếu Điều Chỉnh Kho (Adjustment)** - Điều chỉnh tồn kho nội bộ
4. **Sửa Logic Xóa & Hoàn Thành Phiếu** - Quy trình mới

---

## 🔧 1. Upload Hình Ảnh Hóa Đơn

### API Endpoints

```typescript
// 1. Upload file lên server
POST /upload/image
Content-Type: multipart/form-data
Body: { file: File }
Response: { id: number, url: string, ... }

// 2. Gắn file vào phiếu nhập kho
POST /inventory/receipt/:id/upload-image
Body: { fileId: number, fieldName?: string }

// 3. Xem danh sách ảnh
GET /inventory/receipt/:id/images
Response: Array<{ id, url, name, type, size, created_at }>

// 4. Xóa ảnh
DELETE /inventory/receipt/:id/image/:fileId
```

### TypeScript Types

```typescript
// src/types/inventory.ts
export interface ReceiptImage {
  id: number;
  url: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
}

export interface UploadImageRequest {
  fileId: number;
  fieldName?: string;
}
```

### React Query Hooks

```typescript
// src/api/inventory.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/utils/api-client';

// Upload file lên server
export const useUploadFile = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
  });
};

// Gắn file vào phiếu
export const useAttachImageToReceipt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      receiptId, 
      fileId, 
      fieldName 
    }: { 
      receiptId: number; 
      fileId: number; 
      fieldName?: string 
    }) => {
      const response = await apiClient.post(
        `/inventory/receipt/${receiptId}/upload-image`,
        { fileId, fieldName }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['receipt-images', variables.receiptId] 
      });
    },
  });
};

// Lấy danh sách ảnh
export const useReceiptImages = (receiptId: number) => {
  return useQuery({
    queryKey: ['receipt-images', receiptId],
    queryFn: async () => {
      const response = await apiClient.get(
        `/inventory/receipt/${receiptId}/images`
      );
      return response.data.data as ReceiptImage[];
    },
    enabled: !!receiptId,
  });
};

// Xóa ảnh
export const useDeleteReceiptImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      receiptId, 
      fileId 
    }: { 
      receiptId: number; 
      fileId: number 
    }) => {
      const response = await apiClient.delete(
        `/inventory/receipt/${receiptId}/image/${fileId}`
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['receipt-images', variables.receiptId] 
      });
    },
  });
};
```

### UI Component Example

```tsx
// src/components/ReceiptImageUpload.tsx
import { Upload, Image, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  receiptId: number;
}

export const ReceiptImageUpload: React.FC<Props> = ({ receiptId }) => {
  const [uploading, setUploading] = useState(false);
  
  const { data: images, isLoading } = useReceiptImages(receiptId);
  const uploadFile = useUploadFile();
  const attachImage = useAttachImageToReceipt();
  const deleteImage = useDeleteReceiptImage();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      
      // 1. Upload file lên server
      const uploadResult = await uploadFile.mutateAsync(file);
      
      // 2. Gắn file vào phiếu
      await attachImage.mutateAsync({
        receiptId,
        fileId: uploadResult.data.id,
        fieldName: 'invoice_images',
      });
      
      message.success('Upload ảnh thành công!');
    } catch (error) {
      message.error('Upload ảnh thất bại!');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: number) => {
    try {
      await deleteImage.mutateAsync({ receiptId, fileId });
      message.success('Xóa ảnh thành công!');
    } catch (error) {
      message.error('Xóa ảnh thất bại!');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Hình ảnh hóa đơn</h3>
        <label className="btn btn-primary">
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Đang upload...' : 'Upload ảnh'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {isLoading ? (
        <div>Đang tải...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {images?.map((image) => (
            <div key={image.id} className="relative group">
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-32 object-cover rounded"
              />
              <button
                onClick={() => handleDelete(image.id)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 📦 2. Phiếu Xuất Trả Hàng (Return)

### API Endpoints

```typescript
POST   /inventory/return              // Tạo phiếu
GET    /inventory/returns             // Danh sách
GET    /inventory/return/:id          // Chi tiết
POST   /inventory/return/:id/approve  // Duyệt
POST   /inventory/return/:id/complete // Hoàn thành (xuất kho)
POST   /inventory/return/:id/cancel   // Hủy
DELETE /inventory/return/:id          // Xóa (draft/cancelled only)
```

### TypeScript Types

```typescript
// src/types/return.ts
export interface ReturnItem {
  product_id: number;
  quantity: number;
  unit_cost: number;
  total_price: number;
  reason?: string;
  notes?: string;
}

export interface CreateReturnRequest {
  return_code: string;
  receipt_id?: number;
  supplier_id: number;
  total_amount: number;
  reason: string;
  status?: 'draft' | 'approved' | 'completed' | 'cancelled';
  notes?: string;
  created_by: number;
  items: ReturnItem[];
}

export interface InventoryReturn {
  id: number;
  code: string;
  receipt_id?: number;
  supplier_id: number;
  total_amount: string;
  reason: string;
  status: string;
  notes?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  items?: ReturnItem[];
  supplier?: {
    id: number;
    name: string;
    code: string;
  };
}
```

### React Query Hooks

```typescript
// src/api/return.ts
export const useCreateReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateReturnRequest) => {
      const response = await apiClient.post('/inventory/return', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      message.success('Tạo phiếu trả hàng thành công!');
    },
  });
};

export const useReturns = () => {
  return useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const response = await apiClient.get('/inventory/returns');
      return response.data.data as InventoryReturn[];
    },
  });
};

export const useReturn = (id: number) => {
  return useQuery({
    queryKey: ['return', id],
    queryFn: async () => {
      const response = await apiClient.get(`/inventory/return/${id}`);
      return response.data.data as InventoryReturn;
    },
    enabled: !!id,
  });
};

export const useApproveReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/inventory/return/${id}/approve`);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['return', id] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      message.success('Duyệt phiếu thành công!');
    },
  });
};

export const useCompleteReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/inventory/return/${id}/complete`);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['return', id] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      message.success('Hoàn thành phiếu trả hàng! Tồn kho đã được cập nhật.');
    },
  });
};

export const useCancelReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const response = await apiClient.post(`/inventory/return/${id}/cancel`, { reason });
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['return', id] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      message.success('Hủy phiếu thành công!');
    },
  });
};

export const useDeleteReturn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/inventory/return/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      message.success('Xóa phiếu thành công!');
    },
  });
};
```

### UI Component Example

```tsx
// src/pages/returns/CreateReturnForm.tsx
import { Form, Input, InputNumber, Select, Button, Table } from 'antd';
import { useState } from 'react';

export const CreateReturnForm = () => {
  const [form] = Form.useForm();
  const [items, setItems] = useState<ReturnItem[]>([]);
  const createReturn = useCreateReturn();

  const handleSubmit = async (values: any) => {
    try {
      await createReturn.mutateAsync({
        ...values,
        items,
        created_by: currentUser.id, // Lấy từ auth context
      });
      form.resetFields();
      setItems([]);
    } catch (error) {
      message.error('Tạo phiếu thất bại!');
    }
  };

  return (
    <Form form={form} onFinish={handleSubmit} layout="vertical">
      <Form.Item name="return_code" label="Mã phiếu" rules={[{ required: true }]}>
        <Input placeholder="RT-2024-001" />
      </Form.Item>

      <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true }]}>
        <Select placeholder="Chọn nhà cung cấp">
          {/* Load từ API */}
        </Select>
      </Form.Item>

      <Form.Item name="reason" label="Lý do trả hàng" rules={[{ required: true }]}>
        <Input.TextArea rows={3} placeholder="Hàng bị lỗi, không đúng quy cách..." />
      </Form.Item>

      {/* Table để thêm items */}
      <Table dataSource={items} columns={itemColumns} />

      <Button type="primary" htmlType="submit" loading={createReturn.isPending}>
        Tạo phiếu trả hàng
      </Button>
    </Form>
  );
};
```

---

## 🔄 3. Phiếu Điều Chỉnh Kho (Adjustment)

### API Endpoints

```typescript
POST   /inventory/adjustment              // Tạo phiếu
GET    /inventory/adjustments             // Danh sách
GET    /inventory/adjustment/:id          // Chi tiết
POST   /inventory/adjustment/:id/approve  // Duyệt
POST   /inventory/adjustment/:id/complete // Hoàn thành (cập nhật kho)
POST   /inventory/adjustment/:id/cancel   // Hủy
DELETE /inventory/adjustment/:id          // Xóa (draft/cancelled only)
```

### TypeScript Types

```typescript
// src/types/adjustment.ts
export interface AdjustmentItem {
  product_id: number;
  quantity_change: number; // Dương: tăng, Âm: giảm
  reason?: string;
  notes?: string;
}

export interface CreateAdjustmentRequest {
  adjustment_code: string;
  adjustment_type: 'IN' | 'OUT';
  reason: string;
  status?: 'draft' | 'approved' | 'completed' | 'cancelled';
  notes?: string;
  created_by: number;
  items: AdjustmentItem[];
}

export interface InventoryAdjustment {
  id: number;
  code: string;
  adjustment_type: 'IN' | 'OUT';
  reason: string;
  status: string;
  notes?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  items?: AdjustmentItem[];
}
```

### React Query Hooks

```typescript
// src/api/adjustment.ts
export const useCreateAdjustment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAdjustmentRequest) => {
      const response = await apiClient.post('/inventory/adjustment', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      message.success('Tạo phiếu điều chỉnh thành công!');
    },
  });
};

export const useAdjustments = () => {
  return useQuery({
    queryKey: ['adjustments'],
    queryFn: async () => {
      const response = await apiClient.get('/inventory/adjustments');
      return response.data.data as InventoryAdjustment[];
    },
  });
};

export const useAdjustment = (id: number) => {
  return useQuery({
    queryKey: ['adjustment', id],
    queryFn: async () => {
      const response = await apiClient.get(`/inventory/adjustment/${id}`);
      return response.data.data as InventoryAdjustment;
    },
    enabled: !!id,
  });
};

export const useCompleteAdjustment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/inventory/adjustment/${id}/complete`);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['adjustment', id] });
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      message.success('Hoàn thành điều chỉnh! Tồn kho đã được cập nhật.');
    },
  });
};
```

---

## ⚠️ 4. Thay Đổi Logic Quan Trọng

### 4.1. Xóa Phiếu Nhập Kho

**THAY ĐỔI**: Chỉ cho phép xóa phiếu ở trạng thái `draft` hoặc `cancelled`

```typescript
// Trước đây: Có thể xóa mọi phiếu
// Bây giờ: Kiểm tra status trước khi xóa

const handleDeleteReceipt = async (id: number, status: string) => {
  if (status !== 'draft' && status !== 'cancelled') {
    message.error('Chỉ có thể xóa phiếu ở trạng thái Nháp hoặc Đã hủy!');
    return;
  }
  
  // Proceed with delete
  await deleteReceipt.mutateAsync(id);
};
```

**UI Update**: Disable nút xóa cho phiếu `approved` và `completed`

```tsx
<Button
  danger
  onClick={() => handleDelete(record.id, record.status)}
  disabled={record.status === 'approved' || record.status === 'completed'}
>
  Xóa
</Button>
```

### 4.2. Hoàn Thành Phiếu Nhập Kho

**THAY ĐỔI**: Tồn kho chỉ được cập nhật khi phiếu chuyển sang `completed`

```typescript
// Logic mới:
// 1. Tạo phiếu (draft) -> KHÔNG cập nhật tồn kho
// 2. Duyệt phiếu (approved) -> KHÔNG cập nhật tồn kho
// 3. Hoàn thành (completed) -> CẬP NHẬT tồn kho

// UI cần hiển thị rõ workflow
const getStatusBadge = (status: string) => {
  const statusConfig = {
    draft: { color: 'default', text: 'Nháp' },
    approved: { color: 'processing', text: 'Đã duyệt' },
    completed: { color: 'success', text: 'Hoàn thành' },
    cancelled: { color: 'error', text: 'Đã hủy' },
  };
  
  return <Tag color={statusConfig[status].color}>{statusConfig[status].text}</Tag>;
};
```

### 4.3. Không Cho Sửa Phiếu Đã Hoàn Thành

**MỚI**: Phiếu `completed` không được phép sửa

```tsx
const canEdit = (status: string) => {
  return status === 'draft'; // Chỉ cho sửa phiếu nháp
};

<Button
  onClick={() => navigate(`/receipts/${record.id}/edit`)}
  disabled={!canEdit(record.status)}
>
  Sửa
</Button>
```

---

## 🎨 5. UI/UX Recommendations

### Status Badges

```tsx
export const getStatusColor = (status: string) => {
  const colors = {
    draft: 'gray',
    approved: 'blue',
    completed: 'green',
    cancelled: 'red',
  };
  return colors[status] || 'gray';
};
```

### Action Buttons

```tsx
export const ReceiptActions = ({ receipt }) => {
  const approve = useApproveReceipt();
  const complete = useCompleteReceipt();
  const cancel = useCancelReceipt();

  return (
    <Space>
      {receipt.status === 'draft' && (
        <>
          <Button onClick={() => approve.mutate(receipt.id)}>Duyệt</Button>
          <Button danger onClick={() => handleCancel(receipt.id)}>Hủy</Button>
        </>
      )}
      
      {receipt.status === 'approved' && (
        <>
          <Button type="primary" onClick={() => complete.mutate(receipt.id)}>
            Hoàn thành
          </Button>
          <Button danger onClick={() => handleCancel(receipt.id)}>Hủy</Button>
        </>
      )}
      
      {receipt.status === 'completed' && (
        <Tag color="success">Đã hoàn thành</Tag>
      )}
    </Space>
  );
};
```

---

## 📝 6. Validation Rules

### Return Form

```typescript
const returnValidationRules = {
  return_code: [
    { required: true, message: 'Vui lòng nhập mã phiếu' },
    { pattern: /^RT-/, message: 'Mã phiếu phải bắt đầu bằng RT-' },
  ],
  supplier_id: [
    { required: true, message: 'Vui lòng chọn nhà cung cấp' },
  ],
  reason: [
    { required: true, message: 'Vui lòng nhập lý do trả hàng' },
    { min: 10, message: 'Lý do phải có ít nhất 10 ký tự' },
  ],
  items: [
    { required: true, message: 'Vui lòng thêm ít nhất 1 sản phẩm' },
  ],
};
```

### Adjustment Form

```typescript
const adjustmentValidationRules = {
  adjustment_code: [
    { required: true, message: 'Vui lòng nhập mã phiếu' },
    { pattern: /^ADJ-/, message: 'Mã phiếu phải bắt đầu bằng ADJ-' },
  ],
  adjustment_type: [
    { required: true, message: 'Vui lòng chọn loại điều chỉnh' },
  ],
  reason: [
    { required: true, message: 'Vui lòng nhập lý do điều chỉnh' },
  ],
};
```

---

## 🚀 7. Quick Start Checklist

### Bước 1: Cài đặt Types
- [ ] Tạo `src/types/inventory.ts`
- [ ] Tạo `src/types/return.ts`
- [ ] Tạo `src/types/adjustment.ts`

### Bước 2: Tạo API Hooks
- [ ] Tạo `src/api/inventory.ts` (image upload)
- [ ] Tạo `src/api/return.ts`
- [ ] Tạo `src/api/adjustment.ts`

### Bước 3: Tạo UI Components
- [ ] `ReceiptImageUpload.tsx`
- [ ] `CreateReturnForm.tsx`
- [ ] `ReturnList.tsx`
- [ ] `CreateAdjustmentForm.tsx`
- [ ] `AdjustmentList.tsx`

### Bước 4: Update Existing Pages
- [ ] Update `ReceiptForm` - Disable edit khi completed
- [ ] Update `ReceiptList` - Disable delete khi approved/completed
- [ ] Update `ReceiptDetail` - Thêm image upload section

### Bước 5: Routing
- [ ] `/inventory/returns` - Danh sách phiếu trả hàng
- [ ] `/inventory/returns/create` - Tạo phiếu trả hàng
- [ ] `/inventory/returns/:id` - Chi tiết phiếu trả hàng
- [ ] `/inventory/adjustments` - Danh sách phiếu điều chỉnh
- [ ] `/inventory/adjustments/create` - Tạo phiếu điều chỉnh
- [ ] `/inventory/adjustments/:id` - Chi tiết phiếu điều chỉnh

---

## ⚡ 8. Performance Tips

1. **Lazy Loading**: Load images chỉ khi cần
```tsx
const { data: images } = useReceiptImages(receiptId, {
  enabled: isImageTabActive,
});
```

2. **Optimistic Updates**: Cập nhật UI ngay lập tức
```typescript
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: ['returns'] });
  const previousData = queryClient.getQueryData(['returns']);
  queryClient.setQueryData(['returns'], (old) => [...old, newData]);
  return { previousData };
},
```

3. **Debounce Search**: Tránh gọi API liên tục
```typescript
const debouncedSearch = useDebouncedValue(searchTerm, 500);
```

---

## 🎯 Kết Luận

Tài liệu này cung cấp đầy đủ thông tin để Frontend triển khai các chức năng mới. Nếu có thắc mắc, tham khảo:

- **API Documentation**: Xem walkthrough.md
- **Backend Code**: Xem inventory.controller.ts và inventory.service.ts
- **Test Examples**: Xem test-inventory-apis.sh

**Lưu ý quan trọng**:
- Luôn kiểm tra `status` trước khi cho phép edit/delete
- Hiển thị rõ workflow: Draft → Approved → Completed
- Cập nhật cache sau mỗi mutation
- Validate dữ liệu trước khi submit
