import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryBatchDto } from './dto/create-inventory-batch.dto';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { CreateInventoryReceiptDto, CreateInventoryReceiptItemDto } from './dto/create-inventory-receipt.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ProductGroup,
  StockData,
} from './interfaces/inventory-report.interface';
import { SearchInventoryDto } from './dto/search-inventory.dto';

/**
 * Controller xử lý các request liên quan đến quản lý kho hàng
 * Bao gồm quản lý lô hàng, giao dịch kho, phiếu nhập kho và các chức năng liên quan
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  /**
   * Constructor injection InventoryService
   * @param inventoryService - Service xử lý logic nghiệp vụ kho hàng
   */
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Tạo lô hàng tồn kho mới
   * @param createInventoryBatchDto - Dữ liệu tạo lô hàng tồn kho mới
   * @returns Thông tin lô hàng tồn kho đã tạo
   */
  @Post('batches')
  @RequirePermissions('inventory:manage')
  createBatch(@Body() createInventoryBatchDto: CreateInventoryBatchDto) {
    return this.inventoryService.createBatch(createInventoryBatchDto);
  }

  /**
   * Lấy danh sách tất cả lô hàng tồn kho với phân trang và điều kiện lọc
   * @param page - Trang hiện tại (mặc định: 1)
   * @param limit - Số bản ghi mỗi trang (mặc định: 20)
   * @returns Danh sách lô hàng tồn kho với thông tin phân trang
   */


  /**
   * Tìm kiếm nâng cao lô hàng tồn kho
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách lô hàng tồn kho phù hợp với thông tin phân trang
   */
  @Post('batches/search')
  @RequirePermissions('inventory:read')
  searchBatches(@Body() searchDto: SearchInventoryDto) {
    try {
      return this.inventoryService.searchBatches(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching inventory batches',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Tìm lô hàng tồn kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Danh sách lô hàng tồn kho của sản phẩm đó
   */
  @Get('batches/product/:productId')
  @RequirePermissions('inventory:read')
  findBatchesByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findBatchesByProduct(+productId);
  }

  /**
   * Tìm lô hàng tồn kho theo ID
   * @param id - ID của lô hàng tồn kho cần tìm
   * @returns Thông tin lô hàng tồn kho
   */
  @Get('batches/:id')
  @RequirePermissions('inventory:read')
  findBatchById(@Param('id') id: string) {
    return this.inventoryService.findBatchById(+id);
  }

  /**
   * Cập nhật thông tin lô hàng tồn kho
   * @param id - ID của lô hàng tồn kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật lô hàng tồn kho
   * @returns Thông tin lô hàng tồn kho đã cập nhật
   */
  @Patch('batches/:id')
  @RequirePermissions('inventory:manage')
  updateBatch(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateInventoryBatchDto>,
  ) {
    return this.inventoryService.updateBatch(+id, updateData);
  }

  /**
   * Xóa lô hàng tồn kho theo ID
   * @param id - ID của lô hàng tồn kho cần xóa
   * @returns Kết quả xóa lô hàng tồn kho
   */
  @Delete('batches/:id')
  @RequirePermissions('inventory:manage')
  removeBatch(@Param('id') id: string) {
    return this.inventoryService.removeBatch(+id);
  }

  /**
   * Tạo giao dịch kho mới
   * @param createInventoryTransactionDto - Dữ liệu tạo giao dịch kho mới
   * @returns Thông tin giao dịch kho đã tạo
   */
  @Post('transactions')
  createTransaction(
    @Body() createInventoryTransactionDto: CreateInventoryTransactionDto,
  ) {
    return this.inventoryService.createTransaction(
      createInventoryTransactionDto,
    );
  }

  /**
   * Tìm kiếm nâng cao giao dịch kho
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách giao dịch kho phù hợp với thông tin phân trang
   */
  @Post('transactions/search')
  @RequirePermissions('inventory:read')
  searchTransactions(@Body() searchDto: SearchInventoryDto) {
    try {
      return this.inventoryService.searchTransactions(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching inventory transactions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }



  /**
   * Tìm giao dịch kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Danh sách giao dịch kho của sản phẩm đó
   */
  @Get('transactions/product/:productId')
  @RequirePermissions('inventory:read')
  findTransactionsByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findTransactionsByProduct(+productId);
  }

  /**
   * Lấy tổng hợp tồn kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Tổng hợp tồn kho của sản phẩm
   */
  @Get('summary/product/:productId')
  @RequirePermissions('inventory:read')
  getInventorySummary(@Param('productId') productId: string) {
    return this.inventoryService.getInventorySummary(+productId);
  }

  /**
   * Lấy giá trị FIFO của sản phẩm theo ID
   * @param productId - ID của sản phẩm
   * @returns Giá trị FIFO của sản phẩm
   */
  @Get('fifo/product/:productId')
  @RequirePermissions('inventory:read')
  getFifoValue(@Param('productId') productId: string) {
    return this.inventoryService.getFifoValue(+productId);
  }

  /**
   * Lấy giá vốn trung bình gia quyền của sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Giá vốn trung bình gia quyền hiện tại
   */
  @Get('weighted-average-cost/product/:productId')
  @RequirePermissions('inventory:read')
  getWeightedAverageCost(@Param('productId') productId: string) {
    return this.inventoryService.getWeightedAverageCost(+productId);
  }

  /**
   * Xử lý nhập kho với tính toán giá vốn trung bình gia quyền
   * @param stockInData - Dữ liệu nhập kho
   * @returns Kết quả xử lý nhập kho
   */
  @Post('stock-in')
  @RequirePermissions('inventory:manage')
  processStockIn(
    @Body()
    stockInData: {
      productId: number;
      quantity: number;
      unitCost: number;
      receiptItemId?: number;
      batchCode?: string;
      expiryDate?: Date;
    },
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.processStockIn(
      stockInData.productId,
      stockInData.quantity,
      stockInData.unitCost,
      userId,
      stockInData.receiptItemId,
      stockInData.batchCode,
      stockInData.expiryDate,
    );
  }

  /**
   * Xử lý xuất kho theo phương pháp FIFO
   * @param stockOutData - Dữ liệu xuất kho
   * @returns Kết quả xử lý xuất kho
   */
  @Post('stock-out')
  @RequirePermissions('inventory:manage')
  processStockOut(
    @Body()
    stockOutData: {
      productId: number;
      quantity: number;
      referenceType: string;
      referenceId?: number;
      notes?: string;
    },
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.processStockOut(
      stockOutData.productId,
      stockOutData.quantity,
      stockOutData.referenceType,
      userId,
      stockOutData.referenceId,
      stockOutData.notes,
    );
  }

  /**
   * Tính lại giá vốn trung bình gia quyền cho sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Giá vốn trung bình gia quyền mới
   */
  @Post('recalculate-weighted-average/:productId')
  @RequirePermissions('inventory:manage')
  recalculateWeightedAverageCost(@Param('productId') productId: string) {
    return this.inventoryService.recalculateWeightedAverageCost(+productId);
  }

  /**
   * Lấy báo cáo giá trị tồn kho theo phương pháp WAC
   * @param productIds - Danh sách ID sản phẩm (tùy chọn)
   * @returns Báo cáo giá trị tồn kho
   */
  @Get('value-report')
  @RequirePermissions('inventory:read')
  getInventoryValueReport(@Query('productIds') productIds?: string): Promise<{
    summary: {
      totalProducts: number;
      totalQuantity: number;
      totalValue: number;
      overallAverageCost: number;
    };
    products: ProductGroup[];
    generatedAt: Date;
  }> {
    const ids = productIds ? productIds.split(',').map((id) => +id) : undefined;
    return this.inventoryService.getInventoryValueReport(ids);
  }

  /**
   * Lấy cảnh báo tồn kho thấp
   * @param threshold - Ngưỡng cảnh báo (mặc định: 10)
   * @returns Danh sách sản phẩm có tồn kho thấp
   */
  @Get('low-stock-alert')
  @RequirePermissions('inventory:read')
  getLowStockAlert(@Query('threshold') threshold?: string): Promise<{
    alertCount: number;
    minimumQuantity: number;
    products: Array<
      StockData & { alertLevel: string; recommendedReorder: number }
    >;
    generatedAt: Date;
  }> {
    const thresholdValue = threshold ? +threshold : 10;
    return this.inventoryService.getLowStockAlert(thresholdValue);
  }

  /**
   * Lấy cảnh báo lô hàng sắp hết hạn
   * @param days - Số ngày trước khi hết hạn (mặc định: 30)
   * @returns Danh sách lô hàng sắp hết hạn
   */
  @Get('expiring-batches-alert')
  @RequirePermissions('inventory:read')
  getExpiringBatchesAlert(@Query('days') days?: string) {
    const daysValue = days ? +days : 30;
    return this.inventoryService.getExpiringBatchesAlert(daysValue);
  }

  /**
   * Tính giá vốn FIFO cho một số lượng cụ thể
   * @param productId - ID của sản phẩm
   * @param quantity - Số lượng cần tính giá vốn FIFO
   * @returns Thông tin giá vốn FIFO
   */
  @Get('fifo-cost/product/:productId')
  @RequirePermissions('inventory:read')
  calculateFifoCost(
    @Param('productId') productId: string,
    @Query('quantity') quantity: string,
  ) {
    return this.inventoryService.calculateFifoCost(+productId, +quantity);
  }

  /**
   * Lấy thông tin chi tiết về batch tracking
   * @param productId - ID của sản phẩm (tùy chọn)
   * @returns Thông tin chi tiết về các lô hàng
   */
  @Get('batch-tracking')
  @RequirePermissions('inventory:read')
  getBatchTrackingInfo(@Query('productId') productId?: string) {
    const id = productId ? +productId : undefined;
    return this.inventoryService.getBatchTrackingInfo(id);
  }

  /**
   * Lấy thông tin chi tiết batch tracking cho một sản phẩm cụ thể
   * @param productId - ID của sản phẩm
   * @returns Thông tin chi tiết về các lô hàng của sản phẩm
   */
  @Get('batch-tracking/product/:productId')
  @RequirePermissions('inventory:read')
  getBatchTrackingByProduct(@Param('productId') productId: string) {
    return this.inventoryService.getBatchTrackingInfo(+productId);
  }

  // Inventory Receipt endpoints
  /**
   * Tạo phiếu nhập kho mới
   * @param createInventoryReceiptDto - Dữ liệu tạo phiếu nhập kho mới
   * @returns Thông tin phiếu nhập kho đã tạo
   */
  @Post('receipt')
  @RequirePermissions('inventory:manage')
  createReceipt(
    @Body() createInventoryReceiptDto: CreateInventoryReceiptDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.createReceipt(createInventoryReceiptDto, userId);
  }

  /**
   * Lấy thống kê cho phiếu nhập hàng
   * @param supplier_id - ID nhà cung cấp (tùy chọn). Nếu có, trả về thống kê riêng của NCC đó
   */
  @Get('receipts/stats')
  @RequirePermissions('inventory:read')
  getReceiptStats(
    @Query('supplier_id') supplier_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    const supplierId = supplier_id ? parseInt(supplier_id, 10) : undefined;
    return this.inventoryService.getReceiptStats(supplierId, start_date, end_date);
  }

  /**
   * Lấy danh sách hàng hóa có hóa đơn (taxable_quantity > 0)
   */
  @Get('receipt-items/taxable')
  @RequirePermissions('inventory:read')
  searchTaxableItems(
    @Query('supplier_id') supplier_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    const supplierId = supplier_id ? parseInt(supplier_id, 10) : undefined;
    return this.inventoryService.searchTaxableItems(supplierId, start_date, end_date);
  }

  /**
   * Tìm kiếm nâng cao phiếu nhập kho
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách phiếu nhập kho phù hợp với thông tin phân trang
   */
  @Post('receipts/search')
  @RequirePermissions('inventory:read')
  searchReceipts(@Body() searchDto: SearchInventoryDto) {
    try {
      return this.inventoryService.searchReceipts(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching inventory receipts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  /**
   * Tìm phiếu nhập kho theo ID
   * @param id - ID của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  @Get('receipt/:id')
  @RequirePermissions('inventory:read')
  findReceiptById(@Param('id') id: string) {
    return this.inventoryService.findReceiptById(+id);
  }

  /**
   * Tìm phiếu nhập kho theo mã
   * @param code - Mã của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  @Get('receipt/code/:code')
  @RequirePermissions('inventory:read')
  findReceiptByCode(@Param('code') code: string) {
    return this.inventoryService.findReceiptByCode(code);
  }

  /**
   * Cập nhật thông tin phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật phiếu nhập kho
   * @returns Thông tin phiếu nhập kho đã cập nhật
   */
  @Patch('receipt/:id')
  @RequirePermissions('inventory:manage')
  updateReceipt(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateInventoryReceiptDto>,
  ) {
    return this.inventoryService.updateReceipt(+id, updateData);
  }

  /**
   * Xóa phiếu nhập kho theo ID
   * @param id - ID của phiếu nhập kho cần xóa
   * @returns Kết quả xóa phiếu nhập kho
   */
  @Delete('receipt/:id')
  @RequirePermissions('inventory:manage')
  removeReceipt(@Param('id') id: string) {
    return this.inventoryService.removeReceipt(+id);
  }

  /**
   * Duyệt phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần duyệt
   * @returns Kết quả duyệt phiếu nhập kho
   */
  @Post('receipt/:id/approve')
  @RequirePermissions('inventory:manage')
  approveReceipt(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.inventoryService.approveReceipt(+id, userId);
  }



  /**
   * Hủy phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hủy
   * @param reason - Lý do hủy phiếu nhập kho
   * @returns Kết quả hủy phiếu nhập kho
   */
  @Post('receipt/:id/cancel')
  @RequirePermissions('inventory:manage')
  cancelReceipt(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.cancelReceipt(+id, reason, userId);
  }

  /**
   * Lấy danh sách chi tiết phiếu nhập kho
   * @param id - ID của phiếu nhập kho
   * @returns Danh sách chi tiết phiếu nhập kho
   */
  @Get('receipt/:id/items')
  @RequirePermissions('inventory:read')
  getReceiptItems(@Param('id') id: string) {
    return this.inventoryService.getReceiptItems(+id);
  }

  /**
   * Lấy lịch sử giao dịch kho của một phiếu nhập hàng
   * @param id - ID phiếu nhập
   */
  @Get('receipt/:id/transactions')
  @RequirePermissions('inventory:read')
  getReceiptTransactions(@Param('id') id: string) {
    return this.inventoryService.findTransactionsByReceipt(+id);
  }

  /**
   * Cập nhật thông tin chi tiết phiếu nhập kho
   * @param id - ID của chi tiết phiếu nhập kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật chi tiết phiếu nhập kho
   * @returns Thông tin chi tiết phiếu nhập kho đã cập nhật
   */
  @Patch('receipt/item/:id')
  @RequirePermissions('inventory:manage')
  updateReceiptItem(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateInventoryReceiptItemDto>,
  ) {
    return this.inventoryService.updateReceiptItem(+id, updateData);
  }

  /**
   * Xóa chi tiết phiếu nhập kho theo ID
   * @param id - ID của chi tiết phiếu nhập kho cần xóa
   * @returns Kết quả xóa chi tiết phiếu nhập kho
   */
  @Delete('receipt/item/:id')
  @RequirePermissions('inventory:manage')
  removeReceiptItem(@Param('id') id: string) {
    return this.inventoryService.removeReceiptItem(+id);
  }

  /**
   * Lấy thông tin giá nhập của sản phẩm bao gồm giá nhập mới nhất và giá nhập trung bình
   * @param productId - ID của sản phẩm
   * @returns Thông tin giá nhập của sản phẩm
   */
  @Get('purchase-prices/product/:productId')
  @RequirePermissions('inventory:read')
  getProductPurchasePrices(@Param('productId') productId: string) {
    return this.inventoryService.getProductPurchasePrices(+productId);
  }

  /**
   * Lấy giá nhập mới nhất của sản phẩm từ các phiếu nhập kho
   * @param productId - ID của sản phẩm
   * @returns Giá nhập mới nhất hoặc null nếu chưa có lần nhập nào
   */
  @Get('latest-purchase-price/product/:productId')
  @RequirePermissions('inventory:read')
  getLatestPurchasePrice(@Param('productId') productId: string) {
    return this.inventoryService.getLatestPurchasePrice(+productId);
  }

  // ===== PAYMENT ENDPOINTS =====

  /**
   * Thêm thanh toán cho phiếu nhập kho
   * @param id - ID phiếu nhập kho
   * @param paymentDto - Dữ liệu thanh toán
   * @param userId - ID người tạo
   * @returns Thông tin thanh toán đã tạo
   */
  @Post('receipts/:id/payments')
  @RequirePermissions('inventory:manage')
  addPayment(
    @Param('id') id: string,
    @Body() paymentDto: any,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.addPayment(+id, paymentDto, userId);
  }

  /**
   * Lấy danh sách thanh toán của phiếu nhập kho
   * @param id - ID phiếu nhập kho
   * @returns Danh sách thanh toán
   */
  @Get('receipts/:id/payments')
  @RequirePermissions('inventory:read')
  getPayments(@Param('id') id: string) {
    return this.inventoryService.getPayments(+id);
  }

  /**
   * Lấy danh sách phiếu trả hàng liên quan đến phiếu nhập kho
   * @param id - ID phiếu nhập kho
   * @returns Danh sách phiếu trả hàng
   */
  @Get('receipts/:id/returns')
  @RequirePermissions('inventory:read')
  getReceiptReturns(@Param('id') id: string) {
    return this.inventoryService.getReceiptReturns(+id);
  }

  /**
   * Xóa thanh toán
   * @param id - ID phiếu nhập kho
   * @param paymentId - ID thanh toán
   * @param userId - ID người xóa
   */
  @Delete('receipts/:id/payments/:paymentId')
  @RequirePermissions('inventory:manage')
  deletePayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.inventoryService.deletePayment(+id, +paymentId);
  }

  // ===== REFUND ENDPOINTS =====

  /**
   * Thêm hoàn tiền cho phiếu trả hàng
   * @param id - ID phiếu trả hàng
   * @param refundDto - Dữ liệu hoàn tiền
   * @param userId - ID người tạo
   * @returns Thông tin hoàn tiền đã tạo
   */
  @Post('returns/:id/refunds')
  @RequirePermissions('inventory:manage')
  addRefund(
    @Param('id') id: string,
    @Body() refundDto: any,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.addRefund(+id, refundDto, userId);
  }

  /**
   * Lấy danh sách hoàn tiền của phiếu trả hàng
   * @param id - ID phiếu trả hàng
   * @returns Danh sách hoàn tiền
   */
  @Get('returns/:id/refunds')
  @RequirePermissions('inventory:read')
  getRefunds(@Param('id') id: string) {
    return this.inventoryService.getRefunds(+id);
  }


  // ===== RETURN ENDPOINTS =====

  /**
   * Tạo phiếu xuất trả hàng mới
   * @param createInventoryReturnDto - Dữ liệu tạo phiếu xuất trả hàng mới
   * @returns Thông tin phiếu xuất trả hàng đã tạo
   */
  @Post('return')
  @RequirePermissions('inventory:manage')
  createReturn(
    @Body() createInventoryReturnDto: any,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.createReturn(createInventoryReturnDto, userId);
  }

  /**
   * Tìm kiếm nâng cao phiếu xuất trả hàng
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách phiếu xuất trả hàng phù hợp với thông tin phân trang
   */
  @Post('returns/search')
  @RequirePermissions('inventory:read')
  searchReturns(@Body() searchDto: SearchInventoryDto) {
    try {
      return this.inventoryService.searchReturns(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching inventory returns',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }



  /**
   * Tìm phiếu xuất trả hàng theo ID
   * @param id - ID của phiếu xuất trả hàng cần tìm
   * @returns Thông tin phiếu xuất trả hàng
   */
  @Get('return/:id')
  @RequirePermissions('inventory:read')
  findReturnById(@Param('id') id: string) {
    return this.inventoryService.findReturnById(+id);
  }

  /**
   * Cập nhật thông tin phiếu xuất trả hàng
   */
  @Patch('return/:id')
  @RequirePermissions('inventory:manage')
  updateReturn(
    @Param('id') id: string,
    @Body() updateDto: any,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.updateReturn(+id, updateDto, userId);
  }

  /**
   * Duyệt phiếu xuất trả hàng (và tự động trừ kho)
   * @param id - ID của phiếu xuất trả hàng cần duyệt
   * @param userId - ID người duyệt
   * @returns Kết quả duyệt phiếu xuất trả hàng
   */
  @Post('return/:id/approve')
  @RequirePermissions('inventory:manage')
  approveReturn(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.inventoryService.approveReturn(+id, userId);
  }



  /**
   * Hủy phiếu xuất trả hàng
   * @param id - ID của phiếu xuất trả hàng cần hủy
   * @param reason - Lý do hủy phiếu xuất trả hàng
   * @returns Kết quả hủy phiếu xuất trả hàng
   */
  @Post('return/:id/cancel')
  @RequirePermissions('inventory:manage')
  cancelReturn(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.cancelReturn(+id, reason, userId);
  }

  /**
   * Xóa phiếu xuất trả hàng theo ID
   * @param id - ID của phiếu xuất trả hàng cần xóa
   * @returns Kết quả xóa phiếu xuất trả hàng
   */
  @Delete('return/:id')
  @RequirePermissions('inventory:manage')
  removeReturn(@Param('id') id: string) {
    return this.inventoryService.removeReturn(+id);
  }


  // ===== ADJUSTMENT ENDPOINTS =====

  /**
   * Tạo phiếu điều chỉnh kho mới
   * @param createInventoryAdjustmentDto - Dữ liệu tạo phiếu điều chỉnh kho mới
   * @returns Thông tin phiếu điều chỉnh kho đã tạo
   */
  @Post('adjustments')
  @RequirePermissions('inventory:manage')
  createAdjustment(
    @Body() createInventoryAdjustmentDto: any,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.createAdjustment(
      createInventoryAdjustmentDto,
      userId,
    );
  }

  /**
   * Tìm kiếm nâng cao phiếu điều chỉnh kho
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách phiếu điều chỉnh kho phù hợp với thông tin phân trang
   */
  @Post('adjustments/search')
  @RequirePermissions('inventory:read')
  searchAdjustments(@Body() searchDto: SearchInventoryDto) {
    try {
      return this.inventoryService.searchAdjustments(searchDto);
    } catch (error) {
      throw new HttpException(
        'Error occurred while searching inventory adjustments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }



  /**
   * Tìm phiếu điều chỉnh kho theo ID
   * @param id - ID của phiếu điều chỉnh kho cần tìm
   * @returns Thông tin phiếu điều chỉnh kho
   */
  @Get('adjustments/:id')
  @RequirePermissions('inventory:read')
  async findAdjustmentById(@Param('id') id: string) {
    console.log('🔍 [DEBUG] findAdjustmentById called for ID:', id);
    const result = await this.inventoryService.findAdjustmentById(+id);
    return { ...result, test_server: 'RELOADED_V3' };
  }

  /**
   * Cập nhật thông tin phiếu điều chỉnh kho
   */
  @Put('adjustments/:id')
  @RequirePermissions('inventory:manage')
  updateAdjustment(
    @Param('id') id: string,
    @Body() updateDto: any,
    @CurrentUser('id') userId: number,
  ) {
    console.log('🚀 [DEBUG] updateAdjustment (POST) called for ID:', id);
    return this.inventoryService.updateAdjustment(+id, updateDto, userId);
  }

  /**
   * Duyệt phiếu điều chỉnh kho (và tự động tác động kho)
   * @param id - ID của phiếu điều chỉnh kho cần duyệt
   * @param userId - ID người duyệt
   * @returns Kết quả duyệt phiếu điều chỉnh kho
   */
  @Post('adjustments/:id/approve')
  @RequirePermissions('inventory:manage')
  approveAdjustment(@Param('id') id: string, @CurrentUser('id') userId: number) {
    console.log('🚀 [DEBUG] approveAdjustment called for ID:', id);
    return this.inventoryService.approveAdjustment(+id, userId);
  }


  /**
   * Hủy phiếu điều chỉnh kho
   * @param id - ID của phiếu điều chỉnh kho cần hủy
   * @param reason - Lý do hủy phiếu điều chỉnh kho
   * @returns Kết quả hủy phiếu điều chỉnh kho
   */
  @Post('adjustments/:id/cancel')
  @RequirePermissions('inventory:manage')
  cancelAdjustment(
    @Param('id') id: string, 
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.inventoryService.cancelAdjustment(+id, reason, req.user.id);
  }

  /**
   * Xóa phiếu điều chỉnh kho theo ID
   * @param id - ID của phiếu điều chỉnh kho cần xóa
   * @returns Kết quả xóa phiếu điều chỉnh kho
   */
  @Delete('adjustments/:id')
  @RequirePermissions('inventory:manage')
  removeAdjustment(@Param('id') id: string) {
    return this.inventoryService.removeAdjustment(+id);
  }

  /**
   * Đồng bộ dữ liệu tồn kho thuế từ cũ sang mới
   */
  @Post('sync-taxable-data')
  @RequirePermissions('inventory:manage')
  syncTaxableData() {
    return this.inventoryService.syncTaxableData();
  }
}
