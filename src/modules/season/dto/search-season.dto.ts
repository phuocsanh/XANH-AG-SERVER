import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchSeasonDto extends BaseSearchDto {
  @IsNumber() @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() name?: string;
  
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
  
  @IsDateString() @IsOptional() created_at?: string;
}
