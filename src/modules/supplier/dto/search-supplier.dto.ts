import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchSupplierDto extends BaseSearchDto {
  @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
}
