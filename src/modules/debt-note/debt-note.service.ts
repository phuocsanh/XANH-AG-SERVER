import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { DebtNoteClosure, DebtNoteClosureStatus } from '../../entities/debt-note-closure.entity';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { CreateDebtNoteDto } from './dto/create-debt-note.dto';
import { UpdateDebtNoteDto } from './dto/update-debt-note.dto';
import { SearchDebtNoteDto } from './dto/search-debt-note.dto';
import { CloseSeasonDebtNoteDto } from './dto/close-season-debt-note.dto';
import { ReverseCloseDebtNoteDto } from './dto/reverse-close-debt-note.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { CustomerRewardService } from '../customer-reward/customer-reward.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class DebtNoteService {
  private readonly logger = new Logger(DebtNoteService.name);

  constructor(
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
    private dataSource: DataSource,
    private readonly customerRewardService: CustomerRewardService,
    private readonly inventoryService: InventoryService,
  ) {}

  private toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toIso(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private snapshotDebtNote(debtNote: DebtNote) {
    return {
      id: debtNote.id,
      code: debtNote.code,
      customer_id: debtNote.customer_id,
      season_id: debtNote.season_id ?? null,
      amount: this.toNumber(debtNote.amount),
      paid_amount: this.toNumber(debtNote.paid_amount),
      remaining_amount: this.toNumber(debtNote.remaining_amount),
      status: debtNote.status,
      due_date: this.toIso(debtNote.due_date),
      notes: debtNote.notes ?? null,
      source_invoices: debtNote.source_invoices || [],
      created_by: debtNote.created_by ?? null,
      rolled_over_from_id: debtNote.rolled_over_from_id ?? null,
      rolled_over_to_id: debtNote.rolled_over_to_id ?? null,
      gift_description: debtNote.gift_description ?? null,
      gift_value: this.toNumber(debtNote.gift_value),
      reward_given: Boolean(debtNote.reward_given),
      reward_count: this.toNumber(debtNote.reward_count),
      closed_at: this.toIso(debtNote.closed_at),
    };
  }

  private snapshotRewardTracking(tracking?: CustomerRewardTracking | null) {
    if (!tracking) return null;
    return {
      id: tracking.id,
      customer_id: tracking.customer_id,
      pending_amount: this.toNumber(tracking.pending_amount),
      total_accumulated: this.toNumber(tracking.total_accumulated),
      reward_count: this.toNumber(tracking.reward_count),
      last_reward_date: this.toIso(tracking.last_reward_date),
      status: tracking.status,
    };
  }

  private snapshotsMatch(current: Record<string, any>, expected: Record<string, any>) {
    return JSON.stringify(current) === JSON.stringify(expected);
  }

  private applyDebtNoteSnapshot(debtNote: DebtNote, snapshot: Record<string, any>) {
    Object.assign(debtNote, {
      amount: snapshot.amount,
      paid_amount: snapshot.paid_amount,
      remaining_amount: snapshot.remaining_amount,
      status: snapshot.status,
      due_date: snapshot.due_date ? new Date(snapshot.due_date) : null,
      notes: snapshot.notes,
      source_invoices: snapshot.source_invoices || [],
      rolled_over_from_id: snapshot.rolled_over_from_id,
      rolled_over_to_id: snapshot.rolled_over_to_id,
      gift_description: snapshot.gift_description,
      gift_value: snapshot.gift_value || 0,
      reward_given: Boolean(snapshot.reward_given),
      reward_count: snapshot.reward_count || 0,
      closed_at: snapshot.closed_at ? new Date(snapshot.closed_at) : null,
    });
  }

  async create(createDto: CreateDebtNoteDto, userId: number): Promise<DebtNote> {
    try {
      // Tự sinh mã nếu không có
      const code = createDto.code || CodeGeneratorHelper.generateUniqueCode('DN');
      
      const debtNote = this.debtNoteRepository.create({
        ...createDto,
        code,
        remaining_amount: createDto.amount, // Initially remaining = amount
        paid_amount: 0,
        status: DebtNoteStatus.ACTIVE,
        created_by: userId, // Lấy từ JWT token
      });
      return await this.debtNoteRepository.save(debtNote);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'phiếu công nợ');
    }
  }

  async findOne(id: number): Promise<DebtNote | null> {
    return this.debtNoteRepository.findOne({
      where: { id },
      relations: ['customer', 'season'],
    });
  }

  async update(id: number, updateDto: UpdateDebtNoteDto): Promise<DebtNote | null> {
    try {
      await this.debtNoteRepository.update(id, updateDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'phiếu công nợ');
    }
  }

  async remove(id: number): Promise<void> {
    await this.debtNoteRepository.delete(id);
  }

  async search(searchDto: SearchDebtNoteDto): Promise<{
    data: DebtNote[];
    total: number;
    page: number;
    limit: number;
    summary: any;
  }> {
    const page = Number(searchDto.page) || 1;
    const limit = Number(searchDto.limit) || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.debtNoteRepository.createQueryBuilder('debt_note');
    queryBuilder.leftJoinAndSelect('debt_note.customer', 'customer');
    queryBuilder.leftJoinAndSelect('debt_note.season', 'season');
    queryBuilder.leftJoin('debt_note.creator', 'creator').addSelect(['creator.id', 'creator.account']);

    // 1. Áp dụng filters và keyword từ QueryHelper
    QueryHelper.applyBaseSearch(queryBuilder, searchDto, 'debt_note', ['code', 'customer.name', 'customer.phone']);
    QueryHelper.applyFilters(queryBuilder, searchDto, 'debt_note', 
      ['filters', 'nested_filters', 'operator', 'customer_name', 'customer_phone', 'page', 'limit'], 
      { season_name: 'season.name' }
    );

    // 2. Logic tìm kiếm khách hàng đặc thù của Debt Note
    if (searchDto.customer_name || searchDto.customer_phone) {
      const nameKeyword = searchDto.customer_name ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_name)}%` : null;
      const phoneKeyword = searchDto.customer_phone ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_phone)}%` : null;
      queryBuilder.andWhere(new Brackets(qb => {
        if (nameKeyword) {
          qb.orWhere(`regexp_replace(unaccent(customer.name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`, { nameKeyword });
          qb.orWhere(`EXISTS (SELECT 1 FROM sales_invoices si WHERE si.id IN (SELECT json_array_elements_text(debt_note.source_invoices)::int) AND regexp_replace(unaccent(si.customer_name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword))`, { nameKeyword });
        }
        if (phoneKeyword) {
          qb.orWhere(`customer.phone ILIKE :phoneKeyword`, { phoneKeyword });
          qb.orWhere(`EXISTS (SELECT 1 FROM sales_invoices si WHERE si.id IN (SELECT json_array_elements_text(debt_note.source_invoices)::int) AND si.customer_phone ILIKE :phoneKeyword)`, { phoneKeyword });
        }
      }));
    }

    // 3. Phân trang (Lưu ý: skip/take áp dụng sau khi filter)
    const total = await queryBuilder.getCount();
    const entities = await queryBuilder.skip(skip).take(limit).getMany();
    const debtNoteIds = entities.map((dn) => dn.id);
    let reversibleClosures: { debt_note_id: number }[] = [];

    if (debtNoteIds.length > 0) {
      try {
        reversibleClosures = await this.dataSource
          .getRepository(DebtNoteClosure)
          .createQueryBuilder('closure')
          .select('closure.debt_note_id', 'debt_note_id')
          .where('closure.debt_note_id IN (:...debtNoteIds)', { debtNoteIds })
          .andWhere('closure.status = :status', { status: DebtNoteClosureStatus.CLOSED })
          .getRawMany<{ debt_note_id: number }>();
      } catch (error) {
        this.logger.warn(
          `Không thể kiểm tra trạng thái hoàn tác chốt sổ: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const reversibleDebtNoteIds = new Set(
      reversibleClosures.map((closure) => Number(closure.debt_note_id)),
    );

    // 4. Map thêm thông tin tích lũy từ CustomerRewardService
    const data = await Promise.all(entities.map(async (dn) => {
        const reward = await this.customerRewardService.getMyRewardTracking(dn.customer_id);
        return {
            ...dn,
            pending_accumulation: Number(reward?.pending_amount || 0),
            can_reverse_close: reversibleDebtNoteIds.has(dn.id),
        } as any;
    }));

    // 5. Lấy tóm tắt thống kê (Dùng clone để giữ nguyên filter nhưng bỏ skip/take)
    const summaryQuery = queryBuilder.clone().skip(undefined).take(undefined).orderBy();
    const summary = await summaryQuery
      .select('SUM(debt_note.amount)', 'total_amount')
      .addSelect('SUM(debt_note.paid_amount)', 'total_paid')
      .addSelect('SUM(debt_note.remaining_amount)', 'total_debt')
      .addSelect(`COUNT(CASE WHEN debt_note.status = '${DebtNoteStatus.OVERDUE}' THEN 1 END)`, 'overdue_count')
      .addSelect(`COUNT(CASE WHEN debt_note.status = '${DebtNoteStatus.ACTIVE}' THEN 1 END)`, 'active_count')
      .addSelect(`COUNT(CASE WHEN debt_note.status IN ('${DebtNoteStatus.PAID}', '${DebtNoteStatus.SETTLED}') THEN 1 END)`, 'paid_count')
      .getRawOne();

    return {
      data,
      total,
      page,
      limit,
      summary: {
        total_amount: Number(summary.total_amount || 0),
        total_paid: Number(summary.total_paid || 0),
        total_debt: Number(summary.total_debt || 0),
        overdue_count: Number(summary.overdue_count || 0),
        active_count: Number(summary.active_count || 0),
        paid_count: Number(summary.paid_count || 0),
      },
    };
  }

  async findOrCreateForSeason(
    customer_id: number,
    season_id: number | undefined,
    created_by: number,
    manager?: any,
  ): Promise<DebtNote> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    const queryBuilder = repo
      .createQueryBuilder('dn')
      .where('dn.customer_id = :customer_id', { customer_id })
      .andWhere('dn.status IN (:...statuses)', { statuses: ['active', 'overdue', 'paid', 'settled'] });

    if (season_id) {
      queryBuilder.andWhere('dn.season_id = :season_id', { season_id });
    } else {
      queryBuilder.andWhere('dn.season_id IS NULL');
    }

    let debtNote = await queryBuilder.getOne();

    if (!debtNote) {
      const code = CodeGeneratorHelper.generateUniqueCode('DN');
      const newDebtNote = repo.create({
        code,
        customer_id,
        ...(season_id && { season_id }),
        amount: 0,
        paid_amount: 0,
        remaining_amount: 0,
        status: DebtNoteStatus.ACTIVE,
        source_invoices: [],
        created_by,
      });
      debtNote = await repo.save(newDebtNote);
      this.logger.log(`✅ Tạo phiếu công nợ mới: ${code} cho customer #${customer_id}`);
    }

    return debtNote;
  }

  async addInvoiceToDebtNote(
    debtNoteId: number,
    invoiceId: number,
    invoiceFinalAmount: number,
    invoicePaidAmount: number,
    manager?: any,
  ): Promise<DebtNote> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    const debtNote = await repo.findOne({
      where: { id: debtNoteId },
    });

    if (!debtNote) {
      throw new Error(`DebtNote #${debtNoteId} not found`);
    }

    if (!debtNote.source_invoices) {
      debtNote.source_invoices = [];
    }

    if (debtNote.source_invoices.includes(invoiceId)) {
      return debtNote;
    }

    debtNote.source_invoices.push(invoiceId);

    const currentAmount = Number(debtNote.amount) || 0;
    const currentPaid = Number(debtNote.paid_amount) || 0;
    const currentRemaining = Number(debtNote.remaining_amount) || 0;

    const addAmount = Number(invoiceFinalAmount) || 0;
    const addPaid = Number(invoicePaidAmount) || 0;
    const addRemaining = Math.max(0, addAmount - addPaid);
    
    debtNote.amount = currentAmount + addAmount;
    debtNote.paid_amount = currentPaid + addPaid;
    debtNote.remaining_amount = currentRemaining + addRemaining;

    if (debtNote.status !== DebtNoteStatus.SETTLED && debtNote.status !== DebtNoteStatus.CANCELLED) {
      if (debtNote.remaining_amount > 0) {
        debtNote.status = DebtNoteStatus.ACTIVE;
      } else {
        debtNote.status = DebtNoteStatus.PAID;
      }
    }

    return await repo.save(debtNote);
  }

  async removeInvoiceFromDebtNote(
    invoiceId: number,
    invoiceFinalAmount: number,
    invoicePaidAmount: number,
    manager?: any,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    const debtNotes = await repo.createQueryBuilder('dn')
      .where('dn.source_invoices::jsonb @> :invoiceIdJson::jsonb', { 
        invoiceIdJson: JSON.stringify([invoiceId]) 
      })
      .getMany();

    for (const debtNote of debtNotes) {
      if (debtNote.source_invoices) {
        debtNote.source_invoices = debtNote.source_invoices.filter(id => id !== invoiceId);
      }

      const currentAmount = Number(debtNote.amount) || 0;
      const currentPaid = Number(debtNote.paid_amount) || 0;
      const currentRemaining = Number(debtNote.remaining_amount) || 0;

      const removeAmount = Number(invoiceFinalAmount) || 0;
      const removePaid = Number(invoicePaidAmount) || 0;
      const removeRemaining = Math.max(0, removeAmount - removePaid);

      debtNote.amount = Math.max(0, currentAmount - removeAmount);
      debtNote.paid_amount = Math.max(0, currentPaid - removePaid);
      debtNote.remaining_amount = Math.max(0, currentRemaining - removeRemaining);

      if (debtNote.status !== DebtNoteStatus.SETTLED && debtNote.status !== DebtNoteStatus.CANCELLED) {
        if (debtNote.remaining_amount > 0) {
          debtNote.status = DebtNoteStatus.ACTIVE;
        } else {
          debtNote.status = DebtNoteStatus.PAID;
        }
      }

      await repo.save(debtNote);
      this.logger.log(`✅ Đã trừ công nợ hóa đơn #${invoiceId} khỏi phiếu nợ #${debtNote.code}`);
    }
  }

  /**
   * Chốt sổ công nợ cuối vụ
   */
  async closeSeasonDebtNote(debtNoteId: number, closeData: CloseSeasonDebtNoteDto, userId: number) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Lấy thông tin phiếu công nợ
      const debtNote = await manager.findOne(DebtNote, {
        where: { id: debtNoteId },
        relations: ['customer', 'season'],
      });

      if (!debtNote) {
        throw new NotFoundException('Không tìm thấy phiếu công nợ');
      }

      if (debtNote.status === DebtNoteStatus.PAID || debtNote.status === DebtNoteStatus.SETTLED) {
        throw new BadRequestException('Phiếu công nợ đã hoàn thành thanh toán');
      }

      // 2. Kiểm tra tính hợp lệ của dữ liệu quà tặng
      if (closeData.gift_value && closeData.gift_value > 0 && !closeData.gift_description) {
        throw new BadRequestException('Vui lòng nhập mô tả quà tặng khi có giá trị quà tặng');
      }

      const rewardTrackingBefore = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id: debtNote.customer_id },
      });
      const beforeSnapshot = this.snapshotDebtNote(debtNote);
      const trackingBeforeSnapshot = this.snapshotRewardTracking(rewardTrackingBefore);

      // 🆕 NEW: Nếu có thanh toán đồng thời khi chốt sổ, cập nhật lại tiền trên phiếu nợ
      const extraPayment = Number(closeData.payment_amount || 0);
      if (extraPayment > 0) {
        debtNote.paid_amount = Number(debtNote.paid_amount || 0) + extraPayment;
        debtNote.remaining_amount = Math.max(0, Number(debtNote.remaining_amount || 0) - extraPayment);
      }

      // 3. Xử lý quà tặng và tích lũy thông qua CustomerRewardService
      // CHỈ CẦN GỌI DUY NHẤT 1 HÀM NÀY, không cần tính toán tại đây.
      const rewardSummary = await this.customerRewardService.handleDebtNoteSettlement(
        manager,
        debtNote,
        closeData,
        userId
      );

      // 3. Cập nhật phiếu công nợ (phần thuộc về DebtNote)
      const closedAt = new Date();
      debtNote.status = DebtNoteStatus.PAID;
      debtNote.closed_at = closedAt;
      debtNote.reward_given = rewardSummary?.reward_given || false;
      debtNote.reward_count = rewardSummary?.reward_count || 0;
      if (closeData.gift_description) {
        debtNote.gift_description = closeData.gift_description;
      }
      debtNote.gift_value = closeData.gift_value || 0;
      
      await manager.save(debtNote);

      const rewardTrackingAfter = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id: debtNote.customer_id },
      });
      const afterSnapshot = this.snapshotDebtNote(debtNote);
      const trackingAfterSnapshot = this.snapshotRewardTracking(rewardTrackingAfter);
      const closure = manager.create(DebtNoteClosure, {
        debt_note_id: debtNote.id,
        customer_id: debtNote.customer_id,
        season_id: debtNote.season_id ?? null,
        closed_by: userId,
        closed_at: closedAt,
        status: DebtNoteClosureStatus.CLOSED,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
        reward_tracking_before: trackingBeforeSnapshot,
        reward_tracking_after: trackingAfterSnapshot,
        reward_history_ids: rewardSummary?.reward_history_ids || [],
        inventory_transaction_ids: rewardSummary?.inventory_transaction_ids || [],
        gift_cost_ids: rewardSummary?.gift_cost_ids || [],
      });
      await manager.save(closure);

      // 4. Trả về kết quả tóm tắt cho FE
      return {
        success: true,
        debt_note_id: debtNote.id,
        customer_name: debtNote.customer?.name,
        season_name: debtNote.season?.name,
        ...(rewardSummary || {}), // Trộn các thông tin quà tặng từ summary vào response (nếu có)
      };
    });
  }

  async reverseCloseSeasonDebtNote(
    debtNoteId: number,
    dto: ReverseCloseDebtNoteDto,
    userId: number,
  ) {
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException('Vui lòng nhập lý do hoàn tác chốt sổ');
    }

    return await this.dataSource.transaction(async (manager) => {
      const debtNote = await manager.findOne(DebtNote, {
        where: { id: debtNoteId },
        relations: ['customer', 'season'],
      });

      if (!debtNote) {
        throw new NotFoundException('Không tìm thấy phiếu công nợ');
      }

      const closure = await manager.findOne(DebtNoteClosure, {
        where: {
          debt_note_id: debtNoteId,
          status: DebtNoteClosureStatus.CLOSED,
        },
        order: { id: 'DESC' },
      });

      if (!closure) {
        throw new BadRequestException(
          'Phiếu này không có hồ sơ chốt sổ để hoàn tác an toàn. Chỉ hoàn tác được các lần chốt có snapshot.',
        );
      }

      const currentDebtSnapshot = this.snapshotDebtNote(debtNote);
      if (!this.snapshotsMatch(currentDebtSnapshot, closure.after_snapshot?.debt_note || closure.after_snapshot)) {
        throw new BadRequestException(
          'Phiếu công nợ đã thay đổi sau khi chốt. Vui lòng kiểm tra phát sinh trước khi hoàn tác.',
        );
      }

      const currentTracking = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id: debtNote.customer_id },
      });
      const currentTrackingSnapshot = this.snapshotRewardTracking(currentTracking);
      const expectedTrackingSnapshot = closure.reward_tracking_after || null;

      if (!this.snapshotsMatch(currentTrackingSnapshot || {}, expectedTrackingSnapshot || {})) {
        throw new BadRequestException(
          'Tích lũy khách hàng đã thay đổi sau khi chốt. Không thể hoàn tác tự động.',
        );
      }

      const rewardHistoryIds = Array.isArray(closure.reward_history_ids)
        ? closure.reward_history_ids
        : [];
      const giftCostIds = Array.isArray(closure.gift_cost_ids)
        ? closure.gift_cost_ids
        : [];
      const reversedInventoryTransactionIds: number[] = [];

      for (const historyId of rewardHistoryIds) {
        const history = await manager.findOne(CustomerRewardHistory, {
          where: { id: Number(historyId) },
        });

        if (!history) {
          throw new BadRequestException(
            `Không tìm thấy lịch sử quà #${historyId} để hoàn tác chốt sổ`,
          );
        }

        const giftProductId = this.toNumber(history.gift_product_id);
        const giftQuantity = this.toNumber(history.gift_quantity);
        if (giftProductId > 0 && giftQuantity > 0) {
          if (history.gift_inventory_transaction_id) {
            const originalTransaction = await manager.findOne(InventoryTransaction, {
              where: { id: history.gift_inventory_transaction_id },
            });
            if (!originalTransaction) {
              throw new BadRequestException(
                `Không tìm thấy giao dịch xuất kho quà #${history.gift_inventory_transaction_id}`,
              );
            }
          }

          const stockInResult = await this.inventoryService.processStockIn(
            giftProductId,
            giftQuantity,
            this.toNumber(history.gift_unit_price),
            userId,
            undefined,
            `GIFT_REVERSE_CLOSE_${history.id}_${Date.now()}`,
            undefined,
            { manager } as any,
          );
          reversedInventoryTransactionIds.push(stockInResult.transaction.id);
        }

        history.gift_status = 'cancelled';
        history.notes = [
          history.notes,
          `Hoàn tác chốt sổ phiếu ${debtNote.code}: ${reason}`,
        ].filter(Boolean).join(' | ');
        await manager.save(history);
      }

      for (const giftCostId of giftCostIds) {
        const giftCost = await manager.findOne(FarmGiftCost, {
          where: { id: Number(giftCostId) },
        });
        if (giftCost) {
          await manager.remove(giftCost);
        }
      }

      if (closure.reward_tracking_before) {
        const trackingSnapshot = closure.reward_tracking_before;
        let tracking = currentTracking;
        if (!tracking) {
          tracking = manager.create(CustomerRewardTracking, {
            customer_id: debtNote.customer_id,
          });
        }

        Object.assign(tracking, {
          pending_amount: trackingSnapshot.pending_amount,
          total_accumulated: trackingSnapshot.total_accumulated,
          reward_count: trackingSnapshot.reward_count,
          last_reward_date: trackingSnapshot.last_reward_date
            ? new Date(trackingSnapshot.last_reward_date)
            : null,
          status: trackingSnapshot.status || 'active',
        });
        await manager.save(tracking);
      } else if (currentTracking) {
        await manager.remove(currentTracking);
      }

      this.applyDebtNoteSnapshot(debtNote, closure.before_snapshot?.debt_note || closure.before_snapshot);
      await manager.save(debtNote);

      closure.status = DebtNoteClosureStatus.REVERSED;
      closure.reversed_by = userId;
      closure.reversed_at = new Date();
      closure.reverse_reason = reason;
      const savedClosure = await manager.save(closure);

      return {
        success: true,
        debt_note_id: debtNote.id,
        closure_id: savedClosure.id,
        customer_name: debtNote.customer?.name,
        season_name: debtNote.season?.name,
        reward_history_cancelled: rewardHistoryIds.length,
        gift_cost_removed: giftCostIds.length,
        inventory_reversal_transaction_ids: reversedInventoryTransactionIds,
        message: 'Hoàn tác chốt sổ công nợ thành công',
      };
    });
  }
}
