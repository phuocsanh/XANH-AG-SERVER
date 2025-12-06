import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SearchPaymentDto } from './dto/search-payment.dto';
import { SettleDebtDto } from './dto/settle-debt.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentAllocation)
    private paymentAllocationRepository: Repository<PaymentAllocation>,
    @InjectRepository(DebtNote)
    private debtNoteRepository: Repository<DebtNote>,
    @InjectRepository(SalesInvoice)
    private salesInvoiceRepository: Repository<SalesInvoice>,
  ) {}


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
      default: return null;
    }
  }

  /**
   * Chốt sổ công nợ
   */
  async settleDebt(dto: SettleDebtDto): Promise<{
    payment: Payment;
    settled_invoices: SalesInvoice[];
    old_debt_note: DebtNote;
  }> {
    try {
      // 1. Lấy tất cả hóa đơn nợ của khách trong mùa vụ
      const unpaidInvoices = await this.salesInvoiceRepository
        .createQueryBuilder('si')
        .where('si.customer_id = :customer_id', { customer_id: dto.customer_id })
        .andWhere('si.season_id = :season_id', { season_id: dto.season_id })
        .andWhere('si.remaining_amount > 0')
        .orderBy('si.created_at', 'ASC') // Trả hóa đơn cũ trước
        .getMany();

      if (unpaidInvoices.length === 0) {
        throw new Error('Không có hóa đơn nợ nào để chốt sổ');
      }

      // 2. Tính tổng nợ
      const totalDebt = unpaidInvoices.reduce(
        (sum, inv) => sum + Number(inv.remaining_amount),
        0,
      );

      // 3. Tạo Payment record
      const paymentCode = this.generatePaymentCode();
      const payment = this.paymentRepository.create({
        code: paymentCode,
        customer_id: dto.customer_id,
        amount: dto.amount,
        payment_date: dto.payment_date || new Date().toISOString(),
        payment_method: dto.payment_method,
        notes: dto.notes || `Chốt sổ công nợ mùa vụ #${dto.season_id}`,
        created_by: 1, // TODO: Get from context
      });
      const savedPayment = await this.paymentRepository.save(payment);

      // 4. Phân bổ thanh toán cho các hóa đơn
      let remainingPayment = dto.amount;
      const settledInvoices: SalesInvoice[] = [];

      for (const invoice of unpaidInvoices) {
        if (remainingPayment <= 0) break;

        const invoiceDebt = Number(invoice.remaining_amount);
        const amountToAllocate = Math.min(remainingPayment, invoiceDebt);

        // Tạo PaymentAllocation
        await this.paymentAllocationRepository.save({
          payment_id: savedPayment.id,
          invoice_id: invoice.id,
          amount: amountToAllocate,
        });

        // Cập nhật hóa đơn
        invoice.partial_payment_amount = Number(invoice.partial_payment_amount || 0) + amountToAllocate;
        invoice.remaining_amount = invoiceDebt - amountToAllocate;
        
        if (invoice.remaining_amount <= 0) {
          invoice.payment_status = 'paid';
        }

        await this.salesInvoiceRepository.save(invoice);
        settledInvoices.push(invoice);
        remainingPayment -= amountToAllocate;
      }

      // 5. Tìm phiếu công nợ hiện tại
      const oldDebtNote = await this.debtNoteRepository
        .createQueryBuilder('dn')
        .where('dn.customer_id = :customer_id', { customer_id: dto.customer_id })
        .andWhere('dn.season_id = :season_id', { season_id: dto.season_id })
        .andWhere('dn.status IN (:...statuses)', { statuses: [DebtNoteStatus.ACTIVE, DebtNoteStatus.OVERDUE] })
        .getOne();

      if (!oldDebtNote) {
        throw new Error('Không tìm thấy phiếu công nợ cho mùa vụ này');
      }

      // 6. Cập nhật phiếu công nợ cũ
      oldDebtNote.paid_amount = Number(oldDebtNote.paid_amount || 0) + dto.amount;
      oldDebtNote.remaining_amount = totalDebt - dto.amount;

      // 7. Cập nhật trạng thái
      if (oldDebtNote.remaining_amount <= 0) {
        // Trả hết nợ
        oldDebtNote.status = DebtNoteStatus.PAID;
      } else {
        // Còn nợ → Đánh dấu đã chốt sổ
        oldDebtNote.status = DebtNoteStatus.SETTLED;
      }

      await this.debtNoteRepository.save(oldDebtNote);

      this.logger.log(
        `✅ Chốt sổ công nợ thành công: ${settledInvoices.length} hóa đơn, số tiền: ${dto.amount}`,
      );

      return {
        payment: savedPayment,
        settled_invoices: settledInvoices,
        old_debt_note: oldDebtNote,
      };
    } catch (error) {
      this.logger.error('Lỗi khi chốt sổ công nợ:', error);
      throw error;
    }
  }

  /**
   * Sinh mã phiếu thu tự động
   */
  private generatePaymentCode(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `PT${year}${month}${day}${hours}${minutes}${seconds}${random}`;
  }
}
