import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  SalesReturn,
  SalesReturnStatus,
} from '../../entities/sales-return.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
  SalesPaymentStatus,
} from '../../entities/sales-invoices.entity';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SearchSalesReturnDto } from './dto/search-sales-return.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CustomerRewardService } from '../customer-reward/customer-reward.service'; // ✅ Thêm import
import { InventoryService } from '../inventory/inventory.service';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { PromotionCampaignService } from '../promotion-campaign/promotion-campaign.service';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesInvoiceItemStockAllocation } from '../../entities/sales-invoice-item-stock-allocations.entity';

@Injectable()
export class SalesReturnService {
  private readonly logger = new Logger(SalesReturnService.name);

  constructor(
    @InjectRepository(SalesReturn)
    private salesReturnRepository: Repository<SalesReturn>,
    @InjectRepository(SalesReturnItem)
    private salesReturnItemRepository: Repository<SalesReturnItem>,
    private dataSource: DataSource,
    private customerRewardService: CustomerRewardService, // ✅ Thêm CustomerRewardService
    private inventoryService: InventoryService, // ✅ Thêm InventoryService
    private promotionCampaignService: PromotionCampaignService,
  ) {}

  private findInvoiceItemForReturn(
    invoiceItems: SalesInvoiceItem[] | undefined,
    itemDto: { sales_invoice_item_id?: number; product_id: number },
  ): SalesInvoiceItem | undefined {
    if (!invoiceItems?.length) {
      return undefined;
    }

    if (itemDto.sales_invoice_item_id) {
      return invoiceItems.find(
        (item) => Number(item.id) === Number(itemDto.sales_invoice_item_id),
      );
    }

    return invoiceItems.find(
      (item) => Number(item.product_id) === Number(itemDto.product_id),
    );
  }

