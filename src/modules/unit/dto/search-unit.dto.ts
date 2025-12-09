import { IsOptional, IsString } from 'class-validator';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchUnitDto extends BaseSearchDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() status?: string;
}
