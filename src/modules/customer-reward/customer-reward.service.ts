import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { Product } from '../../entities/products.entity';
import { FarmGiftCostService } from '../farm-service-cost/farm-gift-cost.service';
import { InventoryService } from '../inventory/inventory.service';
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

  private getTransactionalQueryRunner(manager: any) {
    return { manager } as any;
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

    let tracking = await this.rewardTrackingRepository.findOne({
      where: { customer_id: customerId },
    });

    if (!tracking) {
      tracking = this.rewardTrackingRepository.create({
        customer_id: customerId,
        pending_amount: 0,
        total_accumulated: 0,
        reward_count: 0,
      });
    }

    tracking.reward_threshold = normalizedThreshold;
    const saved = await this.rewardTrackingRepository.save(tracking);
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
    
    const seasonPaidContribution = Number(debtNote.paid_amount || 0) + Number(additionalAmount || 0);
    const totalAfterClose = previousPending + seasonPaidContribution;

    // 2. Tính toán số lần tặng quà
    const rewardCount = Math.floor(totalAfterClose / threshold);
    const remainingAmount = totalAfterClose % threshold;
    const shortageToNext = threshold - remainingAmount;

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
        paid_contribution: seasonPaidContribution, // Tích lũy thực tính của vụ này
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
        current_paid: seasonPaidContribution, 
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

    // 2. Tính toán tích lũy dựa trên TIỀN THỰC TRẢ của lần này
    // 🔥 QUAN TRỌNG: Chỉ cộng số tiền thanh toán thực tế (paymentAmount).
    const paymentAmount = Number(closeData.payment_amount || 0);
    const totalNewContribution = paymentAmount;

    const previousPending = Number(rewardTracking.pending_amount);
    const totalAccumulated = previousPending + totalNewContribution;

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
    if (paymentAmount !== 0 || isFinal) {
      rewardTracking.pending_amount = remainingAccumulated;
      rewardTracking.total_accumulated = Number(rewardTracking.total_accumulated) + totalNewContribution;
    }
    
    await manager.save(rewardTracking);
    await manager.save(debtNote);

    // Trả về thông tin tóm tắt để các Service khác phản hồi cho Frontend
    return {
      previous_pending: previousPending,
      payment_received: totalNewContribution,
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
        notes, 
        season_id,
        rice_crop_id
    } = dto;
    let resolvedGiftValue = this.toNumber(dto.gift_value);
    const giftProductId = this.toNumber(dto.gift_product_id);
    const giftQuantity = this.toNumber(dto.gift_quantity);
    const giftUnitPrice = this.toNumber(dto.gift_unit_price);
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
        gift_unit_price: giftProductId > 0 ? giftUnitPrice : null,
        gift_status: dto.gift_status || 'delivered',
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
      if (giftProductId > 0) {
        const stockOutResult = await this.inventoryService.processStockOut(
          giftProductId,
          giftQuantity,
          'CUSTOMER_REWARD_GIFT',
          userId,
          savedHistory.id,
          `Xuất kho quà tặng khách hàng ${customer.name || customer_id}: ${giftProductName}`,
          this.getTransactionalQueryRunner(manager),
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
    const history = await this.rewardHistoryRepository.findOne({ where: { id } });
    if (!history) throw new NotFoundException('Không tìm thấy lịch sử quà tặng');
    const oldProductId = this.toNumber(history.gift_product_id);
    const oldQuantity = this.toNumber(history.gift_quantity);
    const oldUnitPrice = this.toNumber(history.gift_unit_price);
    const nextProductId =
      dto.gift_product_id !== undefined
        ? this.toNumber(dto.gift_product_id)
        : oldProductId;
    const nextQuantity =
      dto.gift_quantity !== undefined
        ? this.toNumber(dto.gift_quantity)
        : oldQuantity;
    const nextUnitPrice =
      dto.gift_unit_price !== undefined
        ? this.toNumber(dto.gift_unit_price)
        : oldUnitPrice;

    let nextProductName: string | null = history.gift_product_name || null;
    let resolvedGiftValue = this.toNumber(dto.gift_value ?? history.gift_value);

    if (nextProductId > 0) {
      if (nextQuantity <= 0) {
        throw new BadRequestException('Số lượng sản phẩm quà phải lớn hơn 0');
      }
      if (nextUnitPrice < 0) {
        throw new BadRequestException('Đơn giá sản phẩm quà không được âm');
      }

      const product = await this.debtNoteRepository.manager.findOne(Product, {
        where: { id: nextProductId },
      });
      if (!product) {
        throw new NotFoundException('Không tìm thấy sản phẩm quà tặng');
      }
      nextProductName = product.trade_name || product.name || `Sản phẩm #${nextProductId}`;
      resolvedGiftValue = Math.round(nextQuantity * nextUnitPrice);
    } else {
      nextProductName = null;
    }

    return await this.rewardHistoryRepository.manager.transaction(async (manager) => {
      const queryRunner = this.getTransactionalQueryRunner(manager);
      const stockChanged =
        oldProductId !== nextProductId ||
        oldQuantity !== nextQuantity;
      let inventoryTransactionId = history.gift_inventory_transaction_id || null;

      if (oldProductId > 0 && oldQuantity > 0 && stockChanged) {
        await this.inventoryService.processStockIn(
          oldProductId,
          oldQuantity,
          oldUnitPrice || 0,
          _userId,
          undefined,
          `GIFT_RETURN_${id}_${Date.now()}`,
          undefined,
          queryRunner,
        );
        inventoryTransactionId = null;
      }

      if (nextProductId > 0 && stockChanged) {
        const stockOutResult = await this.inventoryService.processStockOut(
          nextProductId,
          nextQuantity,
          'CUSTOMER_REWARD_GIFT',
          _userId,
          id,
          `Xuất kho quà tặng khách hàng ${history.customer_name || history.customer_id}: ${nextProductName}`,
          queryRunner,
        );
        inventoryTransactionId = stockOutResult.transaction.id;
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
        notes: dto.notes,
        gift_status: dto.gift_status || history.gift_status,
        delivered_date: dto.gift_status === 'delivered' ? new Date() : history.delivered_date,
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
    const history = await this.rewardHistoryRepository.findOne({ where: { id } });
    if (!history) throw new NotFoundException('Không tìm thấy lịch sử quà tặng');

    return await this.rewardHistoryRepository.manager.transaction(async (manager) => {
      // 1. Cập nhật lại số liệu tracking
      const tracking = await manager.findOne(CustomerRewardTracking, {
        where: { customer_id: history.customer_id }
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

      const giftProductId = this.toNumber(history.gift_product_id);
      const giftQuantity = this.toNumber(history.gift_quantity);
      if (giftProductId > 0 && giftQuantity > 0) {
        await this.inventoryService.processStockIn(
          giftProductId,
          giftQuantity,
          this.toNumber(history.gift_unit_price),
          userId,
          undefined,
          `GIFT_DELETE_RETURN_${id}_${Date.now()}`,
          undefined,
          this.getTransactionalQueryRunner(manager),
        );
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