  private getInvoiceItemUnitCost(invoiceItem?: SalesInvoiceItem): number {
    return Number(
      invoiceItem?.cost_price ??
        invoiceItem?.product?.average_cost_price ??
        0,
    );
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private roundBaseQuantity(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;
  }

  private async buildReturnRestockPlans(
    manager: EntityManager,
    returnItem: SalesReturnItem,
    invoiceItem?: SalesInvoiceItem,
  ): Promise<
    Array<{
      quantity: number;
      unitCost: number;
      receiptItemId?: number;
      supplierId?: number;
    }>
  > {
    type ReturnRestockPlan = {
      quantity: number;
      unitCost: number;
      receiptItemId?: number;
      supplierId?: number;
    };
    const returnBaseQty = Number(returnItem.base_quantity || returnItem.quantity || 0);
    const fallbackUnitCost = this.getInvoiceItemUnitCost(invoiceItem);
    const salesInvoiceItemId =
      invoiceItem?.id || returnItem.sales_invoice_item_id;

    if (returnBaseQty <= 0 || !salesInvoiceItemId) {
      return [{ quantity: returnBaseQty, unitCost: fallbackUnitCost }];
    }

    const allocations = await manager.find(SalesInvoiceItemStockAllocation, {
      where: { sales_invoice_item_id: salesInvoiceItemId },
      order: { id: 'ASC' },
    });

    if (!allocations.length) {
      return [{ quantity: returnBaseQty, unitCost: fallbackUnitCost }];
    }

    const totalAllocatedQty = allocations.reduce(
      (sum, allocation) => sum + Number(allocation.quantity || 0),
      0,
    );

    if (totalAllocatedQty <= 0) {
      return [{ quantity: returnBaseQty, unitCost: fallbackUnitCost }];
    }

    let remainingQty = this.roundBaseQuantity(returnBaseQty);
    const plans: ReturnRestockPlan[] = [];
    allocations.forEach((allocation, index) => {
        const allocationQty = Number(allocation.quantity || 0);
        if (allocationQty <= 0 || remainingQty <= 0) {
          return;
        }

        const rawQty =
          index === allocations.length - 1
            ? remainingQty
            : this.roundBaseQuantity(
                (returnBaseQty * allocationQty) / totalAllocatedQty,
              );
        const quantity = Math.max(
          0,
          Math.min(remainingQty, rawQty || allocationQty),
        );

        if (quantity <= 0) {
          return;
        }

        remainingQty = this.roundBaseQuantity(remainingQty - quantity);

        const plan: ReturnRestockPlan = {
          quantity,
          unitCost: Number(allocation.unit_cost || fallbackUnitCost),
        };
        if (allocation.receipt_item_id) {
          plan.receiptItemId = allocation.receipt_item_id;
        }
        if (allocation.supplier_id) {
          plan.supplierId = allocation.supplier_id;
        }
        plans.push(plan);
      });

    if (!plans.length) {
      return [{ quantity: returnBaseQty, unitCost: fallbackUnitCost }];
    }

    const lastPlan = plans[plans.length - 1];
    if (remainingQty > 0 && lastPlan) {
      lastPlan.quantity = this.roundBaseQuantity(lastPlan.quantity + remainingQty);
    }

    return plans;
  }

  private resolveDebtNoteStatusAfterRecalc(
    currentStatus: DebtNoteStatus,
    totalRemaining: number,
  ): DebtNoteStatus {
    if (totalRemaining <= 0) {
      return DebtNoteStatus.PAID;
    }

    const statusesToPreserve = [
      DebtNoteStatus.OVERDUE,
      DebtNoteStatus.ROLLED_OVER,
      DebtNoteStatus.SETTLED,
    ];

    return statusesToPreserve.includes(currentStatus)
      ? currentStatus
      : DebtNoteStatus.ACTIVE;
  }

  async create(
    createDto: CreateSalesReturnDto,
    userId: number,
  ): Promise<SalesReturn> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lấy thông tin hóa đơn
      const invoice = await queryRunner.manager.findOne(SalesInvoice, {
        where: { id: createDto.invoice_id },
        relations: ['items', 'items.product'],
      });

      if (!invoice) {
        throw new BadRequestException('Hóa đơn không tồn tại');
      }

      // 2. Kiểm tra trạng thái hóa đơn
      if (
        invoice.status !== SalesInvoiceStatus.CONFIRMED &&
        invoice.status !== SalesInvoiceStatus.PAID
      ) {
        throw new BadRequestException(
          'Chỉ hóa đơn đã xác nhận hoặc đã thanh toán mới được trả hàng',
        );
      }

      // ✅ 2.5. VALIDATION: Kiểm tra phương thức hoàn tiền phải khớp với phương thức thanh toán
      const refundMethod = createDto.refund_method || 'debt_credit';
      const invoicePaymentMethod =
        invoice.payment_method?.toLowerCase() || 'debt';

      // Map payment method của invoice sang refund method tương ứng
      const validRefundMethods: Record<string, string[]> = {
        debt: ['debt_credit'],
        cash: ['cash'],
        transfer: ['transfer', 'bank_transfer'],
        bank_transfer: ['transfer', 'bank_transfer'],
      };

      // Tìm valid methods cho payment method của invoice
      const allowedMethods = validRefundMethods[invoicePaymentMethod] || [
        'debt_credit',
      ];

      if (!allowedMethods.includes(refundMethod)) {
        const methodNames: Record<string, string> = {
          debt: 'Công nợ',
          cash: 'Tiền mặt',
          transfer: 'Chuyển khoản',
          bank_transfer: 'Chuyển khoản',
          debt_credit: 'Trừ công nợ',
        };

        throw new BadRequestException(
          `Hóa đơn thanh toán bằng "${methodNames[invoicePaymentMethod] || invoicePaymentMethod}" ` +
            `chỉ có thể hoàn tiền bằng "${allowedMethods.map((m) => methodNames[m] || m).join(', ')}". ` +
            `Không thể chọn "${methodNames[refundMethod] || refundMethod}".`,
        );
      }

      this.logger.log(
        `[Trả hàng] Hóa đơn ${invoice.code}: ` +
          `Payment method: ${invoicePaymentMethod}, Refund method: ${refundMethod} ✅`,
      );

      // 3. Kiểm tra số lượng trả hợp lệ
      for (const itemDto of createDto.items) {
        const invoiceItem = this.findInvoiceItemForReturn(
          invoice.items,
          itemDto,
        );

        if (!invoiceItem) {
          throw new BadRequestException(
            `Dòng sản phẩm ID ${itemDto.sales_invoice_item_id || itemDto.product_id} không có trong hóa đơn này`,
          );
        }

        if (Number(invoiceItem.product_id) !== Number(itemDto.product_id)) {
          throw new BadRequestException(
            `Dòng hóa đơn ${invoiceItem.id} không khớp sản phẩm ID ${itemDto.product_id}`,
          );
        }

        const factor = Number(invoiceItem.conversion_factor || 1);
        const requestedBaseQty = Number(itemDto.quantity) * Number(factor);
        const invoiceBaseQty = Number(
          invoiceItem.base_quantity || invoiceItem.quantity || 0,
        );

        // Tính tổng số lượng đã trả trước đó cho sản phẩm này
        const previousReturnsQuery = queryRunner.manager
          .createQueryBuilder(SalesReturnItem, 'item')
          .innerJoin('item.sales_return', 'return')
          .where('return.invoice_id = :invoiceId', { invoiceId: invoice.id })
          .andWhere('return.status != :cancelledStatus', {
            cancelledStatus: SalesReturnStatus.CANCELLED,
          })
          .select(
            'SUM(COALESCE(item.base_quantity, item.quantity * COALESCE(item.conversion_factor, 1)))',
            'total',
          );

        if (itemDto.sales_invoice_item_id) {
          previousReturnsQuery.andWhere(
            '(item.sales_invoice_item_id = :invoiceItemId OR (item.sales_invoice_item_id IS NULL AND item.product_id = :productId))',
            {
              invoiceItemId: itemDto.sales_invoice_item_id,
              productId: itemDto.product_id,
            },
          );
        } else {
          previousReturnsQuery.andWhere('item.product_id = :productId', {
            productId: itemDto.product_id,
          });
        }

        const previousReturns = await previousReturnsQuery.getRawOne();

        const totalReturned = parseFloat(previousReturns?.total || '0');
        const totalCanReturn = invoiceBaseQty - totalReturned;

        if (requestedBaseQty > totalCanReturn + 0.000001) {
          throw new BadRequestException(
            `Sản phẩm "${invoiceItem.product?.name || itemDto.product_id}" chỉ có thể trả tối đa ${totalCanReturn} đơn vị gốc (Đã mua: ${invoiceBaseQty}, Đã trả: ${totalReturned})`,
          );
        }
      }

      // 4. Tạo các item trả hàng
      const returnItems: SalesReturnItem[] = [];
      let totalRefund = 0;
      const invoiceItemsGross = (invoice.items || []).reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      );
      const invoiceDiscount = Number(invoice.discount_amount || 0);

