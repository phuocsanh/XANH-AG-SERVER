import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryBatchDto } from './dto/create-inventory-batch.dto';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { CreateInventoryReceiptDto } from './dto/create-inventory-receipt.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
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
@UseGuards(JwtAuthGuard)
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
  createBatch(@Body() createInventoryBatchDto: CreateInventoryBatchDto) {
    return this.inventoryService.createBatch(createInventoryBatchDto);
  }

  /**
   * Lấy danh sách tất cả lô hàng tồn kho
   * @returns Danh sách lô hàng tồn kho
   */
  @Get('batches')
  findAllBatches() {
    return this.inventoryService.findAllBatches();
  }

  /**
   * Tìm kiếm nâng cao lô hàng tồn kho
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách lô hàng tồn kho phù hợp
   */
  @Post('batches/search')
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
  findBatchesByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findBatchesByProduct(+productId);
  }

  /**
   * Tìm lô hàng tồn kho theo ID
   * @param id - ID của lô hàng tồn kho cần tìm
   * @returns Thông tin lô hàng tồn kho
   */
  @Get('batches/:id')
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
   * Lấy danh sách tất cả giao dịch kho
   * @returns Danh sách giao dịch kho
   */
  @Get('transactions')
  findAllTransactions() {
    return this.inventoryService.findAllTransactions();
  }

  /**
   * Tìm giao dịch kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Danh sách giao dịch kho của sản phẩm đó
   */
  @Get('transactions/product/:productId')
  findTransactionsByProduct(@Param('productId') productId: string) {
    return this.inventoryService.findTransactionsByProduct(+productId);
  }

  /**
   * Lấy tổng hợp tồn kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Tổng hợp tồn kho của sản phẩm
   */
  @Get('summary/product/:productId')
  getInventorySummary(@Param('productId') productId: string) {
    return this.inventoryService.getInventorySummary(+productId);
  }

  /**
   * Lấy giá trị FIFO của sản phẩm theo ID
   * @param productId - ID của sản phẩm
   * @returns Giá trị FIFO của sản phẩm
   */
  @Get('fifo/product/:productId')
  getFifoValue(@Param('productId') productId: string) {
    return this.inventoryService.getFifoValue(+productId);
  }

  /**
   * Lấy giá vốn trung bình gia quyền của sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Giá vốn trung bình gia quyền hiện tại
   */
  @Get('weighted-average-cost/product/:productId')
  getWeightedAverageCost(@Param('productId') productId: string) {
    return this.inventoryService.getWeightedAverageCost(+productId);
  }

  /**
   * Xử lý nhập kho với tính toán giá vốn trung bình gia quyền
   * @param stockInData - Dữ liệu nhập kho
   * @returns Kết quả xử lý nhập kho
   */
  @Post('stock-in')
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
  ) {
    return this.inventoryService.processStockIn(
      stockInData.productId,
      stockInData.quantity,
      stockInData.unitCost,
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
  processStockOut(
    @Body()
    stockOutData: {
      productId: number;
      quantity: number;
      referenceType: string;
      referenceId?: number;
      notes?: string;
    },
  ) {
    return this.inventoryService.processStockOut(
      stockOutData.productId,
      stockOutData.quantity,
      stockOutData.referenceType,
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
  recalculateWeightedAverageCost(@Param('productId') productId: string) {
    return this.inventoryService.recalculateWeightedAverageCost(+productId);
  }

  /**
   * Lấy báo cáo giá trị tồn kho theo phương pháp WAC
   * @param productIds - Danh sách ID sản phẩm (tùy chọn)
   * @returns Báo cáo giá trị tồn kho
   */
  @Get('value-report')
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
  createReceipt(@Body() createInventoryReceiptDto: CreateInventoryReceiptDto) {
    return this.inventoryService.createReceipt(createInventoryReceiptDto);
  }

  /**
   * Lấy danh sách tất cả phiếu nhập kho
   * @returns Danh sách phiếu nhập kho
   */
  @Get('receipts')
  findAllReceipts() {
    return this.inventoryService.findAllReceipts();
  }

  /**
   * Tìm phiếu nhập kho theo ID
   * @param id - ID của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  @Get('receipt/:id')
  findReceiptById(@Param('id') id: string) {
    return this.inventoryService.findReceiptById(+id);
  }

  /**
   * Tìm phiếu nhập kho theo mã
   * @param code - Mã của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  @Get('receipt/code/:code')
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
  removeReceipt(@Param('id') id: string) {
    return this.inventoryService.removeReceipt(+id);
  }

  /**
   * Duyệt phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần duyệt
   * @returns Kết quả duyệt phiếu nhập kho
   */
  @Post('receipt/:id/approve')
  approveReceipt(@Param('id') id: string) {
    return this.inventoryService.approveReceipt(+id);
  }

  /**
   * Hoàn thành phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hoàn thành
   * @returns Kết quả hoàn thành phiếu nhập kho
   */
  @Post('receipt/:id/complete')
  completeReceipt(@Param('id') id: string) {
    return this.inventoryService.completeReceipt(+id);
  }

  /**
   * Hủy phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hủy
   * @param reason - Lý do hủy phiếu nhập kho
   * @returns Kết quả hủy phiếu nhập kho
   */
  @Post('receipt/:id/cancel')
  cancelReceipt(@Param('id') id: string, @Body('reason') reason: string) {
    return this.inventoryService.cancelReceipt(+id, reason);
  }

  /**
   * Lấy danh sách chi tiết phiếu nhập kho
   * @param id - ID của phiếu nhập kho
   * @returns Danh sách chi tiết phiếu nhập kho
   */
  @Get('receipt/:id/items')
  getReceiptItems(@Param('id') id: string) {
    return this.inventoryService.getReceiptItems(+id);
  }

  /**
   * Cập nhật thông tin chi tiết phiếu nhập kho
   * @param id - ID của chi tiết phiếu nhập kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật chi tiết phiếu nhập kho
   * @returns Thông tin chi tiết phiếu nhập kho đã cập nhật
   */
  @Patch('receipt/item/:id')
  updateReceiptItem(
    @Param('id') id: string,
    @Body() updateData: Partial<InventoryReceiptItem>,
  ) {
    return this.inventoryService.updateReceiptItem(+id, updateData);
  }

  /**
   * Xóa chi tiết phiếu nhập kho theo ID
   * @param id - ID của chi tiết phiếu nhập kho cần xóa
   * @returns Kết quả xóa chi tiết phiếu nhập kho
   */
  @Delete('receipt/item/:id')
  removeReceiptItem(@Param('id') id: string) {
    return this.inventoryService.removeReceiptItem(+id);
  }

  /**
   * Lấy thông tin giá nhập của sản phẩm bao gồm giá nhập mới nhất và giá nhập trung bình
   * @param productId - ID của sản phẩm
   * @returns Thông tin giá nhập của sản phẩm
   */
  @Get('purchase-prices/product/:productId')
  getProductPurchasePrices(@Param('productId') productId: string) {
    return this.inventoryService.getProductPurchasePrices(+productId);
  }

  /**
   * Lấy giá nhập mới nhất của sản phẩm từ các phiếu nhập kho
   * @param productId - ID của sản phẩm
   * @returns Giá nhập mới nhất hoặc null nếu chưa có lần nhập nào
   */
  @Get('latest-purchase-price/product/:productId')
  getLatestPurchasePrice(@Param('productId') productId: string) {
    return this.inventoryService.getLatestPurchasePrice(+productId);
  }
}
