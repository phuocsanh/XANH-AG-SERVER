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
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';

/**
 * Controller xử lý các request liên quan đến quản lý bán hàng
 * Bao gồm quản lý hóa đơn bán hàng và chi tiết hóa đơn
 */
@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  /**
   * Constructor injection SalesService
   * @param salesService - Service xử lý logic nghiệp vụ bán hàng
   */
  constructor(private readonly salesService: SalesService) {}

  /**
   * Tạo hóa đơn bán hàng mới
   * @param createSalesInvoiceDto - Dữ liệu tạo hóa đơn bán hàng mới
   * @returns Thông tin hóa đơn bán hàng đã tạo
   */
  @Post('invoice')
  create(@Body() createSalesInvoiceDto: CreateSalesInvoiceDto) {
    return this.salesService.create(createSalesInvoiceDto);
  }

  /**
   * Lấy danh sách tất cả hóa đơn bán hàng
   * @returns Danh sách hóa đơn bán hàng
   */
  @Get('invoices')
  findAll() {
    return this.salesService.findAll();
  }

  /**
   * Tìm hóa đơn bán hàng theo ID
   * @param id - ID của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng
   */
  @Get('invoice/:id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(+id);
  }

  /**
   * Tìm hóa đơn bán hàng theo mã
   * @param code - Mã của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng
   */
  @Get('invoice/code/:code')
  findByCode(@Param('code') code: string) {
    return this.salesService.findByCode(code);
  }

  /**
   * Cập nhật thông tin hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param updateSalesInvoiceDto - Dữ liệu cập nhật hóa đơn bán hàng
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  @Patch('invoice/:id')
  update(
    @Param('id') id: string,
    @Body() updateSalesInvoiceDto: UpdateSalesInvoiceDto,
  ) {
    return this.salesService.update(+id, updateSalesInvoiceDto);
  }

  /**
   * Xóa hóa đơn bán hàng theo ID
   * @param id - ID của hóa đơn bán hàng cần xóa
   * @returns Kết quả xóa hóa đơn bán hàng
   */
  @Delete('invoice/:id')
  remove(@Param('id') id: string) {
    return this.salesService.remove(+id);
  }

  /**
   * Cập nhật trạng thái thanh toán của hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param paymentStatus - Trạng thái thanh toán mới
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  @Patch('invoice/:id/payment-status')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body('paymentStatus') paymentStatus: string,
  ) {
    return this.salesService.updatePaymentStatus(+id, paymentStatus);
  }

  /**
   * Lấy danh sách chi tiết hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng
   * @returns Danh sách chi tiết hóa đơn bán hàng
   */
  @Get('invoice/:id/items')
  getInvoiceItems(@Param('id') id: string) {
    return this.salesService.getInvoiceItems(+id);
  }

  /**
   * Cập nhật thông tin chi tiết hóa đơn bán hàng
   * @param id - ID của chi tiết hóa đơn bán hàng cần cập nhật
   * @param updateData - Dữ liệu cập nhật chi tiết hóa đơn bán hàng
   * @returns Thông tin chi tiết hóa đơn bán hàng đã cập nhật
   */
  @Patch('invoice/item/:id')
  updateInvoiceItem(
    @Param('id') id: string,
    @Body() updateData: Partial<SalesInvoiceItem>,
  ) {
    return this.salesService.updateInvoiceItem(+id, updateData);
  }

  /**
   * Xóa chi tiết hóa đơn bán hàng theo ID
   * @param id - ID của chi tiết hóa đơn bán hàng cần xóa
   * @returns Kết quả xóa chi tiết hóa đơn bán hàng
   */
  @Delete('invoice/item/:id')
  removeInvoiceItem(@Param('id') id: string) {
    return this.salesService.removeInvoiceItem(+id);
  }
}