       for (const itemDto of createDto.items) {
        // Tìm invoice item tương ứng để lấy thông tin quy đổi nếu thiếu
        const invoiceItem = this.findInvoiceItemForReturn(
          invoice.items,
          itemDto,
        );

        const factor = Number(invoiceItem?.conversion_factor || 1);
        const baseQty = itemDto.quantity * factor;
        const invoiceItemBaseQty = Number(
          invoiceItem?.base_quantity || invoiceItem?.quantity || 0,
        );
        const invoiceItemGross = Number(invoiceItem?.total_price || 0);
        const grossRefund =
          invoiceItemBaseQty > 0
            ? invoiceItemGross * (baseQty / invoiceItemBaseQty)
            : itemDto.quantity * Number(invoiceItem?.unit_price || itemDto.unit_price || 0);
        const invoiceDiscountShare =
          invoiceItemsGross > 0
            ? invoiceDiscount * (grossRefund / invoiceItemsGross)
            : 0;
        const total = Math.max(0, grossRefund - invoiceDiscountShare);
        const unitPrice = itemDto.quantity > 0 ? total / itemDto.quantity : 0;
        totalRefund += total;

        const returnItem = this.salesReturnItemRepository.create({
          product_id: invoiceItem?.product_id || itemDto.product_id,
          ...(invoiceItem?.id && { sales_invoice_item_id: invoiceItem.id }),
          quantity: itemDto.quantity,
          unit_name: invoiceItem?.unit_name || itemDto.unit_name || '',
          sale_unit_id: invoiceItem?.sale_unit_id || itemDto.sale_unit_id || 0,
          conversion_factor: factor,
          base_quantity: baseQty,
          unit_price: unitPrice,
          total_price: total,
        });
        returnItems.push(returnItem);
      }

      // 5. Tạo phiếu trả hàng
      // Tự động sinh mã nếu không có
      const returnCode =
        createDto.code || CodeGeneratorHelper.generateUniqueCode('SR');

      const salesReturnData: any = {
        code: returnCode,
        invoice_id: createDto.invoice_id,
        total_refund_amount: totalRefund,
        refund_method: createDto.refund_method || 'debt_credit', // Mặc định trừ công nợ
        reason: createDto.reason || '',
        notes: createDto.notes || '',
        status: SalesReturnStatus.APPROVED, // Tự động duyệt khi tạo
        created_by: userId,
        items: returnItems,
      };

      if (invoice.customer_id) {
        salesReturnData.customer_id = invoice.customer_id;
      }

      const salesReturn = this.salesReturnRepository.create(salesReturnData);
      const savedReturn = (await queryRunner.manager.save(
        salesReturn,
      )) as unknown as SalesReturn;

      // 6. ✅ XỬ LÝ TÀI CHÍNH - LOGIC ĐÚNG NGHIỆP VỤ
      // Khi khách trả hàng:
      // - Giảm final_amount của hóa đơn (vì hàng bị trả lại)
      // - Nếu khách còn nợ: Giảm công nợ
      // - Nếu khách đã trả đủ: Tạo phiếu hoàn tiền
      // - KHÔNG tăng partial_payment_amount (vì trả hàng ≠ thanh toán)

      const currentFinalAmount = parseFloat(
        invoice.final_amount?.toString() || '0',
      );
      const currentRemaining = parseFloat(
        invoice.remaining_amount?.toString() || '0',
      );
      const currentPaid = parseFloat(
        invoice.partial_payment_amount?.toString() || '0',
      );

      // Giảm tổng tiền hóa đơn
      invoice.final_amount = Math.max(0, currentFinalAmount - totalRefund);

      // Tính COGS của hàng trả lại theo snapshot giá vốn tại thời điểm bán
      let returnedCOGS = 0;
      for (const returnItem of returnItems) {
        const invoiceItem = this.findInvoiceItemForReturn(
          invoice.items,
          returnItem,
        );
        const unitCost = this.getInvoiceItemUnitCost(invoiceItem);

        const itemCOGS = Number(returnItem.base_quantity || returnItem.quantity) * unitCost;
        returnedCOGS += itemCOGS;

        this.logger.log(
          `[Trả hàng ${returnCode}] Sản phẩm ID ${returnItem.product_id}: ` +
            `${returnItem.base_quantity || returnItem.quantity} x ${unitCost.toLocaleString()}đ = ${itemCOGS.toLocaleString()}đ COGS`,
        );
      }

