# Hướng dẫn Frontend: Quản lý Hóa đơn theo Vụ lúa

## 🎯 Mục tiêu
Hiển thị danh sách hóa đơn mà nông dân đã mua cho một vụ lúa cụ thể.

## 📋 Các tính năng cần implement

### 1. Thêm field "Vụ lúa" vào Form tạo/sửa hóa đơn

**File cần sửa:** `src/pages/sales/components/SalesInvoiceForm.tsx` (hoặc tương tự)

**Thêm field:**
```typescript
interface SalesInvoiceFormData {
  customer_id: number;
  rice_crop_id?: number;  // ← Thêm field này (optional)
  season_id?: number;
  customer_name: string;
  items: SalesInvoiceItem[];
  payment_method: string;
  // ... các field khác
}
```

**Thêm Select/Dropdown cho Vụ lúa:**
```tsx
// 1. Fetch danh sách vụ lúa của khách hàng
const [riceCrops, setRiceCrops] = useState([]);

useEffect(() => {
  if (formData.customer_id) {
    // Gọi API lấy vụ lúa của khách hàng
    fetch(`/api/rice-crops/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: [
          {
            field: 'customer_id',
            operator: 'eq',
            value: formData.customer_id
          },
          {
            field: 'status',
            operator: 'eq',
            value: 'ACTIVE'  // Chỉ lấy vụ lúa đang hoạt động
          }
        ]
      })
    })
    .then(res => res.json())
    .then(data => setRiceCrops(data.data));
  }
}, [formData.customer_id]);

// 2. Thêm Select component
<FormControl fullWidth>
  <InputLabel>Vụ lúa (Tùy chọn)</InputLabel>
  <Select
    value={formData.rice_crop_id || ''}
    onChange={(e) => setFormData({
      ...formData,
      rice_crop_id: e.target.value ? Number(e.target.value) : undefined
    })}
  >
    <MenuItem value="">
      <em>Không liên kết vụ lúa</em>
    </MenuItem>
    {riceCrops.map(crop => (
      <MenuItem key={crop.id} value={crop.id}>
        {crop.field_name} - {crop.rice_variety} 
        ({crop.season?.name || 'N/A'})
      </MenuItem>
    ))}
  </Select>
  <FormHelperText>
    Chọn vụ lúa nếu hóa đơn này là chi phí đầu vào cho vụ lúa
  </FormHelperText>
</FormControl>
```

### 2. Hiển thị tab "Hóa đơn" trong trang chi tiết Vụ lúa

**File cần tạo:** `src/pages/rice-crops/components/InvoicesTab.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';

interface InvoicesTabProps {
  riceCropId: number;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({ riceCropId }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    fetchInvoices();
  }, [riceCropId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sales/invoices/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1,
          limit: 100,
          filters: [
            {
              field: 'rice_crop_id',
              operator: 'eq',
              value: riceCropId
            }
          ]
        })
      });
      
      const data = await response.json();
      setInvoices(data.data || []);
      
      // Tính tổng tiền
      const total = data.data.reduce((sum, inv) => sum + Number(inv.final_amount), 0);
      setTotalAmount(total);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'overdue': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Tổng quan */}
      <Box mb={3} p={2} bgcolor="primary.light" borderRadius={1}>
        <Typography variant="h6" color="primary.contrastText">
          Tổng chi phí mua hàng: {formatCurrency(totalAmount)}
        </Typography>
        <Typography variant="body2" color="primary.contrastText">
          Số hóa đơn: {invoices.length}
        </Typography>
      </Box>

      {/* Bảng hóa đơn */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Mã HĐ</TableCell>
              <TableCell>Ngày tạo</TableCell>
              <TableCell>Sản phẩm</TableCell>
              <TableCell align="right">Tổng tiền</TableCell>
              <TableCell>Thanh toán</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="textSecondary">
                    Chưa có hóa đơn nào cho vụ lúa này
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>{invoice.code}</TableCell>
                  <TableCell>
                    {new Date(invoice.created_at).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell>
                    {invoice.items?.length || 0} sản phẩm
                  </TableCell>
                  <TableCell align="right">
                    <strong>{formatCurrency(invoice.final_amount)}</strong>
                  </TableCell>
                  <TableCell>{invoice.payment_method}</TableCell>
                  <TableCell>
                    <Chip
                      label={invoice.payment_status}
                      color={getPaymentStatusColor(invoice.payment_status)}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
```

**Tích hợp vào trang chi tiết Vụ lúa:**

```tsx
// File: src/pages/rice-crops/RiceCropDetail.tsx

import { InvoicesTab } from './components/InvoicesTab';

export const RiceCropDetail = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
        <Tab label="Thông tin chung" />
        <Tab label="Chi phí đầu vào" />
        <Tab label="Hóa đơn mua hàng" />  {/* ← Tab mới */}
        <Tab label="Thu hoạch" />
        <Tab label="Lợi nhuận" />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        {/* Thông tin chung */}
      </TabPanel>
      
      <TabPanel value={activeTab} index={1}>
        <CostItemsTab riceCropId={id} />
      </TabPanel>
      
      <TabPanel value={activeTab} index={2}>
        <InvoicesTab riceCropId={id} />  {/* ← Component mới */}
      </TabPanel>
      
      {/* ... các tab khác */}
    </Box>
  );
};
```

### 3. Thêm filter "Vụ lúa" vào trang danh sách Hóa đơn

**File:** `src/pages/sales/SalesInvoiceList.tsx`

```tsx
const [filters, setFilters] = useState({
  customer_id: null,
  rice_crop_id: null,  // ← Thêm filter mới
  season_id: null,
  payment_status: null,
});

