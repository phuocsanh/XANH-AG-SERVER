import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, EntityManager, In } from 'typeorm';
import { createHash } from 'crypto';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { Loan, LoanStatus } from '../../entities/loan.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import {
  SalesInvoice,
  SalesInvoiceStatus,
  SalesPaymentStatus,
} from '../../entities/sales-invoices.entity';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SearchPaymentDto } from './dto/search-payment.dto';
import { SettleDebtDto } from './dto/settle-debt.dto';
import { RollbackPaymentDto } from './dto/rollback-payment.dto';
import { SearchPaymentRollbackHistoryDto } from './dto/search-payment-rollback-history.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { DebtNoteClosure, DebtNoteClosureStatus } from '../../entities/debt-note-closure.entity';
import { roundRewardMoney } from '../customer-reward/invoice-reward-accumulation';
import {
  PaymentRollbackHistory,
  PaymentRollbackKind,
} from '../../entities/payment-rollback-history.entity';
import {
  CustomerRewardResetHistory,
  CustomerRewardResetStatus,
} from '../../entities/customer-reward-reset-history.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { SalesReturn, SalesReturnStatus } from '../../entities/sales-return.entity';
import { Customer } from '../../entities/customer.entity';

/** Lỗi chặn hoàn tác, mã lỗi dùng cho UI hiển thị lý do. */
export interface RollbackBlocker {
  code: string;
  message: string;
}

/** Một hóa đơn sẽ được khôi phục dư nợ khi hoàn tác. */
export interface RollbackInvoiceChange {
  invoice: SalesInvoice;
  restore_amount: number;
  snapshot: Record<string, any>;
}

/** Một phiếu công nợ sẽ được trừ lại số đã thu. */
export interface RollbackDebtNoteChange {
  debtNote: DebtNote;
  amount: number;
  before: Record<string, any>;
}

