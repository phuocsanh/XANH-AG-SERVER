import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  // UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SearchSalesDto } from './dto/search-sales.dto';

/**
 * Controller xử lý các request liên quan đến quản lý bán hàng
 * Bao gồm quản lý hóa đơn bán hàng và chi tiết hóa đơn
 */
@Controller('sales')
// @UseGuards(JwtAuthGuard) // Tạm thời bỏ guard để kiểm thử
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
   * Lấy danh sách tất cả hóa đơn bán hàng (không bao gồm đã xóa mềm)
   * @returns Danh sách hóa đơn bán hàng
   */
  @Get('invoices')
  findAll() {
    return this.salesService.findAll();
  }

  /**
   * Lấy danh sách hóa đơn bán hàng theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách hóa đơn bán hàng theo trạng thái
   */
  @Get('invoices/status/:status')
  findByStatus(@Param('status') status: SalesInvoiceStatus) {
    return this.salesService.findByStatus(status);
  }

  /**
   * Lấy danh sách hóa đơn bán hàng đã xóa mềm
   * @returns Danh sách hóa đơn bán hàng đã xóa mềm
   */
  @Get('invoices/deleted')
  findDeleted() {
    return this.salesService.findDeleted();
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
   * Xác nhận hóa đơn bán hàng (chuyển từ DRAFT sang CONFIRMED)
   * @param id - ID của hóa đơn bán hàng cần xác nhận
   * @returns Thông tin hóa đơn bán hàng đã xác nhận
   */
  @Patch('invoice/:id/confirm')
  confirmInvoice(@Param('id') id: string) {
    return this.salesService.confirmInvoice(+id);
  }

  /**
   * Đánh dấu hóa đơn bán hàng đã thanh toán
   * @param id - ID của hóa đơn bán hàng cần đánh dấu đã thanh toán
   * @returns Thông tin hóa đơn bán hàng đã thanh toán
   */
  @Patch('invoice/:id/paid')
  markAsPaid(@Param('id') id: string) {
    return this.salesService.markAsPaid(+id);
  }

  /**
   * Hủy hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hủy
   * @returns Thông tin hóa đơn bán hàng đã hủy
   */
  @Patch('invoice/:id/cancel')
  cancelInvoice(@Param('id') id: string) {
    return this.salesService.cancelInvoice(+id);
  }

  /**
   * Hoàn tiền hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hoàn tiền
   * @returns Thông tin hóa đơn bán hàng đã hoàn tiền
   */
  @Patch('invoice/:id/refund')
  refundInvoice(@Param('id') id: string) {
    return this.salesService.refundInvoice(+id);
  }

  /**
   * Xóa mềm hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần xóa mềm
   * @returns Thông tin hóa đơn bán hàng đã xóa mềm
   */
  @Delete('invoice/:id/soft')
  softDelete(@Param('id') id: string) {
    return this.salesService.softDelete(+id);
  }

  /**
   * Khôi phục hóa đơn bán hàng đã xóa mềm
   * @param id - ID của hóa đơn bán hàng cần khôi phục
   * @returns Thông tin hóa đơn bán hàng đã khôi phục
   */
  @Patch('invoice/:id/restore')
  restore(@Param('id') id: string) {
    return this.salesService.restore(+id);
  }

  /**
   * Xóa hóa đơn bán hàng theo ID (xóa cứng)
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

  /**
   * Tìm kiếm nâng cao hóa đơn bán hàng
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách hóa đơn bán hàng phù hợp
   */
  @Post('invoices/search')
  search(@Body() searchDto: SearchSalesDto) {
    try {
      return this.salesService.searchSalesInvoices(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching sales invoices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
