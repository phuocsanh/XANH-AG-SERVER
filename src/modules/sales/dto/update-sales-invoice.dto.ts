import { PartialType } from '@nestjs/mapped-types';
import { CreateSalesInvoiceDto } from './create-sales-invoice.dto';

/**
 * DTO (Data Transfer Object) dùng để cập nhật thông tin hóa đơn bán hàng
 * Kế thừa từ CreateSalesInvoiceDto nhưng tất cả các trường đều là tùy chọn
 */
export class UpdateSalesInvoiceDto extends PartialType(CreateSalesInvoiceDto) {}