/** Kế hoạch hoàn tác dùng chung cho cả xem trước và thực thi. */
export interface RollbackPlan {
  kind: PaymentRollbackKind;
  blockers: RollbackBlocker[];
  warnings: string[];
  loan: { entity: Loan; before: Record<string, any> } | null;
  invoice_changes: RollbackInvoiceChange[];
  debt_note_changes: RollbackDebtNoteChange[];
  allocation_snapshots: Record<string, any>[];
  accumulation: {
    delta: number; pending_before: number; pending_after: number;
    total_before: number; total_after: number;
  } | null;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentAllocation)
    private paymentAllocationRepository: Repository<PaymentAllocation>,
    @InjectRepository(PaymentRollbackHistory)
    private rollbackHistoryRepository: Repository<PaymentRollbackHistory>,
    private customerRewardService: CustomerRewardService,
  ) {}




  async findOne(id: number): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { id },
      relations: ['customer', 'allocations'],
    });
  }

  /**
   * Cập nhật thông tin phiếu thu (ghi chú, ngày thu, hình thức).
   * Không cho sửa số tiền/phân bổ vì sẽ làm lệch công nợ và tích lũy;
   * muốn sửa số tiền phải hoàn tác phiếu và thu lại.
   */
  async update(id: number, updatePaymentDto: UpdatePaymentDto): Promise<Payment | null> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`Phiếu thu #${id} không tồn tại`);
    }
    const dto = updatePaymentDto as UpdatePaymentDto & {
      amount?: number;
      allocated_amount?: number;
      customer_id?: number;
    };
    if (dto.amount !== undefined || dto.allocated_amount !== undefined || dto.customer_id !== undefined) {
      throw new BadRequestException(
        'Không thể sửa số tiền, số đã phân bổ hoặc khách hàng của phiếu thu. Hãy hoàn tác phiếu thu và tạo lại.',
      );
    }
    try {
      await this.paymentRepository.update(id, updatePaymentDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'phiếu thu');
    }
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

    // Bổ sung cờ hoàn tác cho UI (không chặn thay đổi dữ liệu).
    await this.annotateRollbackEligibility(data);

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
        .addOrderBy('si.id', 'ASC')
        .setLock('pessimistic_write', undefined, ['si']) // Chỉ khóa bảng hóa đơn để tránh lỗi "nullable side of an outer join"
        .getMany();

      if (unpaidInvoices.length === 0) {
        throw new Error('Không có hóa đơn nợ nào để chốt sổ');
      }

      // 2. Tính tổng nợ
      const totalDebt = roundRewardMoney(unpaidInvoices.reduce(
        (sum, inv) => sum + Number(inv.remaining_amount),
        0,
      ));
      dto.amount = roundRewardMoney(Number(dto.amount));
      if (!Number.isFinite(dto.amount) || dto.amount <= 0 || dto.amount > totalDebt) {
        throw new BadRequestException('Số tiền thu phải lớn hơn 0 và không vượt tổng nợ hóa đơn');
      }

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
        .setLock('pessimistic_write', undefined, ['dn'])
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
        allocated_amount: dto.amount,
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
          debt_note_id: oldDebtNote.id,
          allocation_type: 'invoice',
          amount: amountToAllocate,
        });

        // Cập nhật hóa đơn
        invoice.partial_payment_amount = roundRewardMoney(Number(invoice.partial_payment_amount || 0) + amountToAllocate);
        invoice.remaining_amount = roundRewardMoney(invoiceDebt - amountToAllocate);
        if (invoice.remaining_amount <= 0) {
          invoice.payment_status = SalesPaymentStatus.PAID;
          invoice.status = SalesInvoiceStatus.PAID;
          invoice.remaining_amount = 0;
        } else if (Number(invoice.partial_payment_amount || 0) > 0) {
          invoice.payment_status = SalesPaymentStatus.PARTIAL;
          invoice.status = SalesInvoiceStatus.CONFIRMED;
        } else {
          invoice.payment_status = SalesPaymentStatus.PENDING;
          invoice.status = SalesInvoiceStatus.CONFIRMED;
        }
        await queryRunner.manager.save(invoice);
        
        settledInvoices.push(invoice);
        remainingPayment = roundRewardMoney(remainingPayment - amountToAllocate);
      }

      // 7. Cập nhật số tiền đã trả và còn nợ trên phiếu công nợ
      const currentPaidDebt = Number(oldDebtNote.paid_amount) || 0;
      const paymentAmount = Number(dto.amount) || 0;
      oldDebtNote.paid_amount = roundRewardMoney(currentPaidDebt + paymentAmount);
      oldDebtNote.remaining_amount = roundRewardMoney(totalDebt - paymentAmount);

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
            gift_status: dto.gift_status, // ✅ Lưu trạng thái quà tặng
            notes: dto.notes ? dto.notes : (isPaidOff 
              ? `Tất toán nợ & tặng quà tại phiếu #${paymentCode}` 
              : `Tích lũy khi thanh toán #${paymentCode}`),
            manual_remaining_amount: oldDebtNote.remaining_amount,
            payment_amount: paymentAmount,
            invoice_ids: settledInvoices.map((invoice) => invoice.id),
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
   * Hoàn tác phiếu thu trong một transaction.
   * - Phiếu công nợ/hóa đơn: khôi phục dư nợ hóa đơn, phiếu công nợ và tích lũy.
   * - Phiếu trả vay: mở lại khoản vay, không chạm hóa đơn/công nợ/tích lũy.
   * Luôn ghi `payment_rollback_history` trước khi xóa phiếu thu gốc.
   */
  async rollbackPayment(paymentId: number, dto: RollbackPaymentDto, userId: number) {
    const reason = (dto?.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('Vui lòng nhập lý do hoàn tác phiếu thu');
    }

    const queryRunner = this.paymentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Khóa phiếu thu; phiếu đã bị xóa thì trả 404 thay vì lỗi hệ thống.
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        const rolledBack = await this.rollbackHistoryRepository.findOne({
          where: { payment_id: paymentId },
        });
        if (rolledBack) {
          throw new ConflictException(
            `Phiếu thu ${rolledBack.payment_code} đã được hoàn tác trước đó (${new Date(
              rolledBack.rolled_back_at,
            ).toLocaleString('vi-VN')}). Không thể hoàn tác lần hai.`,
          );
        }
        throw new NotFoundException(`Phiếu thu #${paymentId} không tồn tại`);
      }

      // 2. Dựng kế hoạch hoàn tác và chặn toàn bộ trước khi ghi bất cứ dữ liệu nào.
      const plan = await this.buildRollbackPlan(queryRunner.manager, payment, true);
      this.assertNoBlockers(plan.blockers);
      if (dto.preview_token && dto.preview_token !== this.buildRollbackPreviewToken(payment, plan)) {
        throw new ConflictException('Dữ liệu đã thay đổi sau khi xem trước. Vui lòng tải lại và xác nhận lại.');
      }

      const invoiceRestores = plan.invoice_changes.map((change) => ({
        invoice_id: change.invoice.id,
        invoice_code: change.invoice.code,
        restore_amount: change.restore_amount,
      }));

      // 3. Nhánh phiếu trả vay: mở lại khoản vay, không chạm hóa đơn/công nợ/tích lũy.
      if (plan.kind === 'loan' && plan.loan) {
        const loan = plan.loan.entity;
        loan.loan_days = 0;
        loan.interest_amount = 0;
        loan.total_amount = Number(loan.principal_amount) || 0;
        loan.paid_amount = 0;
        loan.remaining_amount = Number(loan.principal_amount) || 0;
        loan.status = LoanStatus.ACTIVE;
        loan.repayment_date = null;
        loan.settled_by = null;
        loan.payment_id = null;
        await queryRunner.manager.save(loan);

        await queryRunner.manager.delete(PaymentAllocation, { payment_id: paymentId });
        await this.saveRollbackHistory(queryRunner.manager, payment, {
          reason,
          userId,
          kind: 'loan',
          loanCode: loan.code,
          loanSnapshot: { before: plan.loan.before, after: this.buildLoanSnapshot(loan) },
          allocationsSnapshot: plan.allocation_snapshots,
        });
        await queryRunner.manager.delete(Payment, paymentId);

        await queryRunner.commitTransaction();
        this.logger.log(`✅ Hoàn tác phiếu trả vay #${payment.code} bởi user #${userId}`);

        return {
          success: true,
          message: `Đã hoàn tác phiếu thu trả vay ${payment.code}. Khoản vay ${loan.code} đã chuyển về đang vay.`,
          payment: this.buildPaymentSnapshot(payment),
          payment_code: payment.code,
          payment_kind: plan.kind,
          affected_invoices: 0,
          affected_debt_notes: 0,
          invoice_restores: [],
          debt_notes: [],
          accumulation: null,
          warnings: plan.warnings,
        };
      }


      // 4. Khôi phục từng hóa đơn và đồng bộ tích lũy (idempotent theo tracking hóa đơn).
      for (const change of plan.invoice_changes) {
        const invoice = change.invoice;
        invoice.partial_payment_amount = roundRewardMoney(
          Math.max(0, Number(invoice.partial_payment_amount || 0) - change.restore_amount),
        );
        invoice.remaining_amount = roundRewardMoney(
          Math.max(0, Number(invoice.final_amount || 0) - invoice.partial_payment_amount),
        );
        invoice.status = invoice.remaining_amount > 0
          ? SalesInvoiceStatus.CONFIRMED
          : SalesInvoiceStatus.PAID;
        invoice.payment_status = invoice.remaining_amount <= 0
          ? SalesPaymentStatus.PAID
          : invoice.partial_payment_amount > 0
            ? SalesPaymentStatus.PARTIAL
            : SalesPaymentStatus.PENDING;
        await queryRunner.manager.save(invoice);
        await this.customerRewardService.syncInvoiceReward(queryRunner.manager, invoice.id);
      }

      // 5. Khôi phục phiếu công nợ: trạng thái mở theo hạn trả, xóa ngày tất toán.
      const debtNotesSnapshot: Record<string, any>[] = [];
      for (const change of plan.debt_note_changes) {
        const debtNote = change.debtNote;
        debtNote.paid_amount = roundRewardMoney(
          Math.max(0, Number(debtNote.paid_amount || 0) - change.amount),
        );
        debtNote.remaining_amount = roundRewardMoney(
          Math.max(0, Number(debtNote.amount || 0) - debtNote.paid_amount),
        );
        if (debtNote.remaining_amount > 0) {
          debtNote.status = this.resolveDebtNoteOpenStatus(debtNote);
          debtNote.closed_at = null;
        } else {
          debtNote.status = DebtNoteStatus.PAID;
          debtNote.closed_at = debtNote.closed_at || new Date();
        }
        await queryRunner.manager.save(debtNote);
        debtNotesSnapshot.push({
          ...change.before,
          debt_note_id: debtNote.id,
          debt_note_code: debtNote.code,
          paid_after: Number(debtNote.paid_amount),
          remaining_after: Number(debtNote.remaining_amount),
          status_after: debtNote.status,
          closed_at_after: debtNote.closed_at ?? null,
        });
      }

      // 6. Xóa phân bổ + phiếu thu, ghi lưu vết trước khi xóa.
      await queryRunner.manager.delete(PaymentAllocation, { payment_id: paymentId });
      await this.saveRollbackHistory(queryRunner.manager, payment, {
        reason,
        userId,
        kind: plan.kind,
        allocationsSnapshot: plan.allocation_snapshots.map((allocation) => ({
          ...allocation,
          ...plan.invoice_changes.find((change) => change.invoice.id === allocation.invoice_id)?.snapshot,
        })),
        debtNotesSnapshot,
        accumulationSnapshot: plan.accumulation
          ? {
            pending_before: plan.accumulation.pending_before,
            pending_after: plan.accumulation.pending_after,
            delta: plan.accumulation.delta,
            total_before: plan.accumulation.total_before,
            total_after: plan.accumulation.total_after,
          }
          : null,
      });
      await queryRunner.manager.delete(Payment, paymentId);

      await queryRunner.commitTransaction();
      this.logger.log(
        `✅ Hoàn tác phiếu thu #${payment.code} (${invoiceRestores.length} hóa đơn) bởi user #${userId}`,
      );

      return {
        success: true,
        message: `Đã hoàn tác phiếu thu ${payment.code}. Khôi phục ${Number(payment.amount || 0).toLocaleString('vi-VN')} đ vào công nợ.`,
        payment: this.buildPaymentSnapshot(payment),
        payment_code: payment.code,
        payment_kind: plan.kind,
        affected_invoices: invoiceRestores.length,
        affected_debt_notes: debtNotesSnapshot.length,
        invoice_restores: invoiceRestores,
        debt_notes: debtNotesSnapshot,
        accumulation: plan.accumulation,
        warnings: plan.warnings,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Lỗi khi hoàn tác phiếu thu #${paymentId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }


  /**
   * Xem trước ảnh hưởng của việc hoàn tác (chỉ đọc, không khóa, không ghi dữ liệu).
   * Dùng cho UI hiển thị hóa đơn/công nợ/tích lũy sẽ thay đổi và lý do bị chặn.
   */
  async getRollbackPreview(paymentId: number) {
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException(`Phiếu thu #${paymentId} không tồn tại hoặc đã được hoàn tác`);
    }
    const plan = await this.buildRollbackPlan(this.paymentRepository.manager, payment, false);

    return {
      payment_id: payment.id,
      preview_token: this.buildRollbackPreviewToken(payment, plan),
      payment_code: payment.code,
      amount: Number(payment.amount),
      customer_id: payment.customer_id ?? null,
      can_rollback: plan.blockers.length === 0,
      payment_kind: plan.kind,
      blockers: plan.blockers,
      warnings: plan.warnings,
      invoice_restores: plan.invoice_changes.map((change) => ({
        invoice_id: change.invoice.id,
        invoice_code: change.invoice.code,
        restore_amount: change.restore_amount,
        partial_before: change.snapshot.partial_payment_amount_before,
        partial_after: change.snapshot.partial_payment_amount_after,
        remaining_before: change.snapshot.remaining_amount_before,
        remaining_after: change.snapshot.remaining_amount_after,
      })),
      debt_notes: plan.debt_note_changes.map((change) => {
        const debtNote = change.debtNote;
        const paidAfter = roundRewardMoney(Math.max(0, Number(debtNote.paid_amount || 0) - change.amount));
        const remainingAfter = roundRewardMoney(Math.max(0, Number(debtNote.amount || 0) - paidAfter));
        return {
          debt_note_id: debtNote.id,
          debt_note_code: debtNote.code,
          amount: change.amount,
          paid_before: change.before.paid_amount_before,
          paid_after: paidAfter,
          remaining_before: change.before.remaining_amount_before,
          remaining_after: remainingAfter,
          status_before: change.before.status_before,
          status_after: remainingAfter > 0
            ? this.resolveDebtNoteOpenStatus(debtNote)
            : DebtNoteStatus.PAID,
          closed_at_before: change.before.closed_at_before ?? null,
        };
      }),
      accumulation: plan.accumulation,
      loan: plan.loan
        ? {
          loan_id: plan.loan.entity.id,
          loan_code: plan.loan.entity.code,
          principal_amount: Number(plan.loan.entity.principal_amount || 0),
          status_after: LoanStatus.ACTIVE,
        }
        : null,
    };
  }

  /**
   * Dựng kế hoạch hoàn tác: kiểm tra toàn bộ điều kiện và tính sẵn các thay đổi.
   * Preview dùng lock=false (chỉ đọc); hoàn tác thật dùng lock=true trong transaction.
   */
  private async buildRollbackPlan(
    manager: EntityManager,
    payment: Payment,
    lock: boolean,
  ): Promise<RollbackPlan> {
    const blockers: RollbackBlocker[] = [];
    const warnings: string[] = [];
    const lockOption = lock ? { lock: { mode: 'pessimistic_write' as const } } : {};
    const paymentAmount = roundRewardMoney(Number(payment.amount || 0));

    const allocations = await manager.find(PaymentAllocation, {
      where: { payment_id: payment.id },
      order: { invoice_id: 'ASC', id: 'ASC' },
    });
    const allocationSnapshots = allocations.map((allocation) => ({
      allocation_id: allocation.id,
      allocation_type: allocation.allocation_type,
      invoice_id: allocation.invoice_id ?? null,
      debt_note_id: allocation.debt_note_id ?? null,
      sales_return_id: allocation.sales_return_id ?? null,
      amount: Number(allocation.amount || 0),
    }));

    // Nhánh phiếu trả vay: chỉ mở lại khoản vay, không có hóa đơn/công nợ/tích lũy.
    const loans = await manager.find(Loan, {
      where: { payment_id: payment.id }, order: { id: 'ASC' }, ...lockOption,
    });
    const loan = loans[0];
    if (loan) {
      if (loans.length !== 1 || allocations.length || loan.status !== LoanStatus.PAID ||
        loan.customer_id !== payment.customer_id || !Number.isFinite(paymentAmount) || paymentAmount <= 0 ||
        roundRewardMoney(Number(loan.paid_amount)) !== paymentAmount ||
        roundRewardMoney(Number(loan.total_amount)) !== paymentAmount ||
        roundRewardMoney(Number(payment.allocated_amount)) !== paymentAmount) {
        blockers.push({ code: 'loan_payment_mismatch',
          message: 'Phiếu trả vay có liên kết hoặc số tiền không khớp; cần đối soát trước khi hoàn tác.' });
      }
      return {
        kind: 'loan',
        blockers,
        warnings: [
          'Phiếu thu này là phiếu trả vay: hoàn tác sẽ mở lại khoản vay, không thay đổi hóa đơn, công nợ hay tích lũy.',
        ],
        loan: { entity: loan, before: this.buildLoanSnapshot(loan) },
        invoice_changes: [],
        debt_note_changes: [],
        allocation_snapshots: allocationSnapshots,
        accumulation: null,
      };
    }


    // Chặn các trường hợp chắc chắn không thể hoàn tác an toàn.
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      blockers.push({
        code: 'invalid_amount',
        message: 'Phiếu thu có số tiền không hợp lệ, không thể hoàn tác.',
      });
    }
    if (!allocations.length) {
      blockers.push({
        code: 'no_allocation',
        message: 'Phiếu thu chưa có phân bổ hóa đơn/công nợ. Cần đối soát chứng từ trước khi hoàn tác.',
      });
    }
    if (allocations.some((allocation) => allocation.sales_return_id)) {
      blockers.push({
        code: 'sales_return_allocation',
        message: 'Phiếu hoàn tiền/trả hàng phải được hoàn tác qua chứng từ trả hàng gốc.',
      });
    }
    const allocatedSum = roundRewardMoney(
      allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0),
    );
    if (allocations.length && (!Number.isFinite(allocatedSum) || allocatedSum !== paymentAmount)) {
      blockers.push({
        code: 'allocation_mismatch',
        message: `Tổng phân bổ (${allocatedSum.toLocaleString('vi-VN')} đ) không khớp số tiền phiếu thu (${paymentAmount.toLocaleString('vi-VN')} đ). Cần đối soát trước khi hoàn tác.`,
      });
    }

    const invoiceChanges: RollbackInvoiceChange[] = [];
    // Số tiền cần trừ lại theo từng phiếu công nợ (một phiếu thu có thể phân bổ nhiều nơi).
    const debtNoteAmounts = new Map<number, number>();
    const debtNoteIds = new Set<number>();
    const invoiceIds: number[] = [];

    // Gom theo hóa đơn trước khi đọc/khóa; mỗi hóa đơn chỉ tính, lưu và đồng bộ tích lũy một lần.
    const allocationsByInvoice = new Map<number, PaymentAllocation[]>();
    const groups: PaymentAllocation[][] = [];
    for (const allocation of allocations) {
      if (!Number.isFinite(Number(allocation.amount)) || Number(allocation.amount) <= 0) {
        blockers.push({
          code: 'allocation_invalid_amount',
          message: `Phân bổ #${allocation.id} có số tiền không hợp lệ.`,
        });
        continue;
      }
      if (allocation.invoice_id) {
        if (allocation.allocation_type !== 'invoice') {
          blockers.push({ code: 'allocation_type_mismatch', message: `Phân bổ #${allocation.id} sai loại chứng từ.` });
        }
        const group = allocationsByInvoice.get(allocation.invoice_id) || [];
        group.push(allocation);
        allocationsByInvoice.set(allocation.invoice_id, group);
      } else {
        groups.push([allocation]);
      }
    }
    groups.unshift(...[...allocationsByInvoice.entries()].sort(([a], [b]) => a - b).map(([, group]) => group));
    for (const group of groups) {
      const allocation = group.find((item) => item.debt_note_id) || group[0]!;
      const amount = roundRewardMoney(group.reduce((sum, item) => sum + Number(item.amount), 0));
      if (new Set(group.map((item) => item.debt_note_id).filter(Boolean)).size > 1) {
        blockers.push({ code: 'invoice_debt_note_mismatch', message: `Hóa đơn #${allocation.invoice_id} được phân bổ vào nhiều phiếu nợ khác nhau; cần đối soát.` });
        continue;
      }

      if (allocation.invoice_id) {
        const invoice = await manager.findOne(SalesInvoice, {
          where: { id: allocation.invoice_id },
          ...lockOption,
        });
        if (!invoice) {
          blockers.push({
            code: 'invoice_missing',
            message: `Không tìm thấy hóa đơn #${allocation.invoice_id} của phân bổ #${allocation.id}.`,
          });
          continue;
        }
        if ((invoice.customer_id ?? null) !== (payment.customer_id ?? null)) {
          blockers.push({ code: 'invoice_customer_mismatch',
            message: `Hóa đơn ${invoice.code} không còn thuộc khách hàng của phiếu thu; cần đối soát.` });
          continue;
        }

        const partialBefore = roundRewardMoney(Number(invoice.partial_payment_amount || 0));
        const remainingBefore = roundRewardMoney(Number(invoice.remaining_amount || 0));
        const finalAmount = roundRewardMoney(Number(invoice.final_amount));
        if (![partialBefore, remainingBefore, finalAmount].every(Number.isFinite) ||
          partialBefore < 0 || remainingBefore < 0 || finalAmount !== roundRewardMoney(partialBefore + remainingBefore)) {
          blockers.push({ code: 'invoice_balance_mismatch', message: `Số dư hóa đơn ${invoice.code} không khớp; cần đối soát.` });
          continue;
        }
        if (invoice.status === SalesInvoiceStatus.CANCELLED) {
          blockers.push({
            code: 'invoice_cancelled',
            message: `Hóa đơn ${invoice.code} đã hủy; cần đối soát chứng từ trước khi hoàn tác phiếu thu.`,
          });
        } else if (invoice.status === SalesInvoiceStatus.REFUNDED
          || invoice.payment_status === SalesPaymentStatus.REFUNDED) {
          blockers.push({
            code: 'invoice_refunded',
            message: `Hóa đơn ${invoice.code} đã trả hàng/hoàn tiền; cần hoàn tác chứng từ trả hàng trước.`,
          });
        } else if (![SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID].includes(invoice.status)) {
          blockers.push({
            code: 'invoice_invalid_status',
            message: `Hóa đơn ${invoice.code} đang ở trạng thái "${invoice.status}", không thể khôi phục công nợ.`,
          });
        } else if (amount > partialBefore) {
          blockers.push({
            code: 'invoice_paid_mismatch',
            message: `Hóa đơn ${invoice.code} chỉ còn ghi nhận ${partialBefore.toLocaleString('vi-VN')} đ đã thu, nhỏ hơn phân bổ ${amount.toLocaleString('vi-VN')} đ. Hóa đơn có thể đã bị sửa/trả hàng sau khi thu.`,
          });
        } else {
          const partialAfter = roundRewardMoney(Math.max(0, partialBefore - amount));
          const remainingAfter = roundRewardMoney(
            Math.max(0, Number(invoice.final_amount || 0) - partialAfter),
          );
          invoiceChanges.push({
            invoice,
            restore_amount: amount,
            snapshot: {
              invoice_id: invoice.id,
              invoice_code: invoice.code,
              allocation_ids: group.map((item) => item.id),
              invoice_restore_amount: amount,
              customer_id: invoice.customer_id ?? null,
              season_id: invoice.season_id ?? null,
              final_amount: finalAmount,
              partial_payment_amount_before: partialBefore,
              partial_payment_amount_after: partialAfter,
              remaining_amount_before: remainingBefore,
              remaining_amount_after: remainingAfter,
              status_before: invoice.status,
              payment_status_before: invoice.payment_status,
              status_after: remainingAfter > 0 ? SalesInvoiceStatus.CONFIRMED : SalesInvoiceStatus.PAID,
              payment_status_after: remainingAfter <= 0 ? SalesPaymentStatus.PAID
                : partialAfter > 0 ? SalesPaymentStatus.PARTIAL : SalesPaymentStatus.PENDING,
            },
          });
          invoiceIds.push(invoice.id);
        }


        const debtNoteId = await this.resolveAllocationDebtNoteId(manager, allocation, invoice, blockers);
        const change = invoiceChanges.find((item) => item.invoice.id === invoice.id);
        if (change) change.snapshot.resolved_debt_note_id = debtNoteId;
        if (debtNoteId) {
          debtNoteIds.add(debtNoteId);
          debtNoteAmounts.set(
            debtNoteId,
            roundRewardMoney((debtNoteAmounts.get(debtNoteId) || 0) + amount),
          );
        }
      } else if (allocation.debt_note_id) {
        // Thiếu nguồn hóa đơn thì không xác định được delta tích lũy lịch sử một cách an toàn.
        blockers.push({ code: 'legacy_debt_note_allocation',
          message: `Phân bổ công nợ cũ #${allocation.id} thiếu nguồn đối chiếu hóa đơn/tích lũy; cần đối soát trước khi hoàn tác.` });
      } else {
        blockers.push({
          code: 'allocation_without_target',
          message: `Phân bổ #${allocation.id} không gắn hóa đơn hay phiếu công nợ; cần đối soát chứng từ.`,
        });
      }
    }

    // Phiếu công nợ phải còn ở trạng thái có thể mở lại.
    const debtNotes = debtNoteIds.size
      ? await manager.find(DebtNote, { where: { id: In([...debtNoteIds].sort((a, b) => a - b)) }, order: { id: 'ASC' }, ...lockOption })
      : [];
    for (const debtNote of debtNotes) {
      for (const change of invoiceChanges.filter((item) => item.snapshot.resolved_debt_note_id === debtNote.id)) {
        if (debtNote.customer_id !== payment.customer_id || debtNote.customer_id !== change.invoice.customer_id ||
          debtNote.season_id !== change.invoice.season_id ||
          (debtNote.source_invoices?.length && !debtNote.source_invoices.map(Number).includes(change.invoice.id))) {
          blockers.push({ code: 'debt_note_source_mismatch',
            message: `Phiếu nợ ${debtNote.code} không khớp khách hàng/mùa vụ/nguồn của hóa đơn ${change.invoice.code}; cần đối soát.` });
        }
      }
      if (debtNote.status === DebtNoteStatus.CANCELLED) {
        blockers.push({
          code: 'debt_note_cancelled',
          message: `Phiếu công nợ ${debtNote.code} đã hủy; không thể hoàn tác phiếu thu này.`,
        });
      } else if (debtNote.status === DebtNoteStatus.ROLLED_OVER) {
        blockers.push({
          code: 'debt_note_rolled_over',
          message: `Phiếu công nợ ${debtNote.code} đã chuyển nợ sang mùa khác; cần hoàn tác chuyển nợ trước.`,
        });
      } else if (debtNote.status === DebtNoteStatus.SETTLED) {
        blockers.push({
          code: 'debt_note_settled',
          message: `Phiếu công nợ ${debtNote.code} đã chốt sổ; cần hoàn tác chốt sổ trước khi hoàn tác phiếu thu.`,
        });
      }
    }

    // Chặn phiếu thu thuộc một lần chốt sổ đang hiệu lực (kiểm tra cả chi tiết phân bổ).
    if (debtNoteIds.size) {
      const closures = await manager.find(DebtNoteClosure, {
        where: {
          debt_note_id: In([...debtNoteIds]),
          status: DebtNoteClosureStatus.CLOSED,
        },
      });
      for (const closure of closures) {
        blockers.push({
          code: 'debt_note_closed',
          message: `Phiếu công nợ #${closure.debt_note_id} đã chốt sổ ngày ${new Date(closure.closed_at).toLocaleDateString('vi-VN')}; hãy dùng hoàn tác chốt sổ để khôi phục đồng bộ.`,
        });
      }
    }
    const closureByPayment = await manager.createQueryBuilder(DebtNoteClosure, 'closure')
      .where('closure.status = :status', { status: DebtNoteClosureStatus.CLOSED })
      .andWhere("closure.after_snapshot ->> 'payment_id' = :paymentId", {
        paymentId: String(payment.id),
      })
      .getOne();
    if (closureByPayment) {
      blockers.push({
        code: 'closure_payment',
        message: 'Phiếu thu thuộc lần chốt sổ; hãy dùng hoàn tác chốt sổ để khôi phục đồng bộ.',
      });
    }


    // Chứng từ trả hàng đã duyệt của hóa đơn liên quan chặn hoàn tác (kiểm tra theo invoice_id).
    if (invoiceIds.length) {
      const returnHeaders = await manager.find(SalesReturn, {
        where: { invoice_id: In([...new Set(invoiceIds)]), status: SalesReturnStatus.APPROVED },
      });
      if (returnHeaders.length) {
        const codes = [...new Set(returnHeaders.map((header) => header.invoice_id))];
        blockers.push({
          code: 'invoice_has_return',
          message: `Hóa đơn #${codes.join(', #')} đã có chứng từ trả hàng được duyệt; cần hoàn tác chứng từ trả hàng trước khi hoàn tác phiếu thu.`,
        });
      }
    }

    // Tổng tiền trên phiếu thu phải khớp trường đã phân bổ (chống dữ liệu sửa tay).
    const allocatedAmountField = roundRewardMoney(Number(payment.allocated_amount || 0));
    if (allocations.length && Math.abs(allocatedAmountField - paymentAmount) > 0.01) {
      blockers.push({
        code: 'allocated_amount_mismatch',
        message: `Số tiền đã phân bổ trên phiếu (${allocatedAmountField.toLocaleString('vi-VN')} đ) khác số tiền thu (${paymentAmount.toLocaleString('vi-VN')} đ). Cần đối soát trước khi hoàn tác.`,
      });
    }

    // Dựng danh sách phiếu công nợ sẽ bị trừ lại, kiểm tra số dư trước khi trừ.
    const debtNoteChanges: RollbackDebtNoteChange[] = [];
    for (const [debtNoteId, amount] of debtNoteAmounts) {
      const debtNote = debtNotes.find((item) => item.id === debtNoteId);
      if (!debtNote) {
        blockers.push({
          code: 'debt_note_missing',
          message: `Không tải được phiếu công nợ #${debtNoteId} để đối soát.`,
        });
        continue;
      }
      const paidBefore = roundRewardMoney(Number(debtNote.paid_amount || 0));
      const remainingBefore = roundRewardMoney(Number(debtNote.remaining_amount || 0));
      const debtAmount = roundRewardMoney(Number(debtNote.amount));
      if (![paidBefore, remainingBefore, debtAmount].every(Number.isFinite) ||
        paidBefore < 0 || remainingBefore < 0 || debtAmount !== roundRewardMoney(paidBefore + remainingBefore)) {
        blockers.push({ code: 'debt_note_balance_mismatch', message: `Số dư phiếu nợ ${debtNote.code} không khớp; cần đối soát.` });
      }
      if (amount > paidBefore) {
        blockers.push({
          code: 'debt_note_paid_mismatch',
          message: `Phiếu công nợ ${debtNote.code} chỉ ghi nhận đã thu ${paidBefore.toLocaleString('vi-VN')} đ, nhỏ hơn ${amount.toLocaleString('vi-VN')} đ cần hoàn tác. Cần đối soát trước.`,
        });
      }
      debtNoteChanges.push({
        debtNote,
        amount,
        before: {
          debt_note_id: debtNote.id,
          debt_note_code: debtNote.code,
          amount_to_reverse: amount,
          amount_before: debtAmount,
          paid_amount_before: paidBefore,
          remaining_amount_before: Number(debtNote.remaining_amount || 0),
          status_before: debtNote.status,
          closed_at_before: debtNote.closed_at ?? null,
        },
      });
    }

    if (!payment.customer_id) {
      warnings.push('Phiếu thu không gắn khách hàng; không thể đối soát tích lũy khách hàng.');
    }


    // Đối soát tích lũy: tính delta dự kiến (chỉ đọc) và chặn nếu âm hoặc đã có reset/quà sau lần thu.
    let accumulation: RollbackPlan['accumulation'] = null;
    const customerId = payment.customer_id
      || invoiceChanges[0]?.invoice.customer_id
      || null;
    if (customerId && invoiceChanges.length) {
      // Giữ khóa cùng hàng mà reset/tặng quà dùng, từ trước khi đọc số dư/sự kiện tới commit.
      if (lock) await this.customerRewardService.lockTrackingForPaymentRollback(manager, customerId);
      let delta = 0;
      let pendingBefore = 0;
      let totalBefore = 0;
      for (const change of invoiceChanges) {
        let preview: { delta: number; pending_before: number; total_before: number } | null = null;
        try {
          preview = await this.customerRewardService.previewInvoiceRewardDelta(
            manager,
            change.invoice.id,
            Number(change.snapshot.partial_payment_amount_after),
          );
        } catch (error) {
          blockers.push({
            code: 'reward_tracking_missing',
            message: error instanceof Error
              ? error.message
              : `Không đối soát được tích lũy hóa đơn ${change.invoice.code}.`,
          });
          continue;
        }
        delta = roundRewardMoney(delta + Number(preview.delta || 0));
        pendingBefore = Number(preview.pending_before || 0);
        totalBefore = Number(preview.total_before || 0);
      }
      accumulation = {
        delta,
        pending_before: pendingBefore,
        pending_after: roundRewardMoney(pendingBefore + delta),
        total_before: totalBefore,
        total_after: roundRewardMoney(totalBefore + delta),
      };

      if (![pendingBefore, totalBefore, delta].every(Number.isFinite) ||
        roundRewardMoney(pendingBefore + delta) < 0 || roundRewardMoney(totalBefore + delta) < 0) {
        blockers.push({
          code: 'accumulation_negative',
          message: `Hoàn tác sẽ làm tích lũy hiện tại của khách âm (${roundRewardMoney(pendingBefore + delta).toLocaleString('vi-VN')} đ). Cần đối soát tích lũy/quà tặng trước.`,
        });
      }

      // Chặn khi đã reset tích lũy hoặc đã phát quà sau lần thu (kể cả số dư mới đủ bù).
      const activity = await this.findRewardActivityAfter(manager, customerId, payment.created_at);
      if (activity.reset) {
        blockers.push({
          code: 'reward_reset_after_payment',
          message: 'Tích lũy của khách đã được xóa sau lần thu này. Cần đối soát tích lũy trước khi hoàn tác.',
        });
      }
      if (activity.gift) {
        blockers.push({
          code: 'reward_gift_after_payment',
          message: 'Khách đã nhận quà sau lần thu này. Cần đối soát quà tặng/tích lũy trước khi hoàn tác.',
        });
      }
    }

    const kind: PaymentRollbackKind = invoiceChanges.length
      ? 'invoice'
      : debtNoteChanges.length
        ? 'invoice'
        : 'unallocated';

    return {
      kind,
      blockers,
      warnings,
      loan: null,
      invoice_changes: invoiceChanges,
      debt_note_changes: debtNoteChanges,
      allocation_snapshots: allocationSnapshots,
      accumulation,
    };
  }


  /** Ném lỗi 400 tổng hợp mọi lý do chặn để người dùng đối soát một lần. */
  private assertNoBlockers(blockers: RollbackBlocker[]): void {
    if (!blockers.length) return;
    throw new BadRequestException({
      statusCode: 400,
      message: blockers.map((blocker) => blocker.message).join(' '),
      error: 'Bad Request',
      blockers,
    });
  }

  /** Xác định phiếu công nợ mà một phân bổ hóa đơn cần trừ lại (ưu tiên debt_note_id có sẵn). */
  private async resolveAllocationDebtNoteId(
    manager: EntityManager,
    allocation: PaymentAllocation,
    invoice: SalesInvoice,
    blockers: RollbackBlocker[],
  ): Promise<number | null> {
    if (allocation.debt_note_id) return allocation.debt_note_id;
    if (!invoice.customer_id || !invoice.season_id) return null;
    const debtNote = await manager.findOne(DebtNote, {
      where: { customer_id: invoice.customer_id, season_id: invoice.season_id },
    });
    if (!debtNote) {
      blockers.push({ code: 'debt_note_missing',
        message: `Không tìm thấy phiếu nợ của hóa đơn ${invoice.code}; cần đối soát nguồn công nợ.` });
    }
    return debtNote?.id ?? null;
  }

  /** Kiểm tra khách đã bị xóa tích lũy hoặc đã nhận quà sau thời điểm thu hay chưa. */
  private async findRewardActivityAfter(
    manager: EntityManager,
    customerId: number,
    since: Date,
  ): Promise<{ reset: boolean; gift: boolean }> {
    const reset = await manager.createQueryBuilder(CustomerRewardResetHistory, 'reset')
      .where('reset.customer_id = :customerId', { customerId })
      .andWhere('reset.created_at > :since', { since })
      .andWhere('reset.status = :status', { status: CustomerRewardResetStatus.ACTIVE })
      .getExists();
    const gift = await manager.createQueryBuilder(CustomerRewardHistory, 'gift')
      .where('gift.customer_id = :customerId', { customerId })
      .andWhere(new Brackets((qb) => {
        // Quà tích lũy đã trừ điểm ngay khi tạo, kể cả còn chờ giao hoặc đã đổi trạng thái.
        qb.where('(gift.reward_type = :rewardType AND gift.created_at > :since)', {
          rewardType: 'ACCUMULATION_REWARD', since,
        }).orWhere('(gift.gift_status = :delivered AND COALESCE(gift.delivered_date, gift.created_at) > :since)', {
          delivered: 'delivered', since,
        });
      }))
      .getExists();
    return { reset, gift };
  }

  /**
   * Trạng thái mở của phiếu công nợ sau khi hoàn tác.
   * Quy tắc quá hạn vẫn do lớp đọc tính từ `created_at` + cấu hình `debt_overdue_after_months`
   * nên chỉ lưu `active` để không đổi chính sách quá hạn hiện hành.
   */
  private resolveDebtNoteOpenStatus(_debtNote: DebtNote): DebtNoteStatus {
    return DebtNoteStatus.ACTIVE;
  }

  /** Dấu đối chiếu tác động đã hiển thị, không lưu DB và không dùng thời gian ngẫu nhiên. */
  private buildRollbackPreviewToken(payment: Payment, plan: RollbackPlan): string {
    return createHash('sha256').update(JSON.stringify({
      payment: this.buildPaymentSnapshot(payment),
      kind: plan.kind,
      allocations: plan.allocation_snapshots,
      invoices: plan.invoice_changes.map((change) => change.snapshot),
      debt_notes: plan.debt_note_changes.map((change) => change.before),
      loan: plan.loan?.before ?? null,
      accumulation: plan.accumulation,
    })).digest('hex');
  }

  /** Snapshot phiếu thu để lưu vào lịch sử trước khi xóa cứng. */
  private buildPaymentSnapshot(payment: Payment): Record<string, any> {
    return {
      id: payment.id,
      code: payment.code,
      customer_id: payment.customer_id ?? null,
      amount: Number(payment.amount || 0),
      allocated_amount: Number(payment.allocated_amount || 0),
      payment_date: payment.payment_date ?? null,
      payment_method: payment.payment_method,
      notes: payment.notes ?? null,
      debt_note_code: payment.debt_note_code ?? null,
      created_by: payment.created_by ?? null,
      created_at: payment.created_at ?? null,
    };
  }

  /** Snapshot khoản vay trước/sau khi hoàn tác phiếu trả vay. */
  private buildLoanSnapshot(loan: Loan): Record<string, any> {
    return {
      loan_id: loan.id,
      loan_code: loan.code,
      principal_amount: Number(loan.principal_amount || 0),
      paid_amount: Number(loan.paid_amount || 0),
      remaining_amount: Number(loan.remaining_amount || 0),
      interest_amount: Number(loan.interest_amount || 0),
      total_amount: Number(loan.total_amount || 0),
      loan_days: Number(loan.loan_days || 0),
      status: loan.status,
      repayment_date: loan.repayment_date ?? null,
      settled_by: loan.settled_by ?? null,
      payment_id: loan.payment_id ?? null,
    };
  }

  /** Ghi bảng lưu vết hoàn tác trong cùng transaction với nghiệp vụ. */
  private async saveRollbackHistory(
    manager: EntityManager,
    payment: Payment,
    data: {
      reason: string;
      userId: number;
      kind: PaymentRollbackKind;
      loanCode?: string | null;
      loanSnapshot?: Record<string, any> | null;
      allocationsSnapshot: Record<string, any>[];
      debtNotesSnapshot?: Record<string, any>[] | null;
      accumulationSnapshot?: Record<string, any> | null;
    },
  ): Promise<void> {
    const customer = payment.customer_id
      ? await manager.findOne(Customer, { where: { id: payment.customer_id } })
      : null;
    const history = manager.create(PaymentRollbackHistory, {
      payment_id: payment.id,
      payment_code: payment.code,
      customer_id: payment.customer_id ?? null,
      customer_name: customer?.name ?? null,
      amount: Number(payment.amount || 0),
      payment_kind: data.kind,
      debt_note_code: payment.debt_note_code ?? null,
      loan_code: data.loanCode ?? null,
      reason: data.reason,
      rolled_back_by: data.userId ?? null,
      affected_invoices: new Set(data.allocationsSnapshot.filter((item) => item.invoice_id).map((item) => item.invoice_id)).size,
      affected_debt_notes: data.debtNotesSnapshot?.length ?? 0,
      payment_snapshot: this.buildPaymentSnapshot(payment),
      allocations_snapshot: data.allocationsSnapshot,
      debt_notes_snapshot: data.debtNotesSnapshot ?? null,
      loan_snapshot: data.loanSnapshot ?? null,
      accumulation_snapshot: data.accumulationSnapshot ?? null,
    });
    await manager.save(history);
  }


  /** Tra cứu lịch sử hoàn tác phiếu thu phục vụ đối soát. */
  async searchRollbackHistory(dto: SearchPaymentRollbackHistoryDto) {
    const page = Math.max(1, Number(dto.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(dto.limit) || 20));
    const queryBuilder = this.rollbackHistoryRepository.createQueryBuilder('history')
      .leftJoin('history.rollbacker', 'rollbacker')
      .addSelect(['rollbacker.id', 'rollbacker.account']);

    if (dto.payment_code?.trim()) {
      queryBuilder.andWhere('history.payment_code ILIKE :paymentCode', {
        paymentCode: `%${dto.payment_code.trim()}%`,
      });
    }
    if (dto.customer_name?.trim()) {
      queryBuilder.andWhere('history.customer_name ILIKE :customerName', {
        customerName: `%${dto.customer_name.trim()}%`,
      });
    }
    if (dto.debt_note_code?.trim()) {
      queryBuilder.andWhere('history.debt_note_code ILIKE :debtNoteCode', {
        debtNoteCode: `%${dto.debt_note_code.trim()}%`,
      });
    }
    if (dto.rolled_back_by) {
      queryBuilder.andWhere('history.rolled_back_by = :rolledBackBy', {
        rolledBackBy: Number(dto.rolled_back_by),
      });
    }
    if (dto.from_date) {
      queryBuilder.andWhere('history.rolled_back_at >= :fromDate', { fromDate: dto.from_date });
    }
    if (dto.to_date) {
      queryBuilder.andWhere('history.rolled_back_at <= :toDate', { toDate: `${dto.to_date} 23:59:59` });
    }

    queryBuilder
      .orderBy('history.rolled_back_at', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Gắn cờ `can_rollback` / `rollback_block_reason` cho danh sách phiếu thu.
   * Dùng truy vấn gộp, chỉ kiểm tra guard rẻ; reset/quà tặng được kiểm tra lại ở preview và rollback.
   */
  private async annotateRollbackEligibility(payments: Payment[]): Promise<void> {
    if (!payments.length) return;
    const paymentIds = payments.map((payment) => payment.id);
    const manager = this.paymentRepository.manager;

    const allocations = await this.paymentAllocationRepository.find({
      where: { payment_id: In(paymentIds) },
    });
    const loans = await manager.find(Loan, { where: { payment_id: In(paymentIds) } });
    const invoiceIds = [...new Set(
      allocations.map((allocation) => allocation.invoice_id).filter((id): id is number => !!id),
    )];
    const debtNoteIds = [...new Set(
      allocations.map((allocation) => allocation.debt_note_id).filter((id): id is number => !!id),
    )];

    const [invoices, debtNotes, closedNotes] = await Promise.all([
      invoiceIds.length
        ? manager.find(SalesInvoice, { where: { id: In(invoiceIds) } })
        : Promise.resolve([] as SalesInvoice[]),
      debtNoteIds.length
        ? manager.find(DebtNote, { where: { id: In(debtNoteIds) } })
        : Promise.resolve([] as DebtNote[]),
      debtNoteIds.length
        ? manager.find(DebtNoteClosure, {
          where: { debt_note_id: In(debtNoteIds), status: DebtNoteClosureStatus.CLOSED },
        })
        : Promise.resolve([] as DebtNoteClosure[]),
    ]);

    const allocationsByPayment = new Map<number, PaymentAllocation[]>();
    for (const allocation of allocations) {
      const list = allocationsByPayment.get(allocation.payment_id) || [];
      list.push(allocation);
      allocationsByPayment.set(allocation.payment_id, list);
    }
    const loanPaymentIds = new Set(loans.map((loan) => loan.payment_id));
    const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const debtNoteMap = new Map(debtNotes.map((debtNote) => [debtNote.id, debtNote]));
    const closedNoteIds = new Set(closedNotes.map((closure) => closure.debt_note_id));


    for (const payment of payments) {
      const record = payment as Payment & {
        can_rollback?: boolean;
        rollback_block_reason?: string | null;
        payment_kind?: PaymentRollbackKind;
      };
      const paymentAllocations = allocationsByPayment.get(payment.id) || [];
      let blocker: string | null = null;
      let kind: PaymentRollbackKind = 'invoice';

      if (loanPaymentIds.has(payment.id)) {
        kind = 'loan';
        if (paymentAllocations.length) blocker = 'Phiếu trả vay có thêm phân bổ hóa đơn/công nợ; cần đối soát';
      } else if (!Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0) {
        blocker = 'Phiếu hoàn tiền hoặc số tiền không hợp lệ; cần đối soát chứng từ gốc';
      } else if (!paymentAllocations.length) {
        blocker = 'Phiếu thu chưa có phân bổ; cần đối soát trước khi hoàn tác';
      } else if (paymentAllocations.some((allocation) => allocation.sales_return_id)) {
        blocker = 'Phiếu hoàn tiền/trả hàng phải hoàn tác qua chứng từ trả hàng gốc';
      } else {
        const allocatedSum = roundRewardMoney(
          paymentAllocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0),
        );
        if (Math.abs(allocatedSum - Number(payment.amount || 0)) > 0.01) {
          blocker = 'Tổng phân bổ không khớp số tiền phiếu thu';
        }
        for (const allocation of paymentAllocations) {
          if (blocker) break;
          const amount = Number(allocation.amount || 0);
          if (allocation.invoice_id) {
            const invoice = invoiceMap.get(allocation.invoice_id);
            if (allocation.allocation_type !== 'invoice') {
              // Danh sách phải chặn giống preview: phân bổ gắn hóa đơn nhưng sai loại chứng từ.
              blocker = `Phân bổ #${allocation.id} sai loại chứng từ; cần đối soát`;
            } else if (!invoice) {
              blocker = 'Không tìm thấy hóa đơn của phân bổ';
            } else if (invoice.status === SalesInvoiceStatus.CANCELLED) {
              blocker = `Hóa đơn ${invoice.code} đã hủy`;
            } else if (invoice.status === SalesInvoiceStatus.REFUNDED
              || invoice.payment_status === SalesPaymentStatus.REFUNDED) {
              blocker = `Hóa đơn ${invoice.code} đã trả hàng/hoàn tiền`;
            } else if (![SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID].includes(invoice.status)) {
              blocker = `Hóa đơn ${invoice.code} không ở trạng thái có thể hoàn tác`;
            } else if (amount > Number(invoice.partial_payment_amount || 0) + 0.01) {
              blocker = `Hóa đơn ${invoice.code} đã thay đổi số tiền đã thu`;
            }
          } else if (allocation.debt_note_id) {
            const debtNote = debtNoteMap.get(allocation.debt_note_id);
            if (!debtNote) {
              blocker = 'Không tìm thấy phiếu công nợ của phân bổ';
            } else {
              blocker = `Phân bổ công nợ cũ ${debtNote.code} thiếu nguồn đối chiếu hóa đơn/tích lũy`;
            }
          } else {
            blocker = 'Phân bổ không gắn hóa đơn hay phiếu công nợ';
          }
        }
        if (!blocker) {
          for (const allocation of paymentAllocations) {
            const debtNote = allocation.debt_note_id
              ? debtNoteMap.get(allocation.debt_note_id)
              : undefined;
            if (!debtNote) continue;
            if (debtNote.status === DebtNoteStatus.CANCELLED) {
              blocker = `Phiếu công nợ ${debtNote.code} đã hủy`;
            } else if (debtNote.status === DebtNoteStatus.ROLLED_OVER) {
              blocker = `Phiếu công nợ ${debtNote.code} đã chuyển nợ`;
            } else if (debtNote.status === DebtNoteStatus.SETTLED) {
              blocker = `Phiếu công nợ ${debtNote.code} đã chốt sổ`;
            } else if (closedNoteIds.has(debtNote.id)) {
              blocker = `Phiếu công nợ ${debtNote.code} đã chốt sổ`;
            }
            if (blocker) break;
          }
        }
      }

      record.can_rollback = !blocker;
      record.rollback_block_reason = blocker;
      record.payment_kind = kind;
    }
  }
}
