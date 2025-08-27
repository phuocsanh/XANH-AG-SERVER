import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryBatch } from '../../entities/inventory.entity';
import { InventoryTransaction } from '../../entities/inventory-transaction.entity';
import { InventoryReceipt } from '../../entities/inventory-receipt.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-item.entity';
import { CreateInventoryBatchDto } from './dto/create-inventory-batch.dto';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { CreateInventoryReceiptDto } from './dto/create-inventory-receipt.dto';

/**
 * Service xử lý logic nghiệp vụ liên quan đến quản lý kho hàng
 * Bao gồm quản lý lô hàng, giao dịch kho, phiếu nhập kho và các chức năng liên quan
 */
@Injectable()
export class InventoryService {
  /**
   * Constructor injection các repository cần thiết
   * @param inventoryBatchRepository - Repository để thao tác với entity InventoryBatch
   * @param inventoryTransactionRepository - Repository để thao tác với entity InventoryTransaction
   * @param inventoryReceiptRepository - Repository để thao tác với entity InventoryReceipt
   * @param inventoryReceiptItemRepository - Repository để thao tác với entity InventoryReceiptItem
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
      where: { productId },
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
