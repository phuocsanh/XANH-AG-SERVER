import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Bộ lọc tối thiểu cho danh sách chọn user, không trả dữ liệu nhạy cảm. */
export class UserSearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  keyword!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
