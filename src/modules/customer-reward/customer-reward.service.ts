import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, EntityManager, QueryRunner, In } from 'typeorm';
import { CustomerRewardInvoiceTracking } from '../../entities/customer-reward-invoice-tracking.entity';
import { SalesInvoice, SalesInvoiceStatus, SalesPaymentStatus } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesReturn, SalesReturnStatus } from '../../entities/sales-return.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { calculateInvoiceRewardAccumulation, roundRewardMoney } from './invoice-reward-accumulation';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { Customer } from '../../entities/customer.entity';
import { Season } from '../../entities/season.entity';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { Product } from '../../entities/products.entity';
import { FarmGiftCostService } from '../farm-service-cost/farm-gift-cost.service';
import { InventoryService } from '../inventory/inventory.service';
import { QueryHelper } from '../../common/helpers/query-helper';
import { SearchRewardDto } from './dto/search-reward.dto';
import { CreateManualRewardDto } from './dto/create-manual-reward.dto';
import { ResetCustomerRewardDto } from './dto/reset-customer-reward.dto';
import { SearchRewardResetHistoryDto } from './dto/search-reward-reset-history.dto';
import {
  CustomerRewardResetHistory,
  CustomerRewardResetStatus,
} from '../../entities/customer-reward-reset-history.entity';
import {
  CustomerRewardStockAllocation,
  validateCustomerRewardStockAllocations,
} from './customer-reward-stock-allocations';

@Injectable()
export class CustomerRewardService {
  constructor(
    @InjectRepository(CustomerRewardTracking)
    private rewardTrackingRepository: Repository<CustomerRewardTracking>,
    @InjectRepository(CustomerRewardHistory)
    private rewardHistoryRepository: Repository<CustomerRewardHistory>,
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    private readonly farmGiftCostService: FarmGiftCostService,
    private readonly inventoryService: InventoryService,
  ) {}

  private readonly DEFAULT_REWARD_THRESHOLD = 70000000; // 🔥 Đã sửa mốc thành 70 triệu theo yêu cầu
 // 60 Triệu

  private toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getTransactionalQueryRunner(manager: EntityManager): QueryRunner {
    const queryRunner = manager.queryRunner;
    if (!queryRunner?.isTransactionActive) {
      throw new BadRequestException('Thao tác quà tặng cần transaction đang hoạt động');
    }
    return queryRunner;
  }

  private createGiftStockAllocations(
    quantity: number,
    taxableQuantity: number,
    affectedBatches: Array<{
      batchId: number;
      deductedQuantity: number;
      taxableQuantity: number;
    }>,
  ): CustomerRewardStockAllocation[] {
    const allocations = affectedBatches.map((batch) => ({
      batchId: Number(batch.batchId),
      quantity: Number(batch.deductedQuantity),
      taxableQuantity: Number(batch.taxableQuantity),
    }));
    const validation = validateCustomerRewardStockAllocations(quantity, allocations);
    if ('error' in validation) {
      throw new BadRequestException(
        `Không thể lưu phân bổ tồn kho quà tặng: ${validation.error}.`,
      );
    }

    const allocatedTax = validation.allocations.reduce(
      (sum, allocation) => sum + allocation.taxableQuantity,
      0,
    );
    if (Math.abs(allocatedTax - taxableQuantity) > 0.0001) {
      throw new BadRequestException(
        'Tổng số thuế phân bổ cho quà tặng không khớp số thuế đã xuất.',
      );
    }
    return validation.allocations;
  }

  private getExistingGiftStockAllocations(
    history: CustomerRewardHistory,
    quantity: number,
    action: 'sửa' | 'xóa',
  ): CustomerRewardStockAllocation[] {
    const validation = validateCustomerRewardStockAllocations(
      quantity,
      history.stock_allocations,
    );
    if ('error' in validation) {
      throw new BadRequestException(
        `Không thể ${action} quà tặng #${history.id} của sản phẩm #${history.gift_product_id}: ` +
          `lịch sử thiếu hoặc sai phân bổ lô/thuế (stock_allocations); ${validation.error}. ` +
          'Cần đối soát thủ công trước khi thay đổi tồn kho.',
      );
    }
    return validation.allocations;
  }

  private async restoreGiftStockAllocations(
    history: CustomerRewardHistory,
    allocations: CustomerRewardStockAllocation[],
    userId: number,
    queryRunner: QueryRunner,
    action: 'sửa' | 'xóa',
  ): Promise<void> {
    const productId = this.toNumber(history.gift_product_id);
    for (const allocation of allocations) {
      await this.inventoryService.restoreStockToExistingBatch(
        productId,
        allocation.batchId,
        allocation.quantity,
        allocation.taxableQuantity,
        userId,
        history.id,
        `Quà tặng khách hàng #${history.id}`,
        queryRunner,
        'CUSTOMER_REWARD_GIFT_CANCEL',
        `${action === 'sửa' ? 'Điều chỉnh' : 'Xóa'} quà tặng khách hàng #${history.id} - hoàn đúng lô #${allocation.batchId}`,
      );
    }
  }

  private async getDefaultRewardThreshold(manager?: any): Promise<number> {
    const repo = manager ? manager.getRepository(SystemSetting) : this.systemSettingRepository;
    const setting = await repo.findOne({ where: { key: 'reward_threshold' } });
    
    if (setting && !isNaN(Number(setting.value))) {
      return Number(setting.value);
    }
    
    return this.DEFAULT_REWARD_THRESHOLD;
  }

  /**
   * Lấy mốc tích lũy. Ưu tiên mốc riêng của khách, nếu không có thì dùng mặc định.
   */
  async getRewardThreshold(manager?: any, customerId?: number): Promise<number> {
    if (customerId) {
      const trackingRepo = manager
        ? manager.getRepository(CustomerRewardTracking)
        : this.rewardTrackingRepository;
      const tracking = await trackingRepo.findOne({
        where: { customer_id: customerId },
      });
      const customerThreshold = Number(tracking?.reward_threshold || 0);

      if (customerThreshold > 0) {
        return customerThreshold;
      }
    }

    return this.getDefaultRewardThreshold(manager);
  }

