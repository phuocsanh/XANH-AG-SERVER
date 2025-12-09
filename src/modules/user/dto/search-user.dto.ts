import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchUserDto extends BaseSearchDto {
  @IsNumber() @IsOptional() @Type(() => Number) id?: number;
  @IsString() @IsOptional() account?: string;
  @IsString() @IsOptional() full_name?: string;
  @IsString() @IsOptional() phone_number?: string;
  @IsString() @IsOptional() email?: string;
  
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() user_type?: string;

  @IsDateString() @IsOptional() created_at?: string;
  @IsDateString() @IsOptional() updated_at?: string;
}
