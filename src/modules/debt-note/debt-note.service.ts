import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CreateDebtNoteDto } from './dto/create-debt-note.dto';
import { UpdateDebtNoteDto } from './dto/update-debt-note.dto';
import { SearchDebtNoteDto } from './dto/search-debt-note.dto';
import { FilterConditionDto } from '../payment/dto/filter-condition.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

@Injectable()
export class DebtNoteService {
  constructor(
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
  ) {}

  async create(createDto: CreateDebtNoteDto): Promise<DebtNote> {
    try {
      const debtNote = this.debtNoteRepository.create({
        ...createDto,
        remaining_amount: createDto.amount, // Initially remaining = amount
        paid_amount: 0,
        status: DebtNoteStatus.ACTIVE,
        created_by: 1, // TODO: Get user ID
      });
      return await this.debtNoteRepository.save(debtNote);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'phiếu công nợ');
    }
  }

  async findAll(): Promise<DebtNote[]> {
    return this.debtNoteRepository.find({
      relations: ['customer', 'season'],
      order: { created_at: 'DESC' },
    });
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
  }> {
    const queryBuilder = this.debtNoteRepository.createQueryBuilder('debt_note');
    
    queryBuilder.leftJoinAndSelect('debt_note.customer', 'customer');
    queryBuilder.leftJoinAndSelect('debt_note.season', 'season');

    this.buildSearchConditions(queryBuilder, searchDto, 'debt_note');

    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);
    queryBuilder.orderBy('debt_note.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<DebtNote>,
    searchDto: SearchDebtNoteDto,
    alias: string,
  ): void {
    if (searchDto.filters && searchDto.filters.length > 0) {
      const operator = searchDto.operator || 'AND';
      const conditions: string[] = [];
      const parameters: { [key: string]: any } = {};

      searchDto.filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(
          filter,
          alias,
          index,
          parameters,
        );
        if (condition) {
          conditions.push(condition);
        }
      });

      if (conditions.length > 0) {
        const combinedCondition = conditions.join(` ${operator} `);
        queryBuilder.andWhere(`(${combinedCondition})`, parameters);
      }
    }
  }

  private buildFilterCondition(
    filter: FilterConditionDto,
    alias: string,
    index: number,
    parameters: { [key: string]: any },
  ): string | null {
    if (!filter.field || !filter.operator) return null;
    const paramName = `param_${index}`;
    let field = `${alias}.${filter.field}`;
    if (filter.field.includes('.')) {
        field = filter.field;
    }

    switch (filter.operator) {
      case 'eq': parameters[paramName] = filter.value; return `${field} = :${paramName}`;
      case 'ne': parameters[paramName] = filter.value; return `${field} != :${paramName}`;
      case 'gt': parameters[paramName] = filter.value; return `${field} > :${paramName}`;
      case 'lt': parameters[paramName] = filter.value; return `${field} < :${paramName}`;
      case 'gte': parameters[paramName] = filter.value; return `${field} >= :${paramName}`;
      case 'lte': parameters[paramName] = filter.value; return `${field} <= :${paramName}`;
      case 'like': parameters[paramName] = `%${filter.value}%`; return `${field} LIKE :${paramName}`;
      case 'ilike': parameters[paramName] = `%${filter.value}%`; return `LOWER(${field}) LIKE LOWER(:${paramName})`;
      case 'in':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} IN (:...${paramName})`;
        }
        return null;
      case 'notin':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} NOT IN (:...${paramName})`;
        }
        return null;
      case 'isnull': return `${field} IS NULL`;
      case 'isnotnull': return `${field} IS NOT NULL`;
      default: return null;
    }
  }
}
