import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, DataSource, QueryRunner, In } from 'typeorm';
import {
  SalesInvoice,
  SalesInvoiceStatus,
  SalesPaymentStatus,
} from '../../entities/sales-invoices.entity';
import {
  SalesInvoiceItem,
  SalesInvoiceItemPriceType,
} from '../../entities/sales-invoice-items.entity';
import { Product, ProductCostingMethod } from '../../entities/products.entity';
import { DeliveryLog } from '../../entities/delivery-log.entity';
import { DeliveryLogItem } from '../../entities/delivery-log-item.entity';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { UpdateSalesInvoiceDto } from './dto/update-sales-invoice.dto';
import { SearchSalesDto } from './dto/search-sales.dto';
import { CreateDeliveryLogDto } from './dto/delivery-log.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { DebtNoteService } from '../debt-note/debt-note.service';
import { DeliveryStatus } from './enums/delivery-status.enum';
import { DeliveryNotificationService } from './delivery-notification.service';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { PromotionCampaignService } from '../promotion-campaign/promotion-campaign.service';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';

/**
 * Service xử lý logic nghiệp vụ liên quan đến quản lý bán hàng
 * Bao gồm quản lý hóa đơn bán hàng và chi tiết hóa đơn
 */
@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  /**
   * Constructor injection các repository cần thiết
   * @param salesInvoiceRepository - Repository để thao tác với entity SalesInvoice
   * @param salesInvoiceItemRepository - Repository để thao tác với entity SalesInvoiceItem
   * @param deliveryLogRepository - Repository để thao tác với entity DeliveryLog
   * @param deliveryLogItemRepository - Repository để thao tác với entity DeliveryLogItem
   * @param debtNoteService - Service xử lý công nợ
   * @param dataSource - DataSource để tạo raw query builder
   */
  constructor(
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
    @InjectRepository(SalesInvoiceItem)
    private salesInvoiceItemRepository: Repository<SalesInvoiceItem>,
    @InjectRepository(DeliveryLog)
    private deliveryLogRepository: Repository<DeliveryLog>,
    @InjectRepository(DeliveryLogItem)
    private deliveryLogItemRepository: Repository<DeliveryLogItem>,
    private debtNoteService: DebtNoteService,
    private dataSource: DataSource,
    private deliveryNotificationService: DeliveryNotificationService,
    private inventoryService: InventoryService,
    private customerRewardService: CustomerRewardService,
    private promotionCampaignService: PromotionCampaignService,
  ) {}

  private parseMoney(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return Number.NaN;
    }

    if (typeof value === 'number') {
      return value;
    }

    const normalized = String(value).replace(/[^0-9.-]/g, '');
    return Number(normalized);
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private isPostedInvoiceStatus(status: SalesInvoiceStatus): boolean {
    return (
      status === SalesInvoiceStatus.CONFIRMED ||
      status === SalesInvoiceStatus.PAID
    );
  }

  private async assertInvoiceProductMixingAllowed(
    items: Array<{ product_id: number }>,
    manager: any,
  ): Promise<void> {
    const productIds = Array.from(
      new Set(items.map((item) => Number(item.product_id)).filter((id) => id > 0)),
    );
    if (!productIds.length) {
      return;
    }

    const products = await manager.find(Product, {
      where: { id: In(productIds) },
    });
    const productMap = new Map(products.map((product) => [Number(product.id), product]));

    for (const productId of productIds) {
      if (!productMap.has(productId)) {
        throw new BadRequestException(`Sản phẩm ID ${productId} không tồn tại`);
      }
    }

    const hasByPriceType = products.some(
      (product) => product.costing_method === ProductCostingMethod.BY_PRICE_TYPE,
    );
    const hasStandard = products.some(
      (product) => product.costing_method !== ProductCostingMethod.BY_PRICE_TYPE,
    );

    if (hasByPriceType && hasStandard) {
      throw new BadRequestException(
        'Không được trộn lúa giống quyết toán theo loại bán với sản phẩm thường trong cùng một phiếu bán.',
      );
    }
  }

  private calculateInvoiceSubtotal(items: CreateSalesInvoiceDto['items']): number {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Hóa đơn phải có ít nhất 1 sản phẩm');
    }

    return this.roundMoney(
      items.reduce((sum, item, index) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        const discountAmount = Number(item.discount_amount || 0);

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException(`Số lượng dòng ${index + 1} phải lớn hơn 0`);
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new BadRequestException(`Đơn giá dòng ${index + 1} không hợp lệ`);
        }

        if (!Number.isFinite(discountAmount) || discountAmount < 0) {
          throw new BadRequestException(`Giảm giá dòng ${index + 1} không hợp lệ`);
        }

        const lineTotal = this.roundMoney(quantity * unitPrice - discountAmount);
        if (lineTotal < 0) {
          throw new BadRequestException(
            `Giảm giá dòng ${index + 1} không được lớn hơn thành tiền của dòng`,
          );
        }

        return sum + lineTotal;
      }, 0),
    );
  }

  private assertInvoiceAmountMatches(
    label: string,
    submittedValue: unknown,
    computedValue: number,
  ): void {
    if (submittedValue === undefined || submittedValue === null || submittedValue === '') {
      return;
    }

    const submittedNumber = this.roundMoney(Number(submittedValue));
    if (!Number.isFinite(submittedNumber)) {
      throw new BadRequestException(`${label} không hợp lệ`);
    }

    if (Math.abs(submittedNumber - computedValue) > 1) {
      throw new BadRequestException(
        `${label} không khớp với chi tiết sản phẩm. FE gửi ${submittedNumber.toLocaleString()}đ, backend tính ${computedValue.toLocaleString()}đ`,
      );
    }
  }

  private async createRefundPaymentForInvoice(
    manager: any,
    invoice: SalesInvoice,
    amount: number,
    userId: number | undefined,
    notes: string,
  ): Promise<void> {
    const refundAmount = this.roundMoney(Number(amount || 0));
    if (refundAmount <= 0) {
      return;
    }

    const refundCode = CodeGeneratorHelper.generateUniqueCode('PAY-REF');
    const refundPayment = manager.create(Payment, {
      code: refundCode,
      customer_id: invoice.customer_id || null,
      amount: -refundAmount,
      allocated_amount: -refundAmount,
      payment_date: new Date(),
      payment_method: 'REFUND',
      notes,
      created_by: userId || (invoice.created_by as any),
    });
    const savedPayment = await manager.save(refundPayment);

    await manager.save(PaymentAllocation, {
      payment_id: savedPayment.id,
      invoice_id: invoice.id,
      allocation_type: 'invoice',
      amount: -refundAmount,
    });
  }

  private async postInvoiceFinancialEntries(
    manager: any,
    invoice: SalesInvoice,
    userId: number,
  ): Promise<void> {
    if (!invoice.customer_id || !invoice.season_id) {
      return;
    }

    const debtNote = await this.debtNoteService.findOrCreateForSeason(
      invoice.customer_id,
      invoice.season_id,
      invoice.created_by,
      manager,
    );

    if ((debtNote.source_invoices || []).includes(invoice.id)) {
      this.logger.log(
        `ℹ️ Hóa đơn #${invoice.code} đã được post vào công nợ, bỏ qua post lại.`,
      );
      return;
    }

    await this.debtNoteService.addInvoiceToDebtNote(
      debtNote.id,
      invoice.id,
      invoice.final_amount,
      invoice.partial_payment_amount,
      manager,
    );

    const partialPayment = this.roundMoney(
      Number(invoice.partial_payment_amount || 0),
    );

    if (partialPayment > 0) {
      const paymentCode = CodeGeneratorHelper.generateUniqueCode('PAY');
      const payment = manager.create(Payment, {
        code: paymentCode,
        customer_id: invoice.customer_id || null,
        amount: partialPayment,
        allocated_amount: partialPayment,
        payment_date: new Date(),
        payment_method: invoice.payment_method || 'cash',
        notes: `Thanh toán khi xác nhận hóa đơn #${invoice.code}`,
        created_by: userId,
        debt_note_code: debtNote?.code || null,
      });
      const savedPayment = await manager.save(payment);

      const allocation = manager.create(PaymentAllocation, {
        payment_id: savedPayment.id,
        invoice_id: invoice.id,
        ...(debtNote?.id && { debt_note_id: debtNote.id }),
        allocation_type: 'invoice',
        amount: partialPayment,
      });
      await manager.save(allocation);

      this.logger.log(
        `✅ Đã tạo phiếu thu #${paymentCode} và phân bổ ${partialPayment.toLocaleString()} đ cho hóa đơn #${invoice.code}`,
      );
    }

    const giftValue = Number(invoice.gift_value || 0);
    if (invoice.gift_description || giftValue > 0 || partialPayment > 0) {
      const updatedDebtNote = await manager.findOne(DebtNote, {
        where: {
          customer_id: invoice.customer_id as number,
          season_id: invoice.season_id as number,
        },
        relations: ['customer', 'season'],
      });

      if (updatedDebtNote) {
        await this.customerRewardService.handleDebtNoteSettlement(
          manager,
          updatedDebtNote,
          {
            payment_amount: partialPayment,
            gift_description: invoice.gift_description,
            gift_value: giftValue,
            gift_status: 'delivered',
            rice_crop_id: invoice.rice_crop_id,
            notes: invoice.notes
              ? invoice.notes
              : invoice.gift_description
                ? `Tặng quà kèm hóa đơn #${invoice.code}`
                : `Tích lũy từ thanh toán hóa đơn #${invoice.code}`,
          },
          userId,
          false,
        );
      }
    }

    this.logger.log(
      `✅ Đã post công nợ/thanh toán/tích lũy cho hóa đơn #${invoice.code}`,
    );
  }

  private normalizePriceType(
    priceType?: string,
    paymentMethod?: string,
  ): SalesInvoiceItemPriceType {
    if (priceType === SalesInvoiceItemPriceType.CREDIT) {
      return SalesInvoiceItemPriceType.CREDIT;
    }

    if (priceType === SalesInvoiceItemPriceType.CASH) {
      return SalesInvoiceItemPriceType.CASH;
    }

    return paymentMethod === 'debt'
      ? SalesInvoiceItemPriceType.CREDIT
      : SalesInvoiceItemPriceType.CASH;
  }

  private resolveProductCostPrice(
    product: Product,
    priceType: SalesInvoiceItemPriceType,
  ): number {
    const costingMethod =
      product.costing_method || ProductCostingMethod.FIXED;

    if (costingMethod === ProductCostingMethod.BY_PRICE_TYPE) {
      const sourceCost =
        priceType === SalesInvoiceItemPriceType.CREDIT
          ? product.credit_cost_price
          : product.cash_cost_price;
      const cost = this.parseMoney(sourceCost);

      if (!Number.isFinite(cost) || cost <= 0) {
        const priceTypeName =
          priceType === SalesInvoiceItemPriceType.CREDIT
            ? 'bán nợ'
            : 'tiền mặt';
        throw new BadRequestException(
          `Sản phẩm "${product.trade_name || product.name}" chưa cấu hình giá vốn ${priceTypeName}`,
        );
      }

      return cost;
    }

    const cost = this.parseMoney(product.average_cost_price);
    if (!Number.isFinite(cost) || cost <= 0) {
      throw new BadRequestException(
        `Sản phẩm "${product.trade_name || product.name}" chưa có giá vốn`,
      );
    }

    return cost;
  }

  /**
   * Đồng bộ lại giá vốn snapshot của hóa đơn đã post từ dữ liệu xuất kho thực tế.
   * Ưu tiên dùng sales_invoice_item_stock_allocations nếu có.
   * Fallback sang inventory_transactions.total_value cho dữ liệu cũ chưa có allocation.
   */
  private async syncPostedInvoiceCostSnapshot(
    invoiceId: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;
    const invoice = await this.findOne(invoiceId, queryRunner);

    if (!invoice || !invoice.items || invoice.items.length === 0) {
      return;
    }

    let totalCOGS = 0;

    for (const item of invoice.items) {
      const baseQty = Number(item.base_quantity || item.quantity || 0);
      const isByPriceType =
        item.costing_method_snapshot === ProductCostingMethod.BY_PRICE_TYPE;

      // Với lúa giống / sản phẩm chốt giá vốn theo loại giá bán,
      // giữ nguyên snapshot đã chốt lúc tạo hóa đơn.
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
        itemCostPrice =
          allocatedQty > 0 ? itemTotalCost / allocatedQty : 0;
      } else {
        const tx = await manager.findOne(InventoryTransaction, {
          where: {
            type: 'OUT',
            reference_type: 'SALE',
            reference_id: invoiceId,
            product_id: item.product_id,
          },
          order: { created_at: 'ASC' },
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
        ? Math.round((grossProfit / Number(invoice.final_amount || 0)) * 10000) /
          100
        : 0;

    await manager.update(SalesInvoice, invoiceId, {
      cost_of_goods_sold: roundedCOGS,
      gross_profit: grossProfit,
      gross_profit_margin: grossProfitMargin,
    });
  }

  /**
   * Tạo hóa đơn bán hàng mới
   * @param createSalesInvoiceDto - Dữ liệu tạo hóa đơn bán hàng mới
   * @param userId - ID của user đang tạo hóa đơn (từ JWT token)
   * @returns Thông tin hóa đơn bán hàng đã tạo
   */
  async create(
    createSalesInvoiceDto: CreateSalesInvoiceDto,
    userId: number,
  ): Promise<SalesInvoice> {
    this.logger.log(`Bắt đầu tạo hóa đơn bán hàng: ${createSalesInvoiceDto.invoice_code || 'AUTO-GEN'}`);
    
    const queryRunner = this.salesInvoiceRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const computedTotalAmount = this.calculateInvoiceSubtotal(
        createSalesInvoiceDto.items,
      );
      const invoiceDiscountAmount = this.roundMoney(
        Number(createSalesInvoiceDto.discount_amount || 0),
      );

      if (!Number.isFinite(invoiceDiscountAmount) || invoiceDiscountAmount < 0) {
        throw new BadRequestException('Giảm giá hóa đơn không hợp lệ');
      }

      if (invoiceDiscountAmount > computedTotalAmount) {
        throw new BadRequestException(
          'Giảm giá hóa đơn không được lớn hơn tổng tiền sản phẩm',
        );
      }

      const computedFinalAmount = this.roundMoney(
        computedTotalAmount - invoiceDiscountAmount,
      );
      this.assertInvoiceAmountMatches(
        'Tổng tiền hóa đơn',
        createSalesInvoiceDto.total_amount,
        computedTotalAmount,
      );
      this.assertInvoiceAmountMatches(
        'Thành tiền sau giảm giá',
        createSalesInvoiceDto.final_amount,
        computedFinalAmount,
      );

      const partialPayment = this.roundMoney(
        Number(createSalesInvoiceDto.partial_payment_amount || 0),
      );

      if (!Number.isFinite(partialPayment) || partialPayment < 0) {
        throw new BadRequestException('Số tiền đã thanh toán không hợp lệ');
      }

      if (partialPayment - computedFinalAmount > 1) {
        throw new BadRequestException(
          'Số tiền đã thanh toán không được lớn hơn thành tiền hóa đơn',
        );
      }

      const finalAmount = computedFinalAmount;
      const remainingAmount = this.roundMoney(finalAmount - partialPayment);
      const initialStatus =
        createSalesInvoiceDto.status || SalesInvoiceStatus.DRAFT;

      if (
        ![
          SalesInvoiceStatus.DRAFT,
          SalesInvoiceStatus.CONFIRMED,
          SalesInvoiceStatus.PAID,
        ].includes(initialStatus)
      ) {
        throw new BadRequestException(
          'Trạng thái hóa đơn không hợp lệ khi tạo mới. Chỉ cho phép draft, confirmed hoặc paid.',
        );
      }

      if (initialStatus === SalesInvoiceStatus.PAID && remainingAmount > 1) {
        throw new BadRequestException(
          'Không thể tạo hóa đơn đã thanh toán khi vẫn còn số tiền nợ',
        );
      }

      await this.assertInvoiceProductMixingAllowed(
        createSalesInvoiceDto.items,
        queryRunner.manager,
      );

      // Tự động sinh mã hóa đơn nếu không có
      const invoiceCode = createSalesInvoiceDto.invoice_code || CodeGeneratorHelper.generateUniqueCode('HD');

      // Tạo phiếu bán hàng với trạng thái mặc định là DRAFT
      const invoiceData: any = {
        code: invoiceCode,
        customer_id: createSalesInvoiceDto.customer_id, // ID khách hàng nếu có
        customer_name: createSalesInvoiceDto.customer_name,
        customer_phone: createSalesInvoiceDto.customer_phone,
        customer_email: createSalesInvoiceDto.customer_email,
        customer_address: createSalesInvoiceDto.customer_address,
        total_amount: computedTotalAmount,
        discount_amount: invoiceDiscountAmount,
        final_amount: finalAmount,
        payment_method: createSalesInvoiceDto.payment_method,
        notes: createSalesInvoiceDto.notes,
        warning: createSalesInvoiceDto.warning,
        created_by: userId, // Lấy từ JWT token
        status: initialStatus, // Trạng thái từ DTO hoặc mặc định là DRAFT
        partial_payment_amount: partialPayment,
        remaining_amount: remainingAmount,
        payment_status: remainingAmount <= 0 ? SalesPaymentStatus.PAID : (partialPayment > 0 ? SalesPaymentStatus.PARTIAL : SalesPaymentStatus.PENDING),
        rice_crop_id: createSalesInvoiceDto.rice_crop_id,
        season_id: createSalesInvoiceDto.season_id,
        gift_description: createSalesInvoiceDto.gift_description,
        gift_value: createSalesInvoiceDto.gift_value || 0,
        sale_date: createSalesInvoiceDto.sale_date ? new Date(createSalesInvoiceDto.sale_date) : new Date(),
      };
      
      const invoice = queryRunner.manager.create(SalesInvoice, invoiceData);
      const savedInvoice = await queryRunner.manager.save(invoice);
      
      this.logger.log(`Đã lưu hóa đơn với ID: ${savedInvoice.id}`);

      // Khai báo items ở ngoài để dùng cho delivery log
      let items: SalesInvoiceItem[] = [];

      // Tạo các item trong phiếu với tính toán totalPrice và lưu product_name snapshot
      if (createSalesInvoiceDto.items && Array.isArray(createSalesInvoiceDto.items) && createSalesInvoiceDto.items.length > 0) {
        items = await Promise.all(
          createSalesInvoiceDto.items.map(async (item) => {
          // Tính tổng giá tiền = (giá đơn vị * số lượng) - số tiền giảm giá
          const totalPrice = this.roundMoney(
            item.unit_price * item.quantity - (item.discount_amount || 0),
          );

            // Lấy tên sản phẩm, đơn vị tính và giá khai thuế từ DB nếu không có trong DTO
            let productName = item.product_name;
            let unitName = item.unit_name;
            let taxSellingPrice = item.tax_selling_price;
            let product: Product | null = null;
            
            // Luôn lấy thông tin sản phẩm và quy đổi đơn vị để snapshot
            product = await queryRunner.manager.findOne(Product, {
              where: { id: item.product_id },
              relations: ['unit', 'unit_conversions'],
            });
            
            if (!product) {
              throw new BadRequestException(
                `Sản phẩm ID ${item.product_id} không tồn tại`,
              );
            }

            const priceType = this.normalizePriceType(
              item.price_type,
              createSalesInvoiceDto.payment_method,
            );
            const costPrice = this.resolveProductCostPrice(product, priceType);
            const costingMethodSnapshot =
              product.costing_method || ProductCostingMethod.FIXED;

            if (!productName) {
              productName = product?.trade_name || product?.name;
            }
            
            if (!unitName) {
              unitName = product?.unit?.name;
            }

            if (!taxSellingPrice) {
              taxSellingPrice = product?.tax_selling_price;
            }

            // ✅ Tính base_quantity chuẩn từ DB
            let dbConversionFactor = 1;
            if (product && item.sale_unit_id) {
              const conversions = product.unit_conversions || [];
              const conv = conversions.find(c => Number(c.unit_id) === Number(item.sale_unit_id));
              if (conv) {
                dbConversionFactor = Number(conv.conversion_factor || 1);
              } else if (Number(item.sale_unit_id) === Number(product.unit_id)) {
                // Nếu là đơn vị cơ sở nhưng không tìm thấy trong bảng quy đổi (hiếm khi xảy ra)
                dbConversionFactor = 1;
              }
            }
            
            const baseQty = item.quantity * dbConversionFactor;

            // ✅ LOGIC QUY ĐỔI ĐỐI ỨNG (Snapshot Bao/Kg)
            let otherUnitName = '';
            let otherUnitFactor = 1;

            if (product && product.unit_conversions && product.unit_conversions.length > 1) {
              const currentUnitId = item.sale_unit_id;
              
              // Tìm đơn vị cơ sở và các đơn vị quy đổi
              const baseConv = product.unit_conversions.find(c => c.is_base_unit);
              const otherConvs = product.unit_conversions.filter(c => !c.is_base_unit);

              if (currentUnitId === baseConv?.unit_id) {
                // ĐANG BÁN THEO ĐƠN VỊ CƠ SỞ (Kg) -> Tìm đơn vị quy đổi đối ứng (Bao)
                // Ưu tiên đơn vị bán hàng, hoặc đơn vị đầu tiên trong danh sách
                const targetConv = otherConvs.find(c => c.is_sales_unit) || otherConvs[0];
                if (targetConv) {
                  otherUnitName = targetConv.unit_name || '';
                  otherUnitFactor = Number(targetConv.conversion_factor || 1);
                }
              } else {
                // ĐANG BÁN THEO ĐƠN VỊ QUY ĐỔI (Bao) -> Tìm đơn vị cơ sở (Kg)
                if (baseConv) {
                  otherUnitName = baseConv.unit_name || '';
                  otherUnitFactor = Number(baseConv.conversion_factor || 1);
                }
              }
            }

            if (dbConversionFactor !== 1 && product) {
              const productTaxPrice = Number(product.tax_selling_price || 0);
              const currentTaxPrice = Number(taxSellingPrice || 0);

              if (productTaxPrice > 0) {
                if (!taxSellingPrice) {
                  taxSellingPrice = String(productTaxPrice * dbConversionFactor);
                } else if (Math.abs(currentTaxPrice - productTaxPrice) < 0.000001) {
                  taxSellingPrice = String(productTaxPrice * dbConversionFactor);
                }
              }
            }

            return queryRunner.manager.create(SalesInvoiceItem, {
              ...item,
              invoice_id: savedInvoice.id,
              total_price: totalPrice,
              price_type: priceType,
              cost_price: costPrice,
              costing_method_snapshot: costingMethodSnapshot,
              conversion_factor: dbConversionFactor,
              base_quantity: baseQty,
              other_unit_name: otherUnitName,
              other_unit_factor: otherUnitFactor,
              ...(productName && { product_name: productName }),
              ...(unitName && { unit_name: unitName }),
              ...(taxSellingPrice && { tax_selling_price: taxSellingPrice }),
            });
          })
        );

        await queryRunner.manager.save(items);
        savedInvoice.items = items;

        const totalCOGS = this.roundMoney(
          items.reduce((sum, item) => {
            const baseQty = Number(item.base_quantity || item.quantity || 0);
            const costPrice = Number(item.cost_price || 0);
            return sum + baseQty * costPrice;
          }, 0),
        );

        const grossProfit = this.roundMoney(Number(savedInvoice.final_amount) - totalCOGS);
        const margin = savedInvoice.final_amount > 0
          ? Math.round((grossProfit / savedInvoice.final_amount) * 10000) / 100
          : 0;

        savedInvoice.cost_of_goods_sold = totalCOGS;
        savedInvoice.gross_profit = grossProfit;
        savedInvoice.gross_profit_margin = margin;

        await queryRunner.manager.save(savedInvoice);

        this.logger.log(`✅ Đã tính lợi nhuận cho đơn #${savedInvoice.id}: ${grossProfit.toLocaleString()} đ (${margin}%)`);
      }

      // Chỉ ghi công nợ/thanh toán/tích lũy khi hóa đơn đã được post.
      if (this.isPostedInvoiceStatus(savedInvoice.status)) {
        try {
          await this.postInvoiceFinancialEntries(
            queryRunner.manager,
            savedInvoice,
            userId,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          // Nếu lỗi cập nhật công nợ, đây là lỗi NGHIÊM TRỌNG liên quan tiền bạc -> NÊN ROLLBACK
          throw new Error(`Lỗi cập nhật công nợ: ${errorMessage}`);
        }
      }

      // 🆕 Tạo phiếu giao hàng nếu có thông tin giao hàng
      if (createSalesInvoiceDto.delivery_log) {
        try {
          const createdLog = await this.createDeliveryLog(
            createSalesInvoiceDto.delivery_log,
            savedInvoice.id,
            items, // Truyền danh sách items đã lưu
            userId,
            queryRunner.manager,
          );
          
          if (createdLog) {
            savedInvoice.delivery_logs = [createdLog];
          }

          this.logger.log(`✅ Đã tạo phiếu giao hàng cho hóa đơn #${savedInvoice.id}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : '';
          this.logger.error(`❌ Lỗi khi tạo phiếu giao hàng: ${errorMessage}`, errorStack);
          // Throw error để rollback transaction
          throw new Error(`Không thể tạo phiếu giao hàng: ${errorMessage}`);
        }
      }

      if (this.isPostedInvoiceStatus(savedInvoice.status)) {
        await this.promotionCampaignService.processInvoiceAccrual(
          queryRunner.manager,
          savedInvoice.id,
        );
        await this.handleInventoryDeduction(savedInvoice.id, userId, queryRunner);
        await this.inventoryService.syncSupplierSettlementForPostedInvoice(
          savedInvoice.id,
          queryRunner,
        );
        await this.syncPostedInvoiceCostSnapshot(savedInvoice.id, queryRunner);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Đã commit transaction cho hóa đơn ${savedInvoice.id}`);

      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       const errorStack = error instanceof Error ? error.stack : '';
       this.logger.error(`Lỗi khi tạo hóa đơn bán hàng: ${errorMessage}`, errorStack);
       // Re-throw để Global Filter bắt được hoặc trả về error
       ErrorHandler.handleCreateError(error, 'hóa đơn bán hàng');
       throw error; // Make sure to throw after handling/logging
    } finally {
      await queryRunner.release();
    }
  }



  /**
   * Lấy danh sách tất cả hóa đơn bán hàng (không bao gồm đã xóa mềm)
   * @returns Danh sách hóa đơn bán hàng
   */
   async findAll(): Promise<SalesInvoice[]> {
     return this.salesInvoiceRepository.find({
       where: { deleted_at: IsNull() },
       relations: ['items', 'items.product', 'season', 'rice_crop', 'customer'],
       order: { sale_date: 'DESC', created_at: 'DESC' }, // Ưu tiên ngày bán, sau đó đến ngày tạo
     });
   }

  /**
   * Lấy danh sách hóa đơn bán hàng theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách hóa đơn bán hàng theo trạng thái
   */
   async findByStatus(status: SalesInvoiceStatus): Promise<SalesInvoice[]> {
     return this.salesInvoiceRepository.createQueryBuilder('invoice')
       .leftJoinAndSelect('invoice.items', 'items')
       .leftJoinAndSelect('items.product', 'product')
       .leftJoinAndSelect('invoice.season', 'season')
       .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
       .leftJoinAndSelect('invoice.customer', 'customer')
       .leftJoin('invoice.creator', 'creator')
       .addSelect(['creator.id', 'creator.account'])
       .where('invoice.status = :status', { status })
       .andWhere('invoice.deleted_at IS NULL')
       .orderBy('invoice.sale_date', 'DESC')
       .addOrderBy('invoice.created_at', 'DESC')
       .addOrderBy('items.id', 'ASC')
       .getMany();
   }

  /**
   * Lấy danh sách hóa đơn bán hàng đã xóa mềm
   * @returns Danh sách hóa đơn bán hàng đã xóa mềm
   */
   async findDeleted(): Promise<SalesInvoice[]> {
     return this.salesInvoiceRepository.createQueryBuilder('invoice')
       .withDeleted()
       .leftJoinAndSelect('invoice.items', 'items')
       .leftJoinAndSelect('items.product', 'product')
       .leftJoinAndSelect('invoice.season', 'season')
       .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
       .leftJoinAndSelect('invoice.customer', 'customer')
       .leftJoin('invoice.creator', 'creator')
       .addSelect(['creator.id', 'creator.account'])
       .where('invoice.deleted_at IS NOT NULL')
       .orderBy('invoice.deleted_at', 'DESC')
       .getMany();
   }

  /**
   * Tìm hóa đơn bán hàng theo ID
   * @param id - ID của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng với thông tin số lượng đã trả và có thể trả
   */
  async findOne(id: number, queryRunner?: QueryRunner): Promise<SalesInvoice | null> {
    // Lấy hóa đơn với các relations
    const qb = queryRunner 
      ? queryRunner.manager.createQueryBuilder(SalesInvoice, 'invoice')
      : this.salesInvoiceRepository.createQueryBuilder('invoice');

    const invoice = await qb
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.season', 'season')
      .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
      .leftJoinAndSelect('invoice.delivery_logs', 'delivery_logs')
      .leftJoinAndSelect('invoice.returns', 'returns')
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['creator.id', 'creator.account'])
      .where('invoice.id = :id', { id })
      .andWhere('invoice.deleted_at IS NULL')
      .addOrderBy('items.id', 'ASC')
      .getOne();

    if (!invoice) {
      return null;
    }

    // ✅ Tính số lượng đã trả cho mỗi item
    if (invoice.items && invoice.items.length > 0) {
      const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;
      for (const item of invoice.items) {
        // Query tổng số lượng đã trả của đúng dòng hóa đơn; fallback product_id cho dữ liệu cũ
        const returnedData = await manager
          .createQueryBuilder()
          .select('COALESCE(SUM(return_item.quantity), 0)', 'total_returned')
          .from('sales_return_items', 'return_item')
          .innerJoin('sales_returns', 'sales_return', 'sales_return.id = return_item.sales_return_id')
          .where('sales_return.invoice_id = :invoiceId', { invoiceId: id })
          .andWhere('sales_return.status = :status', { status: 'approved' })
          .andWhere(
            '(return_item.sales_invoice_item_id = :invoiceItemId OR (return_item.sales_invoice_item_id IS NULL AND return_item.product_id = :productId))',
            { invoiceItemId: item.id, productId: item.product_id },
          )
          .getRawOne();

        // Gán vào item
        const returnedQty = parseFloat(returnedData?.total_returned || '0');
        (item as any).returned_quantity = returnedQty;
        (item as any).returnable_quantity = item.quantity - returnedQty;
      }
    }

    return invoice;
  }

  /**
   * Tìm hóa đơn bán hàng theo mã
   * @param code - Mã của hóa đơn bán hàng cần tìm
   * @returns Thông tin hóa đơn bán hàng với thông tin số lượng đã trả và có thể trả
   */
  async findByCode(code: string): Promise<SalesInvoice | null> {
    // Lấy hóa đơn với các relations
    const invoice = await this.salesInvoiceRepository.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.season', 'season')
      .leftJoinAndSelect('invoice.rice_crop', 'rice_crop')
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['creator.id', 'creator.account'])
      .where('invoice.code = :code', { code })
      .andWhere('invoice.deleted_at IS NULL')
      .addOrderBy('items.id', 'ASC')
      .getOne();

    if (!invoice) {
      return null;
    }

    // ✅ Tính số lượng đã trả cho mỗi item
    if (invoice.items && invoice.items.length > 0) {
      for (const item of invoice.items) {
        // Query tổng số lượng đã trả của đúng dòng hóa đơn; fallback product_id cho dữ liệu cũ
        const returnedData = await this.dataSource
          .createQueryBuilder()
          .select('COALESCE(SUM(return_item.quantity), 0)', 'total_returned')
          .from('sales_return_items', 'return_item')
          .innerJoin('sales_returns', 'sales_return', 'sales_return.id = return_item.sales_return_id')
          .where('sales_return.invoice_id = :invoiceId', { invoiceId: invoice.id })
          .andWhere('sales_return.status = :status', { status: 'approved' })
          .andWhere(
            '(return_item.sales_invoice_item_id = :invoiceItemId OR (return_item.sales_invoice_item_id IS NULL AND return_item.product_id = :productId))',
            { invoiceItemId: item.id, productId: item.product_id },
          )
          .getRawOne();

        // Gán vào item
        const returnedQty = parseFloat(returnedData?.total_returned || '0');
        (item as any).returned_quantity = returnedQty;
        (item as any).returnable_quantity = item.quantity - returnedQty;
      }
    }

    return invoice;
  }

  /**
   * Tìm hóa đơn bán hàng gần nhất của một khách hàng
   * @param customer_id - ID của khách hàng cần tìm đơn hàng gần nhất
   * @returns Thông tin hóa đơn bán hàng gần nhất của khách hàng
   */
  async findLatestByCustomer(customer_id: number): Promise<SalesInvoice | null> {
    this.logger.log(`[findLatestByCustomer] Searching for customer_id: ${customer_id}`);
    
    // Tìm tất cả hóa đơn của khách hàng để debug
    const allInvoices = await this.salesInvoiceRepository.find({
      where: { 
        customer_id, 
        deleted_at: IsNull() 
      },
      order: { sale_date: 'DESC', created_at: 'DESC' },
      take: 5,
    });
    
    this.logger.log(`[findLatestByCustomer] Found ${allInvoices.length} invoices for customer_id ${customer_id}`);
    if (allInvoices.length > 0) {
      this.logger.log('[findLatestByCustomer] Sample invoice:', {
        id: allInvoices[0]?.id,
        code: allInvoices[0]?.code,
        customer_id: allInvoices[0]?.customer_id,
        customer_name: allInvoices[0]?.customer_name,
        date: allInvoices[0]?.sale_date || allInvoices[0]?.created_at,
      });
    }
    
    // Trả về hóa đơn gần nhất với đầy đủ relations
    const latestInvoice = await this.salesInvoiceRepository.findOne({
      where: { 
        customer_id, 
        deleted_at: IsNull() 
      },
      relations: ['items', 'customer', 'season'], // Bao gồm cả các item, thông tin khách hàng và mùa vụ
      order: { sale_date: 'DESC', created_at: 'DESC' }, // Ưu tiên ngày bán gần nhất
    });
    
    this.logger.log('[findLatestByCustomer] Latest invoice with relations:', latestInvoice ? 'Found' : 'Not found');
    
    return latestInvoice;
  }

  /**
   * Cập nhật thông tin hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param updateSalesInvoiceDto - Dữ liệu cập nhật hóa đơn bán hàng
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async update(
    id: number,
    updateSalesInvoiceDto: UpdateSalesInvoiceDto,
    _userId?: number,
  ): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const currentInvoice = await this.findOne(id, queryRunner);
      if (!currentInvoice) {
        throw new BadRequestException('Hóa đơn không tồn tại');
      }

      const hasItemChanges = Array.isArray(updateSalesInvoiceDto.items);
      const financialFields = [
        'payment_method',
        'total_amount',
        'discount_amount',
        'final_amount',
        'partial_payment_amount',
      ];
      const hasFinancialChanges = financialFields.some(
        (field) => (updateSalesInvoiceDto as any)[field] !== undefined,
      );
      const requestedStatus = updateSalesInvoiceDto.status;

      if (
        requestedStatus &&
        requestedStatus !== currentInvoice.status
      ) {
        throw new BadRequestException(
          'Không được đổi trạng thái hóa đơn qua API cập nhật chung. Hãy dùng đúng chức năng xác nhận, thanh toán, hủy hoặc hoàn tiền.',
        );
      }

      if (
        currentInvoice.status !== SalesInvoiceStatus.DRAFT &&
        (hasItemChanges || hasFinancialChanges || requestedStatus !== undefined)
      ) {
        throw new BadRequestException(
          'Không được sửa sản phẩm, giá bán, phương thức thanh toán hoặc số tiền của hóa đơn đã xác nhận/đã thanh toán. Hãy hủy và tạo hóa đơn mới để đảm bảo kho, công nợ và lợi nhuận chính xác.',
        );
      }

      if (hasItemChanges) {
        throw new BadRequestException(
          'Chưa hỗ trợ sửa trực tiếp danh sách sản phẩm trong hóa đơn. Hãy hủy hóa đơn nháp và tạo lại.',
        );
      }

      const { items, delivery_log, ...invoiceUpdateData } =
        updateSalesInvoiceDto as any;

      if (hasFinancialChanges) {
        const computedTotalAmount = this.roundMoney(
          (currentInvoice.items || []).reduce((sum, item) => {
            return sum + Number(item.total_price || 0);
          }, 0),
        );
        const discountAmount = this.roundMoney(
          Number(
            updateSalesInvoiceDto.discount_amount ??
              currentInvoice.discount_amount ??
              0,
          ),
        );

        if (!Number.isFinite(discountAmount) || discountAmount < 0) {
          throw new BadRequestException('Giảm giá hóa đơn không hợp lệ');
        }
        if (discountAmount > computedTotalAmount) {
          throw new BadRequestException(
            'Giảm giá hóa đơn không được lớn hơn tổng tiền sản phẩm',
          );
        }

        const finalAmount = this.roundMoney(
          computedTotalAmount - discountAmount,
        );
        this.assertInvoiceAmountMatches(
          'Tổng tiền hóa đơn',
          updateSalesInvoiceDto.total_amount,
          computedTotalAmount,
        );
        this.assertInvoiceAmountMatches(
          'Thành tiền sau giảm giá',
          updateSalesInvoiceDto.final_amount,
          finalAmount,
        );

        const partialPayment = this.roundMoney(
          Number(
            updateSalesInvoiceDto.partial_payment_amount ??
              currentInvoice.partial_payment_amount ??
              0,
          ),
        );
        if (!Number.isFinite(partialPayment) || partialPayment < 0) {
          throw new BadRequestException('Số tiền đã thanh toán không hợp lệ');
        }
        if (partialPayment - finalAmount > 1) {
          throw new BadRequestException(
            'Số tiền đã thanh toán không được lớn hơn thành tiền hóa đơn',
          );
        }

        const cogs = Number(currentInvoice.cost_of_goods_sold || 0);
        const grossProfit = this.roundMoney(finalAmount - cogs);
        invoiceUpdateData.total_amount = computedTotalAmount;
        invoiceUpdateData.discount_amount = discountAmount;
        invoiceUpdateData.final_amount = finalAmount;
        invoiceUpdateData.partial_payment_amount = partialPayment;
        invoiceUpdateData.remaining_amount = this.roundMoney(
          finalAmount - partialPayment,
        );
        invoiceUpdateData.payment_status =
          invoiceUpdateData.remaining_amount <= 0
            ? SalesPaymentStatus.PAID
            : partialPayment > 0
              ? SalesPaymentStatus.PARTIAL
              : SalesPaymentStatus.PENDING;
        invoiceUpdateData.gross_profit = grossProfit;
        invoiceUpdateData.gross_profit_margin =
          finalAmount > 0
            ? Math.round((grossProfit / finalAmount) * 10000) / 100
            : 0;
      }

      await queryRunner.manager.update(SalesInvoice, id, invoiceUpdateData);
      const updatedInvoice = await this.findOne(id, queryRunner);
      
      await queryRunner.commitTransaction();
      return updatedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      ErrorHandler.handleUpdateError(error, 'hóa đơn bán hàng');
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cập nhật trạng thái hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param status - Trạng thái mới
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async updateStatus(
    _id: number,
    _status: SalesInvoiceStatus,
  ): Promise<SalesInvoice | null> {
    throw new BadRequestException(
      'Không được đổi trạng thái hóa đơn trực tiếp. Hãy dùng các luồng xác nhận, thanh toán, hủy hoặc hoàn tiền để hệ thống cập nhật kho, công nợ và lợi nhuận đúng.',
    );
  }

  /**
   * Xác nhận hóa đơn bán hàng (chuyển từ DRAFT sang CONFIRMED)
   * @param id - ID của hóa đơn bán hàng cần xác nhận
   * @returns Thông tin hóa đơn bán hàng đã xác nhận
   */
  async confirmInvoice(id: number, userId?: number): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, { where: { id } });
      if (!invoice) {
        return null;
      }

      if (
        invoice.status === SalesInvoiceStatus.CONFIRMED ||
        invoice.status === SalesInvoiceStatus.PAID
      ) {
        await queryRunner.commitTransaction();
        return invoice;
      }

      if (invoice.status !== SalesInvoiceStatus.DRAFT) {
        throw new BadRequestException(
          'Chỉ hóa đơn nháp mới được xác nhận. Hóa đơn đã hủy/hoàn tiền không được xác nhận lại.',
        );
      }

      const invoiceItems = await queryRunner.manager.find(SalesInvoiceItem, {
        where: { invoice_id: id },
      });
      await this.assertInvoiceProductMixingAllowed(
        invoiceItems.map((item) => ({ product_id: item.product_id })),
        queryRunner.manager,
      );

      invoice.status = SalesInvoiceStatus.CONFIRMED;
      invoice.updated_at = new Date();
      const savedInvoice = await queryRunner.manager.save(invoice);

      if (userId) {
        await this.postInvoiceFinancialEntries(
          queryRunner.manager,
          savedInvoice,
          userId,
        );
        await this.promotionCampaignService.processInvoiceAccrual(
          queryRunner.manager,
          savedInvoice.id,
        );
        await this.handleInventoryDeduction(savedInvoice.id, userId, queryRunner);
        await this.inventoryService.syncSupplierSettlementForPostedInvoice(
          savedInvoice.id,
          queryRunner,
        );
        await this.syncPostedInvoiceCostSnapshot(savedInvoice.id, queryRunner);
      }

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi xác nhận hóa đơn #${id}: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Đánh dấu hóa đơn bán hàng đã thanh toán
   * @param id - ID của hóa đơn bán hàng cần đánh dấu đã thanh toán
   * @returns Thông tin hóa đơn bán hàng đã thanh toán
   */
  async markAsPaid(id: number, userId?: number): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, { where: { id } });
      if (!invoice) {
        return null;
      }

      if (invoice.status === SalesInvoiceStatus.PAID) {
        await queryRunner.commitTransaction();
        return invoice;
      }

      if (invoice.status !== SalesInvoiceStatus.CONFIRMED) {
        throw new BadRequestException(
          'Chỉ hóa đơn đã xác nhận và còn nợ mới được đánh dấu đã thanh toán.',
        );
      }

      invoice.status = SalesInvoiceStatus.PAID;
      invoice.payment_status = SalesPaymentStatus.PAID;
      invoice.updated_at = new Date();
      
      const paymentAmountToProcess = Number(invoice.remaining_amount || 0);
      invoice.partial_payment_amount = Number(invoice.partial_payment_amount || 0) + paymentAmountToProcess;
      invoice.remaining_amount = 0;
      
      const savedInvoice = await queryRunner.manager.save(invoice);

      // 🔥 TRUY VẾT THANH TOÁN & TÍCH LŨY: Tạo phiếu thu khi hạch toán thanh toán thủ công
      if (paymentAmountToProcess > 0) {
          const debtNote = savedInvoice.customer_id && savedInvoice.season_id 
            ? await queryRunner.manager.findOne(DebtNote, {
                where: { customer_id: savedInvoice.customer_id as number, season_id: savedInvoice.season_id as any },
                relations: ['customer', 'season']
              })
            : null;

          const paymentCode = CodeGeneratorHelper.generateUniqueCode('PAY');
          const payment = queryRunner.manager.create(Payment, {
            code: paymentCode,
            customer_id: savedInvoice.customer_id || null, // Chuyển sang null
            amount: paymentAmountToProcess,
            allocated_amount: paymentAmountToProcess,
            payment_date: new Date(),
            payment_method: savedInvoice.payment_method || 'cash',
            notes: `Thanh toán hạch toán thủ công cho hóa đơn #${savedInvoice.code}`,
            created_by: userId || (savedInvoice.created_by as any),
            debt_note_code: debtNote?.code || null, // Chuyển sang null
          });
          const savedPayment = await queryRunner.manager.save(payment);

          await queryRunner.manager.save(PaymentAllocation, {
            payment_id: savedPayment.id,
            invoice_id: savedInvoice.id,
            ...(debtNote?.id && { debt_note_id: debtNote.id }),
            allocation_type: 'invoice',
            amount: paymentAmountToProcess,
          });

          // 🔥 Tích lũy điểm tích lũy cho nông dân
	          if (debtNote) {
              debtNote.paid_amount =
                Number(debtNote.paid_amount || 0) + paymentAmountToProcess;
              debtNote.remaining_amount = Math.max(
                0,
                Number(debtNote.remaining_amount || 0) -
                  paymentAmountToProcess,
              );
              if (debtNote.remaining_amount <= 0) {
                debtNote.status = DebtNoteStatus.PAID;
                debtNote.remaining_amount = 0;
              } else {
                debtNote.status = DebtNoteStatus.ACTIVE;
              }
              await queryRunner.manager.save(debtNote);

	            await this.customerRewardService.handleDebtNoteSettlement(
	              queryRunner.manager,
	              debtNote,
              {
                payment_amount: paymentAmountToProcess,
                gift_status: 'delivered', // Hạch toán thủ công thì mặc định là đã giao
                notes: `Tích lũy từ tất toán hóa đơn #${savedInvoice.code} (Hạch toán thủ công)`,
              },
              userId || (savedInvoice.created_by as any),
              false
            );
          }
      }

      if (userId) {
        await this.promotionCampaignService.processInvoiceAccrual(
          queryRunner.manager,
          savedInvoice.id,
        );
        await this.handleInventoryDeduction(savedInvoice.id, userId, queryRunner);
        await this.inventoryService.syncSupplierSettlementForPostedInvoice(
          savedInvoice.id,
          queryRunner,
        );
        await this.syncPostedInvoiceCostSnapshot(savedInvoice.id, queryRunner);
      }

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi đánh dấu đã thanh toán hóa đơn #${id}: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Hủy hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hủy
   * @returns Thông tin hóa đơn bán hàng đã hủy
   */
  async cancelInvoice(id: number, userId?: number): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, { where: { id } });
      if (!invoice) {
        return null;
      }

      if (invoice.status === SalesInvoiceStatus.CANCELLED) {
        await queryRunner.commitTransaction();
        return invoice;
      }

      if (
        invoice.status === SalesInvoiceStatus.PAID ||
        invoice.status === SalesInvoiceStatus.REFUNDED
      ) {
        throw new BadRequestException(
          'Hóa đơn đã thanh toán/đã hoàn tiền phải xử lý bằng luồng hoàn tiền, không dùng hủy hóa đơn.',
        );
      }

      const originalFinalAmount = Number(invoice.final_amount || 0);
      const originalPaidAmount = Number(invoice.partial_payment_amount || 0);

      invoice.status = SalesInvoiceStatus.CANCELLED;
      invoice.payment_status = SalesPaymentStatus.CANCELLED; // Đồng bộ trạng thái thanh toán
      invoice.final_amount = 0;
      invoice.partial_payment_amount = 0;
      invoice.remaining_amount = 0;
      invoice.cost_of_goods_sold = 0;
      invoice.gross_profit = 0;
      invoice.gross_profit_margin = 0;
      invoice.updated_at = new Date();
      const savedInvoice = await queryRunner.manager.save(invoice);

      await this.createRefundPaymentForInvoice(
        queryRunner.manager,
        savedInvoice,
        originalPaidAmount,
        userId,
        `Hoàn tiền do hủy hóa đơn #${savedInvoice.code}`,
      );

      if (userId) {
        await this.promotionCampaignService.processInvoiceReversal(
          queryRunner.manager,
          savedInvoice.id,
          'invoice_cancel',
          `Thu hoi tich luy do huy hoa don ${savedInvoice.code}`,
        );
        await this.handleInventoryRestoration(savedInvoice.id, userId, queryRunner);
      }

      // 🆕 Trừ nợ trong công nợ (loại bỏ hóa đơn khỏi tích lũy mùa vụ)
      if (savedInvoice.customer_id && savedInvoice.season_id) {
        // Tìm DebtNote để cập nhật tích lũy
        const debtNote = await queryRunner.manager.findOne(DebtNote, {
          where: { customer_id: savedInvoice.customer_id as number, season_id: savedInvoice.season_id as number },
          relations: ['customer', 'season']
        });

        if (debtNote) {
            await this.debtNoteService.removeInvoiceFromDebtNote(
              savedInvoice.id,
              originalFinalAmount,
              originalPaidAmount,
              queryRunner.manager,
            );

            const amountToRevoke = originalPaidAmount;
            if (amountToRevoke > 0) {
              await this.customerRewardService.handleDebtNoteSettlement(
                queryRunner.manager,
                debtNote,
                {
                  payment_amount: -amountToRevoke,
                  notes: `Thu hồi điểm do hủy hóa đơn #${savedInvoice.code}`,
                },
                userId || (savedInvoice.created_by as any),
                false
              );
            }
        }
      }

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hủy hóa đơn #${id}: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Hoàn tiền hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần hoàn tiền
   * @returns Thông tin hóa đơn bán hàng đã hoàn tiền
   */
  async refundInvoice(id: number, userId?: number): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, { where: { id } });
      if (!invoice) {
        return null;
      }

      if (invoice.status === SalesInvoiceStatus.REFUNDED) {
        await queryRunner.commitTransaction();
        return invoice;
      }

      if (invoice.status !== SalesInvoiceStatus.PAID) {
        throw new BadRequestException(
          'Chỉ hóa đơn đã thanh toán mới được hoàn tiền toàn bộ. Hóa đơn còn nợ hãy dùng hủy hóa đơn hoặc phiếu trả hàng.',
        );
      }

      const originalFinalAmount = Number(invoice.final_amount || 0);
      const originalPaidAmount = Number(invoice.partial_payment_amount || 0);

      invoice.status = SalesInvoiceStatus.REFUNDED;
      invoice.payment_status = SalesPaymentStatus.REFUNDED; // Đồng bộ trạng thái thanh toán
      invoice.final_amount = 0;
      invoice.partial_payment_amount = 0;
      invoice.remaining_amount = 0;
      invoice.cost_of_goods_sold = 0;
      invoice.gross_profit = 0;
      invoice.gross_profit_margin = 0;
      invoice.updated_at = new Date();
      const savedInvoice = await queryRunner.manager.save(invoice);

      await this.createRefundPaymentForInvoice(
        queryRunner.manager,
        savedInvoice,
        originalPaidAmount,
        userId,
        `Hoàn tiền toàn bộ hóa đơn #${savedInvoice.code}`,
      );

      if (userId) {
        await this.promotionCampaignService.processInvoiceReversal(
          queryRunner.manager,
          savedInvoice.id,
          'invoice_refund',
          `Thu hoi tich luy do hoan hoa don ${savedInvoice.code}`,
        );
        await this.handleInventoryRestoration(savedInvoice.id, userId, queryRunner);
      }

      // 🆕 Trừ nợ trong công nợ (loại bỏ hóa đơn khỏi tích lũy mùa vụ)
      if (savedInvoice.customer_id && savedInvoice.season_id) {
         // Tìm DebtNote để cập nhật tích lũy
         const debtNote = await queryRunner.manager.findOne(DebtNote, {
          where: { customer_id: savedInvoice.customer_id as number, season_id: savedInvoice.season_id as number },
          relations: ['customer', 'season']
        });

        if (debtNote) {
            await this.debtNoteService.removeInvoiceFromDebtNote(
              savedInvoice.id,
              originalFinalAmount,
              originalPaidAmount,
              queryRunner.manager,
            );

            const amountToRevoke = originalPaidAmount;
            if (amountToRevoke > 0) {
              await this.customerRewardService.handleDebtNoteSettlement(
                queryRunner.manager,
                debtNote,
                {
                  payment_amount: -amountToRevoke,
                  notes: `Thu hồi điểm do hoàn tiền hóa đơn #${savedInvoice.code}`,
                },
                userId || (savedInvoice.created_by as any),
                false
              );
            }
        }
      }

      await queryRunner.commitTransaction();
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hoàn tiền hóa đơn #${id}: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Xóa mềm hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần xóa mềm
   * @returns Thông tin hóa đơn bán hàng đã xóa mềm
   */
  async softDelete(id: number): Promise<SalesInvoice | null> {
    const invoice = await this.findOne(id);
    if (!invoice) {
      return null;
    }

    await this.salesInvoiceRepository.softDelete(id);

    return this.salesInvoiceRepository.findOne({
      where: { id },
      withDeleted: true,
      relations: ['items'],
    });
  }

  /**
   * Khôi phục hóa đơn bán hàng đã xóa mềm
   * @param id - ID của hóa đơn bán hàng cần khôi phục
   * @returns Thông tin hóa đơn bán hàng đã khôi phục
   */
  async restore(id: number): Promise<SalesInvoice | null> {
    const invoice = await this.salesInvoiceRepository.findOne({
      where: { id, deleted_at: Not(IsNull()) },
      withDeleted: true,
    });

    if (!invoice) {
      return null;
    }

    await this.salesInvoiceRepository.restore(id);

    return this.findOne(id);
  }

  /**
   * Xóa hóa đơn bán hàng theo ID (xóa cứng)
   * @param id - ID của hóa đơn bán hàng cần xóa
   */
  async remove(id: number): Promise<void> {
    const invoice = await this.salesInvoiceRepository.findOne({ where: { id } });
    if (!invoice) return;

    // CHỈ cho phép xóa nếu là bản nháp (DRAFT)
    if (invoice.status !== SalesInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Không thể xóa hóa đơn đã ${invoice.status === SalesInvoiceStatus.PAID ? 'thanh toán' : 'xác nhận'}. Hãy dùng chức năng Hủy hoặc Hoàn tiền để đảm bảo tồn kho và công nợ.`
      );
    }
    
    await this.salesInvoiceRepository.delete(id);
  }

  /**
   * Cập nhật trạng thái thanh toán của hóa đơn bán hàng
   * @param id - ID của hóa đơn bán hàng cần cập nhật
   * @param payment_status - Trạng thái thanh toán mới
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async updatePaymentStatus(
    _id: number,
    _payment_status: SalesPaymentStatus,
  ): Promise<SalesInvoice | null> {
    throw new BadRequestException(
      'Không được đổi trạng thái thanh toán trực tiếp. Hãy dùng chức năng thanh toán thêm, hủy hoặc hoàn tiền để hệ thống tạo phiếu thu và cập nhật công nợ đúng.',
    );
  }

  /**
   * Thanh toán thêm cho hóa đơn (bán thiếu)
   * @param id - ID của hóa đơn bán hàng
   * @param amount - Số tiền thanh toán thêm
   * @returns Thông tin hóa đơn bán hàng đã cập nhật
   */
  async addPartialPayment(
    id: number,
    amount: number,
    userId?: number,
  ): Promise<SalesInvoice | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(SalesInvoice, {
        where: { id },
        relations: ['customer', 'season'],
      });

      if (!invoice) {
        throw new Error('Hóa đơn không tồn tại');
      }

      if (invoice.status !== SalesInvoiceStatus.CONFIRMED) {
        throw new BadRequestException(
          'Chỉ hóa đơn đã xác nhận và còn nợ mới được thanh toán thêm.',
        );
      }

      const amountNumber = this.roundMoney(Number(amount));
      if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
        throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
      }

      // 1. Cập nhật số tiền trên hóa đơn
      const currentPartialPayment = parseFloat(invoice.partial_payment_amount?.toString() || '0');
      const finalAmount = parseFloat(invoice.final_amount?.toString() || '0');
      const currentRemainingAmount = parseFloat(invoice.remaining_amount?.toString() || '0');

      if (currentRemainingAmount <= 0) {
        throw new BadRequestException('Hóa đơn này không còn số tiền nợ để thanh toán thêm');
      }

      if (amountNumber - currentRemainingAmount > 1) {
        throw new BadRequestException(
          `Số tiền thanh toán không được lớn hơn số tiền còn nợ (${currentRemainingAmount.toLocaleString()}đ)`,
        );
      }

      const newPartialPayment = this.roundMoney(currentPartialPayment + amountNumber);
      const newRemainingAmount = this.roundMoney(finalAmount - newPartialPayment);

      if (newRemainingAmount <= 0) {
        invoice.status = SalesInvoiceStatus.PAID;
        invoice.payment_status = SalesPaymentStatus.PAID;
        invoice.partial_payment_amount = finalAmount;
        invoice.remaining_amount = 0;
      } else {
        invoice.partial_payment_amount = newPartialPayment;
        invoice.remaining_amount = newRemainingAmount;
        invoice.payment_status = SalesPaymentStatus.PARTIAL;
      }

      const savedInvoice = await queryRunner.manager.save(invoice);

      // 2. Tạo phiếu thu (Payment)
        const paymentCode = CodeGeneratorHelper.generateUniqueCode('PAY');
        const paymentData: any = {
          code: paymentCode,
          customer_id: invoice.customer_id || null,
          amount: amountNumber,
          allocated_amount: amountNumber,
          payment_date: new Date(),
          payment_method: invoice.payment_method || 'cash',
          notes: `Thanh toán cho hóa đơn #${invoice.code}`,
          created_by: userId,
        };
        const payment = queryRunner.manager.create(Payment, paymentData);
        const savedPayment = await queryRunner.manager.save(payment);

        // 3. Tạo phân bổ thanh toán (PaymentAllocation)
        let debtNoteId: number | undefined;
        if (invoice.customer_id && invoice.season_id) {
          const debtNote = await queryRunner.manager.findOne(DebtNote, {
            where: { customer_id: invoice.customer_id, season_id: invoice.season_id }
          });
          debtNoteId = debtNote?.id;
        }

        const allocation = queryRunner.manager.create(PaymentAllocation, {
          payment_id: savedPayment.id,
          invoice_id: invoice.id,
          ...(debtNoteId && { debt_note_id: debtNoteId }),
          allocation_type: 'invoice',
          amount: amountNumber,
        });
        await queryRunner.manager.save(allocation);

        // 4. Cập nhật phiếu công nợ (DebtNote) nếu có
        if (invoice.customer_id && invoice.season_id) {
          const debtNote = await queryRunner.manager.findOne(DebtNote, {
            where: {
              customer_id: invoice.customer_id,
              season_id: invoice.season_id,
            },
          });

          if (debtNote) {
            const currentPaid = parseFloat(debtNote.paid_amount?.toString() || '0');
            const currentRemaining = parseFloat(debtNote.remaining_amount?.toString() || '0');
            debtNote.paid_amount = currentPaid + amountNumber;
            debtNote.remaining_amount = currentRemaining - amountNumber;

            if (debtNote.remaining_amount <= 0) {
              debtNote.status = DebtNoteStatus.PAID;
              debtNote.remaining_amount = 0;
            }

            await queryRunner.manager.save(debtNote);
            this.logger.log(`✅ Đã cập nhật phiếu nợ #${debtNote.code}: -${amountNumber.toLocaleString()} đ`);

            // Liên kết phiếu thu với mã phiếu nợ
            savedPayment.debt_note_code = debtNote.code;
            await queryRunner.manager.save(savedPayment);

            // 🔥 TÍCH LUỸ ĐIỂM THƯỞNG KHI TRẢ NỢ HÓA ĐƠN
            await this.customerRewardService.handleDebtNoteSettlement(
              queryRunner.manager,
              debtNote,
              {
                payment_amount: amountNumber,
                gift_status: 'delivered', // Trả tiền mặt thì quà/tích lũy mặc định là đã trao
                notes: `Thanh toán cho hóa đơn #${invoice.code}`,
              },
              userId || (invoice.created_by as any),
              false
            );
          }
        }

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Thanh toán thành công cho hóa đơn #${invoice.code}: ${amountNumber.toLocaleString()} đ`);
      
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi thanh toán hóa đơn: ${(error as any).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lấy danh sách các item trong hóa đơn bán hàng
   * @param invoice_id - ID của hóa đơn bán hàng
   * @returns Danh sách các item trong hóa đơn bán hàng
   */
  async getInvoiceItems(invoice_id: number): Promise<SalesInvoiceItem[]> {
    return this.salesInvoiceItemRepository.find({
      where: { invoice_id },
      order: { id: 'ASC' },
    });
  }

  /**
   * Cập nhật thông tin chi tiết hóa đơn bán hàng
   * @param id - ID của chi tiết hóa đơn bán hàng cần cập nhật
   * @param updateData - Dữ liệu cập nhật chi tiết hóa đơn bán hàng
   * @returns Thông tin chi tiết hóa đơn bán hàng đã cập nhật
   */
  async updateInvoiceItem(
    _id: number,
    _updateData: Partial<SalesInvoiceItem>,
  ): Promise<SalesInvoiceItem | null> {
    throw new BadRequestException(
      'Không được sửa trực tiếp dòng hóa đơn vì sẽ làm lệch tổng tiền, kho và lợi nhuận. Hãy dùng luồng cập nhật hóa đơn được kiểm soát.',
    );
  }

  /**
   * Xóa chi tiết hóa đơn bán hàng theo ID
   * @param id - ID của chi tiết hóa đơn bán hàng cần xóa
   */
  async removeInvoiceItem(_id: number): Promise<void> {
    throw new BadRequestException(
      'Không được xóa trực tiếp dòng hóa đơn vì sẽ làm lệch tổng tiền, kho và lợi nhuận. Hãy hủy hóa đơn hoặc dùng phiếu trả hàng.',
    );
  }

  /**
   * Tìm kiếm nâng cao hóa đơn bán hàng
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách hóa đơn bán hàng phù hợp với thông tin phân trang
   */
  async searchSalesInvoices(searchDto: SearchSalesDto): Promise<{
    data: SalesInvoice[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.log(`[searchSalesInvoices] Params: ${JSON.stringify(searchDto)}`);

    const queryBuilder =
      this.salesInvoiceRepository.createQueryBuilder('invoice');

    // Join các bảng liên quan để lấy tên hiển thị
    queryBuilder
      .leftJoin('invoice.season', 'season')
      .leftJoin('invoice.rice_crop', 'rice_crop')
      .leftJoin('invoice.customer', 'customer') // Thêm join customer
      .leftJoin('invoice.creator', 'creator')
      .addSelect(['season.id', 'season.name', 'season.code'])
      .addSelect(['rice_crop.id', 'rice_crop.field_name'])
      .addSelect(['customer.id', 'customer.name', 'customer.code', 'customer.phone']) // Select customer info
      .addSelect(['creator.id', 'creator.account']);

    // Thêm điều kiện mặc định
    queryBuilder.where('invoice.deleted_at IS NULL');

    // 1. Base Search & Pagination
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'invoice',
      ['code', 'invoice.customer_name', 'invoice.customer_phone', 'notes'] // Global search fields
    );

    // Mặc định sắp xếp theo sale_date giảm dần nếu không có sort tùy chỉnh
    if (!searchDto.sort && !searchDto.sort_by) {
      queryBuilder.orderBy('invoice.sale_date', 'DESC')
                  .addOrderBy('invoice.created_at', 'DESC');
    }

    // 2. Lọc theo ngày bán (Sale Date Range)
    if (searchDto.sale_date_start) {
      queryBuilder.andWhere('invoice.sale_date >= :saleStartDate', {
        saleStartDate: searchDto.sale_date_start,
      });
    }
    if (searchDto.sale_date_end) {
      queryBuilder.andWhere('invoice.sale_date <= :saleEndDate', {
        saleEndDate: searchDto.sale_date_end,
      });
    }

    // 2.1 Special handling for rice_crop_id (has_crop/no_crop/id)
    if (searchDto.rice_crop_id) {
       if (searchDto.rice_crop_id === 'has_crop' as any) {
         queryBuilder.andWhere('invoice.rice_crop_id IS NOT NULL');
         delete searchDto.rice_crop_id;
       } else if (searchDto.rice_crop_id === 'no_crop' as any) {
         queryBuilder.andWhere('invoice.rice_crop_id IS NULL');
         delete searchDto.rice_crop_id;
       }
    }

    // 3. Simple Filters (code, customer_id, season_id, payment_status...)
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'invoice',
      ['filters', 'nested_filters', 'operator', 'sale_date_start', 'sale_date_end', 'start_date', 'end_date'], // Ignore complex fields
      {
        customer_name: 'invoice.customer_name',
        customer_phone: 'invoice.customer_phone',
        season_name: 'season.name',
        rice_crop_name: 'rice_crop.field_name',
      }
    );

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
   * Sinh mã hóa đơn tự động dựa trên thời gian hiện tại
   * Định dạng: HD{YYYYMMDD}{HHMMSS}{RANDOM}
   * Ví dụ: HD20231127103045123
   */

  /**
   * Tạo phiếu giao hàng cho hóa đơn
   * @param deliveryData - Dữ liệu phiếu giao hàng từ DTO
   * @param invoiceId - ID hóa đơn
   * @param savedItems - Danh sách items đã lưu trong hóa đơn
   * @param userId - ID người tạo
   * @param manager - Transaction manager
   */
  private async createDeliveryLog(
    deliveryData: any,
    invoiceId: number,
    savedItems: SalesInvoiceItem[],
    userId: number,
    manager: any,
  ): Promise<DeliveryLog> {
    try {
      // Tính tổng chi phí nếu không có
      const totalCost = deliveryData.total_cost || 
        (Number(deliveryData.fuel_cost || 0) + 
         Number(deliveryData.driver_cost || 0) + 
         Number(deliveryData.other_costs || 0));

      // Tạo delivery log
      const deliveryLog = manager.create(DeliveryLog, {
        invoice_id: invoiceId,
        delivery_date: deliveryData.delivery_date,
        delivery_start_time: deliveryData.delivery_start_time,
        distance_km: deliveryData.distance_km,
        fuel_cost: deliveryData.fuel_cost || 0,
        driver_cost: deliveryData.driver_cost || 0,
        other_costs: deliveryData.other_costs || 0,
        total_cost: totalCost,
        driver_name: deliveryData.driver_name,
        vehicle_plate: deliveryData.vehicle_plate,
        delivery_address: deliveryData.delivery_address,
        receiver_name: deliveryData.receiver_name, // Thêm tên người nhận
        receiver_phone: deliveryData.receiver_phone, // Thêm SĐT người nhận
        delivery_notes: deliveryData.delivery_notes, // Thêm ghi chú giao hàng
        status: deliveryData.status || DeliveryStatus.PENDING,
        notes: deliveryData.notes,
        created_by: userId,
      });

      const savedDeliveryLog = await manager.save(deliveryLog);
      this.logger.log(`✅ Đã tạo phiếu giao hàng #${savedDeliveryLog.id} cho hóa đơn #${invoiceId}`);

      // Tạo delivery log items nếu có danh sách sản phẩm cần giao
      if (deliveryData.items && Array.isArray(deliveryData.items) && deliveryData.items.length > 0) {
        const deliveryItems = await Promise.all(
          deliveryData.items.map(async (item: any) => {
            // Frontend gửi sales_invoice_item_id là INDEX (0, 1, 2...)
            // Cần map sang item thực tế trong savedItems
            const itemIndex = item.sales_invoice_item_id;
            const invoiceItem = savedItems[itemIndex];

            if (!invoiceItem) {
              this.logger.warn(`⚠️ Không tìm thấy item tại index ${itemIndex} trong hóa đơn`);
              return null;
            }

            // Lấy thông tin sản phẩm
            const product = await manager.findOne(Product, {
              where: { id: invoiceItem.product_id },
            });

            return manager.create(DeliveryLogItem, {
              delivery_log_id: savedDeliveryLog.id,
              sales_invoice_item_id: invoiceItem.id, // Dùng ID thực tế của item đã lưu
              product_id: invoiceItem.product_id,
              product_name: invoiceItem.product_name || product?.name || 'Unknown',
              quantity_delivered: item.quantity,
              unit: product?.unit,
              notes: item.notes,
            });
          })
        );

        // Lọc bỏ null và lưu
        const validItems = deliveryItems.filter((item) => item !== null);
        if (validItems.length > 0) {
          await manager.save(validItems);
          this.logger.log(`✅ Đã tạo ${validItems.length} sản phẩm trong phiếu giao hàng`);
        }
      }

      return savedDeliveryLog;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Lỗi khi tạo phiếu giao hàng: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Tạo phiếu giao hàng standalone (không kèm tạo hóa đơn)
   * @param createDeliveryLogDto - Dữ liệu tạo phiếu giao hàng
   * @param userId - ID người tạo
   * @returns Phiếu giao hàng đã tạo
   */
  async createStandaloneDeliveryLog(
    createDeliveryLogDto: CreateDeliveryLogDto,
    userId: number,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tạo object delivery log
      const deliveryLogData: any = {
        delivery_date: createDeliveryLogDto.delivery_date,
        total_cost: createDeliveryLogDto.total_cost || 0,
        status: createDeliveryLogDto.status || DeliveryStatus.PENDING,
        created_by: userId,
        season_id: createDeliveryLogDto.season_id,
        // Bổ sung các trường chi phí
        distance_km: createDeliveryLogDto.distance_km,
        fuel_cost: createDeliveryLogDto.fuel_cost || 0,
        driver_cost: createDeliveryLogDto.driver_cost || 0,
        other_costs: createDeliveryLogDto.other_costs || 0,
      };

      // Thêm các fields optional
      if (createDeliveryLogDto.invoice_id) {
        deliveryLogData.invoice_id = createDeliveryLogDto.invoice_id;
      }
      if (createDeliveryLogDto.delivery_start_time) {
        deliveryLogData.delivery_start_time = createDeliveryLogDto.delivery_start_time;
      }
      if (createDeliveryLogDto.delivery_address) {
        deliveryLogData.delivery_address = createDeliveryLogDto.delivery_address;
      }
      if (createDeliveryLogDto.receiver_name) {
        deliveryLogData.receiver_name = createDeliveryLogDto.receiver_name;
      }
      if (createDeliveryLogDto.receiver_phone) {
        deliveryLogData.receiver_phone = createDeliveryLogDto.receiver_phone;
      }
      if (createDeliveryLogDto.delivery_notes) {
        deliveryLogData.delivery_notes = createDeliveryLogDto.delivery_notes;
      }
      if (createDeliveryLogDto.driver_name) {
        deliveryLogData.driver_name = createDeliveryLogDto.driver_name;
      }
      if (createDeliveryLogDto.vehicle_number) {
        deliveryLogData.vehicle_number = createDeliveryLogDto.vehicle_number;
        deliveryLogData.vehicle_plate = createDeliveryLogDto.vehicle_number; // Map cả hai để tương thích
      }

      const deliveryLog = this.deliveryLogRepository.create(deliveryLogData);
      const savedDeliveryLog: any = await queryRunner.manager.save(deliveryLog);

      // Đặt lịch thông báo cho phiếu giao hàng
      if (savedDeliveryLog.status === DeliveryStatus.PENDING) {
        this.deliveryNotificationService.scheduleNotification(savedDeliveryLog);
      }

      // Tạo delivery items nếu có
      if (createDeliveryLogDto.items && createDeliveryLogDto.items.length > 0) {
        const deliveryItems = await Promise.all(
          createDeliveryLogDto.items.map(async (item) => {
            const itemData: any = {
              delivery_log_id: savedDeliveryLog.id,
              quantity_delivered: item.quantity,
            };
            
            if (item.sales_invoice_item_id) {
              itemData.sales_invoice_item_id = item.sales_invoice_item_id;
            }
            if (item.product_id) {
              itemData.product_id = item.product_id;
              
              // Lấy tên sản phẩm nếu thiếu (để tránh lỗi NOT NULL)
              if (!item.product_name) {
                const product = await queryRunner.manager.findOne(Product, {
                  where: { id: item.product_id },
                });
                itemData.product_name = product?.trade_name || product?.name || 'Unknown';
              } else {
                itemData.product_name = item.product_name;
              }
            }
            if (item.unit) {
              itemData.unit = item.unit;
            }
            if (item.notes) {
              itemData.notes = item.notes;
            }
            
            return this.deliveryLogItemRepository.create(itemData);
          })
        );

        await queryRunner.manager.save(deliveryItems);
      }

      await queryRunner.commitTransaction();

      // Load lại với relations
      return this.deliveryLogRepository.findOne({
        where: { id: savedDeliveryLog.id },
        relations: ['invoice', 'items', 'items.product'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Lỗi khi tạo phiếu giao hàng standalone: ${errorMessage}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lấy danh sách phiếu giao hàng với phân trang và filter
   */
  async findAllDeliveryLogs(params: {
    page: number;
    limit: number;
    invoiceId?: number;
    invoice_id?: number;
    status?: string;
  }) {
    const { page, limit, status } = params;
    const invoiceId = params.invoiceId || params.invoice_id;
    const skip = (page - 1) * limit;

    const queryBuilder = this.deliveryLogRepository
      .createQueryBuilder('delivery_log')
      .leftJoinAndSelect('delivery_log.invoice', 'invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('delivery_log.season', 'season')
      .leftJoinAndSelect('delivery_log.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('delivery_log.created_at', 'DESC');

    // Filter theo invoice
    if (invoiceId) {
      queryBuilder.andWhere('delivery_log.invoice_id = :invoiceId', { invoiceId });
    }

    // Filter theo status
    if (status) {
      queryBuilder.andWhere('delivery_log.status = :status', { status });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy chi tiết phiếu giao hàng theo ID
   */
  async findOneDeliveryLog(id: number) {
    const deliveryLog = await this.deliveryLogRepository.findOne({
      where: { id },
      relations: [
        'invoice',
        'invoice.customer',
        'season',
        'items',
        'items.product',
        'items.sales_invoice_item',
      ],
    });

    if (!deliveryLog) {
      throw new Error(`Không tìm thấy phiếu giao hàng với ID ${id}`);
    }

    return deliveryLog;
  }

  /**
   * Cập nhật phiếu giao hàng
   */
  async updateDeliveryLog(
    id: number,
    updateData: Partial<CreateDeliveryLogDto>,
  ) {
    const deliveryLog = await this.findOneDeliveryLog(id);

    // Cập nhật thông tin cơ bản
    Object.assign(deliveryLog, {
      delivery_date: updateData.delivery_date || deliveryLog.delivery_date,
      delivery_start_time: updateData.delivery_start_time || deliveryLog.delivery_start_time,
      delivery_address: updateData.delivery_address || deliveryLog.delivery_address,
      receiver_name: updateData.receiver_name || deliveryLog.receiver_name,
      receiver_phone: updateData.receiver_phone || deliveryLog.receiver_phone,
      delivery_notes: updateData.delivery_notes || deliveryLog.delivery_notes,
      driver_name: updateData.driver_name || deliveryLog.driver_name,
      vehicle_number: updateData.vehicle_number || deliveryLog.vehicle_number,
      vehicle_plate: updateData.vehicle_number || deliveryLog.vehicle_number || deliveryLog.vehicle_plate,
      total_cost: updateData.total_cost !== undefined ? updateData.total_cost : deliveryLog.total_cost,
      distance_km: updateData.distance_km !== undefined ? updateData.distance_km : deliveryLog.distance_km,
      fuel_cost: updateData.fuel_cost !== undefined ? updateData.fuel_cost : deliveryLog.fuel_cost,
      driver_cost: updateData.driver_cost !== undefined ? updateData.driver_cost : deliveryLog.driver_cost,
      other_costs: updateData.other_costs !== undefined ? updateData.other_costs : deliveryLog.other_costs,
      status: updateData.status || deliveryLog.status,
      season_id: updateData.season_id !== undefined ? updateData.season_id : deliveryLog.season_id,
    });

    await this.deliveryLogRepository.save(deliveryLog);

    // Cập nhật lịch thông báo
    await this.deliveryNotificationService.onDeliveryLogUpdated(deliveryLog);

    // Cập nhật items nếu có
    if (updateData.items) {
      // Xóa items cũ
      await this.deliveryLogItemRepository.delete({ delivery_log_id: id });

      // Tạo items mới
      const newItems = await Promise.all(
        updateData.items.map(async (item) => {
          const itemData: any = {
            delivery_log_id: id,
            quantity_delivered: item.quantity,
          };
          
          if (item.sales_invoice_item_id) {
            itemData.sales_invoice_item_id = item.sales_invoice_item_id;
          }
          if (item.product_id) {
            itemData.product_id = item.product_id;
            
            // Lấy tên sản phẩm nếu thiếu
            if (!item.product_name) {
              const product = await this.dataSource.manager.findOne(Product, {
                where: { id: item.product_id },
              });
              itemData.product_name = product?.trade_name || product?.name || 'Unknown';
            } else {
              itemData.product_name = item.product_name;
            }
          }
          if (item.unit) {
            itemData.unit = item.unit;
          }
          if (item.notes) {
            itemData.notes = item.notes;
          }
          
          return this.deliveryLogItemRepository.create(itemData);
        })
      );

      await this.deliveryLogItemRepository.save(newItems as any);
    }

    return this.findOneDeliveryLog(id);
  }

  /**
   * Xóa phiếu giao hàng
   */
  async removeDeliveryLog(id: number) {
    const deliveryLog = await this.findOneDeliveryLog(id);

    // Hủy lịch thông báo
    await this.deliveryNotificationService.onDeliveryLogDeleted(id);

    // Xóa items trước
    await this.deliveryLogItemRepository.delete({ delivery_log_id: id });

    // Xóa delivery log
    await this.deliveryLogRepository.remove(deliveryLog);

    return { message: 'Đã xóa phiếu giao hàng thành công' };
  }

  /**
   * Cập nhật trạng thái phiếu giao hàng
   */
  async updateDeliveryStatus(id: number, status: string) {
    const deliveryLog = await this.findOneDeliveryLog(id);
    deliveryLog.status = status as DeliveryStatus;
    await this.deliveryLogRepository.save(deliveryLog);
    
    // Cập nhật lịch thông báo
    await this.deliveryNotificationService.onDeliveryLogUpdated(deliveryLog);
    
    return deliveryLog;
  }

  /**
   * Lấy lịch sử mua hàng của một khách hàng theo mùa vụ (Tổng hợp tất cả items)
   */
  async getCustomerPurchaseHistory(customerId: number, seasonId?: number) {
    const queryBuilder = this.salesInvoiceItemRepository.createQueryBuilder('item')
      .innerJoinAndSelect('item.invoice', 'invoice')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('invoice.customer_id = :customerId', { customerId })
      .andWhere('invoice.deleted_at IS NULL')
      .andWhere('invoice.status NOT IN (:...excludedStatuses)', { 
        excludedStatuses: [
          SalesInvoiceStatus.CANCELLED, 
          SalesInvoiceStatus.REFUNDED,
          SalesInvoiceStatus.DRAFT
        ] 
      });

    if (seasonId) {
      queryBuilder.andWhere('invoice.season_id = :seasonId', { seasonId });
    }

    queryBuilder.orderBy('invoice.sale_date', 'ASC')
                .addOrderBy('invoice.created_at', 'ASC');

    const items = await queryBuilder.getMany();
    if (!items.length) {
      return [];
    }

    const invoiceIds = Array.from(
      new Set(items.map((item) => Number(item.invoice_id)).filter(Boolean)),
    );

    const approvedReturns = await this.dataSource.manager
      .createQueryBuilder()
      .select('sr.invoice_id', 'invoice_id')
      .addSelect('sri.sales_invoice_item_id', 'sales_invoice_item_id')
      .addSelect('sri.product_id', 'product_id')
      .addSelect('COALESCE(SUM(sri.quantity), 0)', 'returned_quantity')
      .addSelect('COALESCE(SUM(sri.total_price), 0)', 'returned_total')
      .from('sales_return_items', 'sri')
      .innerJoin('sales_returns', 'sr', 'sr.id = sri.sales_return_id')
      .where('sr.status = :approvedStatus', { approvedStatus: 'approved' })
      .andWhere('sr.invoice_id IN (:...invoiceIds)', { invoiceIds })
      .groupBy('sr.invoice_id')
      .addGroupBy('sri.sales_invoice_item_id')
      .addGroupBy('sri.product_id')
      .getRawMany();

    const returnByItemId = new Map<number, { qty: number; total: number }>();
    const returnByLegacyProductKey = new Map<string, { qty: number; total: number }>();

    for (const row of approvedReturns) {
      const invoiceId = Number(row.invoice_id);
      const invoiceItemId = row.sales_invoice_item_id
        ? Number(row.sales_invoice_item_id)
        : 0;
      const productId = Number(row.product_id);
      const returnedQty = Number(row.returned_quantity || 0);
      const returnedTotal = Number(row.returned_total || 0);

      if (invoiceItemId > 0) {
        const current = returnByItemId.get(invoiceItemId) || { qty: 0, total: 0 };
        returnByItemId.set(invoiceItemId, {
          qty: current.qty + returnedQty,
          total: current.total + returnedTotal,
        });
      } else {
        const legacyKey = `${invoiceId}:${productId}`;
        const current = returnByLegacyProductKey.get(legacyKey) || {
          qty: 0,
          total: 0,
        };
        returnByLegacyProductKey.set(legacyKey, {
          qty: current.qty + returnedQty,
          total: current.total + returnedTotal,
        });
      }
    }

    const legacyReturnRemaining = new Map(returnByLegacyProductKey);

    // Chuẩn hóa dữ liệu trả về giống mẫu Excel
    return items.map(item => {
      const itemReturn = returnByItemId.get(Number(item.id));
      const legacyKey = `${Number(item.invoice_id)}:${Number(item.product_id)}`;
      const legacyReturn = legacyReturnRemaining.get(legacyKey);
      const itemReturnedQty = Number(itemReturn?.qty || 0);
      const itemReturnedTotal = Number(itemReturn?.total || 0);
      let legacyReturnedQty = 0;
      let legacyReturnedTotal = 0;

      if (legacyReturn && legacyReturn.qty > 0) {
        const remainingLineQty = Math.max(0, Number(item.quantity || 0) - itemReturnedQty);
        legacyReturnedQty = Math.min(legacyReturn.qty, remainingLineQty);
        legacyReturnedTotal =
          legacyReturn.qty > 0
            ? (legacyReturn.total * legacyReturnedQty) / legacyReturn.qty
            : 0;

        const nextQty = Math.max(0, legacyReturn.qty - legacyReturnedQty);
        const nextTotal = Math.max(0, legacyReturn.total - legacyReturnedTotal);
        if (nextQty > 0) {
          legacyReturnRemaining.set(legacyKey, {
            qty: nextQty,
            total: nextTotal,
          });
        } else {
          legacyReturnRemaining.delete(legacyKey);
        }
      }

      const returnedQuantity = itemReturnedQty + legacyReturnedQty;
      const returnedTotalPrice = itemReturnedTotal + legacyReturnedTotal;
      const quantity = Math.max(0, Number(item.quantity || 0) - returnedQuantity);
      const totalPrice = Math.max(0, Number(item.total_price || 0) - returnedTotalPrice);

      return {
        date: item.invoice.sale_date || item.invoice.created_at,
        product_name: item.product_name || item.product?.trade_name || item.product?.name || 'Sản phẩm không tên',
        unit: item.unit_name || item.product?.unit?.name || 'Cái',
        quantity,
        unit_price: Number(item.unit_price || 0),
        total_price: totalPrice,
        invoice_code: item.invoice.code,
        invoice_id: item.invoice.id,
      };
    });
  }
  /**
   * Xử lý trừ tồn kho cho hóa đơn
   * @param invoiceId - ID hóa đơn
   * @param userId - ID người thực hiện
   * @param queryRunner - Đối tượng QueryRunner để xử lý transaction
   */
  async handleInventoryDeduction(invoiceId: number, userId: number, queryRunner?: QueryRunner): Promise<void> {
    try {
      const repo = queryRunner ? queryRunner.manager.getRepository(InventoryTransaction) : this.dataSource.getRepository(InventoryTransaction);
      
      // 1. Kiểm tra xem hóa đơn đã được trừ tồn kho chưa
      const existingTransaction = await repo.findOne({
        where: {
          reference_type: 'SALE',
          reference_id: invoiceId,
        },
      });

      if (existingTransaction) {
        this.logger.log(`ℹ️ Hóa đơn #${invoiceId} đã được trừ tồn kho trước đó, bỏ qua.`);
        return;
      }

      // 2. Lấy thông tin hóa đơn và các item
      const invoice = await this.findOne(invoiceId, queryRunner);
      if (!invoice || !invoice.items || invoice.items.length === 0) {
        this.logger.warn(`⚠️ Hóa đơn #${invoiceId} không tồn tại hoặc không có sản phẩm để trừ kho.`);
        return;
      }

      this.logger.log(`🚀 Bắt đầu trừ tồn kho cho hóa đơn #${invoice.code} (${invoiceId})`);

      // 3. Trừ tồn kho cho từng sản phẩm theo phương pháp FIFO
      for (const item of invoice.items) {
        try {
          const manager = queryRunner ? queryRunner.manager : this.salesInvoiceItemRepository.manager;
          // Lưu ý: userId có thể truyền từ JWT, nếu không có lấy người tạo hóa đơn
          const performerId = userId || invoice.created_by;
          
          // ✅ Tính số lượng thực tế xuất kho theo đơn vị cơ sở (base_quantity)
          // Nếu có base_quantity (người dùng bán BAO → quy đổi ra KG) thì dùng base_quantity
          // Nếu không có (dữ liệu cũ hoặc không quy đổi) thì dùng quantity như cũ (tương thích ngược)
          const stockOutQuantity = item.base_quantity
            ? Number(item.base_quantity)
            : item.quantity;
          
          const result = await this.inventoryService.processStockOut(
            item.product_id,
            stockOutQuantity, // ← dùng số lượng đã quy đổi về đơn vị cơ sở
            'SALE',
            performerId,
            invoice.id,
            `Bán hàng theo hóa đơn #${invoice.code}`,
            queryRunner
	          );

          await manager.delete(SalesInvoiceItemStockAllocation, {
            sales_invoice_item_id: item.id,
          });

          for (const affectedBatch of result.affectedBatches || []) {
            const batch = await manager.findOne(InventoryBatch, {
              where: { id: affectedBatch.batchId },
            });
            const receiptItem = batch?.receipt_item_id
              ? await manager.findOne(InventoryReceiptItem, {
                  where: { id: batch.receipt_item_id },
                  relations: ['receipt'],
                })
              : null;
            const supplierId =
              batch?.supplier_id || receiptItem?.receipt?.supplier_id;
            const quantity = Number(affectedBatch.deductedQuantity || 0);
            const unitCost = Number(affectedBatch.cost || 0);
            const allocationData: any = {
              invoice_id: invoice.id,
              sales_invoice_item_id: item.id,
              product_id: item.product_id,
              quantity,
              unit_cost: unitCost,
              total_cost: quantity * unitCost,
            };
            if (batch?.id) allocationData.inventory_batch_id = batch.id;
            if (batch?.receipt_item_id) {
              allocationData.receipt_item_id = batch.receipt_item_id;
            }
            if (supplierId) allocationData.supplier_id = supplierId;

            await manager.save(
              SalesInvoiceItemStockAllocation,
              allocationData,
            );
          }

          // Cập nhật số lượng tính thuế vào item
          await manager.update(SalesInvoiceItem, item.id, {
            taxable_quantity: result.taxableQuantity
          });

          this.logger.log(`✅ Đã trừ kho sản phẩm ID ${item.product_id}, SL: ${item.quantity}, SL Thuế: ${result.taxableQuantity}`);
        } catch (error) {
          this.logger.error(`❌ Lỗi khi trừ kho sản phẩm ID ${item.product_id}: ${(error as any).message}`);
          throw error;
        }
      }

      this.logger.log(`✅ Hoàn tất trừ tồn kho cho hóa đơn #${invoice.code}`);
    } catch (error) {
      this.logger.error(`❌ Lỗi nghiêm trọng khi xử lý trừ tồn kho cho hóa đơn #${invoiceId}: ${(error as any).message}`);
      throw error;
    }
  }

  /**
   * Đồng bộ tồn kho cho tất cả các hóa đơn đã xác nhận hoặc đã thanh toán
   * Dùng để sửa dữ liệu cũ
   */
  async syncAllInventory(userId: number): Promise<{ processed: number; success: number; skipped: number }> {
    const invoices = await this.salesInvoiceRepository.find({
      where: [
        { status: SalesInvoiceStatus.CONFIRMED, deleted_at: IsNull() },
        { status: SalesInvoiceStatus.PAID, deleted_at: IsNull() },
      ],
    });

    this.logger.log(`🔍 Tìm thấy ${invoices.length} hóa đơn cần kiểm tra đồng bộ tồn kho.`);

    let success = 0;
    let skipped = 0;

    for (const invoice of invoices) {
      // Kiểm tra xem đã có transaction chưa
      const existing = await this.dataSource.getRepository(InventoryTransaction).findOne({
        where: {
          reference_type: 'SALE',
          reference_id: invoice.id,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.handleInventoryDeduction(invoice.id, userId);
      await this.inventoryService.syncSupplierSettlementForPostedInvoice(
        invoice.id,
      );
      success++;
    }

    return {
      processed: invoices.length,
      success,
      skipped,
    };
  }
  /**
   * Hoàn tồn kho cho hóa đơn bị hủy/hoàn tiền
   * @param invoiceId - ID hóa đơn
   * @param userId - ID người thực hiện
   * @param queryRunner - Đối tượng QueryRunner để xử lý transaction
   */
  async handleInventoryRestoration(invoiceId: number, userId: number, queryRunner?: QueryRunner): Promise<void> {
    try {
      const transRepo = queryRunner ? queryRunner.manager.getRepository(InventoryTransaction) : this.dataSource.getRepository(InventoryTransaction);
      await this.inventoryService.removeSupplierSettlementForInvoice(
        invoiceId,
        queryRunner,
      );
      
      // 1. Kiểm tra xem hóa đơn đã được trừ tồn kho chưa
      const outTransactions = await transRepo.find({
        where: {
          reference_type: 'SALE',
          reference_id: invoiceId,
          type: 'OUT'
        },
      });

      if (outTransactions.length === 0) {
        this.logger.log(`ℹ️ Hóa đơn #${invoiceId} chưa được trừ tồn kho, không cần hoàn lại.`);
        return;
      }

      // Kiểm tra xem đã hoàn kho chưa (có giao dịch IN tham chiếu đến hóa đơn này)
      const inTransaction = await transRepo.findOne({
        where: {
          reference_type: 'STOCK_IN_CANCEL',
          reference_id: invoiceId,
          type: 'IN'
        }
      });

      if (inTransaction) {
        this.logger.log(`ℹ️ Hóa đơn #${invoiceId} đã được hoàn tồn kho trước đó, bỏ qua.`);
        return;
      }

      const invoice = await this.findOne(invoiceId, queryRunner);
      if (!invoice || !invoice.items) return;

      this.logger.log(`🚀 Bắt đầu hoàn tồn kho cho hóa đơn #${invoice.code}`);
      await transRepo.manager.delete(SalesInvoiceItemStockAllocation, {
        invoice_id: invoiceId,
      });

      for (const item of invoice.items) {
        // Lấy giá vốn từ giao dịch xuất kho tương ứng để hoàn lại đúng giá
        const outTrans = outTransactions.find(t => t.product_id === item.product_id);
        const unitCostPrice = outTrans ? parseFloat(outTrans.unit_cost_price) : 0;

        // ✅ Tính số lượng thực tế hoàn kho theo đơn vị cơ sở (base_quantity)
        const stockInQuantity = item.base_quantity
          ? Number(item.base_quantity)
          : item.quantity;

        await this.inventoryService.processStockIn(
          item.product_id,
          stockInQuantity,
          unitCostPrice,
          userId || invoice.created_by,
          undefined,
          `CANCEL_${invoice.code}_${item.product_id}`,
          undefined,
          queryRunner,
          Number(item.taxable_quantity) || 0 // Số lượng thuế cần hoàn lại
        );

        // Cập nhật reference cho giao dịch vừa tạo
        const latestTrans = await transRepo.findOne({
          where: { product_id: item.product_id },
          order: { created_at: 'DESC' }
        });

        if (latestTrans && latestTrans.reference_type === 'STOCK_IN') {
           latestTrans.reference_type = 'STOCK_IN_CANCEL';
           latestTrans.reference_id = invoiceId;
           latestTrans.notes = `Hoàn kho từ hóa đơn hủy #${invoice.code}`;
           await transRepo.save(latestTrans);
        }
      }

      this.logger.log(`✅ Hoàn tất hoàn tồn kho cho hóa đơn #${invoice.code}`);
    } catch (error) {
      this.logger.error(`❌ Lỗi khi hoàn tồn kho hóa đơn #${invoiceId}: ${(error as any).message}`);
      throw error;
    }
  }
}
