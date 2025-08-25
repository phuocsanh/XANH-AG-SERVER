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

  @Post('invoice/:id/confirm')
  confirmInvoice(@Param('id') id: string) {
    return this.salesService.confirmInvoice(+id);
  }

  @Post('invoice/:id/deliver')
  deliverInvoice(@Param('id') id: string) {
    return this.salesService.deliverInvoice(+id);
  }

  @Post('invoice/:id/complete')
  completeInvoice(@Param('id') id: string) {
    return this.salesService.completeInvoice(+id);
  }

  @Post('invoice/:id/cancel')
  cancelInvoice(@Param('id') id: string, @Body('reason') reason: string) {
    return this.salesService.cancelInvoice(+id, reason);
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
