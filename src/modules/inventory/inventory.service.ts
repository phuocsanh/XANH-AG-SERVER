import { Injectable, Inject, forwardRef, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';

import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReturn } from '../../entities/inventory-returns.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { InventoryAdjustment } from '../../entities/inventory-adjustments.entity';
import { InventoryAdjustmentItem } from '../../entities/inventory-adjustment-items.entity';
import { CreateInventoryBatchDto } from './dto/create-inventory-batch.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import {
  CreateInventoryReceiptDto,
  CreateInventoryReceiptItemDto,
} from './dto/create-inventory-receipt.dto';
import { CreateInventoryReturnDto } from './dto/create-inventory-return.dto';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { ProductService } from '../product/product.service';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import {
  ProductGroup,
  StockData,
  LowStockProduct,
} from './interfaces/inventory-report.interface';
import { SearchInventoryDto } from './dto/search-inventory.dto';
import { AdjustmentStatus } from './enums/adjustment-status.enum';
import { ReturnStatus } from './enums/return-status.enum';
import { ReceiptStatus } from './enums/receipt-status.enum';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

/**
 * Service xử lý logic nghiệp vụ liên quan đến quản lý kho hàng
 * Bao gồm quản lý lô hàng, giao dịch kho, phiếu nhập kho và các chức năng liên quan
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  
  /**
   * Constructor injection các repository và service cần thiết
   * @param inventoryBatchRepository - Repository để thao tác với entity InventoryBatch
   * @param inventoryTransactionRepository - Repository để thao tác với entity InventoryTransaction
   * @param inventoryReceiptRepository - Repository để thao tác với entity InventoryReceipt
   * @param inventoryReceiptItemRepository - Repository để thao tác với entity InventoryReceiptItem
   * @param productService - Service để thao tác với sản phẩm
   */
  constructor(
    @InjectRepository(InventoryBatch)
    private inventoryBatchRepository: Repository<InventoryBatch>,
    @InjectRepository(InventoryTransaction)
    private inventoryTransactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(InventoryReceipt)
    private inventoryReceiptRepository: Repository<InventoryReceipt>,
    @InjectRepository(InventoryReceiptItem)
    private inventoryReceiptItemRepository: Repository<InventoryReceiptItem>,
    @InjectRepository(InventoryReturn)
    private inventoryReturnRepository: Repository<InventoryReturn>,
    @InjectRepository(InventoryReturnItem)
    private inventoryReturnItemRepository: Repository<InventoryReturnItem>,
    @InjectRepository(InventoryAdjustment)
    private inventoryAdjustmentRepository: Repository<InventoryAdjustment>,
    @InjectRepository(InventoryAdjustmentItem)
    private inventoryAdjustmentItemRepository: Repository<InventoryAdjustmentItem>,
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService,
    private fileTrackingService: FileTrackingService,
  ) {}

  /**
   * Tạo lô hàng tồn kho mới
   * @param createInventoryBatchDto - Dữ liệu tạo lô hàng tồn kho mới
   * @returns Thông tin lô hàng tồn kho đã tạo
   */
  async createBatch(createInventoryBatchDto: CreateInventoryBatchDto) {
    try {
      const batch = this.inventoryBatchRepository.create(
        createInventoryBatchDto,
      );
      return this.inventoryBatchRepository.save(batch);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'lô hàng tồn kho');
    }
  }

  /**
   * Lấy danh sách tất cả lô hàng tồn kho
   * @returns Danh sách lô hàng tồn kho
   */
  async findAllBatches() {
    return this.inventoryBatchRepository.find();
  }

  /**
   * Tìm lô hàng tồn kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Danh sách lô hàng tồn kho của sản phẩm đó
   */
  async findBatchesByProduct(productId: number) {
    return this.inventoryBatchRepository.find({
      where: { product_id: productId },
      relations: ['product', 'supplier'],
    });
  }

  /**
   * Tìm lô hàng tồn kho theo ID
   * @param id - ID của lô hàng tồn kho cần tìm
   * @returns Thông tin lô hàng tồn kho
   */
  async findBatchById(id: number): Promise<InventoryBatch | null> {
    return this.inventoryBatchRepository.findOne({
      where: { id },
      relations: ['product', 'supplier'],
    });
  }

  /**
   * Cập nhật thông tin lô hàng tồn kho
   * @param id - ID của lô hàng tồn kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật lô hàng tồn kho
   * @returns Thông tin lô hàng tồn kho đã cập nhật
   */
  async updateBatch(
    id: number,
    updateData: Partial<CreateInventoryBatchDto>,
  ): Promise<InventoryBatch | null> {
    try {
      await this.inventoryBatchRepository.update(id, updateData);
      return this.findBatchById(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'lô hàng tồn kho');
    }
  }

  /**
   * Xóa lô hàng tồn kho theo ID
   * @param id - ID của lô hàng tồn kho cần xóa
   */
  async removeBatch(id: number) {
    await this.inventoryBatchRepository.delete(id);
  }

  /**
   * Tìm kiếm nâng cao lô hàng tồn kho
   */
  async searchBatches(searchDto: SearchInventoryDto): Promise<{
    data: InventoryBatch[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.inventoryBatchRepository.createQueryBuilder('batch');

    queryBuilder.leftJoinAndSelect('batch.product', 'product');
    queryBuilder.leftJoinAndSelect('batch.supplier', 'supplier');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'batch',
      ['code', 'product.name', 'product.code', 'notes'] // Global search
    );

    // Fix: Handle sorting for numeric string fields
    const sortField = searchDto.sort
      ? searchDto.sort.split(':')[0]
      : searchDto.sort_by;
    if (sortField && ['unit_cost_price'].includes(sortField)) {
      const sortOrder = searchDto.sort
        ? ((searchDto.sort.split(':')[1] || 'DESC').toUpperCase() as
            | 'ASC'
            | 'DESC')
        : searchDto.sort_order || 'DESC';

      queryBuilder.addSelect(
        `CAST(batch.${sortField} AS DECIMAL)`,
        'sort_numeric_value',
      );
      queryBuilder.orderBy('sort_numeric_value', sortOrder);
    }

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'batch',
      ['filters', 'nested_filters', 'operator'],
      {
        product_name: 'product.name',
        product_code: 'product.code',
        supplier_name: 'supplier.name',
      }
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Tạo giao dịch kho mới
   * @param createInventoryTransactionDto - Dữ liệu tạo giao dịch kho mới
   * @returns Thông tin giao dịch kho đã tạo
   */
  async createTransaction(
    createInventoryTransactionDto: CreateInventoryTransactionDto,
  ) {
    // Map DTO fields to entity fields
    const transactionData: any = {
      product_id: createInventoryTransactionDto.product_id,
      type: createInventoryTransactionDto.transaction_type,
      quantity: createInventoryTransactionDto.quantity,
      unit_cost_price: createInventoryTransactionDto.unit_cost_price,
      total_value: createInventoryTransactionDto.total_cost_value,
      remaining_quantity: createInventoryTransactionDto.remaining_quantity,
      new_average_cost: createInventoryTransactionDto.new_average_cost,
      created_by: createInventoryTransactionDto.created_by_user_id,
      ...(createInventoryTransactionDto.receipt_item_id && {
        receipt_item_id: createInventoryTransactionDto.receipt_item_id,
      }),
      ...(createInventoryTransactionDto.reference_type && {
        reference_type: createInventoryTransactionDto.reference_type,
      }),
      ...(createInventoryTransactionDto.reference_id && {
        reference_id: createInventoryTransactionDto.reference_id,
      }),
      ...(createInventoryTransactionDto.notes && {
        notes: createInventoryTransactionDto.notes,
      }),
    };

    const transaction =
      this.inventoryTransactionRepository.create(transactionData);
    return this.inventoryTransactionRepository.save(transaction);
  }



  /**
   * Tìm giao dịch kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Danh sách giao dịch kho của sản phẩm đó
   */
  async findTransactionsByProduct(productId: number) {
    return this.inventoryTransactionRepository.find({
      where: { product_id: productId },
    });
  }

  /**
   * Tìm kiếm nâng cao giao dịch kho
   */
  async searchTransactions(searchDto: SearchInventoryDto): Promise<{
    data: InventoryTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.inventoryTransactionRepository.createQueryBuilder('transaction');

    queryBuilder.leftJoinAndSelect('transaction.product', 'product');
    queryBuilder.leftJoinAndSelect('transaction.creator', 'creator');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'transaction',
      ['product.name', 'product.code', 'notes'] // Global search
    );

    // Fix: Handle sorting for numeric string fields
    const sortField = searchDto.sort
      ? searchDto.sort.split(':')[0]
      : searchDto.sort_by;
    if (sortField && ['unit_cost_price', 'total_value'].includes(sortField)) {
      const sortOrder = searchDto.sort
        ? ((searchDto.sort.split(':')[1] || 'DESC').toUpperCase() as
            | 'ASC'
            | 'DESC')
        : searchDto.sort_order || 'DESC';

      queryBuilder.addSelect(
        `CAST(transaction.${sortField} AS DECIMAL)`,
        'sort_numeric_value',
      );
      queryBuilder.orderBy('sort_numeric_value', sortOrder);
    }

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'transaction',
      ['filters', 'nested_filters', 'operator'],
      {
        product_name: 'product.name',
        product_code: 'product.code',
      }
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy tổng hợp tồn kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Tổng hợp tồn kho của sản phẩm
   */
  async getInventorySummary(productId: number) {
    // Lấy tất cả lô hàng của sản phẩm
    const batches = await this.inventoryBatchRepository.find({
      where: { product_id: productId },
    });

    // Tính tổng số lượng tồn kho
    const totalQuantity = batches.reduce(
      (sum, batch) => sum + batch.remaining_quantity,
      0,
    );

    return {
      productId,
      totalQuantity,
      batches: batches.length,
    };
  }

  /**
   * Lấy giá trị FIFO của sản phẩm theo ID
   * @param productId - ID của sản phẩm
   * @returns Giá trị FIFO của sản phẩm
   */
  async getFifoValue(productId: number) {
    // Lấy tất cả lô hàng của sản phẩm, sắp xếp theo thời gian tạo tăng dần (FIFO)
    const batches = await this.inventoryBatchRepository.find({
      where: {
        product_id: productId,
        remaining_quantity: MoreThan(0),
      },
      order: { created_at: 'ASC' },
    });

    let totalValue = 0;
    let totalQuantity = 0;

    // Tính tổng giá trị và số lượng
    for (const batch of batches) {
      totalValue +=
        batch.remaining_quantity * parseFloat(batch.unit_cost_price);
      totalQuantity += batch.remaining_quantity;
    }

    return {
      productId,
      totalValue,
      totalQuantity,
      averageValue: totalQuantity > 0 ? totalValue / totalQuantity : 0, // Giá trị trung bình
      batches: batches.map((batch) => ({
        id: batch.id,
        code: batch.code,
        remainingQuantity: batch.remaining_quantity,
        unitCostPrice: parseFloat(batch.unit_cost_price),
        value: batch.remaining_quantity * parseFloat(batch.unit_cost_price),
        expiryDate: batch.expiry_date,
        manufacturingDate: batch.manufacturing_date,
        createdAt: batch.created_at,
      })),
    };
  }

  /**
   * Tính giá vốn FIFO cho một số lượng cụ thể
   * @param productId - ID của sản phẩm
   * @param quantity - Số lượng cần tính giá vốn FIFO
   * @returns Thông tin giá vốn FIFO
   */
  async calculateFifoCost(productId: number, quantity: number) {
    // Lấy các lô hàng theo thứ tự FIFO
    const batches = await this.inventoryBatchRepository.find({
      where: {
        product_id: productId,
        remaining_quantity: MoreThan(0),
      },
      order: { created_at: 'ASC' },
    });

    let remainingQuantity = quantity;
    let totalCost = 0;
    const usedBatches: any[] = [];

    for (const batch of batches) {
      if (remainingQuantity <= 0) break;

      const quantityFromBatch = Math.min(
        remainingQuantity,
        batch.remaining_quantity,
      );
      const costFromBatch =
        quantityFromBatch * parseFloat(batch.unit_cost_price);

      totalCost += costFromBatch;
      remainingQuantity -= quantityFromBatch;

      usedBatches.push({
        batchId: batch.id,
        code: batch.code,
        quantityUsed: quantityFromBatch,
        unitCostPrice: parseFloat(batch.unit_cost_price),
        totalCost: costFromBatch,
        expiryDate: batch.expiry_date,
        manufacturingDate: batch.manufacturing_date,
      });
    }

    const averageFifoCost =
      quantity > 0 ? totalCost / (quantity - remainingQuantity) : 0;

    return {
      productId,
      requestedQuantity: quantity,
      availableQuantity: quantity - remainingQuantity,
      shortfall: remainingQuantity,
      totalFifoCost: totalCost,
      averageFifoCost,
      usedBatches,
    };
  }

  /**
   * Lấy thông tin chi tiết về batch tracking
   * @param productId - ID của sản phẩm (tùy chọn)
   * @returns Thông tin chi tiết về các lô hàng
   */
  async getBatchTrackingInfo(productId?: number) {
    let whereCondition: any = {
      remaining_quantity: MoreThan(0),
    };

    if (productId) {
      whereCondition.product_id = productId;
    }

    const batches = await this.inventoryBatchRepository.find({
      where: whereCondition,
      order: { created_at: 'ASC' },
      relations: ['product'], // Giả sử có relation với Product
    });

    return batches.map((batch) => {
      const daysUntilExpiry = batch.expiry_date
        ? Math.ceil(
            (batch.expiry_date.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      const ageInDays = Math.ceil(
        (new Date().getTime() - batch.created_at.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      return {
        id: batch.id,
        productId: batch.product_id,
        code: batch.code,
        unitCostPrice: parseFloat(batch.unit_cost_price),
        originalQuantity: batch.original_quantity,
        remainingQuantity: batch.remaining_quantity,
        usedQuantity: batch.original_quantity - batch.remaining_quantity,
        usagePercentage: (
          ((batch.original_quantity - batch.remaining_quantity) /
            batch.original_quantity) *
          100
        ).toFixed(2),
        totalValue:
          batch.remaining_quantity * parseFloat(batch.unit_cost_price),
        expiryDate: batch.expiry_date,
        manufacturingDate: batch.manufacturing_date,
        daysUntilExpiry,
        ageInDays,
        supplierId: batch.supplier_id,
        notes: batch.notes,
        createdAt: batch.created_at,
        updatedAt: batch.updated_at,
        status:
          daysUntilExpiry !== null
            ? daysUntilExpiry < 0
              ? 'EXPIRED'
              : daysUntilExpiry <= 7
                ? 'EXPIRING_SOON'
                : daysUntilExpiry <= 30
                  ? 'EXPIRING_WITHIN_MONTH'
                  : 'GOOD'
            : 'NO_EXPIRY',
      };
    });
  }

  /**
   * Tính giá vốn trung bình gia quyền (Weighted Average Cost) cho sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Giá vốn trung bình gia quyền hiện tại
   */
  async getWeightedAverageCost(productId: number): Promise<number> {
    // Lấy tất cả lô hàng còn tồn kho của sản phẩm
    const batches = await this.inventoryBatchRepository.find({
      where: {
        product_id: productId,
        remaining_quantity: MoreThan(0), // Chỉ lấy lô hàng còn tồn kho
      },
    });

    if (batches.length === 0) {
      return 0;
    }

    let totalValue = 0;
    let totalQuantity = 0;

    // Tính tổng giá trị và số lượng có trọng số
    for (const batch of batches) {
      const batchValue =
        batch.remaining_quantity * parseFloat(batch.unit_cost_price);
      totalValue += batchValue;
      totalQuantity += batch.remaining_quantity;
    }

    // Trả về giá vốn trung bình gia quyền
    return totalQuantity > 0 ? totalValue / totalQuantity : 0;
  }

  /**
   * Xử lý nhập kho với tính toán giá vốn trung bình gia quyền
   * @param productId - ID của sản phẩm
   * @param quantity - Số lượng nhập kho
   * @param unitCostPrice - Giá vốn đơn vị
   * @param receiptItemId - ID của item trong phiếu nhập (tùy chọn)
   * @param code - Mã lô hàng (tùy chọn)
   * @param expiryDate - Ngày hết hạn (tùy chọn)
   * @param userId - ID của user đang thực hiện (từ JWT token)
   * @returns Thông tin giao dịch nhập kho và giá vốn trung bình mới
   */
  async processStockIn(
    productId: number,
    quantity: number,
    unitCostPrice: number,
    userId: number,
    receiptItemId?: number,
    code?: string,
    expiryDate?: Date,
  ) {
    // Lấy giá vốn trung bình hiện tại
    const currentAverageCost = await this.getWeightedAverageCost(productId);

    // Lấy tổng số lượng tồn kho hiện tại
    const currentInventory = await this.getInventorySummary(productId);
    const currentQuantity = currentInventory.totalQuantity;

    // Tính giá vốn trung bình mới theo công thức WAC
    const currentTotalValue = currentQuantity * currentAverageCost;
    const newTotalValue = currentTotalValue + quantity * unitCostPrice;
    const newTotalQuantity = currentQuantity + quantity;
    const newAverageCost =
      newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : unitCostPrice;

  

    // Tạo lô hàng mới
    const batchData: CreateInventoryBatchDto = {
      product_id: productId,
      code: code || `BATCH_${Date.now()}`,
      unit_cost_price: unitCostPrice.toString(),
      original_quantity: quantity,
      remaining_quantity: quantity,
      ...(receiptItemId && { receipt_item_id: receiptItemId }),
      ...(expiryDate && { expiry_date: expiryDate }),
    };

    const newBatch = await this.createBatch(batchData);

    // Cập nhật giá nhập mới nhất cho sản phẩm
    await this.productService.update(productId, {
      latest_purchase_price: unitCostPrice,
    });

    // Tạo giao dịch nhập kho
    const transactionData: CreateInventoryTransactionDto = {
      product_id: productId,
      transaction_type: 'IN',
      quantity,
      unit_cost_price: unitCostPrice.toString(),
      total_cost_value: (quantity * unitCostPrice).toString(),
      remaining_quantity: newTotalQuantity,
      new_average_cost: newAverageCost.toString(),
      reference_type: 'STOCK_IN',
      reference_id: newBatch.id,
      notes: `Nhập kho ${quantity} sản phẩm với giá ${unitCostPrice}`,
      created_by_user_id: userId,
      ...(receiptItemId && { receipt_item_id: receiptItemId }),
    };

    const transaction = await this.createTransaction(transactionData);

    // Cập nhật giá sản phẩm dựa trên giá vốn trung bình mới và phần trăm lợi nhuận
    // Tương tự như UpdateProductAverageCostAndPrice trong Go server
    try {
      await this.productService.updateProductAverageCostAndPrice(
        productId,
        newAverageCost,
      );

      // Cập nhật giá nhập mới nhất và tồn kho cho sản phẩm
      await this.productService.update(productId, {
        latest_purchase_price: unitCostPrice,
        quantity: newTotalQuantity, // Cập nhật tồn kho hiển thị
      });

      this.logger.log('✅ Đã cập nhật tồn kho sản phẩm:', {
        productId,
        newQuantity: newTotalQuantity,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Không thể cập nhật giá sản phẩm ${productId}:`,
        errorMessage,
      );
      // Không throw error để không làm gián đoạn quá trình nhập kho
    }

    return {
      transaction,
      batch: newBatch,
      previousAverageCost: currentAverageCost,
      newAverageCost,
      totalQuantity: newTotalQuantity,
    };
  }

  /**
   * Xử lý xuất kho theo phương pháp FIFO với cập nhật giá vốn trung bình
   * @param productId - ID của sản phẩm
   * @param quantity - Số lượng xuất kho
   * @param referenceType - Loại tham chiếu (SALE, TRANSFER, ADJUSTMENT, etc.)
   * @param userId - ID của user thực hiện (từ JWT token)
   * @param referenceId - ID tham chiếu
   * @param notes - Ghi chú
   * @returns Thông tin giao dịch xuất kho
   */
  async processStockOut(
    productId: number,
    quantity: number,
    referenceType: string,
    userId: number,
    referenceId?: number,
    notes?: string,
  ) {
    // Kiểm tra tồn kho hiện tại
    const currentInventory = await this.getInventorySummary(productId);
    if (currentInventory.totalQuantity < quantity) {
      throw new Error(
        `Không đủ tồn kho. Hiện có: ${currentInventory.totalQuantity}, yêu cầu: ${quantity}`,
      );
    }

    // Lấy giá vốn trung bình hiện tại
    const currentAverageCost = await this.getWeightedAverageCost(productId);

    // Lấy các lô hàng theo thứ tự FIFO (First In, First Out)
    const batches = await this.inventoryBatchRepository.find({
      where: {
        product_id: productId,
        remaining_quantity: MoreThan(0),
      },
      order: { created_at: 'ASC' }, // FIFO: lô cũ nhất trước
    });

    let remainingToDeduct = quantity;
    let totalCostValue = 0;
    const affectedBatches: any[] = [];

    // Trừ số lượng từ các lô theo FIFO
    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const deductFromBatch = Math.min(
        batch.remaining_quantity,
        remainingToDeduct,
      );
      batch.remaining_quantity -= deductFromBatch;
      remainingToDeduct -= deductFromBatch;

      // Tính giá trị xuất kho dựa trên giá vốn của lô
      const batchCost = parseFloat(batch.unit_cost_price);
      totalCostValue += deductFromBatch * batchCost;

      // Cập nhật batch
      await this.inventoryBatchRepository.save(batch);
      
      affectedBatches.push({
        batchId: batch.id,
        deductedQuantity: deductFromBatch,
        remainingQuantity: batch.remaining_quantity,
        cost: batchCost
      });
    }

    // Tính số lượng tồn kho mới
    const newTotalQuantity = currentInventory.totalQuantity - quantity;

    // Tạo giao dịch xuất kho
    const transactionData: CreateInventoryTransactionDto = {
      product_id: productId,
      transaction_type: 'OUT',
      quantity: -quantity, // Số âm để thể hiện xuất kho
      unit_cost_price: currentAverageCost.toString(), // Sử dụng giá vốn trung bình
      total_cost_value: (-totalCostValue).toString(), // Giá trị âm
      remaining_quantity: newTotalQuantity,
      new_average_cost: currentAverageCost.toString(), // Giá vốn trung bình không thay đổi khi xuất kho
      reference_type: referenceType,
      notes: notes || `Xuất kho ${quantity} sản phẩm theo FIFO`,
      created_by_user_id: userId, // Lấy từ JWT token
      ...(referenceId && { reference_id: referenceId }),
    };

    const transaction = await this.createTransaction(transactionData);

    // Cập nhật tồn kho hiển thị cho sản phẩm
    try {
      await this.productService.update(productId, {
        quantity: newTotalQuantity,
      });

      this.logger.log('✅ Đã cập nhật tồn kho sản phẩm sau xuất kho:', {
        productId,
        newQuantity: newTotalQuantity,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Không thể cập nhật tồn kho sản phẩm ${productId}:`,
        errorMessage,
      );
    }

    return {
      transaction,
      affectedBatches,
      totalCostValue,
      averageCostUsed: currentAverageCost,
      remainingQuantity: newTotalQuantity,
    };
  }

  /**
   * Tính lại giá vốn trung bình gia quyền cho sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Giá vốn trung bình gia quyền đã được tính lại
   */
  async recalculateWeightedAverageCost(productId: number): Promise<{
    productId: number;
    previousAverageCost: number;
    newAverageCost: number;
    totalQuantity: number;
    totalValue: number;
  }> {
    const previousAverageCost = await this.getWeightedAverageCost(productId);

    // Lấy tất cả lô hàng còn tồn kho
    const batches = await this.inventoryBatchRepository.find({
      where: {
        product_id: productId,
        remaining_quantity: MoreThan(0),
      },
    });

    let totalValue = 0;
    let totalQuantity = 0;

    // Tính lại tổng giá trị và số lượng
    for (const batch of batches) {
      const batchValue =
        batch.remaining_quantity * parseFloat(batch.unit_cost_price);
      totalValue += batchValue;
      totalQuantity += batch.remaining_quantity;
    }

    const newAverageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    return {
      productId,
      previousAverageCost,
      newAverageCost,
      totalQuantity,
      totalValue,
    };
  }

  /**
   * Lấy báo cáo giá trị tồn kho theo phương pháp weighted average cost
   * @param productIds - Danh sách ID sản phẩm (tùy chọn, nếu không có sẽ lấy tất cả)
   * @returns Báo cáo giá trị tồn kho
   */
  async getInventoryValueReport(productIds?: number[]) {
    let whereCondition: any = {
      remaining_quantity: MoreThan(0),
    };

    if (productIds && productIds.length > 0) {
      whereCondition.product_id = In(productIds);
    }

    // Lấy tất cả lô hàng còn tồn kho
    const batches = await this.inventoryBatchRepository.find({
      where: whereCondition,
      relations: ['product'], // Giả sử có relation với Product
    });

    // Nhóm theo sản phẩm

    const productGroups: Record<number, ProductGroup> = batches.reduce(
      (groups, batch) => {
        const productId = batch.product_id;
        if (!groups[productId]) {
          groups[productId] = {
            productId,
            batches: [],
            totalQuantity: 0,
            totalValue: 0,
            weightedAverageCost: 0,
          };
        }

        const batchValue =
          batch.remaining_quantity * parseFloat(batch.unit_cost_price);
        const batchData: any = {
          batchId: batch.id,
          code: batch.code || '',
          quantity: batch.remaining_quantity,
          unitCost: parseFloat(batch.unit_cost_price),
          totalValue: batchValue,
        };
        if (batch.expiry_date) {
          batchData.expiryDate = batch.expiry_date;
        }
        groups[productId].batches.push(batchData);

        groups[productId].totalQuantity += batch.remaining_quantity;
        groups[productId].totalValue += batchValue;

        return groups;
      },
      {} as Record<number, ProductGroup>,
    );

    // Tính weighted average cost cho từng sản phẩm
    const report = Object.values(productGroups).map((group) => {
      group.weightedAverageCost =
        group.totalQuantity > 0 ? group.totalValue / group.totalQuantity : 0;
      return group;
    });

    // Tính tổng cộng
    const totalSummary = {
      totalProducts: report.length,
      totalQuantity: report.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalValue: report.reduce((sum, item) => sum + item.totalValue, 0),
      overallAverageCost: 0,
    };

    totalSummary.overallAverageCost =
      totalSummary.totalQuantity > 0
        ? totalSummary.totalValue / totalSummary.totalQuantity
        : 0;

    return {
      summary: totalSummary,
      products: report,
      generatedAt: new Date(),
    };
  }

  /**
   * Lấy cảnh báo tồn kho thấp
   * @param minimumQuantity - Số lượng tối thiểu để cảnh báo (mặc định: 10)
   * @returns Danh sách sản phẩm có tồn kho thấp
   */
  async getLowStockAlert(minimumQuantity: number = 10) {
    // Lấy tất cả lô hàng còn tồn kho
    const batches = await this.inventoryBatchRepository.find({
      where: {
        remaining_quantity: MoreThan(0),
      },
      relations: ['product'], // Giả sử có relation với Product
    });

    // Định nghĩa interface cho stock data đã được import

    // Nhóm theo sản phẩm và tính tổng tồn kho
    const productStocks: Record<number, StockData> = batches.reduce(
      (stocks, batch) => {
        const productId = batch.product_id;
        if (!stocks[productId]) {
          stocks[productId] = {
            productId,
            totalQuantity: 0,
            weightedAverageCost: 0,
            batches: [],
          };
        }

        stocks[productId].totalQuantity += batch.remaining_quantity;
        const stockBatchData: any = {
          batchId: batch.id,
          code: batch.code || '',
          quantity: batch.remaining_quantity,
          unitCost: parseFloat(batch.unit_cost_price),
        };
        if (batch.expiry_date) {
          stockBatchData.expiryDate = batch.expiry_date;
        }
        stocks[productId].batches.push(stockBatchData);

        return stocks;
      },
      {} as Record<number, StockData>,
    );

    // Tính weighted average cost và lọc sản phẩm có tồn kho thấp
    const lowStockProducts: LowStockProduct[] = [];

    for (const productId in productStocks) {
      const stock = productStocks[productId];
      if (!stock) continue; // Kiểm tra null safety

      // Tính weighted average cost
      let totalValue = 0;
      for (const batch of stock.batches) {
        totalValue += batch.quantity * batch.unitCost;
      }
      stock.weightedAverageCost =
        stock.totalQuantity > 0 ? totalValue / stock.totalQuantity : 0;

      // Kiểm tra tồn kho thấp
      if (stock.totalQuantity <= minimumQuantity) {
        lowStockProducts.push({
          ...stock,
          alertLevel: stock.totalQuantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
          recommendedReorder: minimumQuantity * 2, // Gợi ý đặt hàng gấp đôi mức tối thiểu
        });
      }
    }

    return {
      alertCount: lowStockProducts.length,
      minimumQuantity,
      products: lowStockProducts.sort(
        (a, b) => a.totalQuantity - b.totalQuantity,
      ), // Sắp xếp theo mức độ nghiêm trọng
      generatedAt: new Date(),
    };
  }

  /**
   * Lấy cảnh báo lô hàng sắp hết hạn
   * @param daysBeforeExpiry - Số ngày trước khi hết hạn để cảnh báo (mặc định: 30)
   * @returns Danh sách lô hàng sắp hết hạn
   */
  async getExpiringBatchesAlert(daysBeforeExpiry: number = 30) {
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + daysBeforeExpiry);

    // Lấy các lô hàng có ngày hết hạn trong khoảng cảnh báo
    const expiringBatches = await this.inventoryBatchRepository
      .createQueryBuilder('batch')
      .where('batch.remaining_quantity > 0')
      .andWhere('batch.expiry_date IS NOT NULL')
      .andWhere('batch.expiry_date <= :alertDate', { alertDate })
      .orderBy('batch.expiry_date', 'ASC')
      .getMany();

    const processedBatches = expiringBatches.map((batch) => {
      const daysUntilExpiry = Math.ceil(
        (new Date(batch.expiry_date!).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      );

      let alertLevel = 'WARNING';
      if (daysUntilExpiry <= 0) {
        alertLevel = 'EXPIRED';
      } else if (daysUntilExpiry <= 7) {
        alertLevel = 'CRITICAL';
      } else if (daysUntilExpiry <= 15) {
        alertLevel = 'HIGH';
      }

      return {
        batchId: batch.id,
        productId: batch.product_id,
        code: batch.code,
        remainingQuantity: batch.remaining_quantity,
        unitCostPrice: parseFloat(batch.unit_cost_price),
        totalValue:
          batch.remaining_quantity * parseFloat(batch.unit_cost_price),
        expiryDate: batch.expiry_date,
        daysUntilExpiry,
        alertLevel,
      };
    });

    // Tính tổng giá trị có thể bị mất
    const totalValueAtRisk = processedBatches.reduce(
      (sum, batch) => sum + batch.totalValue,
      0,
    );
    const expiredBatches = processedBatches.filter(
      (batch) => batch.alertLevel === 'EXPIRED',
    );
    const criticalBatches = processedBatches.filter(
      (batch) => batch.alertLevel === 'CRITICAL',
    );

    return {
      alertCount: processedBatches.length,
      expiredCount: expiredBatches.length,
      criticalCount: criticalBatches.length,
      totalValueAtRisk,
      daysBeforeExpiry,
      batches: processedBatches,
      generatedAt: new Date(),
    };
  }

  // Inventory Receipt methods
  /**
   * Tạo phiếu nhập kho mới
   * @param createInventoryReceiptDto - Dữ liệu tạo phiếu nhập kho mới
   * @returns Thông tin phiếu nhập kho đã tạo
   */
  async createReceipt(createInventoryReceiptDto: CreateInventoryReceiptDto, userId: number) {
    this.logger.log(`Bắt đầu tạo phiếu nhập kho: ${createInventoryReceiptDto.receipt_code || 'auto-generate'}`);
    
    const queryRunner = this.inventoryReceiptRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tự sinh mã nếu không được cung cấp
      let receiptCode = createInventoryReceiptDto.receipt_code;
      if (!receiptCode) {
        receiptCode = CodeGeneratorHelper.generateUniqueCode('REC');
        this.logger.log(`Tự sinh mã phiếu nhập kho: ${receiptCode}`);
      }

      // Tạo phiếu nhập kho
      const receiptData: any = {
        code: receiptCode,
        supplier_id: createInventoryReceiptDto.supplier_id,
        total_amount: createInventoryReceiptDto.total_amount,
        status: createInventoryReceiptDto.status,
        created_by: userId, // Lấy từ JWT token
        updated_by: userId, // Người tạo cũng là người cập nhật đầu tiên
      };

      // Only add notes if it's not undefined
      if (createInventoryReceiptDto.notes !== undefined) {
        receiptData.notes = createInventoryReceiptDto.notes;
      }

      // Thêm phí vận chuyển chung nếu có
      if (createInventoryReceiptDto.shared_shipping_cost !== undefined) {
        receiptData.shared_shipping_cost = createInventoryReceiptDto.shared_shipping_cost;
      }

      // Thêm phương thức phân bổ phí vận chuyển
      if (createInventoryReceiptDto.shipping_allocation_method !== undefined) {
        receiptData.shipping_allocation_method = createInventoryReceiptDto.shipping_allocation_method;
      }

      const receipt = queryRunner.manager.create(InventoryReceipt, receiptData);
      const savedReceipt = await queryRunner.manager.save(receipt);

      // Check if savedReceipt is an array and get the first element if so
      const receiptEntity = Array.isArray(savedReceipt)
        ? savedReceipt[0]
        : savedReceipt;

      // Ensure we have a valid receipt entity with an ID
      if (!receiptEntity || !receiptEntity.id) {
        throw new Error('Failed to save receipt');
      }

      this.logger.log(`Đã lưu phiếu nhập kho với ID: ${receiptEntity.id}`);

      // ===== TÍNH TOÁN PHÍ VẬN CHUYỂN =====
      const sharedShippingCost = createInventoryReceiptDto.shared_shipping_cost || 0;
      const allocationMethod = createInventoryReceiptDto.shipping_allocation_method || 'by_value';
      
      // Tính tổng giá trị và số lượng để phân bổ phí chung
      let totalValue = 0;
      let totalQuantity = 0;
      
      for (const item of createInventoryReceiptDto.items) {
        totalValue += item.quantity * item.unit_cost;
        totalQuantity += item.quantity;
      }

      // Tính phí vận chuyển cho từng item
      const itemsWithShipping = createInventoryReceiptDto.items.map((item) => {
        let allocatedShipping = 0;
        
        // Phân bổ phí chung nếu có
        if (sharedShippingCost > 0) {
          if (allocationMethod === 'by_value') {
            // Chia theo tỷ lệ giá trị
            const itemValue = item.quantity * item.unit_cost;
            allocatedShipping = (itemValue / totalValue) * sharedShippingCost;
          } else {
            // Chia đều theo số lượng
            allocatedShipping = (item.quantity / totalQuantity) * sharedShippingCost;
          }
        }
        
        // Tính tổng phí vận chuyển cho item
        const individualShipping = item.individual_shipping_cost || 0;
        const totalShippingForItem = individualShipping + allocatedShipping;
        
        // Tính giá vốn cuối cùng trên đơn vị
        const shippingPerUnit = totalShippingForItem / item.quantity;
        const finalUnitCost = item.unit_cost + shippingPerUnit;
        
        // DEBUG: Log để kiểm tra
        this.logger.log('=== TÍNH PHÍ VẬN CHUYỂN ===');
        this.logger.log(`Product ID: ${item.product_id}`);
        this.logger.log(`Final Unit Cost: ${finalUnitCost}`);
        
        return {
          ...item,
          allocated_shipping_cost: Math.round(allocatedShipping * 100) / 100,
          final_unit_cost: Math.round(finalUnitCost * 100) / 100,
        };
      });

      // Tạo các item trong phiếu và xử lý nhập kho cho từng sản phẩm
      const savedItems: any[] = [];
      for (const item of itemsWithShipping) {
        const itemData: any = {
          receipt_id: receiptEntity.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_price: item.total_price,
          individual_shipping_cost: item.individual_shipping_cost || 0,
          allocated_shipping_cost: item.allocated_shipping_cost,
          final_unit_cost: item.final_unit_cost,
        };

        // Only add notes if it's not undefined
        if (item.notes !== undefined) {
          itemData.notes = item.notes;
        }

        const itemEntity = queryRunner.manager.create(InventoryReceiptItem, itemData);
        const savedItem = await queryRunner.manager.save(itemEntity);
        savedItems.push(savedItem);
      } // Kết thúc vòng lặp itemsWithShipping

      await queryRunner.commitTransaction();
      this.logger.log(`Đã commit transaction cho phiếu nhập kho ${receiptEntity.id}`);

      // Trả về phiếu nhập kho với thông tin nhà cung cấp
      const finalReceipt = await this.inventoryReceiptRepository.findOne({
        where: { id: receiptEntity.id },
        relations: ['supplier'], // Bao gồm thông tin nhà cung cấp
      });

      return finalReceipt;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(`Lỗi khi tạo phiếu nhập kho: ${errorMessage}`, errorStack);
      throw new Error(`Không thể tạo phiếu nhập kho: ${errorMessage}`);
    } finally {
      await queryRunner.release();
    }
  }



  /**
   * Tìm phiếu nhập kho theo ID
   * @param id - ID của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  async findReceiptById(id: number): Promise<InventoryReceipt | null> {
    return this.inventoryReceiptRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'supplier', 'creator'],
    });
  }

  /**
   * Tìm phiếu nhập kho theo mã
   * @param code - Mã của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  async findReceiptByCode(code: string): Promise<InventoryReceipt | null> {
    return this.inventoryReceiptRepository.findOne({
      where: { code },
      relations: ['items', 'items.product', 'supplier', 'creator'],
    });
  }

  /**
   * Tìm kiếm nâng cao phiếu nhập kho
   */
  async searchReceipts(searchDto: SearchInventoryDto): Promise<{
    data: InventoryReceipt[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.inventoryReceiptRepository.createQueryBuilder('receipt');

    queryBuilder.leftJoinAndSelect('receipt.supplier', 'supplier');
    queryBuilder.leftJoinAndSelect('receipt.creator', 'creator');
    queryBuilder.leftJoinAndSelect('receipt.items', 'items');
    queryBuilder.leftJoinAndSelect('items.product', 'product');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'receipt',
      ['code', 'supplier.name', 'notes'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'receipt',
      ['filters', 'nested_filters', 'operator'],
      {
        supplier_name: 'supplier.name',
        creator_account: 'creator.account',
      }
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Cập nhật thông tin phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật phiếu nhập kho
   * @returns Thông tin phiếu nhập kho đã cập nhật
   */
  async updateReceipt(
    id: number,
    updateData: Partial<CreateInventoryReceiptDto>,
  ): Promise<InventoryReceipt | null> {
    const receipt = await this.findReceiptById(id);
    if (!receipt) {
      throw new Error('Không tìm thấy phiếu nhập kho');
    }

    // Chỉ cho phép sửa phiếu ở trạng thái 'draft'
    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new Error('Chỉ có thể chỉnh sửa phiếu nhập kho ở trạng thái nháp (draft)');
    }

    // Map DTO fields to entity fields
    const entityUpdateData: any = {};
    if (updateData.receipt_code !== undefined)
      entityUpdateData.code = updateData.receipt_code;
    if (updateData.supplier_id !== undefined)
      entityUpdateData.supplier_id = updateData.supplier_id;
    if (updateData.total_amount !== undefined)
      entityUpdateData.total_amount = updateData.total_amount;
    if (updateData.status !== undefined)
      entityUpdateData.status = updateData.status;
    if (updateData.notes !== undefined)
      entityUpdateData.notes = updateData.notes;
    if (updateData.created_by !== undefined)
      entityUpdateData.created_by = updateData.created_by;

    await this.inventoryReceiptRepository.update(id, entityUpdateData);
    return this.findReceiptById(id);
  }

  /**
   * Xóa phiếu nhập kho theo ID
   * @param id - ID của phiếu nhập kho cần xóa
   */
  async removeReceipt(id: number) {
    const receipt = await this.findReceiptById(id);
    if (!receipt) {
      throw new Error('Không tìm thấy phiếu nhập kho');
    }

    // KHÔNG cho phép xóa phiếu 'cancelled' nếu đã từng 'approved' (để giữ audit trail)
    if (receipt.status !== ReceiptStatus.DRAFT) {
      if (receipt.status === ReceiptStatus.CANCELLED) {
        // Kiểm tra xem phiếu này có approved_at không (tức là đã từng approved và tác động kho)
        if (receipt.approved_at) {
           throw new Error('Không thể xóa phiếu đã từng duyệt (đã tác động kho) và bị hủy. Dữ liệu cần được giữ lại để đối soát.');
        }
        // Nếu là cancelled nhưng chưa approved bao giờ (cancel từ draft) thì cho xóa
      } else {
        throw new Error(
          'Không thể xóa phiếu nhập kho đang hoạt động. Vui lòng hủy phiếu thay thế.',
        );
      }
    }

    // Xóa các item trong phiếu trước (để tránh lỗi foreign key)
    await this.inventoryReceiptItemRepository.delete({ receipt_id: id });

    // Sau đó xóa phiếu
    await this.inventoryReceiptRepository.delete(id);
  }

  /**
   * Duyệt phiếu nhập kho (và tự động thực hiện nhập kho)
   * @param id - ID của phiếu nhập kho cần duyệt
   * @param userId - ID người thực hiện
   * @returns Thông tin phiếu nhập kho đã duyệt
   */
  async approveReceipt(id: number, userId: number): Promise<InventoryReceipt | null> {
    const receipt = await this.findReceiptById(id);
    if (!receipt) {
      return null;
    }
    
    if (receipt.status !== ReceiptStatus.DRAFT) {
       throw new Error('Chỉ có thể duyệt phiếu ở trạng thái nháp');
    }

    // Lấy danh sách chi tiết phiếu nhập
    const items = await this.getReceiptItems(id);

    // Xử lý nhập kho cho từng sản phẩm ngay khi duyệt
    for (const item of items) {
      try {
        const costPrice =
          item.final_unit_cost !== undefined && item.final_unit_cost !== null
            ? Number(item.final_unit_cost)
            : Number(item.unit_cost);

        await this.processStockIn(
          item.product_id,
          item.quantity,
          costPrice,
          userId,
          item.id,
          `Phun thuốc/Nhập kho - Phiếu ${receipt.code}`,
        );
      } catch (error) {
        this.logger.error(
          `Lỗi khi xử lý nhập kho cho sản phẩm ${item.product_id} trong phiếu ${id}:`,
          error,
        );
        throw new Error(
          `Không thể duyệt phiếu nhập kho do lỗi xử lý tồn kho sản phẩm ${item.product_id}`,
        );
      }
    }

    receipt.status = ReceiptStatus.APPROVED;
    receipt.approved_at = new Date();
    return this.inventoryReceiptRepository.save(receipt);
  }

  /**
   * Hủy phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hủy
   * @param reason - Lý do hủy phiếu nhập kho
   * @param userId - ID người thực hiện
   * @returns Thông tin phiếu nhập kho đã hủy
   */
  async cancelReceipt(
    id: number,
    reason: string,
    userId: number,
  ): Promise<InventoryReceipt | null> {
    const receipt = await this.findReceiptById(id);
    if (!receipt) {
      throw new Error('Không tìm thấy phiếu nhập kho');
    }
    
    // Validate: Không cho phép cancel phiếu đã cancelled
    if (receipt.status === ReceiptStatus.CANCELLED) {
        throw new Error('Phiếu nhập kho đã bị hủy trước đó');
    }
    
    // Nếu phiếu đã duyệt (APPROVED) → Cần rollback inventory
    if (receipt.status === ReceiptStatus.APPROVED) {
        await this.rollbackReceiptInventory(id, userId, reason);
    }
    
    receipt.status = ReceiptStatus.CANCELLED; // Cập nhật trạng thái thành đã hủy
    receipt.cancelled_at = new Date(); // Ghi nhận thời gian hủy
    receipt.cancelled_reason = reason; // Ghi nhận lý do hủy
    return this.inventoryReceiptRepository.save(receipt);
  }

  /**
   * Rollback inventory khi cancel phiếu nhập kho đã approved
   * @param receiptId - ID phiếu nhập
   * @param userId - ID người thực hiện
   * @param reason - Lý do hủy
   */
  private async rollbackReceiptInventory(
    receiptId: number, 
    userId: number,
    reason: string
  ) {
    this.logger.log(`Bắt đầu rollback inventory cho receipt #${receiptId}`);
    const items = await this.getReceiptItems(receiptId);
    
    for (const item of items) {
      try {
        // Tạo transaction xuất kho (ngược lại với nhập kho)
        // Dùng referenceType đặc biệt để tracking
        await this.processStockOut(
          item.product_id,
          item.quantity,
          'RECEIPT_CANCELLATION',
          userId,
          receiptId,
          `Hủy phiếu nhập #${receiptId} (Sản phẩm ${item.product_id}): ${reason}`
        );
        
        // Tính lại giá vốn trung bình vì lượng tồn và giá trị tồn đã thay đổi
        await this.recalculateWeightedAverageCost(item.product_id);
      } catch (error) {
         this.logger.error(
          `Lỗi khi rollback inventory cho sản phẩm ${item.product_id} trong receipt #${receiptId}:`,
          error
        );
        // Trong trường hợp rollback lỗi, ta vẫn ném lỗi ra để ngừng quá trình cancel
        // Để admin có thể xử lý thủ công hoặc thử lại
        throw new Error(
          `Không thể hủy phiếu nhập kho do lỗi khi hoàn tác tồn kho sản phẩm ${item.product_id}`
        );
      }
    }
    this.logger.log(`Hoàn tất rollback inventory cho receipt #${receiptId}`);
  }

  /**
   * Lấy danh sách chi tiết phiếu nhập kho
   * @param receiptId - ID của phiếu nhập kho
   * @returns Danh sách chi tiết phiếu nhập kho
   */
  async getReceiptItems(receiptId: number) {
    return this.inventoryReceiptItemRepository.find({
      where: { receipt_id: receiptId },
      relations: ['product'], // Bao gồm thông tin sản phẩm
    });
  }

  /**
   * Cập nhật thông tin chi tiết phiếu nhập kho
   * @param id - ID của chi tiết phiếu nhập kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật chi tiết phiếu nhập kho
   * @returns Thông tin chi tiết phiếu nhập kho đã cập nhật
   */
  async updateReceiptItem(
    id: number,
    updateData: Partial<CreateInventoryReceiptItemDto>,
  ): Promise<InventoryReceiptItem | null> {
    await this.inventoryReceiptItemRepository.update(id, updateData);
    return this.inventoryReceiptItemRepository.findOne({ where: { id } });
  }

  /**
   * Xóa chi tiết phiếu nhập kho theo ID
   * @param id - ID của chi tiết phiếu nhập kho cần xóa
   */
  async removeReceiptItem(id: number) {
    await this.inventoryReceiptItemRepository.delete(id);
  }

  /**
   * Lấy thông tin giá nhập của sản phẩm bao gồm giá nhập mới nhất và giá nhập trung bình
   * @param productId - ID của sản phẩm
   * @returns Thông tin giá nhập của sản phẩm
   */
  async getProductPurchasePrices(productId: number): Promise<{
    latestPurchasePrice: number | null;
    averageCostPrice: number;
  }> {
    const latestPurchasePrice = await this.getLatestPurchasePrice(productId);
    const product = await this.productService.findOne(productId);

    return {
      latestPurchasePrice,
      averageCostPrice: product ? parseFloat(product.average_cost_price ?? '0') : 0,
    };
  }

  /**
   * Lấy giá nhập mới nhất của sản phẩm từ các phiếu nhập kho
   * @param productId - ID của sản phẩm
   * @returns Giá nhập mới nhất hoặc null nếu chưa có lần nhập nào
   */
  async getLatestPurchasePrice(productId: number): Promise<number | null> {
    const latestReceiptItem = await this.inventoryReceiptItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.receipt', 'receipt')
      .where('item.product_id = :productId', { productId })
      .andWhere('receipt.status = :status', { status: ReceiptStatus.APPROVED }) // Chỉ lấy từ các phiếu đã duyệt
      .orderBy('receipt.created_at', 'DESC')
      .getOne();

    return latestReceiptItem ? latestReceiptItem.unit_cost : null;
  }

  /**
   * Upload hình ảnh hóa đơn cho phiếu nhập kho
   * @param receiptId - ID của phiếu nhập kho
   * @param fileId - ID của file đã upload
   * @param fieldName - Tên trường (mặc định: 'invoice_images')
   * @returns Thông tin tham chiếu file đã tạo
   */
  async uploadReceiptImage(
    receiptId: number,
    fileId: number,
    fieldName: string = 'invoice_images',
  ) {
    // Kiểm tra phiếu nhập kho có tồn tại không
    const receipt = await this.findReceiptById(receiptId);
    if (!receipt) {
      throw new Error('Không tìm thấy phiếu nhập kho');
    }

    // Lấy thông tin file
    const fileUpload = await this.fileTrackingService.findOne(fileId);
    if (!fileUpload) {
      throw new Error('Không tìm thấy file');
    }

    // Tạo tham chiếu file
    const fileReference = await this.fileTrackingService.createFileReference(
      fileUpload,
      'inventory_receipt',
      receiptId,
      fieldName,
    );

    return fileReference;
  }

  /**
   * Lấy danh sách hình ảnh của phiếu nhập kho
   * @param receiptId - ID của phiếu nhập kho
   * @returns Danh sách hình ảnh
   */
  async getReceiptImages(receiptId: number) {
    const fileReferences =
      await this.fileTrackingService.findFileReferencesByEntity(
        'inventory_receipt',
        receiptId,
      );

    // Lấy thông tin chi tiết của từng file
    const images: Array<{
      id: number;
      url: string;
      name: string;
      type: string;
      size: number;
      created_at: Date;
    }> = [];
    for (const ref of fileReferences) {
      const file = await this.fileTrackingService.findOne(ref.file_id);
      if (file) {
        images.push({
          id: file.id,
          url: file.url,
          name: file.name,
          type: file.type,
          size: file.size,
          created_at: ref.created_at,
        });
      }
    }

    return images;
  }

  /**
   * Xóa hình ảnh khỏi phiếu nhập kho
   * @param receiptId - ID của phiếu nhập kho
   * @param fileId - ID của file cần xóa
   * @returns Kết quả xóa
   */
  async deleteReceiptImage(receiptId: number, fileId: number) {
    // Kiểm tra phiếu nhập kho có tồn tại không
    const receipt = await this.findReceiptById(receiptId);
    if (!receipt) {
      throw new Error('Không tìm thấy phiếu nhập kho');
    }

    // Xóa tham chiếu file
    await this.fileTrackingService.removeFileReference(
      fileId,
      'inventory_receipt',
      receiptId,
    );

    return {
      success: true,
      message: 'Đã xóa hình ảnh thành công',
    };
  }

  // ===== RETURN FEATURE METHODS =====

  /**
   * Tạo phiếu xuất trả hàng mới
   * @param createInventoryReturnDto - Dữ liệu tạo phiếu xuất trả hàng mới
   * @returns Thông tin phiếu xuất trả hàng đã tạo
   */
  async createReturn(createInventoryReturnDto: CreateInventoryReturnDto, userId: number) {
    this.logger.log(`Bắt đầu tạo phiếu trả hàng: ${createInventoryReturnDto.return_code}`);
    
    // Validate: Nếu trả hàng từ phiếu nhập, kiểm tra số lượng trả không vượt quá số lượng nhập
    if (createInventoryReturnDto.receipt_id) {
       const receiptItems = await this.getReceiptItems(createInventoryReturnDto.receipt_id);
       
       // Lấy các phiếu trả hàng CŨ của phiếu nhập này (nếu có) để tính tổng đã trả
       const existingReturns = await this.inventoryReturnRepository.find({
          where: { receipt_id: createInventoryReturnDto.receipt_id },
          relations: ['items']
       });
       
       // Map tổng số lượng đã trả theo sản phẩm
       const returnedQuantityMap = new Map<number, number>();
       for (const ret of existingReturns) {
          // Bỏ qua nếu phiếu đã bị hủy
          if (ret.status === 'cancelled') continue;
          
          for (const item of ret.items) {
             const currentQty = returnedQuantityMap.get(item.product_id) || 0;
             returnedQuantityMap.set(item.product_id, currentQty + Number(item.quantity));
          }
       }
       
       // Kiểm tra từng item trong phiếu trả mới
       for (const newItem of createInventoryReturnDto.items) {
          const receiptItem = receiptItems.find(ri => ri.product_id === newItem.product_id);
          
          if (!receiptItem) {
             throw new BadRequestException(`Sản phẩm ID ${newItem.product_id} không có trong phiếu nhập gốc.`);
          }
          
          const alreadyReturned = returnedQuantityMap.get(newItem.product_id) || 0;
          const totalAfterReturn = alreadyReturned + newItem.quantity;
          
          if (totalAfterReturn > receiptItem.quantity) {
             throw new BadRequestException(
                `Sản phẩm ID ${newItem.product_id}: Tổng số lượng trả (${totalAfterReturn}) vượt quá số lượng nhập (${receiptItem.quantity}). Đã trả trước đó: ${alreadyReturned}.`
             );
          }
       }
    }
    
    // Sử dụng transaction để đảm bảo dữ liệu được lưu đồng bộ
    const queryRunner = this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tự sinh mã nếu không được cung cấp
      let returnCode = createInventoryReturnDto.return_code;
      if (!returnCode) {
        returnCode = CodeGeneratorHelper.generateUniqueCode('RET');
        this.logger.log(`Tự sinh mã phiếu trả hàng: ${returnCode}`);
      }

      // Tạo phiếu trả hàng
      const returnData: any = {
        code: returnCode,
        receipt_id: createInventoryReturnDto.receipt_id,
        supplier_id: createInventoryReturnDto.supplier_id,
        total_amount: createInventoryReturnDto.total_amount,
        reason: createInventoryReturnDto.reason,
        status: createInventoryReturnDto.status || ReturnStatus.DRAFT,
        created_by: userId,
        updated_by: userId,
      };

      if (createInventoryReturnDto.notes !== undefined) {
        returnData.notes = createInventoryReturnDto.notes;
      }

      this.logger.log(`Đang lưu phiếu trả hàng với dữ liệu: ${JSON.stringify(returnData)}`);
      const returnDoc = queryRunner.manager.create(InventoryReturn, returnData);
      const savedReturn = await queryRunner.manager.save(returnDoc);

      const returnEntity = Array.isArray(savedReturn)
        ? savedReturn[0]
        : savedReturn;

      if (!returnEntity || !returnEntity.id) {
        throw new Error('Không thể lưu phiếu trả hàng');
      }

      this.logger.log(`Đã lưu phiếu trả hàng với ID: ${returnEntity.id}`);

      // Tạo các item trong phiếu
      const savedItems: any[] = [];
      for (const item of createInventoryReturnDto.items) {
        const itemData: any = {
          return_id: returnEntity.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_price: item.total_price,
          reason: item.reason,
        };

        if (item.notes !== undefined) {
          itemData.notes = item.notes;
        }

        this.logger.log(`Đang lưu item: ${JSON.stringify(itemData)}`);
        const itemEntity = queryRunner.manager.create(InventoryReturnItem, itemData);
        const savedItem = await queryRunner.manager.save(itemEntity);
        savedItems.push(savedItem);
        this.logger.log(`Đã lưu item với ID: ${savedItem.id}`);
      }

      // Commit transaction
      await queryRunner.commitTransaction();
      this.logger.log(`Đã commit transaction cho phiếu trả hàng ${returnEntity.id}`);

      // Trả về kết quả với relations
      const result = await this.inventoryReturnRepository.findOne({
        where: { id: returnEntity.id },
        relations: ['supplier', 'items'],
      });

      this.logger.log(`Hoàn thành tạo phiếu trả hàng ${returnEntity.id}`);
      return result;
    } catch (error) {
      // Rollback transaction nếu có lỗi
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(`Lỗi khi tạo phiếu trả hàng: ${errorMessage}`, errorStack);
      throw new Error(`Không thể tạo phiếu trả hàng: ${errorMessage}`);
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  /**
   * Cập nhật thông tin phiếu xuất trả hàng (chỉ khi ở trạng thái draft)
   * @param id - ID của phiếu cần cập nhật
   * @param updateDto - Dữ liệu cập nhật
   * @param userId - ID người thực hiện
   */
  async updateReturn(id: number, updateDto: Partial<CreateInventoryReturnDto>, userId: number) {
    const returnDoc = await this.findReturnById(id);
    if (!returnDoc) {
      throw new NotFoundException('Không tìm thấy phiếu trả hàng');
    }

    if (returnDoc.status !== ReturnStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể sửa phiếu ở trạng thái nháp');
    }

    const queryRunner = this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Cập nhật thông tin chung
      const updateData: any = {
        updated_by: userId,
      };
      if (updateDto.return_code) updateData.code = updateDto.return_code;
      if (updateDto.supplier_id) updateData.supplier_id = updateDto.supplier_id;
      if (updateDto.receipt_id) updateData.receipt_id = updateDto.receipt_id;
      if (updateDto.total_amount !== undefined) updateData.total_amount = updateDto.total_amount;
      if (updateDto.reason) updateData.reason = updateDto.reason;
      if (updateDto.status) updateData.status = updateDto.status;
      if (updateDto.notes !== undefined) updateData.notes = updateDto.notes;

      await queryRunner.manager.update(InventoryReturn, id, updateData);

      // Cập nhật danh sách items nếu có
      if (updateDto.items) {
        // Xóa items cũ
        await queryRunner.manager.delete(InventoryReturnItem, { return_id: id });
        
        // Thêm items mới
        for (const item of updateDto.items) {
          const itemData: any = {
            return_id: id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            total_price: item.total_price,
          };
          if (item.reason) itemData.reason = item.reason;
          if (item.notes) itemData.notes = item.notes;

          const itemDoc = queryRunner.manager.create(InventoryReturnItem, itemData);
          await queryRunner.manager.save(itemDoc);
        }
      }

      await queryRunner.commitTransaction();
      return this.findReturnById(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }



  /**
   * Tìm phiếu xuất trả hàng theo ID
   * @param id - ID của phiếu xuất trả hàng cần tìm
   * @returns Thông tin phiếu xuất trả hàng
   */
  async findReturnById(id: number): Promise<InventoryReturn | null> {
    const returnDoc = await this.inventoryReturnRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'supplier'],
    });

    if (!returnDoc) {
      return null;
    }

    // Load images và gắn vào returnDoc
    const images = await this.getReturnImages(id);
    (returnDoc as any).images = images;

    return returnDoc;
  }

  /**
   * Tìm kiếm nâng cao phiếu xuất trả hàng
   */
  async searchReturns(searchDto: SearchInventoryDto): Promise<{
    data: InventoryReturn[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.inventoryReturnRepository.createQueryBuilder('return');

    queryBuilder.leftJoinAndSelect('return.supplier', 'supplier');
    queryBuilder.leftJoinAndSelect('return.items', 'items');
    queryBuilder.leftJoinAndSelect('items.product', 'product');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'return',
      ['code', 'supplier.name', 'notes'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'return',
      ['filters', 'nested_filters', 'operator'],
      {
        supplier_name: 'supplier.name',
      }
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Duyệt phiếu xuất trả hàng (và tự động trừ kho)
   * @param id - ID của phiếu xuất trả hàng cần duyệt
   * @param userId - ID người duyệt
   * @returns Kết quả duyệt phiếu xuất trả hàng
   */
  async approveReturn(id: number, userId: number): Promise<InventoryReturn | null> {
    const returnDoc = await this.findReturnById(id);
    if (!returnDoc) {
      return null;
    }

    // Kiểm tra trạng thái
    if (returnDoc.status === ReturnStatus.APPROVED) {
      return returnDoc; // Đã duyệt rồi
    }

    if (returnDoc.status === ReturnStatus.CANCELLED) {
      throw new Error('Không thể duyệt phiếu đã bị hủy');
    }

    // Lấy danh sách chi tiết phiếu xuất trả
    const items = await this.inventoryReturnItemRepository.find({
      where: { return_id: id },
    });

    // Xử lý xuất kho cho từng sản phẩm
    for (const item of items) {
      try {
        await this.processStockOut(
          item.product_id,
          item.quantity,
          'RETURN',
          userId,
          id,
          `Trả hàng cho nhà cung cấp - Phiếu ${returnDoc.code}`,
        );
      } catch (error) {
        this.logger.error(
          `Lỗi khi xử lý xuất kho cho sản phẩm ${item.product_id} trong phiếu trả hàng ${id}:`,
          error,
        );
        throw new Error(
          `Không thể duyệt phiếu trả hàng do lỗi xử lý tồn kho sản phẩm ${item.product_id}`,
        );
      }
    }

    returnDoc.status = ReturnStatus.APPROVED;
    returnDoc.approved_at = new Date();
    return this.inventoryReturnRepository.save(returnDoc);
  }



  /**
   * Hủy phiếu xuất trả hàng
   * @param id - ID của phiếu xuất trả hàng cần hủy
   * @param reason - Lý do hủy phiếu xuất trả hàng
   * @returns Thông tin phiếu xuất trả hàng đã hủy
   */
  async cancelReturn(
    id: number,
    reason: string,
  ): Promise<InventoryReturn | null> {
    const returnDoc = await this.findReturnById(id);
    if (!returnDoc) {
      return null;
    }
    returnDoc.status = ReturnStatus.CANCELLED;
    returnDoc.cancelled_at = new Date();
    returnDoc.cancelled_reason = reason;
    return this.inventoryReturnRepository.save(returnDoc);
  }

  /**
   * Xóa phiếu xuất trả hàng theo ID
   * @param id - ID của phiếu xuất trả hàng cần xóa
   */
  async removeReturn(id: number) {
    const returnDoc = await this.findReturnById(id);
    if (!returnDoc) {
      throw new Error('Không tìm thấy phiếu xuất trả hàng');
    }

    // Chỉ cho phép xóa phiếu ở trạng thái nháp hoặc đã hủy
    if (returnDoc.status !== ReturnStatus.DRAFT && returnDoc.status !== ReturnStatus.CANCELLED) {
      throw new Error(
        'Không thể xóa phiếu xuất trả hàng đã được duyệt.',
      );
    }

    // Xóa các item trong phiếu trước
    await this.inventoryReturnItemRepository.delete({ return_id: id });

    // Sau đó xóa phiếu
    await this.inventoryReturnRepository.delete(id);
  }

  /**
   * Upload hình ảnh cho phiếu xuất trả hàng
   * @param returnId - ID của phiếu xuất trả hàng
   * @param fileId - ID của file đã upload
   * @param fieldName - Tên trường (mặc định: 'return_images')
   * @returns Thông tin tham chiếu file đã tạo
   */
  async uploadReturnImage(
    returnId: number,
    fileId: number,
    fieldName: string = 'return_images',
  ) {
    // Kiểm tra phiếu trả hàng có tồn tại không
    const returnDoc = await this.findReturnById(returnId);
    if (!returnDoc) {
      throw new Error('Không tìm thấy phiếu trả hàng');
    }

    // Lấy thông tin file
    const fileUpload = await this.fileTrackingService.findOne(fileId);
    if (!fileUpload) {
      throw new Error('Không tìm thấy file');
    }

    // Tạo tham chiếu file
    const fileReference = await this.fileTrackingService.createFileReference(
      fileUpload,
      'inventory_return',
      returnId,
      fieldName,
    );

    return fileReference;
  }

  /**
   * Lấy danh sách hình ảnh của phiếu xuất trả hàng
   * @param returnId - ID của phiếu xuất trả hàng
   * @returns Danh sách hình ảnh
   */
  async getReturnImages(returnId: number) {
    const fileReferences =
      await this.fileTrackingService.findFileReferencesByEntity(
        'inventory_return',
        returnId,
      );

    // Lấy thông tin chi tiết của từng file
    const images: Array<{
      id: number;
      url: string;
      name: string;
      type: string;
      size: number;
      created_at: Date;
    }> = [];
    for (const ref of fileReferences) {
      const file = await this.fileTrackingService.findOne(ref.file_id);
      if (file) {
        images.push({
          id: file.id,
          url: file.url,
          name: file.name,
          type: file.type,
          size: file.size,
          created_at: ref.created_at,
        });
      }
    }

    return images;
  }

  /**
   * Xóa hình ảnh khỏi phiếu xuất trả hàng
   * @param returnId - ID của phiếu xuất trả hàng
   * @param fileId - ID của file cần xóa
   * @returns Kết quả xóa
   */
  async deleteReturnImage(returnId: number, fileId: number) {
    // Kiểm tra phiếu trả hàng có tồn tại không
    const returnDoc = await this.findReturnById(returnId);
    if (!returnDoc) {
      throw new Error('Không tìm thấy phiếu trả hàng');
    }

    // Xóa tham chiếu file
    await this.fileTrackingService.removeFileReference(
      fileId,
      'inventory_return',
      returnId,
    );

    return {
      success: true,
      message: 'Đã xóa hình ảnh thành công',
    };
  }

  // ===== ADJUSTMENT FEATURE METHODS =====

  /**
   * Tạo phiếu điều chỉnh kho mới
   * @param createInventoryAdjustmentDto - Dữ liệu tạo phiếu điều chỉnh kho mới
   * @returns Thông tin phiếu điều chỉnh kho đã tạo
   */
  async createAdjustment(
    createInventoryAdjustmentDto: CreateInventoryAdjustmentDto,
    userId: number,
  ) {
    this.logger.log(`Bắt đầu tạo phiếu điều chỉnh: ${createInventoryAdjustmentDto.adjustment_code || 'auto-generate'}`);
    
    const queryRunner = this.inventoryAdjustmentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tự sinh mã nếu không được cung cấp
      let adjustmentCode = createInventoryAdjustmentDto.adjustment_code;
      if (!adjustmentCode) {
        adjustmentCode = CodeGeneratorHelper.generateUniqueCode('ADJ');
        this.logger.log(`Tự sinh mã phiếu điều chỉnh: ${adjustmentCode}`);
      }

      const adjustmentData: any = {
        code: adjustmentCode,
        adjustment_type: createInventoryAdjustmentDto.adjustment_type,
        reason: createInventoryAdjustmentDto.reason,
        status: createInventoryAdjustmentDto.status || AdjustmentStatus.DRAFT,
        created_by: userId,
        updated_by: userId,
      };

      if (createInventoryAdjustmentDto.notes !== undefined) {
        adjustmentData.notes = createInventoryAdjustmentDto.notes;
      }

      const adjustment = queryRunner.manager.create(InventoryAdjustment, adjustmentData);
      const savedAdjustment = await queryRunner.manager.save(adjustment);

      const adjustmentEntity = Array.isArray(savedAdjustment)
        ? savedAdjustment[0]
        : savedAdjustment;

      if (!adjustmentEntity || !adjustmentEntity.id) {
        throw new Error('Failed to save adjustment');
      }
      
      this.logger.log(`Đã lưu phiếu điều chỉnh với ID: ${adjustmentEntity.id}`);

      // Tạo các item trong phiếu
      for (const item of createInventoryAdjustmentDto.items) {
        const itemData: any = {
          adjustment_id: adjustmentEntity.id,
          product_id: item.product_id,
          quantity_change: item.quantity_change,
          reason: item.reason,
        };

        if (item.notes !== undefined) {
          itemData.notes = item.notes;
        }

        const itemEntity = queryRunner.manager.create(InventoryAdjustmentItem, itemData);
        await queryRunner.manager.save(itemEntity);
      }
      
      await queryRunner.commitTransaction();
      this.logger.log(`Đã commit transaction cho phiếu điều chỉnh ${adjustmentEntity.id}`);

      return this.inventoryAdjustmentRepository.findOne({
        where: { id: adjustmentEntity.id },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(`Lỗi khi tạo phiếu điều chỉnh: ${errorMessage}`, errorStack);
      throw new Error(`Không thể tạo phiếu điều chỉnh: ${errorMessage}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cập nhật thông tin phiếu điều chỉnh kho (chỉ khi ở trạng thái draft)
   * @param id - ID của phiếu cần cập nhật
   * @param updateDto - Dữ liệu cập nhật
   * @param userId - ID người thực hiện
   */
  async updateAdjustment(id: number, updateDto: any, userId: number) {
    const adjustment = await this.findAdjustmentById(id);
    if (!adjustment) {
      throw new NotFoundException('Không tìm thấy phiếu điều chỉnh kho');
    }

    if (adjustment.status !== AdjustmentStatus.DRAFT) {
      throw new BadRequestException('Chỉ có thể sửa phiếu ở trạng thái nháp');
    }

    const queryRunner = this.inventoryAdjustmentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Cập nhật thông tin chung
      const updateData: any = {
        updated_by: userId,
      };
      if (updateDto.adjustment_code) updateData.code = updateDto.adjustment_code;
      if (updateDto.adjustment_type) updateData.adjustment_type = updateDto.adjustment_type;
      if (updateDto.reason) updateData.reason = updateDto.reason;
      if (updateDto.notes !== undefined) updateData.notes = updateDto.notes;
      if (updateDto.status) updateData.status = updateDto.status;

      await queryRunner.manager.update(InventoryAdjustment, id, updateData);

      // Cập nhật danh sách items nếu có
      if (updateDto.items) {
        // Xóa items cũ
        await queryRunner.manager.delete(InventoryAdjustmentItem, { adjustment_id: id });
        
        // Thêm items mới
        for (const item of updateDto.items) {
          const itemData: any = {
            adjustment_id: id,
            product_id: item.product_id,
            quantity_change: item.quantity_change,
            reason: item.reason,
          };
          if (item.notes !== undefined) itemData.notes = item.notes;

          const itemDoc = queryRunner.manager.create(InventoryAdjustmentItem, itemData);
          await queryRunner.manager.save(itemDoc);
        }
      }

      await queryRunner.commitTransaction();
      return this.findAdjustmentById(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Tìm phiếu điều chỉnh kho theo ID
   * @param id - ID của phiếu điều chỉnh kho cần tìm
   * @returns Thông tin phiếu điều chỉnh kho
   */
  async findAdjustmentById(id: number): Promise<InventoryAdjustment | null> {
    return this.inventoryAdjustmentRepository.findOne({
      where: { id },
      relations: ['items'],
    });
  }

  /**
   * Tìm kiếm nâng cao phiếu điều chỉnh kho
   */
  async searchAdjustments(searchDto: SearchInventoryDto): Promise<{
    data: InventoryAdjustment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.inventoryAdjustmentRepository.createQueryBuilder('adjustment');

    queryBuilder.leftJoinAndSelect('adjustment.items', 'items');
    queryBuilder.leftJoinAndSelect('items.product', 'product');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'adjustment',
      ['code', 'reason', 'notes'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'adjustment',
      ['filters', 'nested_filters', 'operator']
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Duyệt phiếu điều chỉnh kho (và tự động tác động kho)
   * @param id - ID của phiếu điều chỉnh kho cần duyệt
   * @param userId - ID người duyệt
   * @returns Kết quả duyệt phiếu điều chỉnh kho
   */
  async approveAdjustment(id: number, userId: number): Promise<InventoryAdjustment | null> {
    const adjustment = await this.findAdjustmentById(id);
    if (!adjustment) {
      return null;
    }

    // Kiểm tra trạng thái
    if (adjustment.status === AdjustmentStatus.APPROVED) {
      return adjustment; // Đã duyệt rồi
    }

    if (adjustment.status === AdjustmentStatus.CANCELLED) {
      throw new Error('Không thể duyệt phiếu đã bị hủy');
    }

    // Lấy danh sách chi tiết phiếu điều chỉnh
    const items = await this.inventoryAdjustmentItemRepository.find({
      where: { adjustment_id: id },
    });

    // Xử lý điều chỉnh kho cho từng sản phẩm
    for (const item of items) {
      try {
        const quantityChange = item.quantity_change;

        if (quantityChange > 0) {
          // Tăng tồn kho
          const currentAverageCost = await this.getWeightedAverageCost(
            item.product_id,
          );
          await this.processStockIn(
            item.product_id,
            quantityChange,
            currentAverageCost, // Sử dụng giá vốn hiện tại
            userId,
            undefined,
            `Điều chỉnh tăng kho - Phiếu ${adjustment.code}`,
          );
        } else if (quantityChange < 0) {
          // Giảm tồn kho
          await this.processStockOut(
            item.product_id,
            Math.abs(quantityChange),
            'ADJUSTMENT',
            userId,
            id,
            `Điều chỉnh giảm kho - Phiếu ${adjustment.code}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Lỗi khi xử lý điều chỉnh kho cho sản phẩm ${item.product_id} trong phiếu ${id}:`,
          error,
        );
        throw new Error(
          `Không thể duyệt phiếu điều chỉnh kho do lỗi xử lý tồn kho sản phẩm ${item.product_id}`,
        );
      }
    }

    adjustment.status = AdjustmentStatus.APPROVED;
    adjustment.approved_at = new Date();
    return this.inventoryAdjustmentRepository.save(adjustment);
  }



  /**
   * Hủy phiếu điều chỉnh kho
   * @param id - ID của phiếu điều chỉnh kho cần hủy
   * @param reason - Lý do hủy phiếu điều chỉnh kho
   * @returns Thông tin phiếu điều chỉnh kho đã hủy
   */
  async cancelAdjustment(
    id: number,
    reason: string,
  ): Promise<InventoryAdjustment | null> {
    const adjustment = await this.findAdjustmentById(id);
    if (!adjustment) {
      return null;
    }
    adjustment.status = AdjustmentStatus.CANCELLED;
    adjustment.cancelled_at = new Date();
    adjustment.cancelled_reason = reason;
    return this.inventoryAdjustmentRepository.save(adjustment);
  }

  /**
   * Xóa phiếu điều chỉnh kho theo ID
   * @param id - ID của phiếu điều chỉnh kho cần xóa
   */
  async removeAdjustment(id: number) {
    const adjustment = await this.findAdjustmentById(id);
    if (!adjustment) {
      throw new Error('Không tìm thấy phiếu điều chỉnh kho');
    }

    // Chỉ cho phép xóa phiếu ở trạng thái nháp hoặc đã hủy
    if (adjustment.status !== AdjustmentStatus.DRAFT && adjustment.status !== AdjustmentStatus.CANCELLED) {
      throw new Error(
        'Không thể xóa phiếu điều chỉnh kho đã được duyệt.',
      );
    }

    // Xóa các item trong phiếu trước
    await this.inventoryAdjustmentItemRepository.delete({ adjustment_id: id });

    // Sau đó xóa phiếu
    await this.inventoryAdjustmentRepository.delete(id);
  }
}
