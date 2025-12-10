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
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
  @RequirePermissions('INVENTORY_MANAGE')
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
   * Tìm kiếm nâng cao giao dịch kho
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách giao dịch kho phù hợp với thông tin phân trang
   */
  @Post('transactions/search')
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
  @RequirePermissions('INVENTORY_MANAGE')
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
  @RequirePermissions('INVENTORY_MANAGE')
  createReceipt(
    @Body() createInventoryReceiptDto: CreateInventoryReceiptDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.createReceipt(createInventoryReceiptDto, userId);
  }

  /**
   * Tìm kiếm nâng cao phiếu nhập kho
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách phiếu nhập kho phù hợp với thông tin phân trang
   */
  @Post('receipts/search')
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
  completeReceipt(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.inventoryService.completeReceipt(+id, userId);
  }

  /**
   * Hủy phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hủy
   * @param reason - Lý do hủy phiếu nhập kho
   * @returns Kết quả hủy phiếu nhập kho
   */
  @Post('receipt/:id/cancel')
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

  /**
   * Upload hình ảnh hóa đơn cho phiếu nhập kho
   * @param id - ID của phiếu nhập kho
   * @param file - File hình ảnh
   * @returns Thông tin file đã upload
   */
  @Post('receipt/:id/upload-image')
  @RequirePermissions('INVENTORY_MANAGE')
  uploadReceiptImage(
    @Param('id') id: string,
    @Body() body: { fileId: number; fieldName?: string },
  ) {
    return this.inventoryService.uploadReceiptImage(
      +id,
      body.fileId,
      body.fieldName,
    );
  }

  /**
   * Lấy danh sách hình ảnh của phiếu nhập kho
   * @param id - ID của phiếu nhập kho
   * @returns Danh sách hình ảnh
   */
  @Get('receipt/:id/images')
  getReceiptImages(@Param('id') id: string) {
    return this.inventoryService.getReceiptImages(+id);
  }

  /**
   * Xóa hình ảnh khỏi phiếu nhập kho
   * @param id - ID của phiếu nhập kho
   * @param fileId - ID của file cần xóa
   * @returns Kết quả xóa
   */
  @Delete('receipt/:id/image/:fileId')
  @RequirePermissions('INVENTORY_MANAGE')
  deleteReceiptImage(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.inventoryService.deleteReceiptImage(+id, +fileId);
  }

  // ===== RETURN ENDPOINTS =====

  /**
   * Tạo phiếu xuất trả hàng mới
   * @param createInventoryReturnDto - Dữ liệu tạo phiếu xuất trả hàng mới
   * @returns Thông tin phiếu xuất trả hàng đã tạo
   */
  @Post('return')
  @RequirePermissions('INVENTORY_MANAGE')
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
  findReturnById(@Param('id') id: string) {
    return this.inventoryService.findReturnById(+id);
  }

  /**
   * Duyệt phiếu xuất trả hàng
   * @param id - ID của phiếu xuất trả hàng cần duyệt
   * @returns Kết quả duyệt phiếu xuất trả hàng
   */
  @Post('return/:id/approve')
  @RequirePermissions('INVENTORY_MANAGE')
  approveReturn(@Param('id') id: string) {
    return this.inventoryService.approveReturn(+id);
  }

  /**
   * Hoàn thành phiếu xuất trả hàng
   * @param id - ID của phiếu xuất trả hàng cần hoàn thành
   * @returns Kết quả hoàn thành phiếu xuất trả hàng
   */
  @Post('return/:id/complete')
  @RequirePermissions('INVENTORY_MANAGE')
  completeReturn(@Param('id') id: string, @CurrentUser('id') userId: number) {
    return this.inventoryService.completeReturn(+id, userId);
  }

  /**
   * Hủy phiếu xuất trả hàng
   * @param id - ID của phiếu xuất trả hàng cần hủy
   * @param reason - Lý do hủy phiếu xuất trả hàng
   * @returns Kết quả hủy phiếu xuất trả hàng
   */
  @Post('return/:id/cancel')
  @RequirePermissions('INVENTORY_MANAGE')
  cancelReturn(@Param('id') id: string, @Body('reason') reason: string) {
    return this.inventoryService.cancelReturn(+id, reason);
  }

  /**
   * Xóa phiếu xuất trả hàng theo ID
   * @param id - ID của phiếu xuất trả hàng cần xóa
   * @returns Kết quả xóa phiếu xuất trả hàng
   */
  @Delete('return/:id')
  @RequirePermissions('INVENTORY_MANAGE')
  removeReturn(@Param('id') id: string) {
    return this.inventoryService.removeReturn(+id);
  }

  // ===== ADJUSTMENT ENDPOINTS =====

  /**
   * Tạo phiếu điều chỉnh kho mới
   * @param createInventoryAdjustmentDto - Dữ liệu tạo phiếu điều chỉnh kho mới
   * @returns Thông tin phiếu điều chỉnh kho đã tạo
   */
  @Post('adjustment')
  @RequirePermissions('INVENTORY_MANAGE')
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
  @Get('adjustment/:id')
  findAdjustmentById(@Param('id') id: string) {
    return this.inventoryService.findAdjustmentById(+id);
  }

  /**
   * Duyệt phiếu điều chỉnh kho
   * @param id - ID của phiếu điều chỉnh kho cần duyệt
   * @returns Kết quả duyệt phiếu điều chỉnh kho
   */
  @Post('adjustment/:id/approve')
  @RequirePermissions('INVENTORY_MANAGE')
  approveAdjustment(@Param('id') id: string) {
    return this.inventoryService.approveAdjustment(+id);
  }

  /**
   * Hoàn thành phiếu điều chỉnh kho
   * @param id - ID của phiếu điều chỉnh kho cần hoàn thành
   * @returns Kết quả hoàn thành phiếu điều chỉnh kho
   */
  @Post('adjustment/:id/complete')
  @RequirePermissions('INVENTORY_MANAGE')
  completeAdjustment(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.inventoryService.completeAdjustment(+id, userId);
  }

  /**
   * Hủy phiếu điều chỉnh kho
   * @param id - ID của phiếu điều chỉnh kho cần hủy
   * @param reason - Lý do hủy phiếu điều chỉnh kho
   * @returns Kết quả hủy phiếu điều chỉnh kho
   */
  @Post('adjustment/:id/cancel')
  @RequirePermissions('INVENTORY_MANAGE')
  cancelAdjustment(@Param('id') id: string, @Body('reason') reason: string) {
    return this.inventoryService.cancelAdjustment(+id, reason);
  }

  /**
   * Xóa phiếu điều chỉnh kho theo ID
   * @param id - ID của phiếu điều chỉnh kho cần xóa
   * @returns Kết quả xóa phiếu điều chỉnh kho
   */
  @Delete('adjustment/:id')
  @RequirePermissions('INVENTORY_MANAGE')
  removeAdjustment(@Param('id') id: string) {
    return this.inventoryService.removeAdjustment(+id);
  }
}
