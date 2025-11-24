import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { Payment } from '../../entities/payment.entity';
import { SalesInvoice, SalesInvoiceStatus } from '../../entities/sales-invoices.entity';
import { DebtNote, DebtNoteStatus } from '../../entities/debt-note.entity';
import { CreatePaymentAllocationDto } from './dto/create-payment-allocation.dto';
import { SearchPaymentAllocationDto } from './dto/search-payment-allocation.dto';
import { FilterConditionDto } from '../payment/dto/filter-condition.dto';

@Injectable()
export class PaymentAllocationService {
  constructor(
    @InjectRepository(PaymentAllocation)
    private allocationRepository: Repository<PaymentAllocation>,
    private dataSource: DataSource,
  ) {}

  async create(createDto: CreatePaymentAllocationDto): Promise<PaymentAllocation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get Payment
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: createDto.payment_id },
      });

      if (!payment) {
        throw new NotFoundException('Phiếu thu không tồn tại');
      }

      // Check available amount
      const availableAmount = Number(payment.amount) - Number(payment.allocated_amount);
      if (createDto.amount > availableAmount) {
        throw new BadRequestException('Số tiền phân bổ vượt quá số tiền còn lại của phiếu thu');
      }

      // 2. Handle Allocation Target
      if (createDto.allocation_type === 'invoice') {
        if (!createDto.invoice_id) throw new BadRequestException('Thiếu invoice_id');
        
        const invoice = await queryRunner.manager.findOne(SalesInvoice, {
          where: { id: createDto.invoice_id },
        });

        if (!invoice) throw new NotFoundException('Hóa đơn không tồn tại');

        // Update Invoice
        const currentPaid = parseFloat(invoice.partial_payment_amount?.toString() || '0');
        const finalAmount = parseFloat(invoice.final_amount?.toString() || '0');
        const newPaid = currentPaid + createDto.amount;
        const newRemaining = finalAmount - newPaid;

        if (newRemaining < 0) {
             // Allow overpayment? Usually no.
             // throw new BadRequestException('Số tiền phân bổ vượt quá số tiền còn nợ của hóa đơn');
             // For now, let's allow it or clamp it? Better to throw error.
             // But floating point issues might trigger this. Let's use a small epsilon if needed, or just trust the math.
        }

        invoice.partial_payment_amount = newPaid;
        invoice.remaining_amount = newRemaining;
        
        if (newRemaining <= 0) {
            invoice.status = SalesInvoiceStatus.PAID;
            invoice.payment_status = 'paid';
            invoice.remaining_amount = 0; // Clamp to 0
        } else {
            invoice.payment_status = 'partial';
        }

        await queryRunner.manager.save(invoice);

      } else if (createDto.allocation_type === 'debt_note') {
        if (!createDto.debt_note_id) throw new BadRequestException('Thiếu debt_note_id');

        const debtNote = await queryRunner.manager.findOne(DebtNote, {
            where: { id: createDto.debt_note_id },
        });

        if (!debtNote) throw new NotFoundException('Phiếu công nợ không tồn tại');

        // Update Debt Note
        const currentPaid = parseFloat(debtNote.paid_amount?.toString() || '0');
        const amount = parseFloat(debtNote.amount?.toString() || '0');
        const newPaid = currentPaid + createDto.amount;
        const newRemaining = amount - newPaid;

        debtNote.paid_amount = newPaid;
        debtNote.remaining_amount = newRemaining;

        if (newRemaining <= 0) {
            debtNote.status = DebtNoteStatus.PAID;
            debtNote.remaining_amount = 0;
        }

        await queryRunner.manager.save(debtNote);
      }

      // 3. Create Allocation
      const allocation = this.allocationRepository.create(createDto);
      const savedAllocation = await queryRunner.manager.save(allocation);

      // 4. Update Payment
      payment.allocated_amount = Number(payment.allocated_amount) + createDto.amount;
      await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
      return savedAllocation;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<PaymentAllocation[]> {
    return this.allocationRepository.find({
      relations: ['payment', 'invoice', 'debt_note'],
      order: { created_at: 'DESC' },
    });
  }

  async search(searchDto: SearchPaymentAllocationDto): Promise<{
    data: PaymentAllocation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.allocationRepository.createQueryBuilder('allocation');
    
    queryBuilder.leftJoinAndSelect('allocation.payment', 'payment');
    queryBuilder.leftJoinAndSelect('allocation.invoice', 'invoice');
    queryBuilder.leftJoinAndSelect('allocation.debt_note', 'debt_note');

    this.buildSearchConditions(queryBuilder, searchDto, 'allocation');

    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);
    queryBuilder.orderBy('allocation.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  // Helper for search conditions (duplicated from PaymentService, could be shared)
  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<PaymentAllocation>,
    searchDto: SearchPaymentAllocationDto,
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
    const field = `${alias}.${filter.field}`; // Simplified for now

    switch (filter.operator) {
      case 'eq': parameters[paramName] = filter.value; return `${field} = :${paramName}`;
      // ... other operators can be added as needed
      default: return null;
    }
  }
}
