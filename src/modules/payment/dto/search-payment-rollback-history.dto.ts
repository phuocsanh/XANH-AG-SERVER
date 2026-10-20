import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseSearchDto } from '../../../common/dto/base-search.dto';

/** Bộ lọc lịch sử hoàn tác phiếu thu. */
export class SearchPaymentRollbackHistoryDto extends BaseSearchDto {
  @IsString() @IsOptional() payment_code?: string;
  @IsString() @IsOptional() customer_name?: string;
  @IsString() @IsOptional() debt_note_code?: string;
  @IsNumber() @IsOptional() @Type(() => Number) rolled_back_by?: number;
  @IsDateString() @IsOptional() from_date?: string;
  @IsDateString() @IsOptional() to_date?: string;
}
