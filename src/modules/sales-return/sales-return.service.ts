import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SalesReturn,
  SalesReturnStatus,
} from '../../entities/sales-return.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SearchSalesReturnDto } from './dto/search-sales-return.dto';
import { InventoryBatch } from '../../entities/inventories.entity';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { Payment } from '../../entities/payment.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CustomerRewardService } from '../customer-reward/customer-reward.service'; // ✅ Thêm import
import { Product } from '../../entities/products.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { InventoryService } from '../inventory/inventory.service';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';

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
  ) {}

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
      if (invoice.status === 'cancelled') {
        throw new BadRequestException('Không thể trả hàng cho hóa đơn đã hủy');
      }

      // ✅ 2.5. VALIDATION: Kiểm tra phương thức hoàn tiền phải khớp với phương thức thanh toán
      const refundMethod = createDto.refund_method || 'debt_credit';
      const invoicePaymentMethod =
        invoice.payment_method?.toLowerCase() || 'debt';

      // Map payment method của invoice sang refund method tương ứng
      const validRefundMethods: Record<string, string[]> = {
        debt: ['debt_credit'],
        cash: ['cash'],
        bank_transfer: ['bank_transfer'],
      };

      // Tìm valid methods cho payment method của invoice
      const allowedMethods = validRefundMethods[invoicePaymentMethod] || [
        'debt_credit',
      ];

      if (!allowedMethods.includes(refundMethod)) {
        const methodNames: Record<string, string> = {
          debt: 'Công nợ',
          cash: 'Tiền mặt',
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
        const invoiceItem = invoice.items?.find(
          (item) => item.product_id === itemDto.product_id,
        );

        if (!invoiceItem) {
          throw new BadRequestException(
            `Sản phẩm ID ${itemDto.product_id} không có trong hóa đơn này`,
          );
        }

        // Tính tổng số lượng đã trả trước đó cho sản phẩm này
        const previousReturns = await queryRunner.manager
          .createQueryBuilder(SalesReturnItem, 'item')
          .innerJoin('item.sales_return', 'return')
          .where('return.invoice_id = :invoiceId', { invoiceId: invoice.id })
          .andWhere('item.product_id = :productId', {
            productId: itemDto.product_id,
          })
          .andWhere('return.status != :cancelledStatus', {
            cancelledStatus: SalesReturnStatus.CANCELLED,
          })
          .select('SUM(item.quantity)', 'total')
          .getRawOne();

        const totalReturned = parseFloat(previousReturns?.total || '0');
        const totalCanReturn = invoiceItem.quantity - totalReturned;

        if (itemDto.quantity > totalCanReturn) {
          throw new BadRequestException(
            `Sản phẩm "${invoiceItem.product?.name || itemDto.product_id}" chỉ có thể trả tối đa ${totalCanReturn} (Đã mua: ${invoiceItem.quantity}, Đã trả: ${totalReturned})`,
          );
        }
      }

      // 4. Tạo các item trả hàng
      const returnItems: SalesReturnItem[] = [];
      let totalRefund = 0;

       for (const itemDto of createDto.items) {
        const total = itemDto.quantity * itemDto.unit_price;
        totalRefund += total;

        // Tìm invoice item tương ứng để lấy thông tin quy đổi nếu thiếu
        const invoiceItem = invoice.items?.find(
          (ii) => ii.product_id === itemDto.product_id,
        );

        // Ưu tiên dùng conversion_factor từ DTO (nếu FE gửi), 
        // không thì lấy từ invoice item cũ, mặc định là 1
        const factor = itemDto.conversion_factor || invoiceItem?.conversion_factor || 1;
        const baseQty = itemDto.quantity * factor;

        const returnItem = this.salesReturnItemRepository.create({
          product_id: itemDto.product_id,
          quantity: itemDto.quantity,
          unit_name: itemDto.unit_name || invoiceItem?.unit_name,
          sale_unit_id: itemDto.sale_unit_id || invoiceItem?.sale_unit_id,
          conversion_factor: factor,
          base_quantity: baseQty,
          unit_price: itemDto.unit_price,
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

      // Tính COGS của hàng trả lại và cập nhật cost_of_goods_sold
      let returnedCOGS = 0;
      for (const returnItem of returnItems) {
        // Tìm sản phẩm tương ứng trong invoice.items để lấy average_cost_price
        const invoiceItem = invoice.items?.find(
          (item) => item.product_id === returnItem.product_id,
        );
        const avgCost = invoiceItem?.product?.average_cost_price
          ? Number(invoiceItem.product.average_cost_price)
          : 0;

        const itemCOGS = returnItem.quantity * avgCost;
        returnedCOGS += itemCOGS;

        this.logger.log(
          `[Trả hàng ${returnCode}] Sản phẩm ID ${returnItem.product_id}: ` +
            `${returnItem.quantity} x ${avgCost.toLocaleString()}đ = ${itemCOGS.toLocaleString()}đ COGS`,
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

      if (currentRemaining > 0) {
        // ========================================
        // CASE 1: Khách còn nợ → Giảm công nợ
        // ========================================
        const amountToDeduct = Math.min(totalRefund, currentRemaining);

        // Giảm công nợ
        invoice.remaining_amount = currentRemaining - amountToDeduct;

        // KHÔNG tăng partial_payment_amount (vì trả hàng ≠ thanh toán)

        this.logger.log(
          `[Trả hàng ${returnCode}] Hóa đơn ${invoice.code}: ` +
            `Tổng tiền: ${currentFinalAmount.toLocaleString()}đ → ${invoice.final_amount.toLocaleString()}đ, ` +
            `Công nợ: ${currentRemaining.toLocaleString()}đ → ${invoice.remaining_amount.toLocaleString()}đ`,
        );

        // Nếu trả hàng nhiều hơn nợ → Tạo Payment âm cho phần dư
        if (totalRefund > currentRemaining) {
          const excessAmount = totalRefund - currentRemaining;

          if (!invoice.customer_id) {
            throw new BadRequestException(
              'Không thể hoàn tiền cho hóa đơn không có thông tin khách hàng',
            );
          }

          const refundCode = this.generateRefundCode();

          const refundPayment = queryRunner.manager.create(Payment, {
            code: refundCode,
            customer_id: invoice.customer_id,
            amount: -excessAmount, // Số âm = Hoàn tiền
            payment_date: new Date(),
            payment_method: 'REFUND',
            notes: `Hoàn tiền phần dư - Phiếu ${returnCode} - Hóa đơn ${invoice.code}`,
            created_by: userId,
          });

          await queryRunner.manager.save(refundPayment);

          this.logger.log(
            `[Trả hàng ${returnCode}] Hoàn tiền phần dư: ${excessAmount.toLocaleString()}đ`,
          );
        }
      } else {
        // ========================================
        // CASE 2: Khách đã trả đủ → Hoàn tiền
        // ========================================

        if (!invoice.customer_id) {
          throw new BadRequestException(
            'Không thể hoàn tiền cho hóa đơn không có thông tin khách hàng',
          );
        }

        const refundCode = this.generateRefundCode();

        // Tạo Payment âm (Refund)
        const refundPayment = queryRunner.manager.create(Payment, {
          code: refundCode,
          customer_id: invoice.customer_id,
          amount: -totalRefund, // Số âm = Hoàn tiền
          payment_date: new Date(),
          payment_method: 'REFUND',
          notes: `Hoàn tiền do trả hàng - Phiếu ${returnCode} - Hóa đơn ${invoice.code}`,
          created_by: userId,
        });

        await queryRunner.manager.save(refundPayment);

        // Giảm số tiền đã trả (vì đã hoàn lại cho khách)
        invoice.partial_payment_amount = Math.max(0, currentPaid - totalRefund);

        // Tăng công nợ (vì đã hoàn tiền nhưng hàng đã trả)
        // Ép kiểu Number() trước khi tính để tránh bug cộng chuỗi với NUMERIC từ DB
        // Lưu ý: Công nợ mới = final_amount mới - partial_payment mới
        invoice.remaining_amount =
          Number(invoice.final_amount) - Number(invoice.partial_payment_amount);

        this.logger.log(
          `[Trả hàng ${returnCode}] Hóa đơn ${invoice.code}: ` +
            `Tổng tiền: ${currentFinalAmount.toLocaleString()}đ → ${invoice.final_amount.toLocaleString()}đ, ` +
            `Đã trả: ${currentPaid.toLocaleString()}đ → ${invoice.partial_payment_amount.toLocaleString()}đ, ` +
            `Công nợ: ${currentRemaining.toLocaleString()}đ → ${invoice.remaining_amount.toLocaleString()}đ`,
        );
      }

      // Cập nhật status nếu trả toàn bộ hàng
      if (invoice.final_amount <= 0) {
        invoice.status = 'refunded' as any; // Đã hoàn trả toàn bộ
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

          // Cập nhật status
          if (totalRemaining <= 0) {
            debtNote.status = DebtNoteStatus.PAID;
          } else if (totalPaid > 0) {
            debtNote.status = DebtNoteStatus.ACTIVE; // Vẫn còn nợ nhưng đã trả 1 phần
          }

          await queryRunner.manager.save(debtNote);

          // 🔥 THU HỒI ĐIỂM TÍCH LŨY KHI TRẢ HÀNG (Nếu có hoàn tiền mặt/trừ vào tiền đã trả của phiếu nợ)
          if (totalRefund > 0) {
            await this.customerRewardService.handleDebtNoteSettlement(
              queryRunner.manager,
              debtNote,
              {
                payment_amount: -totalRefund, // Số âm để thu hồi điểm
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

      // 7. Cập nhật tồn kho (Tăng lại số lượng cho sản phẩm trả)
      for (const item of returnItems) {
        // Lấy thông tin invoice item để biết hàng trả có tính thuế không
        const invoiceItem = invoice.items?.find(
          (ii) => ii.product_id === item.product_id,
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
            .andWhere('ri.product_id = :productId', { productId: item.product_id })
            .andWhere('sr.status = :status', { status: SalesReturnStatus.APPROVED })
            .andWhere('sr.id != :currentId', { currentId: savedReturn.id })
            .select('SUM(ri.base_quantity)', 'total')
            .getRawOne();

          const alreadyReturnedBase = parseFloat(prevReturnedBase?.total || '0');
          const remainingTaxableBase = Math.max(0, Number(invoiceItem.taxable_quantity) - alreadyReturnedBase);
          
          returnTaxableQty = Math.min(Number(item.base_quantity), remainingTaxableBase);
        }

        // ✅ Sử dụng InventoryService.processStockIn để xử lý kho chuyên nghiệp
        // Điều này sẽ tự động cập nhật InventoryBatch, InventoryTransaction, Product.quantity,
        // average_cost_price và taxable_quantity_stock một cách nhất quán.
        await this.inventoryService.processStockIn(
          item.product_id,
          Number(item.base_quantity),
          Number(item.unit_price) / (item.conversion_factor || 1), // Giá vốn cơ sở (VD: giá/kg)
          userId,
          undefined, // receiptItemId
          `RETURN-${returnCode}`, // batch code
          undefined, // expiryDate
          queryRunner,
          returnTaxableQty // Hoàn lại lượng hàng thuế nếu có
        );

        this.logger.log(
          `[Trả hàng ${returnCode}] ✅ Đã hoàn kho cho SP ID ${item.product_id}: ` +
            `+${item.base_quantity} (Base Qty), +${returnTaxableQty} (Taxable Qty)`,
        );
      }

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
      if (invoice) {
        // Tính toán lại COGS hoàn lại để đảo ngược
        let totalCostOfReturn = 0;
        for (const item of salesReturn.items || []) {
          const invoiceItem = await queryRunner.manager.findOne(SalesInvoiceItem, {
            where: {
              sales_invoice_id: invoice.id,
              product_id: item.product_id,
            },
          });
          if (invoiceItem) {
            const costPerBaseUnit =
              Number(invoiceItem.total_cost || 0) /
              Number(invoiceItem.base_quantity || 1);
            totalCostOfReturn += costPerBaseUnit * Number(item.base_quantity);
          }
        }

        // Hoàn trả lại tiền vào hóa đơn (Final Amount và COGS)
        invoice.final_amount =
          Number(invoice.final_amount) + Number(salesReturn.total_refund_amount);
        invoice.cost_of_goods_sold =
          Number(invoice.cost_of_goods_sold) + totalCostOfReturn;
        
        // Cập nhật lại số tiền còn nợ (remaining_amount)
        invoice.remaining_amount = 
          Number(invoice.remaining_amount || 0) + Number(salesReturn.total_refund_amount);

        await queryRunner.manager.save(invoice);
      }

      // 4. Đảo ngược tác động kho (Trừ lại tồn kho)
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
      if (salesReturn.customer_id && salesReturn.total_refund_amount > 0) {
        let tracking = await queryRunner.manager.findOne(CustomerRewardTracking, {
          where: { customer_id: salesReturn.customer_id },
        });

        if (tracking) {
          tracking.pending_amount =
            Number(tracking.pending_amount) +
            Number(salesReturn.total_refund_amount);
          tracking.total_accumulated =
            Number(tracking.total_accumulated) +
            Number(salesReturn.total_refund_amount);
          await queryRunner.manager.save(tracking);
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Đã hủy phiếu trả hàng #${salesReturn.code}`);
      return salesReturn;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hủy phiếu trả hàng: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
