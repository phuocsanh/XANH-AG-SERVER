import { IsString, IsArray, IsOptional, IsEnum, IsInt, IsBoolean } from 'class-validator';
import { BaseStatus } from '../../../entities/base-status.enum';

export class CreateNewsDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  content!: string;

  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  author?: string;

  @IsEnum(BaseStatus)
  @IsOptional()
  status?: BaseStatus;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  /** Danh sách ID sản phẩm liên quan */
  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  related_product_ids?: number[];

  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;
}
