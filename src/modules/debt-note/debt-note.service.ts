import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { CreateDebtNoteDto } from './dto/create-debt-note.dto';
import { UpdateDebtNoteDto } from './dto/update-debt-note.dto';
import { SearchDebtNoteDto } from './dto/search-debt-note.dto';
import { CloseSeasonDebtNoteDto } from './dto/close-season-debt-note.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { FarmServiceCostService } from '../farm-service-cost/farm-service-cost.service';

@Injectable()
export class DebtNoteService {
  private readonly logger = new Logger(DebtNoteService.name);
  private readonly REWARD_THRESHOLD = 60000000; // 60 triệu

  constructor(
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
    @InjectRepository(CustomerRewardTracking)
    private rewardTrackingRepository: Repository<CustomerRewardTracking>,
    @InjectRepository(CustomerRewardHistory)
    private rewardHistoryRepository: Repository<CustomerRewardHistory>,
    private dataSource: DataSource,
    private farmServiceCostService: FarmServiceCostService,
  ) {}

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
    summary: {
      total_debt: number;
      overdue_count: number;
      active_count: number;
      paid_count: number;
    };
  }> {
    const queryBuilder = this.debtNoteRepository.createQueryBuilder('debt_note');
    
    queryBuilder.leftJoinAndSelect('debt_note.customer', 'customer');
    queryBuilder.leftJoinAndSelect('debt_note.season', 'season');
    queryBuilder.leftJoin('debt_note.creator', 'creator')
      .addSelect(['creator.id', 'creator.account']);

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'debt_note',
      ['code', 'customer.name', 'customer.phone'] // Global search
    );

    // 2. Simple Filters & Guest Search logic
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'debt_note',
      ['filters', 'nested_filters', 'operator', 'customer_name', 'customer_phone'], // Bỏ qua mapping mặc định cho name/phone
      {
        season_name: 'season.name',
      }
    );

    // ✅ Logic tìm kiếm khách hàng (chính thức & vãng lai)
    if (searchDto.customer_name || searchDto.customer_phone) {
      const nameKeyword = searchDto.customer_name ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_name)}%` : null;
      const phoneKeyword = searchDto.customer_phone ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_phone)}%` : null;
      
      queryBuilder.andWhere(new Brackets(qb => {
        if (nameKeyword) {
          // Tìm trong bảng Customer
          qb.orWhere(`regexp_replace(unaccent(customer.name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`, { nameKeyword });
          // Tìm trong các hóa đơn liên quan (Guest Name)
          // Sử dụng subquery để tìm kiếm trong mảng JSON source_invoices
          qb.orWhere(`EXISTS (
            SELECT 1 FROM sales_invoices si 
            WHERE si.id IN (SELECT json_array_elements_text(debt_note.source_invoices)::int)
            AND regexp_replace(unaccent(si.customer_name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)
          )`, { nameKeyword });
        }
        
        if (phoneKeyword) {
          qb.orWhere(`customer.phone ILIKE :phoneKeyword`, { phoneKeyword });
          qb.orWhere(`EXISTS (
            SELECT 1 FROM sales_invoices si 
            WHERE si.id IN (SELECT json_array_elements_text(debt_note.source_invoices)::int)
            AND si.customer_phone ILIKE :phoneKeyword
          )`, { phoneKeyword });
        }
      }));
    }

    // 3. Thực hiện truy vấn dữ liệu và đếm tổng số bản ghi
    // Tách riêng getMany và getCount để đảm bảo tính đúng đắn khi dùng skip/take với join
    const data = await queryBuilder.getMany();
    
    // Tạo query riêng để đếm tổng, bỏ qua phân trang
    const total = await queryBuilder.clone().skip(undefined).take(undefined).getCount();

    // Tính toán các chỉ số thống kê (Summary) dựa trên điều kiện lọc hiện tại
    const summaryQuery = queryBuilder.clone(); // Clone để không ảnh hưởng offset/limit
    
    // Xóa bỏ phân trang
    summaryQuery.skip(undefined).take(undefined);
    summaryQuery.orderBy(); // Bỏ order by cho nhẹ

    const { total_debt, overdue_count, active_count, paid_count } = await summaryQuery
      .select('SUM(debt_note.remaining_amount)', 'total_debt')
      .addSelect(`COUNT(CASE WHEN debt_note.status = '${DebtNoteStatus.OVERDUE}' THEN 1 END)`, 'overdue_count')
      .addSelect(`COUNT(CASE WHEN debt_note.status = '${DebtNoteStatus.ACTIVE}' THEN 1 END)`, 'active_count')
      .addSelect(`COUNT(CASE WHEN debt_note.status = '${DebtNoteStatus.PAID}' THEN 1 END)`, 'paid_count')
      .getRawOne();

    return {
      data,
      total,
      page,
      limit,
      summary: {
        total_debt: Number(total_debt || 0),
        overdue_count: Number(overdue_count || 0),
        active_count: Number(active_count || 0),
        paid_count: Number(paid_count || 0),
      },
    };
  }


  /**
   * Tìm hoặc tạo phiếu công nợ cho khách hàng trong mùa vụ
   * Nếu đã có phiếu nợ cho customer_id + season_id → Trả về phiếu đó
   * Nếu chưa có → Tạo phiếu mới
   */
  async findOrCreateForSeason(
    customer_id: number,
    season_id: number | undefined,
    created_by: number,
    manager?: any, // Optional EntityManager
  ): Promise<DebtNote> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    // Tìm phiếu nợ hiện có
    const queryBuilder = repo
      .createQueryBuilder('dn')
      .where('dn.customer_id = :customer_id', { customer_id })
      .andWhere('dn.status IN (:...statuses)', { statuses: ['active', 'overdue', 'paid'] });

    if (season_id) {
      queryBuilder.andWhere('dn.season_id = :season_id', { season_id });
    } else {
      queryBuilder.andWhere('dn.season_id IS NULL');
    }

    let debtNote = await queryBuilder.getOne();

    // Nếu chưa có, tạo mới
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

  /**
   * Thêm hóa đơn vào phiếu công nợ
   * Cập nhật amount và remaining_amount
   */
  async addInvoiceToDebtNote(
    debtNoteId: number,
    invoiceId: number,
    invoiceFinalAmount: number,
    invoicePaidAmount: number,
    manager?: any, // Optional EntityManager
  ): Promise<DebtNote> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    const debtNote = await repo.findOne({
      where: { id: debtNoteId },
    });

    if (!debtNote) {
      throw new Error(`DebtNote #${debtNoteId} not found`);
    }

    // Khởi tạo source_invoices nếu chưa có
    if (!debtNote.source_invoices) {
      debtNote.source_invoices = [];
    }

    // Thêm invoice_id vào source_invoices nếu chưa có
    if (!debtNote.source_invoices.includes(invoiceId)) {
      debtNote.source_invoices.push(invoiceId);
    }

    // Cập nhật số tiền - Chuyển đổi sang number để tránh lỗi cộng chuỗi
    const currentAmount = Number(debtNote.amount) || 0;
    const currentPaid = Number(debtNote.paid_amount) || 0;
    const currentRemaining = Number(debtNote.remaining_amount) || 0;

    const addAmount = Number(invoiceFinalAmount) || 0;
    const addPaid = Number(invoicePaidAmount) || 0;
    const addRemaining = Math.max(0, addAmount - addPaid);
    
    debtNote.amount = currentAmount + addAmount;
    debtNote.paid_amount = currentPaid + addPaid;
    debtNote.remaining_amount = currentRemaining + addRemaining;

    // Tự động cập nhật trạng thái nếu không phải trạng thái cố định (SETTLED, CANCELLED)
    if (debtNote.status !== DebtNoteStatus.SETTLED && debtNote.status !== DebtNoteStatus.CANCELLED) {
      if (debtNote.remaining_amount > 0) {
        debtNote.status = DebtNoteStatus.ACTIVE;
      } else {
        debtNote.status = DebtNoteStatus.PAID;
      }
    }

    return await repo.save(debtNote);
  }

  /**
   * Loại bỏ hóa đơn khỏi phiếu công nợ (khi hủy/hoàn tiền)
   * Giảm amount và remaining_amount
   */
  async removeInvoiceFromDebtNote(
    invoiceId: number,
    invoiceFinalAmount: number,
    invoicePaidAmount: number,
    manager?: any, // Optional EntityManager
  ): Promise<void> {
    const repo = manager ? manager.getRepository(DebtNote) : this.debtNoteRepository;

    // Tìm phiếu nợ chứa hóa đơn này - dùng JSONB operator để tìm trong JSON array
    const debtNotes = await repo.createQueryBuilder('dn')
      .where('dn.source_invoices::jsonb @> :invoiceIdJson::jsonb', { 
        invoiceIdJson: JSON.stringify([invoiceId]) 
      })
      .getMany();

    for (const debtNote of debtNotes) {
      // Loại bỏ ID hóa đơn khỏi mảng
      if (debtNote.source_invoices) {
        debtNote.source_invoices = debtNote.source_invoices.filter(id => id !== invoiceId);
      }

      // Giảm số tiền
      const currentAmount = Number(debtNote.amount) || 0;
      const currentPaid = Number(debtNote.paid_amount) || 0;
      const currentRemaining = Number(debtNote.remaining_amount) || 0;

      const removeAmount = Number(invoiceFinalAmount) || 0;
      const removePaid = Number(invoicePaidAmount) || 0;
      const removeRemaining = Math.max(0, removeAmount - removePaid);

      debtNote.amount = Math.max(0, currentAmount - removeAmount);
      debtNote.paid_amount = Math.max(0, currentPaid - removePaid);
      debtNote.remaining_amount = Math.max(0, currentRemaining - removeRemaining);

      // Cập nhật trạng thái
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
   * Xem trước thông tin tích lũy trước khi chốt sổ
   * Hiển thị lịch sử tích lũy từng vụ và tổng hợp
   */
  async getRewardPreview(debtNoteId: number) {
    // 1. Lấy thông tin phiếu công nợ
    const debtNote = await this.debtNoteRepository.findOne({
      where: { id: debtNoteId },
      relations: ['customer', 'season'],
    });

    if (!debtNote) {
      throw new NotFoundException(`Không tìm thấy phiếu công nợ #${debtNoteId}`);
    }

    // 2. Lấy thông tin tích lũy hiện tại
    let rewardTracking = await this.rewardTrackingRepository.findOne({
      where: { customer_id: debtNote.customer_id },
    });

    const previousPending = Number(rewardTracking?.pending_amount || 0);
    // 🔥 QUAN TRỌNG: Dùng amount (Tổng phát sinh) thay vì remaining_amount (Dư nợ)
    // Để đảm bảo khách hàng trả trước vẫn được tính đủ điểm tích lũy
    const seasonTotalDebt = Number(debtNote.amount);
    const totalAfterClose = previousPending + seasonTotalDebt;

    // 3. Tính toán số lần tặng quà
    const rewardCount = Math.floor(totalAfterClose / this.REWARD_THRESHOLD);
    const remainingAmount = totalAfterClose % this.REWARD_THRESHOLD;
    const shortageToNext = this.REWARD_THRESHOLD - remainingAmount;

    // 4. Lấy lịch sử các vụ đã đóng góp (chưa đạt mốc)
    // TODO: Cần lưu lại lịch sử từng vụ trong bảng riêng để hiển thị chi tiết
    const accumulationHistory = [];

    // 5. Lấy lịch sử đã nhận quà trước đó
    const previousRewards = await this.rewardHistoryRepository.find({
      where: { customer_id: debtNote.customer_id },
      order: { reward_date: 'DESC' },
      take: 5,
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
        debt_amount: seasonTotalDebt, // Tổng phát sinh trong vụ
        paid_amount: Number(debtNote.paid_amount || 0), // Đã trả
        remaining_amount: Number(debtNote.remaining_amount || 0), // Còn nợ
      },
      accumulation_history: accumulationHistory,
      summary: {
        previous_pending: previousPending,
        current_debt: seasonTotalDebt, // Tổng phát sinh trong vụ
        total_after_close: totalAfterClose,
        reward_threshold: this.REWARD_THRESHOLD,
        reward_count: rewardCount,
        remaining_amount: remainingAmount,
        shortage_to_next: shortageToNext,
        will_receive_reward: rewardCount > 0,
      },
      previous_rewards: previousRewards.map(r => ({
        id: r.id,
        reward_date: r.reward_date,
        accumulated_amount: r.accumulated_amount,
        gift_description: r.gift_description,
        season_names: r.season_names,
      })),
    };
  }

  /**
   * Chốt sổ công nợ cuối vụ
   * Xử lý tích lũy và tặng quà nếu đủ điều kiện
   */
  /**
   * Chốt sổ công nợ cuối vụ
   * Xử lý tích lũy và tặng quà nếu đủ điều kiện
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

      if (debtNote.status === DebtNoteStatus.SETTLED) {
        throw new BadRequestException('Phiếu công nợ đã được chốt sổ');
      }

      // 2. Lấy hoặc tạo bản ghi tích lũy
      let rewardTracking = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id: debtNote.customer_id },
      });

      if (!rewardTracking) {
        rewardTracking = manager.create(CustomerRewardTracking, {
          customer_id: debtNote.customer_id,
          pending_amount: 0,
          total_accumulated: 0,
          reward_count: 0,
        });
      }

      // 3. Tính toán tích lũy
      // 🔥 LOGIC MỚI: Sử dụng Tổng phát sinh trong vụ (amount) thay vì Dư nợ còn lại (remaining_amount)
      // Để đảm bảo khách hàng trả trước vẫn được tính điểm.
      const seasonTotalDebt = Number(debtNote.amount);
      const previousPending = Number(rewardTracking.pending_amount);
      const totalAccumulated = previousPending + seasonTotalDebt;

      // 4. Tính số lần tặng quà và số dư
      const rewardCount = Math.floor(totalAccumulated / this.REWARD_THRESHOLD);
      const remainingAccumulated = totalAccumulated % this.REWARD_THRESHOLD;

      // 5. Lưu lịch sử tặng quà (nếu có)
      if (rewardCount > 0) {
        for (let i = 0; i < rewardCount; i++) {
          const rewardHistoryData: any = {
            customer_id: debtNote.customer_id,
            customer_name: debtNote.customer?.name || '',
            reward_threshold: this.REWARD_THRESHOLD,
            accumulated_amount: totalAccumulated,
            season_ids: debtNote.season_id ? [debtNote.season_id] : [],
            season_names: debtNote.season?.name ? [debtNote.season.name] : [],
            reward_date: new Date(),
            reward_sequence: i + 1,
            gift_description: closeData.gift_description || 
              `Quà tặng nông dân (Lần ${rewardTracking.reward_count + i + 1})`,
            notes: closeData.notes || 
              `Tích lũy từ ${this.formatCurrency(previousPending)} + ${this.formatCurrency(seasonTotalDebt)} = ${this.formatCurrency(totalAccumulated)}`,
            created_by: userId,
          };
          
          if (closeData.gift_value) {
            rewardHistoryData.gift_value = closeData.gift_value;
          }
          
          const rewardHistory = manager.create(CustomerRewardHistory, rewardHistoryData);
          await manager.save(rewardHistory);
        }
      }

      // 6. Cập nhật bản ghi tích lũy
      // Sử dụng số dư nhập thủ công nếu có, nếu không dùng số dư tự động tính toán
      const finalRemainingAmount = closeData.manual_remaining_amount !== undefined 
        ? Number(closeData.manual_remaining_amount) 
        : remainingAccumulated;

      rewardTracking.pending_amount = finalRemainingAmount;
      rewardTracking.total_accumulated = Number(rewardTracking.total_accumulated) + seasonTotalDebt;
      rewardTracking.reward_count += rewardCount;
      if (rewardCount > 0) {
        rewardTracking.last_reward_date = new Date();
      }
      await manager.save(rewardTracking);

      // 7. Cập nhật phiếu công nợ
      debtNote.status = DebtNoteStatus.SETTLED;
      debtNote.closed_at = new Date();
      debtNote.reward_given = rewardCount > 0;
      debtNote.reward_count = rewardCount;
      if (closeData.gift_description) {
        debtNote.gift_description = closeData.gift_description;
      }
      debtNote.gift_value = closeData.gift_value || 0;
      await manager.save(debtNote);

      // 7.5. Tạo phiếu chi phí quà tặng (nếu có gift_value)
      if (rewardCount > 0 && closeData.gift_value && closeData.gift_value > 0) {
        await this.createGiftFarmServiceCost({
          debtNoteCode: debtNote.code,
          customer_id: debtNote.customer_id,
          customerName: debtNote.customer?.name || 'Khách hàng',
          season_id: debtNote.season_id!,
          seasonName: debtNote.season?.name,
          rewardCount,
          giftValue: closeData.gift_value,
          giftDescription: closeData.gift_description,
          totalAccumulated: totalAccumulated,
          manager,
        });
      }

      // 8. Trả về kết quả
      return {
        success: true,
        debt_note_id: debtNote.id,
        customer_name: debtNote.customer?.name,
        season_name: debtNote.season?.name,
        
        // Thông tin tích lũy
        previous_pending: previousPending,
        season_total: seasonTotalDebt,
        total_accumulated: totalAccumulated,
        
        // Thông tin tặng quà
        reward_given: rewardCount > 0,
        reward_count: rewardCount,
        reward_threshold: this.REWARD_THRESHOLD,
        
        // Số dư chuyển sang (tích lũy)
        remaining_accumulated: remainingAccumulated,
        shortage_to_next_reward: this.REWARD_THRESHOLD - remainingAccumulated,
        
        // Message
        message: this.generateCloseMessage(rewardCount, remainingAccumulated),
      };
    });
  }

  /**
   * Tạo message khi chốt sổ
   */
  private generateCloseMessage(rewardCount: number, remaining: number): string {
    if (rewardCount === 0) {
      const shortage = this.REWARD_THRESHOLD - remaining;
      return `Đã chốt sổ thành công. Còn ${this.formatCurrency(shortage)} nữa để đạt mốc tặng quà.`;
    } else if (rewardCount === 1) {
      return `🎉 Đã chốt sổ và tặng 1 phần quà! Số dư chuyển sang: ${this.formatCurrency(remaining)}`;
    } else {
      return `🎉🎉 Đã chốt sổ và tặng ${rewardCount} phần quà! Số dư chuyển sang: ${this.formatCurrency(remaining)}`;
    }
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  /**
   * Tạo phiếu chi phí quà tặng vào bảng FarmServiceCost
   */
  private async createGiftFarmServiceCost(params: {
    debtNoteCode: string;
    customer_id: number;
    customerName: string;
    season_id: number;
    seasonName?: string | undefined;
    rewardCount: number;
    giftValue: number;
    giftDescription?: string | undefined;
    totalAccumulated: number;
    manager: any;
  }): Promise<void> {
    try {
      // Tạo tên phiếu chi phí
      const costName = `Quà tặng cuối vụ - ${params.customerName}`;

      // Tạo mô tả chi tiết
      const descriptionParts = [
        params.giftDescription ? `Quà: ${params.giftDescription}` : 'Quà tặng cuối vụ',
        params.seasonName ? `Mùa vụ: ${params.seasonName}` : '',
        `Tích lũy: ${this.formatCurrency(params.totalAccumulated)}`,
        `Số lần tặng: ${params.rewardCount}`,
        `Phiếu nợ: ${params.debtNoteCode}`,
      ].filter(Boolean).join(' | ');

      // Tạo phiếu chi phí dịch vụ
      await this.farmServiceCostService.create({
        name: costName,
        amount: params.giftValue * params.rewardCount,
        season_id: params.season_id,
        customer_id: params.customer_id,
        notes: descriptionParts,
        expense_date: new Date().toISOString(),
        source: 'reward_from_debt_note',
      }, params.manager);

      this.logger.log(
        `✅ Đã tạo phiếu chi phí quà tặng (FarmServiceCost): ${costName} - ${this.formatCurrency(params.giftValue * params.rewardCount)}`
      );
    } catch (error) {
      this.logger.error('❌ Lỗi khi tạo phiếu chi phí quà tặng:', error);
      // Không throw error để không làm gián đoạn quá trình chốt sổ
    }
  }

}
