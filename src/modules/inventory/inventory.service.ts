import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  HttpException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In, QueryRunner, EntityManager } from 'typeorm';

import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import {
  InventoryReceipt,
  SupplierSettlementMode,
} from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReceiptPayment } from '../../entities/inventory-receipt-payments.entity';
import { InventoryReceiptSupplierSettlement } from '../../entities/inventory-receipt-supplier-settlements.entity';
import { InventoryReturn } from '../../entities/inventory-returns.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { InventoryReturnRefund } from '../../entities/inventory-return-refunds.entity';
import { InventoryAdjustment } from '../../entities/inventory-adjustments.entity';
import { InventoryAdjustmentItem } from '../../entities/inventory-adjustment-items.entity';
import {
  InventoryBorrow,
  InventoryBorrowStatus,
} from '../../entities/inventory-borrows.entity';
import { InventoryBorrowItem } from '../../entities/inventory-borrow-items.entity';
import { InventoryReceiptLog } from '../../entities/inventory-receipt-logs.entity';
import { Product } from '../../entities/products.entity';
import { ProductCostingMethod } from '../../entities/products.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
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
import {
  CreateInventoryBorrowDto,
  SearchInventoryBorrowDto,
} from './dto/create-inventory-borrow.dto';
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
import {
  RECEIPT_TAX_EDIT_PLAN_SQL,
  ReceiptTaxEditPlan,
} from './receipt-tax-edit-plan';
import { taxableQuantityForBorrowReturn } from './borrow-tax-return';
import {
  adjustmentBatchTaxSnapshotMatches,
  validateAdjustmentStockAllocations,
} from './adjustment-stock-allocations';

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
    @InjectRepository(InventoryBorrow)
    private inventoryBorrowRepository: Repository<InventoryBorrow>,
    @InjectRepository(InventoryReceiptLog)
    private inventoryReceiptLogRepository: Repository<InventoryReceiptLog>,
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService,
    private fileTrackingService: FileTrackingService,
  ) {}

  private getManager(queryRunner?: QueryRunner): EntityManager {
    return queryRunner
      ? queryRunner.manager
      : this.inventoryReceiptRepository.manager;
  }

  private async withStockTransaction<T>(
    action: (runner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const runner = this.inventoryReceiptRepository.manager.connection.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      const result = await action(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  // Snapshot thuế và hệ số quy đổi có tối đa 6 chữ số thập phân.
  private taxQuantityUnits(value: unknown): bigint | undefined {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        !Number.isFinite(Number(value))) return undefined;
    const match = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(String(value));
    if (!match) return undefined;
    const units = BigInt(match[2]!) * 1000000n +
      BigInt((match[3] ?? '').padEnd(6, '0'));
    return match[1] ? -units : units;
  }

  /**
   * Quy đổi đơn vị thuế (1e-6) sang số thực của products.taxable_quantity_stock numeric(15,4).
   * Chỉ nhận giá trị lẻ tối đa 4 chữ số thập phân; lẻ hơn sẽ báo lỗi thay vì tự làm tròn
   * để không lệch số thuế dùng đối soát hóa đơn.
   */
  private productTaxStockFromUnits(productId: number, units: bigint | undefined): number {
    // Giá trị lớn nhất lưu được: numeric(15,4) = 99999999999.9999 -> 99999999999999900 đơn vị 1e-6.
    const maxUnits = 99999999999999900n;
    if (units === undefined || units < 0n || units > maxUnits ||
        units % 100n !== 0n) {
      throw new BadRequestException(
        `Tồn thuế sản phẩm #${productId} không lưu được chính xác với numeric(15,4). ` +
          'Vui lòng đối soát snapshot thuế theo đơn vị gốc trước khi tiếp tục; không thể tự làm tròn.',
      );
    }
    return Number(units / 100n) / 10000;
  }

  private parseMoney(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    const normalized = String(value).replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private calculateReceiptItemGrossTotal(item: {
    quantity?: number;
    unit_cost?: number;
  }): number {
    return this.roundMoney(Number(item.quantity || 0) * Number(item.unit_cost || 0));
  }

  private calculateReceiptItemDiscountAmount(item: {
    quantity?: number;
    unit_cost?: number;
    discount_amount?: number;
    discount_value?: number;
    discount_type?: string;
  }, options: { capAtGross?: boolean } = {}): number {
    const grossTotal = this.calculateReceiptItemGrossTotal(item);
    const capAtGross = options.capAtGross !== false;
    const discountValue = Number(item.discount_value ?? 0);
    const explicitDiscount = Number(item.discount_amount ?? 0);
    const rawDiscount =
      item.discount_type === 'percentage'
        ? (grossTotal * discountValue) / 100
        : explicitDiscount || discountValue;

    const nonNegativeDiscount = Math.max(rawDiscount, 0);
    return this.roundMoney(
      capAtGross
        ? Math.min(nonNegativeDiscount, grossTotal)
        : nonNegativeDiscount,
    );
  }

  private calculateReceiptItemNetTotal(item: {
    quantity?: number;
    unit_cost?: number;
    discount_amount?: number;
    discount_value?: number;
    discount_type?: string;
    total_price?: number;
  }): number {
    const grossTotal = this.calculateReceiptItemGrossTotal(item);
    if (item.discount_amount === undefined && item.discount_value === undefined) {
      return this.roundMoney(Number(item.total_price ?? grossTotal));
    }
    return this.roundMoney(grossTotal - this.calculateReceiptItemDiscountAmount(item));
  }

  private calculateReceiptItemNetUnitCost(item: {
    quantity?: number;
    unit_cost?: number;
    discount_amount?: number;
    discount_value?: number;
    discount_type?: string;
    total_price?: number;
  }): number {
    const quantity = Number(item.quantity || 0);
    if (quantity <= 0) {
      return this.roundMoney(Number(item.unit_cost || 0));
    }
    return this.roundMoney(this.calculateReceiptItemNetTotal(item) / quantity);
  }

  private resolveStockOutUnitCost(
    product: Product | null,
    fallbackCost: number,
    priceType?: 'cash' | 'credit',
  ): number {
    if (!product) {
      return this.roundMoney(fallbackCost);
    }

    if (this.isProductBySaleType(product)) {
      const configuredCost =
        priceType === 'credit'
          ? this.parseMoney(product.credit_cost_price)
          : this.parseMoney(product.cash_cost_price);

      if (configuredCost > 0) {
        return this.roundMoney(configuredCost);
      }
    }

    const averageCost = this.parseMoney(product.average_cost_price);
    if (averageCost > 0) {
      return this.roundMoney(averageCost);
    }

    return this.roundMoney(fallbackCost);
  }

  private calculateBatchTaxableRemaining(
    batch: Pick<
      InventoryBatch,
      'original_quantity' | 'remaining_quantity' | 'receipt_item_id'
    >,
    receiptItemsMap: Map<number, InventoryReceiptItem>,
  ): number {
    if (!batch.receipt_item_id) {
      return 0;
    }

    const receiptItem = receiptItemsMap.get(batch.receipt_item_id);
    if (!receiptItem) {
      return 0;
    }

    const originalQuantity = Number(batch.original_quantity || 0);
    const remainingQuantity = Number(batch.remaining_quantity || 0);
    const receiptConversionFactor = Number(receiptItem.conversion_factor || 1);
    const initialTaxable = Math.min(
      Number(receiptItem.taxable_quantity || 0) *
        (receiptConversionFactor > 0 ? receiptConversionFactor : 1),
      originalQuantity,
    );
    // Legacy mixed batches do not record per-unit allocation history. Apply
    // the business rule that non-taxable units in the same batch are sold
    // before its taxable units.
    const alreadySoldFromBatch = Math.max(
      0,
      originalQuantity - remainingQuantity,
    );
    const initialNonTaxable = Math.max(0, originalQuantity - initialTaxable);
    const nonTaxableRemaining = Math.max(
      0,
      initialNonTaxable - alreadySoldFromBatch,
    );
    return Math.max(
      0,
      Math.min(
        remainingQuantity,
        remainingQuantity - nonTaxableRemaining,
      ),
    );
  }

  private calculateBatchTaxableOut(
    quantity: number,
    remainingQuantity: number,
    taxableRemaining: number,
  ): number {
    const boundedQuantity = Math.max(0, quantity);
    const boundedRemaining = Math.max(0, remainingQuantity);
    const boundedTaxableRemaining = Math.min(
      boundedRemaining,
      Math.max(0, taxableRemaining),
    );
    const nonTaxableRemaining = Math.max(
      0,
      boundedRemaining - boundedTaxableRemaining,
    );

    return Math.min(
      boundedTaxableRemaining,
      Math.max(0, boundedQuantity - nonTaxableRemaining),
    );
  }

  private async planStockOut(
    productId: number,
    quantity: number,
    queryRunner?: QueryRunner,
  ): Promise<{
    product: Product | null;
    currentAverageCost: number;
    currentInventoryTotal: number;
    currentTaxableStock: number;
    newTotalQuantity: number;
    newTaxableQuantityStock: number;
    taxableQuantityToDeduct: number;
    effectiveTaxSellingPrice: number;
    totalCostValue: number;
    affectedBatches: Array<{
      batchId: number;
      deductedQuantity: number;
      taxableQuantity: number;
      remainingQuantity: number;
      cost: number;
      taxSellingPriceBaseUnit: number;
    }>;
    batchesToPersist: InventoryBatch[];
  }> {
    const currentInventory = await this.getInventorySummary(
      productId,
      queryRunner,
    );
    if (currentInventory.totalQuantity < quantity) {
      throw new Error(
        `Không đủ tồn kho. Hiện có: ${currentInventory.totalQuantity}, yêu cầu: ${quantity}`,
      );
    }

    const productRepo = queryRunner
      ? queryRunner.manager.getRepository(Product)
      : this.productService['productRepository'];
    const product = await productRepo.findOne({ where: { id: productId } });
    const currentTaxableStock = Number(product?.taxable_quantity_stock || 0);

    const batchRepo = queryRunner
      ? queryRunner.manager.getRepository(InventoryBatch)
      : this.inventoryBatchRepository;
    const batches = await batchRepo.find({
      where: {
        product_id: productId,
        remaining_quantity: MoreThan(0),
      },
      order: { created_at: 'ASC', id: 'ASC' },
    });

    const receiptItemRepo = queryRunner
      ? queryRunner.manager.getRepository(InventoryReceiptItem)
      : this.inventoryReceiptItemRepository;
    const receiptItemIds = batches
      .map((b) => b.receipt_item_id)
      .filter((id) => id != null) as number[];
    const receiptItemsMap = new Map<number, InventoryReceiptItem>();

    if (receiptItemIds.length > 0) {
      const items = await receiptItemRepo.find({
        where: { id: In(receiptItemIds) },
      });
      items.forEach((item) => receiptItemsMap.set(item.id, item));
    }

    const currentAverageCost = await this.getWeightedAverageCost(
      productId,
      queryRunner,
    );

    let remainingToDeduct = quantity;
    let totalCostValue = 0;
    let totalTaxableDeducted = 0;
    let totalTaxableValue = 0;
    const affectedBatches: Array<{
      batchId: number;
      deductedQuantity: number;
      taxableQuantity: number;
      remainingQuantity: number;
      cost: number;
      taxSellingPriceBaseUnit: number;
    }> = [];

    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const deductFromBatch = Math.min(
        Number(batch.remaining_quantity),
        remainingToDeduct,
      );

      let batchTaxableRemaining = 0;
      let batchTaxSellingPriceBaseUnit = 0;
      const receiptItem = batch.receipt_item_id
        ? receiptItemsMap.get(batch.receipt_item_id)
        : null;

      if (batch.taxable_remaining_quantity !== null && batch.taxable_remaining_quantity !== undefined) {
        batchTaxableRemaining = Math.min(
          Number(batch.remaining_quantity),
          Math.max(0, Number(batch.taxable_remaining_quantity)),
        );
        if (receiptItem) {
          const receiptConversionFactor = Number(receiptItem.conversion_factor || 1);
          batchTaxSellingPriceBaseUnit =
            Number(receiptItem.tax_selling_price || 0) > 0
              ? Number(receiptItem.tax_selling_price || 0) /
                (receiptConversionFactor > 0 ? receiptConversionFactor : 1)
              : 0;
        }
      } else if (receiptItem) {
        batchTaxableRemaining = this.calculateBatchTaxableRemaining(
          batch,
          receiptItemsMap,
        );
        const receiptConversionFactor = Number(
          receiptItem.conversion_factor || 1,
        );
        batchTaxSellingPriceBaseUnit =
          Number(receiptItem.tax_selling_price || 0) > 0
            ? Number(receiptItem.tax_selling_price || 0) /
              (receiptConversionFactor > 0 ? receiptConversionFactor : 1)
            : 0;
      } else {
        const taxableRatio =
          currentInventory.totalQuantity > 0
            ? currentTaxableStock / currentInventory.totalQuantity
            : 0;
        batchTaxableRemaining = Number(batch.remaining_quantity) * taxableRatio;
        batchTaxSellingPriceBaseUnit =
          currentTaxableStock > 0 ? Number(product?.tax_selling_price || 0) : 0;
      }

      const deductTaxable = this.calculateBatchTaxableOut(
        deductFromBatch,
        Number(batch.remaining_quantity),
        batchTaxableRemaining,
      );
      const roundedDeductTaxable = Math.min(
        Math.round(deductTaxable * 10000) / 10000,
        Math.max(0, currentTaxableStock - totalTaxableDeducted),
      );

      totalTaxableDeducted += roundedDeductTaxable;
      totalTaxableValue +=
        roundedDeductTaxable * Number(batchTaxSellingPriceBaseUnit || 0);

      batch.remaining_quantity =
        Number(batch.remaining_quantity) - deductFromBatch;
      remainingToDeduct -= deductFromBatch;

      const batchCost = this.resolveStockOutUnitCost(
        product,
        parseFloat(batch.unit_cost_price),
      );
      totalCostValue += deductFromBatch * batchCost;

      affectedBatches.push({
        batchId: batch.id,
        deductedQuantity: deductFromBatch,
        taxableQuantity: roundedDeductTaxable,
        remainingQuantity: Number(batch.remaining_quantity),
        cost: batchCost,
        taxSellingPriceBaseUnit: Number(batchTaxSellingPriceBaseUnit || 0),
      });
    }

    const newTotalQuantity = currentInventory.totalQuantity - quantity;
    const taxableQuantityToDeduct = totalTaxableDeducted;
    const effectiveTaxSellingPrice =
      taxableQuantityToDeduct > 0
        ? Math.round((totalTaxableValue / taxableQuantityToDeduct) * 100) / 100
        : 0;
    const newTaxableQuantityStock = Math.max(
      0,
      currentTaxableStock - taxableQuantityToDeduct,
    );

    return {
      product,
      currentAverageCost,
      currentInventoryTotal: currentInventory.totalQuantity,
      currentTaxableStock,
      newTotalQuantity,
      newTaxableQuantityStock,
      taxableQuantityToDeduct,
      effectiveTaxSellingPrice,
      totalCostValue,
      affectedBatches,
      batchesToPersist: batches,
    };
  }

  private resolveReceiptPaymentStatus(
    supplierAmount: number,
    paidAmount: number,
    settlementMode: SupplierSettlementMode,
  ): string {
    if (supplierAmount <= 0) {
      if (
        settlementMode === SupplierSettlementMode.BY_SALE_TYPE &&
        paidAmount > 0
      ) {
        return 'advance';
      }
      return settlementMode === SupplierSettlementMode.BY_SALE_TYPE
        ? 'unpaid'
        : 'paid';
    }

    if (paidAmount >= supplierAmount) {
      return 'paid';
    }

    if (paidAmount > 0) {
      return 'partial';
    }

    return 'unpaid';
  }

  private getReceiptSupplierAmount(
    receipt: Partial<InventoryReceipt> | null | undefined,
  ): number {
    if (!receipt) {
      return 0;
    }

    return (
      Number(receipt.supplier_amount) ||
      Number(receipt.final_amount) ||
      Number(receipt.total_amount) ||
      0
    );
  }

  private isProductBySaleType(product?: Product | null): boolean {
    return product?.costing_method === ProductCostingMethod.BY_PRICE_TYPE;
  }

  private getReceiptItemBaseQuantity(item: {
    quantity?: number;
    conversion_factor?: number;
    base_quantity?: number;
  }): number {
    const conversionFactor = Number(item.conversion_factor || 1);
    const computedBaseQuantity =
      Number(item.quantity || 0) *
      (conversionFactor > 0 ? conversionFactor : 1);

    return Number(item.base_quantity || 0) > 0
      ? Number(item.base_quantity || 0)
      : computedBaseQuantity;
  }

  private async applyBySaleTypeReceiptDiscountToProductCosts(
    items: Array<{
      product_id: number;
      quantity?: number;
      conversion_factor?: number;
      base_quantity?: number;
      unit_cost?: number;
      discount_amount?: number;
      discount_value?: number;
      discount_type?: string;
    }>,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const discountByProduct = new Map<
      number,
      { discountAmount: number; baseQuantity: number }
    >();

    for (const item of items) {
      const discountAmount = this.calculateReceiptItemDiscountAmount(item, {
        capAtGross: false,
      });
      const baseQuantity = this.getReceiptItemBaseQuantity(item);

      if (discountAmount <= 0 || baseQuantity <= 0) {
        continue;
      }

      const productId = Number(item.product_id);
      const current = discountByProduct.get(productId) || {
        discountAmount: 0,
        baseQuantity: 0,
      };
      current.discountAmount += discountAmount;
      current.baseQuantity += baseQuantity;
      discountByProduct.set(productId, current);
    }

    if (discountByProduct.size === 0) {
      return;
    }

    const manager = this.getManager(queryRunner);
    const products = await this.loadReceiptProducts(
      Array.from(discountByProduct.keys()),
      queryRunner,
    );

    for (const product of products) {
      if (!this.isProductBySaleType(product)) {
        continue;
      }

      const discountSummary = discountByProduct.get(Number(product.id));
      if (!discountSummary || discountSummary.baseQuantity <= 0) {
        continue;
      }

      const cashCost = this.parseMoney(product.cash_cost_price);
      const creditCost = this.parseMoney(product.credit_cost_price);
      if (cashCost <= 0 || creditCost <= 0) {
        continue;
      }

      const discountPerBaseUnit =
        discountSummary.discountAmount / discountSummary.baseQuantity;
      const nextCashCost = this.roundMoney(
        Math.max(0, cashCost - discountPerBaseUnit),
      );
      const nextCreditCost = this.roundMoney(
        Math.max(0, creditCost - discountPerBaseUnit),
      );

      await manager.update(Product, product.id, {
        cash_cost_price: nextCashCost.toFixed(2),
        credit_cost_price: nextCreditCost.toFixed(2),
      });

      this.logger.log(
        `✅ Áp chiết khấu lúa giống cho SP #${product.id}: -${discountPerBaseUnit.toFixed(2)}/đơn vị cơ sở, cash ${cashCost}→${nextCashCost}, credit ${creditCost}→${nextCreditCost}`,
      );
    }
  }

  private validateBySaleTypeDiscountsAreFixedAmount(
    items: Array<{
      discount_amount?: number;
      discount_value?: number;
      discount_type?: string;
    }>,
  ): void {
    const hasPercentageDiscount = items.some(
      (item) =>
        item.discount_type === 'percentage' &&
        (Number(item.discount_amount || 0) > 0 ||
          Number(item.discount_value || 0) > 0),
    );

    if (hasPercentageDiscount) {
      throw new BadRequestException(
        'Phiếu lúa giống/quyết toán theo loại bán chỉ được nhập chiết khấu bằng số tiền cố định, không dùng phần trăm.',
      );
    }
  }

  private async loadReceiptProducts(
    productIds: number[],
    queryRunner?: QueryRunner,
  ): Promise<Product[]> {
    const ids = Array.from(
      new Set(productIds.map((id) => Number(id)).filter((id) => id > 0)),
    );
    if (!ids.length) {
      return [];
    }

    return this.getManager(queryRunner).find(Product, {
      where: { id: In(ids) },
    });
  }

  private async validateReceiptSettlementMode(
    items: Array<{ product_id: number }>,
    requestedMode: SupplierSettlementMode | undefined,
    queryRunner?: QueryRunner,
  ): Promise<SupplierSettlementMode> {
    const productIds = items.map((item) => Number(item.product_id));
    const products = await this.loadReceiptProducts(productIds, queryRunner);
    const productMap = new Map(
      products.map((product) => [Number(product.id), product]),
    );

    for (const productId of productIds) {
      if (!productMap.has(productId)) {
        throw new BadRequestException(`Sản phẩm ID ${productId} không tồn tại`);
      }
    }

    const hasBySaleType = products.some((product) =>
      this.isProductBySaleType(product),
    );
    const hasStandard = products.some(
      (product) => !this.isProductBySaleType(product),
    );

    if (hasBySaleType && hasStandard) {
      throw new BadRequestException(
        'Không được trộn lúa giống quyết toán theo loại bán với sản phẩm thường trong cùng một phiếu nhập.',
      );
    }

    if (!hasBySaleType) {
      if (requestedMode && requestedMode !== SupplierSettlementMode.STANDARD) {
        throw new BadRequestException(
          'Chế độ "quyết toán theo loại bán" chỉ áp dụng cho sản phẩm lúa giống.',
        );
      }
      return SupplierSettlementMode.STANDARD;
    }

    return requestedMode || SupplierSettlementMode.BY_SALE_TYPE;
  }

  private async deleteSupplierSettlementEntries(
    where:
      | Partial<InventoryReceiptSupplierSettlement>
      | Array<Partial<InventoryReceiptSupplierSettlement>>,
    queryRunner?: QueryRunner,
  ): Promise<number[]> {
    const repo = this.getManager(queryRunner).getRepository(
      InventoryReceiptSupplierSettlement,
    );
    const existingEntries = await repo.find({
      where: where as any,
      select: ['id', 'receipt_id'],
    });
    const affectedReceiptIds = Array.from(
      new Set(existingEntries.map((entry) => Number(entry.receipt_id))),
    );

    if (existingEntries.length > 0) {
      await repo.delete(existingEntries.map((entry) => entry.id));
    }

    return affectedReceiptIds;
  }

  private async recalculateBySaleTypeReceiptFinance(
    receiptId: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = this.getManager(queryRunner);
    const receipt = await manager.findOne(InventoryReceipt, {
      where: { id: receiptId },
      relations: ['items'],
    });

    if (!receipt) {
      return;
    }

    const settlements = await manager.find(InventoryReceiptSupplierSettlement, {
      where: { receipt_id: receiptId },
    });

    const goodsTotal = (receipt.items || []).reduce(
      (sum, item) => sum + Number(item.total_price || 0),
      0,
    );
    const sharedShipping = Number(receipt.shared_shipping_cost || 0);
    const itemShipping = (receipt.items || []).reduce(
      (sum, item) => sum + Number(item.individual_shipping_cost || 0),
      0,
    );
    const supplierAmount = this.roundMoney(
      settlements.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    );
    const paidAmount = Number(receipt.paid_amount || 0);
    const totalAmount = this.roundMoney(
      goodsTotal + sharedShipping + itemShipping,
    );
    const debtAmount = this.roundMoney(
      Math.max(0, supplierAmount - paidAmount),
    );
    const paymentStatus = this.resolveReceiptPaymentStatus(
      supplierAmount,
      paidAmount,
      SupplierSettlementMode.BY_SALE_TYPE,
    );

    await manager.update(InventoryReceipt, receiptId, {
      total_amount: totalAmount,
      final_amount: supplierAmount,
      supplier_amount: supplierAmount,
      debt_amount: debtAmount,
      payment_status: paymentStatus,
    });
  }

  private async buildReceiptSettlementSummary(
    receiptId: number,
    queryRunner?: QueryRunner,
  ): Promise<{
    cash_amount: number;
    credit_amount: number;
    total_amount: number;
  }> {
    const rows = await this.getManager(queryRunner)
      .getRepository(InventoryReceiptSupplierSettlement)
      .createQueryBuilder('settlement')
      .select('settlement.price_type', 'price_type')
      .addSelect(
        'COALESCE(SUM(CAST(settlement.amount AS DECIMAL)), 0)',
        'total_amount',
      )
      .where('settlement.receipt_id = :receiptId', { receiptId })
      .groupBy('settlement.price_type')
      .getRawMany();

    const summary = {
      cash_amount: 0,
      credit_amount: 0,
      total_amount: 0,
    };

    for (const row of rows) {
      const amount = this.roundMoney(Number(row.total_amount || 0));
      if (row.price_type === 'credit') {
        summary.credit_amount += amount;
      } else {
        summary.cash_amount += amount;
      }
      summary.total_amount += amount;
    }

    summary.cash_amount = this.roundMoney(summary.cash_amount);
    summary.credit_amount = this.roundMoney(summary.credit_amount);
    summary.total_amount = this.roundMoney(summary.total_amount);

    return summary;
  }

  async syncSupplierSettlementForPostedInvoice(
    invoiceId: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = this.getManager(queryRunner);
    const affectedReceiptIds = new Set<number>(
      await this.deleteSupplierSettlementEntries(
        { invoice_id: invoiceId, entry_type: 'sale' as any },
        queryRunner,
      ),
    );

    const allocations = await manager.find(SalesInvoiceItemStockAllocation, {
      where: { invoice_id: invoiceId },
      relations: ['receipt_item', 'receipt_item.receipt'],
      order: { id: 'ASC' },
    });
    if (!allocations.length) {
      for (const receiptId of affectedReceiptIds) {
        await this.recalculateBySaleTypeReceiptFinance(receiptId, queryRunner);
      }
      return;
    }

    const invoice = await manager.findOne(SalesInvoice, {
      where: { id: invoiceId },
      relations: ['items'],
    });
    const invoiceItems = invoice?.items || [];
    const invoiceItemMap = new Map(
      invoiceItems.map((item) => [Number(item.id), item]),
    );
    const entries: InventoryReceiptSupplierSettlement[] = [];

    for (const allocation of allocations) {
      const receipt = allocation.receipt_item?.receipt;
      if (
        !receipt ||
        receipt.supplier_settlement_mode !== SupplierSettlementMode.BY_SALE_TYPE
      ) {
        continue;
      }

      const invoiceItem = invoiceItemMap.get(
        Number(allocation.sales_invoice_item_id),
      );
      if (!invoiceItem) {
        continue;
      }

      const quantity = Number(allocation.quantity || 0);
      const unitCost = Number(invoiceItem.cost_price || 0);
      if (quantity <= 0) {
        continue;
      }

      affectedReceiptIds.add(Number(receipt.id));
      const settlementData: any = {
        receipt_id: receipt.id,
        product_id: allocation.product_id,
        invoice_id: invoiceId,
        entry_type: 'sale',
        quantity,
        unit_cost: unitCost,
        amount: this.roundMoney(quantity * unitCost),
        notes: `Quyết toán NCC theo hóa đơn #${invoice?.code || invoiceId}`,
      };
      if (allocation.receipt_item_id) {
        settlementData.receipt_item_id = allocation.receipt_item_id;
      }
      if (allocation.supplier_id || receipt.supplier_id) {
        settlementData.supplier_id =
          allocation.supplier_id || receipt.supplier_id;
      }
      if (allocation.sales_invoice_item_id) {
        settlementData.sales_invoice_item_id = allocation.sales_invoice_item_id;
      }
      if (invoiceItem.price_type) {
        settlementData.price_type = invoiceItem.price_type;
      }
      entries.push(
        manager.create(InventoryReceiptSupplierSettlement, settlementData),
      );
    }

    if (entries.length > 0) {
      await manager.save(InventoryReceiptSupplierSettlement, entries);
    }

    for (const receiptId of affectedReceiptIds) {
      await this.recalculateBySaleTypeReceiptFinance(receiptId, queryRunner);
    }
  }

  async removeSupplierSettlementForInvoice(
    invoiceId: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const affectedReceiptIds = await this.deleteSupplierSettlementEntries(
      { invoice_id: invoiceId, entry_type: 'sale' as any },
      queryRunner,
    );
    for (const receiptId of affectedReceiptIds) {
      await this.recalculateBySaleTypeReceiptFinance(receiptId, queryRunner);
    }
  }

  async createSupplierSettlementReturnEntries(
    salesReturnId: number,
    entries: Array<{
      receipt_item_id?: number;
      supplier_id?: number;
      product_id: number;
      invoice_id?: number;
      sales_invoice_item_id?: number;
      price_type?: string;
      quantity: number;
      unit_cost: number;
      notes?: string;
    }>,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = this.getManager(queryRunner);
    const affectedReceiptIds = new Set<number>(
      await this.deleteSupplierSettlementEntries(
        { sales_return_id: salesReturnId, entry_type: 'return' as any },
        queryRunner,
      ),
    );

    const receiptItemIds = Array.from(
      new Set(
        entries
          .map((entry) => Number(entry.receipt_item_id))
          .filter((id) => id > 0),
      ),
    );
    const receiptItems = receiptItemIds.length
      ? await manager.find(InventoryReceiptItem, {
          where: { id: In(receiptItemIds) },
          relations: ['receipt'],
        })
      : [];
    const receiptItemMap = new Map(
      receiptItems.map((item) => [Number(item.id), item]),
    );
    const settlementRows: InventoryReceiptSupplierSettlement[] = [];

    for (const entry of entries) {
      const receiptItemId = Number(entry.receipt_item_id || 0);
      if (!receiptItemId) {
        continue;
      }
      const receiptItem = receiptItemMap.get(receiptItemId);
      const receipt = receiptItem?.receipt;
      if (
        !receipt ||
        receipt.supplier_settlement_mode !== SupplierSettlementMode.BY_SALE_TYPE
      ) {
        continue;
      }

      const quantity = Number(entry.quantity || 0);
      if (quantity <= 0) {
        continue;
      }

      affectedReceiptIds.add(Number(receipt.id));
      const settlementData: any = {
        receipt_id: receipt.id,
        receipt_item_id: receiptItemId,
        product_id: entry.product_id,
        sales_return_id: salesReturnId,
        entry_type: 'return',
        quantity: -Math.abs(quantity),
        unit_cost: Number(entry.unit_cost || 0),
        amount: this.roundMoney(
          -Math.abs(quantity) * Number(entry.unit_cost || 0),
        ),
      };
      if (entry.supplier_id || receipt.supplier_id) {
        settlementData.supplier_id = entry.supplier_id || receipt.supplier_id;
      }
      if (entry.invoice_id) {
        settlementData.invoice_id = entry.invoice_id;
      }
      if (entry.sales_invoice_item_id) {
        settlementData.sales_invoice_item_id = entry.sales_invoice_item_id;
      }
      if (entry.price_type) {
        settlementData.price_type = entry.price_type;
      }
      if (entry.notes) {
        settlementData.notes = entry.notes;
      }
      settlementRows.push(
        manager.create(InventoryReceiptSupplierSettlement, settlementData),
      );
    }

    if (settlementRows.length > 0) {
      await manager.save(InventoryReceiptSupplierSettlement, settlementRows);
    }

    for (const receiptId of affectedReceiptIds) {
      await this.recalculateBySaleTypeReceiptFinance(receiptId, queryRunner);
    }
  }

  async removeSupplierSettlementForSalesReturn(
    salesReturnId: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const affectedReceiptIds = await this.deleteSupplierSettlementEntries(
      { sales_return_id: salesReturnId, entry_type: 'return' as any },
      queryRunner,
    );
    for (const receiptId of affectedReceiptIds) {
      await this.recalculateBySaleTypeReceiptFinance(receiptId, queryRunner);
    }
  }

  /**
   * Tạo lô hàng tồn kho mới
   * @param createInventoryBatchDto - Dữ liệu tạo lô hàng tồn kho mới
   * @returns Thông tin lô hàng tồn kho đã tạo
   */
  async createBatch(
    createInventoryBatchDto: CreateInventoryBatchDto,
    queryRunner?: QueryRunner,
  ) {
    try {
      const repo = queryRunner
        ? queryRunner.manager.getRepository(InventoryBatch)
        : this.inventoryBatchRepository;
      const batch = repo.create(createInventoryBatchDto);
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
      relations: ['product', 'supplier', 'receipt_item', 'receipt_item.receipt'],
      order: { created_at: 'ASC', id: 'ASC' },
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
      ['code', 'product.name', 'product.code', 'notes'], // Global search
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
      },
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

    const repo = queryRunner
      ? queryRunner.manager.getRepository(InventoryTransaction)
      : this.inventoryTransactionRepository;
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
      ['product.name', 'product.code', 'notes'], // Global search
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
      },
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
    const repo = queryRunner
      ? queryRunner.manager.getRepository(InventoryBatch)
      : this.inventoryBatchRepository;
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
      order: { created_at: 'ASC', id: 'ASC' },
    });

    let totalValue = 0;
    let totalQuantity = 0;

    // Tính tổng giá trị và số lượng
    for (const batch of batches) {
      totalValue +=
        batch.remaining_quantity * parseFloat(batch.unit_cost_price);
      totalQuantity += Number(batch.remaining_quantity);
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
      order: { created_at: 'ASC', id: 'ASC' },
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
      order: { created_at: 'ASC', id: 'ASC' },
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
  async getWeightedAverageCost(
    productId: number,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    // Lấy tất cả lô hàng còn tồn kho của sản phẩm
    const repo = queryRunner
      ? queryRunner.manager.getRepository(InventoryBatch)
      : this.inventoryBatchRepository;
    const batches = await repo.find({
      where: {
        product_id: productId,
        remaining_quantity: MoreThan(0), // Chỉ lấy lô hàng còn tồn kho
      },
    });

    if (batches.length === 0) {
      // average_cost_price hiện được chốt theo trung bình của tất cả phiếu nhập hợp lệ,
      // không còn là WAC của tồn kho. Vì vậy khi không còn batch thì WAC phải về 0,
      // không được fallback sang products.average_cost_price.
      this.logger.log(
        `ℹ️ Không còn lô hàng cho SP ${productId}, WAC tồn kho hiện tại = 0`,
      );
      return 0;
    }

    let totalValue = 0;
    let totalQuantity = 0;

    // Tính tổng giá trị và số lượng có trọng số
    for (const batch of batches) {
      const batchValue =
        batch.remaining_quantity * parseFloat(batch.unit_cost_price);
      totalValue += batchValue;
      totalQuantity += Number(batch.remaining_quantity);
    }

    // Trả về giá vốn trung bình gia quyền
    return totalQuantity > 0 ? totalValue / totalQuantity : 0;
  }

  /**
   * Tính lại average_cost_price theo trung bình của tất cả phiếu nhập hợp lệ,
   * sau khi trừ các phiếu trả hàng nhập đã duyệt.
   * Field này không đại diện cho WAC của tồn kho còn lại.
   */
  private async recalculateAverageCostPriceFromValidReceipts(
    productId: number,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const receiptItemRepo = queryRunner
      ? queryRunner.manager.getRepository(InventoryReceiptItem)
      : this.inventoryReceiptItemRepository;
    const returnItemRepo = queryRunner
      ? queryRunner.manager.getRepository(InventoryReturnItem)
      : this.inventoryReturnItemRepository;
    const productRepo = queryRunner
      ? queryRunner.manager.getRepository(Product)
      : this.productService['productRepository'];

    const approvedReceiptItems = await receiptItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.receipt', 'receipt')
      .where('item.product_id = :productId', { productId })
      .andWhere('receipt.status IN (:...validStatuses)', {
        validStatuses: [ReceiptStatus.APPROVED, 'completed'],
      })
      .andWhere('receipt.deleted_at IS NULL')
      .andWhere('item.deleted_at IS NULL')
      .getMany();

    const approvedReturnItems = await returnItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.return', 'inventoryReturn')
      .where('item.product_id = :productId', { productId })
      .andWhere('inventoryReturn.status = :approvedStatus', {
        approvedStatus: ReturnStatus.APPROVED,
      })
      .andWhere('inventoryReturn.deleted_at IS NULL')
      .andWhere('item.deleted_at IS NULL')
      .getMany();

    const receiptSummary = approvedReceiptItems.reduce(
      (sum, item) => {
        const conversionFactor = Number(item.conversion_factor || 1);
        const computedBaseQuantity =
          Number(item.quantity || 0) *
          (conversionFactor > 0 ? conversionFactor : 1);
        const baseQuantity =
          computedBaseQuantity > 0
            ? computedBaseQuantity
            : Number(item.base_quantity || 0);

        sum.totalQuantity += baseQuantity;
        sum.totalValue += Number(item.total_price || 0);
        return sum;
      },
      { totalValue: 0, totalQuantity: 0 },
    );

    const returnSummary = approvedReturnItems.reduce(
      (sum, item) => {
        const conversionFactor = Number(item.conversion_factor || 1);
        const computedBaseQuantity =
          Number(item.quantity || 0) *
          (conversionFactor > 0 ? conversionFactor : 1);
        const baseQuantity =
          computedBaseQuantity > 0
            ? computedBaseQuantity
            : Number(item.base_quantity || 0);

        sum.totalQuantity += baseQuantity;
        sum.totalValue += Number(item.total_price || 0);
        return sum;
      },
      { totalValue: 0, totalQuantity: 0 },
    );

    const receiptTotalValue = Number(receiptSummary.totalValue || 0);
    const receiptTotalQuantity = Number(receiptSummary.totalQuantity || 0);
    const returnTotalValue = Number(returnSummary.totalValue || 0);
    const returnTotalQuantity = Number(returnSummary.totalQuantity || 0);

    const netQuantity = receiptTotalQuantity - returnTotalQuantity;
    const netValue = receiptTotalValue - returnTotalValue;
    const averageCostPrice = netQuantity > 0 ? netValue / netQuantity : 0;

    await productRepo.update(productId, {
      average_cost_price: averageCostPrice.toFixed(2),
    });

    this.logger.log(
      `✅ Recalculated average_cost_price for SP #${productId}: ${averageCostPrice.toFixed(2)} (netQty=${netQuantity}, netValue=${netValue})`,
    );

    return averageCostPrice;
  }

  private async recalculateAverageCostPriceForProducts(
    productIds: number[],
    queryRunner?: QueryRunner,
  ) {
    const uniqueProductIds = Array.from(
      new Set(productIds.map((id) => Number(id)).filter(Boolean)),
    );

    for (const productId of uniqueProductIds) {
      await this.recalculateAverageCostPriceFromValidReceipts(
        productId,
        queryRunner,
      );
    }
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
    taxableQuantity?: number,
    supplierId?: number,
    preserveLatestPurchasePrice = false,
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0 ||
        (taxableQuantity !== undefined && (!Number.isFinite(taxableQuantity) ||
          taxableQuantity < 0 || taxableQuantity > quantity))) {
      throw new BadRequestException('Số lượng nhập và số lượng thuế không hợp lệ');
    }
    if (!queryRunner) {
      return this.withStockTransaction((runner) =>
        this.processStockIn(productId, quantity, unitCostPrice, userId,
          receiptItemId, code, expiryDate, runner, taxableQuantity, supplierId,
          preserveLatestPurchasePrice),
      );
    }
    if (!queryRunner.isTransactionActive) {
      throw new BadRequestException('Nhập kho cần transaction đang hoạt động');
    }
    const product = await queryRunner.manager.findOne(Product, {
      where: { id: productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!product) {
      throw new BadRequestException(`Sản phẩm ID ${productId} không tồn tại`);
    }
    const currentTaxUnits = this.taxQuantityUnits(product.taxable_quantity_stock ?? 0);
    const incomingTaxUnits = this.taxQuantityUnits(taxableQuantity ?? 0);
    const newTaxableQuantityStock = this.productTaxStockFromUnits(
      productId,
      currentTaxUnits === undefined || incomingTaxUnits === undefined
        ? undefined : currentTaxUnits + incomingTaxUnits,
    );
    // Lấy giá vốn trung bình hiện tại
    const currentAverageCost = await this.getWeightedAverageCost(
      productId,
      queryRunner,
    );

    // Lấy thông tin sản phẩm để lấy số lượng tồn kho hiện tại (ưu tiên con số ở bảng Product vì có thể đã được chỉnh sửa thủ công)
    const currentQuantity = Number(product.quantity || 0);

    // Lấy tổng số lượng từ các lô hàng để theo dõi tính nhất quán
    const currentInventory = await this.getInventorySummary(
      productId,
      queryRunner,
    );
    const batchTotalQuantity = currentInventory.totalQuantity;

    if (Math.abs(batchTotalQuantity - currentQuantity) > 0.0001) {
      throw new BadRequestException(
        `Tồn kho sản phẩm ${productId} đang lệch dữ liệu: bảng sản phẩm ${currentQuantity}, tổng lô kho ${batchTotalQuantity}. Cần đồng bộ/kiểm kê trước khi nhập kho để tránh sai giá vốn trung bình.`,
      );
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
      taxable_remaining_quantity: taxableQuantity ?? 0,
      ...(receiptItemId && { receipt_item_id: receiptItemId }),
      ...(supplierId && { supplier_id: supplierId }),
      ...(expiryDate && { expiry_date: expiryDate }),
    };

    const newBatch = await this.createBatch(batchData, queryRunner);

    // Cập nhật giá nhập mới nhất cho sản phẩm
    if (!preserveLatestPurchasePrice) {
      if (queryRunner) {
        await queryRunner.manager.update(Product, productId, {
          latest_purchase_price: unitCostPrice.toString(),
        });
      } else {
        await this.productService.update(productId, {
          latest_purchase_price: unitCostPrice.toString(),
        });
      }
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

    const transaction = await this.createTransaction(
      transactionData,
      queryRunner,
    );

    // Cập nhật giá sản phẩm
    if (queryRunner) {
      const updateData: any = {
        ...(!preserveLatestPurchasePrice && {
          latest_purchase_price: unitCostPrice.toString(),
        }),
        quantity: newTotalQuantity,
        // average_cost_price không cập nhật ở đây vì field này được tính
        // theo toàn bộ phiếu nhập hợp lệ, không theo WAC tồn kho.
      };

      // Cộng số lượng thuế nếu có
      if (taxableQuantity && taxableQuantity > 0) {
        updateData.taxable_quantity_stock =
          newTaxableQuantityStock;
        // Tự động chuyển trạng thái sản phẩm sang "Có hóa đơn đầu vào"
        updateData.has_input_invoice = true;
      }

      await queryRunner.manager.update(Product, productId, updateData);
    } else {
      const updateData: any = {
        ...(!preserveLatestPurchasePrice && {
          latest_purchase_price: unitCostPrice.toString(),
        }),
        quantity: newTotalQuantity,
        // average_cost_price không cập nhật ở đây vì field này được tính
        // theo toàn bộ phiếu nhập hợp lệ, không theo WAC tồn kho.
      };

      // Cộng số lượng thuế nếu có
      if (taxableQuantity && taxableQuantity > 0) {
        updateData.taxable_quantity_stock =
          newTaxableQuantityStock;
        // Tự động chuyển trạng thái sản phẩm sang "Có hóa đơn đầu vào"
        updateData.has_input_invoice = true;
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

  async restoreStockToExistingBatch(
    productId: number,
    batchId: number,
    quantity: number,
    taxableQuantity: number,
    userId: number,
    returnId: number,
    returnCode: string,
    queryRunner: QueryRunner,
    transactionReferenceType = 'RETURN_CANCEL',
    transactionNotes?: string,
  ): Promise<InventoryTransaction> {
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(taxableQuantity) ||
      taxableQuantity < 0 ||
      taxableQuantity > quantity
    ) {
      throw new BadRequestException('Allocation hoàn kho không hợp lệ');
    }

    const product = await queryRunner.manager.findOne(Product, {
      where: { id: productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm #${productId}`);
    }

    const batch = await queryRunner.manager.findOne(InventoryBatch, {
      where: { id: batchId, product_id: productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!batch) {
      throw new NotFoundException(`Không tìm thấy lô kho #${batchId} để hoàn phiếu trả hàng`);
    }

    const existingBatchTaxable = batch.taxable_remaining_quantity;
    if (
      existingBatchTaxable === null || existingBatchTaxable === undefined ||
      !Number.isFinite(Number(existingBatchTaxable)) ||
      Number(existingBatchTaxable) < 0 ||
      Number(existingBatchTaxable) > Number(batch.remaining_quantity) + 0.0001 ||
      Number(existingBatchTaxable) + taxableQuantity >
        Number(batch.remaining_quantity) + quantity + 0.0001
    ) {
      throw new BadRequestException(
        `Không thể hoàn đúng tồn thuế vào lô #${batchId}: snapshot tồn thuế của lô không hợp lệ. ` +
          'Cần đối soát lô trước khi hủy phiếu.',
      );
    }

    const currentTaxUnits = this.taxQuantityUnits(product.taxable_quantity_stock ?? 0);
    const restoredTaxUnits = this.taxQuantityUnits(taxableQuantity);
    const newTaxableQuantityStock = this.productTaxStockFromUnits(
      productId,
      currentTaxUnits === undefined || restoredTaxUnits === undefined
        ? undefined : currentTaxUnits + restoredTaxUnits,
    );
    batch.remaining_quantity = Number(batch.remaining_quantity || 0) + quantity;
    if (batch.taxable_remaining_quantity !== null && batch.taxable_remaining_quantity !== undefined) {
      batch.taxable_remaining_quantity =
        Number(batch.taxable_remaining_quantity) + taxableQuantity;
    }
    await queryRunner.manager.save(batch);

    const newProductQuantity = Number(product.quantity || 0) + quantity;
    await queryRunner.manager.update(Product, productId, {
      quantity: newProductQuantity,
      taxable_quantity_stock: newTaxableQuantityStock,
    });

    const currentAverageCost = await this.getWeightedAverageCost(
      productId,
      queryRunner,
    );
    return this.createTransaction(
      {
        product_id: productId,
        transaction_type: 'IN',
        quantity,
        unit_cost_price: String(batch.unit_cost_price || 0),
        total_cost_value: String(quantity * Number(batch.unit_cost_price || 0)),
        remaining_quantity: newProductQuantity,
        new_average_cost: currentAverageCost.toString(),
        reference_type: transactionReferenceType,
        reference_id: returnId,
        notes: transactionNotes ||
          `Hủy phiếu trả hàng ${returnCode} - hoàn đúng lô #${batchId}`,
        created_by_user_id: userId,
        ...(batch.receipt_item_id && {
          receipt_item_id: Number(batch.receipt_item_id),
        }),
      },
      queryRunner,
    );
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
    stockOutOptions?: {
      receiptItemId?: number;
      batchId?: number;
      taxableQuantity?: number;
      requireBatchTaxSnapshot?: boolean;
      expectedBatchTaxableQuantity?: number;
    },
  ): Promise<{
    transaction: InventoryTransaction;
    taxableQuantity: number;
    taxSellingPrice: number;
    affectedBatches: any[];
    totalCostValue: number;
    averageCostUsed: number;
    remainingQuantity: number;
  }> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Số lượng xuất phải lớn hơn 0');
    }
    if (!queryRunner) {
      return this.withStockTransaction((runner) =>
        this.processStockOut(productId, quantity, referenceType, userId,
          referenceId, notes, runner, stockOutOptions),
      );
    }
    if (!queryRunner.isTransactionActive) {
      throw new BadRequestException('Xuất kho cần transaction đang hoạt động');
    }
    const product = await queryRunner.manager.findOne(Product, {
      where: { id: productId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!product) {
      throw new BadRequestException(`Sản phẩm ID ${productId} không tồn tại`);
    }
    // Kiểm tra tồn kho hiện tại
    const currentInventory = await this.getInventorySummary(
      productId,
      queryRunner,
    );
    if (currentInventory.totalQuantity < quantity) {
      throw new Error(
        `Không đủ tồn kho. Hiện có: ${currentInventory.totalQuantity}, yêu cầu: ${quantity}`,
      );
    }

    // Lấy thông tin sản phẩm để xử lý bể thuế
    const currentTaxableStock = Number(product?.taxable_quantity_stock || 0);
    const operationLabel = referenceType.startsWith('ADJUSTMENT')
      ? 'phiếu điều chỉnh kho'
      : referenceType === 'SALE'
        ? 'hóa đơn bán hàng'
        : referenceType === 'INVOICE_GIFT'
          ? 'quà tặng kèm hóa đơn'
        : referenceType === 'CUSTOMER_REWARD_GIFT'
          ? 'quà tặng khách hàng'
          : referenceType === 'PROMOTION_REWARD_GIFT'
            ? 'quà tặng campaign'
          : referenceType.startsWith('RETURN')
            ? 'phiếu trả hàng nhà cung cấp'
            : 'phiếu mượn';
    const taxableOverride = stockOutOptions?.taxableQuantity;
    if (taxableOverride !== undefined &&
        (!Number.isFinite(taxableOverride) || taxableOverride < 0 ||
          taxableOverride > quantity || taxableOverride > currentTaxableStock)) {
      throw new BadRequestException('Số lượng thuế xuất phải nằm trong số lượng xuất và tồn thuế hiện có');
    }
    const currentTaxUnits = this.taxQuantityUnits(product.taxable_quantity_stock ?? 0);
    this.productTaxStockFromUnits(productId, currentTaxUnits);
    if (taxableOverride !== undefined) {
      const overrideUnits = this.taxQuantityUnits(taxableOverride);
      this.productTaxStockFromUnits(productId,
        currentTaxUnits === undefined || overrideUnits === undefined
          ? undefined : currentTaxUnits - overrideUnits);
    }
    const scopedReceiptItemId = stockOutOptions?.receiptItemId
      ? Number(stockOutOptions.receiptItemId)
      : undefined;
    const scopedBatchId = stockOutOptions?.batchId
      ? Number(stockOutOptions.batchId)
      : undefined;

    // 2. Chuẩn bị dữ liệu thuế của từng đợt nhập kho để tính toán FIFO chính xác
    const batchRepo = queryRunner
      ? queryRunner.manager.getRepository(InventoryBatch)
      : this.inventoryBatchRepository;
    const batches = await batchRepo.find({
      where: {
        product_id: productId,
        remaining_quantity: MoreThan(0),
        ...(scopedReceiptItemId
          ? { receipt_item_id: scopedReceiptItemId }
          : {}),
        ...(scopedBatchId ? { id: scopedBatchId } : {}),
      },
      order: { created_at: 'ASC', id: 'ASC' }, // FIFO: lô cũ nhất trước
    });

    if (batches.reduce((sum, batch) => sum + Number(batch.remaining_quantity), 0) < quantity) {
      throw new BadRequestException('Không đủ tồn kho trong các lô được chọn');
    }

    if (stockOutOptions?.expectedBatchTaxableQuantity !== undefined) {
      if (
        batches.length !== 1 ||
        !adjustmentBatchTaxSnapshotMatches(
          stockOutOptions.expectedBatchTaxableQuantity,
          batches[0]?.taxable_remaining_quantity,
        )
      ) {
        throw new BadRequestException(
          `Không thể hủy phiếu điều chỉnh: tồn thuế của lô #${scopedBatchId || 'không xác định'} ` +
            'đã thay đổi hoặc thiếu snapshot; cần đối soát lô trước khi hủy.',
        );
      }
    }

    if (scopedReceiptItemId) {
      const scopedAvailableQuantity = batches.reduce(
        (sum, batch) => sum + Number(batch.remaining_quantity || 0),
        0,
      );

      if (scopedAvailableQuantity < quantity) {
        throw new BadRequestException(
          `Không đủ tồn kho trong đúng lô nhập gốc. Dòng nhập #${scopedReceiptItemId} còn ${scopedAvailableQuantity}, yêu cầu trả ${quantity}.`,
        );
      }
    }

    if (scopedBatchId) {
      const scopedAvailableQuantity = batches.reduce(
        (sum, batch) => sum + Number(batch.remaining_quantity || 0),
        0,
      );

      if (scopedAvailableQuantity < quantity) {
        throw new BadRequestException(
          `Không đủ tồn kho trong lô đã chọn. Lô #${scopedBatchId} còn ${scopedAvailableQuantity}, yêu cầu xuất ${quantity}.`,
        );
      }
    }

    const receiptItemRepo = queryRunner
      ? queryRunner.manager.getRepository(InventoryReceiptItem)
      : this.inventoryReceiptItemRepository;
    const receiptItemIds = batches
      .map((b) => b.receipt_item_id)
      .filter((id) => id != null) as number[];
    const receiptItemsMap = new Map<number, InventoryReceiptItem>();

    if (receiptItemIds.length > 0) {
      const items = await receiptItemRepo.find({
        where: { id: In(receiptItemIds) },
      });
      items.forEach((item) => receiptItemsMap.set(item.id, item));
    }

    // Lấy giá vốn trung bình hiện tại
    const currentAverageCost = await this.getWeightedAverageCost(
      productId,
      queryRunner,
    );

    let remainingToDeduct = quantity;
    let totalCostValue = 0;
    let totalTaxableDeducted = 0;
    let totalTaxableValue = 0;
    const affectedBatches: any[] = [];
    const updatedBatches: InventoryBatch[] = [];
    let deductedTaxUnits = 0n;

    // 3. Trừ số lượng từ các lô theo FIFO
    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const deductFromBatch = Math.min(
        batch.remaining_quantity,
        remainingToDeduct,
      );

      // --- LOGIC TÍNH TOÁN THUẾ THEO TỪNG LÔ ---
      let batchTaxableRemaining = 0;
      let batchTaxSellingPriceBaseUnit = 0;
      const receiptItem = batch.receipt_item_id
        ? receiptItemsMap.get(batch.receipt_item_id)
        : null;

      if (
        stockOutOptions?.requireBatchTaxSnapshot &&
        (batch.taxable_remaining_quantity === null ||
          batch.taxable_remaining_quantity === undefined ||
          !Number.isFinite(Number(batch.taxable_remaining_quantity)) ||
          Number(batch.taxable_remaining_quantity) < 0 ||
          Number(batch.taxable_remaining_quantity) > Number(batch.remaining_quantity))
      ) {
        throw new BadRequestException(
          `Không thể duyệt ${operationLabel}: lô #${batch.id} thiếu snapshot tồn thuế hợp lệ. ` +
            'Cần đối soát lô trước khi xuất kho.',
        );
      }

      if (
        batch.taxable_remaining_quantity !== null &&
        batch.taxable_remaining_quantity !== undefined
      ) {
        batchTaxableRemaining = Math.min(
          Number(batch.remaining_quantity),
          Math.max(0, Number(batch.taxable_remaining_quantity)),
        );
        if (receiptItem) {
          const receiptConversionFactor = Number(
            receiptItem.conversion_factor || 1,
          );
          batchTaxSellingPriceBaseUnit =
            Number(receiptItem.tax_selling_price || 0) > 0
              ? Number(receiptItem.tax_selling_price || 0) /
                (receiptConversionFactor > 0 ? receiptConversionFactor : 1)
              : 0;
        }
      } else if (receiptItem) {
        // Nếu lô này có thông tin từ phiếu nhập
        const receiptConversionFactor = Number(
          receiptItem.conversion_factor || 1,
        );
        const initialTaxable =
          Number(receiptItem.taxable_quantity || 0) *
          (receiptConversionFactor > 0 ? receiptConversionFactor : 1);
        const initialNonTaxable = Math.max(
          0,
          Number(batch.original_quantity) - initialTaxable,
        );
        const alreadySoldFromBatch =
          Number(batch.original_quantity) - Number(batch.remaining_quantity);

        const nonTaxableRemaining = Math.max(
          0,
          initialNonTaxable - alreadySoldFromBatch,
        );
        batchTaxableRemaining =
          Number(batch.remaining_quantity) - nonTaxableRemaining;
        batchTaxSellingPriceBaseUnit =
          Number(receiptItem.tax_selling_price || 0) > 0
            ? Number(receiptItem.tax_selling_price || 0) /
              (receiptConversionFactor > 0 ? receiptConversionFactor : 1)
            : 0;
      } else {
        // Nếu lô hàng không có phiếu nhập (ví dụ hàng tồn cũ),
        // tạm thời coi tỷ lệ thuế dựa trên bể thuế hiện tại của sản phẩm so với tồn kho (logic fallback)
        const taxableRatio =
          currentInventory.totalQuantity > 0
            ? currentTaxableStock / currentInventory.totalQuantity
            : 0;
        batchTaxableRemaining = Number(batch.remaining_quantity) * taxableRatio;
        batchTaxSellingPriceBaseUnit =
          currentTaxableStock > 0 ? Number(product?.tax_selling_price || 0) : 0;
      }

      // FIFO theo thứ tự batch; trong một lô, hàng không thuế được xuất trước.
      const deductTaxable = this.calculateBatchTaxableOut(
        deductFromBatch,
        Number(batch.remaining_quantity),
        batchTaxableRemaining,
      );
      const roundedBatchTaxableOut = Math.round(deductTaxable * 10000) / 10000;
      const productTaxableAvailable = Math.max(
        0,
        currentTaxableStock - totalTaxableDeducted,
      );
      if (
        stockOutOptions?.requireBatchTaxSnapshot &&
        roundedBatchTaxableOut > productTaxableAvailable + 0.00005
      ) {
        throw new BadRequestException(
          `Không thể duyệt ${operationLabel}: tồn thuế lô #${batch.id} cần xuất ` +
            `${roundedBatchTaxableOut} nhưng tồn thuế sản phẩm chỉ còn ${productTaxableAvailable}. ` +
            'Cần đối soát tồn thuế trước khi xuất.',
        );
      }

      // ✅ Làm tròn để tránh số lẻ thập phân do sai số JavaScript (ví dụ: 50.0000000001 -> 50)
      const roundedDeductTaxable = taxableOverride === undefined
        ? Math.min(
            roundedBatchTaxableOut,
            productTaxableAvailable,
          )
        : Math.min(
            deductFromBatch,
            batchTaxableRemaining,
            Math.max(0, taxableOverride - totalTaxableDeducted),
          );
      totalTaxableDeducted += roundedDeductTaxable;
      // Chỉ bỏ sai số nhị phân của phép trừ; phần lẻ thuế thật vẫn được kiểm tra.
      const canonicalTaxable = Number(roundedDeductTaxable.toFixed(6));
      const units = Math.abs(canonicalTaxable - roundedDeductTaxable) <= 0.000000001
        ? this.taxQuantityUnits(canonicalTaxable) : undefined;
      if (units === undefined) this.productTaxStockFromUnits(productId, undefined);
      deductedTaxUnits += units!;
      totalTaxableValue += roundedDeductTaxable * batchTaxSellingPriceBaseUnit;
      // ---------------------------------------

      if (batch.taxable_remaining_quantity === null || batch.taxable_remaining_quantity === undefined) {
        batch.taxable_remaining_quantity = batchTaxableRemaining;
      }
      batch.remaining_quantity -= deductFromBatch;
      batch.taxable_remaining_quantity = Math.max(
        0,
        Number(batch.taxable_remaining_quantity) - roundedDeductTaxable,
      );
      remainingToDeduct -= deductFromBatch;

      // Tính giá trị xuất kho dựa trên giá vốn của lô
      const batchCost = this.resolveStockOutUnitCost(
        product,
        parseFloat(batch.unit_cost_price),
      );
      totalCostValue += deductFromBatch * batchCost;

      updatedBatches.push(batch);

      affectedBatches.push({
        batchId: batch.id,
        deductedQuantity: deductFromBatch,
        taxableQuantity: roundedDeductTaxable,
        remainingQuantity: batch.remaining_quantity,
        cost: batchCost,
      });
    }

    if (
      taxableOverride !== undefined &&
      Math.abs(totalTaxableDeducted - taxableOverride) > 0.0001
    ) {
      throw new BadRequestException(
        `Không đủ tồn thuế trong lô đã chọn: cần ${taxableOverride}, chỉ phân bổ được ${totalTaxableDeducted}.`,
      );
    }

    // Tính số lượng tồn kho mới
    const newTotalQuantity = currentInventory.totalQuantity - quantity;
    const taxableQuantityToDeduct = totalTaxableDeducted; // Sử dụng kết quả tính toán chi tiết
    const effectiveTaxSellingPrice =
      taxableQuantityToDeduct > 0
        ? Math.round((totalTaxableValue / taxableQuantityToDeduct) * 100) / 100
        : 0;
    const newTaxableQuantityStock = this.productTaxStockFromUnits(
      productId,
      currentTaxUnits === undefined ? undefined : currentTaxUnits - deductedTaxUnits,
    );
    for (const batch of updatedBatches) await batchRepo.save(batch);

    // Tạo giao dịch xuất kho
    const transactionUnitCost =
      quantity > 0
        ? this.roundMoney(totalCostValue / quantity)
        : currentAverageCost;

    const transactionData: CreateInventoryTransactionDto = {
      product_id: productId,
      transaction_type: 'OUT',
      quantity: -quantity, // Số âm để thể hiện xuất kho
      unit_cost_price: transactionUnitCost.toString(),
      total_cost_value: (-totalCostValue).toString(), // Giá trị âm
      remaining_quantity: newTotalQuantity,
      new_average_cost: currentAverageCost.toString(), // Giá vốn trung bình không thay đổi khi xuất kho
      reference_type: referenceType,
      notes: notes || `Xuất kho ${quantity} sản phẩm theo FIFO`,
      created_by_user_id: userId, // Lấy từ JWT token
      ...(referenceId && { reference_id: referenceId }),
      ...(scopedReceiptItemId && { receipt_item_id: scopedReceiptItemId }),
    };

    const transaction = await this.createTransaction(
      transactionData,
      queryRunner,
    );

    const updateData: any = {
      quantity: newTotalQuantity,
      taxable_quantity_stock: newTaxableQuantityStock,
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

    return {
      transaction,
      affectedBatches,
      totalCostValue,
      averageCostUsed: currentAverageCost,
      remainingQuantity: newTotalQuantity,
      taxableQuantity: taxableQuantityToDeduct,
      taxSellingPrice: effectiveTaxSellingPrice,
    };
  }

  async previewStockOutItems(
    items: Array<{
      productId: number;
      quantity: number;
      priceType?: 'cash' | 'credit';
    }>,
  ): Promise<{
    items: Array<{
      productId: number;
      quantity: number;
      totalCostValue: number;
      averageCostUsed: number;
      taxableQuantity: number;
      taxSellingPrice: number;
      remainingQuantity: number;
      affectedBatches: Array<{
        batchId: number;
        deductedQuantity: number;
        taxableQuantity: number;
        remainingQuantity: number;
        cost: number;
        taxSellingPriceBaseUnit: number;
      }>;
    }>;
    totalCostValue: number;
  }> {
    const previews: Array<{
      productId: number;
      quantity: number;
      totalCostValue: number;
      averageCostUsed: number;
      taxableQuantity: number;
      taxSellingPrice: number;
      remainingQuantity: number;
      affectedBatches: Array<{
        batchId: number;
        deductedQuantity: number;
        taxableQuantity: number;
        remainingQuantity: number;
        cost: number;
        taxSellingPriceBaseUnit: number;
      }>;
    }> = [];
    let totalCostValue = 0;

    for (const item of items) {
      const productId = Number(item.productId || 0);
      const quantity = Number(item.quantity || 0);
      if (productId <= 0 || quantity <= 0) continue;

      const plan = await this.planStockOut(productId, quantity);
      const unitCostForPreview = this.resolveStockOutUnitCost(
        plan.product,
        quantity > 0 ? plan.totalCostValue / quantity : plan.currentAverageCost,
        item.priceType,
      );
      const totalCostForPreview = this.roundMoney(
        quantity * unitCostForPreview,
      );
      totalCostValue += totalCostForPreview;
      previews.push({
        productId,
        quantity,
        totalCostValue: totalCostForPreview,
        averageCostUsed: unitCostForPreview,
        taxableQuantity: plan.taxableQuantityToDeduct,
        taxSellingPrice: plan.effectiveTaxSellingPrice,
        remainingQuantity: plan.newTotalQuantity,
        affectedBatches: plan.affectedBatches,
      });
    }

    return {
      items: previews,
      totalCostValue: Math.round(totalCostValue * 100) / 100,
    };
  }

  /**
   * Tính lại giá vốn trung bình gia quyền cho sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Giá vốn trung bình gia quyền đã được tính lại
   */
  async recalculateWeightedAverageCost(
    productId: number,
    queryRunner?: QueryRunner,
  ): Promise<{
    productId: number;
    previousAverageCost: number;
    newAverageCost: number;
    totalQuantity: number;
    totalValue: number;
  }> {
    const previousAverageCost = await this.getWeightedAverageCost(productId);

    // Lấy tất cả lô hàng còn tồn kho
    const batchRepo = queryRunner
      ? queryRunner.manager.getRepository(InventoryBatch)
      : this.inventoryBatchRepository;
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
      totalQuantity += Number(batch.remaining_quantity);
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

        groups[productId].totalQuantity += Number(batch.remaining_quantity);
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

        stocks[productId].totalQuantity += Number(batch.remaining_quantity);
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
  async createReceipt(
    createInventoryReceiptDto: CreateInventoryReceiptDto,
    userId: number,
  ) {
    this.logger.log(
      `Bắt đầu tạo phiếu nhập kho: ${createInventoryReceiptDto.receipt_code || 'auto-generate'}`,
    );

    const queryRunner =
      this.inventoryReceiptRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tự sinh mã nếu không được cung cấp
      let receiptCode = createInventoryReceiptDto.receipt_code;
      if (!receiptCode) {
        receiptCode = CodeGeneratorHelper.generateUniqueCode('REC');
        this.logger.log(`Tự sinh mã phiếu nhập kho: ${receiptCode}`);
      }

      const settlementMode = await this.validateReceiptSettlementMode(
        createInventoryReceiptDto.items || [],
        createInventoryReceiptDto.supplier_settlement_mode,
        queryRunner,
      );

      // Tạo phiếu nhập kho
      const receiptData: any = {
        code: receiptCode,
        supplier_id: createInventoryReceiptDto.supplier_id,
        total_amount: createInventoryReceiptDto.total_amount,
        status: createInventoryReceiptDto.status,
        supplier_settlement_mode: settlementMode,

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
        receiptData.shared_shipping_cost =
          createInventoryReceiptDto.shared_shipping_cost;
      }

      // Thêm phương thức phân bổ phí vận chuyển
      if (createInventoryReceiptDto.shipping_allocation_method !== undefined) {
        receiptData.shipping_allocation_method =
          createInventoryReceiptDto.shipping_allocation_method;
      }

      // Thêm images nếu có
      if (
        createInventoryReceiptDto.images &&
        createInventoryReceiptDto.images.length > 0
      ) {
        receiptData.images = createInventoryReceiptDto.images;
      }

      // ===== XỬ LÝ THANH TOÁN =====
      const paidAmount = Math.round(
        Number(createInventoryReceiptDto.paid_amount) || 0,
      );

      const returnedAmount = Math.round(
        Number(receiptData.returned_amount) || 0,
      );

      // ===== VALIDATION: KHÔNG CHO PHÉP THANH TOÁN KHI TẠO PHIẾU NHÁP =====
      if (
        createInventoryReceiptDto.status === ReceiptStatus.DRAFT &&
        paidAmount > 0
      ) {
        throw new BadRequestException(
          'Không thể thanh toán cho phiếu nhập ở trạng thái nháp. Vui lòng duyệt phiếu trước khi thanh toán.',
        );
      }

      // ===== VALIDATION THANH TOÁN - CHỈ ÁP DỤNG KHI KHÔNG PHẢI PHIẾU NHÁP =====
      if (createInventoryReceiptDto.status !== ReceiptStatus.DRAFT) {
        // 1. Nếu có thanh toán, phải có payment_method (và không được là 'debt')
        if (paidAmount > 0) {
          if (!createInventoryReceiptDto.payment_method) {
            throw new BadRequestException(
              'Khi có thanh toán, phải chọn phương thức thanh toán (cash hoặc transfer)',
            );
          }
          if (createInventoryReceiptDto.payment_method === 'debt') {
            throw new BadRequestException(
              'Không thể chọn phương thức "Công nợ" khi đã có thanh toán',
            );
          }
        }
      }

      const isBySaleTypeSettlement =
        settlementMode === SupplierSettlementMode.BY_SALE_TYPE;

      if (isBySaleTypeSettlement) {
        this.validateBySaleTypeDiscountsAreFixedAmount(
          createInventoryReceiptDto.items,
        );
      }

      // Phiếu lúa giống quyết toán theo loại bán không phát sinh phải trả NCC
      // ngay khi nhập; chiết khấu chỉ dùng để giảm giá vốn tiền mặt/nợ.
      const goodsTotal = isBySaleTypeSettlement
        ? 0
        : createInventoryReceiptDto.items.reduce(
            (sum, item) => sum + this.calculateReceiptItemNetTotal(item),
            0,
          );

      // Phí vận chuyển do người dùng tự chịu, loại trừ phí vận chuyển (cả chung và riêng) khỏi công nợ NCC
      const excludedShipping =
        (Number(createInventoryReceiptDto.shared_shipping_cost) || 0) +
        createInventoryReceiptDto.items.reduce(
          (sum, item) => sum + (Number(item.individual_shipping_cost) || 0),
          0,
        );

      // Phải trả NCC = Tiền hàng - Trả hàng (nếu có)
      const supplierAmount = Math.round(goodsTotal - returnedAmount);

      // Tổng giá trị phiếu nhập = Phải trả NCC + Phí vận chuyển
      const calculatedTotalAmount = Math.round(
        supplierAmount + excludedShipping,
      );

      if (settlementMode === SupplierSettlementMode.STANDARD) {
        // VALIDATION: Nếu còn nợ NCC, phải có hạn thanh toán
        if (
          paidAmount < supplierAmount &&
          !createInventoryReceiptDto.payment_due_date &&
          createInventoryReceiptDto.status !== ReceiptStatus.DRAFT
        ) {
          throw new BadRequestException('Khi còn nợ, phải có hạn thanh toán');
        }

        const debtAmount = Math.max(0, Math.round(supplierAmount - paidAmount));
        const paymentStatus = this.resolveReceiptPaymentStatus(
          supplierAmount,
          paidAmount,
          settlementMode,
        );

        // Thêm các trường thanh toán vào receiptData
        receiptData.paid_amount = paidAmount;
        receiptData.payment_status = paymentStatus;
        receiptData.final_amount = supplierAmount; // supplier_amount là giá trị thực tế của hàng hóa
        receiptData.total_amount = calculatedTotalAmount; // Tổng giá trị bao gồm phí vận chuyển
        receiptData.supplier_amount = supplierAmount;
        receiptData.debt_amount = debtAmount;
      } else {
        receiptData.paid_amount = paidAmount;
        receiptData.payment_status = this.resolveReceiptPaymentStatus(
          0,
          paidAmount,
          settlementMode,
        );
        receiptData.final_amount = 0;
        receiptData.total_amount = calculatedTotalAmount;
        receiptData.supplier_amount = 0;
        receiptData.debt_amount = 0;
      }

      if (createInventoryReceiptDto.status === ReceiptStatus.APPROVED) {
        receiptData.approved_at = new Date();
        receiptData.approved_by = userId;
      }

      if (createInventoryReceiptDto.payment_method) {
        receiptData.payment_method = createInventoryReceiptDto.payment_method;
      }

      if (createInventoryReceiptDto.payment_due_date) {
        receiptData.payment_due_date =
          createInventoryReceiptDto.payment_due_date;
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
      const sharedShippingCost =
        createInventoryReceiptDto.shared_shipping_cost || 0;
      const allocationMethod =
        createInventoryReceiptDto.shipping_allocation_method || 'by_value';

      // Tính tổng giá trị và số lượng để phân bổ phí chung
      let totalValue = 0;
      let totalQuantity = 0;

      for (const item of createInventoryReceiptDto.items) {
        totalValue += isBySaleTypeSettlement
          ? this.calculateReceiptItemGrossTotal(item)
          : this.calculateReceiptItemNetTotal(item);
        totalQuantity += Number(item.quantity);
      }

      // Tính phí vận chuyển cho từng item
      const itemsWithShipping = createInventoryReceiptDto.items.map((item) => {
        let allocatedShipping = 0;
        // Phân bổ phí chung nếu có
        if (sharedShippingCost > 0) {
          if (allocationMethod === 'by_value' && totalValue > 0) {
            // Chia theo tỷ lệ giá trị
            const itemValue = isBySaleTypeSettlement
              ? this.calculateReceiptItemGrossTotal(item)
              : this.calculateReceiptItemNetTotal(item);
            allocatedShipping = (itemValue / totalValue) * sharedShippingCost;
          } else if (totalQuantity > 0) {
            // Chia đều theo số lượng
            allocatedShipping =
              (item.quantity / totalQuantity) * sharedShippingCost;
          }
        }

        // Tính tổng phí vận chuyển cho item
        const individualShipping = item.individual_shipping_cost || 0;
        const totalShippingForItem = individualShipping + allocatedShipping;

        // Tính giá vốn cuối cùng trên đơn vị: giá sau CK + phí vận chuyển phân bổ
        const shippingPerUnit = totalShippingForItem / item.quantity;
        const discountAmount = this.calculateReceiptItemDiscountAmount(item, {
          capAtGross: !isBySaleTypeSettlement,
        });
        const netUnitCost = isBySaleTypeSettlement
          ? this.roundMoney(Number(item.unit_cost || 0))
          : this.calculateReceiptItemNetUnitCost(item);
        const finalUnitCost = netUnitCost + shippingPerUnit;

        // DEBUG: Log để kiểm tra
        this.logger.log('=== TÍNH PHÍ VẬN CHUYỂN ===');
        this.logger.log(`Product ID: ${item.product_id}`);
        this.logger.log(`Final Unit Cost: ${finalUnitCost}`);

        return {
          ...item,
          discount_amount: discountAmount,
          discount_value: Number(item.discount_value || 0),
          discount_type: item.discount_type || 'fixed_amount',
          total_price: isBySaleTypeSettlement
            ? this.calculateReceiptItemGrossTotal(item)
            : this.calculateReceiptItemNetTotal(item),
          allocated_shipping_cost: Math.round(allocatedShipping),
          final_unit_cost: Math.round(finalUnitCost),
          // Không thay đổi unit_cost ở đây, giữ nguyên giá gốc từ FE để đối chiếu NCC
        };
      });

      // Tạo các item trong phiếu và xử lý nhập kho cho từng sản phẩm
      const savedItems: any[] = [];
      for (const item of itemsWithShipping) {
        // ✅ QUY ĐỔI ĐƠN VỊ TÍNH CHUẨN TỪ DB
        let dbConversionFactor = 1;
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.product_id },
          relations: ['unit_conversions'],
        });

        if (product && item.unit_id) {
          const conversions = product.unit_conversions || [];
          const conv = conversions.find(
            (c) => Number(c.unit_id) === Number(item.unit_id),
          );
          if (conv) {
            dbConversionFactor = Number(conv.conversion_factor || 1);
          } else if (Number(item.unit_id) === Number(product.unit_id)) {
            dbConversionFactor = 1;
          }
        }

        const itemData: any = {
          receipt_id: receiptEntity.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          vat_unit_cost: item.vat_unit_cost ?? item.unit_cost,
          tax_selling_price: item.tax_selling_price ?? null,
          total_price: item.total_price,
          discount_amount: item.discount_amount || 0,
          discount_value: item.discount_value || 0,
          discount_type: item.discount_type || 'fixed_amount',
          individual_shipping_cost: item.individual_shipping_cost || 0,
          allocated_shipping_cost: item.allocated_shipping_cost,
          final_unit_cost: item.final_unit_cost,
          batch_number: item.batch_number,
          unit_name: item.unit_name,

          // ✅ LƯU HỆ SỐ QUY ĐỔI ĐÃ XÁC THỰC
          unit_id: item.unit_id,
          conversion_factor: dbConversionFactor,
          base_quantity: item.quantity * dbConversionFactor,
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

        // Xử lý taxable_quantity: Dùng giá trị từ FE (cột SL Thuế)
        itemData.taxable_quantity = item.taxable_quantity || 0;
        this.validateReceiptItemTaxData(itemData);

        const itemEntity = queryRunner.manager.create(
          InventoryReceiptItem,
          itemData,
        );
        const savedItem = await queryRunner.manager.save(itemEntity);
        savedItems.push(savedItem);
      } // Kết thúc vòng lặp itemsWithShipping

      // Nếu tạo phiếu với trạng thái đã duyệt, thực hiện nhập kho ngay TRONG CÙNG TRANSACTION
      if (receiptData.status === ReceiptStatus.APPROVED) {
        try {
          this.logger.log(
            `Phiếu ${receiptEntity.code} được tạo với trạng thái APPROVED, đang xử lý nhập kho...`,
          );

          await this.applyBySaleTypeReceiptDiscountToProductCosts(
            savedItems,
            queryRunner,
          );

          let itemIndex = 1;
          for (const item of savedItems) {
            // ✅ Dùng số lượng đã quy đổi về đơn vị cơ sở (base_quantity) để nhập kho
            const stockInQuantity = item.base_quantity
              ? Number(item.base_quantity)
              : item.quantity;

            // ✅ Tính đơn giá chuẩn theo đơn vị cơ sở (Kg) bằng cách chia cho hệ số quy đổi
            // Ví dụ: 600.000 / Bao (50kg) -> 12.000 / Kg
            const unitCost = Number(item.final_unit_cost || item.unit_cost);
            const factor = Number(item.conversion_factor || 1);
            const normalizedCostPrice =
              factor > 0 ? unitCost / factor : unitCost;

            const batch = await this.processStockIn(
              item.product_id,
              stockInQuantity, // ← đã là số lượng quy đổi (Kg)
              normalizedCostPrice, // ← đơn giá cũng phải quy đổi tương ứng (VND/Kg)
              userId,
              item.id,
              `LOT-${receiptEntity.code.replace('REC-', '')}-${itemIndex}`,
              item.expiry_date ? new Date(item.expiry_date) : undefined,
              queryRunner,
              Number(item.taxable_quantity || 0) *
                Number(item.conversion_factor || 1),
            );

            // Cập nhật số lô ngược lại chi tiết phiếu nhập
            if (batch && batch.batch && batch.batch.code) {
              await queryRunner.manager.update(InventoryReceiptItem, item.id, {
                batch_number: batch.batch.code as string,
              });
            }
            itemIndex++;
          }

          // Cập nhật thời gian duyệt
          await queryRunner.manager.update(InventoryReceipt, receiptEntity.id, {
            approved_at: new Date(),
            approved_by: userId,
          });

          const affectedProductIds = Array.from(
            new Set(savedItems.map((i) => Number(i.product_id))),
          );
          for (const productId of affectedProductIds) {
            await this.recalculateAverageVatInputCost(productId, queryRunner);
          }
          await this.recalculateAverageCostPriceForProducts(
            affectedProductIds,
            queryRunner,
          );
        } catch (error) {
          this.logger.error(
            `Lỗi nhập kho tự động cho phiếu ${receiptEntity.code}:`,
            error,
          );
          // Throw error để rollback toàn bộ transaction
          throw new BadRequestException(
            `Lỗi nhập kho: ${error instanceof Error ? error.message : 'Unknown'}. Giao dịch đã được hủy bỏ hoàn toàn.`,
          );
        }
      }

      // ===== TẠO PAYMENT RECORD NẾU CÓ THANH TOÁN NGAY =====
      // Tạo payment record để lưu lịch sử thanh toán (audit trail)
      // KHÔNG dùng addPayment() vì nó sẽ cộng thêm vào paid_amount (đã set ở trên rồi)
      if (paidAmount > 0) {
        try {
          this.logger.log(
            `Tạo payment record cho phiếu ${receiptEntity.code}: ${paidAmount}đ`,
          );

          const paymentRepo = queryRunner.manager.getRepository(
            InventoryReceiptPayment,
          );
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
          this.logger.error(
            `Lỗi tạo payment record cho phiếu ${receiptEntity.code}:`,
            error,
          );
          throw new BadRequestException(
            `Lỗi tạo payment record: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
        }
      }

      await queryRunner.commitTransaction();

      if (receiptData.status === ReceiptStatus.APPROVED) {
        const affectedProductIds = Array.from(
          new Set(savedItems.map((i) => Number(i.product_id))),
        );
        const cutoverDate = await this.getTaxRevenueCutoverDateValue();
        for (const productId of affectedProductIds) {
          try {
            await this.syncTaxableDataForProduct(productId, cutoverDate);
          } catch (error) {
            this.logger.error(
              `Lỗi đồng bộ tồn thuế cho sản phẩm #${productId} sau khi tạo phiếu ${receiptEntity.code}:`,
              error instanceof Error ? error.message : 'Unknown error',
            );
          }
        }
      }

      const finalReceipt = await this.inventoryReceiptRepository.findOne({
        where: { id: receiptEntity.id },
        relations: ['supplier'], // Bao gồm thông tin nhà cung cấp
      });

      // ✅ Đánh dấu ảnh là đã sử dụng
      if (finalReceipt) {
        await this.markInventoryImagesAsUsed(
          'InventoryReceipt',
          finalReceipt.id,
          finalReceipt.images,
        );
      }

      return finalReceipt;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(
        `Lỗi khi tạo phiếu nhập kho: ${errorMessage}`,
        errorStack,
      );
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
        'payments',
        'payments.creator',
        'payments.creator.user_profile',
        'creator',
        'creator.user_profile',
        'approver',
        'approver.user_profile',
      ],
      order: {
        items: {
          id: 'ASC',
        } as any,
      },
    });

    if (receipt) {
      if (receipt.payments?.length) {
        receipt.payments.forEach((payment) => {
          if (payment.creator) {
            (payment.creator as any).full_name =
              payment.creator.user_profile?.nickname || payment.creator.account;
          }
        });
      }
      if (receipt.creator) {
        (receipt.creator as any).full_name =
          receipt.creator.user_profile?.nickname || receipt.creator.account;
      }
      if (receipt.approver) {
        (receipt.approver as any).full_name =
          receipt.approver.user_profile?.nickname || receipt.approver.account;
      }

      if (
        receipt.supplier_settlement_mode === SupplierSettlementMode.BY_SALE_TYPE
      ) {
        (receipt as any).supplier_settlement_summary =
          await this.buildReceiptSettlementSummary(id);
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
    transactions.forEach((t) => {
      if (t.creator) {
        (t.creator as any).full_name =
          t.creator.user_profile?.nickname || t.creator.account;
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
    const { payment_status, start_date, end_date, ...baseSearchDto } = searchDto;

    queryBuilder.leftJoinAndSelect('receipt.supplier', 'supplier');
    queryBuilder.leftJoinAndSelect('receipt.creator', 'creator');
    queryBuilder.leftJoinAndSelect('receipt.items', 'items');
    queryBuilder.leftJoinAndSelect('items.product', 'product');

    // 1. Base Search (Bỏ qua start_date, end_date để xử lý riêng theo bill_date)
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      baseSearchDto,
      'receipt',
      ['code', 'supplier.name', 'notes'], // Global search
    );

    // Xử lý lọc theo ngày nhập (bill_date), nếu null thì lấy created_at
    if (start_date && end_date) {
      queryBuilder.andWhere(
        '(COALESCE(receipt.bill_date, receipt.created_at) BETWEEN :start_date AND :end_date)',
        {
          start_date: new Date(start_date),
          end_date: new Date(end_date),
        },
      );
    } else if (start_date) {
      queryBuilder.andWhere(
        'COALESCE(receipt.bill_date, receipt.created_at) >= :start_date',
        { start_date: new Date(start_date) },
      );
    } else if (end_date) {
      queryBuilder.andWhere(
        'COALESCE(receipt.bill_date, receipt.created_at) <= :end_date',
        { end_date: new Date(end_date) },
      );
    }

    QueryHelper.applyFilters(
      queryBuilder,
      baseSearchDto,
      'receipt',
      ['filters', 'nested_filters', 'operator', 'payment_status'],
      {
        supplier_name: 'supplier.name',
        supplier_id: 'receipt.supplier_id',
        creator_account: 'creator.account',
      },
    );

    if (payment_status) {
      const payableAmountExpr =
        'COALESCE(receipt.supplier_amount, receipt.final_amount, receipt.total_amount, 0)';
      const effectivePaymentStatusExpr = `
        CASE
          WHEN receipt.supplier_settlement_mode = 'by_sale_type' THEN COALESCE(receipt.payment_status, 'unpaid')
          WHEN COALESCE(receipt.debt_amount, 0) <= 0
            AND COALESCE(receipt.paid_amount, 0) >= ${payableAmountExpr}
            THEN 'paid'
          ELSE COALESCE(receipt.payment_status, 'unpaid')
        END
      `;

      queryBuilder.andWhere(`${effectivePaymentStatusExpr} = :payment_status`, {
        payment_status,
      });
    }

    // 3. Sắp xếp theo ngày nhập (bill_date) mới nhất, sau đó đến ngày tạo (created_at)
    queryBuilder.orderBy('receipt.bill_date', 'DESC', 'NULLS LAST');
    queryBuilder.addOrderBy('receipt.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async exportReceipts(
    searchDto: SearchInventoryDto,
  ): Promise<InventoryReceipt[]> {
    const queryBuilder =
      this.inventoryReceiptRepository.createQueryBuilder('receipt');

    queryBuilder.leftJoinAndSelect('receipt.supplier', 'supplier');
    queryBuilder.leftJoinAndSelect('receipt.creator', 'creator');
    queryBuilder.leftJoinAndSelect('creator.user_profile', 'creator_profile');
    queryBuilder.leftJoinAndSelect('receipt.items', 'items');
    queryBuilder.leftJoinAndSelect('items.product', 'product');
    queryBuilder.leftJoinAndSelect('receipt.payments', 'payments');
    queryBuilder.leftJoinAndSelect('payments.creator', 'payment_creator');
    queryBuilder.leftJoinAndSelect(
      'payment_creator.user_profile',
      'payment_creator_profile',
    );

    const {
      payment_status,
      start_date,
      end_date,
      page,
      limit,
      status,
      ...baseSearchDto
    } = searchDto;

    QueryHelper.applyBaseSearch(queryBuilder, baseSearchDto, 'receipt', [
      'code',
      'supplier.name',
      'notes',
    ]);
    queryBuilder.skip(undefined);
    queryBuilder.take(undefined);
    queryBuilder.offset(undefined);
    queryBuilder.limit(undefined);

    if (start_date && end_date) {
      queryBuilder.andWhere(
        '(COALESCE(receipt.bill_date, receipt.created_at) BETWEEN :start_date AND :end_date)',
        {
          start_date: new Date(start_date),
          end_date: new Date(end_date),
        },
      );
    } else if (start_date) {
      queryBuilder.andWhere(
        'COALESCE(receipt.bill_date, receipt.created_at) >= :start_date',
        { start_date: new Date(start_date) },
      );
    } else if (end_date) {
      queryBuilder.andWhere(
        'COALESCE(receipt.bill_date, receipt.created_at) <= :end_date',
        { end_date: new Date(end_date) },
      );
    }

    QueryHelper.applyFilters(
      queryBuilder,
      { ...baseSearchDto, start_date, end_date },
      'receipt',
      [
        'filters',
        'nested_filters',
        'operator',
        'page',
        'limit',
        'sort',
        'payment_status',
      ],
      {
        supplier_name: 'supplier.name',
        supplier_id: 'receipt.supplier_id',
        creator_account: 'creator.account',
      },
    );

    if (payment_status) {
      const payableAmountExpr =
        'COALESCE(receipt.supplier_amount, receipt.final_amount, receipt.total_amount, 0)';
      const effectivePaymentStatusExpr = `
        CASE
          WHEN receipt.supplier_settlement_mode = 'by_sale_type' THEN COALESCE(receipt.payment_status, 'unpaid')
          WHEN COALESCE(receipt.debt_amount, 0) <= 0
            AND COALESCE(receipt.paid_amount, 0) >= ${payableAmountExpr}
            THEN 'paid'
          ELSE COALESCE(receipt.payment_status, 'unpaid')
        END
      `;

      queryBuilder.andWhere(`${effectivePaymentStatusExpr} = :payment_status`, {
        payment_status,
      });
    }

    queryBuilder.andWhere('receipt.status = :approvedStatus', {
      approvedStatus: ReceiptStatus.APPROVED,
    });

    queryBuilder.orderBy('receipt.bill_date', 'ASC', 'NULLS LAST');
    queryBuilder.addOrderBy('receipt.created_at', 'ASC');
    queryBuilder.addOrderBy('items.id', 'ASC');
    queryBuilder.addOrderBy('payments.payment_date', 'ASC');

    const receipts = await queryBuilder.getMany();

    receipts.forEach((receipt) => {
      if (receipt.creator) {
        (receipt.creator as any).full_name =
          receipt.creator.user_profile?.nickname || receipt.creator.account;
      }

      if (receipt.payments?.length) {
        receipt.payments.forEach((payment) => {
          if (payment.creator) {
            (payment.creator as any).full_name =
              payment.creator.user_profile?.nickname || payment.creator.account;
          }
        });
      }
    });

    return receipts;
  }

  /**
   * Lấy thống kê cho phiếu nhập hàng
   * @param supplier_id - ID nhà cung cấp (tùy chọn). Nếu có, chỉ thống kê phiếu của NCC đó
   */
  async getReceiptStats(
    supplier_id?: number,
    start_date?: string,
    end_date?: string,
  ) {
    const queryBuilder =
      this.inventoryReceiptRepository.createQueryBuilder('receipt');

    // Lọc theo nhà cung cấp nếu có
    if (supplier_id) {
      queryBuilder.where('receipt.supplier_id = :supplier_id', { supplier_id });
    }

    // Lọc theo ngày nhập (bill_date), nếu null thì lấy created_at
    if (start_date && end_date) {
      queryBuilder.andWhere(
        'COALESCE(receipt.bill_date, receipt.created_at) BETWEEN :start_date AND :end_date',
        {
          start_date: new Date(start_date),
          end_date: new Date(end_date),
        },
      );
    }

    // Nhóm các mã trạng thái để tương thích với dữ liệu thực tế trong DB
    const draftStatuses = "'draft', '1'";
    const approvedStatuses = "'approved', '2', '3', 'completed', '4'";
    const cancelledStatuses = "'cancelled', '5'";

    const stats = await queryBuilder
      .select('COUNT(*)', 'totalReceipts')
      .addSelect(
        `SUM(CASE WHEN receipt.status IN (${draftStatuses}) THEN 1 ELSE 0 END)`,
        'draftReceipts',
      )
      .addSelect(
        `SUM(CASE WHEN receipt.status IN (${approvedStatuses}) THEN 1 ELSE 0 END)`,
        'approvedReceipts',
      )
      .addSelect(
        `SUM(CASE WHEN receipt.status IN (${cancelledStatuses}) THEN 1 ELSE 0 END)`,
        'cancelledReceipts',
      )

      // ===== THỐNG KÊ TÀI CHÍNH: CHỈ TÍNH PHIẾU ĐÃ DUYỆT (BUSINESS LOGIC CHUẨN) =====
      .addSelect(
        `SUM(CASE WHEN receipt.status IN (${approvedStatuses}) AND CAST(receipt.debt_amount AS DECIMAL) > 0 THEN 1 ELSE 0 END)`,
        'debtReceiptsCount',
      )
      .addSelect(
        `SUM(CASE WHEN receipt.status IN (${approvedStatuses}) THEN CAST(receipt.total_amount AS DECIMAL) ELSE 0 END)`,
        'totalValue',
      )
      .addSelect(
        `SUM(CASE WHEN receipt.status IN (${approvedStatuses}) THEN CAST(receipt.paid_amount AS DECIMAL) ELSE 0 END)`,
        'totalPaid',
      )
      .addSelect(
        `SUM(CASE WHEN receipt.status IN (${approvedStatuses}) THEN CAST(receipt.debt_amount AS DECIMAL) ELSE 0 END)`,
        'totalDebt',
      )
      .getRawOne();

    // Tính giá trị hàng có hóa đơn (taxable value) - Join với item
    const taxableQuery = this.inventoryReceiptItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.receipt', 'receipt')
      .where(`receipt.status IN (${approvedStatuses})`)
      .andWhere('item.taxable_quantity > 0')
      .select(
        'SUM(CAST(item.taxable_quantity AS DECIMAL) * CAST(item.unit_cost AS DECIMAL))',
        'totalTaxableValue',
      );

    if (supplier_id) {
      taxableQuery.andWhere('receipt.supplier_id = :supplier_id', {
        supplier_id,
      });
    }
    if (start_date && end_date) {
      taxableQuery.andWhere(
        'COALESCE(receipt.bill_date, receipt.created_at) BETWEEN :start_date AND :end_date',
        {
          start_date: new Date(start_date),
          end_date: new Date(end_date),
        },
      );
    }

    const taxableResult = await taxableQuery.getRawOne();

    return {
      totalReceipts: parseInt(stats.totalReceipts || '0'),
      draftReceipts: parseInt(stats.draftReceipts || '0'),
      approvedReceipts: parseInt(stats.approvedReceipts || '0'),
      cancelledReceipts: parseInt(stats.cancelledReceipts || '0'),
      debtReceiptsCount: parseInt(stats.debtReceiptsCount || '0'),
      totalValue: stats.totalValue || '0',
      totalPaid: stats.totalPaid || '0',
      totalDebt: stats.totalDebt || '0',
      totalTaxableValue: taxableResult.totalTaxableValue || '0',
    };
  }

  /**
   * Tìm kiếm hàng hóa có hóa đơn (taxable_quantity > 0)
   */
  async searchTaxableItems(
    supplier_id?: number,
    start_date?: string,
    end_date?: string,
  ) {
    const queryBuilder = this.inventoryReceiptItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.receipt', 'receipt')
      .leftJoinAndSelect('receipt.supplier', 'supplier')
      .leftJoinAndSelect('item.product', 'product')
      .where("receipt.status IN ('approved', '2', '3', 'completed', '4')")
      .andWhere('item.taxable_quantity > 0');

    if (supplier_id) {
      queryBuilder.andWhere('receipt.supplier_id = :supplier_id', {
        supplier_id,
      });
    }
    if (start_date && end_date) {
      queryBuilder.andWhere(
        'COALESCE(receipt.bill_date, receipt.created_at) BETWEEN :start_date AND :end_date',
        {
          start_date: new Date(start_date),
          end_date: new Date(end_date),
        },
      );
    }

    queryBuilder.orderBy(
      'COALESCE(receipt.bill_date, receipt.created_at)',
      'DESC',
    );

    return queryBuilder.getMany();
  }

  private resolveInventoryReturnItemUnitSnapshot(
    item: CreateInventoryReturnDto['items'][number],
    receiptItems: InventoryReceiptItem[] = [],
    requireUniqueReceiptItem = false,
  ): {
    receiptItem: InventoryReceiptItem | undefined;
    receiptItemId: number | undefined;
    unitName: string | undefined;
    unitId: number | undefined;
    conversionFactor: number;
    baseQuantity: number;
  } {
    const submittedReceiptItemId = Number((item as any).receipt_item_id || 0);
    const hasSubmittedUnit =
      item.unit_id !== undefined && item.unit_id !== null;
    const baseCandidates = submittedReceiptItemId
      ? receiptItems.filter(
          (ri) =>
            Number(ri.id) === submittedReceiptItemId &&
            Number(ri.product_id) === Number(item.product_id),
        )
      : receiptItems.filter((ri) => {
          if (Number(ri.product_id) !== Number(item.product_id)) {
            return false;
          }
          if (hasSubmittedUnit) {
            return Number(ri.unit_id) === Number(item.unit_id);
          }
          return true;
        });
    const submittedUnitCost = Number((item as any).unit_cost || 0);
    const unitCostMatchedCandidates =
      baseCandidates.length > 1 && submittedUnitCost > 0
        ? baseCandidates.filter((ri) => {
            const receiptUnitCost = Number(
              ri.final_unit_cost ?? ri.unit_cost ?? 0,
            );
            return Math.abs(receiptUnitCost - submittedUnitCost) < 0.000001;
          })
        : baseCandidates;
    const matchingCandidates =
      unitCostMatchedCandidates.length > 0
        ? unitCostMatchedCandidates
        : baseCandidates;
    if (requireUniqueReceiptItem && matchingCandidates.length !== 1) {
      throw new BadRequestException(
        `Sản phẩm ID ${item.product_id} không xác định được duy nhất dòng nhập trong phiếu gốc. Vui lòng chọn đúng dòng hàng trước khi duyệt phiếu trả.`,
      );
    }
    const receiptItem =
      matchingCandidates[0] || undefined;

    const conversionFactor = Number(
      receiptItem?.conversion_factor || item.conversion_factor || 1,
    );
    const safeConversionFactor =
      Number.isFinite(conversionFactor) && conversionFactor > 0
        ? conversionFactor
        : 1;
    const quantity = Number(item.quantity || 0);
    const submittedBaseQuantity = Number(item.base_quantity || 0);
    const baseQuantity =
      !receiptItem &&
      Number.isFinite(submittedBaseQuantity) &&
      submittedBaseQuantity > 0
        ? submittedBaseQuantity
        : quantity * safeConversionFactor;

    return {
      receiptItem,
      receiptItemId: receiptItem?.id || submittedReceiptItemId || undefined,
      unitName: receiptItem?.unit_name || item.unit_name,
      unitId: receiptItem?.unit_id || item.unit_id,
      conversionFactor: safeConversionFactor,
      baseQuantity,
    };
  }

  private async validateInventoryReturnItemsAgainstReceipt(
    receiptId: number,
    items: Array<
      CreateInventoryReturnDto['items'][number] | InventoryReturnItem
    >,
    excludeReturnId?: number,
    queryRunner?: QueryRunner,
  ): Promise<InventoryReceiptItem[]> {
    const manager = queryRunner
      ? queryRunner.manager
      : this.inventoryReturnRepository.manager;
    const receiptItems = await manager.find(InventoryReceiptItem, {
      where: { receipt_id: receiptId },
    });

    const existingReturns = await manager.find(InventoryReturn, {
      where: { receipt_id: receiptId },
      relations: ['items'],
    });

    const returnedQuantityMap = new Map<string, number>();
    for (const ret of existingReturns) {
      if (excludeReturnId && Number(ret.id) === Number(excludeReturnId)) {
        continue;
      }
      if (ret.status === ReturnStatus.CANCELLED) continue;

      for (const item of ret.items || []) {
        const resolved = this.resolveInventoryReturnItemUnitSnapshot(
          item as CreateInventoryReturnDto['items'][number],
          receiptItems,
          true,
        );
        const itemKey = `receipt-item:${resolved.receiptItemId}`;
        const currentQty = returnedQuantityMap.get(itemKey) || 0;
        const returnedBaseQty = resolved.baseQuantity;
        returnedQuantityMap.set(itemKey, currentQty + returnedBaseQty);
      }
    }

    for (const newItem of items) {
      const { receiptItem, baseQuantity, receiptItemId } =
        this.resolveInventoryReturnItemUnitSnapshot(
          newItem,
          receiptItems,
          true,
        );

      if (!receiptItem || receiptItemId === undefined) {
        throw new BadRequestException(
          `Sản phẩm ID ${newItem.product_id} không có đúng dòng/đơn vị trong phiếu nhập gốc.`,
        );
      }

      const itemKey = `receipt-item:${receiptItemId}`;
      const alreadyReturned = returnedQuantityMap.get(itemKey) || 0;
      const receiptBaseQuantity = Number(
        receiptItem.base_quantity ||
          Number(receiptItem.quantity) *
            Number(receiptItem.conversion_factor || 1),
      );
      const totalAfterReturn = alreadyReturned + baseQuantity;

      if (totalAfterReturn > receiptBaseQuantity + 0.000001) {
        throw new BadRequestException(
          `Sản phẩm ID ${newItem.product_id}: Tổng số lượng trả quy đổi (${totalAfterReturn}) vượt quá số lượng nhập quy đổi (${receiptBaseQuantity}). Đã trả trước đó: ${alreadyReturned}.`,
        );
      }
      returnedQuantityMap.set(itemKey, totalAfterReturn);
    }
    return receiptItems;
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
    userId?: number,
  ): Promise<InventoryReceipt | null> {
    const receipt = await this.findReceiptById(id);
    if (!receipt) {
      throw new Error('Không tìm thấy phiếu nhập kho');
    }

    if (
      updateData.status !== undefined &&
      updateData.status !== receipt.status
    ) {
      throw new BadRequestException(
        'Không thể thay đổi trạng thái phiếu nhập qua API cập nhật. ' +
          'Hãy dùng chức năng duyệt phiếu nhập để chuyển phiếu nháp sang đã duyệt và ghi nhận tồn kho.',
      );
    }

    // VALIDATION: Nếu phiếu đã duyệt
    if (receipt.status === ReceiptStatus.APPROVED) {
      // Cho phép sửa một số trường không ảnh hưởng đến kho và giá vốn
      const allowedFields = [
        'supplier_id',
        'notes',
        'images',
        'bill_date',
        'payment_due_date',
        'shared_shipping_cost',
        'shipping_allocation_method',
      ];
      const attemptedFields = Object.keys(updateData);

      const invalidFields = attemptedFields.filter(
        (field) =>
          !allowedFields.includes(field) &&
          updateData[field as keyof CreateInventoryReceiptDto] !== undefined &&
          updateData[field as keyof CreateInventoryReceiptDto] !==
            receipt[field as keyof InventoryReceipt],
      );

      if (invalidFields.length > 0) {
        throw new BadRequestException(
          `Phiếu đã duyệt không được phép sửa các thông tin ảnh hưởng đến kho và giá vốn. Bạn chỉ có thể sửa: Nhà cung cấp, Ghi chú, Ảnh, Ngày hóa đơn, Phí bốc vác, Phương thức phân bổ. (Lỗi tại trường: ${invalidFields.join(', ')})`,
        );
      }
    } else if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new Error(
        'Chỉ có thể chỉnh sửa phiếu nhập kho ở trạng thái Nháp hoặc đã Duyệt (chỉ thông tin cơ bản).',
      );
    }

    // Map DTO fields to entity fields
    const entityUpdateData: any = {};
    if (updateData.receipt_code !== undefined)
      entityUpdateData.code = updateData.receipt_code;
    if (updateData.supplier_id !== undefined)
      entityUpdateData.supplier_id = updateData.supplier_id;
    if (updateData.total_amount !== undefined)
      entityUpdateData.total_amount = Math.round(updateData.total_amount);
    if (updateData.status !== undefined)
      entityUpdateData.status = updateData.status;
    if (updateData.notes !== undefined)
      entityUpdateData.notes = updateData.notes;
    if (updateData.images !== undefined)
      entityUpdateData.images = updateData.images;
    if (updateData.bill_date !== undefined)
      entityUpdateData.bill_date = updateData.bill_date;
    if (updateData.shared_shipping_cost !== undefined)
      entityUpdateData.shared_shipping_cost = Math.round(
        updateData.shared_shipping_cost,
      );
    if (updateData.shipping_allocation_method !== undefined)
      entityUpdateData.shipping_allocation_method =
        updateData.shipping_allocation_method;

    // === TÍNH TOÁN LẠI TÀI CHÍNH KHI UPDATE ===
    const paidAmount =
      updateData.paid_amount !== undefined
        ? Math.round(updateData.paid_amount)
        : receipt.paid_amount;
    const sharedShipping =
      updateData.shared_shipping_cost !== undefined
        ? Math.round(updateData.shared_shipping_cost)
        : receipt.shared_shipping_cost || 0;

    // Tính tổng tiền hàng sau chiết khấu từng dòng
    let goodsTotal = 0;
    let itemShipping = 0;

    if (updateData.items && Array.isArray(updateData.items)) {
      goodsTotal = updateData.items.reduce(
        (sum, item) => sum + this.calculateReceiptItemNetTotal(item),
        0,
      );
      itemShipping = updateData.items.reduce(
        (sum, item) => sum + (Number(item.individual_shipping_cost) || 0),
        0,
      );
    } else {
      // Nếu không gửi items mới, lấy từ items hiện tại trong DB
      const currentItems = await this.inventoryReceiptItemRepository.find({
        where: { receipt_id: id },
      });
      goodsTotal = currentItems.reduce(
        (sum, item) => sum + this.calculateReceiptItemNetTotal(item),
        0,
      );
      itemShipping = currentItems.reduce(
        (sum, item) => sum + (Number(item.individual_shipping_cost) || 0),
        0,
      );
    }

    // Phí vận chuyển do người dùng tự chịu
    const totalShipping = Number(sharedShipping) + Number(itemShipping);

    if (
      receipt.supplier_settlement_mode === SupplierSettlementMode.BY_SALE_TYPE
    ) {
      entityUpdateData.total_amount = Math.round(goodsTotal + totalShipping);
      entityUpdateData.paid_amount = paidAmount;
    } else {
      // Phải trả NCC = Tiền hàng (trước đây dùng final_amount nhưng đúng nhất là goodsTotal trừ trả hàng)
      // Giả định đơn giản: không cập nhật returned_amount ở đây (nó được cập nhật khi có phiếu trả hàng)
      const returnedAmount = Number(receipt.returned_amount || 0);
      const supplierAmount = Math.round(goodsTotal - returnedAmount);

      // Tổng giá trị phiếu nhập = Phải trả NCC + Phí vận chuyển
      const totalAmount = Math.round(supplierAmount + totalShipping);

      const debtAmount = Math.max(0, Math.round(supplierAmount - paidAmount));

      entityUpdateData.total_amount = totalAmount;
      entityUpdateData.final_amount = supplierAmount; // final_amount là giá trị hàng hóa thực tế
      entityUpdateData.supplier_amount = supplierAmount;
      entityUpdateData.debt_amount = debtAmount;
      entityUpdateData.paid_amount = paidAmount;
      entityUpdateData.payment_status = this.resolveReceiptPaymentStatus(
        supplierAmount,
        paidAmount,
        SupplierSettlementMode.STANDARD,
      );
    }

    if (updateData.payment_method !== undefined)
      entityUpdateData.payment_method = updateData.payment_method;
    if (updateData.payment_due_date !== undefined)
      entityUpdateData.payment_due_date = updateData.payment_due_date;

    await this.inventoryReceiptRepository.update(id, entityUpdateData);
    if (
      receipt.supplier_settlement_mode === SupplierSettlementMode.BY_SALE_TYPE
    ) {
      await this.recalculateBySaleTypeReceiptFinance(id);
    }
    const updatedReceipt = await this.findReceiptById(id);

    // ✅ Cập nhật theo dõi ảnh (increment/decrement refs)
    if (updatedReceipt) {
      await this.handleInventoryImageUpdate(
        'InventoryReceipt',
        id,
        receipt.images,
        updatedReceipt.images,
      );
    }

    // 1. LOGGING thay đổi metadata
    await this.logReceiptMetadataChanges(receipt, updateData, userId);

    // 2. XỬ LÝ PHÍ VẬN CHUYỂN NẾU PHIẾU ĐÃ DUYỆT
    if (
      receipt.status === ReceiptStatus.APPROVED &&
      (updateData.shared_shipping_cost !== undefined ||
        updateData.shipping_allocation_method !== undefined)
    ) {
      this.logger.log(
        `Phát hiện thay đổi phí vận chuyển trên phiếu đã duyệt #${id}. Bắt đầu tính toán lại giá vốn và tài chính...`,
      );
      await this.recalculateApprovedReceiptShipping(id);

      // Tính toán lại tài chính để đảm bảo supplier_amount và total_amount đúng
      await this.recalculateReceiptFinance(id);

      // Re-fetch để trả về data đã update
      return this.findReceiptById(id);
    }

    return updatedReceipt;
  }

  /**
   * Tính toán lại phí phân bổ và giá vốn cho phiếu nhập đã duyệt
   */
  private async recalculateApprovedReceiptShipping(receiptId: number) {
    const receipt = await this.inventoryReceiptRepository.findOne({
      where: { id: receiptId },
      relations: ['items'],
    });

    if (!receipt || !receipt.items || receipt.items.length === 0) return;

    const sharedShippingCost = Number(receipt.shared_shipping_cost) || 0;
    const allocationMethod = receipt.shipping_allocation_method || 'by_value';

    // Tính tổng giá trị và số lượng để phân bổ
    let totalValue = 0;
    let totalQuantity = 0;

    for (const item of receipt.items) {
      totalValue += this.calculateReceiptItemNetTotal(item);
      totalQuantity += Number(item.quantity);
    }

    const affectedProductIds = new Set<number>();

    for (const item of receipt.items) {
      let allocatedShipping = 0;
      if (sharedShippingCost > 0) {
        if (allocationMethod === 'by_value' && totalValue > 0) {
          const itemValue = this.calculateReceiptItemNetTotal(item);
          allocatedShipping = (itemValue / totalValue) * sharedShippingCost;
        } else if (allocationMethod === 'by_quantity' && totalQuantity > 0) {
          allocatedShipping =
            (Number(item.quantity) / totalQuantity) * sharedShippingCost;
        }
      }

      const individualShipping = Number(item.individual_shipping_cost) || 0;
      const totalShippingForItem = individualShipping + allocatedShipping;
      const shippingPerUnit = totalShippingForItem / Number(item.quantity);
      const finalUnitCost =
        this.calculateReceiptItemNetUnitCost(item) + shippingPerUnit;

      const roundedAllocatedShipping = Math.round(allocatedShipping);
      const roundedFinalUnitCost = Math.round(finalUnitCost);

      // 1. Cập nhật InventoryReceiptItem
      await this.inventoryReceiptItemRepository.update(item.id, {
        allocated_shipping_cost: roundedAllocatedShipping,
        final_unit_cost: roundedFinalUnitCost,
      });

      // 2. Cập nhật InventoryTransaction liên quan
      await this.inventoryTransactionRepository.update(
        { receipt_item_id: item.id },
        {
          unit_cost_price: roundedFinalUnitCost.toString(),
          total_value: (
            Number(item.quantity) * roundedFinalUnitCost
          ).toString(),
        },
      );

      // 3. Cập nhật InventoryBatch liên quan
      await this.inventoryBatchRepository.update(
        { receipt_item_id: item.id },
        { unit_cost_price: roundedFinalUnitCost.toString() },
      );

      item.allocated_shipping_cost = roundedAllocatedShipping;
      item.final_unit_cost = roundedFinalUnitCost;
      affectedProductIds.add(Number(item.product_id));
    }

    await this.syncSoldInvoicesForReceiptItems(receipt.items);

    if (affectedProductIds.size > 0) {
      this.logger.log(
        `ℹ️ Đã cập nhật lại batch/transaction cho phiếu #${receiptId}. average_cost_price không đổi theo phí bốc vác vì field này được chốt theo trung bình của tất cả phiếu nhập hợp lệ.`,
      );
    }
  }

  private async syncSoldInvoicesForReceiptItems(
    receiptItems: InventoryReceiptItem[],
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = this.getManager(queryRunner);
    const receiptItemIds = Array.from(
      new Set(
        receiptItems.map((item) => Number(item.id || 0)).filter((id) => id > 0),
      ),
    );

    if (receiptItemIds.length === 0) {
      return;
    }

    const receiptItemMap = new Map(
      receiptItems.map((item) => [Number(item.id), item]),
    );
    const allocations = await manager.find(SalesInvoiceItemStockAllocation, {
      where: { receipt_item_id: In(receiptItemIds) },
      order: { id: 'ASC' },
    });

    if (allocations.length === 0) {
      return;
    }

    const affectedInvoiceIds = new Set<number>();

    for (const allocation of allocations) {
      const receiptItem = allocation.receipt_item_id
        ? receiptItemMap.get(Number(allocation.receipt_item_id))
        : null;

      if (!receiptItem) {
        continue;
      }

      const conversionFactor = Number(receiptItem.conversion_factor || 1);
      const normalizedConversionFactor =
        conversionFactor > 0 ? conversionFactor : 1;
      const baseUnitCost = this.roundMoney(
        Number(receiptItem.final_unit_cost ?? receiptItem.unit_cost ?? 0) /
          normalizedConversionFactor,
      );
      const totalCost = this.roundMoney(
        Number(allocation.quantity || 0) * baseUnitCost,
      );

      await manager.update(SalesInvoiceItemStockAllocation, allocation.id, {
        unit_cost: baseUnitCost,
        total_cost: totalCost,
      });

      if (allocation.invoice_id) {
        affectedInvoiceIds.add(Number(allocation.invoice_id));
      }
    }

    for (const invoiceId of affectedInvoiceIds) {
      await this.syncInvoiceCostSnapshotFromAllocations(invoiceId, queryRunner);
      await this.syncSupplierSettlementForPostedInvoice(invoiceId, queryRunner);
    }

    this.logger.log(
      `✅ Đã đồng bộ lại giá vốn cho ${affectedInvoiceIds.size} hóa đơn bán liên quan tới ${receiptItemIds.length} dòng phiếu nhập.`,
    );
  }

  private async syncInvoiceCostSnapshotFromAllocations(
    invoiceId: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = this.getManager(queryRunner);
    const invoice = await manager.findOne(SalesInvoice, {
      where: { id: invoiceId },
      relations: ['items'],
    });

    if (!invoice || !invoice.items || invoice.items.length === 0) {
      return;
    }

    let totalCOGS = 0;

    for (const item of invoice.items) {
      const baseQty = Number(item.base_quantity || item.quantity || 0);
      const isByPriceType =
        item.costing_method_snapshot === ProductCostingMethod.BY_PRICE_TYPE;

      if (isByPriceType) {
        const snapshotCostPrice = Number(item.cost_price || 0);

        if (!Number.isFinite(snapshotCostPrice) || snapshotCostPrice <= 0) {
          throw new BadRequestException(
            `Item #${item.id} của hóa đơn #${invoice.code} chưa có giá vốn snapshot theo price_type`,
          );
        }

        totalCOGS += this.roundMoney(baseQty * snapshotCostPrice);
        continue;
      }

      const allocations = await manager.find(SalesInvoiceItemStockAllocation, {
        where: { sales_invoice_item_id: item.id },
      });

      let itemTotalCost = 0;
      let itemCostPrice = 0;

      if (allocations.length > 0) {
        const allocatedQty = allocations.reduce(
          (sum, allocation) => sum + Number(allocation.quantity || 0),
          0,
        );
        itemTotalCost = allocations.reduce(
          (sum, allocation) => sum + Number(allocation.total_cost || 0),
          0,
        );
        itemCostPrice = allocatedQty > 0 ? itemTotalCost / allocatedQty : 0;
      } else {
        const tx = await manager.findOne(InventoryTransaction, {
          where: {
            type: 'OUT',
            reference_type: 'SALE',
            reference_id: invoiceId,
            product_id: item.product_id,
          },
          order: { created_at: 'ASC', id: 'ASC' },
        });

        if (!tx) {
          throw new BadRequestException(
            `Không tìm thấy giao dịch kho để chốt giá vốn cho item #${item.id} của hóa đơn #${invoice.code}`,
          );
        }

        itemTotalCost = Math.abs(Number(tx.total_value || 0));
        itemCostPrice = baseQty > 0 ? itemTotalCost / baseQty : 0;
      }

      totalCOGS += itemTotalCost;

      await manager.update(SalesInvoiceItem, item.id, {
        cost_price: this.roundMoney(itemCostPrice),
      });
    }

    const roundedCOGS = this.roundMoney(totalCOGS);
    const grossProfit = this.roundMoney(
      Number(invoice.final_amount || 0) - roundedCOGS,
    );
    const grossProfitMargin =
      Number(invoice.final_amount || 0) > 0
        ? Math.round(
            (grossProfit / Number(invoice.final_amount || 0)) * 10000,
          ) / 100
        : 0;

    await manager.update(SalesInvoice, invoiceId, {
      cost_of_goods_sold: roundedCOGS,
      gross_profit: grossProfit,
      gross_profit_margin: grossProfitMargin,
    });
  }

  /**
   * Log các thay đổi về metadata của phiếu nhập
   */
  private async logReceiptMetadataChanges(
    oldData: InventoryReceipt,
    newData: Partial<CreateInventoryReceiptDto>,
    userId?: number,
  ) {
    const changes: any[] = [];
    const fieldsToTrack = [
      'supplier_id',
      'notes',
      'bill_date',
      'payment_due_date',
      'status',
    ];

    for (const field of fieldsToTrack) {
      if (
        newData[field as keyof CreateInventoryReceiptDto] !== undefined &&
        String(newData[field as keyof CreateInventoryReceiptDto]) !==
          String(oldData[field as keyof InventoryReceipt])
      ) {
        changes.push({
          field,
          old: oldData[field as keyof InventoryReceipt],
          new: newData[field as keyof CreateInventoryReceiptDto],
        });
      }
    }

    if (changes.length > 0) {
      await this.logReceiptChange(
        oldData.id,
        'UPDATE_METADATA',
        JSON.stringify(changes),
        userId,
      );
    }
  }

  /**
   * Lưu lịch sử thay đổi của phiếu nhập
   */
  async logReceiptChange(
    receiptId: number,
    action: string,
    details: string,
    userId?: number,
    queryRunner?: QueryRunner,
  ) {
    const repository = queryRunner
      ? queryRunner.manager.getRepository(InventoryReceiptLog)
      : this.inventoryReceiptLogRepository;
    const log = repository.create({
      receipt_id: receiptId,
      action,
      details,
      created_by: userId ?? null,
    } as any);
    return repository.save(log);
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
        'Không thể xóa phiếu đã có giao dịch thanh toán. Vui lòng hủy phiếu và tạo phiếu điều chỉnh công nợ.',
      );
    }

    // KHÔNG cho phép xóa phiếu 'cancelled' nếu đã từng 'approved' (để giữ audit trail)
    if (receipt.status !== ReceiptStatus.DRAFT) {
      if (receipt.status === ReceiptStatus.CANCELLED) {
        // Kiểm tra xem phiếu này có approved_at không (tức là đã từng approved và tác động kho)
        if (receipt.approved_at) {
          throw new BadRequestException(
            'Không thể xóa phiếu đã từng duyệt (đã tác động kho) và bị hủy. Dữ liệu cần được giữ lại để đối soát.',
          );
        }
        // Nếu là cancelled nhưng chưa approved bao giờ (cancel từ draft) thì cho xóa
      } else {
        throw new BadRequestException(
          'Không thể xóa phiếu nhập kho đang hoạt động. Vui lòng hủy phiếu thay thế.',
        );
      }
    }

    // ✅ Gỡ các reference trước khi xóa
    if (receipt.images && receipt.images.length > 0) {
      for (const url of receipt.images) {
        await this.fileTrackingService.removeFileReferenceByUrl(
          url,
          'InventoryReceipt',
          id,
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
  async approveReceipt(
    id: number,
    userId: number,
  ): Promise<InventoryReceipt | null> {
    const queryRunner =
      this.inventoryReceiptRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const receipt = await queryRunner.manager.findOne(InventoryReceipt, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!receipt) {
        await queryRunner.release();
        return null;
      }

      if (receipt.status !== ReceiptStatus.DRAFT) {
        throw new BadRequestException(
          'Chỉ có thể duyệt phiếu ở trạng thái nháp',
        );
      }

      // Lấy danh sách chi tiết phiếu nhập thông qua queryRunner
      const items = await queryRunner.manager.find(InventoryReceiptItem, {
        where: { receipt_id: id },
      });

      receipt.supplier_settlement_mode =
        await this.validateReceiptSettlementMode(
          items.map((item) => ({ product_id: item.product_id })),
          receipt.supplier_settlement_mode,
          queryRunner,
        );

      if (
        receipt.supplier_settlement_mode ===
        SupplierSettlementMode.BY_SALE_TYPE
      ) {
        this.validateBySaleTypeDiscountsAreFixedAmount(items);
      }

      await this.applyBySaleTypeReceiptDiscountToProductCosts(
        items,
        queryRunner,
      );

      // Xử lý nhập kho cho từng sản phẩm ngay khi duyệt
      let itemIndex = 1;
      for (const item of items) {
        this.validateReceiptItemTaxData(item);

        // Lấy số lượng khai thuế từ item (nếu không có thì mặc định = 0)
        const taxableQty = Number(item.taxable_quantity || 0);
        const taxableBaseQty = taxableQty * Number(item.conversion_factor || 1);

        // ✅ Tính số lượng thực tế nhập kho theo đơn vị cơ sở (base_quantity)
        const stockInQuantity = item.base_quantity
          ? Number(item.base_quantity)
          : Number(item.quantity);

        // ✅ Nhập kho theo giá vốn cuối cùng đã gồm phí vận chuyển/bốc vác phân bổ.
        // final_unit_cost đang lưu theo đơn vị nhập, nên phải quy đổi về đơn vị cơ sở.
        const itemUnitCost = Number(
          item.final_unit_cost ?? item.unit_cost ?? 0,
        );
        const conversionFactor = Number(item.conversion_factor || 1);
        const normalizedCostPrice =
          conversionFactor > 0 ? itemUnitCost / conversionFactor : itemUnitCost;

        const batch = await this.processStockIn(
          item.product_id,
          stockInQuantity, // ← dùng số lượng đã quy đổi về đơn vị cơ sở
          normalizedCostPrice, // ← dùng đơn giá đã chuẩn hóa về KG
          userId,
          item.id,
          `LOT-${receipt.code.replace('REC-', '')}-${itemIndex}`,
          item.expiry_date ? new Date(item.expiry_date) : undefined,
          queryRunner,
          taxableBaseQty, // Truyền số lượng thuế quy về đơn vị cơ sở
        );

        // Cập nhật số lô ngược lại chi tiết phiếu nhập
        if (batch && batch.batch && batch.batch.code) {
          await queryRunner.manager.update(InventoryReceiptItem, item.id, {
            batch_number: batch.batch.code as string,
          });
        }
        itemIndex++;
      }

      const affectedProductIds = Array.from(
        new Set(items.map((i) => Number(i.product_id))),
      );
      for (const productId of affectedProductIds) {
        await this.recalculateAverageVatInputCost(productId, queryRunner);
      }
      await this.recalculateAverageCostPriceForProducts(
        affectedProductIds,
        queryRunner,
      );

      receipt.status = ReceiptStatus.APPROVED;
      receipt.approved_at = new Date();
      receipt.approved_by = userId;

      const savedReceipt = await queryRunner.manager.save(receipt);
      await queryRunner.commitTransaction();

      return savedReceipt;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi duyệt phiếu nhập kho #${id}:`, error);
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
    const cancellationReason = reason?.trim() || 'Không ghi lý do';
    const queryRunner =
      this.inventoryReceiptRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let affectedProductIds: number[] = [];

    try {
      const receipt = await queryRunner.manager.findOne(InventoryReceipt, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!receipt) {
        await queryRunner.release();
        throw new NotFoundException('Không tìm thấy phiếu nhập kho');
      }

      // Validate: Không cho phép cancel phiếu đã cancelled
      if (receipt.status === ReceiptStatus.CANCELLED) {
        throw new BadRequestException('Phiếu nhập kho đã bị hủy trước đó');
      }
      const wasApproved = receipt.status === ReceiptStatus.APPROVED;

      // Nếu phiếu đã duyệt (APPROVED) → Cần rollback inventory
      if (wasApproved) {
        await this.rollbackReceiptInventory(
          id,
          userId,
          cancellationReason,
          queryRunner,
        );
      }

      receipt.status = ReceiptStatus.CANCELLED;
      receipt.cancelled_at = new Date();
      receipt.cancelled_reason = cancellationReason;

      const savedReceipt = await queryRunner.manager.save(receipt);

      if (wasApproved) {
        const receiptItems = await queryRunner.manager.find(
          InventoryReceiptItem,
          {
            where: { receipt_id: id },
          },
        );
        affectedProductIds = Array.from(
          new Set(receiptItems.map((i) => Number(i.product_id))),
        );
        for (const productId of affectedProductIds) {
          await this.recalculateAverageVatInputCost(productId, queryRunner);
        }
        await this.recalculateAverageCostPriceForProducts(
          affectedProductIds,
          queryRunner,
        );
      }

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
    queryRunner?: QueryRunner,
  ) {
    this.logger.log(`Bắt đầu rollback inventory cho receipt #${receiptId}`);
    const items = queryRunner
      ? await queryRunner.manager.find(InventoryReceiptItem, {
          where: { receipt_id: receiptId },
        })
      : await this.getReceiptItems(receiptId);

    for (const item of items) {
      try {
        // Tạo transaction xuất kho (ngược lại với nhập kho)
        // Dùng referenceType đặc biệt để tracking
        // ✅ Dùng số lượng đã quy đổi về đơn vị cơ sở (base_quantity) để hoàn tác
        // ✅ Tính số lượng thực tế hoàn tác dựa trên hệ số quy đổi để đảm bảo chính xác cho cả dữ liệu cũ
        const conversionFactor = Number(item.conversion_factor || 1);
        const stockOutQuantity =
          item.base_quantity && Number(item.base_quantity) > item.quantity
            ? Number(item.base_quantity)
            : item.quantity * conversionFactor;

        await this.processStockOut(
          item.product_id,
          stockOutQuantity, // ← dùng số lượng quy đổi
          'RECEIPT_CANCELLATION',
          userId,
          receiptId,
          `Hủy phiếu nhập #${receiptId} (Sản phẩm ${item.product_id}): ${reason}`,
          queryRunner,
          { receiptItemId: item.id },
        );
      } catch (error) {
        this.logger.error(
          `Lỗi khi rollback inventory cho sản phẩm ${item.product_id} trong receipt #${receiptId}:`,
          error,
        );
        // Trong trường hợp rollback lỗi, ta vẫn ném lỗi ra để ngừng quá trình cancel
        // Để admin có thể xử lý thủ công hoặc thử lại
        throw new BadRequestException(
          `Không thể hủy phiếu nhập kho: ${error instanceof Error ? error.message : 'Lỗi khi hoàn tác tồn kho'}`,
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
      // Load đầy đủ quan hệ sản phẩm để frontend hiển thị tên, đơn vị tính
      relations: [
        'product',
        'product.unit',
        'product.unit_conversions',
        'product.unit_conversions.unit',
      ],
    });
  }

  /**
   * Cập nhật thông tin chi tiết phiếu nhập kho
   * @param id - ID của chi tiết phiếu nhập kho cần cập nhật
   * @param updateData - Dữ liệu cập nhật chi tiết phiếu nhập kho
   * @param userId - ID người thực hiện
   * @returns Thông tin chi tiết phiếu nhập kho đã cập nhật
   */
  async updateReceiptItem(
    id: number,
    updateData: Partial<CreateInventoryReceiptItemDto>,
    userId?: number,
  ): Promise<InventoryReceiptItem | null> {
    // Lấy thông tin item và phiếu nhập
    const item = await this.inventoryReceiptItemRepository.findOne({
      where: { id },
      relations: ['receipt'],
    });

    if (!item) {
      throw new NotFoundException(`Không tìm thấy chi tiết phiếu nhập #${id}`);
    }

    const receipt = item.receipt;

    // VALIDATION: Nếu phiếu đã duyệt
    if (receipt && receipt.status === ReceiptStatus.APPROVED) {
      // Cho phép sửa "Số lượng thuế", "Đơn giá VAT" và "Đơn giá mua" (mới thêm)
      const allowedFields = [
        'taxable_quantity',
        'vat_unit_cost',
        'tax_selling_price',
        'unit_cost',
        'notes',
      ];
      const attemptedFields = Object.keys(updateData);

      const invalidFields = attemptedFields.filter(
        (field) => !allowedFields.includes(field),
      );

      if (invalidFields.length > 0) {
        throw new BadRequestException(
          `Phiếu đã duyệt chỉ được phép sửa "Đơn giá", "Số lượng thuế", "Đơn giá VAT", "Giá bán khai thuế" và "Ghi chú". Không được sửa: ${invalidFields.join(', ')}`,
        );
      }

      this.logger.log(
        `Cập nhật đơn giá/thuế cho item #${id} của phiếu đã duyệt ${receipt.code}`,
      );
    }

    // Nếu sửa unit_cost, tự động cập nhật total_price cho item
    if (updateData.unit_cost !== undefined) {
      updateData.total_price =
        Number(item.quantity) * Number(updateData.unit_cost);
    }

    this.validateReceiptItemTaxData({
      quantity: Number(updateData.quantity ?? item.quantity),
      taxable_quantity:
        updateData.taxable_quantity !== undefined
          ? Number(updateData.taxable_quantity)
          : Number(item.taxable_quantity || 0),
      tax_selling_price:
        updateData.tax_selling_price !== undefined
          ? Number(updateData.tax_selling_price)
          : Number(item.tax_selling_price || 0),
    });

    let updatedItem: InventoryReceiptItem | null;
    if (updateData.taxable_quantity !== undefined) {
      updatedItem = await this.updateReceiptItemTaxQuantity(
        item,
        updateData,
        userId,
      );
    } else {
      await this.logReceiptItemChanges(item, updateData, userId);
      await this.inventoryReceiptItemRepository.update(id, updateData);
      updatedItem = await this.inventoryReceiptItemRepository.findOne({
        where: { id },
      });
    }

    if (updatedItem) {
      if (
        updateData.taxable_quantity === undefined &&
        updateData.vat_unit_cost !== undefined
      ) {
        await this.recalculateAverageVatInputCost(updatedItem.product_id);
      }

      // 3. ĐỒNG BỘ GIÁ VỐN VÀO GIAO DỊCH VÀ LÔ HÀNG (Nếu đã duyệt)
      if (
        receipt &&
        receipt.status === ReceiptStatus.APPROVED &&
        updateData.unit_cost !== undefined
      ) {
        // Nếu thay đổi đơn giá mua, ta cần tính toán lại toàn bộ phí phân bổ
        // (vì tổng giá trị đơn hàng thay đổi, ảnh hưởng đến tỷ lệ phân bổ by_value)
        this.logger.log(
          `Đơn giá sản phẩm #${updatedItem.product_id} thay đổi trên phiếu đã duyệt. Tính toán lại toàn bộ chi phí...`,
        );
        await this.recalculateApprovedReceiptShipping(updatedItem.receipt_id);

        // Tính lại tổng tiền phiếu nhập và công nợ (Finance)
        await this.recalculateReceiptFinance(updatedItem.receipt_id);
        // average_cost_price phải bám theo toàn bộ phiếu nhập hợp lệ,
        // nên sau khi đổi đơn giá trên phiếu đã duyệt phải tính lại từ lịch sử phiếu nhập.
        await this.recalculateAverageCostPriceFromValidReceipts(
          updatedItem.product_id,
        );
      }
    }

    return this.inventoryReceiptItemRepository.findOne({
      where: { id },
      relations: ['product', 'receipt'],
    });
  }

  private async updateReceiptItemTaxQuantity(
    previous: InventoryReceiptItem,
    updateData: Partial<CreateInventoryReceiptItemDto>,
    userId?: number,
  ): Promise<InventoryReceiptItem> {
    const requestedTax = updateData.taxable_quantity;
    if (
      typeof requestedTax !== 'number' ||
      !Number.isInteger(requestedTax) ||
      requestedTax < 0
    ) {
      throw new BadRequestException(
        'Số lượng thuế phải là số nguyên không âm.',
      );
    }
    return this.withStockTransaction(async (runner) => {
      const manager = runner.manager;
      const wasApproved = previous.receipt?.status === ReceiptStatus.APPROVED;
      // Khóa phiếu trước khi đọc trạng thái; duyệt và hủy phiếu dùng thứ tự này.
      const receipt = await manager.findOne(InventoryReceipt, {
        where: { id: previous.receipt_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !receipt ||
        receipt.status !== previous.receipt?.status ||
        (receipt.status !== ReceiptStatus.DRAFT &&
          receipt.status !== ReceiptStatus.APPROVED)
      ) {
        throw new BadRequestException(
          'Trạng thái phiếu nhập đã thay đổi hoặc không cho phép sửa số lượng thuế. Vui lòng tải lại phiếu.',
        );
      }
      if (wasApproved) {
        const product = await manager.findOne(Product, {
          where: { id: previous.product_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product)
          throw new NotFoundException('Không tìm thấy sản phẩm của dòng nhập.');
      }
      const item = await manager.findOne(InventoryReceiptItem, {
        where: { id: previous.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !item ||
        item.receipt_id !== previous.receipt_id ||
        item.product_id !== previous.product_id
      ) {
        throw new BadRequestException(
          'Dòng nhập đã thay đổi. Vui lòng tải lại phiếu.',
        );
      }
      this.validateReceiptItemTaxData({ ...item, ...updateData });
      if (wasApproved && requestedTax !== Number(item.taxable_quantity || 0)) {
        await manager.query(
          'SELECT id FROM inventories WHERE receipt_item_id=$1 ORDER BY id FOR UPDATE',
          [item.id],
        );
        const [plan] = (await manager.query(RECEIPT_TAX_EDIT_PLAN_SQL, [
          item.id,
          requestedTax,
        ])) as ReceiptTaxEditPlan[];
        if (!plan) {
          throw new BadRequestException(
            'Không thể sửa số lượng thuế: lô đã phát sinh xuất/hoàn hoặc dữ liệu nguồn, số dư chưa đủ căn cứ. Cần đối soát riêng.',
          );
        }
        await manager.update(InventoryBatch, plan.batch_id, {
          taxable_remaining_quantity: Number(plan.new_batch_tax),
        });
        await manager.update(Product, item.product_id, {
          taxable_quantity_stock: Number(plan.new_product_tax),
        });
      }
      await this.logReceiptItemChanges(item, updateData, userId, runner);
      await manager.update(InventoryReceiptItem, item.id, updateData);
      if (wasApproved)
        await this.recalculateAverageVatInputCost(item.product_id, runner);
      const updatedItem = await manager.findOne(InventoryReceiptItem, {
        where: { id: item.id },
      });
      if (!updatedItem)
        throw new NotFoundException('Không tìm thấy dòng nhập sau cập nhật.');
      return updatedItem;
    });
  }

  /**
   * Tính toán lại toàn bộ tài chính của một phiếu nhập hàng dựa trên danh sách item hiện tại
   * @param receiptId - ID của phiếu nhập kho
   */
  private async recalculateReceiptFinance(receiptId: number) {
    const receipt = await this.inventoryReceiptRepository.findOne({
      where: { id: receiptId },
      relations: ['items'],
    });

    if (!receipt) return;

    if (
      receipt.supplier_settlement_mode === SupplierSettlementMode.BY_SALE_TYPE
    ) {
      await this.recalculateBySaleTypeReceiptFinance(receiptId);
      return;
    }

    // Tính tổng tiền hàng thực nợ NCC sau chiết khấu từng dòng
    const goodsTotal = receipt.items.reduce(
      (sum, item) => sum + this.calculateReceiptItemNetTotal(item),
      0,
    );

    const paidAmount = Number(receipt.paid_amount || 0);
    const sharedShipping = Number(receipt.shared_shipping_cost || 0);

    // Tính tổng phí bốc vác riêng của từng item
    const itemShipping = receipt.items.reduce(
      (sum, item) => sum + (Number(item.individual_shipping_cost) || 0),
      0,
    );

    const totalShipping = Number(sharedShipping) + Number(itemShipping);

    // supplier_amount là tiền hàng (không bao gồm phí vận chuyển tự chịu)
    const supplierAmount = Math.round(goodsTotal);

    // total_amount là TỔNG GIÁ TRỊ PHIẾU (Tiền hàng + Phí vận chuyển)
    const totalAmount = Math.round(supplierAmount + totalShipping);

    const debtAmount = Math.max(0, Math.round(supplierAmount - paidAmount));

    await this.inventoryReceiptRepository.update(receiptId, {
      total_amount: totalAmount,
      final_amount: supplierAmount,
      supplier_amount: supplierAmount,
      debt_amount: debtAmount,
      payment_status: this.resolveReceiptPaymentStatus(
        supplierAmount,
        paidAmount,
        SupplierSettlementMode.STANDARD,
      ),
    });

    this.logger.log(
      `✅ Đã tính lại tài chính cho phiếu #${receiptId}: Tiền hàng=${supplierAmount}, Tổng=${totalAmount}, Nợ=${debtAmount}`,
    );
  }

  /**
   * Log các thay đổi của một item trong phiếu
   */
  private async logReceiptItemChanges(
    oldData: InventoryReceiptItem,
    newData: Partial<CreateInventoryReceiptItemDto>,
    userId?: number,
    queryRunner?: QueryRunner,
  ) {
    const changes: any[] = [];
    const fieldsToTrack = [
      'unit_cost',
      'taxable_quantity',
      'vat_unit_cost',
      'tax_selling_price',
    ];

    for (const field of fieldsToTrack) {
      if (
        newData[field] !== undefined &&
        String(newData[field]) !== String(oldData[field])
      ) {
        changes.push({
          item_id: oldData.id,
          field,
          old: oldData[field],
          new: newData[field],
        });
      }
    }

    if (changes.length > 0) {
      await this.logReceiptChange(
        oldData.receipt_id,
        'UPDATE_ITEM',
        JSON.stringify(changes),
        userId,
        queryRunner,
      );
    }
  }

  private validateReceiptItemTaxData(item: {
    quantity?: number;
    taxable_quantity?: number;
    tax_selling_price?: number | null;
  }) {
    const quantity = Number(item.quantity || 0);
    const taxableQuantity = Number(item.taxable_quantity || 0);
    const taxSellingPrice = Number(item.tax_selling_price || 0);

    if (taxableQuantity < 0) {
      throw new BadRequestException('Số lượng thuế không được nhỏ hơn 0.');
    }

    if (quantity > 0 && taxableQuantity > quantity) {
      throw new BadRequestException(
        'Số lượng thuế không được lớn hơn số lượng nhập.',
      );
    }

    if (taxableQuantity > 0 && taxSellingPrice <= 0) {
      throw new BadRequestException(
        'Dòng hàng có số lượng thuế phải nhập giá bán khai thuế lớn hơn 0.',
      );
    }
  }

  private async getTaxRevenueCutoverDateValue(): Promise<string> {
    const currentSetting = await this.systemSettingRepository.findOne({
      where: { key: 'tax_revenue_cutover_date' },
    });
    if (currentSetting?.value) {
      return currentSetting.value;
    }

    const legacySetting = await this.systemSettingRepository.findOne({
      where: { key: 'tax_revenue_2026_cutover_date' },
    });
    return legacySetting?.value || '2026-01-01';
  }

  /**
   * Lấy lịch sử thay đổi của phiếu nhập
   * @param receiptId - ID phiếu nhập
   */
  async getReceiptLogs(receiptId: number) {
    return this.inventoryReceiptLogRepository.find({
      where: { receipt_id: receiptId },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
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
    averageVatInputCost: number;
  }> {
    const latestPurchasePrice = await this.getLatestPurchasePrice(productId);
    const product = await this.productService.findOne(productId);

    return {
      latestPurchasePrice,
      averageCostPrice: product
        ? parseFloat(product.average_cost_price ?? '0')
        : 0,
      averageVatInputCost: product
        ? parseFloat(product.average_vat_input_cost ?? '0')
        : 0,
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

  private async recalculateAverageVatInputCost(
    productId: number,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(InventoryReceiptItem)
      : this.inventoryReceiptItemRepository;

    const receiptItems = await repo
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.receipt', 'receipt')
      .where('item.product_id = :productId', { productId })
      .andWhere('receipt.status = :status', { status: ReceiptStatus.APPROVED })
      .andWhere('receipt.deleted_at IS NULL')
      .andWhere('item.deleted_at IS NULL')
      .getMany();

    let totalTaxableValue = 0;
    let totalTaxableBaseQty = 0;

    for (const item of receiptItems) {
      const taxableQty = Number(item.taxable_quantity || 0);
      if (taxableQty <= 0) {
        continue;
      }

      const vatUnitCost = Number(item.vat_unit_cost || 0);

      // LOGIC MỚI: Chỉ tính trung bình trên các dòng có GIÁ VAT > 0.
      // Những dòng VAT = 0 sẽ bị loại hoàn toàn khỏi phép tính trung bình.
      if (vatUnitCost <= 0) {
        continue;
      }

      const factor = Number(item.conversion_factor || 1);
      const taxableBaseQty = taxableQty * factor;

      totalTaxableBaseQty += taxableBaseQty;
      totalTaxableValue += taxableQty * vatUnitCost;
    }

    const avgVatInputCost =
      totalTaxableBaseQty > 0 ? totalTaxableValue / totalTaxableBaseQty : 0;

    const updateData: any = {
      average_vat_input_cost: avgVatInputCost.toFixed(2),
    };

    if (totalTaxableBaseQty > 0) {
      updateData.has_input_invoice = true;
    }

    if (queryRunner) {
      await queryRunner.manager.update(Product, productId, updateData);
    } else {
      await this.productService.update(productId, updateData);
    }

    return avgVatInputCost;
  }

  // ===== RETURN FEATURE METHODS =====

  /**
   * Tạo phiếu xuất trả hàng mới
   * @param createInventoryReturnDto - Dữ liệu tạo phiếu xuất trả hàng mới
   * @returns Thông tin phiếu xuất trả hàng đã tạo
   */
  async createReturn(
    createInventoryReturnDto: CreateInventoryReturnDto,
    userId: number,
  ) {
    this.logger.log(
      `Bắt đầu tạo phiếu trả hàng: ${createInventoryReturnDto.return_code}`,
    );

    // Validate: Nếu trả hàng từ phiếu nhập, kiểm tra số lượng trả không vượt quá số lượng nhập
    if (createInventoryReturnDto.receipt_id) {
      await this.validateInventoryReturnItemsAgainstReceipt(
        createInventoryReturnDto.receipt_id,
        createInventoryReturnDto.items,
      );
    }

    // Sử dụng transaction để đảm bảo dữ liệu được lưu đồng bộ
    const queryRunner =
      this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sourceReceipt = createInventoryReturnDto.receipt_id
        ? await queryRunner.manager.findOne(InventoryReceipt, {
            where: { id: createInventoryReturnDto.receipt_id },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      if (createInventoryReturnDto.receipt_id) {
        // Phiếu trả khác có thể vừa commit trong lúc chờ khóa phiếu nhập.
        await this.validateInventoryReturnItemsAgainstReceipt(
          createInventoryReturnDto.receipt_id,
          createInventoryReturnDto.items,
          undefined,
          queryRunner,
        );
      }

      // Tự sinh mã nếu không được cung cấp
      let returnCode = createInventoryReturnDto.return_code;
      if (!returnCode) {
        returnCode = CodeGeneratorHelper.generateUniqueCode('RET');
        this.logger.log(`Tự sinh mã phiếu trả hàng: ${returnCode}`);
      } else {
        const existingReturn = await queryRunner.manager.findOne(
          InventoryReturn,
          { where: { code: returnCode }, withDeleted: true },
        );
        if (existingReturn) {
          const requestedCode = returnCode;
          returnCode = CodeGeneratorHelper.generateUniqueCode('RET');
          this.logger.warn(
            `Mã phiếu trả ${requestedCode} đã được sử dụng; tự sinh mã mới ${returnCode}`,
          );
        }
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
        refund_status: 'not_required',
      };

      if (createInventoryReturnDto.notes !== undefined) {
        returnData.notes = createInventoryReturnDto.notes;
      }

      // Thêm images nếu có
      if (
        createInventoryReturnDto.images &&
        createInventoryReturnDto.images.length > 0
      ) {
        returnData.images = createInventoryReturnDto.images;
      }

      this.logger.log(
        `Đang lưu phiếu trả hàng với dữ liệu: ${JSON.stringify(returnData)}`,
      );
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
      const receiptItemsForSnapshot = createInventoryReturnDto.receipt_id
        ? await queryRunner.manager.find(InventoryReceiptItem, {
            where: { receipt_id: createInventoryReturnDto.receipt_id },
          })
        : [];
      for (const item of createInventoryReturnDto.items) {
        const unitSnapshot = this.resolveInventoryReturnItemUnitSnapshot(
          item,
          receiptItemsForSnapshot,
        );
        const itemData: any = {
          return_id: returnEntity.id,
          product_id: item.product_id,
          receipt_item_id: unitSnapshot.receiptItemId,
          quantity: item.quantity,
          unit_name: unitSnapshot.unitName,
          unit_id: unitSnapshot.unitId,
          conversion_factor: unitSnapshot.conversionFactor,
          base_quantity: unitSnapshot.baseQuantity,
          unit_cost: item.unit_cost,
          total_price: item.total_price,
          reason: item.reason,
        };

        if (item.notes !== undefined) {
          itemData.notes = item.notes;
        }

        this.logger.log(`Đang lưu item: ${JSON.stringify(itemData)}`);
        const itemEntity = queryRunner.manager.create(
          InventoryReturnItem,
          itemData,
        );
        const savedItem = await queryRunner.manager.save(itemEntity);
        savedItems.push(savedItem);
        this.logger.log(`Đã lưu item với ID: ${savedItem.id}`);
      }

      if (returnEntity.status === ReturnStatus.APPROVED) {
        this.logger.log(
          `Phiếu trả hàng ${returnEntity.id} được tạo ở trạng thái đã duyệt, đang trừ tồn kho...`,
        );

        for (const item of savedItems) {
          const stockOutOptions = item.receipt_item_id
            ? { receiptItemId: Number(item.receipt_item_id) }
            : undefined;
          const stockOutResult = await this.processStockOut(
            item.product_id,
            Number(item.base_quantity || item.quantity),
            'RETURN',
            userId,
            returnEntity.id,
            `Trả hàng cho nhà cung cấp - Phiếu ${returnEntity.code}`,
            queryRunner,
            stockOutOptions,
          );
          item.stock_allocations = stockOutResult.affectedBatches.map(
            (batch) => ({
              batchId: Number(batch.batchId),
              quantity: Number(batch.deductedQuantity || 0),
              taxableQuantity: Number(batch.taxableQuantity || 0),
            }),
          );
          await queryRunner.manager.save(item);
        }

        await queryRunner.manager.update(InventoryReturn, returnEntity.id, {
          approved_at: new Date(),
          approved_by: userId,
        });
      }

      const affectedProductIds = Array.from(
        new Set(savedItems.map((item) => Number(item.product_id))),
      );

      // ===== CẬP NHẬT PHIẾU NHẬP GỐC NẾU CÓ =====
      if (createInventoryReturnDto.receipt_id) {
        const receipt = sourceReceipt;

        if (receipt) {
          const newReturnedAmount =
            Number(receipt.returned_amount || 0) +
            Number(createInventoryReturnDto.total_amount);
          const totalAmount = Number(receipt.total_amount);
          const adjustedAmount = Number(receipt.adjusted_amount || 0);
          const newFinalAmount =
            totalAmount + adjustedAmount - newReturnedAmount;

          // Cập nhật supplier_amount (giảm trừ theo giá trị hàng trả)
          const currentSupplierAmount =
            this.getReceiptSupplierAmount(receipt) || totalAmount;
          const newSupplierAmount =
            currentSupplierAmount -
            Number(createInventoryReturnDto.total_amount);

          const paidAmount = Number(receipt.paid_amount || 0);
          const newDebtAmount = Math.max(
            0,
            Math.round(newSupplierAmount - paidAmount),
          );
          const newPaymentStatus = this.resolveReceiptPaymentStatus(
            newSupplierAmount,
            paidAmount,
            receipt.supplier_settlement_mode || SupplierSettlementMode.STANDARD,
          );
          const requiresSupplierRefund = paidAmount > newSupplierAmount;

          await queryRunner.manager.update(
            InventoryReceipt,
            createInventoryReturnDto.receipt_id,
            {
              returned_amount: newReturnedAmount,
              final_amount: newFinalAmount,
              supplier_amount: newSupplierAmount,
              debt_amount: newDebtAmount,
              payment_status: newPaymentStatus,
              has_returns: true,
            },
          );

          await queryRunner.manager.update(InventoryReturn, returnEntity.id, {
            refund_status: requiresSupplierRefund ? 'pending' : 'not_required',
          });

          this.logger.log(
            `Đã cập nhật phiếu nhập #${createInventoryReturnDto.receipt_id}: returned_amount=${newReturnedAmount}, final_amount=${newFinalAmount}, debt_amount=${newDebtAmount}, payment_status=${newPaymentStatus}`,
          );
        }
      }

      if (returnEntity.status === ReturnStatus.APPROVED) {
        await this.recalculateAverageCostPriceForProducts(
          affectedProductIds,
          queryRunner,
        );
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Đã commit transaction cho phiếu trả hàng ${returnEntity.id}`,
      );

      // Trả về kết quả với relations
      const result = await this.inventoryReturnRepository.findOne({
        where: { id: returnEntity.id },
        relations: ['supplier', 'items', 'receipt'],
      });

      // ✅ Đánh dấu ảnh là đã sử dụng
      if (result) {
        await this.markInventoryImagesAsUsed(
          'InventoryReturn',
          result.id,
          result.images,
        );
      }

      this.logger.log(`Hoàn thành tạo phiếu trả hàng ${returnEntity.id}`);
      return result;
    } catch (error) {
      // Rollback transaction nếu có lỗi
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(
        `Lỗi khi tạo phiếu trả hàng: ${errorMessage}`,
        errorStack,
      );
      if (error instanceof BadRequestException) throw error;
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
  async updateReturn(
    id: number,
    updateDto: Partial<CreateInventoryReturnDto>,
    userId: number,
  ) {
    if (updateDto.status && updateDto.status !== ReturnStatus.DRAFT) {
      throw new BadRequestException(
        'Không được đổi trạng thái phiếu trả qua API cập nhật. Hãy dùng chức năng duyệt/hủy để hệ thống ghi kho đúng.',
      );
    }

    const queryRunner =
      this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnDoc = await queryRunner.manager.findOne(InventoryReturn, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!returnDoc) {
        throw new NotFoundException('Không tìm thấy phiếu trả hàng');
      }
      if (returnDoc.status !== ReturnStatus.DRAFT) {
        throw new BadRequestException('Chỉ có thể sửa phiếu ở trạng thái nháp');
      }
      if (
        updateDto.receipt_id &&
        Number(updateDto.receipt_id) !== Number(returnDoc.receipt_id) &&
        !updateDto.items?.length
      ) {
        throw new BadRequestException(
          `Không thể đổi phiếu nhập gốc của phiếu trả ${returnDoc.code || `#${id}`} khi chưa chọn lại danh sách hàng trả từ phiếu nhập mới.`,
        );
      }
      let receiptItemsForSnapshot: InventoryReceiptItem[] = [];
      if (updateDto.items) {
        const receiptIdForSnapshot = updateDto.receipt_id || returnDoc.receipt_id;
        if (receiptIdForSnapshot) {
          // Dùng chung khóa nguồn với luồng tạo để kiểm tra tổng lượng trả nhất quán.
          await queryRunner.manager.findOne(InventoryReceipt, {
            where: { id: receiptIdForSnapshot },
            lock: { mode: 'pessimistic_write' },
          });
          receiptItemsForSnapshot = await this.validateInventoryReturnItemsAgainstReceipt(
            receiptIdForSnapshot,
            updateDto.items,
            id,
            queryRunner,
          );
        }
      }

      // Cập nhật thông tin chung
      const updateData: any = {
        updated_by: userId,
      };
      if (updateDto.return_code) updateData.code = updateDto.return_code;
      if (updateDto.supplier_id) updateData.supplier_id = updateDto.supplier_id;
      if (updateDto.receipt_id) updateData.receipt_id = updateDto.receipt_id;
      if (updateDto.total_amount !== undefined)
        updateData.total_amount = updateDto.total_amount;
      if (updateDto.reason) updateData.reason = updateDto.reason;
      if (updateDto.status) updateData.status = updateDto.status;
      if (updateDto.notes !== undefined) updateData.notes = updateDto.notes;
      if (updateDto.images !== undefined) updateData.images = updateDto.images;

      await queryRunner.manager.update(InventoryReturn, id, updateData);

      // Cập nhật danh sách items nếu có
      if (updateDto.items) {
        // Xóa items cũ
        await queryRunner.manager.delete(InventoryReturnItem, {
          return_id: id,
        });

        // Thêm items mới
        for (const item of updateDto.items) {
          const unitSnapshot = this.resolveInventoryReturnItemUnitSnapshot(
            item,
            receiptItemsForSnapshot,
          );
          const itemData: any = {
            return_id: id,
            product_id: item.product_id,
            receipt_item_id: unitSnapshot.receiptItemId,
            quantity: item.quantity,
            unit_name: unitSnapshot.unitName,
            unit_id: unitSnapshot.unitId,
            conversion_factor: unitSnapshot.conversionFactor,
            base_quantity: unitSnapshot.baseQuantity,
            unit_cost: item.unit_cost,
            total_price: item.total_price,
          };
          if (item.reason) itemData.reason = item.reason;
          if (item.notes) itemData.notes = item.notes;

          const itemDoc = queryRunner.manager.create(
            InventoryReturnItem,
            itemData,
          );
          await queryRunner.manager.save(itemDoc);
        }
      }

      await queryRunner.commitTransaction();
      const updatedReturn = await this.findReturnById(id);

      // ✅ Cập nhật theo dõi ảnh (increment/decrement refs)
      if (updatedReturn) {
        await this.handleInventoryImageUpdate(
          'InventoryReturn',
          id,
          returnDoc.images,
          updatedReturn.images,
        );
      }

      return updatedReturn;
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
  async findReturnById(
    id: number,
    queryRunner?: QueryRunner,
  ): Promise<InventoryReturn | null> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(InventoryReturn)
      : this.inventoryReturnRepository;
    const returnDoc = await repo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'supplier', 'receipt'],
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
      ['code', 'supplier.name', 'notes'], // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'return',
      ['filters', 'nested_filters', 'operator'],
      {
        supplier_name: 'supplier.name',
      },
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
  async approveReturn(
    id: number,
    userId: number,
  ): Promise<InventoryReturn | null> {
    const queryRunner =
      this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnDoc = await queryRunner.manager.findOne(InventoryReturn, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!returnDoc) {
        await queryRunner.commitTransaction();
        return null;
      }

      if (returnDoc.status === ReturnStatus.APPROVED) {
        await queryRunner.commitTransaction();
        return returnDoc;
      }

      if (returnDoc.status === ReturnStatus.CANCELLED) {
        throw new BadRequestException('Không thể duyệt phiếu đã bị hủy');
      }

      // Lấy danh sách chi tiết phiếu xuất trả thông qua queryRunner
      const items = await queryRunner.manager.find(InventoryReturnItem, {
        where: { return_id: id },
      });
      const affectedProductIds = Array.from(
        new Set(items.map((item) => Number(item.product_id))),
      );

      if (returnDoc.receipt_id) {
        const receiptItems = await this.validateInventoryReturnItemsAgainstReceipt(
          returnDoc.receipt_id,
          items,
          id,
          queryRunner,
        );
        for (const item of items) {
          const source = this.resolveInventoryReturnItemUnitSnapshot(
            item as CreateInventoryReturnDto['items'][number],
            receiptItems,
            true,
          );
          if (!source.receiptItem || source.receiptItemId === undefined) {
            throw new BadRequestException(
              `Không xác định được dòng nhập gốc của sản phẩm ID ${item.product_id}.`,
            );
          }
          item.receipt_item_id = source.receiptItemId;
          item.conversion_factor = source.conversionFactor;
          item.base_quantity = source.baseQuantity;
        }
      }

      // Xử lý xuất kho cho từng sản phẩm
      for (const item of items) {
        const stockOutOptions = item.receipt_item_id
          ? { receiptItemId: Number(item.receipt_item_id) }
          : undefined;
        const stockOutResult = await this.processStockOut(
          item.product_id,
          Number(item.base_quantity || item.quantity),
          'RETURN',
          userId,
          id,
          `Trả hàng cho nhà cung cấp - Phiếu ${returnDoc.code}`,
          queryRunner,
          stockOutOptions,
        );
        item.stock_allocations = stockOutResult.affectedBatches.map(
          (batch) => ({
            batchId: Number(batch.batchId),
            quantity: Number(batch.deductedQuantity || 0),
            taxableQuantity: Number(batch.taxableQuantity || 0),
          }),
        );
        await queryRunner.manager.save(item);
      }

      returnDoc.status = ReturnStatus.APPROVED;
      returnDoc.approved_at = new Date();
      returnDoc.approved_by = userId;

      await this.recalculateAverageCostPriceForProducts(
        affectedProductIds,
        queryRunner,
      );

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
    const queryRunner =
      this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnDoc = await queryRunner.manager.findOne(InventoryReturn, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!returnDoc) {
        await queryRunner.commitTransaction();
        return null;
      }

      if (returnDoc.status === ReturnStatus.CANCELLED) {
        await queryRunner.commitTransaction();
        return returnDoc;
      }

      if (returnDoc.receipt_id) {
        const refunds = await queryRunner.manager.find(InventoryReturnRefund, {
          where: { return_id: id },
        });
        if (
          refunds.length > 0 ||
          Number(returnDoc.refund_amount || 0) > 0
        ) {
          throw new BadRequestException(
            `Không thể hủy phiếu trả nhà cung cấp ${returnDoc.code || `#${id}`} vì đã ghi nhận hoàn tiền ${Number(returnDoc.refund_amount || 0)}đ. Hãy xử lý đảo chứng từ hoàn tiền trước.`,
          );
        }
      }

      // Khóa phiếu nhập trước sản phẩm, cùng thứ tự với luồng tạo phiếu trả đã duyệt.
      const sourceReceipt = returnDoc.receipt_id
        ? await queryRunner.manager.findOne(InventoryReceipt, {
            where: { id: returnDoc.receipt_id },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      if (returnDoc.receipt_id && !sourceReceipt) {
        throw new BadRequestException(
          `Không thể hủy phiếu trả nhà cung cấp ${returnDoc.code || `#${id}`}: không tìm thấy phiếu nhập gốc #${returnDoc.receipt_id} để đảo công nợ.`,
        );
      }

      // Nếu phiếu đã duyệt, cần hoàn tồn kho (nhập lại hàng đã trả)
      if (returnDoc.status === ReturnStatus.APPROVED) {
        this.logger.log(
          `Phiếu trả hàng ${id} đã duyệt, đang hoàn tồn kho trước khi hủy...`,
        );

        const items = await queryRunner.manager.find(InventoryReturnItem, {
          where: { return_id: id },
        });
        const itemsMissingAllocations = items.filter(
          (item) =>
            !Array.isArray(item.stock_allocations) ||
            item.stock_allocations.length === 0,
        );
        if (itemsMissingAllocations.length > 0) {
          const missingItems = itemsMissingAllocations
            .map((item) => `#${item.id} (sản phẩm #${item.product_id})`)
            .join(', ');
          throw new BadRequestException(
            `Không thể hủy phiếu trả nhà cung cấp ${returnDoc.code || `#${id}`}: ` +
              `các dòng ${missingItems} thiếu dữ liệu phân bổ lô (stock_allocations). ` +
              'Để tránh hoàn sai lô và tồn thuế, vui lòng đối soát thủ công trước khi hủy.',
          );
        }
        const affectedProductIds = Array.from(
          new Set(items.map((item) => Number(item.product_id))),
        );

        for (const item of items) {
          const stockAllocations = Array.isArray(item.stock_allocations)
            ? item.stock_allocations
            : [];
          for (const allocation of stockAllocations) {
            const hasTaxableSnapshot = Object.prototype.hasOwnProperty.call(
              allocation,
              'taxableQuantity',
            );
            const taxableQuantity = Number(allocation.taxableQuantity);
            if (
              !hasTaxableSnapshot ||
              allocation.taxableQuantity === null ||
              !Number.isFinite(taxableQuantity) ||
              taxableQuantity < 0 ||
              taxableQuantity > Number(allocation.quantity || 0)
            ) {
              throw new BadRequestException(
                `Allocation thuế của phiếu trả hàng ${returnDoc.code} không hợp lệ; cần đối soát trước.`,
              );
            }
            await this.restoreStockToExistingBatch(
              Number(item.product_id),
              Number(allocation.batchId),
              Number(allocation.quantity),
              taxableQuantity,
              userId,
              id,
              returnDoc.code,
              queryRunner,
            );
          }
        }

        await this.recalculateAverageCostPriceForProducts(
          affectedProductIds,
          queryRunner,
        );
      }

      if (sourceReceipt) {
        const receipt = sourceReceipt;
        const totalAmount = Number(receipt.total_amount || 0);
        const adjustedAmount = Number(receipt.adjusted_amount || 0);
        const currentReturnedAmount = Number(receipt.returned_amount || 0);
        const returnAmount = Number(returnDoc.total_amount || 0);
        if (currentReturnedAmount + 0.01 < returnAmount) {
          throw new BadRequestException(
            `Không thể hủy phiếu trả nhà cung cấp ${returnDoc.code || `#${id}`}: giá trị trả ${returnAmount}đ lớn hơn số đã ghi nhận trên phiếu nhập (${currentReturnedAmount}đ). Cần đối soát công nợ trước khi hủy.`,
          );
        }
        const returnedAmount = Math.max(
          0,
          currentReturnedAmount - returnAmount,
        );
        const finalAmount = totalAmount + adjustedAmount - returnedAmount;
        const supplierAmount =
          Number(
            receipt.supplier_amount ??
              receipt.final_amount ??
              receipt.total_amount ??
              0,
          ) + returnAmount;
        const paidAmount = Number(receipt.paid_amount || 0);
        const debtAmount = Math.max(0, Math.round(supplierAmount - paidAmount));
        const paymentStatus = this.resolveReceiptPaymentStatus(
          supplierAmount,
          paidAmount,
          receipt.supplier_settlement_mode || SupplierSettlementMode.STANDARD,
        );
        const otherReturns = await queryRunner.manager.find(InventoryReturn, {
          where: { receipt_id: receipt.id },
        });
        const hasOtherActiveReturns = otherReturns.some(
          (otherReturn) =>
            otherReturn.id !== id &&
            otherReturn.status !== ReturnStatus.CANCELLED,
        );

        await queryRunner.manager.update(InventoryReceipt, receipt.id, {
          returned_amount: returnedAmount,
          final_amount: finalAmount,
          supplier_amount: supplierAmount,
          debt_amount: debtAmount,
          payment_status: paymentStatus,
          has_returns: hasOtherActiveReturns,
        });
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
    const queryRunner =
      this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const returnDoc = await queryRunner.manager.findOne(InventoryReturn, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!returnDoc) {
        throw new Error('Không tìm thấy phiếu xuất trả hàng');
      }

      // Chỉ cho phép xóa phiếu ở trạng thái nháp hoặc đã hủy
      if (
        returnDoc.status !== ReturnStatus.DRAFT &&
        returnDoc.status !== ReturnStatus.CANCELLED
      ) {
        throw new Error('Không thể xóa phiếu xuất trả hàng đã được duyệt.');
      }

      await queryRunner.manager.delete(InventoryReturnItem, { return_id: id });
      await queryRunner.manager.delete(InventoryReturn, id);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ===== ADJUSTMENT FEATURE METHODS =====

  private parseAdjustmentTaxableQuantity(
    value: unknown,
    productId: number,
  ): number {
    const taxableQuantity =
      value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(taxableQuantity)) {
      throw new BadRequestException(
        `Số lượng thuế điều chỉnh của sản phẩm #${productId} phải là số hữu hạn.`,
      );
    }
    return taxableQuantity;
  }

  private async applyAdjustmentItemStockEffect(
    item: InventoryAdjustmentItem,
    adjustment: InventoryAdjustment,
    userId: number,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const quantityChange = Number(item.quantity_change);
    if (!Number.isFinite(quantityChange)) {
      throw new BadRequestException(
        `Số lượng điều chỉnh của sản phẩm #${item.product_id} không hợp lệ`,
      );
    }
    if (
      (adjustment.adjustment_type === 'IN' && quantityChange < 0) ||
      (adjustment.adjustment_type === 'OUT' && quantityChange > 0)
    ) {
      throw new BadRequestException(
        `Loại điều chỉnh ${adjustment.adjustment_type} không khớp dấu số lượng của sản phẩm #${item.product_id}.`,
      );
    }

    if (quantityChange > 0) {
      const pending = item.stock_allocations?.find((allocation) => allocation.pending);
      const taxableQuantity = this.parseAdjustmentTaxableQuantity(
        pending?.taxableQuantity,
        item.product_id,
      );
      const sourceBatchId = Number(pending?.sourceBatchId || 0) || undefined;
      if (taxableQuantity < 0 || taxableQuantity > quantityChange) {
        throw new BadRequestException(
          `Số lượng thuế điều chỉnh tăng của sản phẩm #${item.product_id} phải nằm trong 0 và số lượng tăng.`,
        );
      }

      let receiptItemId: number | undefined;
      let unitCost = await this.getWeightedAverageCost(item.product_id, queryRunner);
      if (sourceBatchId) {
        const sourceBatch = await queryRunner.manager.findOne(InventoryBatch, {
          where: { id: sourceBatchId, product_id: item.product_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!sourceBatch?.receipt_item_id) {
          throw new BadRequestException(
            `Lô nguồn #${sourceBatchId} không liên kết phiếu nhập; không thể xác định GBKT cho điều chỉnh tăng.`,
          );
        }
        const receiptItem = await queryRunner.manager.findOne(InventoryReceiptItem, {
          where: { id: Number(sourceBatch.receipt_item_id), product_id: item.product_id },
        });
        const sourceReceipt = receiptItem
          ? await queryRunner.manager.findOne(InventoryReceipt, {
              where: { id: Number(receiptItem.receipt_id) },
              lock: { mode: 'pessimistic_write' },
            })
          : null;
        if (!receiptItem || sourceReceipt?.status !== ReceiptStatus.APPROVED) {
          throw new BadRequestException(
            `Phiếu nhập nguồn của lô #${sourceBatchId} không tồn tại hoặc chưa được duyệt.`,
          );
        }
        receiptItemId = Number(receiptItem.id);
        unitCost = Number(sourceBatch.unit_cost_price || unitCost);
      } else if (taxableQuantity > 0) {
        throw new BadRequestException(
          `Sản phẩm #${item.product_id} có SL thuế điều chỉnh tăng nhưng chưa chọn lô nhập nguồn.`,
        );
      }

      const currentAverageCost = await this.getWeightedAverageCost(
        item.product_id,
        queryRunner,
      );
      const stockIn = await this.processStockIn(
        item.product_id,
        quantityChange,
        sourceBatchId ? unitCost : currentAverageCost,
        userId,
        receiptItemId,
        `ADJ_${adjustment.code}_${item.id}`,
        undefined,
        queryRunner,
        taxableQuantity,
        undefined,
        true,
      );
      item.stock_allocations = [{
        batchId: Number(stockIn.batch.id),
        quantity: quantityChange,
        taxableQuantity,
      }];
    } else if (quantityChange < 0) {
      const stockOut = await this.processStockOut(
        item.product_id,
        Math.abs(quantityChange),
        'ADJUSTMENT',
        userId,
        adjustment.id,
        `Điều chỉnh giảm kho - Phiếu ${adjustment.code}`,
        queryRunner,
        { requireBatchTaxSnapshot: true },
      );
      item.stock_allocations = stockOut.affectedBatches.map((batch) => ({
        batchId: Number(batch.batchId),
        quantity: Number(batch.deductedQuantity),
        taxableQuantity: Number(batch.taxableQuantity),
      }));
    } else {
      item.stock_allocations = [];
    }

    await queryRunner.manager.save(InventoryAdjustmentItem, item);
  }

  /**
   * Tạo phiếu điều chỉnh kho mới
   * @param createInventoryAdjustmentDto - Dữ liệu tạo phiếu điều chỉnh kho mới
   * @returns Thông tin phiếu điều chỉnh kho đã tạo
   */
  async createAdjustment(
    createInventoryAdjustmentDto: CreateInventoryAdjustmentDto,
    userId: number,
  ) {
    this.logger.log(
      `Bắt đầu tạo phiếu điều chỉnh: ${createInventoryAdjustmentDto.adjustment_code || 'auto-generate'}`,
    );

    const queryRunner =
      this.inventoryAdjustmentRepository.manager.connection.createQueryRunner();
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
      if (
        createInventoryAdjustmentDto.images &&
        createInventoryAdjustmentDto.images.length > 0
      ) {
        adjustmentData.images = createInventoryAdjustmentDto.images;
      }

      const adjustment = queryRunner.manager.create(
        InventoryAdjustment,
        adjustmentData,
      );
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
        const quantityChange = Number(item.quantity_change);
        const taxableQuantity = this.parseAdjustmentTaxableQuantity(
          item.taxable_quantity,
          item.product_id,
        );
        if (
          (createInventoryAdjustmentDto.adjustment_type === 'IN' && quantityChange < 0) ||
          (createInventoryAdjustmentDto.adjustment_type === 'OUT' && quantityChange > 0)
        ) {
          throw new BadRequestException(
            `Loại điều chỉnh ${createInventoryAdjustmentDto.adjustment_type} không khớp dấu số lượng của sản phẩm #${item.product_id}.`,
          );
        }
        if (quantityChange < 0 && (item.source_batch_id || taxableQuantity > 0)) {
          throw new BadRequestException(
            'Điều chỉnh giảm không nhận lô nguồn hoặc số lượng thuế; hệ thống tự trừ FIFO theo từng lô.',
          );
        }
        if (quantityChange > 0 && (taxableQuantity < 0 || taxableQuantity > quantityChange)) {
          throw new BadRequestException('Số lượng thuế phải nằm trong 0 và số lượng điều chỉnh tăng.');
        }
        const itemData: any = {
          adjustment_id: adjustmentEntity.id,
          product_id: item.product_id,
          quantity_change: item.quantity_change,
          reason: item.reason,
          ...(quantityChange > 0 && {
            stock_allocations: [{
              batchId: Number(item.source_batch_id || 0),
              sourceBatchId: item.source_batch_id,
              quantity: quantityChange,
              taxableQuantity,
              pending: true,
            }],
          }),
        };

        if (item.notes !== undefined) {
          itemData.notes = item.notes;
        }

        const itemEntity = queryRunner.manager.create(
          InventoryAdjustmentItem,
          itemData,
        );
        await queryRunner.manager.save(itemEntity);
      }

      // Nếu tạo phiếu với trạng thái 'approved', tự động cập nhật tồn kho (TRONG transaction)
      if (createInventoryAdjustmentDto.status === AdjustmentStatus.APPROVED) {
        this.logger.log(
          `Phiếu ${adjustmentEntity.id} được tạo với trạng thái approved, đang cập nhật tồn kho...`,
        );

        const savedItems = await queryRunner.manager.find(InventoryAdjustmentItem, {
          where: { adjustment_id: adjustmentEntity.id },
        });
        for (const item of savedItems) {
          await this.applyAdjustmentItemStockEffect(
            item,
            adjustmentEntity,
            userId,
            queryRunner,
          );
        }

        // Cập nhật approved_at
        adjustmentEntity.approved_at = new Date();
        adjustmentEntity.approved_by = userId;
        await queryRunner.manager.save(adjustmentEntity);
      }

      await queryRunner.commitTransaction();
      const result = await this.inventoryAdjustmentRepository.findOne({
        where: { id: adjustmentEntity.id },
      });

      // ✅ Đánh dấu ảnh là đã sử dụng
      if (result) {
        await this.markInventoryImagesAsUsed(
          'InventoryAdjustment',
          result.id,
          result.images,
        );
      }

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof HttpException) throw error;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(
        `Lỗi khi tạo phiếu điều chỉnh: ${errorMessage}`,
        errorStack,
      );
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

    const queryRunner =
      this.inventoryAdjustmentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedAdjustment = await queryRunner.manager.findOne(
        InventoryAdjustment,
        {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        },
      );
      if (!lockedAdjustment) {
        throw new NotFoundException('Không tìm thấy phiếu điều chỉnh kho');
      }
      if (lockedAdjustment.status !== AdjustmentStatus.DRAFT) {
        throw new BadRequestException('Chỉ có thể sửa phiếu ở trạng thái nháp');
      }

      // Cập nhật thông tin chung
      const updateData: any = {
        updated_by: userId,
      };
      if (updateDto.adjustment_code)
        updateData.code = updateDto.adjustment_code;
      if (updateDto.adjustment_type)
        updateData.adjustment_type = updateDto.adjustment_type;
      if (updateDto.reason) updateData.reason = updateDto.reason;
      if (updateDto.notes !== undefined) updateData.notes = updateDto.notes;
      // Chỉ endpoint approveAdjustment mới được chuyển trạng thái và tác động kho.

      // Debug log
      this.logger.log(`📸 Update images: ${JSON.stringify(updateDto.images)}`);
      if (updateDto.images !== undefined) updateData.images = updateDto.images; // Cập nhật images

      await queryRunner.manager.update(InventoryAdjustment, id, updateData);

      // Cập nhật danh sách items nếu có
      if (updateDto.items) {
        // Xóa items cũ
        await queryRunner.manager.delete(InventoryAdjustmentItem, {
          adjustment_id: id,
        });

        // Thêm items mới
        for (const item of updateDto.items) {
          const quantityChange = Number(item.quantity_change);
          const taxableQuantity = this.parseAdjustmentTaxableQuantity(
            item.taxable_quantity,
            item.product_id,
          );
          const adjustmentType = updateDto.adjustment_type || lockedAdjustment.adjustment_type;
          if (
            (adjustmentType === 'IN' && quantityChange < 0) ||
            (adjustmentType === 'OUT' && quantityChange > 0)
          ) {
            throw new BadRequestException(
              `Loại điều chỉnh ${adjustmentType} không khớp dấu số lượng của sản phẩm #${item.product_id}.`,
            );
          }
          if (quantityChange < 0 && (item.source_batch_id || taxableQuantity > 0)) {
            throw new BadRequestException(
              'Điều chỉnh giảm không nhận lô nguồn hoặc số lượng thuế; hệ thống tự trừ FIFO theo từng lô.',
            );
          }
          if (quantityChange > 0 && (taxableQuantity < 0 || taxableQuantity > quantityChange)) {
            throw new BadRequestException('Số lượng thuế phải nằm trong 0 và số lượng điều chỉnh tăng.');
          }
          const itemData: any = {
            adjustment_id: id,
            product_id: item.product_id,
            quantity_change: item.quantity_change,
            reason: item.reason,
            ...(quantityChange > 0 && {
              stock_allocations: [{
                batchId: Number(item.source_batch_id || 0),
                sourceBatchId: item.source_batch_id,
                quantity: quantityChange,
                taxableQuantity,
                pending: true,
              }],
            }),
          };
          if (item.notes !== undefined) itemData.notes = item.notes;

          const itemDoc = queryRunner.manager.create(
            InventoryAdjustmentItem,
            itemData,
          );
          await queryRunner.manager.save(itemDoc);
        }
      }

      await queryRunner.commitTransaction();
      const updatedAdjustment = await this.findAdjustmentById(id);

      // ✅ Cập nhật theo dõi ảnh (increment/decrement refs)
      if (updatedAdjustment) {
        await this.handleInventoryImageUpdate(
          'InventoryAdjustment',
          id,
          adjustment.images,
          updatedAdjustment.images,
        );
      }

      return updatedAdjustment;
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
  async findAdjustmentById(
    id: number,
    queryRunner?: QueryRunner,
  ): Promise<any> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(InventoryAdjustment)
      : this.inventoryAdjustmentRepository;
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
      ['code', 'reason', 'notes'], // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(queryBuilder, searchDto, 'adjustment', [
      'filters',
      'nested_filters',
      'operator',
    ]);

    const [adjustments, total] = await queryBuilder.getManyAndCount();

    // 3. Populate images cho từng adjustment
    const dataWithImages = await Promise.all(
      adjustments.map(async (adjustment) => {
        const fileReferences =
          await this.fileTrackingService.findFileReferencesByEntity(
            'inventory_adjustment',
            adjustment.id,
          );

        const images = fileReferences.map((ref) => ({
          id: ref.fileUpload.id,
          url: ref.fileUpload.url,
          name: ref.fileUpload.name,
          type: ref.fileUpload.mime_type,
          size: ref.fileUpload.size,
          created_at: ref.created_at,
        }));

        return { ...adjustment, images };
      }),
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
  async approveAdjustment(
    id: number,
    userId: number,
  ): Promise<InventoryAdjustment | null> {
    const queryRunner =
      this.inventoryAdjustmentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const adjustment = await queryRunner.manager.findOne(
        InventoryAdjustment,
        {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (!adjustment) {
        await queryRunner.commitTransaction();
        return null;
      }

      if (adjustment.status === AdjustmentStatus.APPROVED) {
        await queryRunner.commitTransaction();
        return adjustment;
      }

      if (adjustment.status === AdjustmentStatus.CANCELLED) {
        throw new BadRequestException('Không thể duyệt phiếu đã bị hủy');
      }

      // Lấy danh sách chi tiết phiếu điều chỉnh qua queryRunner
      const items = await queryRunner.manager.find(InventoryAdjustmentItem, {
        where: { adjustment_id: id },
      });

      // Xử lý điều chỉnh kho và lưu snapshot từng lô để có thể đảo chính xác.
      for (const item of items) {
        await this.applyAdjustmentItemStockEffect(
          item,
          adjustment,
          userId,
          queryRunner,
        );
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
    const queryRunner =
      this.inventoryAdjustmentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const adjustment = await queryRunner.manager.findOne(
        InventoryAdjustment,
        {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (!adjustment) {
        await queryRunner.commitTransaction();
        return null;
      }

      // Nếu phiếu đã duyệt, cần hoàn tồn kho (reverse lại thao tác)
      if (adjustment.status === AdjustmentStatus.APPROVED) {
        this.logger.log(
          `Phiếu ${id} đã duyệt, đang hoàn tồn kho trước khi hủy...`,
        );

        const items = await queryRunner.manager.find(InventoryAdjustmentItem, {
          where: { adjustment_id: id },
        });

        const allocationByItemId = new Map<number, NonNullable<InventoryAdjustmentItem['stock_allocations']>>();
        for (const item of items) {
          if (Number(item.quantity_change) === 0) continue;
          const validation = validateAdjustmentStockAllocations(
            Number(item.quantity_change),
            item.stock_allocations,
          );
          if (validation.error) {
            throw new BadRequestException(
              `Không thể hủy phiếu điều chỉnh ${adjustment.code}: sản phẩm #${item.product_id} ${validation.error}. ` +
                'Phiếu này được duyệt trước khi lưu phân bổ lô; hãy đối soát và tạo phiếu điều chỉnh mới thay vì hủy để tránh sai tồn kho/thuế.',
            );
          }
          allocationByItemId.set(item.id, validation.allocations || []);
        }

        for (const item of items) {
          const quantityChange = Number(item.quantity_change);
          if (quantityChange === 0) continue;
          const allocations = allocationByItemId.get(item.id)!;

          if (quantityChange > 0) {
            // Chỉ xuất lại từ lô được tạo bởi chính phiếu điều chỉnh tăng.
            const allocation = allocations[0];
            if (!allocation) {
              throw new BadRequestException(
                `Không thể hủy phiếu điều chỉnh ${adjustment.code}: thiếu lô điều chỉnh tăng để hoàn tác.`,
              );
            }
            await this.processStockOut(
              item.product_id,
              quantityChange,
              'ADJUSTMENT_CANCEL',
              userId,
              id,
              `Hủy phiếu điều chỉnh tăng kho - ${adjustment.code}`,
              queryRunner,
              {
                batchId: allocation.batchId,
                taxableQuantity: allocation.taxableQuantity,
                requireBatchTaxSnapshot: true,
                expectedBatchTaxableQuantity: allocation.taxableQuantity,
              },
            );
          } else if (quantityChange < 0) {
            // Hoàn lại đúng từng lô và số thuế đã trừ lúc duyệt.
            for (const allocation of allocations) {
              await this.restoreStockToExistingBatch(
                item.product_id,
                allocation.batchId,
                allocation.quantity,
                allocation.taxableQuantity,
                userId,
                id,
                adjustment.code,
                queryRunner,
                'ADJUSTMENT_CANCEL',
                `Hủy phiếu điều chỉnh giảm kho - ${adjustment.code} - hoàn đúng lô #${allocation.batchId}`,
              );
            }
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
    if (
      adjustment.status !== AdjustmentStatus.DRAFT &&
      adjustment.status !== AdjustmentStatus.CANCELLED
    ) {
      throw new Error('Không thể xóa phiếu điều chỉnh kho đã được duyệt.');
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
    queryRunner?: QueryRunner,
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
      throw new BadRequestException('Chỉ có thể thanh toán cho phiếu đã duyệt');
    }

    // Validation
    if (receipt.is_payment_locked) {
      throw new BadRequestException(
        'Payment đã bị khóa, không thể thêm thanh toán',
      );
    }

    const currentPaidAmount = Number(receipt.paid_amount) || 0;
    const supplierAmount =
      Number(receipt.supplier_amount) ||
      Number(receipt.final_amount) ||
      Number(receipt.total_amount);
    const newPaidAmount = currentPaidAmount + Number(paymentDto.amount);

    if (
      receipt.supplier_settlement_mode !==
        SupplierSettlementMode.BY_SALE_TYPE &&
      newPaidAmount > supplierAmount
    ) {
      throw new BadRequestException(
        `Số tiền thanh toán vượt quá số tiền còn nợ NCC (${supplierAmount - currentPaidAmount}đ)`,
      );
    }

    // Tạo record payment
    const repo = queryRunner
      ? queryRunner.manager.getRepository(InventoryReceiptPayment)
      : this.receiptPaymentRepository;
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
    const newDebtAmount = Math.max(
      0,
      Math.round(supplierAmount - newPaidAmount),
    );
    const newPaymentStatus = this.resolveReceiptPaymentStatus(
      supplierAmount,
      newPaidAmount,
      receipt.supplier_settlement_mode || SupplierSettlementMode.STANDARD,
    );

    const receiptRepo = queryRunner
      ? queryRunner.manager.getRepository(InventoryReceipt)
      : this.inventoryReceiptRepository;
    await receiptRepo.update(receiptId, {
      paid_amount: newPaidAmount,
      debt_amount: newDebtAmount,
      payment_status: newPaymentStatus,
    });

    this.logger.log(
      `Đã thêm thanh toán ${paymentDto.amount}đ cho phiếu nhập #${receiptId}`,
    );
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
    const finalAmount =
      Number(receipt.final_amount) || Number(receipt.total_amount);
    const supplierAmount = Number(receipt.supplier_amount) || finalAmount;
    const newDebtAmount = Math.max(
      0,
      Math.round(supplierAmount - newPaidAmount),
    );

    const newPaymentStatus = this.resolveReceiptPaymentStatus(
      supplierAmount,
      newPaidAmount,
      receipt.supplier_settlement_mode || SupplierSettlementMode.STANDARD,
    );

    await this.inventoryReceiptRepository.update(receiptId, {
      paid_amount: newPaidAmount,
      debt_amount: newDebtAmount,
      payment_status: newPaymentStatus,
    });

    this.logger.log(
      `Đã xóa thanh toán #${paymentId} của phiếu nhập #${receiptId}`,
    );
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
    userId: number,
  ) {
    const queryRunner =
      this.inventoryReturnRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Khóa phiếu để thao tác hoàn tiền không đua với thao tác hủy cùng phiếu.
      const returnDoc = await queryRunner.manager.findOne(InventoryReturn, {
        where: { id: returnId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!returnDoc) {
        throw new NotFoundException('Không tìm thấy phiếu trả hàng');
      }

      if (returnDoc.status === ReturnStatus.CANCELLED) {
        throw new BadRequestException(
          `Không thể hoàn tiền hoặc cấn trừ cho phiếu trả nhà cung cấp ${returnDoc.code || `#${returnId}`} vì phiếu đã hủy`,
        );
      }

      if (!returnDoc.receipt_id) {
        throw new BadRequestException(
          'Phiếu trả hàng này không gắn với phiếu nhập để xử lý hoàn tiền',
        );
      }

      const receipt = await queryRunner.manager.findOne(InventoryReceipt, {
        where: { id: returnDoc.receipt_id },
      });
      if (!receipt) {
        throw new BadRequestException(
          'Phiếu trả hàng này không gắn với phiếu nhập để xử lý hoàn tiền',
        );
      }

      const receiptSupplierAmount = this.getReceiptSupplierAmount(receipt);
      const paidAmount = Number(receipt.paid_amount || 0);
      const refundableAmount = Math.max(0, paidAmount - receiptSupplierAmount);

      if (refundableAmount <= 0) {
        throw new BadRequestException(
          'Phiếu trả hàng này chỉ giảm công nợ, không phát sinh hoàn tiền từ nhà cung cấp',
        );
      }

      const currentRefundAmount = Number(returnDoc.refund_amount) || 0;
      const totalAmount = Number(returnDoc.total_amount);
      const receiptRefundSummary = await queryRunner.manager
        .getRepository(InventoryReturn)
        .createQueryBuilder('inventoryReturn')
        .select(
          'COALESCE(SUM(CAST(inventoryReturn.refund_amount AS DECIMAL(15,2))), 0)',
          'total',
        )
        .where('inventoryReturn.receipt_id = :receiptId', {
          receiptId: returnDoc.receipt_id,
        })
        .andWhere('inventoryReturn.deleted_at IS NULL')
        .getRawOne<{ total: string }>();

      const refundedAmountForReceipt = Number(receiptRefundSummary?.total || 0);
      const remainingRefundForReceipt = Math.max(
        0,
        refundableAmount - refundedAmountForReceipt,
      );
      const remainingRefundForReturn = Math.max(
        0,
        totalAmount - currentRefundAmount,
      );
      const allowedRefundAmount = Math.min(
        remainingRefundForReceipt,
        remainingRefundForReturn,
      );

      if (allowedRefundAmount <= 0) {
        throw new BadRequestException(
          'Khoản hoàn tiền cho phiếu trả hàng này đã được xử lý hết',
        );
      }

      if (Number(refundDto.amount) > allowedRefundAmount) {
        throw new BadRequestException(
          `Số tiền hoàn vượt quá mức còn được phép xử lý (${allowedRefundAmount}đ)`,
        );
      }

      const newRefundAmount = currentRefundAmount + Number(refundDto.amount);

      if (newRefundAmount > totalAmount) {
        throw new BadRequestException(
          `Số tiền hoàn vượt quá giá trị phiếu trả (${totalAmount - currentRefundAmount}đ)`,
        );
      }

      const refundData: Partial<InventoryReturnRefund> = {
        return_id: returnId,
        amount: refundDto.amount,
        refund_method: refundDto.refund_method,
        refund_date: refundDto.refund_date || new Date(),
        created_by: userId,
        ...(refundDto.notes ? { notes: refundDto.notes } : {}),
      };
      const refundRepository = queryRunner.manager.getRepository(
        InventoryReturnRefund,
      );
      const refund = refundRepository.create(refundData);
      const savedRefund = await refundRepository.save(refund);

      let newRefundStatus = 'partial';
      const refundTargetAmount = Math.min(totalAmount, refundableAmount);
      if (refundTargetAmount <= 0) {
        newRefundStatus = 'not_required';
      } else if (newRefundAmount >= refundTargetAmount) {
        newRefundStatus = 'refunded';
      } else if (newRefundAmount === 0) {
        newRefundStatus = 'pending';
      }

      await queryRunner.manager.update(InventoryReturn, returnId, {
        refund_amount: newRefundAmount,
        refund_status: newRefundStatus,
      });
      await queryRunner.commitTransaction();

      this.logger.log(
        `Đã thêm hoàn tiền ${refundDto.amount}đ cho phiếu trả #${returnId}`,
      );
      return savedRefund;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
  async syncTaxableData(): Promise<{
    productsUpdated: number;
    salesItemsUpdated: number;
  }> {
    this.logger.log(
      '🚀 Bắt đầu chi tiết đồng bộ dữ liệu tồn kho thuế (Refined)...',
    );

    let productsUpdated = 0;
    let salesItemsUpdated = 0;

    const products = await this.productService.findAllIncludingInactive();

    for (const product of products) {
      const result = await this.syncTaxableDataForProduct(product.id);
      if (result.productUpdated) productsUpdated++;
      salesItemsUpdated += result.salesItemsUpdated;
    }

    this.logger.log(
      `✅ Hoàn tất đồng bộ theo logic Bể thuế: ${productsUpdated} sản phẩm, ${salesItemsUpdated} item hóa đơn.`,
    );
    return { productsUpdated, salesItemsUpdated };
  }

  /**
   * Đồng bộ dữ liệu tồn kho thuế V2 - Chỉ lấy những sản phẩm có hóa đơn nhập (bill_date) từ startDate
   * @param startDate - Ngày bắt đầu lọc (YYYY-MM-DD)
   */
  async syncTaxableDataV2(startDate?: string): Promise<{
    productsUpdated: number;
    salesItemsUpdated: number;
  }> {
    const filterDate = startDate || '2026-01-01';
    this.logger.log(
      `🚀 [V2] Bắt đầu đồng bộ dữ liệu thuế cho sản phẩm có hóa đơn nhập từ ${filterDate}...`,
    );

    // 1. Tìm danh sách ID sản phẩm có ít nhất một phiếu nhập "có thuế" từ ngày filterDate
    const receiptItemRepo =
      this.inventoryReceiptRepository.manager.getRepository(
        InventoryReceiptItem,
      );
    const productIdsWithRecentTax = await receiptItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.receipt', 'receipt')
      .select('DISTINCT item.product_id', 'product_id')
      .where('receipt.bill_date >= :filterDate', { filterDate })
      .andWhere("receipt.status IN ('approved', 'completed')")
      .getRawMany();

    const ids = productIdsWithRecentTax.map((p) => p.product_id);

    if (ids.length === 0) {
      this.logger.log('ℹ️ Không tìm thấy sản phẩm nào thỏa mãn điều kiện.');
      return { productsUpdated: 0, salesItemsUpdated: 0 };
    }

    this.logger.log(`🔍 Tìm thấy ${ids.length} sản phẩm cần đồng bộ.`);

    let productsUpdated = 0;
    let salesItemsUpdated = 0;

    for (const productId of ids) {
      const result = await this.syncTaxableDataForProduct(
        productId,
        filterDate,
      );
      if (result.productUpdated) productsUpdated++;
      salesItemsUpdated += result.salesItemsUpdated;
    }

    this.logger.log(
      `✅ [V2] Hoàn tất: ${productsUpdated} sản phẩm, ${salesItemsUpdated} item hóa đơn.`,
    );
    return { productsUpdated, salesItemsUpdated };
  }

  async syncTaxableDataForProductsUsingConfiguredCutover(
    productIds: number[],
  ): Promise<void> {
    const ids = Array.from(
      new Set(productIds.map((id) => Number(id)).filter((id) => id > 0)),
    );
    if (!ids.length) return;

    const cutoverDate = await this.getTaxRevenueCutoverDateValue();
    for (const productId of ids) {
      await this.syncTaxableDataForProduct(productId, cutoverDate);
    }
  }

  async syncTaxableDataForProductsWithCancelledInvoices(): Promise<{
    productsFound: number;
    productsUpdated: number;
    salesItemsUpdated: number;
  }> {
    const salesInvoiceItemRepo =
      this.inventoryReceiptRepository.manager.getRepository(SalesInvoiceItem);
    const rows = await salesInvoiceItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.invoice', 'invoice')
      .select('DISTINCT item.product_id', 'product_id')
      .where('invoice.status = :cancelledStatus', {
        cancelledStatus: 'cancelled',
      })
      .andWhere('invoice.deleted_at IS NULL')
      .andWhere('item.deleted_at IS NULL')
      .getRawMany();

    const productIds = Array.from(
      new Set(rows.map((row) => Number(row.product_id || 0)).filter((id) => id > 0)),
    );
    const cutoverDate = await this.getTaxRevenueCutoverDateValue();
    let productsUpdated = 0;
    let salesItemsUpdated = 0;

    for (const productId of productIds) {
      const result = await this.syncTaxableDataForProduct(
        productId,
        cutoverDate,
      );
      if (result.productUpdated) productsUpdated++;
      salesItemsUpdated += result.salesItemsUpdated;
    }

    return {
      productsFound: productIds.length,
      productsUpdated,
      salesItemsUpdated,
    };
  }

  /**
   * Đồng bộ dữ liệu tồn kho thuế cho một sản phẩm cụ thể
   * @param productId - ID sản phẩm
   */
  async syncTaxableDataForProduct(
    productId: number,
    _cutoverDate?: string,
  ): Promise<{ productUpdated: boolean; salesItemsUpdated: number }> {
    return this.withStockTransaction(async (runner) => {
      const manager = runner.manager;
      const product = await manager.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });
      const unchanged = { productUpdated: false, salesItemsUpdated: 0 };
      if (!product) return unchanged;

      const skip = (reason: string) => {
        this.logger.warn(
          `Không đồng bộ tồn thuế sản phẩm #${productId}: ${reason}`,
        );
        return unchanged;
      };
      const baseQuantity = (item: {
        quantity: number;
        base_quantity?: number;
        conversion_factor?: number;
      }) => Number(item.base_quantity ?? Number(item.quantity) * Number(item.conversion_factor ?? 1));
      const finiteSnapshot = (value: unknown): number =>
        (typeof value === 'number' ||
          (typeof value === 'string' && value.trim() !== '')) &&
        Number.isFinite(Number(value)) ? Number(value) : NaN;
      const taxUnits = (value: unknown) => this.taxQuantityUnits(value);
      let exactTaxableStock = 0n;
      const returnSnapshot = (
        allocations: Array<{ quantity: number; taxableQuantity?: number }> | undefined,
        quantity: number,
      ): { taxable: number; units: bigint } | null | undefined => {
        if (allocations == null) return undefined;
        if (!Array.isArray(allocations)) return null;
        if (allocations.length === 0) return undefined;
        let allocatedQuantity = 0;
        let allocatedTaxable = 0;
        let allocatedUnits = 0n;
        for (const allocation of allocations) {
          const physical = finiteSnapshot(allocation.quantity);
          const taxable = finiteSnapshot(allocation.taxableQuantity);
          const units = taxUnits(allocation.taxableQuantity);
          if (physical <= 0 || !Number.isFinite(physical) ||
              !Number.isFinite(taxable) || taxable < 0 || taxable > physical ||
              units === undefined) {
            return null;
          }
          allocatedQuantity += physical;
          allocatedTaxable += taxable;
          allocatedUnits += units;
        }
        return Math.abs(allocatedQuantity - quantity) <= 0.00000001
          ? { taxable: allocatedTaxable, units: allocatedUnits } : null;
      };

      const unsupportedMovements = await manager.getRepository(InventoryTransaction)
        .createQueryBuilder('tx')
        .where('tx.product_id = :productId', { productId })
        .andWhere(`(tx.reference_type IN (:...adjustments) OR
          (tx.type = :out AND (tx.reference_type IS NULL OR
            tx.reference_type NOT IN (:...supported))))`, {
          adjustments: ['ADJUSTMENT', 'ADJUSTMENT_CANCEL'],
          out: 'OUT',
          supported: ['SALE', 'RETURN', 'RECEIPT_CANCELLATION'],
        })
        .getCount();
      if (unsupportedMovements > 0) {
        return skip('có giao dịch kho khác chưa có snapshot thuế để đối soát');
      }

      const receiptItems = await manager.getRepository(InventoryReceiptItem)
        .createQueryBuilder('item')
        .innerJoinAndSelect('item.receipt', 'receipt')
        .where('item.product_id = :productId', { productId })
        .andWhere("receipt.status IN ('approved', 'completed')")
        .andWhere('receipt.deleted_at IS NULL')
        .andWhere('item.quantity > 0')
        .getMany();
      const salesItems = await manager.getRepository(SalesInvoiceItem)
        .createQueryBuilder('sii')
        .innerJoinAndSelect('sii.invoice', 'si')
        .where('sii.product_id = :productId', { productId })
        .andWhere('si.status IN (:...statuses)', { statuses: ['confirmed', 'paid'] })
        .andWhere('si.deleted_at IS NULL')
        .andWhere('sii.deleted_at IS NULL')
        .orderBy('sii.id', 'ASC')
        .getMany();
      if (receiptItems.length === 0) {
        return skip('không có phiếu nhập gốc để đối soát');
      }

      const salesAllocations = salesItems.length > 0
        ? await manager.getRepository(SalesInvoiceItemStockAllocation).find({
            where: { sales_invoice_item_id: In(salesItems.map((item) => item.id)) },
            order: { id: 'ASC' },
          })
        : [];
      const allocationsByItem = new Map<number, SalesInvoiceItemStockAllocation[]>();
      for (const allocation of salesAllocations) {
        const item = salesItems.find((sale) => sale.id === Number(allocation.sales_invoice_item_id));
        if (!item || Number(allocation.product_id) !== productId ||
            Number(item.product_id) !== productId ||
            Number(allocation.invoice_id) !== Number(item.invoice_id)) {
          return skip('allocation dòng bán không khớp sản phẩm hoặc hóa đơn gốc');
        }
        const allocations = allocationsByItem.get(item.id) || [];
        allocations.push(allocation);
        allocationsByItem.set(item.id, allocations);
      }

      const customerReturns = await manager.getRepository(SalesReturnItem)
        .createQueryBuilder('sri')
        .innerJoinAndSelect('sri.sales_return', 'sr')
        .where('sri.product_id = :productId', { productId })
        .andWhere('sr.status = :approved', { approved: 'approved' })
        .getMany();
      const returnedByItem = new Map<number, number>();
      const returnedTaxableByItem = new Map<number, number>();
      const incompleteCustomerReturnSnapshots = new Set<number>();
      for (const returned of customerReturns) {
        const invoiceItems = salesItems.filter(
          (item) => Number(item.invoice_id) === Number(returned.sales_return?.invoice_id),
        );
        // Hóa đơn hủy đã hoàn toàn bộ tồn; không cộng lại phần khách trả.
        if (invoiceItems.length === 0) continue;
        const item = returned.sales_invoice_item_id
          ? invoiceItems.find((sale) => sale.id === Number(returned.sales_invoice_item_id))
          : invoiceItems.length === 1 ? invoiceItems[0] : undefined;
        if (!item) return skip('phiếu khách trả thiếu dòng bán gốc duy nhất');
        const returnedQuantity = baseQuantity(returned);
        if (!Number.isFinite(returnedQuantity) || returnedQuantity <= 0) {
          return skip('số lượng của phiếu khách trả không hợp lệ');
        }
        returnedByItem.set(item.id, (returnedByItem.get(item.id) || 0) + returnedQuantity);
        const allocationTaxable = returnSnapshot(returned.stock_allocations, returnedQuantity);
        if (allocationTaxable === undefined) {
          incompleteCustomerReturnSnapshots.add(item.id);
          continue;
        }
        if (allocationTaxable === null) {
          return skip('snapshot lô của phiếu khách trả không hợp lệ');
        }
        exactTaxableStock += allocationTaxable.units;
        returnedTaxableByItem.set(
          item.id,
          (returnedTaxableByItem.get(item.id) || 0) + allocationTaxable.taxable,
        );
      }

      let soldQuantity = 0;
      let soldTaxable = 0;
      for (const item of salesItems) {
        const quantity = baseQuantity(item);
        const factor = finiteSnapshot(item.conversion_factor ?? 1);
        if (Number(item.product_id) !== productId || !Number.isFinite(factor) || factor <= 0 ||
            !Number.isFinite(quantity) || quantity <= 0 ||
            !Number.isFinite(finiteSnapshot(item.quantity)) || Number(item.quantity) <= 0 ||
            Math.abs(quantity - Number(item.quantity) * factor) > 0.00000001) {
          return skip('snapshot số lượng dòng bán không hợp lệ');
        }
        const allocations = allocationsByItem.get(item.id) || [];
        let taxable = 0;
        if (allocations.length > 0) {
          let allocatedQuantity = 0;
          for (const allocation of allocations) {
            const physical = finiteSnapshot(allocation.quantity);
            const tax = finiteSnapshot(allocation.taxable_quantity);
            const units = taxUnits(allocation.taxable_quantity);
            if (!Number.isFinite(physical) || physical <= 0 ||
                !Number.isFinite(tax) || tax < 0 || tax > physical ||
                units === undefined) {
              return skip('snapshot allocation dòng bán không hợp lệ');
            }
            allocatedQuantity += physical;
            taxable += tax;
            exactTaxableStock -= units;
          }
          if (Math.abs(allocatedQuantity - quantity) > 0.00000001) {
            return skip('allocation không bao phủ đủ số lượng gốc của dòng bán');
          }
        } else {
          taxable = finiteSnapshot(item.taxable_quantity);
          const units = taxUnits(item.taxable_quantity);
          // Thiếu allocation: chỉ đơn vị gốc hoặc snapshot thuế bằng 0 là rõ nghĩa.
          if (!Number.isFinite(taxable) || units === undefined ||
              (factor !== 1 && taxable !== 0)) {
            return skip('dòng bán quy đổi thiếu allocation thuế theo đơn vị gốc');
          }
          exactTaxableStock -= units;
        }
        const returned = returnedByItem.get(item.id) || 0;
        if (!Number.isFinite(quantity) || !Number.isFinite(taxable) ||
            quantity < 0 || taxable < 0 || taxable > quantity + 0.0001 ||
            returned < 0 || returned > quantity + 0.0001) {
          return skip('snapshot dòng bán hoặc số lượng trả không hợp lệ');
        }
        soldQuantity += Math.max(0, quantity - returned);
        if (
          incompleteCustomerReturnSnapshots.has(item.id) &&
          returned > 0 &&
          taxable > 0
        ) {
          return skip('phiếu khách trả thiếu snapshot thuế theo lô');
        }
        const returnedTaxable = returnedTaxableByItem.get(item.id) || 0;
        if (returnedTaxable > taxable + 0.00000001 ||
            taxable - returnedTaxable > quantity - returned + 0.00000001) {
          return skip('snapshot thuế của phiếu khách trả vượt quá dòng bán gốc');
        }
        soldTaxable += Math.max(0, taxable - returnedTaxable);
      }

      const supplierReturns = await manager.getRepository(InventoryReturnItem)
        .createQueryBuilder('iri')
        .innerJoinAndSelect('iri.return', 'ir')
        .where('iri.product_id = :productId', { productId })
        .andWhere('ir.status = :approved', { approved: ReturnStatus.APPROVED })
        .andWhere('ir.deleted_at IS NULL')
        .getMany();
      const supplierReturnedByItem = new Map<number, number>();
      const supplierReturnedTaxableByItem = new Map<number, number>();
      const incompleteSupplierReturnSnapshots = new Set<number>();
      for (const returned of supplierReturns) {
        const candidates = receiptItems.filter((item) => returned.receipt_item_id
          ? item.id === Number(returned.receipt_item_id)
          : item.receipt_id === Number(returned.return?.receipt_id));
        if (candidates.length !== 1) return skip('phiếu trả NCC thiếu dòng nhập gốc duy nhất');
        const source = candidates[0]!;
        const returnedQuantity = baseQuantity(returned);
        if (!Number.isFinite(returnedQuantity) || returnedQuantity <= 0) {
          return skip('số lượng của phiếu trả NCC không hợp lệ');
        }
        supplierReturnedByItem.set(
          source.id,
          (supplierReturnedByItem.get(source.id) || 0) + returnedQuantity,
        );
        const allocationTaxable = returnSnapshot(returned.stock_allocations, returnedQuantity);
        if (allocationTaxable === undefined) {
          incompleteSupplierReturnSnapshots.add(source.id);
          continue;
        }
        if (allocationTaxable === null) {
          return skip('snapshot lô của phiếu trả NCC không hợp lệ');
        }
        exactTaxableStock -= allocationTaxable.units;
        supplierReturnedTaxableByItem.set(
          source.id,
          (supplierReturnedTaxableByItem.get(source.id) || 0) + allocationTaxable.taxable,
        );
      }

      let receivedQuantity = 0;
      let receivedTaxable = 0;
      for (const item of receiptItems) {
        const quantity = baseQuantity(item);
        const receiptTaxUnits = taxUnits(item.taxable_quantity ?? 0);
        const factorUnits = taxUnits(item.conversion_factor ?? 1);
        if (receiptTaxUnits === undefined || factorUnits === undefined ||
            factorUnits <= 0n || (receiptTaxUnits * factorUnits) % 1000000n !== 0n) {
          return skip('snapshot thuế hoặc hệ số quy đổi dòng nhập không hợp lệ');
        }
        const taxableUnits = receiptTaxUnits * factorUnits / 1000000n;
        const taxable = Number(taxableUnits) / 1000000;
        exactTaxableStock += taxableUnits;
        const returned = supplierReturnedByItem.get(item.id) || 0;
        if (!Number.isFinite(quantity) || !Number.isFinite(taxable) ||
            quantity < 0 || taxable < 0 || taxable > quantity + 0.0001 ||
            returned < 0 || returned > quantity + 0.0001) {
          return skip('số lượng nhập hoặc trả NCC không hợp lệ');
        }
        const hasCompleteSnapshot = !incompleteSupplierReturnSnapshots.has(item.id);
        // Lô trộn cũ không có snapshot thuế lúc trả: không thể suy ra từ tồn vật lý.
        if (!hasCompleteSnapshot && returned > 0 && returned < quantity && taxable > 0 && taxable < quantity) {
          return skip('trả một phần lô trộn thiếu snapshot thuế lúc xuất');
        }
        receivedQuantity += Math.max(0, quantity - returned);
        const returnedTaxable = hasCompleteSnapshot
          ? (supplierReturnedTaxableByItem.get(item.id) || 0)
          : (taxable === quantity
              ? Math.min(taxable, returned)
              : returned >= quantity ? taxable : 0);
        if (returnedTaxable > taxable + 0.00000001 ||
            taxable - returnedTaxable > quantity - returned + 0.00000001) {
          return skip('snapshot thuế của phiếu trả NCC vượt quá dòng nhập gốc');
        }
        if (!hasCompleteSnapshot) {
          const returnedUnits = taxUnits(returnedTaxable);
          if (returnedUnits === undefined) return skip('snapshot thuế trả NCC không chính xác');
          exactTaxableStock -= returnedUnits;
        }
        receivedTaxable += Math.max(0, taxable - returnedTaxable);
      }

      // Điều chỉnh, cho mượn và tồn đầu kỳ không được tự phân loại lại thành thuế.
      const expectedQuantity = receivedQuantity - soldQuantity;
      const productQuantity = finiteSnapshot(product.quantity);
      if (!Number.isFinite(productQuantity) || productQuantity < 0 ||
          !Number.isFinite(expectedQuantity) ||
          Math.abs(expectedQuantity - productQuantity) > 0.00000001) {
        return skip('tồn thực tế không khớp lịch sử nhập/bán/trả; cần đối soát giao dịch khác');
      }
      const remainingTaxable = receivedTaxable - soldTaxable;
      const physicalUnits = taxUnits(product.quantity);
      if (!Number.isFinite(remainingTaxable) || remainingTaxable < -0.00000001 ||
          remainingTaxable > productQuantity + 0.00000001 ||
          physicalUnits === undefined || exactTaxableStock > physicalUnits) {
        return skip('snapshot thuế không khớp tồn thực tế; cần đối soát lịch sử');
      }
      let taxableStock: number;
      try {
        taxableStock = this.productTaxStockFromUnits(productId, exactTaxableStock);
      } catch (error) {
        if (error instanceof BadRequestException) return skip(error.message);
        throw error;
      }
      if (Math.abs(Number(product.taxable_quantity_stock || 0) - taxableStock) <= 0.00005) {
        return unchanged;
      }
      await manager.update(Product, productId, { taxable_quantity_stock: taxableStock });
      return { productUpdated: true, salesItemsUpdated: 0 };
    });
  }

  async createBorrow(
    dto: CreateInventoryBorrowDto,
    userId: number,
  ): Promise<InventoryBorrow> {
    if (!dto.borrower_name?.trim()) {
      throw new BadRequestException('Vui lòng chọn hoặc nhập tên nhà cung cấp mượn hàng');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Phiếu mượn phải có ít nhất 1 sản phẩm');
    }

    const queryRunner =
      this.inventoryBorrowRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const borrowData: Partial<InventoryBorrow> = {
        code: CodeGeneratorHelper.generateUniqueCode('BRW'),
        borrower_customer_id: dto.borrower_customer_id || null,
        borrower_name: dto.borrower_name.trim(),
        borrow_date: dto.borrow_date as any,
        expected_return_date: (dto.expected_return_date || null) as any,
        status: InventoryBorrowStatus.DRAFT,
        created_by: userId,
      };
      if (dto.notes !== undefined) {
        borrowData.notes = dto.notes;
      }

      const borrow = queryRunner.manager.create(InventoryBorrow, borrowData);

      const savedBorrow = await queryRunner.manager.save(borrow);

      const items: InventoryBorrowItem[] = [];
      for (const item of dto.items) {
        const batch = await queryRunner.manager.findOne(InventoryBatch, {
          where: { id: Number(item.batch_id) },
          lock: { mode: 'pessimistic_write' },
        });

        if (!batch) {
          throw new NotFoundException(`Không tìm thấy lô hàng #${item.batch_id}`);
        }
        if (Number(batch.product_id) !== Number(item.product_id)) {
          throw new BadRequestException(
            `Lô ${batch.code || `#${batch.id}`} không thuộc sản phẩm đã chọn`,
          );
        }
        if (Number(batch.remaining_quantity || 0) < Number(item.quantity)) {
          throw new BadRequestException(
            `Lô ${batch.code || `#${batch.id}`} chỉ còn ${batch.remaining_quantity}, không đủ cho mượn ${item.quantity}`,
          );
        }

        const itemData: Partial<InventoryBorrowItem> = {
          borrow_id: savedBorrow.id,
          product_id: Number(item.product_id),
          batch_id: Number(item.batch_id),
          receipt_item_id: batch.receipt_item_id || null,
          quantity: Number(item.quantity),
          returned_quantity: 0,
          converted_to_sale_quantity: 0,
        };
        if (item.notes !== undefined) {
          itemData.notes = item.notes;
        }

        items.push(queryRunner.manager.create(InventoryBorrowItem, itemData));
      }

      await queryRunner.manager.save(InventoryBorrowItem, items);
      await queryRunner.commitTransaction();

      if (dto.status === InventoryBorrowStatus.APPROVED) {
        return this.approveBorrow(savedBorrow.id, userId);
      }

      return this.findBorrowById(savedBorrow.id) as Promise<InventoryBorrow>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async searchBorrows(searchDto: SearchInventoryBorrowDto): Promise<{
    data: InventoryBorrow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Number(searchDto.page || 1);
    const limit = Number(searchDto.limit || 20);
    const queryBuilder = this.inventoryBorrowRepository
      .createQueryBuilder('borrow')
      .leftJoinAndSelect('borrow.borrower_customer', 'borrower_customer')
      .leftJoinAndSelect('borrow.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('items.batch', 'batch')
      .where('borrow.deleted_at IS NULL');

    if (searchDto.status) {
      queryBuilder.andWhere('borrow.status = :status', {
        status: searchDto.status,
      });
    }
    if (searchDto.keyword?.trim()) {
      queryBuilder.andWhere(
        '(borrow.code ILIKE :keyword OR borrow.borrower_name ILIKE :keyword)',
        { keyword: `%${QueryHelper.sanitizeKeyword(searchDto.keyword)}%` },
      );
    }

    const [data, total] = await queryBuilder
      .orderBy('borrow.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findBorrowById(id: number): Promise<InventoryBorrow | null> {
    return this.inventoryBorrowRepository.findOne({
      where: { id },
      relations: [
        'borrower_customer',
        'items',
        'items.product',
        'items.batch',
        'items.batch.supplier',
        'creator',
        'approver',
      ],
    });
  }

  async approveBorrow(id: number, userId: number): Promise<InventoryBorrow> {
    const queryRunner =
      this.inventoryBorrowRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const borrow = await queryRunner.manager.findOne(InventoryBorrow, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!borrow) {
        throw new NotFoundException('Không tìm thấy phiếu cho mượn');
      }
      if (borrow.status !== InventoryBorrowStatus.DRAFT) {
        throw new BadRequestException('Chỉ duyệt được phiếu mượn đang nháp');
      }

      const items = await queryRunner.manager.find(InventoryBorrowItem, {
        where: { borrow_id: borrow.id },
      });

      for (const item of items) {
        const stockOutOptions: {
          batchId?: number;
          receiptItemId?: number;
          requireBatchTaxSnapshot: boolean;
        } = {
          batchId: Number(item.batch_id),
          requireBatchTaxSnapshot: true,
        };
        if (item.receipt_item_id) {
          stockOutOptions.receiptItemId = Number(item.receipt_item_id);
        }

        const stockOutResult = await this.processStockOut(
          Number(item.product_id),
          Number(item.quantity),
          'BORROW_OUT',
          userId,
          borrow.id,
          `Cho ${borrow.borrower_name} mượn hàng - phiếu ${borrow.code}`,
          queryRunner,
          stockOutOptions,
        );
        item.taxable_quantity = stockOutResult.taxableQuantity;
        await queryRunner.manager.save(InventoryBorrowItem, item);
      }

      borrow.status = InventoryBorrowStatus.APPROVED;
      borrow.approved_by = userId;
      borrow.approved_at = new Date();
      await queryRunner.manager.save(borrow);

      await queryRunner.commitTransaction();
      return (await this.findBorrowById(id)) as InventoryBorrow;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelBorrow(id: number, userId: number): Promise<InventoryBorrow> {
    const queryRunner =
      this.inventoryBorrowRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const borrow = await queryRunner.manager.findOne(InventoryBorrow, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!borrow) {
        throw new NotFoundException('Không tìm thấy phiếu cho mượn');
      }
      if (borrow.status !== InventoryBorrowStatus.APPROVED) {
        throw new BadRequestException('Chỉ hủy được phiếu đang mượn');
      }

      const items = await queryRunner.manager.find(InventoryBorrowItem, {
        where: { borrow_id: borrow.id },
      });

      for (const item of items) {
        const returnedQuantity = Number(item.returned_quantity || 0);
        const convertedQuantity = Number(item.converted_to_sale_quantity || 0);
        if (returnedQuantity > 0 || convertedQuantity > 0) {
          throw new BadRequestException(
            'Phiếu đã có hàng trả hoặc chuyển bán, không thể hủy trực tiếp',
          );
        }

        const quantity = Number(item.quantity || 0);
        await this.restoreBorrowItemStock(
          borrow,
          item,
          quantity,
          userId,
          'BORROW_CANCEL',
          `Hủy phiếu cho mượn ${borrow.code} - hoàn kho`,
          queryRunner,
          0,
        );
      }

      borrow.status = InventoryBorrowStatus.CANCELLED;
      await queryRunner.manager.save(borrow);

      await queryRunner.commitTransaction();
      return (await this.findBorrowById(id)) as InventoryBorrow;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async returnBorrow(
    id: number,
    userId: number,
    returnItems?: Array<{ item_id: number; quantity: number }>,
  ): Promise<InventoryBorrow> {
    const queryRunner =
      this.inventoryBorrowRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const borrow = await queryRunner.manager.findOne(InventoryBorrow, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!borrow) {
        throw new NotFoundException('Không tìm thấy phiếu cho mượn');
      }
      if (
        ![
          InventoryBorrowStatus.APPROVED,
          InventoryBorrowStatus.PARTIAL_RETURNED,
        ].includes(borrow.status)
      ) {
        throw new BadRequestException('Chỉ trả được phiếu đang mượn');
      }

      const items = await queryRunner.manager.find(InventoryBorrowItem, {
        where: { borrow_id: borrow.id },
      });
      const returnQuantityByItemId = new Map<number, number>();
      for (const item of returnItems || []) {
        returnQuantityByItemId.set(
          Number(item.item_id),
          Number(item.quantity || 0),
        );
      }

      let hasReturnedQuantity = false;
      for (const item of items) {
        const borrowedQuantity = Number(item.quantity || 0);
        const alreadyReturnedQuantity = Number(item.returned_quantity || 0);
        const convertedQuantity = Number(item.converted_to_sale_quantity || 0);
        if (convertedQuantity > 0) {
          throw new BadRequestException(
            `Không thể trả phiếu mượn ${borrow.code}: dòng #${item.id} đã chuyển ` +
              `${convertedQuantity} đơn vị sang bán nhưng chưa có snapshot thuế phần chuyển. ` +
              'Cần đối soát trước khi trả hàng.',
          );
        }
        const remainingBorrowedQuantity = Math.max(
          0,
          borrowedQuantity - alreadyReturnedQuantity - convertedQuantity,
        );

        const requestedReturnQuantity = returnQuantityByItemId.has(
          Number(item.id),
        )
          ? Number(returnQuantityByItemId.get(Number(item.id)) || 0)
          : remainingBorrowedQuantity;

        if (requestedReturnQuantity <= 0) {
          continue;
        }
        if (requestedReturnQuantity > remainingBorrowedQuantity) {
          throw new BadRequestException(
            `Dòng #${item.id} chỉ còn ${remainingBorrowedQuantity} có thể trả`,
          );
        }

        await this.restoreBorrowItemStock(
          borrow,
          item,
          requestedReturnQuantity,
          userId,
          'BORROW_RETURN',
          `Trả hàng mượn - phiếu ${borrow.code}`,
          queryRunner,
          alreadyReturnedQuantity,
        );

        item.returned_quantity =
          alreadyReturnedQuantity + requestedReturnQuantity;
        await queryRunner.manager.save(item);
        hasReturnedQuantity = true;
      }

      if (!hasReturnedQuantity) {
        throw new BadRequestException('Phiếu không còn số lượng cần trả');
      }

      const refreshedItems = await queryRunner.manager.find(
        InventoryBorrowItem,
        {
          where: { borrow_id: borrow.id },
        },
      );
      const allSettled = refreshedItems.every((item) => {
        const borrowedQuantity = Number(item.quantity || 0);
        const returnedQuantity = Number(item.returned_quantity || 0);
        const convertedQuantity = Number(item.converted_to_sale_quantity || 0);
        return returnedQuantity + convertedQuantity >= borrowedQuantity;
      });

      borrow.status = allSettled
        ? InventoryBorrowStatus.RETURNED
        : InventoryBorrowStatus.PARTIAL_RETURNED;
      await queryRunner.manager.save(borrow);

      await queryRunner.commitTransaction();
      return (await this.findBorrowById(id)) as InventoryBorrow;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async restoreBorrowItemStock(
    borrow: InventoryBorrow,
    item: InventoryBorrowItem,
    quantity: number,
    userId: number,
    referenceType: string,
    notes: string,
    queryRunner: QueryRunner,
    alreadyReturnedQuantity: number,
  ): Promise<void> {
    const product = await queryRunner.manager.findOne(Product, {
      where: { id: Number(item.product_id) },
      lock: { mode: 'pessimistic_write' },
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm #${item.product_id}`);
    }

    const batch = await queryRunner.manager.findOne(InventoryBatch, {
      where: { id: Number(item.batch_id), product_id: Number(item.product_id) },
      lock: { mode: 'pessimistic_write' },
    });
    if (!batch) {
      throw new NotFoundException(`Không tìm thấy lô hàng #${item.batch_id}`);
    }

    const borrowedQuantity = Number(item.quantity || 0);
    const snapshot = Number(item.taxable_quantity);
    const taxableQuantityToRestore = taxableQuantityForBorrowReturn(
      borrowedQuantity,
      snapshot,
      alreadyReturnedQuantity,
      quantity,
    );
    if (
      item.taxable_quantity === null ||
      item.taxable_quantity === undefined ||
      taxableQuantityToRestore === undefined
    ) {
      throw new BadRequestException(
        `Không thể trả/hủy phiếu mượn ${borrow.code}: dòng #${item.id} ` +
          'thiếu snapshot số lượng thuế hợp lệ. Cần đối soát chứng từ gốc trước khi tiếp tục.',
      );
    }
    const oldBatchRemaining = Number(batch.remaining_quantity || 0);
    const oldBatchTaxable = batch.taxable_remaining_quantity;
    if (
      oldBatchTaxable === null ||
      oldBatchTaxable === undefined ||
      !Number.isFinite(Number(oldBatchTaxable)) ||
      Number(oldBatchTaxable) < 0 ||
      Number(oldBatchTaxable) > oldBatchRemaining
    ) {
      throw new BadRequestException(
        `Không thể trả/hủy phiếu mượn ${borrow.code}: tồn thuế lô #${batch.id} ` +
          'thiếu hoặc không hợp lệ; cần đối soát lô trước khi tiếp tục.',
      );
    }
    const newBatchRemaining = Number(batch.remaining_quantity || 0) + quantity;
    const newBatchTaxable = Number(oldBatchTaxable) + taxableQuantityToRestore;
    if (newBatchTaxable > newBatchRemaining) {
      throw new BadRequestException(
        `Không thể trả/hủy phiếu mượn ${borrow.code}: snapshot thuế dòng #${item.id} ` +
          `làm tồn thuế lô #${batch.id} (${newBatchTaxable}) vượt tồn kho lô (${newBatchRemaining}).`,
      );
    }
    batch.remaining_quantity = newBatchRemaining;
    batch.taxable_remaining_quantity = newBatchTaxable;
    await queryRunner.manager.save(batch);

    const newProductQuantity = Number(product.quantity || 0) + quantity;
    const oldProductTaxUnits = this.taxQuantityUnits(product.taxable_quantity_stock ?? 0);
    const restoredTaxUnits = this.taxQuantityUnits(taxableQuantityToRestore);
    const newTaxableQuantityStock = this.productTaxStockFromUnits(
      Number(item.product_id),
      oldProductTaxUnits !== undefined && restoredTaxUnits !== undefined
        ? oldProductTaxUnits + restoredTaxUnits
        : undefined,
    );
    if (newTaxableQuantityStock > newProductQuantity) {
      throw new BadRequestException(
        `Không thể trả/hủy phiếu mượn ${borrow.code}: tồn thuế sản phẩm #${item.product_id} ` +
          'sẽ vượt tồn kho sau khi hoàn.',
      );
    }
    await queryRunner.manager.update(Product, product.id, {
      quantity: newProductQuantity,
      taxable_quantity_stock: newTaxableQuantityStock,
    });

    const currentAverageCost = await this.getWeightedAverageCost(
      product.id,
      queryRunner,
    );
    const unitCost = Number(batch.unit_cost_price || 0);
    await this.createTransaction(
      {
        product_id: product.id,
        transaction_type: 'IN',
        quantity,
        unit_cost_price: unitCost.toString(),
        total_cost_value: (quantity * unitCost).toString(),
        remaining_quantity: newProductQuantity,
        new_average_cost: currentAverageCost.toString(),
        reference_type: referenceType,
        reference_id: borrow.id,
        notes,
        created_by_user_id: userId,
        ...(batch.receipt_item_id && {
          receipt_item_id: Number(batch.receipt_item_id),
        }),
      },
      queryRunner,
    );
  }

  async deleteBorrow(id: number): Promise<{ success: boolean }> {
    const borrow = await this.inventoryBorrowRepository.findOne({
      where: { id },
    });

    if (!borrow) {
      throw new NotFoundException('Không tìm thấy phiếu cho mượn');
    }
    if (borrow.status !== InventoryBorrowStatus.DRAFT) {
      throw new BadRequestException('Chỉ xóa được phiếu mượn đang nháp');
    }

    await this.inventoryBorrowRepository.manager.transaction(
      async (manager) => {
        await manager.delete(InventoryBorrowItem, { borrow_id: id });
        await manager.delete(InventoryBorrow, id);
      },
    );

    return { success: true };
  }

  /**
   * Đánh dấu các hình ảnh trong kho hàng là đã sử dụng
   */
  private async markInventoryImagesAsUsed(
    entityType: 'InventoryReceipt' | 'InventoryReturn' | 'InventoryAdjustment',
    entityId: number,
    images?: string[],
  ): Promise<void> {
    if (!images || images.length === 0) return;

    for (const url of images) {
      const file = await this.fileTrackingService.findByFileUrl(url);
      if (file) {
        await this.fileTrackingService.createFileReference(
          file,
          entityType,
          entityId,
          'images',
        );
        await this.fileTrackingService.incrementReferenceCount(file.id);
      }
    }
  }

  /**
   * Xử lý cập nhật hình ảnh cho kho hàng (tăng/giảm reference count)
   */
  private async handleInventoryImageUpdate(
    entityType: 'InventoryReceipt' | 'InventoryReturn' | 'InventoryAdjustment',
    entityId: number,
    oldImages: string[] = [],
    newImages: string[] = [],
  ): Promise<void> {
    const oldImgs = oldImages || [];
    const newImgs = newImages || [];

    // 1. Tìm các ảnh bị gỡ
    const removedImages = oldImgs.filter((url) => !newImgs.includes(url));
    for (const url of removedImages) {
      await this.fileTrackingService.removeFileReferenceByUrl(
        url,
        entityType,
        entityId,
      );
    }

    // 2. Tìm các ảnh mới thêm
    const addedImages = newImgs.filter((url) => !oldImgs.includes(url));
    for (const url of addedImages) {
      const file = await this.fileTrackingService.findByFileUrl(url);
      if (file) {
        await this.fileTrackingService.createFileReference(
          file,
          entityType,
          entityId,
          'images',
        );
        await this.fileTrackingService.incrementReferenceCount(file.id);
      }
    }
  }
}