// Thêm Select cho Vụ lúa
<FormControl sx={{ minWidth: 200 }}>
  <InputLabel>Vụ lúa</InputLabel>
  <Select
    value={filters.rice_crop_id || ''}
    onChange={(e) => setFilters({
      ...filters,
      rice_crop_id: e.target.value || null
    })}
  >
    <MenuItem value="">Tất cả</MenuItem>
    <MenuItem value="has_crop">Có liên kết vụ lúa</MenuItem>
    <MenuItem value="no_crop">Không liên kết</MenuItem>
    {/* Hoặc list cụ thể các vụ lúa */}
  </Select>
</FormControl>

// Khi fetch data
const fetchInvoices = async () => {
  const apiFilters = [];
  
  if (filters.rice_crop_id === 'has_crop') {
    apiFilters.push({
      field: 'rice_crop_id',
      operator: 'isnotnull',
      value: null
    });
  } else if (filters.rice_crop_id === 'no_crop') {
    apiFilters.push({
      field: 'rice_crop_id',
      operator: 'isnull',
      value: null
    });
  } else if (filters.rice_crop_id) {
    apiFilters.push({
      field: 'rice_crop_id',
      operator: 'eq',
      value: filters.rice_crop_id
    });
  }
  
  // ... các filter khác
  
  const response = await fetch('/api/sales/invoices/search', {
    method: 'POST',
    body: JSON.stringify({ filters: apiFilters })
  });
};
```

### 4. Hiển thị thông tin Vụ lúa trong chi tiết Hóa đơn

**File:** `src/pages/sales/SalesInvoiceDetail.tsx`

```tsx
{invoice.rice_crop && (
  <Box mb={2} p={2} bgcolor="info.light" borderRadius={1}>
    <Typography variant="subtitle2" color="info.contrastText">
      📍 Hóa đơn này liên kết với vụ lúa:
    </Typography>
    <Typography variant="body1" color="info.contrastText">
      <strong>{invoice.rice_crop.field_name}</strong> - {invoice.rice_crop.rice_variety}
    </Typography>
    <Typography variant="body2" color="info.contrastText">
      Diện tích: {invoice.rice_crop.field_area} m² | 
      Mùa vụ: {invoice.rice_crop.season?.name}
    </Typography>
    <Button
      size="small"
      variant="outlined"
      onClick={() => navigate(`/rice-crops/${invoice.rice_crop_id}`)}
      sx={{ mt: 1 }}
    >
      Xem chi tiết vụ lúa
    </Button>
  </Box>
)}
```

## 📊 API Endpoints cần sử dụng

### 1. Lấy danh sách vụ lúa của khách hàng
```http
POST /rice-crops/search
Content-Type: application/json

{
  "filters": [
    {
      "field": "customer_id",
      "operator": "eq",
      "value": 123
    },
    {
      "field": "status",
      "operator": "eq",
      "value": "ACTIVE"
    }
  ]
}
```

### 2. Lấy hóa đơn của một vụ lúa
```http
POST /sales/invoices/search
Content-Type: application/json

{
  "filters": [
    {
      "field": "rice_crop_id",
      "operator": "eq",
      "value": 456
    }
  ]
}
```

### 3. Tạo hóa đơn với vụ lúa
```http
POST /sales/invoice
Content-Type: application/json

