import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { CustomerPromotionLedger } from '../../entities/customer-promotion-ledger.entity';
import { CustomerPromotionOverride } from '../../entities/customer-promotion-override.entity';
import { CustomerPromotionProgress } from '../../entities/customer-promotion-progress.entity';
import { CustomerPromotionSpinLog } from '../../entities/customer-promotion-spin-log.entity';
import { PromotionCampaign, PromotionCampaignStatus } from '../../entities/promotion-campaign.entity';
import { PromotionCampaignProduct } from '../../entities/promotion-campaign-product.entity';
import { PromotionRewardPool } from '../../entities/promotion-reward-pool.entity';
import { PromotionRewardReleaseSchedule } from '../../entities/promotion-reward-release-schedule.entity';
import { PromotionRewardReservation } from '../../entities/promotion-reward-reservation.entity';
import { Product } from '../../entities/products.entity';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { SalesReturn } from '../../entities/sales-return.entity';
import { CreatePromotionCampaignDto } from './dto/create-promotion-campaign.dto';
import { SearchPromotionParticipantsDto } from './dto/search-promotion-participants.dto';
import { SearchPromotionRewardReservationDto } from './dto/search-promotion-reward-reservation.dto';
import { SearchPromotionCampaignDto } from './dto/search-promotion-campaign.dto';
import { UpdatePromotionCampaignDto } from './dto/update-promotion-campaign.dto';

type EntityManagerLike = any;

