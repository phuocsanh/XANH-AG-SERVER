import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchCustomerDto extends BaseSearchDto {
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  
  @IsNumber() @IsOptional() @Type(() => Number) province_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) district_id?: number;
  @IsNumber() @IsOptional() @Type(() => Number) ward_id?: number;

  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
}