  async updateCustomerRewardThreshold(
    customerId: number,
    rewardThreshold?: number | null,
  ) {
    const customer = await this.debtNoteRepository.manager.findOne(Customer, {
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    const normalizedThreshold =
      rewardThreshold === null || rewardThreshold === undefined
        ? null
        : Number(rewardThreshold);

    if (
      normalizedThreshold !== null &&
      (!Number.isFinite(normalizedThreshold) || normalizedThreshold <= 0)
    ) {
      throw new BadRequestException('Mốc tặng quà phải lớn hơn 0');
    }

    const saved = await this.rewardTrackingRepository.manager.transaction(async (manager) => {
      let tracking = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id: customerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tracking) {
        tracking = manager.create(CustomerRewardTracking, {
          customer_id: customerId,
          pending_amount: 0,
          total_accumulated: 0,
          reward_count: 0,
        });
      }

      tracking.reward_threshold = normalizedThreshold;
      return manager.save(tracking);
    });
    const defaultThreshold = await this.getDefaultRewardThreshold();

    return {
      ...saved,
      effective_reward_threshold:
        Number(saved.reward_threshold || 0) > 0
          ? Number(saved.reward_threshold)
          : defaultThreshold,
      default_reward_threshold: defaultThreshold,
    };
  }

  /** Chuẩn hóa danh sách ID khách hàng: bỏ trùng, bỏ giá trị không hợp lệ. */
  private normalizeCustomerIds(customerIds?: number[]): number[] {
    const normalized = (customerIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    return [...new Set(normalized)];
  }

  /** Đọc mốc thời gian từ chuỗi YYYY-MM-DD (hoặc ISO) để lọc theo ngày. */
  private parseDateBoundary(value: string | undefined, endOfDay: boolean): Date | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const normalized =
      raw.length === 10 ? `${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}` : raw;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Xóa "Tích lũy hiện tại" của nhiều khách hàng.
   *
   * - Chỉ đặt lại `pending_amount = 0`; giữ nguyên `total_accumulated`,
   *   `reward_count`, `last_reward_date`, lịch sử quà tặng và sổ tích lũy theo hóa đơn.
   * - Mỗi khách bị xóa được ghi 1 bản ghi `customer_reward_reset_history` để đối soát/khôi phục.
   */
  async resetCustomerAccumulation(dto: ResetCustomerRewardDto, userId: number) {
    const customerIds = this.normalizeCustomerIds(dto?.customer_ids);
    if (!customerIds.length) {
      throw new BadRequestException('Cần chọn ít nhất một khách hàng để xóa tích lũy');
    }

    const reason = String(dto?.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('Vui lòng nhập lý do xóa tích lũy');
    }

    return this.rewardTrackingRepository.manager.transaction(async (manager) => {
      const items: Array<{
        id: number;
        customer_id: number;
        customer_name: string | null;
        customer_phone: string | null;
        pending_before: number;
        total_accumulated_snapshot: number;
        reward_count_snapshot: number;
      }> = [];
      const skipped: Array<{
        customer_id: number;
        reason: string;
      }> = [];
      let totalResetAmount = 0;

      for (const customerId of customerIds) {
        const tracking = await manager.findOne(CustomerRewardTracking, {
          where: { customer_id: customerId },
          lock: { mode: 'pessimistic_write' },
        });
        const pendingBefore = roundRewardMoney(this.toNumber(tracking?.pending_amount));

        if (!tracking || pendingBefore <= 0) {
          skipped.push({
            customer_id: customerId,
            reason: tracking
              ? 'Tích lũy hiện tại đang bằng 0'
              : 'Khách hàng chưa có tích lũy',
          });
          continue;
        }

        const customer = await manager.findOne(Customer, {
          where: { id: customerId },
        });

        const totalSnapshot = roundRewardMoney(
          this.toNumber(tracking.total_accumulated),
        );
        const rewardCountSnapshot = Number(tracking.reward_count || 0);

        // Ghi snapshot trước khi xóa để có thể khôi phục chính xác
        const resetRecord = manager.create(CustomerRewardResetHistory, {
          customer_id: customerId,
          customer_name: customer?.name || null,
          customer_phone: customer?.phone || null,
          pending_before: pendingBefore,
          pending_reset: pendingBefore,
          total_accumulated_snapshot: totalSnapshot,
          reward_count_snapshot: rewardCountSnapshot,
          reason,
          status: CustomerRewardResetStatus.ACTIVE,
          created_by: userId || null,
        });
        const saved = await manager.save(resetRecord);

        tracking.pending_amount = 0;
        await manager.save(tracking);

        totalResetAmount = roundRewardMoney(totalResetAmount + pendingBefore);
        items.push({
          id: saved.id,
          customer_id: customerId,
          customer_name: customer?.name || null,
          customer_phone: customer?.phone || null,
          pending_before: pendingBefore,
          total_accumulated_snapshot: totalSnapshot,
          reward_count_snapshot: rewardCountSnapshot,
        });
      }

      return {
        success: true,
        message:
          items.length > 0
            ? `Đã xóa ${this.formatCurrency(totalResetAmount)} tích lũy của ${items.length} khách hàng`
            : 'Không có khách hàng nào cần xóa tích lũy',
        reset_count: items.length,
        skipped_count: skipped.length,
        total_reset_amount: totalResetAmount,
        items,
        skipped,
      };
    });
  }

  /**
   * Khôi phục phần tích lũy đã xóa: cộng bù lại `pending_reset` vào tích lũy hiện tại.
   * Dùng cách cộng bù để không làm mất phần tích lũy phát sinh sau thời điểm xóa.
   */
  async restoreCustomerAccumulation(resetHistoryId: number, userId: number) {
    const id = Number(resetHistoryId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Mã lịch sử xóa tích lũy không hợp lệ');
    }

    return this.rewardTrackingRepository.manager.transaction(async (manager) => {
      const resetRecord = await manager.findOne(CustomerRewardResetHistory, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!resetRecord) {
        throw new NotFoundException('Không tìm thấy lịch sử xóa tích lũy');
      }
      if (resetRecord.status !== CustomerRewardResetStatus.ACTIVE) {
        throw new BadRequestException(
          'Lần xóa tích lũy này đã được khôi phục trước đó',
        );
      }

      const restoreAmount = roundRewardMoney(this.toNumber(resetRecord.pending_reset));
      const tracking = await this.getLockedRewardTracking(
        manager,
        resetRecord.customer_id,
      );
      tracking.pending_amount = roundRewardMoney(
        this.toNumber(tracking.pending_amount) + restoreAmount,
      );
      await manager.save(tracking);

      resetRecord.status = CustomerRewardResetStatus.RESTORED;
      resetRecord.restored_pending_amount = restoreAmount;
      resetRecord.restored_by = userId || null;
      resetRecord.restored_at = new Date();
      await manager.save(resetRecord);

      return {
        success: true,
        message: `Đã khôi phục ${this.formatCurrency(restoreAmount)} tích lũy cho ${
          resetRecord.customer_name || 'khách hàng'
        }`,
        restored_amount: restoreAmount,
        reward_tracking: {
          customer_id: tracking.customer_id,
          pending_amount: roundRewardMoney(this.toNumber(tracking.pending_amount)),
          total_accumulated: roundRewardMoney(
            this.toNumber(tracking.total_accumulated),
          ),
        },
      };
    });
  }

  /** Tìm kiếm lịch sử xóa tích lũy hiện tại (phân trang, lọc theo khách/trạng thái/ngày). */
  async searchRewardResetHistory(searchDto: SearchRewardResetHistoryDto) {
    const {
      page = 1,
      limit = 10,
      customer_name,
      customer_phone,
      status,
      from_date,
      to_date,
    } = searchDto || {};

    const safePage = Math.max(1, Math.floor(this.toNumber(page)) || 1);
    const safeLimit = Math.min(
      100,
      Math.max(1, Math.floor(this.toNumber(limit)) || 10),
    );

    const queryBuilder = this.rewardTrackingRepository.manager
      .getRepository(CustomerRewardResetHistory)
      .createQueryBuilder('rsh')
      .leftJoinAndSelect('rsh.customer', 'customer')
      .leftJoinAndSelect('rsh.created_by_user', 'created_by_user')
      .leftJoinAndSelect('rsh.restored_by_user', 'restored_by_user')
      .orderBy('rsh.created_at', 'DESC')
      .addOrderBy('rsh.id', 'DESC');

    if (status) {
      queryBuilder.andWhere('rsh.status = :status', { status });
    }

    if (customer_name || customer_phone) {
      const nameKeyword = customer_name
        ? `%${QueryHelper.sanitizeKeyword(customer_name)}%`
        : null;
      const phoneKeyword = customer_phone
        ? `%${QueryHelper.sanitizeKeyword(customer_phone)}%`
        : null;

      queryBuilder.andWhere(
        new Brackets((qb) => {
          if (nameKeyword) {
            qb.orWhere(
              `regexp_replace(unaccent(COALESCE(customer.name, rsh.customer_name)), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`,
              { nameKeyword },
            );
            qb.orWhere(
              `COALESCE(customer.phone, rsh.customer_phone) ILIKE :nameKeyword`,
              { nameKeyword },
            );
          }
          if (phoneKeyword) {
            qb.orWhere(
              `COALESCE(customer.phone, rsh.customer_phone) ILIKE :phoneKeyword`,
              { phoneKeyword },
            );
          }
        }),
      );
    }

    const fromDate = this.parseDateBoundary(from_date, false);
    if (fromDate) {
      queryBuilder.andWhere('rsh.created_at >= :fromDate', { fromDate });
    }
    const toDate = this.parseDateBoundary(to_date, true);
    if (toDate) {
      queryBuilder.andWhere('rsh.created_at <= :toDate', { toDate });
    }

    const [records, total] = await queryBuilder
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      items: records.map((record) => ({
        ...record,
        customer_display_name:
          record.customer?.name || record.customer_name || null,
        customer_display_phone:
          record.customer?.phone || record.customer_phone || null,
        pending_before: this.toNumber(record.pending_before),
        pending_reset: this.toNumber(record.pending_reset),
        total_accumulated_snapshot: this.toNumber(
          record.total_accumulated_snapshot,
        ),
        restored_pending_amount:
          record.restored_pending_amount === null ||
          record.restored_pending_amount === undefined
            ? null
            : this.toNumber(record.restored_pending_amount),
        created_by_name: record.created_by_user?.account || null,
        restored_by_name: record.restored_by_user?.account || null,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getRewardPreviewById(debtNoteId: number, additionalAmount: number = 0) {
    const debtNote = await this.debtNoteRepository.findOne({
      where: { id: debtNoteId },
      relations: ['customer', 'season'],
    });

    if (!debtNote) {
      throw new NotFoundException(`Không tìm thấy phiếu công nợ #${debtNoteId}`);
    }

    return this.getRewardPreview(debtNote, additionalAmount);
  }

  /**
   * Xem trước phần thưởng dựa trên Customer và Season
   */
  async getRewardPreviewBySeason(customerId: number, seasonId: number, additionalAmount: number = 0) {
    let debtNote = await this.debtNoteRepository.findOne({
      where: { customer_id: customerId, season_id: seasonId },
      relations: ['customer', 'season'],
    });

    if (!debtNote) {
      // Nếu chưa có DebtNote, tạo object giả lập để có thể tính tích lũy tồn đọng
      debtNote = {
        customer_id: customerId,
        season_id: seasonId,
        amount: 0,
        reward_count: 0
      } as any;
    }

    return this.getRewardPreview(debtNote!, additionalAmount);
  }

  /**
   * Xem trước phần thưởng tích lũy (Preview)
   */
  async getRewardPreview(debtNote: DebtNote, additionalAmount: number = 0) {
    // 1. Lấy thông tin tích lũy hiện tại (từ các vụ trước đó)
    const rewardTracking = await this.rewardTrackingRepository.findOne({
      where: { customer_id: debtNote.customer_id },
    });

    const previousPending = Number(rewardTracking?.pending_amount || 0);
    
    // Lấy mốc riêng của khách nếu có, nếu không dùng mốc mặc định hệ thống.
    const threshold = await this.getRewardThreshold(undefined, debtNote.customer_id);
    
    let seasonPaidContribution = Number(debtNote.paid_amount || 0);
    let additionalContribution = 0;
    const invoiceIds = (debtNote.source_invoices || []).map(Number);
    const manager = this.debtNoteRepository.manager;
    if (invoiceIds.length) {
      const invoices = await manager.find(SalesInvoice, {
        where: { id: In(invoiceIds), customer_id: debtNote.customer_id },
        order: { created_at: 'ASC', id: 'ASC' },
      });
      const tracking = await manager.find(CustomerRewardInvoiceTracking, {
        where: { invoice_id: In(invoiceIds), customer_id: debtNote.customer_id },
      });
      seasonPaidContribution = tracking.reduce((sum, row) => sum + Number(row.accumulated_amount || 0), 0);
      let remaining = Math.max(0, Number(additionalAmount || 0));
      for (const invoice of invoices) {
        if (remaining <= 0) break;
        if (![SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID].includes(invoice.status)) continue;
        const allocated = Math.min(remaining, Math.max(0, Number(invoice.remaining_amount || 0)));
        if (allocated <= 0) continue;
        const { items, returns } = await this.getInvoiceRewardInputs(manager, invoice);
        const paid = Number(invoice.partial_payment_amount || 0);
        additionalContribution += calculateInvoiceRewardAccumulation(invoice, items, returns, paid + allocated)
          - calculateInvoiceRewardAccumulation(invoice, items, returns, paid);
        remaining = roundRewardMoney(remaining - allocated);
      }
    } else if (debtNote.id) {
      // Công nợ nhập tay không có chi tiết sản phẩm giữ cách tính hiện tại.
      additionalContribution = Math.min(Math.max(0, Number(additionalAmount || 0)), Number(debtNote.remaining_amount || 0));
    }
    additionalContribution = roundRewardMoney(additionalContribution);
    // pending đã chứa tiền tích lũy từ các lần trả trước; chỉ cộng khoản dự kiến mới.
    const totalAfterClose = roundRewardMoney(previousPending + additionalContribution);

    // 2. Tính toán số lần tặng quà
    const rewardCount = Math.floor(totalAfterClose / threshold);
    const remainingAmount = totalAfterClose;
    const shortageToNext = Math.max(0, threshold - totalAfterClose);

    // 3. Lấy lịch sử các vụ đã trả hết (PAID/SETTLED)
    const accumulationHistory = await this.debtNoteRepository.find({
      where: { 
        customer_id: debtNote.customer_id,
        status: DebtNoteStatus.PAID // Bao gồm cả Đã thanh toán
      },
      relations: ['season'],
      order: { closed_at: 'DESC' },
      take: 20
    });

    // 4. Lấy lịch sử đã nhận quà trước đó
    const previousRewards = await this.rewardHistoryRepository.find({
      where: { customer_id: debtNote.customer_id },
      order: { reward_date: 'DESC' },
      take: 20,
    });

    return {
      customer: {
        id: debtNote.customer?.id,
        name: debtNote.customer?.name,
        phone: debtNote.customer?.phone,
      },
      current_season: {
        id: debtNote.season?.id,
        name: debtNote.season?.name,
        debt_amount: Number(debtNote.amount || 0), // 🔥 Trả về đúng giá trị đơn nợ thực tế
        paid_amount: Number(debtNote.paid_amount || 0),
        remaining_amount: Number(debtNote.remaining_amount || 0),
        status: debtNote.status,
        paid_contribution: seasonPaidContribution,
        additional_contribution: additionalContribution,
        gift_description: debtNote.gift_description, 
        gift_value: Number(debtNote.gift_value || 0),
      },
      accumulation_history: accumulationHistory.map(dn => ({
        id: dn.id,
        season_name: dn.season?.name || 'Không rõ vụ',
        amount: Number(dn.amount),
        closed_at: dn.closed_at,
        reward_given: dn.reward_given,
        reward_count: dn.reward_count
      })),
      summary: {
        previous_pending: previousPending, 
        current_paid: additionalContribution,
        additional_contribution: additionalContribution,
        total_after_close: totalAfterClose, 
        reward_threshold: threshold,
        reward_count: rewardCount,
        remaining_amount: remainingAmount,
        shortage_to_next: shortageToNext,
        will_receive_reward: rewardCount > 0,
        current_status: debtNote.status,
      },
      previous_rewards: previousRewards.map(r => ({
        id: r.id,
        reward_date: r.reward_date,
        accumulated_amount: Number(r.accumulated_amount),
        gift_description: r.gift_description,
        gift_value: Number(r.gift_value || 0),
        season_names: r.season_names,
      })),
    };
  }

  /**
   * Tạo phiếu chi phí nông nghiệp cho quà tặng
   */
  async createGiftFarmServiceCost(params: {
    customer_id: number;
    debtNoteCode: string;
    customerName: string;
    season_id: number;
    seasonName?: string | null | undefined;
    rewardCount: number;
    giftValue: number;
    giftDescription?: string | null | undefined;
    totalAccumulated: number;
    manager: any;
    reward_history_id?: number | null | undefined;
    rice_crop_id?: number | null | undefined;
    gift_product_id?: number | null | undefined;
    gift_product_name?: string | null | undefined;
    gift_quantity?: number | null | undefined;
    gift_unit_price?: number | null | undefined;
    inventory_transaction_id?: number | null | undefined;
  }): Promise<FarmGiftCost | null> {
    try {
      const costName = `Quà tặng tri ân - ${params.customerName}`;
      const descriptionParts = [
        params.giftDescription ? `Quà: ${params.giftDescription}` : 'Quà tặng khi thanh toán',
        params.seasonName ? `Mùa vụ: ${params.seasonName}` : '',
        `Tích lũy: ${this.formatCurrency(params.totalAccumulated)}`,
        `Số lần tặng: ${params.rewardCount}`,
        `Mã phiếu: ${params.debtNoteCode}`,
      ].filter(Boolean).join(' | ');

      return await this.farmGiftCostService.create({
        name: costName,
        amount: params.giftValue * params.rewardCount,
        product_id: params.gift_product_id || undefined,
        product_name: params.gift_product_name || undefined,
        quantity: params.gift_quantity || undefined,
        unit_price: params.gift_unit_price || undefined,
        season_id: params.season_id,
        customer_id: params.customer_id,
        rice_crop_id: params.rice_crop_id || undefined,
        notes: descriptionParts,
        gift_date: new Date().toISOString(),
        source: 'reward_from_debt_note',
        reward_history_id: params.reward_history_id || undefined,
        inventory_transaction_id: params.inventory_transaction_id || undefined,
      }, params.manager);
    } catch (error) {
      // Log error but don't stop process
      console.error('❌ Lỗi khi tạo phiếu chi phí quà tặng:', error);
      return null;
    }
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  }

  /** Khởi tạo có chống trùng rồi khóa, kể cả khi hai hóa đơn đầu tiên được thu tiền đồng thời. */
  private async getLockedRewardTracking(manager: EntityManager, customerId: number) {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new BadRequestException('Ghi tích lũy cần transaction đang hoạt động');
    }
    await manager.createQueryBuilder().insert().into(CustomerRewardTracking).values({
      customer_id: customerId, pending_amount: 0, total_accumulated: 0, reward_count: 0,
    }).orIgnore().execute();
    return manager.findOneOrFail(CustomerRewardTracking, {
      where: { customer_id: customerId }, lock: { mode: 'pessimistic_write' },
    });
  }

  /** Chốt cờ từ sản phẩm khi xác nhận; chứng từ cũ giữ phiên bản chính sách cũ. */
  async snapshotInvoiceRewardPolicy(manager: EntityManager, invoice: SalesInvoice): Promise<void> {
    if (Number(invoice.reward_policy_version || 0) !== 1) return;
    this.getTransactionalQueryRunner(manager);
    const items = await manager.find(SalesInvoiceItem, { where: { invoice_id: invoice.id } });
    const productIds = [...new Set(items.map((item) => item.product_id))];
    if (!productIds.length) throw new BadRequestException('Hóa đơn chưa có sản phẩm để chốt tích lũy');
    const products = await manager.find(Product, { where: { id: In(productIds) } });
    const excludedByProduct = new Map(products.map((product) => [product.id, product.exclude_from_reward === true]));
    for (const item of items) {
      if (!excludedByProduct.has(item.product_id)) {
        throw new BadRequestException(`Không tìm thấy sản phẩm #${item.product_id} để chốt tích lũy`);
      }
      await manager.update(SalesInvoiceItem, item.id, {
        exclude_from_reward: excludedByProduct.get(item.product_id)!,
      });
    }
  }

  /** Lấy giá trị dòng hàng và phần trả hàng đã duyệt để tính cùng một quy tắc ở preview/ghi sổ. */
  private async getInvoiceRewardInputs(manager: EntityManager, invoice: SalesInvoice) {
    const items = await manager.find(SalesInvoiceItem, { where: { invoice_id: invoice.id } });
    if (Number(invoice.reward_policy_version || 0) === 1 &&
      [SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID].includes(invoice.status) && !items.length) {
      throw new BadRequestException('Hóa đơn thiếu dòng sản phẩm để tính tích lũy');
    }
    const returns = Number(invoice.reward_policy_version || 0) === 1
      ? await manager.createQueryBuilder(SalesReturnItem, 'item')
        .innerJoin(SalesReturn, 'header', 'header.id = item.sales_return_id')
        .where('header.invoice_id = :invoiceId', { invoiceId: invoice.id })
        .andWhere('header.status = :status', { status: SalesReturnStatus.APPROVED })
        .getMany()
      : [];
    for (const returned of returns) {
      if (returned.sales_invoice_item_id) {
        if (!items.some((item) => item.id === returned.sales_invoice_item_id)) {
          throw new BadRequestException('Dòng trả hàng không thuộc hóa đơn cần tính tích lũy');
        }
        continue;
      }
      const matches = items.filter((item) => item.product_id === returned.product_id &&
        (!returned.sale_unit_id || item.sale_unit_id === returned.sale_unit_id));
      const match = matches[0];
      if (matches.length !== 1 || !match) {
        throw new BadRequestException('Dòng trả hàng thiếu liên kết hóa đơn để đối soát tích lũy');
      }
      returned.sales_invoice_item_id = match.id;
    }
    return { items, returns };
  }

  /**
   * Ghi mốc tích lũy từng hóa đơn và trả về duy nhất phần chênh lệch.
   * Khóa hóa đơn trước sổ theo dõi để thu tiền/hoàn hủy trong cùng transaction.
   */
  async collectInvoiceRewardDelta(
    manager: EntityManager,
    customerId: number,
    invoiceIds: number[],
  ): Promise<number> {
    this.getTransactionalQueryRunner(manager);
    let delta = 0;
    const ids = [...new Set(invoiceIds.map(Number))].sort((a, b) => a - b);
    for (const id of ids) {
      const invoice = await manager.findOne(SalesInvoice, {
        where: { id }, lock: { mode: 'pessimistic_write' },
      });
      if (!invoice || invoice.customer_id !== customerId) {
        throw new BadRequestException(`Hóa đơn #${id} không thuộc khách hàng cần tính tích lũy`);
      }
      let tracking = await manager.findOne(CustomerRewardInvoiceTracking, {
        where: { invoice_id: id }, lock: { mode: 'pessimistic_write' },
      });
      if (!tracking) {
        if (Number(invoice.reward_policy_version || 0) === 0) {
          throw new BadRequestException('Hóa đơn cũ chưa có mốc đối chiếu tích lũy; cần hoàn tất migration trước khi thanh toán');
        }
        tracking = manager.create(CustomerRewardInvoiceTracking, {
          invoice_id: id, customer_id: customerId, accumulated_amount: 0,
        });
      }
      const { items, returns } = await this.getInvoiceRewardInputs(manager, invoice);
      const target = calculateInvoiceRewardAccumulation(invoice, items, returns);
      if (!Number.isFinite(target)) {
        throw new BadRequestException('Giá trị tích lũy hóa đơn không hợp lệ');
      }
      delta += target - Number(tracking.accumulated_amount || 0);
      tracking.accumulated_amount = target;
      await manager.save(tracking);
    }
    return roundRewardMoney(delta);
  }

  /** Đồng bộ tích lũy kể cả hóa đơn mới không gắn mùa vụ hoặc phiếu công nợ. */
  async syncInvoiceReward(manager: EntityManager, invoiceId: number): Promise<void> {
    const invoice = await manager.findOne(SalesInvoice, { where: { id: invoiceId } });
    if (!invoice?.customer_id) return;
    // Hóa đơn cũ không có mùa vụ vốn chưa được ghi tích lũy, tiếp tục giữ lịch sử đó.
    if (!invoice.season_id && Number(invoice.reward_policy_version || 0) === 0) return;
    const delta = await this.collectInvoiceRewardDelta(manager, invoice.customer_id, [invoiceId]);
    if (!delta) return;
    const tracking = await this.getLockedRewardTracking(manager, invoice.customer_id);
    tracking.pending_amount = roundRewardMoney(Number(tracking.pending_amount || 0) + delta);
    tracking.total_accumulated = roundRewardMoney(Number(tracking.total_accumulated || 0) + delta);
    await manager.save(tracking);
  }

  /** Phân bổ tiền trả công nợ vào hóa đơn thật, cùng thứ tự cũ nhất trước như luồng thu nợ. */
  async allocateDebtNotePayment(
    manager: EntityManager,
    debtNote: DebtNote,
    amount: number,
    paymentId: number,
  ) {
    this.getTransactionalQueryRunner(manager);
    const ids = (debtNote.source_invoices || []).map(Number);
    if (!ids.length) return { allocations: [] as PaymentAllocation[], snapshots: [] as Record<string, unknown>[] };
    const invoices = await manager.createQueryBuilder(SalesInvoice, 'invoice')
      .where('invoice.id IN (:...ids)', { ids })
      .andWhere('invoice.customer_id = :customerId', { customerId: debtNote.customer_id })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID],
      })
      .orderBy('invoice.created_at', 'ASC').addOrderBy('invoice.id', 'ASC')
      .setLock('pessimistic_write').getMany();
    let remaining = roundRewardMoney(amount);
    const allocations: PaymentAllocation[] = [];
    const snapshots: Record<string, unknown>[] = [];
    for (const invoice of invoices) {
      if (remaining <= 0) break;
      const allocated = Math.min(remaining, Math.max(0, Number(invoice.remaining_amount || 0)));
      if (allocated <= 0) continue;
      const before = {
        partial_payment_amount: Number(invoice.partial_payment_amount || 0),
        remaining_amount: Number(invoice.remaining_amount || 0),
        status: invoice.status, payment_status: invoice.payment_status,
      };
      invoice.partial_payment_amount = roundRewardMoney(before.partial_payment_amount + allocated);
      invoice.remaining_amount = roundRewardMoney(before.remaining_amount - allocated);
      invoice.status = invoice.remaining_amount <= 0 ? SalesInvoiceStatus.PAID : SalesInvoiceStatus.CONFIRMED;
      invoice.payment_status = invoice.remaining_amount <= 0 ? SalesPaymentStatus.PAID : SalesPaymentStatus.PARTIAL;
      await manager.save(invoice);
      allocations.push(await manager.save(manager.create(PaymentAllocation, {
        payment_id: paymentId, invoice_id: invoice.id, debt_note_id: debtNote.id,
        allocation_type: 'invoice', amount: allocated,
      })));
      snapshots.push({ invoice_id: invoice.id, before, after: {
        partial_payment_amount: invoice.partial_payment_amount,
        remaining_amount: invoice.remaining_amount,
        status: invoice.status, payment_status: invoice.payment_status,
      } });
      remaining = roundRewardMoney(remaining - allocated);
    }
    if (remaining > 0) {
      throw new BadRequestException('Tiền trả công nợ vượt phần nợ hóa đơn có thể phân bổ; cần đối soát trước khi thu');
    }
    return { allocations, snapshots };
  }

  /**
   * Xử lý quà tặng và tích lũy khi thanh toán/tất toán
   * Được gọi từ DebtNoteService/PaymentService trong một Transaction
   */
  async handleDebtNoteSettlement(
    manager: any, // EntityManager từ transaction
    debtNote: DebtNote,
    closeData: any, // CloseSeasonDebtNoteDto (sử dụng any để tránh import vòng)
    _userId: number,
    isFinal: boolean = true
  ) {
    // 0. Bỏ qua nếu không có khách hàng (khách vãng lai)
    if (!debtNote.customer_id) {
      return null;
    }

    const paymentAmount = Number(closeData.payment_amount || 0);
    const invoiceIds: number[] = closeData.invoice_ids ?? debtNote.source_invoices ?? [];
    const totalNewContribution = invoiceIds.length
      ? await this.collectInvoiceRewardDelta(manager, debtNote.customer_id, invoiceIds)
      : paymentAmount;

    // 1. Lấy hoặc tạo bản ghi tích lũy
    const rewardTracking = await this.getLockedRewardTracking(manager, debtNote.customer_id);

    const previousPending = Number(rewardTracking.pending_amount);
    const totalAccumulated = roundRewardMoney(previousPending + totalNewContribution);

    const threshold = await this.getRewardThreshold(manager, debtNote.customer_id);

    // 3. Chỉ tính số mốc đã đủ điều kiện để thông báo.
    // Việc tạo lịch sử/chi phí quà tặng phải do admin bấm "Tặng quà"
    // ở trang customer-rewards, không tự động khi chốt công nợ.
    const autoRewardCount = Math.floor(totalAccumulated / threshold);
    const remainingAccumulated = totalAccumulated;
    const historyIds: number[] = [];
    const giftCostIds: number[] = [];
    const inventoryTransactionIds: number[] = [];

    // 4. Cập nhật bản ghi tích lũy. Không khấu trừ ở bước chốt nợ.
    if (totalNewContribution !== 0 || isFinal) {
      rewardTracking.pending_amount = remainingAccumulated;
      rewardTracking.total_accumulated = roundRewardMoney(Number(rewardTracking.total_accumulated) + totalNewContribution);
    }
    
    await manager.save(rewardTracking);
    await manager.save(debtNote);

    // Trả về thông tin tóm tắt để các Service khác phản hồi cho Frontend
    return {
      previous_pending: previousPending,
      payment_received: paymentAmount,
      accumulation_contribution: totalNewContribution,
      total_accumulated_after: totalAccumulated,
      reward_given: false,
      reward_count: 0,
      eligible_reward_count: autoRewardCount,
      remaining_accumulated: remainingAccumulated,
      reward_history_ids: historyIds,
      gift_cost_ids: giftCostIds,
      inventory_transaction_ids: inventoryTransactionIds,
      message: this.generateCloseMessage(0, remainingAccumulated, threshold),
    };
  }

  private generateCloseMessage(deducted: number, remaining: number, threshold: number): string {
    if (deducted === 0) {
      if (remaining >= threshold) {
        const eligibleCount = Math.floor(remaining / threshold);
        return `Thanh toán thành công. Khách đã đủ ${eligibleCount} mốc tặng quà; vui lòng tạo quà tại trang Chăm sóc khách hàng & Quà tặng.`;
      }

      const shortage = threshold - remaining;
      return `Thanh toán thành công. Còn ${this.formatCurrency(shortage)} nữa để đạt mốc tặng quà (${this.formatCurrency(threshold)}).`;
    } else {
      return `🎉 Thanh toán thành công và đã tặng quà. Đã trừ ${this.formatCurrency(deducted)} tích lũy. Số dư: ${this.formatCurrency(remaining)}`;
    }
  }

  /**
   * Tìm kiếm thông tin tích lũy của khách hàng
   */
  async searchRewardTracking(searchDto: SearchRewardDto) {
    const { page = 1, limit = 10, customer_name, customer_phone } = searchDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.rewardTrackingRepository.createQueryBuilder('rt')
      .leftJoinAndSelect('rt.customer', 'customer')
      .orderBy('rt.total_accumulated', 'DESC');

    if (customer_name || customer_phone) {
      const nameKeyword = customer_name ? `%${QueryHelper.sanitizeKeyword(customer_name)}%` : null;
      const phoneKeyword = customer_phone ? `%${QueryHelper.sanitizeKeyword(customer_phone)}%` : null;

      queryBuilder.andWhere(new Brackets(qb => {
        if (nameKeyword) {
          qb.orWhere(`regexp_replace(unaccent(customer.name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`, { nameKeyword });
          qb.orWhere(`customer.phone ILIKE :nameKeyword`, { nameKeyword });
        }
        if (phoneKeyword) {
          qb.orWhere(`customer.phone ILIKE :phoneKeyword`, { phoneKeyword });
        }
      }));
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const threshold = await this.getDefaultRewardThreshold();
    const itemsWithThreshold = items.map((item) => {
      const itemThreshold = Number(item.reward_threshold || 0);
      const effectiveThreshold = itemThreshold > 0 ? itemThreshold : threshold;

      return {
        ...item,
        effective_reward_threshold: effectiveThreshold,
        shortage_to_next: Math.max(
          0,
          effectiveThreshold - Number(item.pending_amount || 0),
        ),
      };
    });

    return {
      items: itemsWithThreshold,
      total,
      page,
      limit,
      reward_threshold: threshold,
    };
  }

  /**
   * Truy vấn lịch sử quà tặng tập trung
   */
  async searchRewardHistory(searchDto: SearchRewardDto) {
    const { page = 1, limit = 10, customer_name, customer_phone, reward_type } = searchDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.rewardHistoryRepository.createQueryBuilder('rh')
      .leftJoinAndSelect('rh.customer', 'customer')
      .orderBy('rh.reward_date', 'DESC');

    if (reward_type) {
      if (reward_type === 'ACCUMULATION_REWARD') {
        // Tương thích với các bản ghi cũ chưa có reward_type
        queryBuilder.andWhere('(rh.reward_type IS NULL OR rh.reward_type = :reward_type)', { reward_type });
      } else {
        queryBuilder.andWhere('rh.reward_type = :reward_type', { reward_type });
      }
    }

    if (customer_name || customer_phone) {
      const nameKeyword = customer_name ? `%${QueryHelper.sanitizeKeyword(customer_name)}%` : null;
      const phoneKeyword = customer_phone ? `%${QueryHelper.sanitizeKeyword(customer_phone)}%` : null;

      queryBuilder.andWhere(new Brackets(qb => {
        if (nameKeyword) {
          qb.orWhere(`rh.customer_name ILIKE :nameKeyword`, { nameKeyword });
          qb.orWhere(`customer.phone ILIKE :nameKeyword`, { nameKeyword });
        }
        if (phoneKeyword) {
          qb.orWhere(`customer.phone ILIKE :phoneKeyword`, { phoneKeyword });
        }
      }));
    }

    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy thông tin tích lũy của chính tôi (Dành cho nông dân đăng nhập bên NextJS)
   */
  async getMyRewardTracking(customerId: number) {
    const tracking = await this.rewardTrackingRepository.findOne({
      where: { customer_id: customerId },
      relations: ['customer'],
    });

    const threshold = await this.getRewardThreshold(undefined, customerId);

    if (!tracking) {
      return {
        pending_amount: 0,
        total_accumulated: 0,
        reward_count: 0,
        reward_threshold: threshold, 
        effective_reward_threshold: threshold,
        shortage_to_next: threshold,
      };
    }

    return {
      ...tracking,
      reward_threshold: threshold,
      effective_reward_threshold: threshold,
      shortage_to_next: Math.max(0, threshold - Number(tracking.pending_amount)),
    };
  }

  /**
   * Lấy lịch sử quà tặng của chính tôi (Dành cho nông dân đăng nhập bên NextJS)
   * Ẩn giá trị thực tế của quà tặng (gift_value)
   */
  async getMyRewardHistory(customerId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.rewardHistoryRepository.findAndCount({
      where: { customer_id: customerId },
      order: { reward_date: 'DESC' },
      skip,
      take: limit,
    });

    // 🔥 Bảo mật: Xóa gift_value trước khi trả về cho nông dân
    const safeItems = items.map(item => {
      const { gift_value, stock_allocations, ...safeItem } = item;
      return safeItem;
    });

    return {
      items: safeItems,
      total,
      page,
      limit,
    };
  }

  /**
   * Tạo quà tặng thủ công cho khách hàng
   */
  async manualCreate(dto: CreateManualRewardDto, userId: number) {
    const { 
        customer_id, 
        gift_description, 
        notes, 
        season_id,
        rice_crop_id
    } = dto;
    let resolvedGiftValue = this.toNumber(dto.gift_value);
    const giftProductId = this.toNumber(dto.gift_product_id);
    const giftQuantity = this.toNumber(dto.gift_quantity);
    const giftUnitPrice = this.toNumber(dto.gift_unit_price);
    const giftStatus = dto.gift_status || 'delivered';
    let giftProductName: string | null = null;

    const customer = await this.debtNoteRepository.manager.findOne(Customer, {
      where: { id: customer_id }
    });

    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    if (giftProductId > 0) {
      if (giftQuantity <= 0) {
        throw new BadRequestException('Số lượng sản phẩm quà phải lớn hơn 0');
      }
      if (giftUnitPrice < 0) {
        throw new BadRequestException('Đơn giá sản phẩm quà không được âm');
      }

      const product = await this.debtNoteRepository.manager.findOne(Product, {
        where: { id: giftProductId },
      });
      if (!product) {
        throw new NotFoundException('Không tìm thấy sản phẩm quà tặng');
      }
      if (Number(product.quantity || 0) < giftQuantity) {
        throw new BadRequestException(
          `Không đủ tồn kho sản phẩm quà. Hiện có: ${Number(product.quantity || 0)}, yêu cầu: ${giftQuantity}`,
        );
      }

      giftProductName = product.trade_name || product.name || `Sản phẩm #${giftProductId}`;
      resolvedGiftValue = Math.round(giftQuantity * giftUnitPrice);
    }

    // Lấy thông tin mùa vụ và ruộng lúa nếu có
    let seasonName = '';
    let riceCropName = '';

    if (season_id) {
        const season = await this.debtNoteRepository.manager.findOne(Season, { where: { id: season_id } });
        seasonName = season?.name || '';
    }

    if (rice_crop_id) {
        const riceCrop = await this.debtNoteRepository.manager.findOne(RiceCrop, { where: { id: rice_crop_id } });
        riceCropName = riceCrop?.field_name || '';
    }

    const threshold = await this.getRewardThreshold(undefined, customer_id);

    return await this.debtNoteRepository.manager.transaction(async (manager) => {
      // 1. Tạo bản ghi lịch sử quà tặng ban đầu
      const history = manager.create(CustomerRewardHistory, {
        customer_id,
        customer_name: (customer as any).name,
        reward_threshold: dto.reward_type === 'APPRECIATION_GIFT' ? 0 : threshold,
        accumulated_amount: 0,
        reward_date: new Date(),
        gift_description: giftProductName && !gift_description ? giftProductName : gift_description,
        gift_value: resolvedGiftValue || 0,
        gift_product_id: giftProductId > 0 ? giftProductId : null,
        gift_product_name: giftProductName,
        gift_quantity: giftProductId > 0 ? giftQuantity : null,
        stock_allocations: giftProductId > 0 ? [] : null,
        gift_unit_price: giftProductId > 0 ? giftUnitPrice : null,
        gift_status: giftStatus,
        delivered_date: dto.gift_status === 'delivered' || !dto.gift_status ? new Date() : undefined,
        reward_type: dto.reward_type || 'ACCUMULATION_REWARD',
        notes: notes || 'Tặng quà thủ công',
        created_by: userId,
        season_ids: season_id ? [season_id] : [],
        season_names: seasonName ? [seasonName] : [],
        rice_crop_id: rice_crop_id ?? null,
        rice_crop_name: riceCropName ?? null,
      } as any);

      // 2. Cập nhật bảng tracking tích lũy
      let tracking = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tracking) {
        tracking = manager.create(CustomerRewardTracking, {
          customer_id: customer_id,
          pending_amount: 0,
          total_accumulated: 0,
          reward_count: 0
        });
      }

      // 🔥 CHỈ TRỪ TÍCH LŨY NẾU LÀ QUÀ TÍCH LŨY
      if (history.reward_type === 'ACCUMULATION_REWARD') {
        const REWARD_VALUE_FOR_THRESHOLD = 1000000;
        const validGiftValue = Number(resolvedGiftValue || 0);
        const amountToDeduct = (validGiftValue / REWARD_VALUE_FOR_THRESHOLD) * threshold;
        
        // 🔄 Cập nhật lại lịch sử với mốc tích lũy THỰC TẾ lúc đó và ghi chú tự động
        const autoNote = `Tặng quà mốc tích lũy. Đã trừ ${this.formatCurrency(amountToDeduct)} tích lũy tương ứng với quà trị giá ${this.formatCurrency(validGiftValue)}.`;
        history.accumulated_amount = Number(tracking.pending_amount || 0); 
        history.notes = notes ? `${notes} | ${autoNote}` : autoNote;

        // Cập nhật pending_amount (không để âm)
        tracking.pending_amount = Math.max(0, Number(tracking.pending_amount || 0) - amountToDeduct);
        
        // Tăng reward_count chỉ cho quà tích lũy
        tracking.reward_count = Number(tracking.reward_count || 0) + 1;
        tracking.last_reward_date = new Date();
      } else {
        // Quà tri ân lẻ: Chỉ dùng ghi chú người dùng nhập
        history.accumulated_amount = Number(tracking.pending_amount || 0);
        history.notes = notes || 'Tặng quà tri ân';
      }

      await manager.save(tracking);
      const savedHistory = await manager.save(history);

      let inventoryTransactionId: number | undefined;
      if (giftProductId > 0 && giftStatus === 'delivered') {
        const stockOutResult = await this.inventoryService.processStockOut(
          giftProductId,
          giftQuantity,
          'CUSTOMER_REWARD_GIFT',
          userId,
          savedHistory.id,
          `Xuất kho quà tặng khách hàng ${customer.name || customer_id}: ${giftProductName}`,
          this.getTransactionalQueryRunner(manager),
          { requireBatchTaxSnapshot: true },
        );
        savedHistory.stock_allocations = this.createGiftStockAllocations(
          giftQuantity,
          stockOutResult.taxableQuantity,
          stockOutResult.affectedBatches,
        );
        inventoryTransactionId = stockOutResult.transaction.id;
        savedHistory.gift_inventory_transaction_id = inventoryTransactionId;
        await manager.save(savedHistory);
      }

      // 3. Tạo phiếu chi phí nếu có giá trị quà và có mùa vụ
      if (resolvedGiftValue && resolvedGiftValue > 0 && season_id) {
        await this.createGiftFarmServiceCost({
            customer_id,
            debtNoteCode: 'MANUAL_REWARD',
            customerName: (customer as any).name || 'Khách hàng',
            season_id,
            seasonName,
            rewardCount: 1,
            giftValue: resolvedGiftValue,
            giftDescription: giftProductName && !gift_description ? giftProductName : gift_description,
            totalAccumulated: 0,
            manager,
            reward_history_id: savedHistory.id,
            rice_crop_id: rice_crop_id || null,
            gift_product_id: giftProductId > 0 ? giftProductId : null,
            gift_product_name: giftProductName,
            gift_quantity: giftProductId > 0 ? giftQuantity : null,
            gift_unit_price: giftProductId > 0 ? giftUnitPrice : null,
            inventory_transaction_id: inventoryTransactionId || null,
        });
      }

      return savedHistory;
    });
  }

  /**
   * Cập nhật thông tin lịch sử quà tặng
   */
  async updateHistory(id: number, dto: CreateManualRewardDto, _userId: number) {
    return await this.rewardHistoryRepository.manager.transaction(async (manager) => {
      const queryRunner = this.getTransactionalQueryRunner(manager);
      const history = await manager.findOne(CustomerRewardHistory, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!history) throw new NotFoundException('Không tìm thấy lịch sử quà tặng');

      const oldProductId = this.toNumber(history.gift_product_id);
      const oldQuantity = this.toNumber(history.gift_quantity);
      const oldUnitPrice = this.toNumber(history.gift_unit_price);
      const nextProductId = dto.gift_product_id !== undefined
        ? this.toNumber(dto.gift_product_id) : oldProductId;
      const nextQuantity = dto.gift_quantity !== undefined
        ? this.toNumber(dto.gift_quantity) : oldQuantity;
      const nextUnitPrice = dto.gift_unit_price !== undefined
        ? this.toNumber(dto.gift_unit_price) : oldUnitPrice;
      const nextGiftStatus = dto.gift_status || history.gift_status;
      const stockChanged =
        oldProductId !== nextProductId ||
        oldQuantity !== nextQuantity ||
        (history.gift_status === 'delivered') !== (nextGiftStatus === 'delivered');
      let inventoryTransactionId = history.gift_inventory_transaction_id || null;
      let stockAllocations = history.stock_allocations ?? null;
      let nextProductName: string | null = history.gift_product_name || null;
      let resolvedGiftValue = this.toNumber(dto.gift_value ?? history.gift_value);

      if (nextProductId > 0) {
        if (nextQuantity <= 0) {
          throw new BadRequestException('Số lượng sản phẩm quà phải lớn hơn 0');
        }
        if (nextUnitPrice < 0) {
          throw new BadRequestException('Đơn giá sản phẩm quà không được âm');
        }
        const product = await manager.findOne(Product, { where: { id: nextProductId } });
        if (!product) throw new NotFoundException('Không tìm thấy sản phẩm quà tặng');
        nextProductName = product.trade_name || product.name || `Sản phẩm #${nextProductId}`;
        resolvedGiftValue = Math.round(nextQuantity * nextUnitPrice);
      } else {
        nextProductName = null;
      }

      if (oldProductId > 0 && oldQuantity > 0 && stockChanged) {
        const oldAllocations = history.stock_allocations;
        if (!Array.isArray(oldAllocations)) {
          this.getExistingGiftStockAllocations(history, oldQuantity, 'sửa');
          throw new BadRequestException(`Không thể sửa quà tặng #${id}: thiếu snapshot tồn kho.`);
        }
        if (history.gift_status === 'delivered') {
          const allocations = this.getExistingGiftStockAllocations(history, oldQuantity, 'sửa');
          await this.restoreGiftStockAllocations(history, allocations, _userId, queryRunner, 'sửa');
        } else if (oldAllocations.length > 0) {
          throw new BadRequestException(
            `Không thể sửa quà tặng #${id}: trạng thái '${history.gift_status}' không khớp ` +
              'snapshot lô còn hàng. Cần đối soát trước khi thay đổi tồn kho.',
          );
        }
        inventoryTransactionId = null;
        stockAllocations = nextProductId > 0 ? [] : null;
      }

      if (nextProductId > 0 && nextGiftStatus === 'delivered' && stockChanged) {
        const stockOutResult = await this.inventoryService.processStockOut(
          nextProductId,
          nextQuantity,
          'CUSTOMER_REWARD_GIFT',
          _userId,
          id,
          `Xuất kho quà tặng khách hàng ${history.customer_name || history.customer_id}: ${nextProductName}`,
          queryRunner,
          { requireBatchTaxSnapshot: true },
        );
        inventoryTransactionId = stockOutResult.transaction.id;
        stockAllocations = this.createGiftStockAllocations(
          nextQuantity,
          stockOutResult.taxableQuantity,
          stockOutResult.affectedBatches,
        );
      } else if (nextProductId <= 0 || (stockChanged && nextGiftStatus !== 'delivered')) {
        stockAllocations = nextProductId > 0 ? [] : null;
        inventoryTransactionId = null;
      }

      // Cập nhật thông tin mùa vụ và ruộng lúa nếu có
      if (dto.season_id) {
        const season = await manager.findOne(Season, { where: { id: dto.season_id } });
        if (season) {
          history.season_ids = [dto.season_id];
          history.season_names = [season.name];
        }
      }

      if (dto.rice_crop_id) {
        const riceCrop = await manager.findOne(RiceCrop, { where: { id: dto.rice_crop_id } });
        if (riceCrop) {
          history.rice_crop_id = dto.rice_crop_id;
          history.rice_crop_name = riceCrop.field_name;
        }
      }

      Object.assign(history, {
        gift_description: nextProductName && !dto.gift_description ? nextProductName : dto.gift_description,
        gift_value: resolvedGiftValue,
        gift_product_id: nextProductId > 0 ? nextProductId : null,
        gift_product_name: nextProductName,
        gift_quantity: nextProductId > 0 ? nextQuantity : null,
        gift_unit_price: nextProductId > 0 ? nextUnitPrice : null,
        gift_inventory_transaction_id: inventoryTransactionId,
        stock_allocations: stockAllocations,
        notes: dto.notes,
        gift_status: nextGiftStatus,
        delivered_date: nextGiftStatus === 'delivered' ? new Date() : history.delivered_date,
      });

      const saved = await manager.save(history);

      // Cập nhật chi phí tương ứng nếu có
      const giftCost = await manager.findOne(FarmGiftCost, {
        where: { reward_history_id: id }
      });

      if (giftCost) {
        giftCost.name = `Quà tặng tri ân - ${history.customer_name}`;
        giftCost.amount = resolvedGiftValue || 0;
        giftCost.notes = dto.gift_description;
        giftCost.product_id = nextProductId > 0 ? nextProductId : null;
        giftCost.product_name = nextProductName;
        giftCost.quantity = nextProductId > 0 ? nextQuantity : null;
        giftCost.unit_price = nextProductId > 0 ? nextUnitPrice : null;
        giftCost.inventory_transaction_id = inventoryTransactionId;
        await manager.save(giftCost);
      }

      return saved;
    });
  }

  /**
   * Xóa lịch sử quà tặng
   */
  async deleteHistory(id: number, userId: number) {
    return await this.rewardHistoryRepository.manager.transaction(async (manager) => {
      const queryRunner = this.getTransactionalQueryRunner(manager);
      const history = await manager.findOne(CustomerRewardHistory, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!history) throw new NotFoundException('Không tìm thấy lịch sử quà tặng');

      const giftProductId = this.toNumber(history.gift_product_id);
      const giftQuantity = this.toNumber(history.gift_quantity);
      let allocations: CustomerRewardStockAllocation[] = [];
      if (giftProductId > 0 && giftQuantity > 0) {
        const savedAllocations = history.stock_allocations;
        if (!Array.isArray(savedAllocations)) {
          this.getExistingGiftStockAllocations(history, giftQuantity, 'xóa');
          throw new BadRequestException(`Không thể xóa quà tặng #${id}: thiếu snapshot tồn kho.`);
        }
        if (savedAllocations.length > 0) {
          if (history.gift_status !== 'delivered') {
            throw new BadRequestException(
              `Không thể xóa quà tặng #${id}: trạng thái '${history.gift_status}' không khớp ` +
                'snapshot lô còn hàng. Cần đối soát trước khi thay đổi tồn kho.',
            );
          }
          allocations = this.getExistingGiftStockAllocations(history, giftQuantity, 'xóa');
        } else if (history.gift_status === 'delivered') {
          this.getExistingGiftStockAllocations(history, giftQuantity, 'xóa');
        }
      }
      if (allocations.length > 0) {
        await this.restoreGiftStockAllocations(history, allocations, userId, queryRunner, 'xóa');
      }

      // 1. Cập nhật lại số liệu tracking
      const tracking = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id: history.customer_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (tracking && history.reward_type === 'ACCUMULATION_REWARD') {
        tracking.reward_count = Math.max(0, tracking.reward_count - 1);
        
        // 🔄 QUAN TRỌNG: Trả lại tích lũy khi xóa quà tặng (Tính theo tỷ lệ gift_value thực tế)
        const threshold = await this.getRewardThreshold(manager, history.customer_id);
        const REWARD_VALUE_FOR_THRESHOLD = 1000000;
        const amountToRestore = (Number(history.gift_value || 0) / REWARD_VALUE_FOR_THRESHOLD) * threshold;
        
        tracking.pending_amount = Number(tracking.pending_amount || 0) + amountToRestore;
        
        await manager.save(tracking);
      }

      // 2. Xóa chi phí tương ứng
      const giftCost = await manager.findOne(FarmGiftCost, {
        where: { reward_history_id: id }
      });
      if (giftCost) {
        await manager.remove(giftCost);
      }

      // 3. Xóa lịch sử
      await manager.remove(history);
      
      return { success: true };
    });
  }
}