@Injectable()
export class PromotionCampaignService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PromotionCampaign)
    private readonly campaignRepository: Repository<PromotionCampaign>,
    @InjectRepository(PromotionCampaignProduct)
    private readonly campaignProductRepository: Repository<PromotionCampaignProduct>,
    @InjectRepository(CustomerPromotionProgress)
    private readonly progressRepository: Repository<CustomerPromotionProgress>,
    @InjectRepository(CustomerPromotionOverride)
    private readonly overrideRepository: Repository<CustomerPromotionOverride>,
    @InjectRepository(PromotionRewardPool)
    private readonly rewardPoolRepository: Repository<PromotionRewardPool>,
    @InjectRepository(PromotionRewardReleaseSchedule)
    private readonly rewardReleaseRepository: Repository<PromotionRewardReleaseSchedule>,
    @InjectRepository(CustomerPromotionSpinLog)
    private readonly spinLogRepository: Repository<CustomerPromotionSpinLog>,
    @InjectRepository(PromotionRewardReservation)
    private readonly reservationRepository: Repository<PromotionRewardReservation>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(dto: CreatePromotionCampaignDto, userId: number) {
    this.validateCampaignDates(dto.start_at, dto.end_at);
    this.validateRewards(dto);

    const existing = await this.campaignRepository.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã campaign "${dto.code}" đã tồn tại`);
    }

    const products = await this.productRepository.findBy({
      id: In(dto.product_ids),
    });
    if (products.length !== dto.product_ids.length) {
      throw new BadRequestException('Có sản phẩm áp dụng không tồn tại');
    }

    const campaignData: Partial<PromotionCampaign> = {
      code: dto.code,
      name: dto.name,
      type: 'accumulated_purchase_spin_reward',
      start_at: new Date(dto.start_at),
      end_at: new Date(dto.end_at),
      threshold_amount: dto.threshold_amount,
      base_win_rate: dto.base_win_rate,
      second_win_rate: dto.second_win_rate ?? 2,
      reward_release_mode: 'monthly',
      reward_quota: dto.rewards.reduce(
        (sum, reward) => sum + Number(reward.total_quantity || 0),
        0,
      ),
      reward_type: 'spin_reward',
      reward_name: 'Spin rewards',
      reward_value: dto.rewards.reduce(
        (sum, reward) =>
          sum +
          Number(reward.reward_value || 0) * Number(reward.total_quantity || 0),
        0,
      ),
      max_reward_per_customer: dto.max_reward_per_customer ?? 2,
      created_by: userId,
      status: PromotionCampaignStatus.DRAFT,
    };

    if (dto.notes !== undefined) {
      campaignData.notes = dto.notes;
    }

    const campaign = this.campaignRepository.create(campaignData);

    const saved = await this.campaignRepository.save(campaign);
    await this.replaceCampaignProducts(saved.id, products);
    await this.replaceRewardPools(saved.id, dto.rewards);

    return this.findOne(saved.id);
  }

  async findAll(query: SearchPromotionCampaignDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    const keywordWhere = query.keyword
      ? [{ ...where, name: ILike(`%${query.keyword}%`) }, { ...where, code: ILike(`%${query.keyword}%`) }]
      : where;

    const [items, total] = await this.campaignRepository.findAndCount({
      where: keywordWhere,
      relations: ['products', 'reward_pools'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((item) => this.mapCampaignSummary(item)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: [
        'products',
        'products.product',
        'creator',
        'reward_pools',
        'reward_releases',
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Không tìm thấy campaign');
    }

    const detail = this.mapCampaignDetail(campaign);
    for (const pool of detail.reward_pools || []) {
      for (const release of pool.monthly_release || []) {
        release.available_quantity =
          await this.getAvailableRewardBucketQuantity(
            this.rewardReleaseRepository.manager,
            campaign.id,
            pool.id,
            release.month_index,
          );
      }
    }

    return detail;
  }

  async update(id: number, dto: UpdatePromotionCampaignDto) {
    const campaign = await this.campaignRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Không tìm thấy campaign');
    }
    if (campaign.status === PromotionCampaignStatus.ARCHIVED) {
      throw new BadRequestException('Không thể sửa campaign đã lưu trữ');
    }

    const merged = {
      start_at: dto.start_at || campaign.start_at.toISOString(),
      end_at: dto.end_at || campaign.end_at.toISOString(),
    };
    this.validateCampaignDates(merged.start_at, merged.end_at);

    if (dto.rewards) {
      this.validateRewards(dto as CreatePromotionCampaignDto);
    }

    if (dto.code && dto.code !== campaign.code) {
      const existing = await this.campaignRepository.findOne({
        where: { code: dto.code },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`Mã campaign "${dto.code}" đã tồn tại`);
      }
    }

    if (dto.product_ids) {
      const products = await this.productRepository.findBy({
        id: In(dto.product_ids),
      });
      if (products.length !== dto.product_ids.length) {
        throw new BadRequestException('Có sản phẩm áp dụng không tồn tại');
      }
      await this.replaceCampaignProducts(id, products);
    }

    if (dto.rewards) {
      await this.replaceRewardPools(id, dto.rewards);
      campaign.reward_quota = dto.rewards.reduce(
        (sum, reward) => sum + Number(reward.total_quantity || 0),
        0,
      );
      campaign.reward_value = dto.rewards.reduce(
        (sum, reward) =>
          sum +
          Number(reward.reward_value || 0) * Number(reward.total_quantity || 0),
        0,
      );
    }

    campaign.code = dto.code ?? campaign.code;
    campaign.name = dto.name ?? campaign.name;
    campaign.start_at = dto.start_at ? new Date(dto.start_at) : campaign.start_at;
    campaign.end_at = dto.end_at ? new Date(dto.end_at) : campaign.end_at;
    campaign.threshold_amount =
      dto.threshold_amount ?? campaign.threshold_amount;
    campaign.base_win_rate = dto.base_win_rate ?? campaign.base_win_rate;
    campaign.second_win_rate = dto.second_win_rate ?? campaign.second_win_rate;
    campaign.max_reward_per_customer =
      dto.max_reward_per_customer ?? campaign.max_reward_per_customer;
    if (dto.notes !== undefined) {
      campaign.notes = dto.notes;
    }

    await this.campaignRepository.save(campaign);
    return this.findOne(id);
  }

  async updateStatus(id: number, status: PromotionCampaignStatus) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['products', 'reward_pools'],
    });
    if (!campaign) {
      throw new NotFoundException('Không tìm thấy campaign');
    }

    if (status === PromotionCampaignStatus.ACTIVE) {
      if (!campaign.products?.length) {
        throw new BadRequestException('Campaign chưa có sản phẩm áp dụng');
      }
      if (!campaign.reward_pools?.length) {
        throw new BadRequestException('Campaign chưa có cơ cấu quà tặng');
      }
    }

    campaign.status = status;
    await this.campaignRepository.save(campaign);
    return this.findOne(id);
  }

  async getMyProgress(customerId: number) {
    const now = new Date();
    const progressItems = await this.progressRepository.find({
      where: { customer_id: customerId },
      relations: ['promotion'],
      order: { updated_at: 'DESC' },
    });

    const promotionIds = progressItems.map((item) => item.promotion_id);
    const rewardPools = promotionIds.length
      ? await this.rewardPoolRepository.find({
          where: { promotion_id: In(promotionIds) },
          order: { sort_order: 'ASC', id: 'ASC' },
        })
      : [];

    const rewardMap = new Map<number, PromotionRewardPool[]>();
    for (const pool of rewardPools) {
      const list = rewardMap.get(pool.promotion_id) || [];
      list.push(pool);
      rewardMap.set(pool.promotion_id, list);
    }

    const items = progressItems
      .filter(
        (progress) =>
          !!progress.promotion &&
          progress.promotion.status === PromotionCampaignStatus.ACTIVE &&
          progress.promotion.start_at <= now &&
          progress.promotion.end_at >= now,
      )
      .map((progress) => {
        const campaign = progress.promotion!;
        const thresholdAmount = Number(campaign.threshold_amount || 0);
        const qualifiedAmount = Number(progress.qualified_amount || 0);
        const rewards = (rewardMap.get(campaign.id) || []).map((pool) => ({
          rewardName: pool.reward_name,
          rewardValue: Number(pool.reward_value || 0),
          totalQuantity: Number(pool.total_quantity || 0),
        }));

        return {
          promotionId: campaign.id,
          promotionName: campaign.name,
          startAt: campaign.start_at,
          endAt: campaign.end_at,
          thresholdAmount,
          qualifiedAmount,
          remainingAmount: Math.max(0, thresholdAmount - qualifiedAmount),
          earnedSpinCount: progress.earned_spin_count,
          usedSpinCount: progress.used_spin_count,
          remainingSpinCount: progress.remaining_spin_count,
          winCount: progress.win_count,
          featuredRewards: rewards,
          statusLabel:
            progress.remaining_spin_count > 0
              ? `Còn ${progress.remaining_spin_count} lượt quay`
              : 'Chưa có lượt quay',
        };
      });

    return { items };
  }

  async getMySpinLogs(promotionId: number, customerId: number) {
    const items = await this.spinLogRepository.find({
      where: { promotion_id: promotionId, customer_id: customerId },
      order: { spun_at: 'DESC' },
      take: 50,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        resultType: item.result_type,
        rewardName: item.reward_name,
        rewardValue: Number(item.reward_value || 0),
        spunAt: item.spun_at,
        note: item.note,
      })),
    };
  }

  async getMySpinHistory(customerId: number) {
    const items = await this.spinLogRepository.find({
      where: { customer_id: customerId },
      relations: ['promotion'],
      order: { spun_at: 'DESC' },
      take: 100,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        promotionId: item.promotion_id,
        promotionName: item.promotion?.name || 'Chương trình quay thưởng',
        resultType: item.result_type,
        rewardName: item.reward_name,
        rewardValue: Number(item.reward_value || 0),
        spunAt: item.spun_at,
        note: item.note,
      })),
    };
  }

  async spin(promotionId: number, customerId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const campaign = await manager.findOne(PromotionCampaign, {
        where: { id: promotionId },
      });

      if (!campaign) {
        throw new NotFoundException('Không tìm thấy campaign');
      }

      const now = new Date();
      if (
        campaign.status !== PromotionCampaignStatus.ACTIVE ||
        campaign.start_at > now ||
        campaign.end_at < now
      ) {
        throw new BadRequestException('Campaign hiện không khả dụng');
      }

      let progress = await manager.findOne(CustomerPromotionProgress, {
        where: { promotion_id: promotionId, customer_id: customerId },
      });

      if (!progress) {
        progress = manager.create(CustomerPromotionProgress, {
          promotion_id: promotionId,
          customer_id: customerId,
        });
      }

      if (progress.remaining_spin_count <= 0) {
        throw new BadRequestException('Bạn không còn lượt quay nào');
      }

      progress.used_spin_count = Number(progress.used_spin_count || 0) + 1;
      progress.remaining_spin_count = Math.max(
        0,
        Number(progress.earned_spin_count || 0) - progress.used_spin_count,
      );
      progress.last_spin_at = now;

      const winCountBeforeSpin = Number(progress.win_count || 0);
      const override = await manager.findOne(CustomerPromotionOverride, {
        where: { promotion_id: promotionId, customer_id: customerId },
      });
      const hasForceWin =
        Number(override?.force_win_remaining_count || 0) > 0 &&
        !!override?.assigned_reward_pool_id &&
        !!override?.assigned_reward_name;

      if (hasForceWin) {
        const forcedRewardPoolId = override!.assigned_reward_pool_id!;
        const forcedRewardName = override!.assigned_reward_name!;
        const forcedRewardValue = Number(override!.assigned_reward_value || 0);

        progress.win_count = winCountBeforeSpin + 1;
        progress.last_win_at = now;

        const spinLog = await manager.save(
          manager.create(CustomerPromotionSpinLog, {
            promotion_id: promotionId,
            customer_id: customerId,
            spin_no: progress.used_spin_count,
            result_type: 'win',
            reward_pool_id: forcedRewardPoolId,
            reward_bucket_month: override!.assigned_reward_bucket_month || null,
            reward_name: forcedRewardName,
            reward_value: forcedRewardValue,
            win_probability_applied: 100,
            customer_win_count_before_spin: winCountBeforeSpin,
            spun_at: now,
            note: 'Force win one-time',
          }),
        );

        await manager.save(
          manager.create(PromotionRewardReservation, {
            promotion_id: promotionId,
            customer_id: customerId,
            spin_log_id: spinLog.id,
            reward_pool_id: forcedRewardPoolId,
            reward_bucket_month: override!.assigned_reward_bucket_month || null,
            reward_name: forcedRewardName,
            reward_value: forcedRewardValue,
            status: 'reserved',
            reserved_at: now,
            note: override?.note || 'Force win one-time',
          }),
        );

        override!.force_win_remaining_count = Math.max(
          0,
          Number(override!.force_win_remaining_count || 0) - 1,
        );
        if (override!.force_win_remaining_count <= 0) {
          override!.assigned_reward_pool_id = null;
          override!.assigned_reward_name = null;
          override!.assigned_reward_bucket_month = null;
          override!.assigned_reward_value = 0;
          override!.note = null;
        }
        await manager.save(override!);
        await manager.save(progress);
        await queryRunner.commitTransaction();

        return {
          success: true,
          appliedRate: 100,
          resultType: 'win',
          remainingSpinCount: progress.remaining_spin_count,
          winCount: progress.win_count,
          reward: {
            rewardName: spinLog.reward_name,
            rewardValue: Number(spinLog.reward_value || 0),
          },
          message: `Ban da trung ${spinLog.reward_name}`,
        };
      }

      const configuredRate =
        winCountBeforeSpin >= Number(campaign.max_reward_per_customer || 2)
          ? 0
          : winCountBeforeSpin === 0
            ? Number(campaign.base_win_rate || 0)
            : Number(campaign.second_win_rate || 0);
      const appliedRate =
        configuredRate > 0
          ? await this.calculateEffectiveWinRate(
              manager,
              campaign,
              configuredRate,
              now,
            )
          : 0;

      const spinNo = progress.used_spin_count;
      const shouldTryWin =
        appliedRate > 0 && Math.random() * 100 < Number(appliedRate);

      if (!shouldTryWin) {
        await manager.save(progress);
        await manager.save(
          manager.create(CustomerPromotionSpinLog, {
            promotion_id: promotionId,
            customer_id: customerId,
            spin_no: spinNo,
            result_type: 'lose',
            reward_value: 0,
            win_probability_applied: Number(appliedRate || 0),
            customer_win_count_before_spin: winCountBeforeSpin,
            spun_at: now,
            note: 'Khong trung thuong',
          }),
        );
        await queryRunner.commitTransaction();
        return {
          success: true,
          appliedRate,
          resultType: 'lose',
          remainingSpinCount: progress.remaining_spin_count,
          winCount: progress.win_count,
          reward: null,
          message: 'Chuc ban may man lan sau',
        };
      }

      const reservedReward = await this.tryReserveReward(
        manager,
        campaign,
        customerId,
        winCountBeforeSpin,
      );

      if (!reservedReward) {
        await manager.save(progress);
        await manager.save(
          manager.create(CustomerPromotionSpinLog, {
            promotion_id: promotionId,
            customer_id: customerId,
            spin_no: spinNo,
            result_type: 'lose',
            reward_value: 0,
            win_probability_applied: Number(appliedRate || 0),
            customer_win_count_before_spin: winCountBeforeSpin,
            spun_at: now,
            note: 'Khong con qua hop le trong bucket hien tai',
          }),
        );
        await queryRunner.commitTransaction();
        return {
          success: true,
          appliedRate,
          resultType: 'lose',
          remainingSpinCount: progress.remaining_spin_count,
          winCount: progress.win_count,
          reward: null,
          message: 'Chuc ban may man lan sau',
        };
      }

      progress.win_count = winCountBeforeSpin + 1;
      progress.last_win_at = now;

      const spinLog = await manager.save(
        manager.create(CustomerPromotionSpinLog, {
          promotion_id: promotionId,
          customer_id: customerId,
          spin_no: spinNo,
          result_type: 'win',
          reward_pool_id: reservedReward.pool.id,
          reward_bucket_month: reservedReward.bucketMonth,
          reward_name: reservedReward.pool.reward_name,
          reward_value: Number(reservedReward.pool.reward_value || 0),
          win_probability_applied: Number(appliedRate || 0),
          customer_win_count_before_spin: winCountBeforeSpin,
          spun_at: now,
          note: 'Quay trung thuong',
        }),
      );

      await manager.save(
        manager.create(PromotionRewardReservation, {
          promotion_id: promotionId,
          customer_id: customerId,
          spin_log_id: spinLog.id,
          reward_pool_id: reservedReward.pool.id,
          reward_bucket_month: reservedReward.bucketMonth,
          reward_name: reservedReward.pool.reward_name,
          reward_value: Number(reservedReward.pool.reward_value || 0),
          status: 'reserved',
          reserved_at: now,
        }),
      );

      await manager.save(progress);
      await queryRunner.commitTransaction();

      return {
        success: true,
        appliedRate,
        resultType: 'win',
        remainingSpinCount: progress.remaining_spin_count,
        winCount: progress.win_count,
        reward: {
          rewardName: reservedReward.pool.reward_name,
          rewardValue: Number(reservedReward.pool.reward_value || 0),
        },
        message: `Ban da trung ${reservedReward.pool.reward_name}`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listReservations(promotionId: number) {
    const items = await this.reservationRepository.find({
      where: { promotion_id: promotionId },
      relations: ['customer'],
      order: { reserved_at: 'DESC' },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        customer_id: item.customer_id,
        customer: item.customer,
        reward_name: item.reward_name,
        reward_value: Number(item.reward_value || 0),
        status: item.status,
        reserved_at: item.reserved_at,
        issued_at: item.issued_at,
        note: item.note,
      })),
    };
  }

  async listParticipants(
    promotionId: number,
    query: SearchPromotionParticipantsDto,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const queryBuilder = this.progressRepository
      .createQueryBuilder('progress')
      .leftJoinAndSelect('progress.customer', 'customer')
      .where('progress.promotion_id = :promotionId', { promotionId });

    if (query.keyword?.trim()) {
      queryBuilder.andWhere(
        `(customer.name ILIKE :keyword OR customer.phone ILIKE :keyword OR customer.code ILIKE :keyword)`,
        { keyword: `%${query.keyword.trim()}%` },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('progress.updated_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const customerIds = items.map((item) => item.customer_id);
    const overrides = customerIds.length
      ? await this.overrideRepository.find({
          where: { promotion_id: promotionId, customer_id: In(customerIds) },
        })
      : [];
    const overrideMap = new Map<number, CustomerPromotionOverride>();
    for (const override of overrides) {
      overrideMap.set(override.customer_id, override);
    }

    return {
      items: items.map((item) => {
        const override = overrideMap.get(item.customer_id);
        return {
          customer_id: item.customer_id,
          customer: item.customer,
          qualified_amount: Number(item.qualified_amount || 0),
          earned_spin_count: item.earned_spin_count,
          used_spin_count: item.used_spin_count,
          remaining_spin_count: item.remaining_spin_count,
          win_count: item.win_count,
          force_win_pending: Number(override?.force_win_remaining_count || 0) > 0,
          force_win_remaining_count: Number(
            override?.force_win_remaining_count || 0,
          ),
          forced_reward_name: override?.assigned_reward_name || null,
          forced_reward_value: Number(override?.assigned_reward_value || 0),
          forced_month_index: override?.assigned_reward_bucket_month || null,
          force_set_at: override?.set_at || null,
          override_note: override?.note || null,
          updated_at: item.updated_at,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async setForceWinOnce(
    promotionId: number,
    customerId: number,
    userId: number,
    rewardPoolId?: number,
    bucketMonth?: number,
    note?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      if (note === 'UNSET') {
        return this.clearForceWinOnce(manager, promotionId, customerId);
      }

      if (!rewardPoolId || !bucketMonth) {
        throw new BadRequestException('Vui lòng chọn quà và tháng muốn giữ riêng');
      }

      const campaign = await manager.findOne(PromotionCampaign, {
        where: { id: promotionId },
      });
      if (!campaign) {
        throw new NotFoundException('Không tìm thấy campaign');
      }

      const progress = await manager.findOne(CustomerPromotionProgress, {
        where: { promotion_id: promotionId, customer_id: customerId },
      });
      if (!progress) {
        throw new NotFoundException(
          'Khách hàng này chưa tham gia campaign hoặc chưa có tích lũy',
        );
      }

      let override = await manager.findOne(CustomerPromotionOverride, {
        where: { promotion_id: promotionId, customer_id: customerId },
      });

      if (Number(override?.force_win_remaining_count || 0) > 0) {
        throw new BadRequestException(
          'Khách hàng này đã có một lượt force trúng đang chờ quay',
        );
      }

      const reservedReward = await this.tryReserveSpecificReward(
        manager,
        campaign,
        rewardPoolId,
        bucketMonth,
      );

      if (!reservedReward) {
        throw new BadRequestException(
          'Quà của tháng này đã hết hoặc đã được giữ cho khách khác',
        );
      }

      if (!override) {
        override = manager.create(CustomerPromotionOverride, {
          promotion_id: promotionId,
          customer_id: customerId,
        });
      }

      override.force_win_remaining_count = 1;
      override.assigned_reward_pool_id = reservedReward.pool.id;
      override.assigned_reward_name = reservedReward.pool.reward_name;
      override.assigned_reward_bucket_month = reservedReward.bucketMonth;
      override.assigned_reward_value = Number(
        reservedReward.pool.reward_value || 0,
      );
      override.win_rate_multiplier = 1;
      override.note = note || null;
      override.set_by = userId;
      override.set_at = new Date();

      await manager.save(override);

      return {
        success: true,
        message: `Đã giữ riêng quà "${reservedReward.pool.reward_name}" tháng ${reservedReward.bucketMonth} cho khách ở lượt quay kế tiếp`,
      };
    });
  }

  private async clearForceWinOnce(
    manager: EntityManagerLike,
    promotionId: number,
    customerId: number,
  ) {
    const override = await manager.findOne(CustomerPromotionOverride, {
      where: { promotion_id: promotionId, customer_id: customerId },
    });

    if (!override || Number(override.force_win_remaining_count || 0) <= 0) {
      return { success: true, message: 'Khách hàng chưa có lượt giữ riêng nào' };
    }

    if (override.assigned_reward_pool_id) {
      const pool = await manager
        .createQueryBuilder(PromotionRewardPool, 'pool')
        .setLock('pessimistic_write')
        .where('pool.id = :poolId', { poolId: override.assigned_reward_pool_id })
        .getOne();

      if (pool) {
        pool.remaining_quantity = Number(pool.remaining_quantity || 0) + 1;
        pool.reserved_quantity = Math.max(
          0,
          Number(pool.reserved_quantity || 0) - 1,
        );
        await manager.save(pool);
      }
    }

    override.force_win_remaining_count = 0;
    override.assigned_reward_pool_id = null;
    override.assigned_reward_name = null;
    override.assigned_reward_bucket_month = null;
    override.assigned_reward_value = 0;
    override.note = null;
    await manager.save(override);

    return { success: true, message: 'Đã gỡ lượt giữ riêng cho khách hàng' };
  }

  async listAllReservations(query: SearchPromotionRewardReservationDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const queryBuilder = this.reservationRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.customer', 'customer')
      .leftJoinAndSelect('reservation.promotion', 'promotion');

    if (query.promotion_id) {
      queryBuilder.andWhere('reservation.promotion_id = :promotionId', {
        promotionId: query.promotion_id,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('reservation.status = :status', {
        status: query.status,
      });
    }

    if (query.keyword?.trim()) {
      queryBuilder.andWhere(
        `(customer.name ILIKE :keyword OR customer.phone ILIKE :keyword OR promotion.name ILIKE :keyword OR promotion.code ILIKE :keyword OR reservation.reward_name ILIKE :keyword)`,
        { keyword: `%${query.keyword.trim()}%` },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('reservation.reserved_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: items.map((item) => ({
        id: item.id,
        promotion_id: item.promotion_id,
        promotion: item.promotion
          ? {
              id: item.promotion.id,
              code: item.promotion.code,
              name: item.promotion.name,
            }
          : null,
        customer_id: item.customer_id,
        customer: item.customer,
        reward_name: item.reward_name,
        reward_value: Number(item.reward_value || 0),
        status: item.status,
        reserved_at: item.reserved_at,
        issued_at: item.issued_at,
        note: item.note,
      })),
      total,
      page,
      limit,
    };
  }

  async issueReservation(promotionId: number, reservationId: number, userId: number) {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId, promotion_id: promotionId },
    });
    if (!reservation) {
      throw new NotFoundException('Không tìm thấy quà đã reserve');
    }
    if (reservation.status === 'issued') {
      throw new BadRequestException('Quà này đã được xác nhận trao');
    }

    const pool = await this.rewardPoolRepository.findOne({
      where: { id: reservation.reward_pool_id },
    });
    if (!pool) {
      throw new NotFoundException('Không tìm thấy cấu hình quà');
    }

    reservation.status = 'issued';
    reservation.issued_at = new Date();
    reservation.issued_by = userId;
    reservation.expense_posted_at = reservation.issued_at;
    await this.reservationRepository.save(reservation);

    pool.issued_quantity = Number(pool.issued_quantity || 0) + 1;
    await this.rewardPoolRepository.save(pool);

    return {
      success: true,
      message: 'Đã xác nhận trao quà',
    };
  }

  async processInvoiceAccrual(manager: EntityManagerLike, invoiceId: number) {
    const invoice = await manager.findOne(SalesInvoice, {
      where: { id: invoiceId },
      relations: ['items'],
    });

    if (
      !invoice ||
      !invoice.customer_id ||
      !invoice.items?.length ||
      ![SalesInvoiceStatus.CONFIRMED, SalesInvoiceStatus.PAID].includes(invoice.status)
    ) {
      return;
    }

    const saleDate = invoice.sale_date || invoice.created_at || new Date();
    const campaigns = await manager.find(PromotionCampaign, {
      where: { status: PromotionCampaignStatus.ACTIVE },
      relations: ['products'],
    });

    const activeCampaigns = campaigns.filter(
      (campaign) => campaign.start_at <= saleDate && campaign.end_at >= saleDate,
    );

    for (const campaign of activeCampaigns) {
      const productIds = new Set(
        (campaign.products || []).map((item: PromotionCampaignProduct) => Number(item.product_id)),
      );
      if (productIds.size === 0) continue;

      for (const item of invoice.items) {
        if (!productIds.has(Number(item.product_id))) continue;

        const existing = await manager.findOne(CustomerPromotionLedger, {
          where: {
            promotion_id: campaign.id,
            order_id: invoice.id,
            order_item_id: item.id,
            reference_type: 'invoice_accrual',
          },
        });
        if (existing) continue;

        const amount = Number(item.total_price || 0);
        const quantity = Number(item.quantity || 0);
        if (amount <= 0 || quantity <= 0) continue;

        await manager.save(
          manager.create(CustomerPromotionLedger, {
            promotion_id: campaign.id,
            customer_id: invoice.customer_id,
            order_id: invoice.id,
            order_code: invoice.code,
            order_item_id: item.id,
            product_id: item.product_id,
            change_type: 'accrue',
            amount_delta: amount,
            quantity_delta: quantity,
            source_status: invoice.status,
            reference_type: 'invoice_accrual',
            reference_id: invoice.id,
            event_at: new Date(),
            note: `Cong tich luy tu hoa don ${invoice.code}`,
          }),
        );
      }

      await this.recalculateProgress(manager, campaign.id, invoice.customer_id);
    }
  }

  async processInvoiceReversal(
    manager: EntityManagerLike,
    invoiceId: number,
    referenceType: 'invoice_cancel' | 'invoice_refund',
    note: string,
  ) {
    const invoice = await manager.findOne(SalesInvoice, { where: { id: invoiceId } });
    if (!invoice?.customer_id) return;

    const accrueLedgers = await manager.find(CustomerPromotionLedger, {
      where: { order_id: invoiceId, change_type: 'accrue' },
    });

    const grouped = new Map<string, CustomerPromotionLedger[]>();
    const campaignIds = new Set<number>();
    for (const ledger of accrueLedgers) {
      const key = `${ledger.promotion_id}:${ledger.order_item_id || 0}`;
      const list = grouped.get(key) || [];
      list.push(ledger);
      grouped.set(key, list);
    }

    for (const [key] of grouped) {
      const [promotionIdRaw, orderItemIdRaw] = key.split(':');
      const promotionId = Number(promotionIdRaw);
      const orderItemId = Number(orderItemIdRaw) || null;
      const net = await this.getNetLedgerForOrderItem(
        manager,
        promotionId,
        invoiceId,
        orderItemId,
      );
      if (net.amount <= 0 || net.quantity <= 0) continue;

      const existing = await manager.findOne(CustomerPromotionLedger, {
        where: {
          promotion_id: promotionId,
          order_id: invoiceId,
          order_item_id: orderItemId || undefined,
          reference_type: referenceType,
        },
      });
      if (existing) continue;

      await manager.save(
        manager.create(CustomerPromotionLedger, {
          promotion_id: promotionId,
          customer_id: invoice.customer_id,
          order_id: invoice.id,
          order_code: invoice.code,
          order_item_id: orderItemId || undefined,
          change_type: 'reverse',
          amount_delta: -net.amount,
          quantity_delta: -net.quantity,
          source_status: invoice.status,
          reference_type: referenceType,
          reference_id: invoice.id,
          event_at: new Date(),
          note,
        }),
      );
      campaignIds.add(promotionId);
    }

    for (const campaignId of campaignIds) {
      await this.recalculateProgress(manager, campaignId, invoice.customer_id);
    }
  }

  async processSalesReturnReversal(manager: EntityManagerLike, salesReturnId: number) {
    const salesReturn = await manager.findOne(SalesReturn, {
      where: { id: salesReturnId },
      relations: ['items'],
    });

    if (!salesReturn?.customer_id || !salesReturn.items?.length) return;

    const invoice = await manager.findOne(SalesInvoice, {
      where: { id: salesReturn.invoice_id },
      relations: ['items'],
    });
    if (!invoice?.items?.length) return;

    const campaignIds = new Set<number>();
    for (const returnItem of salesReturn.items) {
      let remainingQty = Number(returnItem.quantity || 0);
      if (remainingQty <= 0) continue;

      const invoiceItems = invoice.items.filter(
        (item: any) => Number(item.product_id) === Number(returnItem.product_id),
      );

      for (const invoiceItem of invoiceItems) {
        if (remainingQty <= 0) break;

        const ledgers = await manager.find(CustomerPromotionLedger, {
          where: {
            order_id: invoice.id,
            order_item_id: invoiceItem.id,
            change_type: In(['accrue', 'reverse', 'adjust']),
          },
        });

        const promotionMap = new Map<number, { amount: number; quantity: number }>();
        for (const ledger of ledgers) {
          const current = promotionMap.get(ledger.promotion_id) || {
            amount: 0,
            quantity: 0,
          };
          current.amount += Number(ledger.amount_delta || 0);
          current.quantity += Number(ledger.quantity_delta || 0);
          promotionMap.set(ledger.promotion_id, current);
        }

        for (const [promotionId, net] of promotionMap) {
          if (remainingQty <= 0) break;
          if (net.amount <= 0 || net.quantity <= 0) continue;

          const reverseQty = Math.min(remainingQty, net.quantity);
          const unitAmount = net.amount / net.quantity;
          const reverseAmount = Number((unitAmount * reverseQty).toFixed(2));

          const existing = await manager.findOne(CustomerPromotionLedger, {
            where: {
              promotion_id: promotionId,
              order_id: invoice.id,
              order_item_id: invoiceItem.id,
              reference_type: 'sales_return',
              reference_id: salesReturn.id,
              product_id: returnItem.product_id,
            },
          });
          if (existing) continue;

          await manager.save(
            manager.create(CustomerPromotionLedger, {
              promotion_id: promotionId,
              customer_id: salesReturn.customer_id,
              order_id: invoice.id,
              order_code: invoice.code,
              order_item_id: invoiceItem.id,
              product_id: returnItem.product_id,
              change_type: 'reverse',
              amount_delta: -reverseAmount,
              quantity_delta: -reverseQty,
              source_status: salesReturn.status,
              reference_type: 'sales_return',
              reference_id: salesReturn.id,
              event_at: new Date(),
              note: `Thu hoi tich luy do tra hang ${salesReturn.code}`,
            }),
          );

          campaignIds.add(promotionId);
        }

        remainingQty -= Math.min(remainingQty, Number(invoiceItem.quantity || 0));
      }
    }

    for (const campaignId of campaignIds) {
      await this.recalculateProgress(manager, campaignId, salesReturn.customer_id);
    }
  }

  async processSalesReturnCancellationRestore(manager: EntityManagerLike, salesReturnId: number) {
    const salesReturn = await manager.findOne(SalesReturn, {
      where: { id: salesReturnId },
      relations: ['invoice'],
    });

    if (
      !salesReturn?.customer_id ||
      !salesReturn.invoice ||
      [SalesInvoiceStatus.CANCELLED, SalesInvoiceStatus.REFUNDED].includes(
        salesReturn.invoice.status as SalesInvoiceStatus,
      )
    ) {
      return;
    }

    const returnLedgers = await manager.find(CustomerPromotionLedger, {
      where: { reference_type: 'sales_return', reference_id: salesReturnId },
    });

    const campaignIds = new Set<number>();
    for (const ledger of returnLedgers) {
      const existingRestore = await manager.findOne(CustomerPromotionLedger, {
        where: {
          promotion_id: ledger.promotion_id,
          order_id: ledger.order_id,
          order_item_id: ledger.order_item_id,
          reference_type: 'sales_return_cancel',
          reference_id: salesReturnId,
        },
      });
      if (existingRestore) continue;

      await manager.save(
        manager.create(CustomerPromotionLedger, {
          promotion_id: ledger.promotion_id,
          customer_id: ledger.customer_id,
          order_id: ledger.order_id,
          order_code: ledger.order_code,
          order_item_id: ledger.order_item_id,
          product_id: ledger.product_id,
          change_type: 'adjust',
          amount_delta: Math.abs(Number(ledger.amount_delta || 0)),
          quantity_delta: Math.abs(Number(ledger.quantity_delta || 0)),
          source_status: 'cancelled',
          reference_type: 'sales_return_cancel',
          reference_id: salesReturnId,
          event_at: new Date(),
          note: `Phuc hoi tich luy do huy phieu tra hang ${salesReturn.code}`,
        }),
      );

      campaignIds.add(ledger.promotion_id);
    }

    for (const campaignId of campaignIds) {
      await this.recalculateProgress(manager, campaignId, salesReturn.customer_id);
    }
  }

  private mapCampaignSummary(campaign: PromotionCampaign & { reward_pools?: PromotionRewardPool[]; products?: PromotionCampaignProduct[] }) {
    return {
      ...campaign,
      reward_pool_count: campaign.reward_pools?.length || 0,
      total_reward_quantity: (campaign.reward_pools || []).reduce(
        (sum, pool) => sum + Number(pool.total_quantity || 0),
        0,
      ),
      total_reward_budget: (campaign.reward_pools || []).reduce(
        (sum, pool) =>
          sum +
          Number(pool.reward_value || 0) * Number(pool.total_quantity || 0),
        0,
      ),
    };
  }

  private mapCampaignDetail(campaign: any) {
    return {
      ...this.mapCampaignSummary(campaign),
      reward_pools: (campaign.reward_pools || []).map((pool: PromotionRewardPool) => ({
        id: pool.id,
        reward_name: pool.reward_name,
        reward_value: Number(pool.reward_value || 0),
        total_quantity: Number(pool.total_quantity || 0),
        remaining_quantity: Number(pool.remaining_quantity || 0),
        reserved_quantity: Number(pool.reserved_quantity || 0),
        issued_quantity: Number(pool.issued_quantity || 0),
        sort_order: pool.sort_order,
        monthly_release: (campaign.reward_releases || [])
          .filter((release: PromotionRewardReleaseSchedule) => release.reward_pool_id === pool.id)
          .sort((a: PromotionRewardReleaseSchedule, b: PromotionRewardReleaseSchedule) => a.bucket_month - b.bucket_month)
          .map((release: PromotionRewardReleaseSchedule) => ({
            id: release.id,
            month_index: release.bucket_month,
            release_quantity: Number(release.release_quantity || 0),
            available_quantity: Number(release.release_quantity || 0),
          })),
      })),
    };
  }

  private validateCampaignDates(startAt: string, endAt: string) {
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      throw new BadRequestException('Thời gian kết thúc phải lớn hơn bắt đầu');
    }
  }

  private validateRewards(dto: CreatePromotionCampaignDto | UpdatePromotionCampaignDto) {
    const rewards = dto.rewards || [];
    if (!rewards.length) {
      throw new BadRequestException('Campaign phải có ít nhất 1 loại quà');
    }

    const rewardNames = new Set<string>();
    for (const reward of rewards) {
      const rewardName = reward.reward_name.trim().toLowerCase();
      if (rewardNames.has(rewardName)) {
        throw new BadRequestException('Tên quà không được trùng nhau');
      }
      rewardNames.add(rewardName);

      const totalRelease = reward.monthly_release.reduce(
        (sum, item) => sum + Number(item.release_quantity || 0),
        0,
      );
      if (totalRelease !== Number(reward.total_quantity || 0)) {
        throw new BadRequestException(
          `Tổng quota theo tháng của quà "${reward.reward_name}" phải bằng tổng số lượng`,
        );
      }
    }
  }

  private async replaceCampaignProducts(campaignId: number, products: Product[]) {
    await this.campaignProductRepository.delete({ promotion_id: campaignId });

    const campaignProducts = products.map((product) =>
      this.campaignProductRepository.create({
        promotion_id: campaignId,
        product_id: product.id,
        product_name_snapshot: product.trade_name || product.name,
      }),
    );

    await this.campaignProductRepository.save(campaignProducts);
  }

  private async replaceRewardPools(
    campaignId: number,
    rewards: CreatePromotionCampaignDto['rewards'],
  ) {
    // Lấy tất cả pool hiện có của campaign
    const existingPools = await this.rewardPoolRepository.find({
      where: { promotion_id: campaignId },
    });

    // Map pool hiện có theo reward_name (lowercase) để match khi update
    const existingByName = new Map(
      existingPools.map((pool) => [pool.reward_name.trim().toLowerCase(), pool]),
    );

    // Tập hợp tên reward trong request mới
    const incomingNames = new Set(
      rewards.map((r) => r.reward_name.trim().toLowerCase()),
    );

    const savedPools: PromotionRewardPool[] = [];

    for (const reward of rewards) {
      const key = reward.reward_name.trim().toLowerCase();
      const existingPool = existingByName.get(key);

      if (existingPool) {
        // Pool đã tồn tại → UPDATE tại chỗ để tránh vi phạm FK từ reservations/spin_logs
        existingPool.reward_value = reward.reward_value;
        existingPool.total_quantity = reward.total_quantity;
        existingPool.sort_order = reward.sort_order ?? 0;
        // Tính lại remaining_quantity dựa trên issued + reserved hiện tại
        existingPool.remaining_quantity = Math.max(
          0,
          reward.total_quantity
            - Number(existingPool.issued_quantity || 0)
            - Number(existingPool.reserved_quantity || 0),
        );
        const updated = await this.rewardPoolRepository.save(existingPool);
        savedPools.push(updated);

        // Xóa và tạo lại release schedules cho pool này
        await this.rewardReleaseRepository.delete({ reward_pool_id: existingPool.id });
        const releases = reward.monthly_release.map((release) =>
          this.rewardReleaseRepository.create({
            promotion_id: campaignId,
            reward_pool_id: existingPool.id,
            bucket_month: release.month_index,
            release_quantity: release.release_quantity,
          }),
        );
        await this.rewardReleaseRepository.save(releases);
      } else {
        // Pool mới → INSERT
        const pool = await this.rewardPoolRepository.save(
          this.rewardPoolRepository.create({
            promotion_id: campaignId,
            reward_name: reward.reward_name,
            reward_value: reward.reward_value,
            total_quantity: reward.total_quantity,
            remaining_quantity: reward.total_quantity,
            reserved_quantity: 0,
            issued_quantity: 0,
            sort_order: reward.sort_order ?? 0,
          }),
        );
        savedPools.push(pool);

        const releases = reward.monthly_release.map((release) =>
          this.rewardReleaseRepository.create({
            promotion_id: campaignId,
            reward_pool_id: pool.id,
            bucket_month: release.month_index,
            release_quantity: release.release_quantity,
          }),
        );
        await this.rewardReleaseRepository.save(releases);
      }
    }

    // Xử lý các pool bị xóa khỏi danh sách reward mới
    const removedPools = existingPools.filter(
      (pool) => !incomingNames.has(pool.reward_name.trim().toLowerCase()),
    );

    for (const pool of removedPools) {
      // Kiểm tra xem pool có reservation nào không (reservation.reward_pool_id là NOT NULL)
      const reservationCount = await this.reservationRepository.count({
        where: { reward_pool_id: pool.id },
      });

      if (reservationCount > 0) {
        throw new BadRequestException(
          `Không thể xóa loại quà "${pool.reward_name}" vì đã có ${reservationCount} khách hàng được thưởng. Hãy giữ nguyên hoặc đặt số lượng về 0.`,
        );
      }

      // Null hóa FK trong spin_logs (nullable) trước khi xóa
      await this.dataSource.query(
        `UPDATE "customer_promotion_spin_logs" SET "reward_pool_id" = NULL WHERE "reward_pool_id" = $1`,
        [pool.id],
      );
      // Xóa release schedules rồi mới xóa pool
      await this.rewardReleaseRepository.delete({ reward_pool_id: pool.id });
      await this.rewardPoolRepository.delete({ id: pool.id });
    }

    return savedPools;
  }

  private async recalculateProgress(
    manager: EntityManagerLike,
    promotionId: number,
    customerId: number,
  ) {
    const ledgers = await manager.find(CustomerPromotionLedger, {
      where: { promotion_id: promotionId, customer_id: customerId },
    });

    let progress = await manager.findOne(CustomerPromotionProgress, {
      where: { promotion_id: promotionId, customer_id: customerId },
    });

    if (!progress) {
      progress = manager.create(CustomerPromotionProgress, {
        promotion_id: promotionId,
        customer_id: customerId,
      });
    }

    const qualifiedAmount = Number(
      ledgers.reduce(
        (sum: number, ledger: CustomerPromotionLedger) =>
          sum + Number(ledger.amount_delta || 0),
        0,
      ),
    );

    const orderAmountMap = new Map<number, number>();
    for (const ledger of ledgers) {
      const current = orderAmountMap.get(ledger.order_id) || 0;
      orderAmountMap.set(ledger.order_id, current + Number(ledger.amount_delta || 0));
    }

    const qualifiedOrderCount = Array.from(orderAmountMap.values()).filter(
      (amount) => amount > 0,
    ).length;

    const campaign = await manager.findOne(PromotionCampaign, {
      where: { id: promotionId },
    });

    const threshold = Number(campaign?.threshold_amount || 0);
    const earnedSpinCount =
      threshold > 0 ? Math.floor(Math.max(0, qualifiedAmount) / threshold) : 0;

    progress.qualified_amount = Math.max(0, qualifiedAmount);
    progress.qualified_order_count = qualifiedOrderCount;
    progress.earned_spin_count = earnedSpinCount;
    progress.remaining_spin_count = Math.max(
      0,
      earnedSpinCount - Number(progress.used_spin_count || 0),
    );
    progress.last_calculated_at = new Date();

    await manager.save(progress);
  }

  private async getNetLedgerForOrderItem(
    manager: EntityManagerLike,
    promotionId: number,
    orderId: number,
    orderItemId: number | null,
  ) {
    const ledgers = await manager.find(CustomerPromotionLedger, {
      where: {
        promotion_id: promotionId,
        order_id: orderId,
        ...(orderItemId ? { order_item_id: orderItemId } : {}),
      },
    });

    return ledgers.reduce(
      (acc: { amount: number; quantity: number }, ledger: CustomerPromotionLedger) => {
        acc.amount += Number(ledger.amount_delta || 0);
        acc.quantity += Number(ledger.quantity_delta || 0);
        return acc;
      },
      { amount: 0, quantity: 0 },
    );
  }

  private async tryReserveReward(
    manager: EntityManagerLike,
    campaign: PromotionCampaign,
    customerId: number,
    winCountBeforeSpin: number,
  ): Promise<{ pool: PromotionRewardPool; bucketMonth: number } | null> {
    const pools = await manager.find(PromotionRewardPool, {
      where: { promotion_id: campaign.id },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    if (!pools.length) return null;

    const currentMonth = this.getCampaignMonthBucket(campaign.start_at, new Date());
    const previousWins = await manager.find(PromotionRewardReservation, {
      where: { promotion_id: campaign.id, customer_id: customerId },
    });
    const wonRewardNames = new Set(
      previousWins
        .filter((item: PromotionRewardReservation) => item.status !== 'cancelled')
        .map((item: PromotionRewardReservation) => item.reward_name),
    );

    const candidates: Array<{
      pool: PromotionRewardPool;
      bucketMonth: number;
      available: number;
    }> = [];
    for (const pool of pools) {
      if (
        winCountBeforeSpin >= 1 &&
        wonRewardNames.has(pool.reward_name)
      ) {
        continue;
      }

      const availableBuckets = await this.getAvailableRewardBuckets(
        manager,
        campaign.id,
        pool.id,
        currentMonth,
      );
      for (const bucket of availableBuckets) {
        if (bucket.available > 0) {
          candidates.push({
            pool,
            bucketMonth: bucket.monthIndex,
            available: bucket.available,
          });
        }
      }
    }

    if (!candidates.length) return null;

    const weighted = candidates.flatMap((candidate) =>
      Array.from({ length: candidate.available }).map(() => ({
        poolId: candidate.pool.id,
        bucketMonth: candidate.bucketMonth,
      })),
    );
    const shuffledEntries = weighted.sort(() => Math.random() - 0.5);
    const uniqueEntries = Array.from(
      new Map(
        shuffledEntries.map((entry) => [
          `${entry.poolId}:${entry.bucketMonth}`,
          entry,
        ]),
      ).values(),
    );

    for (const entry of uniqueEntries) {
      const reserved = await this.tryReserveSpecificReward(
        manager,
        campaign,
        entry.poolId,
        entry.bucketMonth,
      );
      if (reserved) {
        return reserved;
      }
    }

    return null;
  }

  private async tryReserveSpecificReward(
    manager: EntityManagerLike,
    campaign: PromotionCampaign,
    rewardPoolId: number,
    bucketMonth: number,
  ): Promise<{ pool: PromotionRewardPool; bucketMonth: number } | null> {
    const release = await manager
      .createQueryBuilder(PromotionRewardReleaseSchedule, 'release')
      .setLock('pessimistic_write')
      .where('release.promotion_id = :promotionId', { promotionId: campaign.id })
      .andWhere('release.reward_pool_id = :rewardPoolId', { rewardPoolId })
      .andWhere('release.bucket_month = :bucketMonth', { bucketMonth })
      .getOne();

    if (!release || Number(release.release_quantity || 0) <= 0) {
      return null;
    }

    const lockedPool = await manager
      .createQueryBuilder(PromotionRewardPool, 'pool')
      .setLock('pessimistic_write')
      .where('pool.id = :poolId', { poolId: rewardPoolId })
      .andWhere('pool.promotion_id = :promotionId', { promotionId: campaign.id })
      .getOne();

    if (!lockedPool || Number(lockedPool.remaining_quantity || 0) <= 0) {
      return null;
    }

    const available = await this.getAvailableRewardBucketQuantity(
      manager,
      campaign.id,
      rewardPoolId,
      bucketMonth,
    );
    if (available <= 0) {
      return null;
    }

    lockedPool.remaining_quantity = Number(lockedPool.remaining_quantity || 0) - 1;
    lockedPool.reserved_quantity = Number(lockedPool.reserved_quantity || 0) + 1;
    await manager.save(lockedPool);

    return { pool: lockedPool, bucketMonth };
  }

  private async getAvailableRewardBuckets(
    manager: EntityManagerLike,
    promotionId: number,
    rewardPoolId: number,
    maxBucketMonth?: number,
  ): Promise<Array<{ monthIndex: number; releaseQuantity: number; available: number }>> {
    const releases = await manager.find(PromotionRewardReleaseSchedule, {
      where: {
        promotion_id: promotionId,
        reward_pool_id: rewardPoolId,
      },
      order: { bucket_month: 'ASC' },
    });

    const buckets: Array<{
      monthIndex: number;
      releaseQuantity: number;
      available: number;
    }> = [];
    for (const release of releases) {
      if (
        maxBucketMonth &&
        Number(release.bucket_month || 0) > maxBucketMonth
      ) {
        continue;
      }

      const available = await this.getAvailableRewardBucketQuantity(
        manager,
        promotionId,
        rewardPoolId,
        release.bucket_month,
      );
      buckets.push({
        monthIndex: release.bucket_month,
        releaseQuantity: Number(release.release_quantity || 0),
        available,
      });
    }

    return buckets;
  }

  private async getAvailableRewardBucketQuantity(
    manager: EntityManagerLike,
    promotionId: number,
    rewardPoolId: number,
    bucketMonth: number,
  ) {
    const pool = await manager.findOne(PromotionRewardPool, {
      where: { id: rewardPoolId, promotion_id: promotionId },
    });
    if (!pool || Number(pool.remaining_quantity || 0) <= 0) return 0;

    const release = await manager.findOne(PromotionRewardReleaseSchedule, {
      where: {
        promotion_id: promotionId,
        reward_pool_id: rewardPoolId,
        bucket_month: bucketMonth,
      },
    });
    const releaseQuantity = Number(release?.release_quantity || 0);
    if (releaseQuantity <= 0) return 0;

    const consumedCount = await manager.count(PromotionRewardReservation, {
      where: {
        promotion_id: promotionId,
        reward_pool_id: rewardPoolId,
        reward_bucket_month: bucketMonth,
        status: In(['reserved', 'issued']),
      },
    });
    const forcedReservedCount = await manager.count(CustomerPromotionOverride, {
      where: {
        promotion_id: promotionId,
        assigned_reward_pool_id: rewardPoolId,
        assigned_reward_bucket_month: bucketMonth,
        force_win_remaining_count: In([1]),
      },
    });

    return Math.max(0, releaseQuantity - consumedCount - forcedReservedCount);
  }

  private async calculateEffectiveWinRate(
    manager: EntityManagerLike,
    campaign: PromotionCampaign,
    configuredRate: number,
    currentAt: Date,
  ) {
    if (configuredRate <= 0) {
      return 0;
    }

    const pools = await manager.find(PromotionRewardPool, {
      where: { promotion_id: campaign.id },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    if (!pools.length) {
      return 0;
    }

    const currentMonth = this.getCampaignMonthBucket(campaign.start_at, currentAt);
    const releases = await manager.find(PromotionRewardReleaseSchedule, {
      where: { promotion_id: campaign.id },
    });
    const reservations = await manager.find(PromotionRewardReservation, {
      where: {
        promotion_id: campaign.id,
        status: In(['reserved', 'issued']),
      },
    });

    const consumedByPool = new Map<number, number>();
    for (const reservation of reservations) {
      consumedByPool.set(
        reservation.reward_pool_id,
        (consumedByPool.get(reservation.reward_pool_id) || 0) + 1,
      );
    }

    let availableNow = 0;
    let currentMonthReleaseTotal = 0;

    for (const pool of pools) {
      const poolReleaseRows = releases.filter(
        (release) => release.reward_pool_id === pool.id,
      );
      const currentMonthRelease = poolReleaseRows
        .filter((release) => release.bucket_month === currentMonth)
        .reduce(
          (sum, release) => sum + Number(release.release_quantity || 0),
          0,
        );
      const cumulativeRelease = poolReleaseRows
        .filter((release) => release.bucket_month <= currentMonth)
        .reduce(
          (sum, release) => sum + Number(release.release_quantity || 0),
          0,
        );
      const consumedCount = consumedByPool.get(pool.id) || 0;
      const forcedReservedCount = await manager.count(
        CustomerPromotionOverride,
        {
          where: {
            promotion_id: campaign.id,
            assigned_reward_pool_id: pool.id,
            force_win_remaining_count: In([1]),
          },
        },
      );
      const availableBySchedule = Math.max(
        0,
        cumulativeRelease - consumedCount - forcedReservedCount,
      );
      const poolAvailable = Math.min(
        Number(pool.remaining_quantity || 0),
        availableBySchedule,
      );

      currentMonthReleaseTotal += currentMonthRelease;
      availableNow += Math.max(0, poolAvailable);
    }

    if (availableNow <= 0) {
      return 0;
    }

    const elapsedRatio = this.getCampaignBucketElapsedRatio(
      campaign.start_at,
      currentAt,
      currentMonth,
    );
    const baselineQuota = Math.max(1, currentMonthReleaseTotal || availableNow);
    const desiredRemainingNow =
      currentMonthReleaseTotal > 0
        ? currentMonthReleaseTotal * (1 - elapsedRatio)
        : 0;
    const pressureRatio =
      (availableNow - desiredRemainingNow) / baselineQuota;
    const multiplier = this.clamp(0.5, 2.5, 1 + pressureRatio);

    return Number(
      this.clamp(0, 100, configuredRate * multiplier).toFixed(2),
    );
  }

  private getCampaignMonthBucket(startAt: Date, currentAt: Date) {
    const yearDiff = currentAt.getUTCFullYear() - startAt.getUTCFullYear();
    const monthDiff = currentAt.getUTCMonth() - startAt.getUTCMonth();
    return yearDiff * 12 + monthDiff + 1;
  }

  private getCampaignBucketElapsedRatio(
    startAt: Date,
    currentAt: Date,
    monthBucket: number,
  ) {
    const bucketStart = new Date(startAt);
    bucketStart.setUTCMonth(bucketStart.getUTCMonth() + monthBucket - 1);

    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCMonth(bucketEnd.getUTCMonth() + 1);

    const totalMs = bucketEnd.getTime() - bucketStart.getTime();
    if (totalMs <= 0) {
      return 1;
    }

    const elapsedMs = currentAt.getTime() - bucketStart.getTime();
    return this.clamp(0, 1, elapsedMs / totalMs);
  }

  private clamp(min: number, max: number, value: number) {
    return Math.min(max, Math.max(min, value));
  }
}
