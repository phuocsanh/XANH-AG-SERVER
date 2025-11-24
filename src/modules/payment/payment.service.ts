import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SearchPaymentDto } from './dto/search-payment.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    try {
      const payment = this.paymentRepository.create({
        ...createPaymentDto,
        created_by: 1, // TODO: Get user ID from context
      });
      return await this.paymentRepository.save(payment);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'phiếu thu');
    }
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentRepository.find({
      order: { created_at: 'DESC' },
      relations: ['customer'],
    });
  }

  async findOne(id: number): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { id },
      relations: ['customer', 'allocations'],
    });
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto): Promise<Payment | null> {
    try {
      await this.paymentRepository.update(id, updatePaymentDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'phiếu thu');
    }
  }

  async remove(id: number): Promise<void> {
    await this.paymentRepository.delete(id);
  }

  async search(searchDto: SearchPaymentDto): Promise<{
    data: Payment[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.paymentRepository.createQueryBuilder('payment');
    
    // Join customer for searching
    queryBuilder.leftJoinAndSelect('payment.customer', 'customer');

    this.buildSearchConditions(queryBuilder, searchDto, 'payment');

    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);
    queryBuilder.orderBy('payment.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<Payment>,
    searchDto: SearchPaymentDto,
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
    if (!filter.field || !filter.operator) {
      return null;
    }

    const paramName = `param_${index}`;
    // Handle fields from joined tables if needed
    let field = `${alias}.${filter.field}`;
    if (filter.field.startsWith('customer.')) {
        field = filter.field; // Already has alias
    }

    switch (filter.operator) {
      case 'eq':
        parameters[paramName] = filter.value;
        return `${field} = :${paramName}`;
      case 'ne':
        parameters[paramName] = filter.value;
        return `${field} != :${paramName}`;
      case 'gt':
        parameters[paramName] = filter.value;
        return `${field} > :${paramName}`;
      case 'lt':
        parameters[paramName] = filter.value;
        return `${field} < :${paramName}`;
      case 'gte':
        parameters[paramName] = filter.value;
        return `${field} >= :${paramName}`;
      case 'lte':
        parameters[paramName] = filter.value;
        return `${field} <= :${paramName}`;
      case 'like':
        parameters[paramName] = `%${filter.value}%`;
        return `${field} LIKE :${paramName}`;
      case 'ilike':
        parameters[paramName] = `%${filter.value}%`;
        return `LOWER(${field}) LIKE LOWER(:${paramName})`;
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
      case 'isnull':
        return `${field} IS NULL`;
      case 'isnotnull':
        return `${field} IS NOT NULL`;
      default:
        return null;
    }
  }
}
