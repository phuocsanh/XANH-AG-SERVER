# Search DTO Best Practices

## Quy Tắc Chung

### 1. Luôn Extend BaseSearchDto

**✅ ĐÚNG:**
```typescript
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchProductDto extends BaseSearchDto {
  // Chỉ thêm các filters cụ thể của module
  @IsOptional()
  @IsString()
  category?: string;
}
```

**❌ SAI:**
```typescript
export class SearchProductDto {
  // Không tự định nghĩa lại page, limit, keyword, sort
  @IsOptional()
  @IsNumber()
  page?: number;
  
  @IsOptional()
  @IsNumber()
  limit?: number;
}
```

### 2. BaseSearchDto Cung Cấp Gì?

Khi extend `BaseSearchDto`, DTO của bạn tự động có:
- `page?: number` - Trang hiện tại (default: 1)
- `limit?: number` - Số items/trang (default: 10)
- `keyword?: string` - Tìm kiếm global
- `sort?: string` - Sắp xếp (format: "field:DESC")
- `sort_by?: string` - Field để sort
- `sort_order?: SortOrder` - ASC hoặc DESC
- `start_date?: string` - Lọc từ ngày
- `end_date?: string` - Lọc đến ngày

### 3. Thêm Filters Cụ Thể

Chỉ thêm các filters đặc thù cho module của bạn:

```typescript
export class SearchProductDto extends BaseSearchDto {
  // Filters cụ thể cho Product
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  min_price?: number;

  @IsOptional()
  @IsBoolean()
  in_stock?: boolean;
}
```

### 4. Apply Filters Trong Service

**Dùng QueryHelper cho base search:**
```typescript
const { page, limit } = QueryHelper.applyBaseSearch(
  queryBuilder,
  searchDto,
  'product',
  ['name', 'description'], // Fields cho keyword search
);
```

**Thêm filters cụ thể:**
```typescript
if (searchDto.category) {
  queryBuilder.andWhere('product.category = :category', {
    category: searchDto.category,
  });
}

if (searchDto.min_price) {
  queryBuilder.andWhere('product.price >= :min_price', {
    min_price: searchDto.min_price,
  });
}
```

## Checklist Khi Tạo Module Mới

- [ ] Search DTO extends `BaseSearchDto`
- [ ] Chỉ thêm filters cụ thể của module
- [ ] Service dùng `QueryHelper.applyBaseSearch()`
- [ ] Apply các filters cụ thể bằng `andWhere()`
- [ ] Test với `keyword`, `page`, `limit`, `sort`

## Ví Dụ Hoàn Chỉnh

### DTO
```typescript
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchCategoryDto extends BaseSearchDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

### Service
```typescript
async search(searchDto: SearchCategoryDto) {
  const qb = this.repository.createQueryBuilder('category');

  // Base search (keyword, pagination, sort)
  const { page, limit } = QueryHelper.applyBaseSearch(
    qb,
    searchDto,
    'category',
    ['code', 'name', 'description'],
  );

  // Specific filters
  if (searchDto.code) {
    qb.andWhere('category.code ILIKE :code', {
      code: `%${searchDto.code}%`,
    });
  }

  if (searchDto.name) {
    qb.andWhere('category.name ILIKE :name', {
      name: `%${searchDto.name}%`,
    });
  }

  if (searchDto.is_active !== undefined) {
    qb.andWhere('category.is_active = :is_active', {
      is_active: searchDto.is_active,
    });
  }

  const [data, total] = await qb.getManyAndCount();

  return { data, total, page, limit };
}
```

## Lưu Ý

- **ILIKE** cho partial match (PostgreSQL)
- **=** cho exact match
- Luôn check `!== undefined` cho boolean filters
- Dùng `%${value}%` cho LIKE search
