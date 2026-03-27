import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { SalesInvoice, SalesPaymentStatus } from '../../entities/sales-invoices.entity';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SearchPaymentDto } from './dto/search-payment.dto';
import { SettleDebtDto } from './dto/settle-debt.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentAllocation)
    private paymentAllocationRepository: Repository<PaymentAllocation>,
    private customerRewardService: CustomerRewardService,
  ) {}




  async findOne(id: number): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { id },
      relations: ['customer', 'allocations'],
    });
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto): Promise<Payment | null> {
    try {
      await this.paymentRepository.update(id, updatePaymentDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'phiếu thu');
    }
  }

  async remove(id: number): Promise<void> {
    await this.paymentRepository.delete(id);
  }

  /**
   * Lấy danh sách phân bổ thanh toán của một payment
   * @param paymentId - ID của payment
   * @returns Danh sách allocations với thông tin invoice hoặc debt_note
   */
  async getPaymentAllocations(paymentId: number) {
    const allocations = await this.paymentAllocationRepository.find({
      where: { payment_id: paymentId },
      relations: ['invoice', 'debt_note'],
      order: { id: 'ASC' },
    });

    return allocations.map(allocation => {
      const result: {
        id: number;
        allocation_type: 'invoice' | 'debt_note';
        amount: number;
        invoice?: { code: string };
        debt_note?: { code: string };
      } = {
        id: allocation.id,
        allocation_type: allocation.allocation_type,
        amount: allocation.amount,
      };

      // Thêm thông tin invoice nếu có
      if (allocation.invoice) {
        result.invoice = {
          code: allocation.invoice.code,
        };
      }

      // Thêm thông tin debt_note nếu có
      if (allocation.debt_note) {
        result.debt_note = {
          code: allocation.debt_note.code,
        };
      }

      return result;
    });
  }

  async search(searchDto: SearchPaymentDto): Promise<{
    data: Payment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.paymentRepository.createQueryBuilder('payment');
    
    // Join customer for searching
    queryBuilder.leftJoinAndSelect('payment.customer', 'customer');
    queryBuilder.leftJoin('payment.creator', 'creator')
      .addSelect(['creator.id', 'creator.account']);
    
    // 🔥 Lấy thêm tên khách hàng từ hóa đơn nếu khách vãng lai
    queryBuilder.leftJoin('payment.allocations', 'allocations')
      .leftJoin('allocations.invoice', 'invoice')
      .addSelect('MAX(invoice.customer_name)', 'payment_customer_name')
      .addGroupBy('payment.id')
      .addGroupBy('customer.id')
      .addGroupBy('creator.id');

    // ... (rest of search logic)
    
    // (Assuming line numbers shifted, I will find them)
    // Actually I'll do it in two steps for safety.

    // 1. Áp dụng Base Search (Sort, Page, Keyword)
    // Cho phép search keyword trên các field: code, debt_note_code, customer name/phone
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'payment',
      ['code', 'debt_note_code', 'customer.name', 'customer.phone']
    );

    // 2. Simple Filters & Guest Search logic
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'payment',
      ['filters', 'nested_filters', 'operator', 'customer_name', 'customer_phone'],
      {
        customer_phone: 'customer.phone',
      }
    );

    // ✅ Logic tìm kiếm khách hàng (chính thức & vãng lai qua invoice)
    if (searchDto.customer_name || searchDto.customer_phone) {
      const nameKeyword = searchDto.customer_name ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_name)}%` : null;
      const phoneKeyword = searchDto.customer_phone ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_phone)}%` : null;
      
      queryBuilder.andWhere(new Brackets(qb => {
        if (nameKeyword) {
          qb.orWhere(`regexp_replace(unaccent(customer.name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`, { nameKeyword });
          // Kiểm tra trong các hóa đơn đã thanh toán bởi phiếu này
          qb.orWhere(`EXISTS (
            SELECT 1 FROM payment_allocations pa
            JOIN sales_invoices si ON si.id = pa.invoice_id
            WHERE pa.payment_id = payment.id
            AND regexp_replace(unaccent(si.customer_name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)
          )`, { nameKeyword });
        }
        
        if (phoneKeyword) {
          qb.orWhere(`customer.phone ILIKE :phoneKeyword`, { phoneKeyword });
          qb.orWhere(`EXISTS (
            SELECT 1 FROM payment_allocations pa
            JOIN sales_invoices si ON si.id = pa.invoice_id
            WHERE pa.payment_id = payment.id
            AND si.customer_phone ILIKE :phoneKeyword
          )`, { phoneKeyword });
        }
      }));
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    // 🔥 Gắn thêm customer_name từ row data cho khách vãng lai
    const rawData = await queryBuilder.getRawMany();
    
    const data = items.map(item => {
      const raw = rawData.find(r => r.payment_id === item.id);
      if (!item.customer && raw && raw.payment_customer_name) {
        (item as any).customer_name = raw.payment_customer_name;
      }
      return item;
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }


  /**
   * Chốt sổ công nợ
   * @param dto - Dữ liệu chốt sổ
   * @param userId - ID của user đang thực hiện (từ JWT token)
   */
  async settleDebt(dto: SettleDebtDto, userId: number): Promise<{
    payment: Payment;
    settled_invoices: SalesInvoice[];
    total_debt: number;
    remaining_debt: number;
    breakdown_by_rice_crop: any[];
    gift_description?: string | undefined;
    gift_value: number;
    reward_summary?: any;
  }> {
    const queryRunner = this.paymentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lấy tất cả hóa đơn chưa thanh toán
      const unpaidInvoices = await queryRunner.manager
        .createQueryBuilder(SalesInvoice, 'si')
        .leftJoinAndSelect('si.rice_crop', 'rice_crop')
        .where('si.customer_id = :customerId', { customerId: dto.customer_id })
        .andWhere('si.season_id = :seasonId', { seasonId: dto.season_id })
        .andWhere('si.status != :cancelledStatus', { cancelledStatus: 'cancelled' })
        .andWhere('si.remaining_amount > 0')
        .orderBy('si.created_at', 'ASC')
        .setLock('pessimistic_write', undefined, ['si']) // Chỉ khóa bảng hóa đơn để tránh lỗi "nullable side of an outer join"
        .getMany();

      if (unpaidInvoices.length === 0) {
        throw new Error('Không có hóa đơn nợ nào để chốt sổ');
      }

      // 2. Tính tổng nợ
      const totalDebt = unpaidInvoices.reduce(
        (sum, inv) => sum + Number(inv.remaining_amount),
        0,
      );

      // 3. Tạo breakdown (giữ nguyên logic view)
      const riceCropMap = new Map<number | null, any>();
      unpaidInvoices.forEach(invoice => {
        const riceCropId = invoice.rice_crop_id || null;
        if (!riceCropMap.has(riceCropId)) {
          riceCropMap.set(riceCropId, {
            rice_crop_id: riceCropId,
            field_name: invoice.rice_crop?.field_name || 'Không thuộc vụ lúa nào',
            invoice_count: 0,
            total_debt: 0,
            invoices: [],
          });
        }
        const cropData = riceCropMap.get(riceCropId)!;
        cropData.invoice_count++;
        cropData.total_debt += Number(invoice.remaining_amount);
        cropData.invoices.push({
          id: invoice.id,
          code: invoice.code,
          amount: invoice.final_amount,
          remaining_amount: Number(invoice.remaining_amount),
        });
      });

      // 4. Tìm phiếu công nợ (LOCK)
      // Chấp nhận cả trạng thái SETTLED vì người dùng có thể thanh toán sau khi đã chốt sổ tích lũy
      const oldDebtNote = await queryRunner.manager
        .createQueryBuilder(DebtNote, 'dn')
        .where('dn.customer_id = :customer_id', { customer_id: dto.customer_id })
        .andWhere('dn.season_id = :season_id', { season_id: dto.season_id })
        .leftJoinAndSelect('dn.season', 'season')
        .andWhere('dn.status IN (:...statuses)', { 
          statuses: [DebtNoteStatus.ACTIVE, DebtNoteStatus.OVERDUE, DebtNoteStatus.SETTLED] 
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!oldDebtNote) {
        throw new Error('Không tìm thấy phiếu công nợ cho mùa vụ này');
      }

      // 5. Tạo Payment record
      const paymentCode = CodeGeneratorHelper.generateUniqueCode('PAY');
      const payment = queryRunner.manager.create(Payment, {
        code: paymentCode,
        customer_id: dto.customer_id,
        amount: dto.amount,
        payment_date: dto.payment_date || new Date().toISOString(),
        payment_method: dto.payment_method,
        notes: dto.notes || `Chốt sổ công nợ mùa vụ #${dto.season_id}`,
        created_by: userId,
        debt_note_code: oldDebtNote.code,
      });
      const savedPayment = await queryRunner.manager.save(payment);

      // 6. Phân bổ thanh toán cho các hóa đơn
      let remainingPayment = dto.amount;
      const settledInvoices: SalesInvoice[] = [];

      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) break;

        const invoiceDebt = Number(invoice.remaining_amount);
        const amountToAllocate = Math.min(remainingPayment, invoiceDebt);

        // Tạo PaymentAllocation thông qua manager
        await queryRunner.manager.save(PaymentAllocation, {
          payment_id: savedPayment.id,
          invoice_id: invoice.id,
          allocation_type: 'invoice',
          amount: amountToAllocate,
        });

        // Cập nhật hóa đơn
        invoice.partial_payment_amount = Number(invoice.partial_payment_amount || 0) + amountToAllocate;
        invoice.remaining_amount = invoiceDebt - amountToAllocate;
        if (invoice.remaining_amount <= 0) {
          invoice.payment_status = SalesPaymentStatus.PAID;
        }
        await queryRunner.manager.save(invoice);
        
        settledInvoices.push(invoice);
        remainingPayment -= amountToAllocate;
      }

      // 7. Cập nhật số tiền đã trả và còn nợ trên phiếu công nợ
      const currentPaidDebt = Number(oldDebtNote.paid_amount) || 0;
      const paymentAmount = Number(dto.amount) || 0;
      oldDebtNote.paid_amount = currentPaidDebt + paymentAmount;
      oldDebtNote.remaining_amount = totalDebt - paymentAmount;

      // 🔥 CHẾ ĐỘ MỚI: Chỉ dùng Nợ (active) và Đã thanh toán (paid)
      // Khi nợ <= 0, ta chuyển sang trạng thái Đã thanh toán. 
      const isPaidOff = Number(oldDebtNote.remaining_amount) <= 0;
      if (isPaidOff) {
        oldDebtNote.status = DebtNoteStatus.PAID;
        oldDebtNote.closed_at = new Date();
      } else if (oldDebtNote.status !== DebtNoteStatus.PAID) {
        oldDebtNote.status = DebtNoteStatus.ACTIVE;
      }

      // 8. Xử lý tích lũy và quà tặng (Được gọi mỗi lần thanh toán)
      let rewardSummary: any = null;
      if (dto.gift_description || (dto.gift_value && dto.gift_value > 0) || paymentAmount > 0 || isPaidOff) {
        rewardSummary = await this.customerRewardService.handleDebtNoteSettlement(
          queryRunner.manager,
          oldDebtNote,
          {
            gift_description: dto.gift_description,
            gift_value: dto.gift_value || 0,
            rice_crop_id: dto.rice_crop_id, // ✅ Lưu thông tin ruộng lúa
            notes: dto.notes ? dto.notes : (isPaidOff 
              ? `Tất toán nợ & tặng quà tại phiếu #${paymentCode}` 
              : `Tích lũy khi thanh toán #${paymentCode}`),
            manual_remaining_amount: oldDebtNote.remaining_amount,
            payment_amount: paymentAmount,
          },
          userId,
          isPaidOff // Coi như "Finalized" nếu đã trả hết nợ
        );
      }

      
      await queryRunner.manager.save(oldDebtNote);

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Chốt sổ thành công cho đơn PAY #${paymentCode}`);

      return {
        payment: savedPayment,
        settled_invoices: settledInvoices,
        total_debt: totalDebt,
        remaining_debt: oldDebtNote.remaining_amount,
        breakdown_by_rice_crop: Array.from(riceCropMap.values()),
        gift_description: dto.gift_description,
        gift_value: dto.gift_value || 0,
        reward_summary: rewardSummary,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Lỗi khi chốt sổ công nợ:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }


  /**
   * Rollback payment (hoàn tác thanh toán)
   * Dùng khi nhập sai, cần sửa lại
   * 
   * @param paymentId - ID của payment cần rollback
   * @returns Thông tin rollback
   */
  async rollbackPayment(paymentId: number): Promise<{
    success: boolean;
    message: string;
    payment: Payment;
    affected_invoices: number;
    affected_debt_note: DebtNote | null;
  }> {
    const queryRunner = this.paymentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Lấy thông tin payment
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: paymentId },
        relations: ['customer']
      });

      if (!payment) {
        await queryRunner.release();
        throw new Error(`Payment #${paymentId} không tồn tại`);
      }

      // 2. Lấy allocations và khóa invoices
      const allocations = await queryRunner.manager.find(PaymentAllocation, {
        where: { payment_id: paymentId },
        relations: ['invoice']
      });

      this.logger.log(`🔄 Bắt đầu rollback payment #${payment.code}...`);

      // 3. Hoàn tác từng invoice
      let affectedInvoiceCount = 0;
      for (const allocation of allocations) {
        if (!allocation.invoice || !allocation.invoice_id) continue;

        // Khóa invoice để cập nhật
        const invoice = await queryRunner.manager.findOne(SalesInvoice, {
          where: { id: allocation.invoice_id },
          lock: { mode: 'pessimistic_write' }
        });

        if (invoice) {
          const allocationAmount = Number(allocation.amount) || 0;
          invoice.partial_payment_amount = (Number(invoice.partial_payment_amount) || 0) - allocationAmount;
          invoice.remaining_amount = (Number(invoice.remaining_amount) || 0) + allocationAmount;

          if (invoice.remaining_amount > 0) {
            invoice.payment_status = invoice.partial_payment_amount > 0 ? SalesPaymentStatus.PARTIAL : SalesPaymentStatus.PENDING;
          } else {
            invoice.payment_status = SalesPaymentStatus.PAID;
          }

          await queryRunner.manager.save(invoice);
          affectedInvoiceCount++;
          this.logger.log(`  ↩️  Invoice #${invoice.code}: +${allocationAmount.toLocaleString()} đ`);
        }
      }

      // 4. Cập nhật debt_note
      let affectedDebtNote: DebtNote | null = null;
      const firstAllocation = allocations[0];
      if (firstAllocation?.invoice) {
        const firstInvoice = firstAllocation.invoice;
        if (firstInvoice.customer_id && firstInvoice.season_id) {
          const debtNote = await queryRunner.manager.findOne(DebtNote, {
            where: { 
              customer_id: firstInvoice.customer_id,
              season_id: firstInvoice.season_id
            },
            lock: { mode: 'pessimistic_write' }
          });

          if (debtNote) {
            const paymentAmountToReturn = Number(payment.amount) || 0;
            debtNote.paid_amount = Math.max(0, (Number(debtNote.paid_amount) || 0) - paymentAmountToReturn);
            debtNote.remaining_amount = Math.max(0, (Number(debtNote.amount) || 0) - debtNote.paid_amount);

            if (debtNote.remaining_amount > 0) {
              debtNote.status = DebtNoteStatus.ACTIVE;
            }
            await queryRunner.manager.save(debtNote);
            affectedDebtNote = debtNote;
            this.logger.log(`  ↩️  DebtNote #${debtNote.code}: +${paymentAmountToReturn.toLocaleString()} đ`);

            // 🔥 THU HỒI ĐIỂM TÍCH LŨY KHI ROLLBACK PAYMENT
            await this.customerRewardService.handleDebtNoteSettlement(
              queryRunner.manager,
              debtNote,
              {
                payment_amount: -paymentAmountToReturn, // Số âm để trừ điểm
                notes: `Thu hồi điểm do rollback phiếu thu #${payment.code}`,
              },
              payment.created_by || 0,
              false
            );
          }
        }
      }

      // 5. Xóa allocations và payment
      await queryRunner.manager.delete(PaymentAllocation, { payment_id: paymentId });
      await queryRunner.manager.delete(Payment, paymentId);

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Rollback thành công payment #${payment.code}`);

      return {
        success: true,
        message: `Đã rollback payment #${payment.code}. Hoàn trả ${payment.amount.toLocaleString()} đ vào công nợ.`,
        payment,
        affected_invoices: affectedInvoiceCount,
        affected_debt_note: affectedDebtNote,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi rollback payment #${paymentId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

}
