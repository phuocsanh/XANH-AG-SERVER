import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SearchCustomerDto } from './dto/search-customer.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { User } from '../../entities/users.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    try {
      // 1. Kiểm tra số điện thoại đã tồn tại trong bảng Customer chưa
      if (createCustomerDto.phone) {
        const existingCustomer = await this.findByPhone(createCustomerDto.phone);
        if (existingCustomer) {
          throw new ConflictException(`Số điện thoại ${createCustomerDto.phone} đã tồn tại trong hệ thống khách hàng.`);
        }
      }

      // 2. Kiểm tra số điện thoại đã được dùng làm account của USER chưa
      if (createCustomerDto.phone) {
        const existingUser = await this.customerRepository.manager
          .getRepository('User')
          .findOne({ where: { account: createCustomerDto.phone } });
        
        if (existingUser) {
          throw new ConflictException('Số điện thoại này đã được sử dụng cho một tài khoản đăng nhập khác.');
        }
      }

      // Auto-generate code nếu không được cung cấp
      if (!createCustomerDto.code) {
        createCustomerDto.code = CodeGeneratorHelper.generateCode('CUS');
      }

      const customer = this.customerRepository.create(createCustomerDto);
      return await this.customerRepository.save(customer);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'khách hàng');
    }
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
    try {
      const customer = await this.findOne(id);
      const oldPhone = customer.phone;
      
      // 1. Kiểm tra trùng số điện thoại nếu thay đổi
      if (updateCustomerDto.phone && updateCustomerDto.phone !== oldPhone) {
        const existingCustomer = await this.findByPhone(updateCustomerDto.phone);
        if (existingCustomer && existingCustomer.id !== id) {
          throw new ConflictException(`Số điện thoại ${updateCustomerDto.phone} đã được sử dụng bởi khách hàng khác.`);
        }
      }

      // Cập nhật thông tin khách hàng
      Object.assign(customer, updateCustomerDto);
      const updatedCustomer = await this.customerRepository.save(customer);

      // Nếu số điện thoại thay đổi, cập nhật tài khoản đăng nhập nếu có
      if (updateCustomerDto.phone && updateCustomerDto.phone !== oldPhone) {
        const userRepository = this.customerRepository.manager.getRepository(User);
        const userProfileRepository = this.customerRepository.manager.getRepository(UserProfile);

        // Tìm user liên kết với khách hàng này
        const user = await userRepository.findOne({ where: { customer_id: id } });

        if (user) {
          // Kiểm tra xem số điện thoại mới đã được ai khác dùng làm account chưa
          const existingUser = await userRepository.findOne({
            where: { account: updateCustomerDto.phone },
          });

          if (existingUser && existingUser.id !== user.id) {
            throw new ConflictException('Số điện thoại mới đã được sử dụng cho một tài khoản khác');
          }

          // Cập nhật account cho User
          user.account = updateCustomerDto.phone;
          await userRepository.save(user);

          // Cập nhật profile liên kết
          const profile = await userProfileRepository.findOne({ where: { user_id: user.id } });
          if (profile) {
            profile.account = updateCustomerDto.phone;
            profile.mobile = updateCustomerDto.phone;
            await userProfileRepository.save(profile);
          }
        }
      }

      return updatedCustomer;
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'khách hàng');
    }
  }

  async remove(id: number): Promise<void> {
    const customer = await this.findOne(id);
    await this.customerRepository.remove(customer);
  }
  async searchCustomers(searchDto: SearchCustomerDto) {
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.users', 'users'); // Load relation users để check đã có tài khoản chưa

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
    
    // Debug: Log để check users có được load không
    if (data.length > 0) {
      console.log('First customer users:', data[0]?.users);
    }
    
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
      .leftJoin('debt_notes', 'debt_note', 'debt_note.customer_id = customer.id AND debt_note.remaining_amount > 0')
      .select('customer.id', 'customer_id')
      .addSelect('COALESCE(SUM(debt_note.remaining_amount), 0)', 'total_debt')
      .addSelect('COUNT(debt_note.id)', 'debt_note_count')
      .where('customer.id = :customerId', { customerId })
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
