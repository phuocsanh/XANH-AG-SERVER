import {
  IsOptional,
  IsEnum,
  IsString,
  IsArray,
} from 'class-validator';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

export class SearchNewsDto extends BaseSearchDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsOptional()
  @IsArray()
  filters?: any[];

  @IsOptional()
  @IsEnum(['AND', 'OR', 'MUST', 'SHOULD', 'MUST_NOT'])
  operator?: 'AND' | 'OR' | 'MUST' | 'SHOULD' | 'MUST_NOT' = 'AND';

  @IsOptional()
  @IsArray()
  nested_filters?: SearchNewsDto[];
}
