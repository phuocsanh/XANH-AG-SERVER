import { IsOptional, IsString } from 'class-validator';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchCustomerDto extends BaseSearchDto {
  /**
   * Filter theo loại khách hàng (regular, vip...)
   */
  @IsString()
  @IsOptional()
  type?: string;

  /**
   * Filter theo số điện thoại
   */
  @IsString()
  @IsOptional()
  phone?: string;

  /**
   * Filter theo mã khách hàng
   */
  @IsString()
  @IsOptional()
  code?: string;

  /**
   * Tìm kiếm theo từ khóa (alias cho keyword)
   */
  @IsString()
  @IsOptional()
  search?: string;
}
