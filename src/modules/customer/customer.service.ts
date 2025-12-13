import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SearchCustomerDto } from './dto/search-customer.dto';
import { QueryHelper } from '../../common/helpers/query-helper';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const customer = this.customerRepository.create(createCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async findAll(page: number = 1, limit: number = 20, search?: string): Promise<{ data: Customer[]; total: number }> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.customerRepository.createQueryBuilder('customer');

    if (search) {
      queryBuilder.where(
        'customer.name ILIKE :search OR customer.phone ILIKE :search OR customer.code ILIKE :search',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('customer.created_at', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }



  async findOne(id: number): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    return await this.customerRepository.findOne({ where: { phone } });
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, updateCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async remove(id: number): Promise<void> {
    const customer = await this.findOne(id);
    await this.customerRepository.remove(customer);
  }
  async searchCustomers(searchDto: SearchCustomerDto) {
    const queryBuilder = this.customerRepository.createQueryBuilder('customer');

    // 1. Base Search (Page, Sort, Keyword)
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'customer',
      ['name', 'phone', 'code', 'address'] // Global search fields
    );

    // 2. Filters (type, phone, code...)
    QueryHelper.applyFilters(queryBuilder, searchDto, 'customer', []);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Lấy danh sách khách hàng có công nợ (chưa thanh toán hết)
   * @param searchDto - DTO tìm kiếm
   * @returns Danh sách khách hàng có nợ
   */
  async getCustomersWithDebt(searchDto: SearchCustomerDto) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoin('debt_notes', 'debt_note', 'debt_note.customer_id = customer.id')
      .where('debt_note.remaining_amount > 0')
      .andWhere('debt_note.status IN (:...statuses)', { 
        statuses: ['active', 'overdue'] 
      })
      .groupBy('customer.id');

    // 1. Base Search (Page, Sort, Keyword)
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'customer',
      ['name', 'phone', 'code', 'address']
    );

    // 2. Filters
    QueryHelper.applyFilters(queryBuilder, searchDto, 'customer', []);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Lấy tổng nợ và số phiếu nợ của khách hàng
   * @param customerId - ID của khách hàng
   * @returns Tổng nợ và số phiếu nợ
   */
  async getCustomerDebtSummary(customerId: number): Promise<{
    customer_id: number;
    total_debt: number;
    debt_note_count: number;
  }> {
    const result = await this.customerRepository
      .createQueryBuilder('customer')
      .leftJoin('debt_notes', 'debt_note', 'debt_note.customer_id = customer.id')
      .select('customer.id', 'customer_id')
      .addSelect('COALESCE(SUM(debt_note.remaining_amount), 0)', 'total_debt')
      .addSelect('COUNT(CASE WHEN debt_note.remaining_amount > 0 THEN 1 END)', 'debt_note_count')
      .where('customer.id = :customerId', { customerId })
      .andWhere('debt_note.status IN (:...statuses)', { statuses: ['active', 'overdue'] })
      .groupBy('customer.id')
      .getRawOne();

    if (!result) {
      return {
        customer_id: customerId,
        total_debt: 0,
        debt_note_count: 0,
      };
    }

    return {
      customer_id: Number(result.customer_id),
      total_debt: Number(result.total_debt || 0),
      debt_note_count: Number(result.debt_note_count || 0),
    };
  }
}
