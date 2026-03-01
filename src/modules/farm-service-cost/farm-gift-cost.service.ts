import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FarmGiftCost } from '../../entities/farm-gift-cost.entity';

@Injectable()
export class FarmGiftCostService {
  private readonly logger = new Logger(FarmGiftCostService.name);

  constructor(
    @InjectRepository(FarmGiftCost)
    private farmGiftCostRepository: Repository<FarmGiftCost>,
  ) {}

  async create(createDto: any, manager?: any): Promise<FarmGiftCost> {
    try {
      const repo = manager ? manager.getRepository(FarmGiftCost) : this.farmGiftCostRepository;
      
      // Mapping gift specific fields
      const giftData = {
        name: createDto.name,
        amount: createDto.amount,
        season_id: createDto.season_id,
        customer_id: createDto.customer_id,
        rice_crop_id: createDto.rice_crop_id,
        notes: createDto.notes,
        gift_date: createDto.expense_date || createDto.gift_date || new Date(),
        source: createDto.source || 'manually_awarded',
        invoice_id: createDto.invoice_id,
      };

      const gift = repo.create(giftData);
      const saved = await repo.save(gift);
      this.logger.log(`🎁 Đã tạo quà tặng: ${saved.name} - ${saved.amount}đ`);
      return saved;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tạo quà tặng: ${err.message}`);
      throw error;
    }
  }

  async search(searchDto: any): Promise<{ data: FarmGiftCost[]; total: number }> {
    const queryBuilder = this.farmGiftCostRepository
      .createQueryBuilder('gift')
      .leftJoinAndSelect('gift.season', 'season')
      .leftJoinAndSelect('gift.customer', 'customer')
      .leftJoinAndSelect('gift.rice_crop', 'rice_crop');

    if (searchDto.season_id) queryBuilder.andWhere('gift.season_id = :seasonId', { seasonId: searchDto.season_id });
    if (searchDto.customer_id) queryBuilder.andWhere('gift.customer_id = :customerId', { customerId: searchDto.customer_id });
    if (searchDto.rice_crop_id) queryBuilder.andWhere('gift.rice_crop_id = :riceCropId', { riceCropId: searchDto.rice_crop_id });
    if (searchDto.source) queryBuilder.andWhere('gift.source = :source', { source: searchDto.source });

    if (searchDto.keyword) {
      queryBuilder.andWhere('(gift.name LIKE :keyword OR gift.notes LIKE :keyword)', { keyword: `%${searchDto.keyword}%` });
    }

    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.orderBy('gift.gift_date', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  async findOne(id: number): Promise<FarmGiftCost> {
    const gift = await this.farmGiftCostRepository.findOne({
      where: { id },
      relations: ['season', 'customer', 'rice_crop'],
    });
    if (!gift) throw new NotFoundException(`Không tìm thấy quà tặng với ID: ${id}`);
    return gift;
  }

  async update(id: number, updateDto: any): Promise<FarmGiftCost> {
    const gift = await this.findOne(id);
    Object.assign(gift, updateDto);
    if (updateDto.expense_date) gift.gift_date = new Date(updateDto.expense_date);
    return this.farmGiftCostRepository.save(gift);
  }

  async remove(id: number): Promise<void> {
    const gift = await this.findOne(id);
    await this.farmGiftCostRepository.remove(gift);
  }

  async createFromInvoiceGift(
    invoiceId: number,
    customerId: number,
    seasonId: number,
    riceCropId: number | undefined,
    giftDescription: string,
    giftValue: number,
    invoiceDate: Date,
  ): Promise<FarmGiftCost> {
    return this.create({
      name: `Quà tặng: ${giftDescription}`,
      amount: giftValue,
      season_id: seasonId,
      customer_id: customerId,
      rice_crop_id: riceCropId,
      notes: `Tự động tạo từ hóa đơn #${invoiceId}`,
      gift_date: invoiceDate,
      source: 'gift_from_invoice',
      invoice_id: invoiceId,
    });
  }
}
