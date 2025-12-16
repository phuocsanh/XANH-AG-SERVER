import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SalesReturn, SalesReturnStatus } from '../../entities/sales-return.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SearchSalesReturnDto } from './dto/search-sales-return.dto';
import { InventoryBatch } from '../../entities/inventories.entity';
import { QueryHelper } from '../../common/helpers/query-helper';
import { Payment } from '../../entities/payment.entity';

@Injectable()
export class SalesReturnService {
  private readonly logger = new Logger(SalesReturnService.name);
  
  constructor(
    @InjectRepository(SalesReturn)
    private salesReturnRepository: Repository<SalesReturn>,
    @InjectRepository(SalesReturnItem)
    private salesReturnItemRepository: Repository<SalesReturnItem>,
    private dataSource: DataSource,
  ) {}

  async create(createDto: CreateSalesReturnDto, userId: number): Promise<SalesReturn> {
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

      // 3. Kiểm tra số lượng trả hợp lệ
      for (const itemDto of createDto.items) {
        const invoiceItem = invoice.items?.find(
          (item) => item.product_id === itemDto.product_id
        );

        if (!invoiceItem) {
          throw new BadRequestException(
            `Sản phẩm ID ${itemDto.product_id} không có trong hóa đơn này`
          );
        }

        // Tính tổng số lượng đã trả trước đó cho sản phẩm này
        const previousReturns = await queryRunner.manager
          .createQueryBuilder(SalesReturnItem, 'item')
          .innerJoin('item.sales_return', 'return')
          .where('return.invoice_id = :invoiceId', { invoiceId: invoice.id })
          .andWhere('item.product_id = :productId', { productId: itemDto.product_id })
          .andWhere('return.status != :cancelledStatus', { cancelledStatus: SalesReturnStatus.CANCELLED })
          .select('SUM(item.quantity)', 'total')
          .getRawOne();

        const totalReturned = parseFloat(previousReturns?.total || '0');
        const totalCanReturn = invoiceItem.quantity - totalReturned;

        if (itemDto.quantity > totalCanReturn) {
          throw new BadRequestException(
            `Sản phẩm "${invoiceItem.product?.name || itemDto.product_id}" chỉ có thể trả tối đa ${totalCanReturn} (Đã mua: ${invoiceItem.quantity}, Đã trả: ${totalReturned})`
          );
        }
      }

      // 4. Tạo các item trả hàng
      const returnItems: SalesReturnItem[] = [];
      let totalRefund = 0;

      for (const itemDto of createDto.items) {
        const total = itemDto.quantity * itemDto.unit_price;
        totalRefund += total;

        const returnItem = this.salesReturnItemRepository.create({
          product_id: itemDto.product_id,
          quantity: itemDto.quantity,
          unit_price: itemDto.unit_price,
          total_price: total,
        });
        returnItems.push(returnItem);
      }

      // 5. Tạo phiếu trả hàng
      // Tự động sinh mã nếu không có
      const returnCode = createDto.code || this.generateReturnCode();
      
      const salesReturnData: any = {
        code: returnCode,
        invoice_id: createDto.invoice_id,
        total_refund_amount: totalRefund,
        refund_method: createDto.refund_method || 'debt_credit', // Mặc định trừ công nợ
        reason: createDto.reason || '',
        notes: createDto.notes || '',
        status: SalesReturnStatus.COMPLETED,
        created_by: userId,
        items: returnItems,
      };
      
      if (invoice.customer_id) {
        salesReturnData.customer_id = invoice.customer_id;
      }
      
      const salesReturn = this.salesReturnRepository.create(salesReturnData);
      const savedReturn = await queryRunner.manager.save(salesReturn) as unknown as SalesReturn;

      // 6. ✅ XỬ LÝ TÀI CHÍNH - LOGIC MỚI ĐÚNG
      const currentRemaining = parseFloat(invoice.remaining_amount?.toString() || '0');
      const currentPaid = parseFloat(invoice.partial_payment_amount?.toString() || '0');
      
      if (currentRemaining > 0) {
        // ========================================
        // CASE 1: Khách còn nợ → Trừ vào công nợ
        // ========================================
        // Trả hàng = "Thanh toán bằng hàng hóa"
        
        const amountToDeduct = Math.min(totalRefund, currentRemaining);
        
        // ✅ Giảm công nợ
        invoice.remaining_amount = currentRemaining - amountToDeduct;
        
        // ✅ QUAN TRỌNG: Tăng số tiền đã trả
        // Vì khách đã "trả" bằng cách trả hàng
        invoice.partial_payment_amount = currentPaid + amountToDeduct;
        
        this.logger.log(
          `[Trả hàng ${returnCode}] Hóa đơn ${invoice.code}: ` +
          `Công nợ cũ: ${currentRemaining.toLocaleString()}đ, ` +
          `Trả hàng: ${totalRefund.toLocaleString()}đ, ` +
          `Công nợ mới: ${invoice.remaining_amount.toLocaleString()}đ, ` +
          `Đã trả mới: ${invoice.partial_payment_amount.toLocaleString()}đ`
        );
        
        // Nếu trả hàng nhiều hơn nợ → Tạo Payment âm cho phần dư
        if (totalRefund > currentRemaining) {
          const excessAmount = totalRefund - currentRemaining;
          
          if (!invoice.customer_id) {
            throw new BadRequestException('Không thể hoàn tiền cho hóa đơn không có thông tin khách hàng');
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
            `[Trả hàng ${returnCode}] Hoàn tiền phần dư: ${excessAmount.toLocaleString()}đ`
          );
        }
        
      } else {
        // ========================================
        // CASE 2: Khách đã trả đủ → Hoàn tiền
        // ========================================
        
        if (!invoice.customer_id) {
          throw new BadRequestException('Không thể hoàn tiền cho hóa đơn không có thông tin khách hàng');
        }
        
        const refundCode = this.generateRefundCode();
        
        // ✅ Tạo Payment âm (Refund)
        const refundPayment = queryRunner.manager.create(Payment, {
          code: refundCode,
          customer_id: invoice.customer_id,
          amount: -totalRefund, // ⚠️ Số âm = Hoàn tiền
          payment_date: new Date(),
          payment_method: 'REFUND',
          notes: `Hoàn tiền do trả hàng - Phiếu ${returnCode} - Hóa đơn ${invoice.code}`,
          created_by: userId,
        });
        
        await queryRunner.manager.save(refundPayment);
        
        // ✅ QUAN TRỌNG: Giảm số tiền đã trả
        // Vì đã hoàn lại cho khách
        invoice.partial_payment_amount = Math.max(0, currentPaid - totalRefund);
        
        // ✅ Tăng công nợ (vì đã hoàn tiền)
        invoice.remaining_amount = currentRemaining + totalRefund;
        
        this.logger.log(
          `[Trả hàng ${returnCode}] Hóa đơn ${invoice.code}: ` +
          `Khách đã trả đủ → Tạo phiếu hoàn tiền ${refundCode}: ${totalRefund.toLocaleString()}đ, ` +
          `Đã trả mới: ${invoice.partial_payment_amount.toLocaleString()}đ, ` +
          `Công nợ mới: ${invoice.remaining_amount.toLocaleString()}đ`
        );
      }
      
      await queryRunner.manager.save(invoice);

      // 7. Cập nhật tồn kho (Tăng lại số lượng cho sản phẩm trả)
      for (const item of returnItems) {
        // Tìm batch tồn kho gần nhất của sản phẩm
        const inventoryBatch = await queryRunner.manager.findOne(
          InventoryBatch,
          {
            where: { product_id: item.product_id },
            order: { created_at: 'DESC' as any },
          },
        );

        if (inventoryBatch) {
          // Tăng số lượng tồn kho
          inventoryBatch.remaining_quantity += item.quantity;
          await queryRunner.manager.save(inventoryBatch);
          
          this.logger.log(
            `[Trả hàng ${returnCode}] Tăng tồn kho sản phẩm ID ${item.product_id}: +${item.quantity}`
          );
        } else {
          // Nếu không có batch, tạo batch mới từ hàng trả
          const newBatch = queryRunner.manager.create(InventoryBatch, {
            product_id: item.product_id,
            code: `RETURN-${returnCode}`,
            unit_cost_price: item.unit_price.toString(),
            original_quantity: item.quantity,
            remaining_quantity: item.quantity,
            notes: `Hàng trả từ phiếu ${returnCode}`,
          });
          await queryRunner.manager.save(newBatch);
          
          this.logger.log(
            `[Trả hàng ${returnCode}] Tạo batch mới cho sản phẩm ID ${item.product_id}: ${item.quantity}`
          );
        }
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
    const queryBuilder = this.salesReturnRepository.createQueryBuilder('sales_return');
    
    queryBuilder.leftJoinAndSelect('sales_return.invoice', 'invoice');
    queryBuilder.leftJoinAndSelect('sales_return.customer', 'customer');
    queryBuilder.leftJoinAndSelect('sales_return.items', 'items');
    queryBuilder.leftJoinAndSelect('sales_return.creator', 'creator');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'sales_return',
      ['code', 'customer.name', 'customer.phone'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'sales_return',
      ['filters', 'nested_filters', 'operator'],
      {
        customer_name: 'customer.name',
        customer_phone: 'customer.phone',
        invoice_code: 'invoice.code',
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
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `RF${year}${month}${day}${hours}${minutes}${seconds}${random}`;
  }

  /**
   * Sinh mã phiếu trả hàng tự động
   * Format: TR + YYYYMMDDHHmmssSSS
   */
  private generateReturnCode(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `TR${year}${month}${day}${hours}${minutes}${seconds}${random}`;
  }
}
