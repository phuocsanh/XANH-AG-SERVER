# CLINE Rules - XANH-AG-SERVER (NestJS Backend API)

## Project Overview

Backend API cho ứng dụng Xanh AG, sử dụng NestJS framework với PostgreSQL database thông qua TypeORM.

## Tech Stack

- **Framework:** NestJS v11
- **Language:** TypeScript v5
- **Database:** PostgreSQL
- **ORM:** TypeORM v0.3
- **Authentication:** JWT + Passport
- **Validation:** class-validator + class-transformer
- **Documentation:** Swagger/OpenAPI
- **Deploy:** Vercel

## Architecture Pattern

### Modular Structure

```
src/
├── common/          # Shared utilities, guards, interceptors, filters
├── config/         # Database configuration, environment setup
├── database/       # Migrations, seeds
├── dto/            # Shared DTOs
├── entities/       # TypeORM entities (root level)
├── modules/        # Feature modules (one folder per feature)
├── migrations/     # Database migrations
├── utils/          # Utility functions
├── main.ts         # Application entry point
└── app.module.ts   # Root module
```

### Module Structure Pattern

```
modules/[feature-name]/
├── [feature].module.ts
├── [feature].controller.ts
├── [feature].service.ts
└── dto/
    ├── create-[feature].dto.ts
    ├── update-[feature].dto.ts
    └── [feature].dto.ts
```

## Naming Conventions

### Files & Directories

- Files: `kebab-case` (e.g., `user.controller.ts`, `base-search.dto.ts`)
- Feature folders: `kebab-case` (e.g., `sales-invoices`, `cost-item`)

### Code

