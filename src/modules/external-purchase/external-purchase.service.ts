import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalPurchase, ExternalPurchaseItem } from '../../entities/external-purchase.entity';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { CreateExternalPurchaseDto, UpdateExternalPurchaseDto } from './dto/external-purchase.dto';

@Injectable()
export class ExternalPurchaseService {
  private readonly logger = new Logger(ExternalPurchaseService.name);

  constructor(
    @InjectRepository(ExternalPurchase)
    private externalPurchaseRepository: Repository<ExternalPurchase>,
    @InjectRepository(RiceCrop)
    private riceCropRepository: Repository<RiceCrop>,
  ) {}

  /**
   * Tạo hóa đơn mua ngoài mới
   */
  async create(dto: CreateExternalPurchaseDto, userId: number): Promise<ExternalPurchase> {
    // Kiểm tra rice_crop tồn tại
    const riceCrop = await this.riceCropRepository.findOne({
      where: { id: dto.rice_crop_id },
    });

    if (!riceCrop) {
      throw new NotFoundException('Không tìm thấy Ruộng lúa');
    }

    const queryRunner = this.externalPurchaseRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tạo external purchase
      const purchase = queryRunner.manager.create(ExternalPurchase, {
        rice_crop_id: dto.rice_crop_id,
        customer_id: riceCrop.customer_id,
        purchase_date: dto.purchase_date,
        supplier_name: dto.supplier_name,
        total_amount: dto.total_amount,
        ...(dto.notes && { notes: dto.notes }),
        created_by: userId,
      });

      const savedPurchase = await queryRunner.manager.save(purchase);

      // Tạo items
      for (const itemDto of dto.items) {
        const item = queryRunner.manager.create(ExternalPurchaseItem, {
          external_purchase_id: savedPurchase.id,
          product_name: itemDto.product_name,
          quantity: itemDto.quantity,
          unit_price: itemDto.unit_price,
          total_price: itemDto.total_price,
          ...(itemDto.notes && { notes: itemDto.notes }),
        });
        await queryRunner.manager.save(item);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Đã tạo hóa đơn mua ngoài ID: ${savedPurchase.id}`);

      // Trả về với items
      return this.findOne(savedPurchase.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Lỗi khi tạo hóa đơn mua ngoài:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lấy danh sách hóa đơn theo rice_crop_id
   */
  async findByRiceCrop(riceCropId: number): Promise<ExternalPurchase[]> {
    return this.externalPurchaseRepository.find({
      where: { rice_crop_id: riceCropId },
      relations: ['items', 'customer'],
      order: { purchase_date: 'DESC' },
    });
  }

  /**
   * Lấy chi tiết 1 hóa đơn
   */
  async findOne(id: number): Promise<ExternalPurchase> {
    const purchase = await this.externalPurchaseRepository.findOne({
      where: { id },
      relations: ['items', 'customer', 'riceCrop'],
    });

    if (!purchase) {
      throw new NotFoundException('Không tìm thấy hóa đơn');
    }

    return purchase;
  }

  /**
   * Cập nhật hóa đơn (chỉ người tạo hoặc admin)
   */
  async update(
    id: number,
    dto: UpdateExternalPurchaseDto,
    userId: number,
  ): Promise<ExternalPurchase> {
    const purchase = await this.findOne(id);

    // Kiểm tra quyền: chỉ người tạo mới được sửa
    if (purchase.created_by !== userId) {
      throw new ForbiddenException('Bạn không có quyền sửa hóa đơn này');
    }

    const queryRunner = this.externalPurchaseRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Cập nhật thông tin chung
      if (dto.purchase_date) purchase.purchase_date = new Date(dto.purchase_date);
      if (dto.supplier_name) purchase.supplier_name = dto.supplier_name;
      if (dto.total_amount !== undefined) purchase.total_amount = dto.total_amount;
      if (dto.notes !== undefined) purchase.notes = dto.notes;

      await queryRunner.manager.save(purchase);

      // Cập nhật items nếu có
      if (dto.items) {
        // Xóa items cũ
        await queryRunner.manager.delete(ExternalPurchaseItem, {
          external_purchase_id: id,
        });

        // Tạo items mới
        for (const itemDto of dto.items) {
          const item = queryRunner.manager.create(ExternalPurchaseItem, {
            external_purchase_id: id,
            product_name: itemDto.product_name,
            quantity: itemDto.quantity,
            unit_price: itemDto.unit_price,
            total_price: itemDto.total_price,
            ...(itemDto.notes && { notes: itemDto.notes }),
          });
          await queryRunner.manager.save(item);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Đã cập nhật hóa đơn mua ngoài ID: ${id}`);

      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Lỗi khi cập nhật hóa đơn:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Xóa hóa đơn (chỉ người tạo hoặc admin)
   */
  async remove(id: number, userId: number): Promise<void> {
    const purchase = await this.findOne(id);

    // Kiểm tra quyền
    if (purchase.created_by !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa hóa đơn này');
    }

    await this.externalPurchaseRepository.delete(id);
    this.logger.log(`Đã xóa hóa đơn mua ngoài ID: ${id}`);
  }
}
