import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Loan, LoanStatus } from '../../entities/loan.entity';
import { Customer } from '../../entities/customer.entity';
import { Payment } from '../../entities/payment.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { SearchLoanDto } from './dto/search-loan.dto';
import { RepayLoanDto } from './dto/repay-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';
import { QueryHelper } from '../../common/helpers/query-helper';

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

const toDateOnlyString = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  return new Date(text).toISOString().slice(0, 10);
};

const toUtcDay = (value: Date | string) => {
  const parts = toDateOnlyString(value).split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) {
    throw new BadRequestException('Ngày không hợp lệ');
  }

  return Date.UTC(year, month - 1, day);
};

const diffDays = (start: Date | string, end: Date | string) => {
  const ms = toUtcDay(end) - toUtcDay(start);
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

@Injectable()
export class LoanService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  private buildLoanTotals(principal: number, monthlyRate: number, days: number) {
    const interest = roundMoney((principal * monthlyRate * days) / 3000);
    const total = roundMoney(principal + interest);
    return { interest, total };
  }

  async create(dto: CreateLoanDto, userId: number): Promise<Loan> {
    const customer = await this.customerRepository.findOne({ where: { id: dto.customer_id } });
    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    const code = CodeGeneratorHelper.generateUniqueCode('LN');
    const loanDays = 0;
    // Lấy lãi suất hàng tháng từ DTO nếu được truyền lên, mặc định là 0
    const monthlyInterestRate = dto.monthly_interest_rate !== undefined ? roundMoney(dto.monthly_interest_rate) : 0;
    const { interest, total } = this.buildLoanTotals(dto.principal_amount, monthlyInterestRate, loanDays);

    const loan = this.loanRepository.create({
      code,
      customer_id: dto.customer_id,
      loan_date: toDateOnlyString(dto.loan_date) as any,
      principal_amount: roundMoney(dto.principal_amount),
      monthly_interest_rate: monthlyInterestRate,
      loan_days: loanDays,
      interest_amount: interest,
      total_amount: total,
      paid_amount: 0,
      remaining_amount: total,
      status: LoanStatus.ACTIVE,
      created_by: userId,
      ...(dto.notes ? { notes: dto.notes } : {}),
    } as any);

    const savedLoan = await this.loanRepository.save(loan as any);
    return savedLoan as Loan;
  }

  async findOne(id: number): Promise<Loan | null> {
    return this.loanRepository.findOne({
      where: { id },
      relations: ['customer', 'creator', 'settler'],
    });
  }

  async update(id: number, dto: UpdateLoanDto): Promise<Loan | null> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy khoản vay');
    }
    if (existing.status === LoanStatus.PAID) {
      throw new BadRequestException('Không thể chỉnh sửa khoản vay đã thanh toán');
    }

    const nextPrincipal = dto.principal_amount !== undefined
      ? roundMoney(dto.principal_amount)
      : Number(existing.principal_amount);
    // Lấy lãi suất mới từ DTO hoặc giữ nguyên lãi suất cũ của khoản vay
    const nextInterestRate = dto.monthly_interest_rate !== undefined
      ? roundMoney(dto.monthly_interest_rate)
      : Number(existing.monthly_interest_rate || 0);
    const { interest, total } = this.buildLoanTotals(nextPrincipal, nextInterestRate, 0);

    await this.loanRepository.update(id, {
      ...dto,
      ...(dto.loan_date ? { loan_date: toDateOnlyString(dto.loan_date) as any } : {}),
      principal_amount: nextPrincipal,
      monthly_interest_rate: nextInterestRate,
      loan_days: 0,
      interest_amount: interest,
      total_amount: total,
      remaining_amount: total,
    });

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy khoản vay');
    }
    if (existing.status === LoanStatus.PAID) {
      throw new BadRequestException('Không thể xóa khoản vay đã thanh toán');
    }

    await this.loanRepository.delete(id);
  }

  async search(searchDto: SearchLoanDto): Promise<{
    data: Loan[];
    total: number;
    page: number;
    limit: number;
    summary: { total_principal: number; total_interest: number; total_remaining: number };
  }> {
    const queryBuilder = this.loanRepository.createQueryBuilder('loan');
    queryBuilder.leftJoinAndSelect('loan.customer', 'customer');
    queryBuilder.leftJoin('loan.creator', 'creator').addSelect(['creator.id', 'creator.account']);
    queryBuilder.leftJoin('loan.settler', 'settler').addSelect(['settler.id', 'settler.account']);

    const { page, limit } = QueryHelper.applyBaseSearch(queryBuilder, searchDto, 'loan', ['code', 'customer.name', 'customer.phone']);
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'loan',
      ['page', 'limit', 'keyword', 'sort', 'sort_by', 'sort_order', 'customer_name', 'customer_phone', 'loan_date_start', 'loan_date_end', 'repayment_date_start', 'repayment_date_end'],
      { customer_name: 'customer.name', customer_phone: 'customer.phone' },
    );

    if (searchDto.loan_date_start) {
      queryBuilder.andWhere('loan.loan_date >= :loanDateStart', { loanDateStart: searchDto.loan_date_start });
    }
    if (searchDto.loan_date_end) {
      queryBuilder.andWhere('loan.loan_date <= :loanDateEnd', { loanDateEnd: searchDto.loan_date_end });
    }
    if (searchDto.repayment_date_start) {
      queryBuilder.andWhere('loan.repayment_date >= :repaymentDateStart', { repaymentDateStart: searchDto.repayment_date_start });
    }
    if (searchDto.repayment_date_end) {
      queryBuilder.andWhere('loan.repayment_date <= :repaymentDateEnd', { repaymentDateEnd: searchDto.repayment_date_end });
    }
    if (searchDto.status) {
      queryBuilder.andWhere('loan.status = :status', { status: searchDto.status });
    }
    if (searchDto.customer_name || searchDto.customer_phone) {
      const nameKeyword = searchDto.customer_name ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_name)}%` : null;
      const phoneKeyword = searchDto.customer_phone ? `%${QueryHelper.sanitizeKeyword(searchDto.customer_phone)}%` : null;
      queryBuilder.andWhere(new Brackets((qb) => {
        if (nameKeyword) {
          qb.orWhere(`regexp_replace(unaccent(customer.name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`, { nameKeyword });
        }
        if (phoneKeyword) {
          qb.orWhere('customer.phone ILIKE :phoneKeyword', { phoneKeyword });
        }
      }));
    }

    const [items, total] = await queryBuilder.getManyAndCount();
    const summary = await queryBuilder
      .clone()
      .skip(undefined)
      .take(undefined)
      .orderBy()
      .select('COALESCE(SUM(loan.principal_amount), 0)', 'total_principal')
      .addSelect('COALESCE(SUM(loan.interest_amount), 0)', 'total_interest')
      .addSelect('COALESCE(SUM(loan.remaining_amount), 0)', 'total_remaining')
      .getRawOne();

    return {
      data: items,
      total,
      page,
      limit,
      summary: {
        total_principal: Number(summary?.total_principal || 0),
        total_interest: Number(summary?.total_interest || 0),
        total_remaining: Number(summary?.total_remaining || 0),
      },
    };
  }

  async repay(id: number, dto: RepayLoanDto, userId: number): Promise<Loan & { loan_days: number; interest_amount: number; total_amount: number }> {
    const queryRunner = this.loanRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const loan = await queryRunner.manager.findOne(Loan, {
        where: { id },
        relations: ['customer'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!loan) {
        throw new NotFoundException('Không tìm thấy khoản vay');
      }
      if (loan.status === LoanStatus.PAID) {
        throw new BadRequestException('Khoản vay đã được thanh toán');
      }

      const repaymentDate = dto.repayment_date ? toDateOnlyString(dto.repayment_date) : toDateOnlyString(new Date());
      const loanDays = diffDays(loan.loan_date, repaymentDate);
      if (loanDays < 0) {
        throw new BadRequestException('Ngày thanh toán không được trước ngày vay');
      }
      const monthlyInterestRate = roundMoney(dto.monthly_interest_rate);
      const { interest, total } = this.buildLoanTotals(Number(loan.principal_amount), monthlyInterestRate, loanDays);
      const paymentMethod = dto.payment_method || 'cash';
      const paymentCode = CodeGeneratorHelper.generateUniqueCode('PAY');
      const payment = queryRunner.manager.create(Payment, {
        code: paymentCode,
        customer_id: loan.customer_id,
        amount: total,
        allocated_amount: total,
        payment_date: repaymentDate as any,
        payment_method: paymentMethod,
        notes: dto.notes || `Thanh toán khoản vay ${loan.code}`,
        created_by: userId,
        debt_note_code: loan.code,
      });
      const savedPayment = await queryRunner.manager.save(payment);

      loan.loan_days = loanDays;
      loan.monthly_interest_rate = monthlyInterestRate;
      loan.interest_amount = interest;
      loan.total_amount = total;
      loan.paid_amount = total;
      loan.remaining_amount = 0;
      loan.status = LoanStatus.PAID;
      loan.repayment_date = repaymentDate as any;
      loan.settled_by = userId;
      loan.payment_id = savedPayment.id;

      const savedLoan = await queryRunner.manager.save(loan);
      await queryRunner.commitTransaction();

      return {
        ...savedLoan,
        loan_days: loanDays,
        interest_amount: interest,
        total_amount: total,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
