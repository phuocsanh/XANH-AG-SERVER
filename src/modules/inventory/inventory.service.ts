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

@Injectable()
export class InventoryService {
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

  async createBatch(createInventoryBatchDto: CreateInventoryBatchDto) {
    const batch = this.inventoryBatchRepository.create(createInventoryBatchDto);
    return this.inventoryBatchRepository.save(batch);
  }

  async findAllBatches() {
    return this.inventoryBatchRepository.find();
  }

  async findBatchesByProduct(productId: number) {
    return this.inventoryBatchRepository.find({ where: { productId } });
  }

  async findBatchById(id: number) {
    return this.inventoryBatchRepository.findOne({ where: { id } });
  }

  async updateBatch(id: number, updateData: Partial<CreateInventoryBatchDto>) {
    await this.inventoryBatchRepository.update(id, updateData);
    return this.findBatchById(id);
  }

  async removeBatch(id: number) {
    await this.inventoryBatchRepository.delete(id);
  }

  async createTransaction(
    createInventoryTransactionDto: CreateInventoryTransactionDto,
  ) {
    const transaction = this.inventoryTransactionRepository.create(
      createInventoryTransactionDto,
    );
    return this.inventoryTransactionRepository.save(transaction);
  }

  async findAllTransactions() {
    return this.inventoryTransactionRepository.find();
  }

  async findTransactionsByProduct(productId: number) {
    return this.inventoryTransactionRepository.find({ where: { productId } });
  }

  async getInventorySummary(productId: number) {
    const batches = await this.inventoryBatchRepository.find({
      where: { productId },
    });
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

  async getFifoValue(productId: number) {
    const batches = await this.inventoryBatchRepository.find({
      where: { productId },
      order: { createdAt: 'ASC' },
    });

    let totalValue = 0;
    let totalQuantity = 0;

    for (const batch of batches) {
      totalValue += batch.remainingQuantity * parseFloat(batch.unitCostPrice);
      totalQuantity += batch.remainingQuantity;
    }

    return {
      productId,
      totalValue,
      totalQuantity,
      averageValue: totalQuantity > 0 ? totalValue / totalQuantity : 0,
    };
  }

  // Inventory Receipt methods
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

  async findAllReceipts() {
    return this.inventoryReceiptRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findReceiptById(id: number) {
    return this.inventoryReceiptRepository.findOne({
      where: { id },
      relations: ['items'],
    });
  }

  async findReceiptByCode(receiptCode: string) {
    return this.inventoryReceiptRepository.findOne({
      where: { receiptCode },
      relations: ['items'],
    });
  }

  async updateReceipt(
    id: number,
    updateData: Partial<CreateInventoryReceiptDto>,
  ) {
    await this.inventoryReceiptRepository.update(id, updateData);
    return this.findReceiptById(id);
  }

  async removeReceipt(id: number) {
    await this.inventoryReceiptRepository.delete(id);
  }

  async approveReceipt(id: number) {
    const receipt = await this.findReceiptById(id);
    receipt.status = 'approved';
    receipt.approvedAt = new Date();
    return this.inventoryReceiptRepository.save(receipt);
  }

  async completeReceipt(id: number) {
    const receipt = await this.findReceiptById(id);
    receipt.status = 'completed';
    receipt.completedAt = new Date();
    return this.inventoryReceiptRepository.save(receipt);
  }

  async cancelReceipt(id: number, reason: string) {
    const receipt = await this.findReceiptById(id);
    receipt.status = 'cancelled';
    receipt.cancelledAt = new Date();
    receipt.cancelledReason = reason;
    return this.inventoryReceiptRepository.save(receipt);
  }

  async getReceiptItems(receiptId: number) {
    return this.inventoryReceiptItemRepository.find({
      where: { receiptId },
      relations: ['product'],
    });
  }

  async updateReceiptItem(
    id: number,
    updateData: Partial<InventoryReceiptItem>,
  ) {
    await this.inventoryReceiptItemRepository.update(id, updateData);
    return this.inventoryReceiptItemRepository.findOne({ where: { id } });
  }

  async removeReceiptItem(id: number) {
    await this.inventoryReceiptItemRepository.delete(id);
  }
}