{
  "customer_id": 123,
  "rice_crop_id": 456,  // ← Field mới
  "season_id": 1,
  "customer_name": "Nguyễn Văn A",
  "items": [...],
  "payment_method": "debt"
}
```

## 🎨 UI/UX Suggestions

### 1. Badge hiển thị trên danh sách hóa đơn
```tsx
<TableCell>
  {invoice.code}
  {invoice.rice_crop_id && (
    <Chip
      label="Vụ lúa"
      size="small"
      color="success"
      icon={<AgricultureIcon />}
      sx={{ ml: 1 }}
    />
  )}
</TableCell>
```

### 2. Autocomplete cho việc chọn vụ lúa
```tsx
<Autocomplete
  options={riceCrops}
  getOptionLabel={(option) => 
    `${option.field_name} - ${option.rice_variety} (${option.season?.name})`
  }
  renderInput={(params) => (
    <TextField {...params} label="Vụ lúa" />
  )}
  onChange={(e, value) => setFormData({
    ...formData,
    rice_crop_id: value?.id
  })}
/>
```

### 3. Card tổng quan trong trang Vụ lúa
```tsx
<Grid container spacing={2}>
  <Grid item xs={12} md={4}>
    <Card>
      <CardContent>
        <Typography color="textSecondary" gutterBottom>
          Tổng chi phí mua hàng
        </Typography>
        <Typography variant="h5">
          {formatCurrency(totalInvoiceAmount)}
        </Typography>
        <Typography variant="body2">
          {invoiceCount} hóa đơn
        </Typography>
      </CardContent>
    </Card>
  </Grid>
  
  <Grid item xs={12} md={4}>
    <Card>
      <CardContent>
        <Typography color="textSecondary" gutterBottom>
          Chi phí khác
        </Typography>
        <Typography variant="h5">
          {formatCurrency(totalCostItems)}
        </Typography>
      </CardContent>
    </Card>
  </Grid>
  
  <Grid item xs={12} md={4}>
    <Card>
      <CardContent>
        <Typography color="textSecondary" gutterBottom>
          Tổng chi phí
        </Typography>
        <Typography variant="h5" color="primary">
          {formatCurrency(totalInvoiceAmount + totalCostItems)}
        </Typography>
      </CardContent>
    </Card>
  </Grid>
</Grid>
```

## ✅ Checklist Implementation

- [ ] **Form tạo/sửa hóa đơn**
  - [ ] Thêm field `rice_crop_id` vào interface
  - [ ] Thêm Select/Autocomplete chọn vụ lúa
  - [ ] Fetch danh sách vụ lúa khi chọn khách hàng
  - [ ] Gửi `rice_crop_id` khi submit form

- [ ] **Trang chi tiết Vụ lúa**
  - [ ] Tạo component `InvoicesTab`
  - [ ] Fetch danh sách hóa đơn theo `rice_crop_id`
  - [ ] Hiển thị bảng hóa đơn
  - [ ] Tính và hiển thị tổng chi phí

- [ ] **Trang danh sách Hóa đơn**
  - [ ] Thêm filter theo vụ lúa
  - [ ] Hiển thị badge cho hóa đơn có liên kết vụ lúa
  - [ ] Thêm cột hiển thị tên vụ lúa (optional)

- [ ] **Trang chi tiết Hóa đơn**
  - [ ] Hiển thị thông tin vụ lúa (nếu có)
  - [ ] Thêm link đến trang chi tiết vụ lúa

- [ ] **Testing**
  - [ ] Test tạo hóa đơn có vụ lúa
  - [ ] Test tạo hóa đơn không có vụ lúa
  - [ ] Test filter theo vụ lúa
  - [ ] Test hiển thị danh sách hóa đơn trong vụ lúa

## 🐛 Common Issues & Solutions

### Issue 1: Không load được danh sách vụ lúa
**Solution:** Kiểm tra permission `rice_crop:read` và đảm bảo user đã login

### Issue 2: Tổng tiền không chính xác
**Solution:** Đảm bảo convert `final_amount` sang Number trước khi tính tổng
```tsx
const total = invoices.reduce((sum, inv) => sum + Number(inv.final_amount || 0), 0);
```

### Issue 3: Không thấy tab "Hóa đơn" trong vụ lúa
**Solution:** Kiểm tra routing và permissions cho module rice-crops

## 📞 Support
Nếu có vấn đề, liên hệ Backend team để kiểm tra:
- API endpoint có hoạt động không
- Permission có đúng không
- Data có đúng format không
