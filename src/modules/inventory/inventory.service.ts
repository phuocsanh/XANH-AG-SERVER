import { Injectable, Inject, forwardRef, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In, QueryRunner } from 'typeorm';

import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReceiptPayment } from '../../entities/inventory-receipt-payments.entity';
import { InventoryReturn } from '../../entities/inventory-returns.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { InventoryReturnRefund } from '../../entities/inventory-return-refunds.entity';
import { InventoryAdjustment } from '../../entities/inventory-adjustments.entity';
import { InventoryAdjustmentItem } from '../../entities/inventory-adjustment-items.entity';
import { Product } from '../../entities/products.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { CreateInventoryBatchDto } from './dto/create-inventory-batch.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import {
  CreateInventoryReceiptDto,
  CreateInventoryReceiptItemDto,
} from './dto/create-inventory-receipt.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
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
    @InjectRepository(InventoryReceiptPayment)
    private receiptPaymentRepository: Repository<InventoryReceiptPayment>,
    @InjectRepository(InventoryReturn)
    private inventoryReturnRepository: Repository<InventoryReturn>,
    @InjectRepository(InventoryReturnItem)
    private inventoryReturnItemRepository: Repository<InventoryReturnItem>,
    @InjectRepository(InventoryReturnRefund)
    private returnRefundRepository: Repository<InventoryReturnRefund>,
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
   async createBatch(createInventoryBatchDto: CreateInventoryBatchDto, queryRunner?: QueryRunner) {
    try {
      const repo = queryRunner ? queryRunner.manager.getRepository(InventoryBatch) : this.inventoryBatchRepository;
      const batch = repo.create(
        createInventoryBatchDto,
      );
      return repo.save(batch);
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
    queryRunner?: QueryRunner,
  ): Promise<InventoryTransaction> {
    // Map DTO fields to entity fields
    const transactionData: Partial<InventoryTransaction> = {
      product_id: createInventoryTransactionDto.product_id,
      type: createInventoryTransactionDto.transaction_type,
      quantity: createInventoryTransactionDto.quantity,
      unit_cost_price: createInventoryTransactionDto.unit_cost_price,
      total_value: createInventoryTransactionDto.total_cost_value,
      remaining_quantity: createInventoryTransactionDto.remaining_quantity,
      new_average_cost: createInventoryTransactionDto.new_average_cost,
      created_by: createInventoryTransactionDto.created_by_user_id,
      ...(createInventoryTransactionDto.receipt_item_id !== undefined && {
        receipt_item_id: createInventoryTransactionDto.receipt_item_id,
      }),
      ...(createInventoryTransactionDto.reference_type !== undefined && {
        reference_type: createInventoryTransactionDto.reference_type,
      }),
      ...(createInventoryTransactionDto.reference_id !== undefined && {
        reference_id: createInventoryTransactionDto.reference_id,
      }),
      ...(createInventoryTransactionDto.notes !== undefined && {
        notes: createInventoryTransactionDto.notes,
      }),
    };

    const repo = queryRunner ? queryRunner.manager.getRepository(InventoryTransaction) : this.inventoryTransactionRepository;
    const transaction = repo.create(transactionData);
    return repo.save(transaction);
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
  async getInventorySummary(productId: number, queryRunner?: QueryRunner) {
    // 1. Lấy tất cả lô hàng của sản phẩm
    const repo = queryRunner ? queryRunner.manager.getRepository(InventoryBatch) : this.inventoryBatchRepository;
    const batches = await repo.find({
      where: { product_id: productId },
    });

    // 2. Tính tổng số lượng từ các lô hàng (số lượng thực theo lô)
    const batchTotalQuantity = batches.reduce(
      (sum, batch) => sum + batch.remaining_quantity,
      0,
    );
    
    // 3. Lấy con số số lượng từ bảng Product
    const product = await this.productService.findOne(productId, queryRunner);
    const productQuantity = product?.quantity || 0;

    // Trả về số lượng từ bảng Product làm số lượng chính để đảm bảo tính nhất quán với UI
    // nhưng vẫn giữ thông tin số lượng lô hàng nếu cần đối soát
    return {
      productId,
      totalQuantity: productQuantity,
      batchTotalQuantity: batchTotalQuantity,
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
  async getWeightedAverageCost(productId: number, queryRunner?: QueryRunner): Promise<number> {
    // Lấy tất cả lô hàng còn tồn kho của sản phẩm
    const repo = queryRunner ? queryRunner.manager.getRepository(InventoryBatch) : this.inventoryBatchRepository;
    const batches = await repo.find({
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
    queryRunner?: QueryRunner,
    isTaxable?: boolean,
  ) {
    // Lấy giá vốn trung bình hiện tại
    const currentAverageCost = await this.getWeightedAverageCost(productId, queryRunner);

    // Lấy thông tin sản phẩm để lấy số lượng tồn kho hiện tại (ưu tiên con số ở bảng Product vì có thể đã được chỉnh sửa thủ công)
    const productRepo = queryRunner ? queryRunner.manager.getRepository(Product) : this.productService['productRepository'];
    const product = await productRepo.findOne({ where: { id: productId } });
    const currentQuantity = product?.quantity || 0;

    // Lấy tổng số lượng từ các lô hàng để theo dõi tính nhất quán
    const currentInventory = await this.getInventorySummary(productId, queryRunner);
    const batchTotalQuantity = currentInventory.totalQuantity;
    
    if (batchTotalQuantity !== currentQuantity) {
      this.logger.warn(`Phát hiện sự không đồng nhất về tồn kho cho sản phẩm ${productId}: Số lượng trên bảng Product (${currentQuantity}) khác với tổng số lượng trong các lô hàng (${batchTotalQuantity}). Hệ thống sẽ sử dụng con số từ bảng Product.`);
    }

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

    const newBatch = await this.createBatch(batchData, queryRunner);

    // Cập nhật giá nhập mới nhất cho sản phẩm
    if (queryRunner) {
        await queryRunner.manager.update(Product, productId, { latest_purchase_price: unitCostPrice.toString() });
    } else {
        await this.productService.update(productId, {
            latest_purchase_price: unitCostPrice.toString(),
        });
    }



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

    const transaction = await this.createTransaction(transactionData, queryRunner);

    // Cập nhật giá sản phẩm
    if (queryRunner) {
        const updateData: any = {
          latest_purchase_price: unitCostPrice.toString(),
          quantity: newTotalQuantity,
          average_cost_price: newAverageCost.toFixed(2),
        };
        
        if (isTaxable) {
          updateData.taxable_quantity_stock = Number(product?.taxable_quantity_stock || 0) + quantity;
        }
        
        await queryRunner.manager.update(Product, productId, updateData);
    } else {
        const updateData: any = {
          latest_purchase_price: unitCostPrice.toString(),
          quantity: newTotalQuantity,
          average_cost_price: newAverageCost.toFixed(2),
        };
        
        if (isTaxable) {
          updateData.taxable_quantity_stock = Number(product?.taxable_quantity_stock || 0) + quantity;
        }
        
        await this.productService.update(productId, updateData);
    }

      this.logger.log('✅ Đã cập nhật tồn kho sản phẩm:', {
        productId,
        newQuantity: newTotalQuantity,
      });
    // } catch (error) {
    //   const errorMessage =
    //     error instanceof Error ? error.message : 'Unknown error';
    //   this.logger.warn(
    //     `Không thể cập nhật giá sản phẩm ${productId}:`,
    //     errorMessage,
    //   );
    //   // Không throw error để không làm gián đoạn quá trình nhập kho
    // }

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
    queryRunner?: QueryRunner,
  ): Promise<{ 
    transaction: InventoryTransaction; 
    taxableQuantity: number;
    affectedBatches: any[];
    totalCostValue: number;
    averageCostUsed: number;
    remainingQuantity: number;
  }> {
    // Kiểm tra tồn kho hiện tại
    const currentInventory = await this.getInventorySummary(productId, queryRunner);
    if (currentInventory.totalQuantity < quantity) {
      throw new Error(
        `Không đủ tồn kho. Hiện có: ${currentInventory.totalQuantity}, yêu cầu: ${quantity}`,
      );
    }

    // Lấy thông tin sản phẩm để xử lý bể thuế
    const productRepo = queryRunner ? queryRunner.manager.getRepository(Product) : this.productService['productRepository'];
    const product = await productRepo.findOne({ where: { id: productId } });
    const currentTaxableStock = Number(product?.taxable_quantity_stock || 0);
    
    // Tính toán số lượng thuế sẽ trừ (FIFO cho bể thuế)
    const taxableQuantityToDeduct = Math.min(quantity, currentTaxableStock);

    // Lấy giá vốn trung bình hiện tại
    const currentAverageCost = await this.getWeightedAverageCost(productId, queryRunner);

    // Lấy các lô hàng theo thứ tự FIFO (First In, First Out)
    const batchRepo = queryRunner ? queryRunner.manager.getRepository(InventoryBatch) : this.inventoryBatchRepository;
    const batches = await batchRepo.find({
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
      await batchRepo.save(batch);
      
      affectedBatches.push({
        batchId: batch.id,
        deductedQuantity: deductFromBatch,
        remainingQuantity: batch.remaining_quantity,
        cost: batchCost
      });
    }

    // Tính số lượng tồn kho mới
    const newTotalQuantity = currentInventory.totalQuantity - quantity;
    const newTaxableQuantityStock = Math.max(0, currentTaxableStock - taxableQuantityToDeduct);

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

    const transaction = await this.createTransaction(transactionData, queryRunner);

    // Cập nhật tồn kho hiển thị cho sản phẩm
    try {
      const updateData: any = { 
        quantity: newTotalQuantity,
        taxable_quantity_stock: newTaxableQuantityStock
      };

      if (queryRunner) {
          await queryRunner.manager.update(Product, productId, updateData);
      } else {
        await this.productService.update(productId, updateData);
      }

      this.logger.log('✅ Đã cập nhật tồn kho sản phẩm sau xuất kho:', {
        productId,
        newQuantity: newTotalQuantity,
        newTaxableQuantity: newTaxableQuantityStock,
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
      taxableQuantity: taxableQuantityToDeduct
    };
  }

  /**
   * Tính lại giá vốn trung bình gia quyền cho sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Giá vốn trung bình gia quyền đã được tính lại
   */
  async recalculateWeightedAverageCost(productId: number, queryRunner?: QueryRunner): Promise<{
    productId: number;
    previousAverageCost: number;
    newAverageCost: number;
    totalQuantity: number;
    totalValue: number;
  }> {
    const previousAverageCost = await this.getWeightedAverageCost(productId);

    // Lấy tất cả lô hàng còn tồn kho
    const batchRepo = queryRunner ? queryRunner.manager.getRepository(InventoryBatch) : this.inventoryBatchRepository;
    const batches = await batchRepo.find({
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

      // Thêm ngày hóa đơn nếu có
      if (createInventoryReceiptDto.bill_date) {
        receiptData.bill_date = new Date(createInventoryReceiptDto.bill_date);
      }

      // Thêm phí vận chuyển chung nếu có
      if (createInventoryReceiptDto.shared_shipping_cost !== undefined) {
        receiptData.shared_shipping_cost = createInventoryReceiptDto.shared_shipping_cost;
      }

      // Thêm phương thức phân bổ phí vận chuyển
      if (createInventoryReceiptDto.shipping_allocation_method !== undefined) {
        receiptData.shipping_allocation_method = createInventoryReceiptDto.shipping_allocation_method;
      }

      // Thêm images nếu có
      if (createInventoryReceiptDto.images && createInventoryReceiptDto.images.length > 0) {
        receiptData.images = createInventoryReceiptDto.images;
      }



      // ===== XỬ LÝ THANH TOÁN =====
      const paidAmount = Number(createInventoryReceiptDto.paid_amount) || 0;
      const totalAmount = Number(createInventoryReceiptDto.total_amount);
      const returnedAmount = Number(receiptData.returned_amount) || 0;
      
      // ===== VALIDATION: KHÔNG CHO PHÉP THANH TOÁN KHI TẠO PHIẾU NHÁP =====
      if (createInventoryReceiptDto.status === ReceiptStatus.DRAFT && paidAmount > 0) {
        throw new BadRequestException(
          'Không thể thanh toán cho phiếu nhập ở trạng thái nháp. Vui lòng duyệt phiếu trước khi thanh toán.'
        );
      }
      
      // ===== VALIDATION THANH TOÁN - CHỈ ÁP DỤNG KHI KHÔNG PHẢI PHIẾU NHÁP =====
      if (createInventoryReceiptDto.status !== ReceiptStatus.DRAFT) {
        // 1. Nếu có thanh toán, phải có payment_method (và không được là 'debt')
        if (paidAmount > 0) {
          if (!createInventoryReceiptDto.payment_method) {
            throw new BadRequestException(
              'Khi có thanh toán, phải chọn phương thức thanh toán (cash hoặc transfer)'
            );
          }
          if (createInventoryReceiptDto.payment_method === 'debt') {
            throw new BadRequestException(
              'Không thể chọn phương thức "Công nợ" khi đã có thanh toán'
            );
          }
        }
      }
      
      // Tính giá trị thực tế sau khi trừ trả hàng
      const finalAmount = totalAmount - returnedAmount;
      
      // Tính số tiền thực sự nợ NCC
      // LUÔN LUÔN loại trừ phí vận chuyển (cả chung và riêng) khỏi công nợ NCC
      // Phí vận chuyển do người dùng tự chịu, không liên quan đến nhà cung cấp
      const excludedShipping = 
        (Number(createInventoryReceiptDto.shared_shipping_cost) || 0) +
        createInventoryReceiptDto.items.reduce((sum, item) => sum + (Number(item.individual_shipping_cost) || 0), 0);
      
      const supplierAmount = finalAmount - excludedShipping;
      
      // VALIDATION: Nếu còn nợ NCC, phải có hạn thanh toán
      // So sánh với supplierAmount (chỉ tiền hàng), KHÔNG phải totalAmount (bao gồm phí ship)
      if (paidAmount < supplierAmount && !createInventoryReceiptDto.payment_due_date) {
        throw new BadRequestException(
          'Khi còn nợ, phải có hạn thanh toán'
        );
      }
      
      const debtAmount = supplierAmount - paidAmount;
      
      let paymentStatus = 'unpaid';
      if (paidAmount >= supplierAmount) {
        paymentStatus = 'paid';
      } else if (paidAmount > 0) {
        paymentStatus = 'partial';
      }
      
      // Thêm các trường thanh toán vào receiptData
      // Nếu là phiếu nháp, reset tất cả về giá trị mặc định
      if (createInventoryReceiptDto.status === ReceiptStatus.DRAFT) {
        receiptData.paid_amount = 0;
        receiptData.payment_status = 'unpaid';
        receiptData.final_amount = finalAmount;
        receiptData.supplier_amount = supplierAmount;
        receiptData.debt_amount = supplierAmount; // Toàn bộ là nợ NCC
        receiptData.payment_method = null;
        receiptData.payment_due_date = null;
      } else {
        // Phiếu đã duyệt, lưu thông tin thanh toán bình thường
        receiptData.paid_amount = paidAmount;
        receiptData.payment_status = paymentStatus;
        receiptData.final_amount = finalAmount;
        receiptData.supplier_amount = supplierAmount;
        receiptData.debt_amount = debtAmount;
        
        // Nếu tạo phiếu với trạng thái APPROVED, cần set luôn ngày duyệt và người duyệt
        if (createInventoryReceiptDto.status === ReceiptStatus.APPROVED) {
          receiptData.approved_at = new Date();
          receiptData.approved_by = userId;
        }
        
        if (createInventoryReceiptDto.payment_method) {
          receiptData.payment_method = createInventoryReceiptDto.payment_method;
        }
        
        if (createInventoryReceiptDto.payment_due_date) {
          receiptData.payment_due_date = createInventoryReceiptDto.payment_due_date;
        }
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
           batch_number: item.batch_number,
            unit_name: item.unit_name,
         };

        // Only add notes if it's not undefined
        if (item.notes !== undefined) {
          itemData.notes = item.notes;
        }

        // Thêm expiry_date nếu có
        if (item.expiry_date) {
          itemData.expiry_date = item.expiry_date;
        }

        // Thêm manufacturing_date nếu có
        if (item.manufacturing_date) {
          itemData.manufacturing_date = item.manufacturing_date;
        }

        const itemEntity = queryRunner.manager.create(InventoryReceiptItem, itemData);
        const savedItem = await queryRunner.manager.save(itemEntity);
        savedItems.push(savedItem);
      } // Kết thúc vòng lặp itemsWithShipping

      // Nếu tạo phiếu với trạng thái đã duyệt, thực hiện nhập kho ngay TRONG CÙNG TRANSACTION
      if (receiptData.status === ReceiptStatus.APPROVED) {
        try {
          this.logger.log(`Phiếu ${receiptEntity.code} được tạo với trạng thái APPROVED, đang xử lý nhập kho...`);
          
          let itemIndex = 1;
          for (const item of savedItems) {
            const batch = await this.processStockIn(
              item.product_id,
              item.quantity,
              Number(item.final_unit_cost || item.unit_cost),
              userId,
              item.id,
              `LOT-${receiptEntity.code.replace('REC-', '')}-${itemIndex}`,
              item.expiry_date ? new Date(item.expiry_date) : undefined, // Truyền expiry_date
              queryRunner // Sử dụng cùng queryRunner
            );

            // Cập nhật số lô ngược lại chi tiết phiếu nhập
            if (batch && batch.batch && batch.batch.code) {
                await queryRunner.manager.update(InventoryReceiptItem, item.id, {
                    batch_number: batch.batch.code as string
                });
            }
            itemIndex++;
          }
          
          // Cập nhật thời gian duyệt
          await queryRunner.manager.update(InventoryReceipt, receiptEntity.id, {
             approved_at: new Date(),
             approved_by: userId
          });
        } catch (error) {
           this.logger.error(`Lỗi nhập kho tự động cho phiếu ${receiptEntity.code}:`, error);
           // Throw error để rollback toàn bộ transaction
           throw new BadRequestException(`Lỗi nhập kho: ${error instanceof Error ? error.message : 'Unknown'}. Giao dịch đã được hủy bỏ hoàn toàn.`);
        }
      }


      // ===== TẠO PAYMENT RECORD NẾU CÓ THANH TOÁN NGAY =====
      // Tạo payment record để lưu lịch sử thanh toán (audit trail)
      // KHÔNG dùng addPayment() vì nó sẽ cộng thêm vào paid_amount (đã set ở trên rồi)
      if (paidAmount > 0) {
        try {
          this.logger.log(`Tạo payment record cho phiếu ${receiptEntity.code}: ${paidAmount}đ`);
          
          const paymentRepo = queryRunner.manager.getRepository(InventoryReceiptPayment);
          const paymentRecord = paymentRepo.create({
            receipt_id: receiptEntity.id,
            amount: paidAmount,
            payment_method: createInventoryReceiptDto.payment_method || 'cash',
            payment_date: new Date(),
            notes: 'Thanh toán khi tạo phiếu',
            created_by: userId,
          });
          
          await paymentRepo.save(paymentRecord);
          this.logger.log(`✅ Đã tạo payment record #${paymentRecord.id}`);
        } catch (error) {
          this.logger.error(`Lỗi tạo payment record cho phiếu ${receiptEntity.code}:`, error);
          throw new BadRequestException(`Lỗi tạo payment record: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
      
      await queryRunner.commitTransaction();

      return this.inventoryReceiptRepository.findOne({
        where: { id: receiptEntity.id },
        relations: ['supplier'], // Bao gồm thông tin nhà cung cấp
      });


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
    const receipt = await this.inventoryReceiptRepository.findOne({
      where: { id },
      relations: [
        'items', 
        'items.product', 
        'supplier', 
        'creator', 
        'creator.user_profile',
        'approver',
        'approver.user_profile'
      ],
    });

    if (receipt) {
      if (receipt.creator) {
        (receipt.creator as any).full_name = receipt.creator.user_profile?.nickname || receipt.creator.account;
      }
      if (receipt.approver) {
        (receipt.approver as any).full_name = receipt.approver.user_profile?.nickname || receipt.approver.account;
      }
    }

    return receipt;
  }

  /**
   * Lấy lịch sử giao dịch kho liên quan đến một phiếu nhập
   * @param receiptId - ID của phiếu nhập kho
   * @returns Danh sách các giao dịch kho liên quan
   */
  async findTransactionsByReceipt(receiptId: number) {
    // 1. Tìm tất cả các item trong phiếu nhập này
    const receiptItems = await this.inventoryReceiptItemRepository.find({
      where: { receipt_id: receiptId },
      select: ['id'],
    });

    const itemIds = receiptItems.map((item) => item.id);

    if (itemIds.length === 0) {
      return [];
    }

    // 2. Tìm tất cả các giao dịch kho liên quan đến những item này
    const transactions = await this.inventoryTransactionRepository.find({
      where: { receipt_item_id: In(itemIds) },
      relations: ['product', 'creator', 'creator.user_profile'],
      order: { created_at: 'DESC' },
    });

    // Map full_name cho creator
    transactions.forEach(t => {
      if (t.creator) {
        (t.creator as any).full_name = t.creator.user_profile?.nickname || t.creator.account;
      }
    });

    return transactions;
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
        supplier_id: 'receipt.supplier_id',
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
   * Lấy thống kê cho phiếu nhập hàng
   * @param supplier_id - ID nhà cung cấp (tùy chọn). Nếu có, chỉ thống kê phiếu của NCC đó
   */
  async getReceiptStats(supplier_id?: number) {
    const queryBuilder = this.inventoryReceiptRepository.createQueryBuilder('receipt');
    
    // Lọc theo nhà cung cấp nếu có
    if (supplier_id) {
      queryBuilder.where('receipt.supplier_id = :supplier_id', { supplier_id });
    }
    
    // Nhóm các mã trạng thái để tương thích với dữ liệu thực tế trong DB
    const draftStatuses = "'draft', '1'";
    const approvedStatuses = "'approved', '2', '3', 'completed', '4'";
    const cancelledStatuses = "'cancelled', '5'";

    const stats = await queryBuilder
      .select('COUNT(*)', 'totalReceipts')
      .addSelect(`SUM(CASE WHEN receipt.status IN (${draftStatuses}) THEN 1 ELSE 0 END)`, 'draftReceipts')
      .addSelect(`SUM(CASE WHEN receipt.status IN (${approvedStatuses}) THEN 1 ELSE 0 END)`, 'approvedReceipts')
      .addSelect(`SUM(CASE WHEN receipt.status IN (${cancelledStatuses}) THEN 1 ELSE 0 END)`, 'cancelledReceipts')
      
      // ===== THỐNG KÊ TÀI CHÍNH: CHỈ TÍNH PHIẾU ĐÃ DUYỆT (BUSINESS LOGIC CHUẨN) =====
      // Đếm phiếu còn nợ: Chỉ tính các phiếu ĐÃ DUYỆT có debt_amount > 0
      .addSelect(`SUM(CASE WHEN receipt.status IN (${approvedStatuses}) AND CAST(receipt.debt_amount AS DECIMAL) > 0 THEN 1 ELSE 0 END)`, 'debtReceiptsCount')
      // Tổng giá trị: Chỉ tính tiền của các phiếu ĐÃ DUYỆT
      .addSelect(`SUM(CASE WHEN receipt.status IN (${approvedStatuses}) THEN CAST(receipt.total_amount AS DECIMAL) ELSE 0 END)`, 'totalValue')
      // Đã thanh toán & Còn nợ: Chỉ tính tiền của các phiếu ĐÃ DUYỆT
      .addSelect(`SUM(CASE WHEN receipt.status IN (${approvedStatuses}) THEN CAST(receipt.paid_amount AS DECIMAL) ELSE 0 END)`, 'totalPaid')
      .addSelect(`SUM(CASE WHEN receipt.status IN (${approvedStatuses}) THEN CAST(receipt.debt_amount AS DECIMAL) ELSE 0 END)`, 'totalDebt')
      .getRawOne();

    return {
      totalReceipts: parseInt(stats.totalReceipts || '0'),
      draftReceipts: parseInt(stats.draftReceipts || '0'),
      approvedReceipts: parseInt(stats.approvedReceipts || '0'),
      cancelledReceipts: parseInt(stats.cancelledReceipts || '0'),
      debtReceiptsCount: parseInt(stats.debtReceiptsCount || '0'),
      totalValue: stats.totalValue || '0',
      totalPaid: stats.totalPaid || '0',
      totalDebt: stats.totalDebt || '0',
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
    if (updateData.images !== undefined)
      entityUpdateData.images = updateData.images;
    if (updateData.shared_shipping_cost !== undefined)
      entityUpdateData.shared_shipping_cost = updateData.shared_shipping_cost;
    if (updateData.shipping_allocation_method !== undefined)
      entityUpdateData.shipping_allocation_method = updateData.shipping_allocation_method;

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
      throw new NotFoundException('Không tìm thấy phiếu nhập kho');
    }

    // ❌ KHÔNG cho xóa nếu đã thanh toán (dù chỉ 1 phần)
    if (receipt.paid_amount && Number(receipt.paid_amount) > 0) {
      throw new BadRequestException(
        'Không thể xóa phiếu đã có giao dịch thanh toán. Vui lòng hủy phiếu và tạo phiếu điều chỉnh công nợ.'
      );
    }

    // KHÔNG cho phép xóa phiếu 'cancelled' nếu đã từng 'approved' (để giữ audit trail)
    if (receipt.status !== ReceiptStatus.DRAFT) {
      if (receipt.status === ReceiptStatus.CANCELLED) {
        // Kiểm tra xem phiếu này có approved_at không (tức là đã từng approved và tác động kho)
        if (receipt.approved_at) {
           throw new BadRequestException('Không thể xóa phiếu đã từng duyệt (đã tác động kho) và bị hủy. Dữ liệu cần được giữ lại để đối soát.');
        }
        // Nếu là cancelled nhưng chưa approved bao giờ (cancel từ draft) thì cho xóa
      } else {
        throw new BadRequestException(
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
    const queryRunner = this.inventoryReceiptRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const receipt = await queryRunner.manager.findOne(InventoryReceipt, {
        where: { id },
      });

      if (!receipt) {
        await queryRunner.release();
        return null;
      }
      
      if (receipt.status !== ReceiptStatus.DRAFT) {
         throw new BadRequestException('Chỉ có thể duyệt phiếu ở trạng thái nháp');
      }

      // Lấy danh sách chi tiết phiếu nhập thông qua queryRunner
      const items = await queryRunner.manager.find(InventoryReceiptItem, {
        where: { receipt_id: id }
      });

      // Xử lý nhập kho cho từng sản phẩm ngay khi duyệt
      let itemIndex = 1;
      for (const item of items) {
        const costPrice =
          item.final_unit_cost !== undefined && item.final_unit_cost !== null
            ? Number(item.final_unit_cost)
            : Number(item.unit_cost);

        const batch = await this.processStockIn(
          item.product_id,
          item.quantity,
          costPrice,
          userId,
          item.id,
          `LOT-${receipt.code.replace('REC-', '')}-${itemIndex}`,
          item.expiry_date ? new Date(item.expiry_date) : undefined,
          queryRunner,
          receipt.is_taxable
        );

        // Cập nhật số lô ngược lại chi tiết phiếu nhập
        if (batch && batch.batch && batch.batch.code) {
          await queryRunner.manager.update(InventoryReceiptItem, item.id, {
            batch_number: batch.batch.code as string
          });
        }
        itemIndex++;
      }

      receipt.status = ReceiptStatus.APPROVED;
      receipt.approved_at = new Date();
      receipt.approved_by = userId;
      
      const savedReceipt = await queryRunner.manager.save(receipt);
      await queryRunner.commitTransaction();
      return savedReceipt;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `❌ Lỗi khi duyệt phiếu nhập kho #${id}:`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    const queryRunner = this.inventoryReceiptRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const receipt = await queryRunner.manager.findOne(InventoryReceipt, {
        where: { id },
      });

      if (!receipt) {
        await queryRunner.release();
        throw new NotFoundException('Không tìm thấy phiếu nhập kho');
      }
      
      // Validate: Không cho phép cancel phiếu đã cancelled
      if (receipt.status === ReceiptStatus.CANCELLED) {
          throw new BadRequestException('Phiếu nhập kho đã bị hủy trước đó');
      }
      
      // Nếu phiếu đã duyệt (APPROVED) → Cần rollback inventory
      if (receipt.status === ReceiptStatus.APPROVED) {
          await this.rollbackReceiptInventory(id, userId, reason, queryRunner);
      }
      
      receipt.status = ReceiptStatus.CANCELLED;
      receipt.cancelled_at = new Date();
      receipt.cancelled_reason = reason;
      
      const savedReceipt = await queryRunner.manager.save(receipt);
      await queryRunner.commitTransaction();
      return savedReceipt;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hủy phiếu nhập kho #${id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    reason: string,
    queryRunner?: QueryRunner
  ) {
    this.logger.log(`Bắt đầu rollback inventory cho receipt #${receiptId}`);
    const items = queryRunner 
      ? await queryRunner.manager.find(InventoryReceiptItem, { where: { receipt_id: receiptId } })
      : await this.getReceiptItems(receiptId);
    
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
          `Hủy phiếu nhập #${receiptId} (Sản phẩm ${item.product_id}): ${reason}`,
          queryRunner
        );
        
        // Tính lại giá vốn trung bình
        await this.recalculateWeightedAverageCost(item.product_id, queryRunner);
      } catch (error) {
         this.logger.error(
          `Lỗi khi rollback inventory cho sản phẩm ${item.product_id} trong receipt #${receiptId}:`,
          error
        );
        // Trong trường hợp rollback lỗi, ta vẫn ném lỗi ra để ngừng quá trình cancel
        // Để admin có thể xử lý thủ công hoặc thử lại
        throw new BadRequestException(
          `Không thể hủy phiếu nhập kho: ${error instanceof Error ? error.message : 'Lỗi khi hoàn tác tồn kho'}`
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

      // Thêm images nếu có
      if (createInventoryReturnDto.images && createInventoryReturnDto.images.length > 0) {
        returnData.images = createInventoryReturnDto.images;
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

      // ===== CẬP NHẬT PHIẾU NHẬP GỐC NẾU CÓ =====
      if (createInventoryReturnDto.receipt_id) {
        const receipt = await queryRunner.manager.findOne(InventoryReceipt, {
          where: { id: createInventoryReturnDto.receipt_id },
        });
        
        if (receipt) {
          const newReturnedAmount = Number(receipt.returned_amount || 0) + Number(createInventoryReturnDto.total_amount);
          const totalAmount = Number(receipt.total_amount);
          const adjustedAmount = Number(receipt.adjusted_amount || 0);
          const newFinalAmount = totalAmount + adjustedAmount - newReturnedAmount;
          
          // Cập nhật supplier_amount (giảm trừ theo giá trị hàng trả)
          const currentSupplierAmount = Number(receipt.supplier_amount) || Number(receipt.final_amount) || totalAmount;
          const newSupplierAmount = currentSupplierAmount - Number(createInventoryReturnDto.total_amount);
          
          const paidAmount = Number(receipt.paid_amount || 0);
          const newDebtAmount = newSupplierAmount - paidAmount;
          
          await queryRunner.manager.update(InventoryReceipt, createInventoryReturnDto.receipt_id, {
            returned_amount: newReturnedAmount,
            final_amount: newFinalAmount,
            supplier_amount: newSupplierAmount,
            debt_amount: newDebtAmount,
            has_returns: true,
          });
          
          this.logger.log(`Đã cập nhật phiếu nhập #${createInventoryReturnDto.receipt_id}: returned_amount=${newReturnedAmount}, final_amount=${newFinalAmount}, debt_amount=${newDebtAmount}`);
        }
      }
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
    if (updateDto.images !== undefined) updateData.images = updateDto.images;

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
  async findReturnById(id: number, queryRunner?: QueryRunner): Promise<InventoryReturn | null> {
    const repo = queryRunner ? queryRunner.manager.getRepository(InventoryReturn) : this.inventoryReturnRepository;
    const returnDoc = await repo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'supplier'],
    });

    if (!returnDoc) {
      return null;
    }


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
    const queryRunner = this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnDoc = await queryRunner.manager.findOne(InventoryReturn, {
        where: { id },
      });

      if (!returnDoc) {
        await queryRunner.release();
        return null;
      }

      if (returnDoc.status === ReturnStatus.APPROVED) {
        await queryRunner.release();
        return returnDoc;
      }

      if (returnDoc.status === ReturnStatus.CANCELLED) {
        throw new BadRequestException('Không thể duyệt phiếu đã bị hủy');
      }

      // Lấy danh sách chi tiết phiếu xuất trả thông qua queryRunner
      const items = await queryRunner.manager.find(InventoryReturnItem, {
        where: { return_id: id }
      });

      // Xử lý xuất kho cho từng sản phẩm
      for (const item of items) {
        await this.processStockOut(
          item.product_id,
          item.quantity,
          'RETURN',
          userId,
          id,
          `Trả hàng cho nhà cung cấp - Phiếu ${returnDoc.code}`,
          queryRunner,
        );
      }

      returnDoc.status = ReturnStatus.APPROVED;
      returnDoc.approved_at = new Date();
      returnDoc.approved_by = userId;
      
      const savedReturn = await queryRunner.manager.save(returnDoc);
      await queryRunner.commitTransaction();
      return savedReturn;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi duyệt phiếu trả hàng #${id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    userId: number,
  ): Promise<InventoryReturn | null> {
    const queryRunner = this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnDoc = await queryRunner.manager.findOne(InventoryReturn, {
        where: { id },
      });

      if (!returnDoc) {
        await queryRunner.release();
        return null;
      }

      // Nếu phiếu đã duyệt, cần hoàn tồn kho (nhập lại hàng đã trả)
      if (returnDoc.status === ReturnStatus.APPROVED) {
        this.logger.log(`Phiếu trả hàng ${id} đã duyệt, đang hoàn tồn kho trước khi hủy...`);
        
        const items = await queryRunner.manager.find(InventoryReturnItem, {
          where: { return_id: id }
        });

        for (const item of items) {
          // Hoàn kho = Stock In
          await this.processStockIn(
            item.product_id,
            item.quantity,
            Number(item.unit_cost),
            userId,
            undefined,
            `Hủy phiếu trả hàng - ${returnDoc.code}`,
            undefined,
            queryRunner
          );
        }
      }

      returnDoc.status = ReturnStatus.CANCELLED;
      returnDoc.cancelled_at = new Date();
      returnDoc.cancelled_reason = reason;
      
      const savedReturn = await queryRunner.manager.save(returnDoc);
      await queryRunner.commitTransaction();
      return savedReturn;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hủy phiếu trả hàng #${id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
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

      // Thêm images nếu có
      if (createInventoryAdjustmentDto.images && createInventoryAdjustmentDto.images.length > 0) {
        adjustmentData.images = createInventoryAdjustmentDto.images;
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
      
      // Nếu tạo phiếu với trạng thái 'approved', tự động cập nhật tồn kho (TRONG transaction)
      if (createInventoryAdjustmentDto.status === AdjustmentStatus.APPROVED) {
        this.logger.log(`Phiếu ${adjustmentEntity.id} được tạo với trạng thái approved, đang cập nhật tồn kho...`);
        
        for (const item of createInventoryAdjustmentDto.items) {
          const quantityChange = item.quantity_change;
          
          if (quantityChange > 0) {
            // Tăng tồn kho
            const currentAverageCost = await this.getWeightedAverageCost(item.product_id, queryRunner);
            await this.processStockIn(
              item.product_id,
              quantityChange,
              currentAverageCost,
              userId,
              undefined,
              `Điều chỉnh tăng kho - Phiếu ${adjustmentData.code}`,
              undefined,
              queryRunner
            );
          } else if (quantityChange < 0) {
            // Giảm tồn kho
            await this.processStockOut(
              item.product_id,
              Math.abs(quantityChange),
              'ADJUSTMENT',
              userId,
              adjustmentEntity.id,
              `Điều chỉnh giảm kho - Phiếu ${adjustmentData.code}`,
              queryRunner
            );
          }
        }
        
        // Cập nhật approved_at
        adjustmentEntity.approved_at = new Date();
        adjustmentEntity.approved_by = userId;
        await queryRunner.manager.save(adjustmentEntity);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Đã commit transaction cho phiếu điều chỉnh ${adjustmentEntity.id}`);

      return queryRunner.manager.findOne(InventoryAdjustment, {
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
      
      // Debug log
      this.logger.log(`📸 Update images: ${JSON.stringify(updateDto.images)}`);
      if (updateDto.images !== undefined) updateData.images = updateDto.images; // Cập nhật images

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
  async findAdjustmentById(id: number, queryRunner?: QueryRunner): Promise<any> {
    const repo = queryRunner ? queryRunner.manager.getRepository(InventoryAdjustment) : this.inventoryAdjustmentRepository;
    const adjustment = await repo.findOne({
      where: { id },
      relations: ['items', 'items.product'], // Populate cả thông tin sản phẩm
    });

    return adjustment;
  }

  /**
   * Tìm kiếm nâng cao phiếu điều chỉnh kho
   */
  async searchAdjustments(searchDto: SearchInventoryDto): Promise<{
    data: any[];
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

    const [adjustments, total] = await queryBuilder.getManyAndCount();

    // 3. Populate images cho từng adjustment
    const dataWithImages = await Promise.all(
      adjustments.map(async (adjustment) => {
        const fileReferences = await this.fileTrackingService.findFileReferencesByEntity(
          'inventory_adjustment',
          adjustment.id,
        );
        
        const images = fileReferences.map(ref => ({
          id: ref.fileUpload.id,
          url: ref.fileUpload.url,
          name: ref.fileUpload.name,
          type: ref.fileUpload.mime_type,
          size: ref.fileUpload.size,
          created_at: ref.created_at
        }));

        return { ...adjustment, images };
      })
    );

    return {
      data: dataWithImages,
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
    const queryRunner = this.inventoryAdjustmentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const adjustment = await queryRunner.manager.findOne(InventoryAdjustment, {
        where: { id },
      });

      if (!adjustment) {
        await queryRunner.release();
        return null;
      }

      if (adjustment.status === AdjustmentStatus.APPROVED) {
        await queryRunner.release();
        return adjustment;
      }

      if (adjustment.status === AdjustmentStatus.CANCELLED) {
        throw new BadRequestException('Không thể duyệt phiếu đã bị hủy');
      }

      // Lấy danh sách chi tiết phiếu điều chỉnh qua queryRunner
      const items = await queryRunner.manager.find(InventoryAdjustmentItem, {
        where: { adjustment_id: id }
      });

      // Xử lý điều chỉnh kho cho từng sản phẩm
      for (const item of items) {
        const quantityChange = item.quantity_change;

        if (quantityChange > 0) {
          // Tăng tồn kho
          const currentAverageCost = await this.getWeightedAverageCost(
            item.product_id,
          );
          await this.processStockIn(
            item.product_id,
            quantityChange,
            currentAverageCost,
            userId,
            undefined,
            `Điều chỉnh tăng kho - Phiếu ${adjustment.code}`,
            undefined,
            queryRunner
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
            queryRunner
          );
        }
      }

      adjustment.status = AdjustmentStatus.APPROVED;
      adjustment.approved_at = new Date();
      adjustment.approved_by = userId;
      
      const savedAdjustment = await queryRunner.manager.save(adjustment);
      await queryRunner.commitTransaction();
      return savedAdjustment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi duyệt phiếu điều chỉnh kho #${id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }



  /**
   * Hủy phiếu điều chỉnh kho
   * @param id - ID của phiếu điều chỉnh kho cần hủy
   * @param reason - Lý do hủy phiếu điều chỉnh kho
   * @param userId - ID người hủy
   * @returns Thông tin phiếu điều chỉnh kho đã hủy
   */
  async cancelAdjustment(
    id: number,
    reason: string,
    userId: number,
  ): Promise<InventoryAdjustment | null> {
    const queryRunner = this.inventoryAdjustmentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const adjustment = await queryRunner.manager.findOne(InventoryAdjustment, {
        where: { id },
      });

      if (!adjustment) {
        await queryRunner.release();
        return null;
      }

      // Nếu phiếu đã duyệt, cần hoàn tồn kho (reverse lại thao tác)
      if (adjustment.status === AdjustmentStatus.APPROVED) {
        this.logger.log(`Phiếu ${id} đã duyệt, đang hoàn tồn kho trước khi hủy...`);
        
        const items = await queryRunner.manager.find(InventoryAdjustmentItem, {
          where: { adjustment_id: id }
        });

        for (const item of items) {
          const quantityChange = item.quantity_change;
          
          if (quantityChange > 0) {
            // Phiếu tăng kho → Hủy = Giảm kho
            await this.processStockOut(
              item.product_id,
              quantityChange,
              'ADJUSTMENT_CANCEL',
              userId,
              id,
              `Hủy phiếu điều chỉnh tăng kho - ${adjustment.code}`,
              queryRunner
            );
          } else if (quantityChange < 0) {
            // Phiếu giảm kho → Hủy = Tăng kho
            const currentAverageCost = await this.getWeightedAverageCost(item.product_id);
            await this.processStockIn(
              item.product_id,
              Math.abs(quantityChange),
              currentAverageCost,
              userId,
              undefined,
              `Hủy phiếu điều chỉnh giảm kho - ${adjustment.code}`,
              undefined,
              queryRunner
            );
          }
        }
      }

      adjustment.status = AdjustmentStatus.CANCELLED;
      adjustment.cancelled_at = new Date();
      adjustment.cancelled_reason = reason;
      
      const savedAdjustment = await queryRunner.manager.save(adjustment);
      await queryRunner.commitTransaction();
      return savedAdjustment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hủy phiếu điều chỉnh kho #${id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
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

  // ===== PAYMENT MANAGEMENT METHODS =====

  /**
   * Thêm thanh toán cho phiếu nhập kho
   * @param receiptId - ID phiếu nhập kho
   * @param paymentDto - Dữ liệu thanh toán
   * @param userId - ID người tạo
   * @param queryRunner - QueryRunner (tùy chọn, dùng khi trong transaction)
   * @returns Thông tin thanh toán đã tạo
   */
  async addPayment(
    receiptId: number,
    paymentDto: any,
    userId: number,
    queryRunner?: QueryRunner
  ) {
    // Tìm phiếu nhập kho - dùng queryRunner.manager nếu có để tránh lỗi trong transaction
    const receipt = queryRunner
      ? await queryRunner.manager.findOne(InventoryReceipt, {
          where: { id: receiptId },
        })
      : await this.inventoryReceiptRepository.findOne({
          where: { id: receiptId },
        });

    if (!receipt) {
    throw new NotFoundException('Không tìm thấy phiếu nhập kho');
  }
  
  // Kiểm tra trạng thái phiếu - chỉ cho phép thanh toán phiếu đã duyệt
  if (receipt.status !== 'approved') {
    throw new BadRequestException(
      'Chỉ có thể thanh toán cho phiếu đã duyệt'
    );
  }
  
  // Validation
    if (receipt.is_payment_locked) {
      throw new BadRequestException('Payment đã bị khóa, không thể thêm thanh toán');
    }
    
    if (receipt.has_returns || receipt.has_adjustments) {
      throw new BadRequestException(
        'Phiếu đã có trả hàng hoặc điều chỉnh. Vui lòng xử lý qua phiếu liên quan.'
      );
    }
    
    const currentPaidAmount = Number(receipt.paid_amount) || 0;
    const finalAmount = Number(receipt.supplier_amount) || Number(receipt.final_amount) || Number(receipt.total_amount);
    const newPaidAmount = currentPaidAmount + Number(paymentDto.amount);
    
    if (newPaidAmount > finalAmount) {
      throw new BadRequestException(
        `Số tiền thanh toán vượt quá số tiền còn nợ (${receipt.debt_amount || finalAmount - currentPaidAmount}đ)`
      );
    }
    
    // Tạo record payment
    const repo = queryRunner ? queryRunner.manager.getRepository(InventoryReceiptPayment) : this.receiptPaymentRepository;
    const paymentData: any = {
      receipt_id: receiptId,
      amount: paymentDto.amount,
      payment_method: paymentDto.payment_method,
      payment_date: paymentDto.payment_date || new Date(),
      created_by: userId,
    };
    
    if (paymentDto.notes) {
      paymentData.notes = paymentDto.notes;
    }
    
    const payment = repo.create(paymentData);
    
    const savedPayment = await repo.save(payment);
    
    // Cập nhật phiếu nhập
    const newDebtAmount = finalAmount - newPaidAmount;
    let newPaymentStatus = 'partial';
    
    if (newDebtAmount === 0) {
      newPaymentStatus = 'paid';
    } else if (newPaidAmount === 0) {
      newPaymentStatus = 'unpaid';
    }
    
    const receiptRepo = queryRunner ? queryRunner.manager.getRepository(InventoryReceipt) : this.inventoryReceiptRepository;
    await receiptRepo.update(receiptId, {
      paid_amount: newPaidAmount,
      debt_amount: newDebtAmount,
      payment_status: newPaymentStatus,
    });
    
    this.logger.log(`Đã thêm thanh toán ${paymentDto.amount}đ cho phiếu nhập #${receiptId}`);
    return savedPayment;
  }

  /**
   * Lấy danh sách thanh toán của phiếu nhập kho
   * @param receiptId - ID phiếu nhập kho
   * @returns Danh sách thanh toán
   */
  async getPayments(receiptId: number) {
    return this.receiptPaymentRepository.find({
      where: { receipt_id: receiptId },
      relations: ['creator'],
      order: { payment_date: 'DESC' },
    });
  }

  /**
   * Lấy danh sách phiếu trả hàng liên quan đến phiếu nhập kho
   * @param receiptId - ID phiếu nhập kho
   * @returns Danh sách phiếu trả hàng
   */
  async getReceiptReturns(receiptId: number) {
    const returns = await this.inventoryReturnRepository.find({
      where: { receipt_id: receiptId },
      order: { created_at: 'DESC' },
    });

    return returns.map((r) => ({
      id: r.id,
      code: r.code,
      total_amount: r.total_amount,
      created_at: r.created_at,
      status: r.status,
    }));
  }

  /**
   * Xóa thanh toán (soft delete)
   * @param receiptId - ID phiếu nhập kho
   * @param paymentId - ID thanh toán
   * @param userId - ID người xóa
   */
  async deletePayment(receiptId: number, paymentId: number) {
    const payment = await this.receiptPaymentRepository.findOne({
      where: { id: paymentId, receipt_id: receiptId },
    });
    
    if (!payment) {
      throw new NotFoundException('Không tìm thấy thanh toán');
    }
    
    const receipt = await this.findReceiptById(receiptId);
    
    if (!receipt) {
      throw new NotFoundException('Không tìm thấy phiếu nhập kho');
    }
    
    if (receipt.is_payment_locked) {
      throw new BadRequestException('Payment đã bị khóa, không thể xóa');
    }
    
    // Soft delete
    await this.receiptPaymentRepository.softDelete(paymentId);
    
    // Cập nhật lại phiếu nhập
    const newPaidAmount = Number(receipt.paid_amount) - Number(payment.amount);
    const finalAmount = Number(receipt.final_amount) || Number(receipt.total_amount);
    const newDebtAmount = finalAmount - newPaidAmount;
    
    let newPaymentStatus = 'partial';
    if (newDebtAmount === finalAmount) {
      newPaymentStatus = 'unpaid';
    } else if (newDebtAmount === 0) {
      newPaymentStatus = 'paid';
    }
    
    await this.inventoryReceiptRepository.update(receiptId, {
      paid_amount: newPaidAmount,
      debt_amount: newDebtAmount,
      payment_status: newPaymentStatus,
    });
    
    this.logger.log(`Đã xóa thanh toán #${paymentId} của phiếu nhập #${receiptId}`);
  }

  /**
   * Thêm hoàn tiền cho phiếu trả hàng
   * @param returnId - ID phiếu trả hàng
   * @param refundDto - Dữ liệu hoàn tiền
   * @param userId - ID người tạo
   * @returns Thông tin hoàn tiền đã tạo
   */
  async addRefund(
    returnId: number,
    refundDto: CreateRefundDto,
    userId: number
  ) {
    const returnDoc = await this.findReturnById(returnId);
    
    if (!returnDoc) {
      throw new NotFoundException('Không tìm thấy phiếu trả hàng');
    }
    
    const currentRefundAmount = Number(returnDoc.refund_amount) || 0;
    const totalAmount = Number(returnDoc.total_amount);
    const newRefundAmount = currentRefundAmount + Number(refundDto.amount);
    
    if (newRefundAmount > totalAmount) {
      throw new BadRequestException(
        `Số tiền hoàn vượt quá giá trị phiếu trả (${totalAmount - currentRefundAmount}đ)`
      );
    }
    
    // Tạo record refund
    const refundData: any = {
      return_id: returnId,
      amount: refundDto.amount,
      refund_method: refundDto.refund_method,
      refund_date: refundDto.refund_date || new Date(),
      created_by: userId,
    };
    
    if (refundDto.notes) {
      refundData.notes = refundDto.notes;
    }
    
    const refund = this.returnRefundRepository.create(refundData);
    
    const savedRefund = await this.returnRefundRepository.save(refund);
    
    // Cập nhật phiếu trả
    let newRefundStatus = 'partial';
    if (newRefundAmount >= totalAmount) {
      newRefundStatus = 'refunded';
    } else if (newRefundAmount === 0) {
      newRefundStatus = 'pending';
    }
    
    await this.inventoryReturnRepository.update(returnId, {
      refund_amount: newRefundAmount,
      refund_status: newRefundStatus,
    });
    
    this.logger.log(`Đã thêm hoàn tiền ${refundDto.amount}đ cho phiếu trả #${returnId}`);
    return savedRefund;
  }

  /**
   * Lấy danh sách hoàn tiền của phiếu trả hàng
   * @param returnId - ID phiếu trả hàng
   * @returns Danh sách hoàn tiền
   */
  async getRefunds(returnId: number) {
    return this.returnRefundRepository.find({
      where: { return_id: returnId },
      relations: ['creator'],
      order: { refund_date: 'DESC' },
    });
  }

  /**
   * Đồng bộ dữ liệu tồn kho thuế từ hệ thống cũ (boolean has_input_invoice) 
   * sang hệ thống mới (taxable_quantity_stock / taxable_quantity)
   */
  async syncTaxableData(): Promise<{ productsUpdated: number; salesItemsUpdated: number }> {
    this.logger.log('🚀 Bắt đầu chi tiết đồng bộ dữ liệu tồn kho thuế...');
    
    // 1. Đồng bộ Sản phẩm
    const products = await this.productService.findAllIncludingInactive();
    let productsUpdated = 0;
    
    for (const product of products) {
      if (product.has_input_invoice) {
        // Nếu có hóa đơn, gán bể thuế = tồn kho hiện tại
        await this.productService.update(product.id, {
          taxable_quantity_stock: Number(product.quantity || 0)
        });
        productsUpdated++;
      } else if (Number(product.taxable_quantity_stock) > 0) {
        // Nếu không có hóa đơn nhưng bể thuế đang > 0, reset về 0
        await this.productService.update(product.id, {
          taxable_quantity_stock: 0
        });
        productsUpdated++;
      }
    }
    
    // 2. Đồng bộ Sales Items
    const salesInvoiceItemRepo = this.inventoryReceiptRepository.manager.getRepository(SalesInvoiceItem);
    
    // Bước 2.1: Cập nhật taxable_quantity = quantity cho các sản phẩm CÓ hóa đơn mà taxable_quantity đang là 0
    const itemsToSetTaxable = await salesInvoiceItemRepo.createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .where('product.has_input_invoice = :hasInvoice', { hasInvoice: true })
      .andWhere('item.taxable_quantity = 0')
      .getMany();
      
    let salesItemsUpdated = 0;
    for (const item of itemsToSetTaxable) {
      await salesInvoiceItemRepo.update(item.id, {
        taxable_quantity: item.quantity
      });
      salesItemsUpdated++;
    }

    // Bước 2.2: Reset taxable_quantity = 0 cho các sản phẩm KHÔNG CÓ hóa đơn mà taxable_quantity đang > 0
    const itemsToResetTaxable = await salesInvoiceItemRepo.createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .where('product.has_input_invoice = :hasInvoice', { hasInvoice: false })
      .andWhere('item.taxable_quantity > 0')
      .getMany();
      
    for (const item of itemsToResetTaxable) {
      await salesInvoiceItemRepo.update(item.id, {
        taxable_quantity: 0
      });
      salesItemsUpdated++;
    }
    
    this.logger.log(`✅ Hoàn tất đồng bộ: ${productsUpdated} sản phẩm, ${salesItemsUpdated} item hóa đơn.`);
    return { productsUpdated, salesItemsUpdated };
  }
}