      const currentCOGS = parseFloat(
        invoice.cost_of_goods_sold?.toString() || '0',
      );
      invoice.cost_of_goods_sold = Math.max(0, currentCOGS - returnedCOGS);

      // Cập nhật gross_profit
      invoice.gross_profit = invoice.final_amount - invoice.cost_of_goods_sold;
      invoice.gross_profit_margin =
        invoice.final_amount > 0
          ? (invoice.gross_profit / invoice.final_amount) * 100
          : 0;

      this.logger.log(
        `[Trả hàng ${returnCode}] Cập nhật COGS: ` +
          `${currentCOGS.toLocaleString()}đ → ${invoice.cost_of_goods_sold.toLocaleString()}đ ` +
          `(Trả: -${returnedCOGS.toLocaleString()}đ), ` +
          `Gross Profit: ${invoice.gross_profit.toLocaleString()}đ`,
      );

      const paidAfterReturn = Math.min(currentPaid, Number(invoice.final_amount));
      const cashRefundAmount = Math.max(0, currentPaid - paidAfterReturn);
      const debtReductionAmount = Math.min(totalRefund, currentRemaining);

      invoice.partial_payment_amount = paidAfterReturn;
      invoice.remaining_amount = Math.max(
        0,
        Number(invoice.final_amount) - Number(invoice.partial_payment_amount),
      );

      if (cashRefundAmount > 0) {
        const refundCode = this.generateRefundCode();
        const refundPayment = queryRunner.manager.create(Payment, {
          code: refundCode,
          customer_id: invoice.customer_id || null,
          amount: -cashRefundAmount,
          allocated_amount: -cashRefundAmount,
          payment_date: new Date(),
          payment_method: refundMethod === 'bank_transfer' || refundMethod === 'transfer'
            ? 'BANK_TRANSFER_REFUND'
            : 'REFUND',
          notes: `Hoàn tiền do trả hàng - Phiếu ${returnCode} - Hóa đơn ${invoice.code}`,
          created_by: userId,
        });

        const savedRefundPayment = await queryRunner.manager.save(refundPayment);
        await queryRunner.manager.save(PaymentAllocation, {
          payment_id: savedRefundPayment.id,
          invoice_id: invoice.id,
          sales_return_id: savedReturn.id,
          allocation_type: 'invoice',
          amount: -cashRefundAmount,
        });
      }

      if (invoice.remaining_amount <= 0) {
        invoice.payment_status = SalesPaymentStatus.PAID;
        invoice.status = SalesInvoiceStatus.PAID;
        invoice.remaining_amount = 0;
      } else {
        invoice.payment_status =
          Number(invoice.partial_payment_amount) > 0
            ? SalesPaymentStatus.PARTIAL
            : SalesPaymentStatus.PENDING;
        invoice.status = SalesInvoiceStatus.CONFIRMED;
      }

      this.logger.log(
        `[Trả hàng ${returnCode}] Hóa đơn ${invoice.code}: ` +
          `Tổng tiền: ${currentFinalAmount.toLocaleString()}đ → ${Number(invoice.final_amount).toLocaleString()}đ, ` +
          `Đã trả: ${currentPaid.toLocaleString()}đ → ${Number(invoice.partial_payment_amount).toLocaleString()}đ, ` +
          `Công nợ: ${currentRemaining.toLocaleString()}đ → ${Number(invoice.remaining_amount).toLocaleString()}đ, ` +
          `Giảm nợ: ${debtReductionAmount.toLocaleString()}đ, ` +
          `Hoàn tiền: ${cashRefundAmount.toLocaleString()}đ`,
      );

      // Cập nhật status nếu trả toàn bộ hàng
      if (invoice.final_amount <= 0) {
        invoice.status = 'refunded' as any; // Đã hoàn trả toàn bộ
        invoice.payment_status = SalesPaymentStatus.REFUNDED;
      }

      await queryRunner.manager.save(invoice);

