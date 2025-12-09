import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { DebtNote } from '../../entities/debt-note.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SearchCustomerDto } from './dto/search-customer.dto';
import { QueryHelper } from '../../common/helpers/query-helper';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(DebtNote)
    private readonly debtNoteRepository: Repository<DebtNote>,
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

  async getDebtors(page: number = 1, limit: number = 20, search?: string): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.customerRepository.createQueryBuilder('customer');

    // Filter by debtors using a subquery to check for existence of unpaid debt notes
    queryBuilder.where((qb) => {
      const subQuery = qb
        .subQuery()
        .select('dn.customer_id')
        .from(DebtNote, 'dn')
        .where('dn.remaining_amount > 0')
        .getQuery();
      return 'customer.id IN ' + subQuery;
    });

    if (search) {
      queryBuilder.andWhere(
        '(customer.name ILIKE :search OR customer.phone ILIKE :search OR customer.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('customer.name', 'ASC');
    queryBuilder.skip(skip).take(limit);

    const [customers, total] = await queryBuilder.getManyAndCount();

    if (customers.length === 0) {
      return { data: [], total };
    }

    // Get debt statistics for the fetched customers
    const customerIds = customers.map((c) => c.id);
    const debtStats = await this.debtNoteRepository
      .createQueryBuilder('dn')
      .select('dn.customer_id', 'customer_id')
      .addSelect('SUM(dn.remaining_amount)', 'total_debt')
      .addSelect('COUNT(dn.id)', 'debt_count')
      .where('dn.customer_id IN (:...ids)', { ids: customerIds })
      .andWhere('dn.remaining_amount > 0')
      .groupBy('dn.customer_id')
      .getRawMany();

    // Merge statistics into customer data
    const data = customers.map((customer) => {
      const stat = debtStats.find((s) => s.customer_id === customer.id);
      return {
        ...customer,
        total_debt: stat ? Number(stat.total_debt) : 0,
        debt_count: stat ? Number(stat.debt_count) : 0,
      };
    });

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
  async searchCustomers(searchDto: SearchCustomerDto): Promise<{ data: Customer[]; total: number }> {
    const queryBuilder = this.customerRepository.createQueryBuilder('customer');

    // 1. Base Search (Page, Sort, Keyword)
    QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'customer',
      ['name', 'phone', 'code', 'address'] // Global search fields
    );

    // 2. Filters (type, phone, code...)
    QueryHelper.applyFilters(queryBuilder, searchDto, 'customer', ['search']);

    // 3. Backward compatibility for 'search' field (mapped to keyword in base search)
    // Nếu keyword chưa set nhưng search có set => dùng search làm keyword
    if (!searchDto.keyword && searchDto.search) {
       queryBuilder.andWhere(
        '(customer.name ILIKE :search OR customer.phone ILIKE :search OR customer.code ILIKE :search)',
        { search: `%${searchDto.search}%` },
      );
    }

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }
}
