import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Bộ lọc phân trang cho lịch sử thay đổi quyền. */
export class AuditQueryDto {
  @IsOptional()
  @IsIn(['role', 'user'])
  targetType?: 'role' | 'user';

  @IsOptional()
  @IsString()
  roleCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