      // ✅ 6.5. Cập nhật DEBT_NOTE nếu có
      if (invoice.customer_id) {
        // Tìm debt_note chứa hóa đơn này
        // Lưu ý: source_invoices là JSON (không phải JSONB), cần cast trước
        const debtNote = await queryRunner.manager
          .createQueryBuilder(DebtNote, 'debt_note')
          .where('debt_note.customer_id = :customerId', {
            customerId: invoice.customer_id,
          })
          .andWhere(
            `:invoiceId::text IN (SELECT jsonb_array_elements_text(debt_note.source_invoices::jsonb))`,
            { invoiceId: invoice.id },
          )
          .andWhere('debt_note.status != :cancelledStatus', {
            cancelledStatus: DebtNoteStatus.CANCELLED,
          })
          .getOne();

        if (debtNote) {
          // Tính lại tổng công nợ từ tất cả hóa đơn trong debt_note
          const invoiceIds = debtNote.source_invoices || [];

          const invoices = await queryRunner.manager
            .createQueryBuilder(SalesInvoice, 'invoice')
            .where('invoice.id IN (:...ids)', { ids: invoiceIds })
            .getMany();

          // ✅ Tính tổng final_amount từ tất cả invoices (Giá trị đơn HIỆN TẠI sau khi trừ trả hàng)
          const totalAmount = invoices.reduce(
            (sum, inv) => sum + parseFloat(inv.final_amount?.toString() || '0'),
            0,
          );

          // Tính tổng remaining từ tất cả invoices
          const totalRemaining = invoices.reduce(
            (sum, inv) =>
              sum + parseFloat(inv.remaining_amount?.toString() || '0'),
            0,
          );

          // Tính tổng paid từ tất cả invoices
          const totalPaid = invoices.reduce(
            (sum, inv) =>
              sum + parseFloat(inv.partial_payment_amount?.toString() || '0'),
            0,
          );

          // Cập nhật debt_note
          debtNote.amount = totalAmount; // ✅ Cập nhật giá trị đơn hiện tại
          debtNote.remaining_amount = totalRemaining;
          debtNote.paid_amount = totalPaid;

          debtNote.status = this.resolveDebtNoteStatusAfterRecalc(
            debtNote.status,
            totalRemaining,
          );

          await queryRunner.manager.save(debtNote);

          // Thu hồi điểm theo phần tiền đã thực sự hoàn/giảm khỏi số đã trả.
          if (cashRefundAmount > 0) {
            await this.customerRewardService.handleDebtNoteSettlement(
              queryRunner.manager,
              debtNote,
              {
                payment_amount: -cashRefundAmount,
                notes: `Thu hồi điểm do khách trả hàng - Phiếu ${returnCode}`,
              },
              userId,
              false,
            );
          }

          this.logger.log(
            `[Trả hàng ${returnCode}] Cập nhật debt_note ${debtNote.code}: ` +
              `Giá trị đơn: ${totalAmount.toLocaleString()}đ, ` +
              `Đã trả: ${totalPaid.toLocaleString()}đ, ` +
              `Còn nợ: ${totalRemaining.toLocaleString()}đ, ` +
              `Status: ${debtNote.status}`,
          );
        }
      }

      await this.promotionCampaignService.processSalesReturnReversal(
        queryRunner.manager,
        savedReturn.id,
      );

      // 7. Cập nhật tồn kho (Tăng lại số lượng cho sản phẩm trả)
      const supplierSettlementReturnEntries: Array<{
        receipt_item_id?: number;
        supplier_id?: number;
        product_id: number;
        invoice_id?: number;
        sales_invoice_item_id?: number;
        price_type?: string;
        quantity: number;
        unit_cost: number;
        notes?: string;
      }> = [];
      for (const item of returnItems) {
        // Lấy thông tin invoice item để biết hàng trả có tính thuế không
        const invoiceItem = this.findInvoiceItemForReturn(
          invoice.items,
          item,
        );

        // Tính toán lượng hàng thuế hoàn lại (FIFO tương đối)
        // Nếu item trong invoice có taxable_quantity > 0, ta ưu tiên hoàn lại hàng thuế trước
        let returnTaxableQty = 0;
        if (invoiceItem && Number(invoiceItem.taxable_quantity) > 0) {
          // Lấy lượng đã trả trước đó để biết còn bao nhiêu hàng thuế có thể hoàn
          const prevReturnedBase = await queryRunner.manager
            .createQueryBuilder(SalesReturnItem, 'ri')
            .innerJoin('ri.sales_return', 'sr')
            .where('sr.invoice_id = :invoiceId', { invoiceId: invoice.id })
            .andWhere('sr.status = :status', { status: SalesReturnStatus.APPROVED })
            .andWhere('sr.id != :currentId', { currentId: savedReturn.id })
            .select(
              'SUM(COALESCE(ri.base_quantity, ri.quantity * COALESCE(ri.conversion_factor, 1)))',
              'total',
            )
          if (item.sales_invoice_item_id) {
            prevReturnedBase.andWhere(
              '(ri.sales_invoice_item_id = :invoiceItemId OR (ri.sales_invoice_item_id IS NULL AND ri.product_id = :productId))',
              {
                invoiceItemId: item.sales_invoice_item_id,
                productId: item.product_id,
              },
            );
          } else {
            prevReturnedBase.andWhere('ri.product_id = :productId', {
              productId: item.product_id,
            });
          }

          const prevReturnedBaseResult = await prevReturnedBase.getRawOne();

          const alreadyReturnedBase = parseFloat(prevReturnedBaseResult?.total || '0');
          const remainingTaxableBase = Math.max(0, Number(invoiceItem.taxable_quantity) - alreadyReturnedBase);
          
          returnTaxableQty = Math.min(Number(item.base_quantity), remainingTaxableBase);
        }

        const restockPlans = await this.buildReturnRestockPlans(
          queryRunner.manager,
          item,
          invoiceItem,
        );
        const totalRestockQty = Number(item.base_quantity || 0);
        let remainingTaxableToRestock = this.roundBaseQuantity(returnTaxableQty);

        for (const [index, plan] of restockPlans.entries()) {
          const planTaxableQty =
            index === restockPlans.length - 1
              ? Math.max(0, remainingTaxableToRestock)
              : this.roundBaseQuantity(
                  totalRestockQty > 0
                    ? (returnTaxableQty * plan.quantity) / totalRestockQty
                    : 0,
                );
          const boundedTaxableQty = Math.max(
            0,
            Math.min(plan.quantity, Math.min(remainingTaxableToRestock, planTaxableQty)),
          );

          await this.inventoryService.processStockIn(
            item.product_id,
            plan.quantity,
            plan.unitCost,
            userId,
            plan.receiptItemId,
            `RETURN-${returnCode}`,
            undefined,
            queryRunner,
            boundedTaxableQty,
            plan.supplierId,
          );

          const settlementEntry: any = {
            product_id: item.product_id,
            invoice_id: invoice.id,
            quantity: plan.quantity,
            unit_cost: this.getInvoiceItemUnitCost(invoiceItem),
            notes: `Đảo quyết toán NCC do trả hàng #${returnCode}`,
          };
          if (plan.receiptItemId) {
            settlementEntry.receipt_item_id = plan.receiptItemId;
          }
          if (plan.supplierId) {
            settlementEntry.supplier_id = plan.supplierId;
          }
          if (invoiceItem?.id || item.sales_invoice_item_id) {
            settlementEntry.sales_invoice_item_id =
              invoiceItem?.id || item.sales_invoice_item_id;
          }
          if (invoiceItem?.price_type) {
            settlementEntry.price_type = invoiceItem.price_type;
          }
          supplierSettlementReturnEntries.push(settlementEntry);

          remainingTaxableToRestock = this.roundBaseQuantity(
            remainingTaxableToRestock - boundedTaxableQty,
          );
        }

        this.logger.log(
          `[Trả hàng ${returnCode}] ✅ Đã hoàn kho cho SP ID ${item.product_id}: ` +
            `+${item.base_quantity} (Base Qty), +${returnTaxableQty} (Taxable Qty), ${restockPlans.length} lô hoàn kho`,
        );
      }

