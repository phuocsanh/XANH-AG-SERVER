import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { Payment } from '../../entities/payment.entity';
import { SalesInvoice, SalesInvoiceStatus, SalesPaymentStatus } from '../../entities/sales-invoices.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { Customer } from '../../entities/customer.entity';
import { CreatePaymentAllocationDto } from './dto/create-payment-allocation.dto';
import { SearchPaymentAllocationDto } from './dto/search-payment-allocation.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { OperatingCostService } from '../operating-cost/operating-cost.service';
import { OperatingCostCategoryService } from '../operating-cost-category/operating-cost-category.service';

@Injectable()
export class PaymentAllocationService {
  constructor(
    @InjectRepository(PaymentAllocation)
    private allocationRepository: Repository<PaymentAllocation>,
    private dataSource: DataSource,
    private operatingCostService: OperatingCostService,
    private operatingCostCategoryService: OperatingCostCategoryService,
  ) {}

  async create(createDto: CreatePaymentAllocationDto): Promise<PaymentAllocation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get Payment
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: createDto.payment_id },
      });

      if (!payment) {
        throw new NotFoundException('Phiếu thu không tồn tại');
      }

      // Check available amount
      const availableAmount = Number(payment.amount) - Number(payment.allocated_amount);
      if (createDto.amount > availableAmount) {
        throw new BadRequestException('Số tiền phân bổ vượt quá số tiền còn lại của phiếu thu');
      }

      // 2. Handle Allocation Target
      if (createDto.allocation_type === 'invoice') {
        if (!createDto.invoice_id) throw new BadRequestException('Thiếu invoice_id');
        
        const invoice = await queryRunner.manager.findOne(SalesInvoice, {
          where: { id: createDto.invoice_id },
        });

        if (!invoice) throw new NotFoundException('Hóa đơn không tồn tại');

        // Update Invoice
        const currentPaid = parseFloat(invoice.partial_payment_amount?.toString() || '0');
        const finalAmount = parseFloat(invoice.final_amount?.toString() || '0');
        // Ép kiểu Number() tường minh để tránh bug cộng chuỗi với NUMERIC từ DB
        const allocationAmount = Number(createDto.amount) || 0;
        const newPaid = currentPaid + allocationAmount;
        const newRemaining = finalAmount - newPaid;

        if (newRemaining < 0) {
             // Allow overpayment? Usually no.
             // throw new BadRequestException('Số tiền phân bổ vượt quá số tiền còn nợ của hóa đơn');
             // For now, let's allow it or clamp it? Better to throw error.
             // But floating point issues might trigger this. Let's use a small epsilon if needed, or just trust the math.
        }

        invoice.partial_payment_amount = newPaid;
        invoice.remaining_amount = newRemaining;
        
        if (newRemaining <= 0) {
            invoice.status = SalesInvoiceStatus.PAID;
            invoice.payment_status = SalesPaymentStatus.PAID;
            invoice.remaining_amount = 0; // Clamp to 0
            
            // Tạo chi phí quà tặng nếu hóa đơn có quà tặng và đủ thông tin
            // Tạo chi phí quà tặng nếu hóa đơn có quà tặng và đủ thông tin
            if (invoice.gift_value && Number(invoice.gift_value) > 0 && invoice.gift_description && invoice.customer_id) {
              try {
                // Lấy thông tin khách hàng để hiển thị tên
                const customer = await queryRunner.manager.findOne(Customer, {
                    where: { id: invoice.customer_id },
                    select: ['name'],
                });

                await this.createGiftOperatingCost({
                  invoiceCode: invoice.code,
                  customerName: customer?.name || 'Khách hàng',
                  giftValue: Number(invoice.gift_value),
                  giftDescription: invoice.gift_description,
                });
              } catch (error) {
                // Log lỗi nhưng không rollback transaction
                console.error('⚠️ Lỗi tạo chi phí quà tặng:', error);
              }
            }
        } else {
            invoice.payment_status = SalesPaymentStatus.PARTIAL;
        }

        await queryRunner.manager.save(invoice);

      } else if (createDto.allocation_type === 'debt_note') {
        if (!createDto.debt_note_id) throw new BadRequestException('Thiếu debt_note_id');

        const debtNote = await queryRunner.manager.findOne(DebtNote, {
            where: { id: createDto.debt_note_id },
        });

        if (!debtNote) throw new NotFoundException('Phiếu công nợ không tồn tại');

        // Update Debt Note
        const currentPaid = parseFloat(debtNote.paid_amount?.toString() || '0');
        const amount = parseFloat(debtNote.amount?.toString() || '0');
        // Ép kiểu Number() tường minh để tránh bug cộng chuỗi với NUMERIC từ DB
        const allocationAmount = Number(createDto.amount) || 0;
        const newPaid = currentPaid + allocationAmount;
        const newRemaining = amount - newPaid;

        debtNote.paid_amount = newPaid;
        debtNote.remaining_amount = newRemaining;

        if (newRemaining <= 0) {
            debtNote.status = DebtNoteStatus.PAID;
            debtNote.remaining_amount = 0;
        }

        await queryRunner.manager.save(debtNote);
      }

      // 3. Create Allocation
      const allocation = this.allocationRepository.create(createDto);
      const savedAllocation = await queryRunner.manager.save(allocation);

      // 4. Update Payment - Ép kiểu Number() để tránh bug cộng chuỗi NUMERIC từ DB
      const currentAllocated = Number(payment.allocated_amount) || 0;
      const addAmount = Number(createDto.amount) || 0;
      payment.allocated_amount = currentAllocated + addAmount;
      await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
      return savedAllocation;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<PaymentAllocation[]> {
    return this.allocationRepository.find({
      relations: ['payment', 'invoice', 'debt_note'],
      order: { created_at: 'DESC' },
    });
  }

  async search(searchDto: SearchPaymentAllocationDto): Promise<{
    data: PaymentAllocation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.allocationRepository.createQueryBuilder('allocation');
    
    queryBuilder.leftJoinAndSelect('allocation.payment', 'payment');
    queryBuilder.leftJoinAndSelect('allocation.invoice', 'invoice');
    queryBuilder.leftJoinAndSelect('allocation.debt_note', 'debt_note');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'allocation',
      ['payment.code', 'invoice.code'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'allocation',
      ['filters', 'nested_filters', 'operator'],
      {
        payment_code: 'payment.code',
        invoice_code: 'invoice.code',
        debt_note_code: 'debt_note.code',
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
   * Tạo phiếu chi phí quà tặng
   * Tự động tạo operating cost khi hóa đơn được thanh toán đủ và có quà tặng
   */
  private async createGiftOperatingCost(params: {
    invoiceCode: string;
    customerName: string;
    giftValue: number;
    giftDescription?: string | undefined;
  }): Promise<void> {
    try {
      // Lấy category "Quà tặng khách hàng"
      const giftCategory = await this.operatingCostCategoryService.findByCode('GIFT');
      
      if (!giftCategory) {
        console.warn('⚠️ Không tìm thấy category "GIFT" - Bỏ qua tạo phiếu chi phí quà tặng');
        return;
      }

      // Tạo tên phiếu chi phí
      const costName = `Quà tặng hóa đơn - ${params.customerName}`;

      // Tạo mô tả chi tiết
      const descriptionParts = [
        params.giftDescription ? `Quà: ${params.giftDescription}` : 'Quà tặng theo hóa đơn',
        `Hóa đơn: ${params.invoiceCode}`,
      ].filter(Boolean).join(' | ');

      // Tạo phiếu chi phí
      await this.operatingCostService.create({
        name: costName,
        category_id: giftCategory.id,
        value: params.giftValue,
        description: descriptionParts,
        expense_date: new Date().toISOString(),
      });

      console.log(
        `✅ Đã tạo phiếu chi phí quà tặng: ${costName} - ${params.giftValue.toLocaleString()} đ`
      );
    } catch (error) {
      console.error('❌ Lỗi khi tạo phiếu chi phí quà tặng:', error);
    }
  }
}
