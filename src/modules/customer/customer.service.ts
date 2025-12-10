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
    QueryHelper.applyFilters(queryBuilder, searchDto, 'customer', ['search']);

    // 3. Backward compatibility for 'search' field
    if (!searchDto.keyword && (searchDto as any).search) {
       const search = (searchDto as any).search;
       queryBuilder.andWhere(
        '(customer.name ILIKE :search OR customer.phone ILIKE :search OR customer.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total, page, limit };
  }
}
