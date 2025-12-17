import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AreaOfEachPlotOfLand } from '../../entities/area-of-each-plot-of-land.entity';
import { CreateAreaOfEachPlotOfLandDto, UpdateAreaOfEachPlotOfLandDto } from './area-of-each-plot-of-land.dto';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';

/**
 * Service quản lý các vùng/lô đất
 */
@Injectable()
export class AreaOfEachPlotOfLandService {
  private readonly logger = new Logger(AreaOfEachPlotOfLandService.name);

  constructor(
    @InjectRepository(AreaOfEachPlotOfLand)
    private areaRepository: Repository<AreaOfEachPlotOfLand>,
  ) {}

  /**
   * Tạo vùng/lô đất mới
   */
  async create(createDto: CreateAreaOfEachPlotOfLandDto): Promise<AreaOfEachPlotOfLand> {
    try {
      this.logger.log(`Tạo vùng/lô đất mới: ${createDto.name}`);
      
      // Auto-generate code nếu không được cung cấp
      if (!createDto.code) {
        createDto.code = CodeGeneratorHelper.generateCode('AREA');
      }

      const area = this.areaRepository.create(createDto);
      const saved = await this.areaRepository.save(area);
      
      this.logger.log(`✅ Đã tạo vùng/lô đất ID: ${saved.id}`);
      return saved;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tạo vùng/lô đất: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Tìm kiếm vùng/lô đất với pagination
   */
  async search(searchDto: any): Promise<{ data: AreaOfEachPlotOfLand[]; total: number }> {
    try {
      const { page = 1, limit = 20, keyword } = searchDto;
      const skip = (page - 1) * limit;

      const queryBuilder = this.areaRepository
        .createQueryBuilder('area')
        .orderBy('area.created_at', 'DESC');

      // Tìm kiếm theo keyword (tên hoặc mã)
      if (keyword) {
        queryBuilder.andWhere(
          '(area.name ILIKE :keyword OR area.code ILIKE :keyword)',
          { keyword: `%${keyword}%` }
        );
      }

      queryBuilder.skip(skip).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();
      
      this.logger.log(`📋 Tìm thấy ${data.length}/${total} vùng/lô đất`);
      return { data, total };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tìm kiếm: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể tìm kiếm: ${err.message}`);
    }
  }

  /**
   * Lấy chi tiết vùng/lô đất theo ID
   */
  async findOne(id: number): Promise<AreaOfEachPlotOfLand> {
    try {
      const area = await this.areaRepository.findOne({ where: { id } });

      if (!area) {
        throw new NotFoundException(`Không tìm thấy vùng/lô đất với ID: ${id}`);
      }

      return area;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi lấy thông tin: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể lấy thông tin: ${err.message}`);
    }
  }

  /**
   * Cập nhật vùng/lô đất
   */
  async update(id: number, updateDto: UpdateAreaOfEachPlotOfLandDto): Promise<AreaOfEachPlotOfLand> {
    try {
      const area = await this.findOne(id);

      // Nếu cập nhật mã, kiểm tra trùng lặp
      if (updateDto.code && updateDto.code !== area.code) {
        const existingArea = await this.areaRepository.findOne({ 
          where: { code: updateDto.code } 
        });
        
        if (existingArea) {
          throw new BadRequestException(`Mã vùng/lô đất "${updateDto.code}" đã tồn tại`);
        }
      }

      Object.assign(area, updateDto);
      const updated = await this.areaRepository.save(area);
      
      this.logger.log(`✅ Đã cập nhật vùng/lô đất ID: ${id}`);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi cập nhật: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể cập nhật: ${err.message}`);
    }
  }

  /**
   * Xóa vùng/lô đất
   */
  async remove(id: number): Promise<void> {
    try {
      const area = await this.findOne(id);
      await this.areaRepository.remove(area);
      
      this.logger.log(`✅ Đã xóa vùng/lô đất ID: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi xóa: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể xóa: ${err.message}`);
    }
  }
}
