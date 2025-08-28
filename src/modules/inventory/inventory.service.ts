import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { InventoryBatch } from '../../entities/inventory.entity';
import { InventoryTransaction } from '../../entities/inventory-transaction.entity';
import { InventoryReceipt } from '../../entities/inventory-receipt.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-item.entity';
import { CreateInventoryBatchDto } from './dto/create-inventory-batch.dto';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { CreateInventoryReceiptDto } from './dto/create-inventory-receipt.dto';
import { ProductService } from '../product/product.service';

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
    const batch = this.inventoryBatchRepository.create(createInventoryBatchDto);
    return this.inventoryBatchRepository.save(batch);
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
    return this.inventoryBatchRepository.find({ where: { productId } });
  }

  /**
   * Tìm lô hàng tồn kho theo ID
   * @param id - ID của lô hàng tồn kho cần tìm
   * @returns Thông tin lô hàng tồn kho
   */
  async findBatchById(id: number) {
    return this.inventoryBatchRepository.findOne({ where: { id } });
  }

  /**
   * Cập nhật thông tin lô hàng tồn kho
   * @param id - ID của lô hàng tồn kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật lô hàng tồn kho
   * @returns Thông tin lô hàng tồn kho đã cập nhật
   */
  async updateBatch(id: number, updateData: Partial<CreateInventoryBatchDto>) {
    await this.inventoryBatchRepository.update(id, updateData);
    return this.findBatchById(id);
  }

  /**
   * Xóa lô hàng tồn kho theo ID
   * @param id - ID của lô hàng tồn kho cần xóa
   */
  async removeBatch(id: number) {
    await this.inventoryBatchRepository.delete(id);
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
    return this.inventoryTransactionRepository.find({ where: { productId } });
  }

  /**
   * Lấy tổng hợp tồn kho theo ID sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Tổng hợp tồn kho của sản phẩm
   */
  async getInventorySummary(productId: number) {
    // Lấy tất cả lô hàng của sản phẩm
    const batches = await this.inventoryBatchRepository.find({
      where: { productId },
    });

    // Tính tổng số lượng tồn kho
    const totalQuantity = batches.reduce(
      (sum, batch) => sum + batch.remainingQuantity,
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
        productId,
        remainingQuantity: MoreThan(0)
      },
      order: { createdAt: 'ASC' },
    });

    let totalValue = 0;
    let totalQuantity = 0;

    // Tính tổng giá trị và số lượng
    for (const batch of batches) {
      totalValue += batch.remainingQuantity * parseFloat(batch.unitCostPrice);
      totalQuantity += batch.remainingQuantity;
    }

    return {
      productId,
      totalValue,
      totalQuantity,
      averageValue: totalQuantity > 0 ? totalValue / totalQuantity : 0, // Giá trị trung bình
      batches: batches.map(batch => ({
        id: batch.id,
        batchCode: batch.batchCode,
        remainingQuantity: batch.remainingQuantity,
        unitCostPrice: parseFloat(batch.unitCostPrice),
        value: batch.remainingQuantity * parseFloat(batch.unitCostPrice),
        expiryDate: batch.expiryDate,
        manufacturingDate: batch.manufacturingDate,
        createdAt: batch.createdAt
      }))
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
        productId,
        remainingQuantity: MoreThan(0)
      },
      order: { createdAt: 'ASC' },
    });

    let remainingQuantity = quantity;
    let totalCost = 0;
    const usedBatches = [];

    for (const batch of batches) {
      if (remainingQuantity <= 0) break;

      const quantityFromBatch = Math.min(remainingQuantity, batch.remainingQuantity);
      const costFromBatch = quantityFromBatch * parseFloat(batch.unitCostPrice);
      
      totalCost += costFromBatch;
      remainingQuantity -= quantityFromBatch;
      
      usedBatches.push({
        batchId: batch.id,
        batchCode: batch.batchCode,
        quantityUsed: quantityFromBatch,
        unitCostPrice: parseFloat(batch.unitCostPrice),
        totalCost: costFromBatch,
        expiryDate: batch.expiryDate,
        manufacturingDate: batch.manufacturingDate
      });
    }

    const averageFifoCost = quantity > 0 ? totalCost / (quantity - remainingQuantity) : 0;

    return {
      productId,
      requestedQuantity: quantity,
      availableQuantity: quantity - remainingQuantity,
      shortfall: remainingQuantity,
      totalFifoCost: totalCost,
      averageFifoCost,
      usedBatches
    };
  }

  /**
   * Lấy thông tin chi tiết về batch tracking
   * @param productId - ID của sản phẩm (tùy chọn)
   * @returns Thông tin chi tiết về các lô hàng
   */
  async getBatchTrackingInfo(productId?: number) {
    let whereCondition: any = {
      remainingQuantity: MoreThan(0)
    };
    
    if (productId) {
      whereCondition.productId = productId;
    }

    const batches = await this.inventoryBatchRepository.find({
      where: whereCondition,
      order: { createdAt: 'ASC' },
      relations: ['product'], // Giả sử có relation với Product
    });

    return batches.map(batch => {
      const daysUntilExpiry = batch.expiryDate 
        ? Math.ceil((batch.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      const ageInDays = Math.ceil((new Date().getTime() - batch.createdAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: batch.id,
        productId: batch.productId,
        batchCode: batch.batchCode,
        unitCostPrice: parseFloat(batch.unitCostPrice),
        originalQuantity: batch.originalQuantity,
        remainingQuantity: batch.remainingQuantity,
        usedQuantity: batch.originalQuantity - batch.remainingQuantity,
        usagePercentage: ((batch.originalQuantity - batch.remainingQuantity) / batch.originalQuantity * 100).toFixed(2),
        totalValue: batch.remainingQuantity * parseFloat(batch.unitCostPrice),
        expiryDate: batch.expiryDate,
        manufacturingDate: batch.manufacturingDate,
        daysUntilExpiry,
        ageInDays,
        supplierId: batch.supplierId,
        notes: batch.notes,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        status: daysUntilExpiry !== null ? (
          daysUntilExpiry < 0 ? 'EXPIRED' :
          daysUntilExpiry <= 7 ? 'EXPIRING_SOON' :
          daysUntilExpiry <= 30 ? 'EXPIRING_WITHIN_MONTH' : 'GOOD'
        ) : 'NO_EXPIRY'
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
         productId,
         remainingQuantity: MoreThan(0) // Chỉ lấy lô hàng còn tồn kho
       },
     });

    if (batches.length === 0) {
      return 0;
    }

    let totalValue = 0;
    let totalQuantity = 0;

    // Tính tổng giá trị và số lượng có trọng số
    for (const batch of batches) {
      const batchValue = batch.remainingQuantity * parseFloat(batch.unitCostPrice);
      totalValue += batchValue;
      totalQuantity += batch.remainingQuantity;
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
   * @param batchCode - Mã lô hàng (tùy chọn)
   * @param expiryDate - Ngày hết hạn (tùy chọn)
   * @returns Thông tin giao dịch nhập kho và giá vốn trung bình mới
   */
  async processStockIn(
    productId: number,
    quantity: number,
    unitCostPrice: number,
    receiptItemId?: number,
    batchCode?: string,
    expiryDate?: Date,
  ) {
    // Lấy giá vốn trung bình hiện tại
    const currentAverageCost = await this.getWeightedAverageCost(productId);
    
    // Lấy tổng số lượng tồn kho hiện tại
    const currentInventory = await this.getInventorySummary(productId);
    const currentQuantity = currentInventory.totalQuantity;
    
    // Tính giá vốn trung bình mới theo công thức WAC
    const currentTotalValue = currentQuantity * currentAverageCost;
    const newTotalValue = currentTotalValue + (quantity * unitCostPrice);
    const newTotalQuantity = currentQuantity + quantity;
    const newAverageCost = newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : unitCostPrice;

    // Tạo lô hàng mới
    const newBatch = await this.createBatch({
      productId,
      batchCode: batchCode || `BATCH_${Date.now()}`,
      unitCostPrice: unitCostPrice.toString(),
      originalQuantity: quantity,
      remainingQuantity: quantity,
      expiryDate,
      receiptItemId,
    });

    // Tạo giao dịch nhập kho
     const transaction = await this.createTransaction({
       productId,
       transactionType: 'IN',
       quantity,
       unitCostPrice: unitCostPrice.toString(),
       totalCostValue: (quantity * unitCostPrice).toString(),
       remainingQuantity: newTotalQuantity,
       newAverageCost: newAverageCost.toString(),
       receiptItemId,
       referenceType: 'STOCK_IN',
       referenceId: newBatch.id,
       notes: `Nhập kho ${quantity} sản phẩm với giá ${unitCostPrice}`,
       createdByUserId: 1, // TODO: Lấy từ context
     });

    // Cập nhật giá sản phẩm dựa trên giá vốn trung bình mới và phần trăm lợi nhuận
    // Tương tự như UpdateProductAverageCostAndPrice trong Go server
    try {
      await this.productService.updateProductAverageCostAndPrice(productId, newAverageCost);
    } catch (error) {
      console.warn(`Không thể cập nhật giá sản phẩm ${productId}:`, error.message);
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
      throw new Error(`Không đủ tồn kho. Hiện có: ${currentInventory.totalQuantity}, yêu cầu: ${quantity}`);
    }

    // Lấy giá vốn trung bình hiện tại
    const currentAverageCost = await this.getWeightedAverageCost(productId);
    
    // Lấy các lô hàng theo thứ tự FIFO (First In, First Out)
     const batches = await this.inventoryBatchRepository.find({
       where: { 
         productId,
         remainingQuantity: MoreThan(0)
       },
       order: { createdAt: 'ASC' }, // FIFO: lô cũ nhất trước
     });

    let remainingToDeduct = quantity;
    let totalCostValue = 0;
    const affectedBatches = [];

    // Xuất kho theo FIFO
    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const deductFromBatch = Math.min(remainingToDeduct, batch.remainingQuantity);
      const batchCostValue = deductFromBatch * parseFloat(batch.unitCostPrice);
      
      // Cập nhật số lượng còn lại trong lô
      batch.remainingQuantity -= deductFromBatch;
      await this.inventoryBatchRepository.save(batch);
      
      totalCostValue += batchCostValue;
      remainingToDeduct -= deductFromBatch;
      
      affectedBatches.push({
        batchId: batch.id,
        deductedQuantity: deductFromBatch,
        unitCostPrice: parseFloat(batch.unitCostPrice),
        costValue: batchCostValue,
      });
    }

    // Tính số lượng tồn kho mới
    const newTotalQuantity = currentInventory.totalQuantity - quantity;
    
    // Tạo giao dịch xuất kho
     const transaction = await this.createTransaction({
       productId,
       transactionType: 'OUT',
       quantity: -quantity, // Số âm để thể hiện xuất kho
       unitCostPrice: currentAverageCost.toString(), // Sử dụng giá vốn trung bình
       totalCostValue: (-totalCostValue).toString(), // Giá trị âm
       remainingQuantity: newTotalQuantity,
       newAverageCost: currentAverageCost.toString(), // Giá vốn trung bình không thay đổi khi xuất kho
       referenceType,
       referenceId,
       notes: notes || `Xuất kho ${quantity} sản phẩm theo FIFO`,
       createdByUserId: 1, // TODO: Lấy từ context
     });

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
         productId,
         remainingQuantity: MoreThan(0)
       },
     });

     let totalValue = 0;
     let totalQuantity = 0;

     // Tính lại tổng giá trị và số lượng
     for (const batch of batches) {
       const batchValue = batch.remainingQuantity * parseFloat(batch.unitCostPrice);
       totalValue += batchValue;
       totalQuantity += batch.remainingQuantity;
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
        remainingQuantity: MoreThan(0)
      };
      
      if (productIds && productIds.length > 0) {
        whereCondition.productId = In(productIds);
      }

      // Lấy tất cả lô hàng còn tồn kho
      const batches = await this.inventoryBatchRepository.find({
        where: whereCondition,
        relations: ['product'], // Giả sử có relation với Product
      });

     // Nhóm theo sản phẩm
     const productGroups = batches.reduce((groups, batch) => {
       const productId = batch.productId;
       if (!groups[productId]) {
         groups[productId] = {
           productId,
           batches: [],
           totalQuantity: 0,
           totalValue: 0,
           weightedAverageCost: 0,
         };
       }
       
       const batchValue = batch.remainingQuantity * parseFloat(batch.unitCostPrice);
       groups[productId].batches.push({
         batchId: batch.id,
         batchCode: batch.batchCode,
         quantity: batch.remainingQuantity,
         unitCost: parseFloat(batch.unitCostPrice),
         totalValue: batchValue,
         expiryDate: batch.expiryDate,
       });
       
       groups[productId].totalQuantity += batch.remainingQuantity;
       groups[productId].totalValue += batchValue;
       
       return groups;
     }, {});

     // Tính weighted average cost cho từng sản phẩm
     const report = Object.values(productGroups).map((group: any) => {
       group.weightedAverageCost = group.totalQuantity > 0 ? group.totalValue / group.totalQuantity : 0;
       return group;
     });

     // Tính tổng cộng
     const totalSummary = {
       totalProducts: report.length,
       totalQuantity: report.reduce((sum, item: any) => sum + item.totalQuantity, 0),
       totalValue: report.reduce((sum, item: any) => sum + item.totalValue, 0),
       overallAverageCost: 0,
     };
     
     totalSummary.overallAverageCost = totalSummary.totalQuantity > 0 
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
         remainingQuantity: MoreThan(0)
       },
       relations: ['product'], // Giả sử có relation với Product
     });

     // Nhóm theo sản phẩm và tính tổng tồn kho
     const productStocks = batches.reduce((stocks, batch) => {
       const productId = batch.productId;
       if (!stocks[productId]) {
         stocks[productId] = {
           productId,
           totalQuantity: 0,
           weightedAverageCost: 0,
           batches: [],
         };
       }
       
       stocks[productId].totalQuantity += batch.remainingQuantity;
       stocks[productId].batches.push({
         batchId: batch.id,
         batchCode: batch.batchCode,
         quantity: batch.remainingQuantity,
         unitCost: parseFloat(batch.unitCostPrice),
         expiryDate: batch.expiryDate,
       });
       
       return stocks;
     }, {});

     // Tính weighted average cost và lọc sản phẩm có tồn kho thấp
     const lowStockProducts = [];
     
     for (const productId in productStocks) {
       const stock = productStocks[productId];
       
       // Tính weighted average cost
       let totalValue = 0;
       for (const batch of stock.batches) {
         totalValue += batch.quantity * batch.unitCost;
       }
       stock.weightedAverageCost = stock.totalQuantity > 0 ? totalValue / stock.totalQuantity : 0;
       
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
       products: lowStockProducts.sort((a, b) => a.totalQuantity - b.totalQuantity), // Sắp xếp theo mức độ nghiêm trọng
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
       .where('batch.remainingQuantity > 0')
       .andWhere('batch.expiryDate IS NOT NULL')
       .andWhere('batch.expiryDate <= :alertDate', { alertDate })
       .orderBy('batch.expiryDate', 'ASC')
       .getMany();

     const processedBatches = expiringBatches.map(batch => {
       const daysUntilExpiry = Math.ceil(
         (new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
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
         productId: batch.productId,
         batchCode: batch.batchCode,
         remainingQuantity: batch.remainingQuantity,
         unitCostPrice: parseFloat(batch.unitCostPrice),
         totalValue: batch.remainingQuantity * parseFloat(batch.unitCostPrice),
         expiryDate: batch.expiryDate,
         daysUntilExpiry,
         alertLevel,
       };
     });

     // Tính tổng giá trị có thể bị mất
     const totalValueAtRisk = processedBatches.reduce((sum, batch) => sum + batch.totalValue, 0);
     const expiredBatches = processedBatches.filter(batch => batch.alertLevel === 'EXPIRED');
     const criticalBatches = processedBatches.filter(batch => batch.alertLevel === 'CRITICAL');

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
    const receipt = this.inventoryReceiptRepository.create({
      ...createInventoryReceiptDto,
      createdByUserId: 1, // TODO: Lấy user ID từ context
    });
    const savedReceipt = await this.inventoryReceiptRepository.save(receipt);

    // Tạo các item trong phiếu
    const items = createInventoryReceiptDto.items.map((item) =>
      this.inventoryReceiptItemRepository.create({
        ...item,
        receiptId: savedReceipt.id,
      }),
    );
    await this.inventoryReceiptItemRepository.save(items);

    return savedReceipt;
  }

  /**
   * Lấy danh sách tất cả phiếu nhập kho
   * @returns Danh sách phiếu nhập kho
   */
  async findAllReceipts() {
    return this.inventoryReceiptRepository.find({
      order: { createdAt: 'DESC' }, // Sắp xếp theo thời gian tạo giảm dần
    });
  }

  /**
   * Tìm phiếu nhập kho theo ID
   * @param id - ID của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  async findReceiptById(id: number) {
    return this.inventoryReceiptRepository.findOne({
      where: { id },
      relations: ['items'], // Bao gồm cả các item trong phiếu
    });
  }

  /**
   * Tìm phiếu nhập kho theo mã
   * @param receiptCode - Mã của phiếu nhập kho cần tìm
   * @returns Thông tin phiếu nhập kho
   */
  async findReceiptByCode(receiptCode: string) {
    return this.inventoryReceiptRepository.findOne({
      where: { receiptCode },
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
  ) {
    await this.inventoryReceiptRepository.update(id, updateData);
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
  async approveReceipt(id: number) {
    const receipt = await this.findReceiptById(id);
    receipt.status = 'approved'; // Cập nhật trạng thái thành đã duyệt
    receipt.approvedAt = new Date(); // Ghi nhận thời gian duyệt
    return this.inventoryReceiptRepository.save(receipt);
  }

  /**
   * Hoàn thành phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hoàn thành
   * @returns Thông tin phiếu nhập kho đã hoàn thành
   */
  async completeReceipt(id: number) {
    const receipt = await this.findReceiptById(id);
    receipt.status = 'completed'; // Cập nhật trạng thái thành đã hoàn thành
    receipt.completedAt = new Date(); // Ghi nhận thời gian hoàn thành
    return this.inventoryReceiptRepository.save(receipt);
  }

  /**
   * Hủy phiếu nhập kho
   * @param id - ID của phiếu nhập kho cần hủy
   * @param reason - Lý do hủy phiếu nhập kho
   * @returns Thông tin phiếu nhập kho đã hủy
   */
  async cancelReceipt(id: number, reason: string) {
    const receipt = await this.findReceiptById(id);
    receipt.status = 'cancelled'; // Cập nhật trạng thái thành đã hủy
    receipt.cancelledAt = new Date(); // Ghi nhận thời gian hủy
    receipt.cancelledReason = reason; // Ghi nhận lý do hủy
    return this.inventoryReceiptRepository.save(receipt);
  }

  /**
   * Lấy danh sách chi tiết phiếu nhập kho
   * @param receiptId - ID của phiếu nhập kho
   * @returns Danh sách chi tiết phiếu nhập kho
   */
  async getReceiptItems(receiptId: number) {
    return this.inventoryReceiptItemRepository.find({
      where: { receiptId },
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
    updateData: Partial<InventoryReceiptItem>,
  ) {
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
}
