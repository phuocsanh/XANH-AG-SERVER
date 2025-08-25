import { PartialType } from '@nestjs/mapped-types';
import { CreateSalesInvoiceDto } from './create-sales-invoice.dto';

export class UpdateSalesInvoiceDto extends PartialType(CreateSalesInvoiceDto) {}
