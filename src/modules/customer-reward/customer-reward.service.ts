import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { CustomerRewardTracking } from '../../entities/customer-reward-tracking.entity';
import { CustomerRewardHistory } from '../../entities/customer-reward-history.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { SystemSetting } from '../../entities/system-setting.entity';
import { Customer } from '../../entities/customer.entity';
import { Season } from '../../entities/season.entity';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';
import { FarmGiftCostService } from '../farm-service-cost/farm-gift-cost.service';
import { QueryHelper } from '../../common/helpers/query-helper';
import { SearchRewardDto } from './dto/search-reward.dto';
import { CreateManualRewardDto } from './dto/create-manual-reward.dto';

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
    @InjectRepository(FarmGiftCost)
    private farmGiftCostRepository: Repository<FarmGiftCost>,
    private readonly farmGiftCostService: FarmGiftCostService,
  ) {}

  private readonly DEFAULT_REWARD_THRESHOLD = 60000000; // 60 Triệu

  /**
   * Lấy mốc tích lũy từ database
   */
  async getRewardThreshold(manager?: any): Promise<number> {
    const repo = manager ? manager.getRepository(SystemSetting) : this.systemSettingRepository;
    const setting = await repo.findOne({ where: { key: 'reward_threshold' } });
    
    if (setting && !isNaN(Number(setting.value))) {
      return Number(setting.value);
    }
    
    return this.DEFAULT_REWARD_THRESHOLD;
  }

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
    
    // 🔥 Lấy mốc từ DB
    const threshold = await this.getRewardThreshold();
    
    // 🔥 Dùng amount (Tổng phát sinh) của phiếu hiện tại
    const seasonTotalDebt = Number(debtNote.amount);
    const totalAfterClose = previousPending + seasonTotalDebt;

    // 2. Tính toán số lần tặng quà
    const rewardCount = Math.floor(totalAfterClose / threshold);
    const remainingAmount = totalAfterClose % threshold;
    const shortageToNext = threshold - remainingAmount;

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

      await this.farmGiftCostService.create({
        name: costName,
        amount: params.giftValue * params.rewardCount,
        season_id: params.season_id,
        customer_id: params.customer_id,
        rice_crop_id: params.rice_crop_id || undefined,
        notes: descriptionParts,
        gift_date: new Date().toISOString(),
        source: 'reward_from_debt_note',
        reward_history_id: params.reward_history_id || undefined,
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

    // 🔥 Lấy mốc từ DB (dùng manager để đảm bảo nhất quán trong transaction)
    const threshold = await this.getRewardThreshold(manager);

    // 3. Tính số lần tặng quà và số dư
    const rewardCount = Math.floor(totalAccumulated / threshold);
    const remainingAccumulated = totalAccumulated % threshold;

    // 4. Lưu lịch sử tặng quà (nơi lưu vết từng món quà được tặng)
    const historyIds: number[] = [];
    if (rewardCount > 0) {
      for (let i = 0; i < rewardCount; i++) {
        const rewardHistory = manager.create(CustomerRewardHistory, {
          customer_id: debtNote.customer_id,
          customer_name: debtNote.customer?.name || '',
          reward_threshold: threshold,
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
        const savedHistory = await manager.save(rewardHistory);
        historyIds.push(savedHistory.id);
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
       // Chúng ta tạo một phiếu chi phí cho mỗi lần tặng quà để dễ đồng bộ
       for (let i = 0; i < rewardCount; i++) {
            await this.createGiftFarmServiceCost({
                debtNoteCode: debtNote.code,
                customer_id: debtNote.customer_id,
                customerName: debtNote.customer?.name || 'Khách hàng',
                season_id: debtNote.season_id!,
                seasonName: debtNote.season?.name,
                rewardCount: 1, // Tạo lẻ từng cái
                giftValue: closeData.gift_value,
                giftDescription: closeData.gift_description,
                totalAccumulated: totalAccumulated,
                manager,
                reward_history_id: historyIds[i]
            });
       }
    }

    // Trả về thông tin tóm tắt để DebtNoteService phản hồi cho Frontend
    return {
      previous_pending: previousPending,
      season_total: seasonTotalDebt,
      total_accumulated: totalAccumulated,
      reward_given: rewardCount > 0,
      reward_count: rewardCount,
      remaining_accumulated: finalRemainingAmount,
      message: this.generateCloseMessage(rewardCount, finalRemainingAmount, threshold),
    };
  }

  private generateCloseMessage(rewardCount: number, remaining: number, threshold: number): string {
    if (rewardCount === 0) {
      const shortage = threshold - remaining;
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

    const threshold = await this.getRewardThreshold();

    return {
      items,
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
    const { page = 1, limit = 10, customer_name, customer_phone } = searchDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.rewardHistoryRepository.createQueryBuilder('rh')
      .leftJoinAndSelect('rh.customer', 'customer')
      .orderBy('rh.reward_date', 'DESC');

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

    const threshold = await this.getRewardThreshold();

    if (!tracking) {
      return {
        pending_amount: 0,
        total_accumulated: 0,
        reward_count: 0,
        reward_threshold: threshold, 
        shortage_to_next: threshold,
      };
    }

    return {
      ...tracking,
      reward_threshold: threshold,
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
      const { gift_value, ...safeItem } = item;
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
        gift_value, 
        notes, 
        season_id,
        rice_crop_id
    } = dto;

    const customer = await this.debtNoteRepository.manager.findOne(Customer, {
      where: { id: customer_id }
    });

    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
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

    const threshold = await this.getRewardThreshold();

    return await this.debtNoteRepository.manager.transaction(async (manager) => {
      // 1. Tạo bản ghi lịch sử quà tặng
      const history = manager.create(CustomerRewardHistory, {
        customer_id,
        customer_name: (customer as any).name,
        reward_threshold: threshold,
        accumulated_amount: 0, 
        reward_date: new Date(),
        gift_description,
        gift_value: gift_value || 0,
        gift_status: 'delivered',
        delivered_date: new Date(),
        notes: notes || 'Tặng quà thủ công',
        created_by: userId,
        season_ids: season_id ? [season_id] : [],
        season_names: seasonName ? [seasonName] : [],
        contribution_details: rice_crop_id ? { rice_crop_id, rice_crop_name: riceCropName } : {}
      });

      const savedHistory = await manager.save(history);

      // 2. Cập nhật bảng tracking tích lũy
      let tracking = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id }
      });

      if (!tracking) {
        tracking = manager.create(CustomerRewardTracking, {
          customer_id: customer_id,
          pending_amount: 0,
          total_accumulated: 0,
          reward_count: 0
        });
      }

      if (!tracking) {
        tracking = manager.create(CustomerRewardTracking, {
          customer_id: customer_id,
          pending_amount: 0,
          total_accumulated: 0,
          reward_count: 0
        });
      }

      tracking.reward_count += 1;
      tracking.last_reward_date = new Date();

      await manager.save(tracking);

      // 3. Tạo phiếu chi phí nếu có giá trị quà và có mùa vụ
      if (gift_value && gift_value > 0 && season_id) {
        await this.createGiftFarmServiceCost({
            customer_id,
            debtNoteCode: 'MANUAL_REWARD',
            customerName: (customer as any).name || 'Khách hàng',
            season_id,
            seasonName,
            rewardCount: 1,
            giftValue: gift_value,
            giftDescription: gift_description,
            totalAccumulated: 0,
            manager,
            reward_history_id: savedHistory.id,
            rice_crop_id: rice_crop_id || null
        });
      }

      return savedHistory;
    });
  }

  /**
   * Cập nhật thông tin lịch sử quà tặng
   */
  async updateHistory(id: number, dto: CreateManualRewardDto, _userId: number) {
    const history = await this.rewardHistoryRepository.findOne({ where: { id } });
    if (!history) throw new NotFoundException('Không tìm thấy lịch sử quà tặng');

    Object.assign(history, {
      gift_description: dto.gift_description,
      gift_value: dto.gift_value,
      notes: dto.notes,
    });

    const saved = await this.rewardHistoryRepository.save(history);

    // Cập nhật chi phí tương ứng nếu có
    const giftCost = await this.farmGiftCostRepository.findOne({
      where: { reward_history_id: id }
    });

    if (giftCost) {
      giftCost.name = `Quà tặng tri ân - ${history.customer_name}`;
      giftCost.amount = dto.gift_value || 0;
      giftCost.notes = dto.gift_description;
      await this.farmGiftCostRepository.save(giftCost);
    }

    return saved;
  }

  /**
   * Xóa lịch sử quà tặng
   */
  async deleteHistory(id: number) {
    const history = await this.rewardHistoryRepository.findOne({ where: { id } });
    if (!history) throw new NotFoundException('Không tìm thấy lịch sử quà tặng');

    return await this.rewardHistoryRepository.manager.transaction(async (manager) => {
      // 1. Cập nhật lại số liệu tracking
      const tracking = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id: history.customer_id }
      });

      if (tracking) {
        tracking.reward_count = Math.max(0, tracking.reward_count - 1);
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
