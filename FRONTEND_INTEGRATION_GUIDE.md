# Hướng Dẫn Frontend - Hệ Thống Quản Lý Mùa Vụ Lúa

## 📋 Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [API Endpoints](#api-endpoints)
3. [React Query Hooks](#react-query-hooks)
4. [TypeScript Types](#typescript-types)
5. [UI Components](#ui-components)
6. [Workflow & User Flow](#workflow--user-flow)
7. [Code Examples](#code-examples)

---

## 🎯 Tổng Quan

Hệ thống quản lý mùa vụ lúa bao gồm 6 modules chính:

1. **Rice Crop Management** - Quản lý vụ lúa
2. **Cost Items** - Quản lý chi phí đầu vào
3. **Harvest Records** - Thu hoạch & doanh thu
4. **Farming Schedule** - Lịch canh tác
5. **Application Records** - Nhật ký phun thuốc/bón phân
6. **Growth Tracking** - Theo dõi sinh trưởng
7. **Profit Reports** - Báo cáo lợi nhuận

---

## 🔌 API Endpoints

### Base URL
```typescript
const API_BASE_URL = 'http://localhost:3000';
```

### Authentication
Tất cả API đều yêu cầu JWT token trong header:
```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### 1. Rice Crop Management

#### Lấy danh sách vụ lúa
```http
GET /rice-crops?customer_id=1&season_id=1&status=active
```

Query Parameters:
- `customer_id` (optional): Filter theo khách hàng
- `season_id` (optional): Filter theo mùa vụ
- `status` (optional): `active` | `harvested` | `failed`
- `growth_stage` (optional): `seedling` | `tillering` | `panicle` | `heading` | `ripening` | `harvested`

#### Tạo vụ lúa mới
```http
POST /rice-crops
Content-Type: application/json

{
  "customer_id": 1,
  "season_id": 1,
  "field_name": "Ruộng sau nhà",
  "field_area": 5000,
  "location": "Xã Tân Hiệp, An Giang",
  "rice_variety": "OM 5451",
  "seed_source": "Trung tâm giống An Giang",
  "sowing_date": "2024-11-01",
  "transplanting_date": "2024-11-20",
  "expected_harvest_date": "2025-02-15",
  "notes": "Vụ lúa đông xuân 2024"
}
```

#### Cập nhật giai đoạn sinh trưởng
```http
PATCH /rice-crops/:id/growth-stage
Content-Type: application/json

{
  "growth_stage": "tillering",
  "notes": "Lúa đang đẻ nhánh tốt"
}
```

#### Cập nhật trạng thái
```http
PATCH /rice-crops/:id/status
Content-Type: application/json

{
  "status": "harvested",
  "notes": "Đã thu hoạch xong"
}
```

#### Thống kê theo khách hàng
```http
GET /rice-crops/customer/:customerId/stats
```

Response:
```json
{
  "total": 10,
  "active": 5,
  "harvested": 4,
  "failed": 1,
  "totalArea": 50000,
  "totalYield": 30000
}
```

---

### 2. Cost Items

#### Lấy danh sách chi phí
```http
GET /cost-items?rice_crop_id=1&category=fertilizer
```

#### Thêm chi phí
```http
POST /cost-items
Content-Type: application/json

{
  "rice_crop_id": 1,
  "category": "fertilizer",
  "item_name": "Phân NPK 16-16-8",
  "quantity": 100,
  "unit": "kg",
  "unit_price": 15000,
  "total_cost": 1500000,
  "purchase_date": "2024-12-01",
  "invoice_id": 123,
  "notes": "Mua tại cửa hàng"
}
```

Categories: `seed` | `fertilizer` | `pesticide` | `labor` | `machinery` | `irrigation` | `other`

#### Tổng hợp chi phí theo vụ lúa
```http
GET /cost-items/crop/:cropId/summary
```

Response:
```json
{
  "total": 15000000,
  "breakdown": {
    "seed": 2000000,
    "fertilizer": 5000000,
    "pesticide": 3000000,
    "labor": 4000000,
    "machinery": 500000,
    "irrigation": 300000,
    "other": 200000
  },
  "items": [...]
}
```

---

### 3. Harvest Records

#### Ghi nhận thu hoạch
```http
POST /harvest-records
Content-Type: application/json

{
  "rice_crop_id": 1,
  "harvest_date": "2025-02-18",
  "yield_amount": 3000,
  "moisture_content": 14.5,
  "quality_grade": "A",
  "selling_price_per_unit": 8000,
  "total_revenue": 24000000,
  "buyer": "Thương lái Nguyễn Văn A",
  "payment_status": "paid",
  "payment_date": "2025-02-20",
  "notes": "Thu hoạch đúng hẹn"
}
```

Payment Status: `pending` | `partial` | `paid`

#### Lấy thu hoạch theo vụ lúa
```http
GET /harvest-records/crop/:cropId
```

---

### 4. Farming Schedule

#### Tạo lịch canh tác
```http
POST /farming-schedules
Content-Type: application/json

{
  "rice_crop_id": 1,
  "activity_type": "spraying",
  "activity_name": "Phun thuốc trừ sâu cuốn lá",
  "scheduled_date": "2024-12-05",
  "scheduled_time": "6:00 - 9:00 sáng",
  "product_ids": [10, 15],
  "estimated_quantity": 2,
  "estimated_cost": 500000,
  "instructions": "Phun vào buổi sáng sớm, tránh trời mưa",
  "weather_dependent": true,
  "reminder_enabled": true
}
```

Activity Types: `spraying` | `fertilizing` | `irrigation` | `weeding` | `pest_control` | `observation` | `other`

#### Lấy lịch sắp tới
```http
GET /farming-schedules/upcoming?days=7
```

#### Đánh dấu hoàn thành
```http
PATCH /farming-schedules/:id/complete
```

---

### 5. Application Records

#### Ghi nhật ký phun thuốc/bón phân
```http
POST /application-records
Content-Type: application/json

{
  "rice_crop_id": 1,
  "farming_schedule_id": 5,
  "activity_type": "spraying",
  "application_date": "2024-12-05",
  "application_time": "6:30 sáng",
  "products": [
    {
      "product_id": 10,
      "product_name": "Thuốc trừ sâu ABC",
      "quantity": 2,
      "unit": "lít",
      "unit_price": 150000,
      "total_price": 300000
    }
  ],
  "total_cost": 300000,
  "weather_condition": "Trời nắng, gió nhẹ",
  "operator": "Nguyễn Văn B",
  "notes": "Phun đều khắp ruộng",
  "effectiveness": 5,
  "side_effects": null
}
```

Effectiveness: 1-5 sao

---

### 6. Growth Tracking

#### Ghi nhận quan sát sinh trưởng
```http
POST /growth-trackings
Content-Type: application/json

{
  "rice_crop_id": 1,
  "tracking_date": "2024-12-10",
  "growth_stage": "tillering",
  "plant_height": 35,
  "tiller_count": 8,
  "leaf_color": "xanh đậm",
  "health_status": "healthy",
  "pest_disease_detected": null,
  "severity": null,
  "photo_urls": [
    "https://storage.example.com/photos/crop1_20241210_1.jpg",
    "https://storage.example.com/photos/crop1_20241210_2.jpg"
  ],
  "notes": "Cây phát triển tốt"
}
```

Health Status: `healthy` | `stressed` | `diseased`
Severity: `low` | `medium` | `high` | `severe`

---

### 7. Profit Reports

#### Báo cáo lợi nhuận vụ lúa
```http
GET /profit-reports/crop/:cropId
```

Response:
```json
{
  "rice_crop_id": 1,
  "field_name": "Ruộng sau nhà",
  "area": 5000,
  "rice_variety": "OM 5451",
  "total_cost": 15000000,
  "cost_breakdown": {
    "seed": 2000000,
    "fertilizer": 5000000,
    "pesticide": 3000000,
    "labor": 4000000,
    "machinery": 500000,
    "irrigation": 300000,
    "other": 200000
  },
  "yield_amount": 3000,
  "quality_grade": "A",
  "revenue": 24000000,
  "profit": 9000000,
  "roi": 60,
  "profit_per_m2": 1800,
  "sowing_date": "2024-11-01",
  "harvest_date": "2025-02-18",
  "duration_days": 109
}
```

#### Báo cáo mùa vụ
```http
GET /profit-reports/season/:seasonId?customerId=1
```

---

## 🎣 React Query Hooks

### Cấu trúc thư mục đề xuất
```
src/
├── queries/
│   ├── rice-crop.queries.ts
│   ├── cost-item.queries.ts
│   ├── harvest-record.queries.ts
│   ├── farming-schedule.queries.ts
│   ├── application-record.queries.ts
│   ├── growth-tracking.queries.ts
│   └── profit-report.queries.ts
└── types/
    └── rice-farming.types.ts
```

### 1. Rice Crop Queries

```typescript
// src/queries/rice-crop.queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { RiceCrop, CreateRiceCropDto, UpdateRiceCropDto } from '@/types/rice-farming.types';

// Query Keys
export const riceCropKeys = {
  all: ['rice-crops'] as const,
  lists: () => [...riceCropKeys.all, 'list'] as const,
  list: (filters: string) => [...riceCropKeys.lists(), { filters }] as const,
  details: () => [...riceCropKeys.all, 'detail'] as const,
  detail: (id: number) => [...riceCropKeys.details(), id] as const,
  stats: (customerId: number) => [...riceCropKeys.all, 'stats', customerId] as const,
};

// Lấy danh sách vụ lúa
export const useRiceCrops = (params?: {
  customer_id?: number;
  season_id?: number;
  status?: string;
  growth_stage?: string;
}) => {
  return useQuery({
    queryKey: riceCropKeys.list(JSON.stringify(params)),
    queryFn: async () => {
      const { data } = await api.get<RiceCrop[]>('/rice-crops', { params });
      return data;
    },
  });
};

// Lấy chi tiết vụ lúa
export const useRiceCrop = (id: number) => {
  return useQuery({
    queryKey: riceCropKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<RiceCrop>(`/rice-crops/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

// Tạo vụ lúa mới
export const useCreateRiceCrop = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (dto: CreateRiceCropDto) => {
      const { data } = await api.post<RiceCrop>('/rice-crops', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riceCropKeys.lists() });
    },
  });
};

// Cập nhật vụ lúa
export const useUpdateRiceCrop = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, dto }: { id: number; dto: UpdateRiceCropDto }) => {
      const { data } = await api.patch<RiceCrop>(`/rice-crops/${id}`, dto);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: riceCropKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: riceCropKeys.lists() });
    },
  });
};

// Cập nhật giai đoạn sinh trưởng
export const useUpdateGrowthStage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, growth_stage, notes }: { 
      id: number; 
      growth_stage: string; 
      notes?: string 
    }) => {
      const { data } = await api.patch<RiceCrop>(
        `/rice-crops/${id}/growth-stage`, 
        { growth_stage, notes }
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: riceCropKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: riceCropKeys.lists() });
    },
  });
};

// Xóa vụ lúa
export const useDeleteRiceCrop = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/rice-crops/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riceCropKeys.lists() });
    },
  });
};

// Thống kê theo khách hàng
export const useCustomerStats = (customerId: number) => {
  return useQuery({
    queryKey: riceCropKeys.stats(customerId),
    queryFn: async () => {
      const { data } = await api.get(`/rice-crops/customer/${customerId}/stats`);
      return data;
    },
    enabled: !!customerId,
  });
};
```

### 2. Cost Item Queries

```typescript
// src/queries/cost-item.queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { CostItem, CreateCostItemDto } from '@/types/rice-farming.types';

export const costItemKeys = {
  all: ['cost-items'] as const,
  lists: () => [...costItemKeys.all, 'list'] as const,
  list: (filters: string) => [...costItemKeys.lists(), { filters }] as const,
  summary: (cropId: number) => [...costItemKeys.all, 'summary', cropId] as const,
};

export const useCostItems = (params?: { rice_crop_id?: number; category?: string }) => {
  return useQuery({
    queryKey: costItemKeys.list(JSON.stringify(params)),
    queryFn: async () => {
      const { data } = await api.get<CostItem[]>('/cost-items', { params });
      return data;
    },
  });
};

export const useCostSummary = (cropId: number) => {
  return useQuery({
    queryKey: costItemKeys.summary(cropId),
    queryFn: async () => {
      const { data } = await api.get(`/cost-items/crop/${cropId}/summary`);
      return data;
    },
    enabled: !!cropId,
  });
};

export const useCreateCostItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (dto: CreateCostItemDto) => {
      const { data } = await api.post<CostItem>('/cost-items', dto);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: costItemKeys.lists() });
      queryClient.invalidateQueries({ queryKey: costItemKeys.summary(data.rice_crop_id) });
    },
  });
};
```

### 3. Farming Schedule Queries

```typescript
// src/queries/farming-schedule.queries.ts
export const scheduleKeys = {
  all: ['farming-schedules'] as const,
  upcoming: (days: number) => [...scheduleKeys.all, 'upcoming', days] as const,
  byCrop: (cropId: number) => [...scheduleKeys.all, 'crop', cropId] as const,
};

export const useUpcomingSchedules = (days: number = 7) => {
  return useQuery({
    queryKey: scheduleKeys.upcoming(days),
    queryFn: async () => {
      const { data } = await api.get(`/farming-schedules/upcoming?days=${days}`);
      return data;
    },
  });
};

export const useMarkScheduleComplete = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.patch(`/farming-schedules/${id}/complete`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
};
```

---

## 📘 TypeScript Types

```typescript
// src/types/rice-farming.types.ts

// Enums
export enum GrowthStage {
  SEEDLING = 'seedling',
  TILLERING = 'tillering',
  PANICLE = 'panicle',
  HEADING = 'heading',
  RIPENING = 'ripening',
  HARVESTED = 'harvested',
}

export enum CropStatus {
  ACTIVE = 'active',
  HARVESTED = 'harvested',
  FAILED = 'failed',
}

export enum CostCategory {
  SEED = 'seed',
  FERTILIZER = 'fertilizer',
  PESTICIDE = 'pesticide',
  LABOR = 'labor',
  MACHINERY = 'machinery',
  IRRIGATION = 'irrigation',
  OTHER = 'other',
}

export enum ActivityType {
  SPRAYING = 'spraying',
  FERTILIZING = 'fertilizing',
  IRRIGATION = 'irrigation',
  WEEDING = 'weeding',
  PEST_CONTROL = 'pest_control',
  OBSERVATION = 'observation',
  OTHER = 'other',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  STRESSED = 'stressed',
  DISEASED = 'diseased',
}

// Interfaces
export interface RiceCrop {
  id: number;
  customer_id: number;
  season_id: number;
  field_name: string;
  field_area: number;
  location?: string;
  rice_variety: string;
  seed_source?: string;
  sowing_date?: string;
  transplanting_date?: string;
  expected_harvest_date?: string;
  actual_harvest_date?: string;
  growth_stage: GrowthStage;
  status: CropStatus;
  yield_amount?: number;
  quality_grade?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  season?: Season;
}

export interface CostItem {
  id: number;
  rice_crop_id: number;
  category: CostCategory;
  item_name: string;
  quantity?: number;
  unit?: string;
  unit_price: number;
  total_cost: number;
  purchase_date?: string;
  invoice_id?: number;
  notes?: string;
  created_at: string;
}

export interface HarvestRecord {
  id: number;
  rice_crop_id: number;
  harvest_date: string;
  yield_amount: number;
  moisture_content?: number;
  quality_grade: string;
  selling_price_per_unit: number;
  total_revenue: number;
  buyer?: string;
  payment_status: 'pending' | 'partial' | 'paid';
  payment_date?: string;
  notes?: string;
  created_at: string;
}

export interface FarmingSchedule {
  id: number;
  rice_crop_id: number;
  activity_type: ActivityType;
  activity_name: string;
  scheduled_date: string;
  scheduled_time?: string;
  product_ids?: number[];
  estimated_quantity?: number;
  estimated_cost?: number;
  instructions?: string;
  weather_dependent: boolean;
  status: 'pending' | 'completed' | 'cancelled' | 'overdue';
  reminder_enabled: boolean;
  reminder_time?: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface ApplicationRecord {
  id: number;
  rice_crop_id: number;
  farming_schedule_id?: number;
  activity_type: ActivityType;
  application_date: string;
  application_time?: string;
  products: ApplicationProduct[];
  total_cost: number;
  weather_condition?: string;
  operator?: string;
  notes?: string;
  effectiveness?: number;
  side_effects?: string;
  created_at: string;
}

export interface GrowthTracking {
  id: number;
  rice_crop_id: number;
  tracking_date: string;
  growth_stage: GrowthStage;
  plant_height?: number;
  tiller_count?: number;
  leaf_color?: string;
  health_status: HealthStatus;
  pest_disease_detected?: string;
  severity?: 'low' | 'medium' | 'high' | 'severe';
  photo_urls?: string[];
  notes?: string;
  created_at: string;
}

export interface ProfitReport {
  rice_crop_id: number;
  field_name: string;
  area: number;
  rice_variety: string;
  total_cost: number;
  cost_breakdown: Record<CostCategory, number>;
  yield_amount: number;
  quality_grade: string;
  revenue: number;
  profit: number;
  roi: number;
  profit_per_m2: number;
  sowing_date?: string;
  harvest_date?: string;
  duration_days?: number;
}

// DTOs
export interface CreateRiceCropDto {
  customer_id: number;
  season_id: number;
  field_name: string;
  field_area: number;
  location?: string;
  rice_variety: string;
  seed_source?: string;
  sowing_date?: string;
  transplanting_date?: string;
  expected_harvest_date?: string;
  notes?: string;
}

export interface UpdateRiceCropDto {
  field_name?: string;
  field_area?: number;
  location?: string;
  rice_variety?: string;
  expected_harvest_date?: string;
  yield_amount?: number;
  quality_grade?: string;
  notes?: string;
}

export interface CreateCostItemDto {
  rice_crop_id: number;
  category: CostCategory;
  item_name: string;
  quantity?: number;
  unit?: string;
  unit_price: number;
  total_cost: number;
  purchase_date?: string;
  invoice_id?: number;
  notes?: string;
}
```

---

## 🎨 UI Components

### 1. Rice Crop List Component

```tsx
// src/components/rice-farming/RiceCropList.tsx
import React from 'react';
import { Table, Tag, Button, Space } from 'antd';
import { useRiceCrops } from '@/queries/rice-crop.queries';
import type { RiceCrop } from '@/types/rice-farming.types';

const growthStageColors = {
  seedling: 'green',
  tillering: 'cyan',
  panicle: 'blue',
  heading: 'purple',
  ripening: 'orange',
  harvested: 'gold',
};

const statusColors = {
  active: 'processing',
  harvested: 'success',
  failed: 'error',
};

export const RiceCropList: React.FC<{ customerId?: number; seasonId?: number }> = ({
  customerId,
  seasonId,
}) => {
  const { data: crops, isLoading } = useRiceCrops({ customer_id: customerId, season_id: seasonId });

  const columns = [
    {
      title: 'Tên ruộng',
      dataIndex: 'field_name',
      key: 'field_name',
    },
    {
      title: 'Diện tích (m²)',
      dataIndex: 'field_area',
      key: 'field_area',
      render: (area: number) => area.toLocaleString(),
    },
    {
      title: 'Giống lúa',
      dataIndex: 'rice_variety',
      key: 'rice_variety',
    },
    {
      title: 'Giai đoạn',
      dataIndex: 'growth_stage',
      key: 'growth_stage',
      render: (stage: string) => (
        <Tag color={growthStageColors[stage as keyof typeof growthStageColors]}>
          {stage.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status as keyof typeof statusColors]}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Ngày gieo',
      dataIndex: 'sowing_date',
      key: 'sowing_date',
      render: (date: string) => date ? new Date(date).toLocaleDateString('vi-VN') : '-',
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_: any, record: RiceCrop) => (
        <Space>
          <Button type="link" href={`/rice-crops/${record.id}`}>
            Chi tiết
          </Button>
          <Button type="link" href={`/rice-crops/${record.id}/edit`}>
            Sửa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={crops}
      loading={isLoading}
      rowKey="id"
      pagination={{ pageSize: 10 }}
    />
  );
};
```

### 2. Create Rice Crop Form

```tsx
// src/components/rice-farming/CreateRiceCropForm.tsx
import React from 'react';
import { Form, Input, InputNumber, DatePicker, Select, Button, message } from 'antd';
import { useCreateRiceCrop } from '@/queries/rice-crop.queries';
import type { CreateRiceCropDto } from '@/types/rice-farming.types';

export const CreateRiceCropForm: React.FC<{ 
  customerId: number; 
  seasonId: number;
  onSuccess?: () => void;
}> = ({ customerId, seasonId, onSuccess }) => {
  const [form] = Form.useForm();
  const createMutation = useCreateRiceCrop();

  const handleSubmit = async (values: any) => {
    try {
      const dto: CreateRiceCropDto = {
        customer_id: customerId,
        season_id: seasonId,
        ...values,
        sowing_date: values.sowing_date?.format('YYYY-MM-DD'),
        transplanting_date: values.transplanting_date?.format('YYYY-MM-DD'),
        expected_harvest_date: values.expected_harvest_date?.format('YYYY-MM-DD'),
      };

      await createMutation.mutateAsync(dto);
      message.success('Tạo vụ lúa thành công!');
      form.resetFields();
      onSuccess?.();
    } catch (error) {
      message.error('Có lỗi xảy ra!');
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
    >
      <Form.Item
        name="field_name"
        label="Tên ruộng"
        rules={[{ required: true, message: 'Vui lòng nhập tên ruộng' }]}
      >
        <Input placeholder="VD: Ruộng sau nhà" />
      </Form.Item>

      <Form.Item
        name="field_area"
        label="Diện tích (m²)"
        rules={[{ required: true, message: 'Vui lòng nhập diện tích' }]}
      >
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item name="location" label="Vị trí">
        <Input placeholder="VD: Xã Tân Hiệp, An Giang" />
      </Form.Item>

      <Form.Item
        name="rice_variety"
        label="Giống lúa"
        rules={[{ required: true, message: 'Vui lòng nhập giống lúa' }]}
      >
        <Input placeholder="VD: OM 5451" />
      </Form.Item>

      <Form.Item name="seed_source" label="Nguồn giống">
        <Input placeholder="VD: Trung tâm giống An Giang" />
      </Form.Item>

      <Form.Item name="sowing_date" label="Ngày gieo mạ">
        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
      </Form.Item>

      <Form.Item name="transplanting_date" label="Ngày cấy">
        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
      </Form.Item>

      <Form.Item name="expected_harvest_date" label="Ngày thu hoạch dự kiến">
        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
      </Form.Item>

      <Form.Item name="notes" label="Ghi chú">
        <Input.TextArea rows={3} />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
          Tạo vụ lúa
        </Button>
      </Form.Item>
    </Form>
  );
};
```

### 3. Cost Summary Chart

```tsx
// src/components/rice-farming/CostSummaryChart.tsx
import React from 'react';
import { Card, Spin } from 'antd';
import { Pie } from '@ant-design/charts';
import { useCostSummary } from '@/queries/cost-item.queries';

const categoryLabels = {
  seed: 'Giống',
  fertilizer: 'Phân bón',
  pesticide: 'Thuốc BVTV',
  labor: 'Công lao động',
  machinery: 'Máy móc',
  irrigation: 'Tưới tiêu',
  other: 'Khác',
};

export const CostSummaryChart: React.FC<{ cropId: number }> = ({ cropId }) => {
  const { data, isLoading } = useCostSummary(cropId);

  if (isLoading) return <Spin />;
  if (!data) return null;

  const chartData = Object.entries(data.breakdown)
    .filter(([_, value]) => value > 0)
    .map(([category, value]) => ({
      type: categoryLabels[category as keyof typeof categoryLabels],
      value,
    }));

  const config = {
    data: chartData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    interactions: [{ type: 'element-active' }],
  };

  return (
    <Card title="Phân bổ chi phí">
      <div style={{ marginBottom: 16 }}>
        <strong>Tổng chi phí:</strong> {data.total.toLocaleString()} VNĐ
      </div>
      <Pie {...config} />
    </Card>
  );
};
```

### 4. Profit Report Card

```tsx
// src/components/rice-farming/ProfitReportCard.tsx
import React from 'react';
import { Card, Statistic, Row, Col, Descriptions } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useProfitReport } from '@/queries/profit-report.queries';

export const ProfitReportCard: React.FC<{ cropId: number }> = ({ cropId }) => {
  const { data: report, isLoading } = useProfitReport(cropId);

  if (isLoading) return <Card loading />;
  if (!report) return null;

  const isProfit = report.profit > 0;

  return (
    <Card title="Báo cáo lợi nhuận">
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title="Tổng chi phí"
            value={report.total_cost}
            suffix="VNĐ"
            valueStyle={{ color: '#cf1322' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Doanh thu"
            value={report.revenue}
            suffix="VNĐ"
            valueStyle={{ color: '#3f8600' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Lợi nhuận"
            value={report.profit}
            suffix="VNĐ"
            prefix={isProfit ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            valueStyle={{ color: isProfit ? '#3f8600' : '#cf1322' }}
          />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Statistic
            title="ROI"
            value={report.roi}
            suffix="%"
            precision={2}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="Lợi nhuận/m²"
            value={report.profit_per_m2}
            suffix="VNĐ"
            precision={0}
          />
        </Col>
      </Row>

      <Descriptions title="Chi tiết" bordered style={{ marginTop: 24 }}>
        <Descriptions.Item label="Năng suất">
          {report.yield_amount} kg
        </Descriptions.Item>
        <Descriptions.Item label="Chất lượng">
          {report.quality_grade}
        </Descriptions.Item>
        <Descriptions.Item label="Thời gian">
          {report.duration_days} ngày
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};
```

---

## 🔄 Workflow & User Flow

### User Flow 1: Tạo và quản lý vụ lúa mới

```
1. Chọn khách hàng & mùa vụ
   ↓
2. Tạo vụ lúa mới (POST /rice-crops)
   ↓
3. Lên lịch canh tác (POST /farming-schedules)
   ↓
4. Theo dõi lịch sắp tới (GET /farming-schedules/upcoming)
   ↓
5. Ghi nhật ký thực hiện (POST /application-records)
   ↓
6. Thêm chi phí (POST /cost-items)
   ↓
7. Theo dõi sinh trưởng (POST /growth-trackings)
   ↓
8. Cập nhật giai đoạn (PATCH /rice-crops/:id/growth-stage)
   ↓
9. Ghi nhận thu hoạch (POST /harvest-records)
   ↓
10. Xem báo cáo lợi nhuận (GET /profit-reports/crop/:id)
```

### User Flow 2: Dashboard tổng quan

```
Dashboard
├── Thống kê tổng quan (GET /rice-crops/customer/:id/stats)
├── Vụ lúa đang hoạt động (GET /rice-crops?status=active)
├── Lịch sắp tới (GET /farming-schedules/upcoming?days=7)
├── Chi phí tháng này (GET /cost-items?...)
└── Báo cáo mùa vụ (GET /profit-reports/season/:id)
```

---

## 💡 Code Examples

### Example 1: Rice Crop Detail Page

```tsx
// src/pages/rice-crops/[id].tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, Card } from 'antd';
import { useRiceCrop } from '@/queries/rice-crop.queries';
import { CostSummaryChart } from '@/components/rice-farming/CostSummaryChart';
import { ProfitReportCard } from '@/components/rice-farming/ProfitReportCard';
import { GrowthTrackingTimeline } from '@/components/rice-farming/GrowthTrackingTimeline';

export const RiceCropDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const cropId = parseInt(id!);
  const { data: crop, isLoading } = useRiceCrop(cropId);

  if (isLoading) return <Card loading />;
  if (!crop) return <div>Không tìm thấy vụ lúa</div>;

  return (
    <div>
      <Card title={crop.field_name}>
        <p>Diện tích: {crop.field_area} m²</p>
        <p>Giống: {crop.rice_variety}</p>
        <p>Giai đoạn: {crop.growth_stage}</p>
      </Card>

      <Tabs
        items={[
          {
            key: 'overview',
            label: 'Tổng quan',
            children: <ProfitReportCard cropId={cropId} />,
          },
          {
            key: 'costs',
            label: 'Chi phí',
            children: <CostSummaryChart cropId={cropId} />,
          },
          {
            key: 'growth',
            label: 'Sinh trưởng',
            children: <GrowthTrackingTimeline cropId={cropId} />,
          },
        ]}
      />
    </div>
  );
};
```

### Example 2: Dashboard với Multiple Queries

```tsx
// src/pages/dashboard/RiceFarmingDashboard.tsx
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { useCustomerStats } from '@/queries/rice-crop.queries';
import { useUpcomingSchedules } from '@/queries/farming-schedule.queries';

export const RiceFarmingDashboard: React.FC<{ customerId: number }> = ({ customerId }) => {
  const { data: stats } = useCustomerStats(customerId);
  const { data: schedules } = useUpcomingSchedules(7);

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="Tổng số vụ" value={stats?.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Đang hoạt động" value={stats?.active} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Đã thu hoạch" value={stats?.harvested} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Tổng diện tích" 
              value={stats?.totalArea} 
              suffix="m²"
            />
          </Card>
        </Col>
      </Row>

      <Card title="Lịch sắp tới" style={{ marginTop: 16 }}>
        {schedules?.map((schedule: any) => (
          <div key={schedule.id}>
            {schedule.activity_name} - {schedule.scheduled_date}
          </div>
        ))}
      </Card>
    </div>
  );
};
```

---

## 🚀 Getting Started

### 1. Cài đặt dependencies

```bash
npm install @tanstack/react-query axios antd @ant-design/charts
```

### 2. Setup API Client

```typescript
// src/services/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 3. Setup React Query

```typescript
// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

---

## 📝 Notes

1. **Authentication**: Tất cả API đều yêu cầu JWT token
2. **Permissions**: Kiểm tra permissions trước khi hiển thị UI
3. **Error Handling**: Sử dụng try-catch và hiển thị message cho user
4. **Loading States**: Luôn hiển thị loading khi fetch data
5. **Optimistic Updates**: Cân nhắc sử dụng cho UX tốt hơn
6. **Cache Invalidation**: Invalidate queries sau khi mutation thành công

---

## 🆘 Support

Nếu có vấn đề, tham khảo:
- Swagger UI: `http://localhost:3000/api`
- Backend README: `RICE_FARMING_SYSTEM.md`
- Backend Complete Guide: `RICE_FARMING_COMPLETE.md`
