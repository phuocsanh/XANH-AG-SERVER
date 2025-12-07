import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Season } from '../../entities/season.entity';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@Injectable()
export class SeasonService {
  constructor(
    @InjectRepository(Season)
    private readonly seasonRepository: Repository<Season>,
  ) {}

  async create(createSeasonDto: CreateSeasonDto): Promise<Season> {
    const season = this.seasonRepository.create(createSeasonDto);
    return await this.seasonRepository.save(season);
  }

  async findAll(): Promise<Season[]> {
    return await this.seasonRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Season> {
    const season = await this.seasonRepository.findOne({ where: { id } });
    if (!season) {
      throw new NotFoundException(`Season with ID ${id} not found`);
    }
    return season;
  }

  async update(id: number, updateSeasonDto: UpdateSeasonDto): Promise<Season> {
    const season = await this.findOne(id);
    Object.assign(season, updateSeasonDto);
    return await this.seasonRepository.save(season);
  }

  async remove(id: number): Promise<void> {
    const season = await this.findOne(id);
    await this.seasonRepository.remove(season);
  }

  async findActive(): Promise<Season[]> {
    return await this.seasonRepository.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async search(searchDto: any): Promise<{ data: Season[]; total: number }> {
    const { page = 1, limit = 20, filters = [] } = searchDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.seasonRepository
      .createQueryBuilder('season')
      .orderBy('season.created_at', 'DESC');

    // Áp dụng filters nếu có
    if (filters && filters.length > 0) {
      filters.forEach((filter: any, index: number) => {
        const paramName = `param${index}`;
        if (filter.operator === 'eq') {
          queryBuilder.andWhere(`season.${filter.field} = :${paramName}`, {
            [paramName]: filter.value,
          });
        } else if (filter.operator === 'like') {
          queryBuilder.andWhere(`season.${filter.field} ILIKE :${paramName}`, {
            [paramName]: `%${filter.value}%`,
          });
        }
      });
    }

    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }
}
