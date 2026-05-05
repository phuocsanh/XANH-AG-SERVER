import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceStatus, SalesPaymentStatus } from '../../entities/sales-invoices.entity';
import { SearchSalesDto } from './dto/search-sales.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Controller xử lý các request liên quan đến quản lý bán hàng
 * Bao gồm quản lý hóa đơn bán hàng và chi tiết hóa đơn
 */
@Controller('sales')
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:create')
  create(
    @Body() createSalesInvoiceDto: CreateSalesInvoiceDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.salesService.create(createSalesInvoiceDto, userId);
  }

  /**
   * Lấy danh sách tất cả hóa đơn bán hàng với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @param status - Trạng thái cần lọc
   * @param deleted - Lọc theo trạng thái xóa (true: đã xóa, false: chưa xóa, undefined: tất cả)
   * @returns Danh sách hóa đơn bán hàng với thông tin phân trang
   */


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
  @UseGuards(JwtAuthGuard)
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
   * Lấy hóa đơn bán hàng gần nhất của một khách hàng
   * @param customerId - ID của khách hàng cần lấy đơn hàng gần nhất
   * @returns Thông tin hóa đơn bán hàng gần nhất của khách hàng
   */
  @Get('invoice/customer/:customerId/latest')
  findLatestByCustomer(@Param('customerId') customerId: string) {
    return this.salesService.findLatestByCustomer(+customerId);
  }

  /**
   * Cập nhật thông tin hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param updateSalesInvoiceDto - Dữ liệu cập nhật hóa đơn bán hàng
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  @Patch('invoice/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  update(
    @Param('id') id: string,
    @Body() updateSalesInvoiceDto: UpdateSalesInvoiceDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.salesService.update(+id, updateSalesInvoiceDto, userId);
  }

  /**
   * Xác nhận hóa đơn bán hàng (chuyển từ DRAFT sang CONFIRMED)
   * @param id - ID của hóa đơn bán hàng cần xác nhận
   * @returns Thông tin hóa đơn bán hàng đã xác nhận
   */
  @Patch('invoice/:id/confirm')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  confirmInvoice(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.salesService.confirmInvoice(+id, userId);
  }

  /**
   * Đánh dấu hóa đơn bán hàng đã thanh toán
   * @param id - ID của hóa đơn bán hàng cần đánh dấu đã thanh toán
   * @returns Thông tin hóa đơn bán hàng đã thanh toán
   */
  @Patch('invoice/:id/paid')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  markAsPaid(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.salesService.markAsPaid(+id, userId);
  }

  /**
   * Hủy hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hủy
   * @returns Thông tin hóa đơn bán hàng đã hủy
   */
  @Patch('invoice/:id/cancel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  cancelInvoice(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.salesService.cancelInvoice(+id, userId);
  }

  /**
   * Hoàn tiền hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hoàn tiền
   * @returns Thông tin hóa đơn bán hàng đã hoàn tiền
   */
  @Patch('invoice/:id/refund')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  refundInvoice(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.salesService.refundInvoice(+id, userId);
  }

  /**
   * Xóa mềm hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần xóa mềm
   * @returns Thông tin hóa đơn bán hàng đã xóa mềm
   */
  @Delete('invoice/:id/soft')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  softDelete(@Param('id') id: string) {
    return this.salesService.softDelete(+id);
  }

  /**
   * Khôi phục hóa đơn bán hàng đã xóa mềm
   * @param id - ID của hóa đơn bán hàng cần khôi phục
   * @returns Thông tin hóa đơn bán hàng đã khôi phục
   */
  @Patch('invoice/:id/restore')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  restore(@Param('id') id: string) {
    return this.salesService.restore(+id);
  }

  /**
   * Xóa hóa đơn bán hàng theo ID (xóa cứng)
   * @param id - ID của hóa đơn bán hàng cần xóa
   * @returns Kết quả xóa hóa đơn bán hàng
   */
  @Delete('invoice/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body('paymentStatus') paymentStatus: SalesPaymentStatus,
  ) {
    return this.salesService.updatePaymentStatus(+id, paymentStatus);
  }

  /**
   * Thanh toán thêm cho hóa đơn (bán thiếu)
   * @param id - ID của hóa đơn bán hàng
   * @param amount - Số tiền thanh toán thêm
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  @Patch('invoice/:id/add-payment')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  addPartialPayment(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @CurrentUser('id') userId: number,
  ) {
    // Ép kiểu Number() tường minh để tránh bug cộng chuỗi khi JSON body không parse đúng type
    return this.salesService.addPartialPayment(+id, Number(amount), userId);
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  removeInvoiceItem(@Param('id') id: string) {
    return this.salesService.removeInvoiceItem(+id);
  }

  /**
   * Tìm kiếm nâng cao hóa đơn bán hàng
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách hóa đơn bán hàng phù hợp
   */
  @Post('invoices/search')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:read')
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
  /**
   * Lấy lịch sử mua hàng tổng hợp của một khách hàng theo mùa vụ
   * @param id - ID của khách hàng
   * @param seasonId - ID của mùa vụ (query param)
   * @returns Danh sách các sản phẩm khách hàng đã mua
   */
  @Get('customer/:id/purchase-history')
  @UseGuards(JwtAuthGuard)
  getCustomerPurchaseHistory(
    @Param('id') id: string,
    @Query('seasonId') seasonId?: string,
  ) {
    return this.salesService.getCustomerPurchaseHistory(+id, seasonId ? +seasonId : undefined);
  }

  /**
   * Đồng bộ tồn kho cho tất cả các hóa đơn cũ
   */
  @Post('sync-inventory')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('sales:manage')
  syncAllInventory(@CurrentUser('id') userId: number) {
    return this.salesService.syncAllInventory(userId);
  }
}