      await this.inventoryService.createSupplierSettlementReturnEntries(
        savedReturn.id,
        supplierSettlementReturnEntries,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      this.logger.log(`[Trả hàng ${returnCode}] Hoàn thành thành công`);

      return savedReturn;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      const error = err as Error;
      this.logger.error(`[Trả hàng] Lỗi: ${error.message}`, error.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<SalesReturn[]> {
    return this.salesReturnRepository.find({
      relations: ['invoice', 'customer', 'items', 'creator'],
      order: { created_at: 'DESC' },
    });
  }

  async search(searchDto: SearchSalesReturnDto): Promise<{
    data: SalesReturn[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.salesReturnRepository.createQueryBuilder('sales_return');

    queryBuilder.leftJoinAndSelect('sales_return.invoice', 'invoice');
    queryBuilder.leftJoinAndSelect('sales_return.customer', 'customer');
    queryBuilder.leftJoinAndSelect('sales_return.items', 'items');
    queryBuilder.leftJoinAndSelect('items.product', 'product'); // ✅ Thêm join product để lấy tên
    queryBuilder.leftJoinAndSelect('sales_return.creator', 'creator');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'sales_return',
      [
        'sales_return.code',
        'invoice.customer_name',
        'invoice.customer_phone',
        'customer.name',
        'customer.phone',
      ], // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'sales_return',
      ['filters', 'nested_filters', 'operator'],
      {
        customer_name: 'invoice.customer_name',
        customer_phone: 'invoice.customer_phone',
        invoice_code: 'invoice.code',
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
   * Sinh mã phiếu hoàn tiền tự động
   * Format: RF + YYYYMMDDHHmmssSSS
   */
  private generateRefundCode(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');

    return `RF${year}${month}${day}${hours}${minutes}${seconds}${random}`;
  }

  /**
   * Hủy phiếu trả hàng
   * Đảo ngược các tác động đến tồn kho và tài chính
   */
  async cancel(id: number, userId: number): Promise<SalesReturn> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Tìm phiếu trả hàng cùng các quan hệ cần thiết
      const salesReturn = await queryRunner.manager.findOne(SalesReturn, {
        where: { id },
        relations: ['items', 'invoice', 'customer'],
      });

      if (!salesReturn) {
        throw new NotFoundException(`Không tìm thấy phiếu trả hàng #${id}`);
      }

      if (salesReturn.status === SalesReturnStatus.CANCELLED) {
        throw new BadRequestException('Phiếu trả hàng đã bị hủy trước đó');
      }

      // 2. Cập nhật trạng thái
      salesReturn.status = SalesReturnStatus.CANCELLED;
      await queryRunner.manager.save(salesReturn);

      // 3. Đảo ngược tác động tài chính lên hóa đơn gốc
      const invoice = salesReturn.invoice;
      let refundedCashAmountFromReturn = 0;
      if (invoice) {
        const refundedPaymentRaw = await queryRunner.manager
          .createQueryBuilder(Payment, 'payment')
          .innerJoin(
            PaymentAllocation,
            'allocation',
            'allocation.payment_id = payment.id',
          )
          .where('allocation.invoice_id = :invoiceId', { invoiceId: invoice.id })
          .andWhere('allocation.sales_return_id = :salesReturnId', {
            salesReturnId: salesReturn.id,
          })
          .andWhere('payment.amount < 0')
          .select('COALESCE(SUM(ABS(payment.amount::numeric)), 0)', 'total')
          .getRawOne();
        let refundedCashAmount = this.roundMoney(Number(refundedPaymentRaw?.total || 0));

        if (refundedCashAmount <= 0) {
          const refundNotePattern = `%Phiếu ${salesReturn.code} - Hóa đơn ${invoice.code}%`;
          const legacyRefundedPaymentRaw = await queryRunner.manager
            .createQueryBuilder(Payment, 'payment')
            .innerJoin(
              PaymentAllocation,
              'allocation',
              'allocation.payment_id = payment.id',
            )
            .where('allocation.invoice_id = :invoiceId', { invoiceId: invoice.id })
            .andWhere('allocation.sales_return_id IS NULL')
            .andWhere('payment.amount < 0')
            .andWhere('payment.notes LIKE :notePattern', {
              notePattern: refundNotePattern,
            })
            .select('COALESCE(SUM(ABS(payment.amount::numeric)), 0)', 'total')
            .getRawOne();

          refundedCashAmount = this.roundMoney(
            Number(legacyRefundedPaymentRaw?.total || 0),
          );
        }

        refundedCashAmountFromReturn = refundedCashAmount;

        if (refundedCashAmount > 0) {
          const reversalPayment = queryRunner.manager.create(Payment, {
            code: CodeGeneratorHelper.generateUniqueCode('PAY'),
            customer_id: invoice.customer_id || null,
            amount: refundedCashAmount,
            allocated_amount: refundedCashAmount,
            payment_date: new Date(),
            payment_method: 'RETURN_CANCEL_REFUND_REVERSE',
            notes: `Hoàn tác hoàn tiền do hủy phiếu trả hàng ${salesReturn.code} - Hóa đơn ${invoice.code}`,
            created_by: userId,
          });
          const savedReversalPayment = await queryRunner.manager.save(
            reversalPayment,
          );

          await queryRunner.manager.save(PaymentAllocation, {
            payment_id: savedReversalPayment.id,
            invoice_id: invoice.id,
            sales_return_id: salesReturn.id,
            allocation_type: 'invoice',
            amount: refundedCashAmount,
          });
        }

        // TẢI LẠI HÓA ĐƠN VỚI ĐỦ ITEM VÀ CÁC PHIẾU TRẢ KHÁC ĐỂ TÍNH TOÁN LẠI
        const fullInvoice = await queryRunner.manager.findOne(SalesInvoice, {
          where: { id: invoice.id },
          relations: ['items', 'items.product'],
        });

        if (fullInvoice) {
          // A. Tính tổng tiền gốc (trước mọi lần trả hàng)
          const originalFinalAmount = Number(fullInvoice.total_amount) - Number(fullInvoice.discount_amount || 0);

          // B. Lấy tất cả các phiếu trả hàng KHÁC (đã duyệt và không phải phiếu đang hủy)
          const otherReturns = await queryRunner.manager.find(SalesReturn, {
            where: {
              invoice_id: invoice.id,
              status: SalesReturnStatus.APPROVED,
            },
          });
          const otherReturnsToKeep = otherReturns.filter(r => r.id !== salesReturn.id);
          const totalOtherRefundAmount = otherReturnsToKeep.reduce((sum, r) => sum + Number(r.total_refund_amount), 0);

          // C. Giá trị hóa đơn MỚI sau khi hủy phiếu này
          const newFinalAmount = originalFinalAmount - totalOtherRefundAmount;
          
          // Để đơn giản và chính xác, ta chỉ đảo ngược phần COGS của phiếu đang hủy
          let totalCostOfThisReturn = 0;
          for (const item of salesReturn.items || []) {
            const invoiceItem = this.findInvoiceItemForReturn(
              fullInvoice.items,
              item,
            );
            if (invoiceItem) {
              const unitCost = this.getInvoiceItemUnitCost(invoiceItem);
              totalCostOfThisReturn += unitCost * Number(item.base_quantity || item.quantity);
            }
          }

          // Cập nhật hóa đơn
          fullInvoice.final_amount = this.roundMoney(newFinalAmount);
          fullInvoice.cost_of_goods_sold = this.roundMoney(
            Number(fullInvoice.cost_of_goods_sold) + totalCostOfThisReturn,
          );

          const allocationSumRaw = await queryRunner.manager
            .createQueryBuilder(PaymentAllocation, 'allocation')
            .where('allocation.invoice_id = :invoiceId', {
              invoiceId: fullInvoice.id,
            })
            .select('COALESCE(SUM(allocation.amount::numeric), 0)', 'total')
            .getRawOne();
          const paidByAllocations = this.roundMoney(
            Number(allocationSumRaw?.total || 0),
          );
          fullInvoice.partial_payment_amount = Math.max(
            0,
            Math.min(Number(fullInvoice.final_amount), paidByAllocations),
          );
          fullInvoice.remaining_amount = this.roundMoney(
            Math.max(
              0,
              Number(fullInvoice.final_amount) -
                Number(fullInvoice.partial_payment_amount || 0),
            ),
          );
          
          // Cập nhật lợi nhuận gộp
          fullInvoice.gross_profit = this.roundMoney(
            Number(fullInvoice.final_amount) -
              Number(fullInvoice.cost_of_goods_sold),
          );
          fullInvoice.gross_profit_margin =
            Number(fullInvoice.final_amount) > 0
              ? (Number(fullInvoice.gross_profit) / Number(fullInvoice.final_amount)) *
                100
              : 0;

          if (Number(fullInvoice.final_amount) <= 0) {
            fullInvoice.status = SalesInvoiceStatus.REFUNDED;
            fullInvoice.payment_status = SalesPaymentStatus.REFUNDED;
          } else if (Number(fullInvoice.remaining_amount) <= 0) {
            fullInvoice.status = SalesInvoiceStatus.PAID;
            fullInvoice.payment_status = SalesPaymentStatus.PAID;
            fullInvoice.remaining_amount = 0;
          } else {
            fullInvoice.status = SalesInvoiceStatus.CONFIRMED;
            fullInvoice.payment_status =
              Number(fullInvoice.partial_payment_amount) > 0
                ? SalesPaymentStatus.PARTIAL
                : SalesPaymentStatus.PENDING;
          }

          await queryRunner.manager.save(fullInvoice);

          if (fullInvoice.customer_id) {
            const debtNote = await queryRunner.manager
              .createQueryBuilder(DebtNote, 'debt_note')
              .where('debt_note.customer_id = :customerId', {
                customerId: fullInvoice.customer_id,
              })
              .andWhere(
                `:invoiceId::text IN (SELECT jsonb_array_elements_text(debt_note.source_invoices::jsonb))`,
                { invoiceId: fullInvoice.id },
              )
              .andWhere('debt_note.status != :cancelledStatus', {
                cancelledStatus: DebtNoteStatus.CANCELLED,
              })
              .getOne();

            if (debtNote) {
              const invoiceIds = debtNote.source_invoices || [];
              const invoices = await queryRunner.manager
                .createQueryBuilder(SalesInvoice, 'invoice')
                .where('invoice.id IN (:...ids)', { ids: invoiceIds })
                .getMany();

              const totalAmount = invoices.reduce(
                (sum, inv) => sum + Number(inv.final_amount || 0),
                0,
              );
              const totalRemaining = invoices.reduce(
                (sum, inv) => sum + Number(inv.remaining_amount || 0),
                0,
              );
              const totalPaid = invoices.reduce(
                (sum, inv) => sum + Number(inv.partial_payment_amount || 0),
                0,
              );

              debtNote.amount = totalAmount;
              debtNote.remaining_amount = totalRemaining;
              debtNote.paid_amount = totalPaid;
              debtNote.status = this.resolveDebtNoteStatusAfterRecalc(
                debtNote.status,
                totalRemaining,
              );

              await queryRunner.manager.save(debtNote);
            }
          }
        }
      }

      // 4. Đảo ngược tác động kho (Trừ lại tồn kho)
      await this.inventoryService.removeSupplierSettlementForSalesReturn(
        salesReturn.id,
        queryRunner,
      );
      for (const item of salesReturn.items || []) {
        // Thực hiện xuất kho ngược lại (OUT)
        await this.inventoryService.processStockOut(
          item.product_id,
          Number(item.base_quantity || item.quantity),
          'RETURN_CANCEL',
          userId,
          salesReturn.id,
          `Hủy phiếu trả hàng ${salesReturn.code}`,
          queryRunner,
        );
      }

      // 5. Đảo ngược điểm tích lũy (Nếu có)
      // Khi trả hàng ta đã làm giảm nợ khách hàng (giảm tích lũy), 
      // giờ hủy trả hàng ta phải tăng lại tích lũy cho khách
      if (salesReturn.customer_id && refundedCashAmountFromReturn > 0) {
        let tracking = await queryRunner.manager.findOne(CustomerRewardTracking, {
          where: { customer_id: salesReturn.customer_id },
        });

        if (tracking) {
          tracking.pending_amount =
            Number(tracking.pending_amount) +
            refundedCashAmountFromReturn;
          tracking.total_accumulated =
            Number(tracking.total_accumulated) +
            refundedCashAmountFromReturn;
          await queryRunner.manager.save(tracking);
        }
      }

      await this.promotionCampaignService.processSalesReturnCancellationRestore(
        queryRunner.manager,
        salesReturn.id,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Đã hủy phiếu trả hàng #${salesReturn.code}`);
      return salesReturn;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      const error = err as Error;
      this.logger.error(`❌ Lỗi khi hủy phiếu trả hàng: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
