import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SalesInvoiceItem } from '../../entities/sales-invoice-item.entity';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('invoice')
  create(@Body() createSalesInvoiceDto: CreateSalesInvoiceDto) {
    return this.salesService.create(createSalesInvoiceDto);
  }

  @Get('invoices')
  findAll() {
    return this.salesService.findAll();
  }

  @Get('invoice/:id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(+id);
  }

  @Get('invoice/code/:code')
  findByCode(@Param('code') code: string) {
    return this.salesService.findByCode(code);
  }

  @Patch('invoice/:id')
  update(
    @Param('id') id: string,
    @Body() updateSalesInvoiceDto: UpdateSalesInvoiceDto,
  ) {
    return this.salesService.update(+id, updateSalesInvoiceDto);
  }

  @Delete('invoice/:id')
  remove(@Param('id') id: string) {
    return this.salesService.remove(+id);
  }

  @Patch('invoice/:id/payment-status')
  updatePaymentStatus(@Param('id') id: string, @Body('paymentStatus') paymentStatus: string) {
    return this.salesService.updatePaymentStatus(+id, paymentStatus);
  }

  @Get('invoice/:id/items')
  getInvoiceItems(@Param('id') id: string) {
    return this.salesService.getInvoiceItems(+id);
  }

  @Patch('invoice/item/:id')
  updateInvoiceItem(
    @Param('id') id: string,
    @Body() updateData: Partial<SalesInvoiceItem>,
  ) {
    return this.salesService.updateInvoiceItem(+id, updateData);
  }

  @Delete('invoice/item/:id')
  removeInvoiceItem(@Param('id') id: string) {
    return this.salesService.removeInvoiceItem(+id);
  }
}
