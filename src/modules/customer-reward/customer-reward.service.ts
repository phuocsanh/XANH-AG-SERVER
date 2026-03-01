import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { FarmServiceCostService } from '../farm-service-cost/farm-service-cost.service';
import { QueryHelper } from '../../common/helpers/query-helper';
import { SearchRewardDto } from './dto/search-reward.dto';

@Injectable()
export class CustomerRewardService {
  constructor(
    @InjectRepository(CustomerRewardTracking)
    private rewardTrackingRepository: Repository<CustomerRewardTracking>,
    @InjectRepository(CustomerRewardHistory)
    private rewardHistoryRepository: Repository<CustomerRewardHistory>,
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
    private readonly farmServiceCostService: FarmServiceCostService,
  ) {}

  private readonly REWARD_THRESHOLD = 60000000; // 60 Triệu

  /**
   * Xem trước phần thưởng dựa trên ID phiếu nợ
   */
  async getRewardPreviewById(debtNoteId: number) {
    const debtNote = await this.debtNoteRepository.findOne({
      where: { id: debtNoteId },
      relations: ['customer', 'season'],
    });

    if (!debtNote) {
      throw new NotFoundException(`Không tìm thấy phiếu công nợ #${debtNoteId}`);
    }

    return this.getRewardPreview(debtNote);
  }

  /**
   * Xem trước phần thưởng tích lũy (Preview)
   */
  async getRewardPreview(debtNote: DebtNote) {
    // 1. Lấy thông tin tích lũy hiện tại (từ các vụ trước đó)
    const rewardTracking = await this.rewardTrackingRepository.findOne({
      where: { customer_id: debtNote.customer_id },
    });

    const previousPending = Number(rewardTracking?.pending_amount || 0);
    
    // 🔥 Dùng amount (Tổng phát sinh) của phiếu hiện tại
    const seasonTotalDebt = Number(debtNote.amount);
    const totalAfterClose = previousPending + seasonTotalDebt;

    // 2. Tính toán số lần tặng quà
    const rewardCount = Math.floor(totalAfterClose / this.REWARD_THRESHOLD);
    const remainingAmount = totalAfterClose % this.REWARD_THRESHOLD;
    const shortageToNext = this.REWARD_THRESHOLD - remainingAmount;

    // 3. Lấy lịch sử các vụ đã tích lũy (SETTLED)
    const accumulationHistory = await this.debtNoteRepository.find({
      where: { 
        customer_id: debtNote.customer_id,
        status: DebtNoteStatus.SETTLED
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
        debt_amount: seasonTotalDebt,
        paid_amount: Number(debtNote.paid_amount || 0),
        remaining_amount: Number(debtNote.remaining_amount || 0),
        status: debtNote.status,
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
        current_debt: seasonTotalDebt,
        total_after_close: totalAfterClose,
        reward_threshold: this.REWARD_THRESHOLD,
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
  }): Promise<void> {
    try {
      const costName = `Quà tặng cuối vụ - ${params.customerName}`;
      const descriptionParts = [
        params.giftDescription ? `Quà: ${params.giftDescription}` : 'Quà tặng cuối vụ',
        params.seasonName ? `Mùa vụ: ${params.seasonName}` : '',
        `Tích lũy: ${this.formatCurrency(params.totalAccumulated)}`,
        `Số lần tặng: ${params.rewardCount}`,
        `Phiếu nợ: ${params.debtNoteCode}`,
      ].filter(Boolean).join(' | ');

      await this.farmServiceCostService.create({
        name: costName,
        amount: params.giftValue * params.rewardCount,
        season_id: params.season_id,
        customer_id: params.customer_id,
        notes: descriptionParts,
        expense_date: new Date().toISOString(),
        source: 'reward_from_debt_note',
      }, params.manager);
    } catch (error) {
      // Log error but don't stop process
      console.error('❌ Lỗi khi tạo phiếu chi phí quà tặng:', error);
    }
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  }

  /**
   * Xử lý quà tặng và tích lũy khi chốt sổ công nợ
   * Được gọi từ DebtNoteService trong một Transaction
   */
  async handleDebtNoteSettlement(
    manager: any, // EntityManager từ transaction
    debtNote: DebtNote,
    closeData: any, // CloseSeasonDebtNoteDto (sử dụng any để tránh import vòng)
    userId: number
  ) {
    // 1. Lấy hoặc tạo bản ghi tích lũy
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

    // 2. Tính toán tích lũy
    const seasonTotalDebt = Number(debtNote.amount);
    const previousPending = Number(rewardTracking.pending_amount);
    const totalAccumulated = previousPending + seasonTotalDebt;

    // 3. Tính số lần tặng quà và số dư
    const rewardCount = Math.floor(totalAccumulated / this.REWARD_THRESHOLD);
    const remainingAccumulated = totalAccumulated % this.REWARD_THRESHOLD;

    // 4. Lưu lịch sử tặng quà (nơi lưu vết từng món quà được tặng)
    if (rewardCount > 0) {
      for (let i = 0; i < rewardCount; i++) {
        const rewardHistory = manager.create(CustomerRewardHistory, {
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
          gift_value: closeData.gift_value || 0,
        });
        await manager.save(rewardHistory);
      }
    }

    // 5. Cập nhật bản ghi tích lũy tổng quát của khách hàng
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

    // 6. Tạo phiếu chi phí nếu có tặng quà và có giá trị quà
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

    // Trả về thông tin tóm tắt để DebtNoteService phản hồi cho Frontend
    return {
      previous_pending: previousPending,
      season_total: seasonTotalDebt,
      total_accumulated: totalAccumulated,
      reward_given: rewardCount > 0,
      reward_count: rewardCount,
      remaining_accumulated: finalRemainingAmount,
      message: this.generateCloseMessage(rewardCount, finalRemainingAmount),
    };
  }

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
   * Truy vấn lịch sử quà tặng tập trung
   */
  async searchRewardHistory(searchDto: SearchRewardDto) {
    const { page = 1, limit = 10, customer_name } = searchDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.rewardHistoryRepository.createQueryBuilder('rh')
      .leftJoinAndSelect('rh.customer', 'customer')
      .orderBy('rh.reward_date', 'DESC');

    if (customer_name) {
      const nameKeyword = `%${QueryHelper.sanitizeKeyword(customer_name)}%`;
      queryBuilder.andWhere(`rh.customer_name ILIKE :nameKeyword`, { nameKeyword });
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
}