- Classes: `PascalCase` (e.g., `UserController`, `SalesInvoiceService`)
- Variables/Functions: `camelCase` (e.g., `getUserData`, `findAll`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- Decorators: `kebab-case` (e.g., `check-ownership.decorator.ts`)

### Database Entities

- Entity files: `kebab-case` with `.entity.ts` suffix
- Entity class: `PascalCase` with suffix `Entity` if needed (e.g., `SalesInvoices`)
- Table names: Use original naming from existing entities

## Code Style

### General Rules

```typescript
// Use explicit types, avoid 'any' when possible
async function bootstrap(): Promise<any> {}

// Use async/await, not raw promises
const data = await service.getData()

// Use optional chaining
const value = object?.property

// Use explicit return types for public methods
async findAll(): Promise<YourEntity[]> {}
```

### Imports Order

```typescript
// 1. NestJS & external packages
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

// 2. TypeORM
import { Repository, FindOptionsWhere } from 'typeorm';

// 3. Internal imports (from this project)
import { YourEntity } from '../../entities/your-entity.entity';
import { CreateYourDto } from './dto/create-your.dto';
```

### Swagger Documentation

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('your-feature')
@ApiBearerAuth()
@Controller('your-feature')
export class YourController {
  @ApiOperation({ summary: 'Lấy danh sách' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(): Promise<YourEntity[]> {
    // implementation
  }
}
```

### DTO Pattern

```typescript
import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateYourDto {
  @ApiProperty({ description: 'Tên', required: true })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateYourDto extends CreateYourDto {
  // Add update-specific fields if needed
}
```

### Service Pattern

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YourEntity } from '../../entities/your-entity.entity';
import { CreateYourDto } from './dto/create-your.dto';
import { UpdateYourDto } from './dto/update-your.dto';

@Injectable()
export class YourService {
  private readonly logger = new Logger(YourService.name);

  constructor(
    @InjectRepository(YourEntity)
    private readonly repository: Repository<YourEntity>,
  ) {}

  async create(createDto: CreateYourDto): Promise<YourEntity> {
    const entity = this.repository.create(createDto);
    return await this.repository.save(entity);
  }

  async findAll(): Promise<YourEntity[]> {
    return await this.repository.find();
  }

  async findOne(id: number): Promise<YourEntity | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async update(
    id: number,
    updateDto: UpdateYourDto,
  ): Promise<YourEntity | null> {
    await this.repository.update(id, updateDto);
    return await this.repository.findOne({ where: { id } });
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
```

### Controller Pattern

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { YourService } from './your.service';
import { CreateYourDto } from './dto/create-your.dto';
import { UpdateYourDto } from './dto/update-your.dto';

@Controller('your-endpoint')
export class YourController {
  constructor(private readonly service: YourService) {}

  @Post()
  create(@Body() createDto: CreateYourDto) {
    return this.service.create(createDto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateYourDto,
  ) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
```

### Module Pattern

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YourEntity } from '../../entities/your-entity.entity';
import { YourController } from './your.controller';
import { YourService } from './your.service';

@Module({
  imports: [TypeOrmModule.forFeature([YourEntity])],
  controllers: [YourController],
  providers: [YourService],
  exports: [YourService], // Export if used by other modules
})
export class YourModule {}
```

## Database & TypeORM

### Entity Pattern

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('your_table_name')
export class YourEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  @ApiProperty()
  name: string;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional()
  description?: string;

  @Column({ default: true })
  @ApiProperty()
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @UpdatedAtColumn()
  updatedAt: Date;
}
```

### Migration Naming

```
[timestamp]-Description.ts
// Example: 1737000000000-AddTaxableQuantityToReceiptItems.ts
```

### Running Migrations

```bash
# Generate new migration
npm run migration:generate -- src/migrations/[timestamp]-Description.ts

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## Comments & Documentation

### Vietnamese Comments

- Sử dụng tiếng Việt cho comments giải thích logic phức tạp
- Sử dụng emoji indicators cho clarity

```typescript
// 🎉 CACHE APP CHO VERCEL (Tăng tốc khởi động serverless)
// 🚀 KHỞI CHẠY (Chỉ dành cho Render / Local)
// ⚠️ EXPORT CHO VERCEL (Cực kỳ quan trọng)
// ✅ Cấu hình thành công
// ❌ Lỗi xử lý
```

### JSDoc for Functions

```typescript
/**
 * Hàm xử lý tìm kiếm danh sách entity
 * @param searchDto - DTO chứa các điều kiện tìm kiếm
 * @returns Danh sách entity theo điều kiện
 */
async findBySearch(searchDto: SearchDto): Promise<{ data: YourEntity[], total: number }> {
  // implementation
}
```

## API Response Format

### Standard Response

- Response được chuẩn hóa qua `ResponseInterceptor`
- Không tự format response trong controller, để interceptor xử lý

### Error Handling

```typescript
// Sử dụng HttpException hoặc các lớp con
throw new NotFoundException('Không tìm thấy bản ghi');
throw new BadRequestException('Dữ liệu không hợp lệ');

// Hoặc sử dụng BusinessLogicException từ common
throw new BusinessLogicException('Mã lỗi', 'Thông báo lỗi');
```

## Common Module Imports

### Common Module Location

- Guards: `src/common/guards/`
- Decorators: `src/common/decorators/`
- Filters: `src/common/filters/http-exception.filter.ts`
- Interceptors: `src/common/interceptors/`
- Services: `src/common/services/base-search.service.ts`
- DTOs: `src/common/dto/base-search.dto.ts`

## Important Notes

1. **Luôn luôn** sử dụng `class-validator` decorators trong DTO
2. **Luôn luôn** thêm Swagger decorators cho API documentation
3. **Luôn luôn** inject repository qua `@InjectRepository`
4. **Không** hardcode giá trị - sử dụng environment variables
5. **Không** viết raw SQL trừ khi cần thiết (sử dụng QueryBuilder)
6. **Kiểm tra** migration trước khi commit
7. **Tuân thủ** pattern hiện có trong codebase
8. **Error messages** phải bằng tiếng Việt

## Prohibited Actions

- ❌ Không dùng `any` type mà không có lý do chính đáng
- ❌ Không hardcode API URLs hoặc secrets
- ❌ Không commit file `.env` hoặc sensitive data
- ❌ Không bypass validation pipe
- ❌ Không skip Swagger documentation
- ❌ Không tạo migration mà không test trước

## Task Completion Rules

**Khi hoàn thành task, luôn luôn:**

1. **Kiểm tra lỗi TypeScript**: Chạy `npx tsc --noEmit`
2. **Chạy build test**: Chạy `npm run build`
3. **Xác nhận thành công**: Đảm bảo không có lỗi TypeScript mới do thay đổi (lỗi pre-existing không tính)
