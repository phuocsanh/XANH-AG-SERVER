import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In, SelectQueryBuilder } from 'typeorm';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { CreateInventoryBatchDto } from './dto/create-inventory-batch.dto';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import {
  CreateInventoryReceiptDto,
  CreateInventoryReceiptItemDto,
} from './dto/create-inventory-receipt.dto';
import { ProductService } from '../product/product.service';
import {
  ProductGroup,
  StockData,
  LowStockProduct,
} from './interfaces/inventory-report.interface';
import { SearchInventoryDto } from './dto/search-inventory.dto';
import { FilterConditionDto } from '../supplier/dto/filter-condition.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

/**
 * Service xử lý logic nghiệp vụ liên quan đến quản lý kho hàng
 * Bao gồm quản lý lô hàng, giao dịch kho, phiếu nhập kho và các chức năng liên quan
 */
@Injectable()
export class InventoryService {
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
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService,
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
    });
  }

  /**
   * Tìm lô hàng tồn kho theo ID
   * @param id - ID của lô hàng tồn kho cần tìm
   * @returns Thông tin lô hàng tồn kho
   */
  async findBatchById(id: number): Promise<InventoryBatch | null> {
    return this.inventoryBatchRepository.findOne({ where: { id } });
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
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách lô hàng tồn kho phù hợp với thông tin phân trang
   */
  async searchBatches(searchDto: SearchInventoryDto): Promise<{
    data: InventoryBatch[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.inventoryBatchRepository.createQueryBuilder('batch');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'batch');

    // Xử lý phân trang
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    // Thực hiện truy vấn
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Xây dựng các điều kiện tìm kiếm động
   * @param queryBuilder - Query builder
   * @param searchDto - DTO tìm kiếm
   * @param alias - Alias của bảng
   * @param parameterIndex - Chỉ số để tạo parameter name duy nhất
   */
  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<InventoryBatch>,
    searchDto: SearchInventoryDto,
    alias: string,
    parameterIndex: number = 0,
  ): number {
    // Xử lý các điều kiện lọc cơ bản
    if (searchDto.filters && searchDto.filters.length > 0) {
      const operator = searchDto.operator || 'AND';
      const conditions: string[] = [];
      const parameters: { [key: string]: any } = {};

      searchDto.filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(
          filter,
          alias,
          parameterIndex + index,
          parameters,
        );
        if (condition) {
          conditions.push(condition);
        }
      });

      if (conditions.length > 0) {
        const combinedCondition = conditions.join(` ${operator} `);
        queryBuilder.andWhere(`(${combinedCondition})`, parameters);
      }

      parameterIndex += searchDto.filters.length;
    }

    // Xử lý các bộ lọc lồng nhau
    if (searchDto.nested_filters && searchDto.nested_filters.length > 0) {
      // Xây dựng điều kiện cho từng bộ lọc lồng nhau
      searchDto.nested_filters.forEach((nestedFilter) => {
        parameterIndex = this.buildSearchConditions(
          queryBuilder,
          nestedFilter,
          alias,
          parameterIndex,
        );
      });
    }

    return parameterIndex;
  }

  /**
   * Xây dựng điều kiện lọc đơn lẻ
   * @param filter - Điều kiện lọc
   * @param alias - Alias của bảng
   * @param index - Chỉ số để tạo parameter name duy nhất
   * @param parameters - Object chứa các parameter
   * @returns Chuỗi điều kiện SQL
   */
  private buildFilterCondition(
    filter: FilterConditionDto,
    alias: string,
    index: number,
    parameters: { [key: string]: any },
  ): string | null {
    if (!filter.field || !filter.operator) {
      return null;
    }

    const paramName = `param_${index}`;
    const field = `${alias}.${filter.field}`;

    switch (filter.operator) {
      case 'eq':
        parameters[paramName] = filter.value;
        return `${field} = :${paramName}`;
      case 'ne':
        parameters[paramName] = filter.value;
        return `${field} != :${paramName}`;
      case 'gt':
        parameters[paramName] = filter.value;
        return `${field} > :${paramName}`;
      case 'lt':
        parameters[paramName] = filter.value;
        return `${field} < :${paramName}`;
      case 'gte':
        parameters[paramName] = filter.value;
        return `${field} >= :${paramName}`;
      case 'lte':
        parameters[paramName] = filter.value;
        return `${field} <= :${paramName}`;
      case 'like':
        parameters[paramName] = `%${filter.value}%`;
        return `${field} LIKE :${paramName}`;
      case 'ilike':
        parameters[paramName] = `%${filter.value}%`;
        return `LOWER(${field}) LIKE LOWER(:${paramName})`;
      case 'in':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} IN (:...${paramName})`;
        }
        return null;
      case 'notin':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} NOT IN (:...${paramName})`;
        }
        return null;
      case 'isnull':
        return `${field} IS NULL`;
      case 'isnotnull':
        return `${field} IS NOT NULL`;
      default:
        return null;
    }
  }

  /**
   * Tạo giao dịch kho mới
   * @param createInventoryTransactionDto - Dữ liệu tạo giao dịch kho mới
   * @returns Thông tin giao dịch kho đã tạo
   */
  async createTransaction(
    createInventoryTransactionDto: CreateInventoryTransactionDto,
  ) {
    const transaction = this.inventoryTransactionRepository.create(
      createInventoryTransactionDto,
    );
    return this.inventoryTransactionRepository.save(transaction);
  }

  /**
   * Lấy danh sách tất cả giao dịch kho
   * @returns Danh sách giao dịch kho
   */
  async findAllTransactions() {
    return this.inventoryTransactionRepository.find();
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
   * @returns Thông tin giao dịch nhập kho và giá vốn trung bình mới
   */
  async processStockIn(
    productId: number,
    quantity: number,
    unitCostPrice: number,
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
      created_by_user_id: 1, // TODO: Lấy từ context
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

      // Cập nhật giá nhập mới nhất cho sản phẩm
      await this.productService.update(productId, {
        latest_purchase_price: unitCostPrice,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
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
   * @param referenceId - ID tham chiếu
   * @param notes - Ghi chú
   * @returns Thông tin giao dịch xuất kho
   */
  async processStockOut(
    productId: number,
    quantity: number,
    referenceType: string,
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

    // Xuất kho theo FIFO
    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const deductFromBatch = Math.min(
        remainingToDeduct,
        batch.remaining_quantity,
      );
      const batchCostValue =
        deductFromBatch * parseFloat(batch.unit_cost_price);

      // Cập nhật số lượng còn lại trong lô
      batch.remaining_quantity -= deductFromBatch;
      await this.inventoryBatchRepository.save(batch);

      totalCostValue += batchCostValue;
      remainingToDeduct -= deductFromBatch;

      affectedBatches.push({
        batchId: batch.id,
        deductedQuantity: deductFromBatch,
        unitCostPrice: parseFloat(batch.unit_cost_price),
        costValue: batchCostValue,
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
      created_by_user_id: 1, // TODO: Lấy từ context
      ...(referenceId && { reference_id: referenceId }),
    };

    const transaction = await this.createTransaction(transactionData);

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
  async createReceipt(createInventoryReceiptDto: CreateInventoryReceiptDto) {
    // Tạo phiếu nhập kho
    const receiptData: any = {
      code: createInventoryReceiptDto.receipt_code,
      supplier_id: createInventoryReceiptDto.supplier_id,
      total_amount: createInventoryReceiptDto.total_amount,
      status: createInventoryReceiptDto.status,
      created_by: createInventoryReceiptDto.created_by,
      updated_by: createInventoryReceiptDto.created_by, // Người tạo cũng là người cập nhật đầu tiên
    };

    // Only add notes if it's not undefined
    if (createInventoryReceiptDto.notes !== undefined) {
      receiptData.notes = createInventoryReceiptDto.notes;
    }

    const receipt = this.inventoryReceiptRepository.create(receiptData);
    const savedReceipt = await this.inventoryReceiptRepository.save(receipt);

    // Check if savedReceipt is an array and get the first element if so
    const receiptEntity = Array.isArray(savedReceipt)
      ? savedReceipt[0]
      : savedReceipt;

    // Ensure we have a valid receipt entity with an ID
    if (!receiptEntity || !receiptEntity.id) {
      throw new Error('Failed to save receipt');
    }

    // Tạo các item trong phiếu
    const savedItems: any[] = [];
    for (const item of createInventoryReceiptDto.items) {
      const itemData: any = {
        receipt_id: receiptEntity.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_price: item.total_price,
      };

      // Only add notes if it's not undefined
      if (item.notes !== undefined) {
        itemData.notes = item.notes;
      }

      const itemEntity = this.inventoryReceiptItemRepository.create(itemData);
      const savedItem =
        await this.inventoryReceiptItemRepository.save(itemEntity);
      savedItems.push(savedItem);
    }

    // Trả về phiếu nhập kho với thông tin nhà cung cấp
    const finalReceipt = await this.inventoryReceiptRepository.findOne({
      where: { id: receiptEntity.id },
      relations: ['supplier'], // Bao gồm thông tin nhà cung cấp
    });

    return finalReceipt;
  }

  /**
   * Lấy danh sách tất cả phiếu nhập kho
   * @returns Danh sách phiếu nhập kho
   */
  async findAllReceipts() {
    return this.inventoryReceiptRepository.find({
      order: { created_at: 'DESC' }, // Sắp xếp theo thời gian tạo giảm dần
    });
  }

  /**
   * Tìm phiếu nhập kho theo ID
   * @param id - ID của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  async findReceiptById(id: number): Promise<InventoryReceipt | null> {
    return this.inventoryReceiptRepository.findOne({
      where: { id },
      relations: ['items'], // Bao gồm cả các item trong phiếu
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
      relations: ['items'], // Bao gồm cả các item trong phiếu
    });
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
    await this.inventoryReceiptRepository.delete(id);
  }

  /**
   * Duyệt phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần duyệt
   * @returns Thông tin phiếu nhập kho đã duyệt
   */
  async approveReceipt(id: number): Promise<InventoryReceipt | null> {
    const receipt = await this.findReceiptById(id);
    if (!receipt) {
      return null;
    }
    receipt.status = 'approved'; // Cập nhật trạng thái thành đã duyệt
    receipt.approved_at = new Date(); // Ghi nhận thời gian duyệt
    return this.inventoryReceiptRepository.save(receipt);
  }

  /**
   * Hoàn thành phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hoàn thành
   * @returns Thông tin phiếu nhập kho đã hoàn thành
   */
  async completeReceipt(id: number): Promise<InventoryReceipt | null> {
    const receipt = await this.findReceiptById(id);
    if (!receipt) {
      return null;
    }
    receipt.status = 'completed'; // Cập nhật trạng thái thành đã hoàn thành
    receipt.completed_at = new Date(); // Ghi nhận thời gian hoàn thành
    return this.inventoryReceiptRepository.save(receipt);
  }

  /**
   * Hủy phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hủy
   * @param reason - Lý do hủy phiếu nhập kho
   * @returns Thông tin phiếu nhập kho đã hủy
   */
  async cancelReceipt(
    id: number,
    reason: string,
  ): Promise<InventoryReceipt | null> {
    const receipt = await this.findReceiptById(id);
    if (!receipt) {
      return null;
    }
    receipt.status = 'cancelled'; // Cập nhật trạng thái thành đã hủy
    receipt.cancelled_at = new Date(); // Ghi nhận thời gian hủy
    receipt.cancelled_reason = reason; // Ghi nhận lý do hủy
    return this.inventoryReceiptRepository.save(receipt);
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
      averageCostPrice: product ? parseFloat(product.average_cost_price) : 0,
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
      .andWhere('receipt.status = :status', { status: 'completed' }) // Chỉ lấy từ các phiếu đã hoàn thành
      .orderBy('receipt.created_at', 'DESC')
      .getOne();

    return latestReceiptItem ? latestReceiptItem.unit_cost : null;
  }
}
